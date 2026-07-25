import type {
    PresenceCursor,
    PresenceHalo,
    PresenceOverlay,
} from '@freedraw/engine';
import type { PresenceFrame, PresenceParticipant } from './awareness';
import { isPresenceStale } from './awareness';

export type PresenceFrameResolver = (
    selection: readonly string[],
) => PresenceFrame | null;

export interface PresenceOverlayBuildOptions {
    resolveFrame: PresenceFrameResolver;
    scene?: unknown;
    now?: number;
    ttlMs?: number;
}

export interface PresenceOverlayMapper {
    build(
        participants: readonly PresenceParticipant[],
        options: PresenceOverlayBuildOptions,
    ): PresenceOverlay;
    reset(): void;
}

interface HaloCacheEntry {
    scene: unknown;
    color: string;
    selection: readonly string[];
    halo: PresenceHalo | null;
}

export const EMPTY_PRESENCE_OVERLAY: PresenceOverlay = {
    cursors: [],
    halos: [],
};

export function isEmptyPresenceOverlay(overlay: PresenceOverlay): boolean {
    return overlay.cursors.length === 0 && overlay.halos.length === 0;
}

function sameSelection(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((id, index) => id === b[index]);
}

function sameCursor(a: PresenceCursor, b: PresenceCursor): boolean {
    return (
        a.id === b.id &&
        a.color === b.color &&
        a.label === b.label &&
        a.point.x === b.point.x &&
        a.point.y === b.point.y
    );
}

function sameHalo(a: PresenceHalo, b: PresenceHalo): boolean {
    if (a === b) {
        return true;
    }

    return (
        a.id === b.id &&
        a.color === b.color &&
        a.frame.rotation === b.frame.rotation &&
        a.frame.center.x === b.frame.center.x &&
        a.frame.center.y === b.frame.center.y &&
        a.frame.bounds.x === b.frame.bounds.x &&
        a.frame.bounds.y === b.frame.bounds.y &&
        a.frame.bounds.width === b.frame.bounds.width &&
        a.frame.bounds.height === b.frame.bounds.height
    );
}

export function samePresenceOverlay(
    a: PresenceOverlay,
    b: PresenceOverlay,
): boolean {
    if (a === b) {
        return true;
    }

    if (a.cursors.length !== b.cursors.length) {
        return false;
    }

    if (a.halos.length !== b.halos.length) {
        return false;
    }

    return (
        a.cursors.every((cursor, index) =>
            sameCursor(cursor, b.cursors[index]),
        ) && a.halos.every((halo, index) => sameHalo(halo, b.halos[index]))
    );
}

export function createPresenceOverlayMapper(): PresenceOverlayMapper {
    const cache = new Map<number, HaloCacheEntry>();

    const haloFor = (
        participant: PresenceParticipant,
        options: PresenceOverlayBuildOptions,
    ): PresenceHalo | null => {
        const cached = cache.get(participant.clientId);

        if (
            cached !== undefined &&
            cached.scene === options.scene &&
            cached.color === participant.user.color &&
            sameSelection(cached.selection, participant.selection)
        ) {
            return cached.halo;
        }

        const frame =
            participant.selection.length === 0
                ? null
                : options.resolveFrame(participant.selection);
        const halo: PresenceHalo | null =
            frame === null
                ? null
                : {
                      id: String(participant.clientId),
                      frame,
                      color: participant.user.color,
                  };

        cache.set(participant.clientId, {
            scene: options.scene,
            color: participant.user.color,
            selection: participant.selection,
            halo,
        });

        return halo;
    };

    const prune = (participants: readonly PresenceParticipant[]): void => {
        const live = new Set<number>();

        for (const participant of participants) {
            live.add(participant.clientId);
        }

        for (const clientId of cache.keys()) {
            if (!live.has(clientId)) {
                cache.delete(clientId);
            }
        }
    };

    return {
        reset() {
            cache.clear();
        },
        build(participants, options) {
            const at = options.now ?? Date.now();
            let cursors: PresenceCursor[] | null = null;
            let halos: PresenceHalo[] | null = null;
            let remote = 0;

            for (const participant of participants) {
                if (participant.isLocal) {
                    continue;
                }

                remote += 1;

                if (isPresenceStale(participant, at, options.ttlMs)) {
                    continue;
                }

                const point = participant.cursor;

                if (point !== null) {
                    cursors ??= [];
                    cursors.push({
                        id: String(participant.clientId),
                        point,
                        color: participant.user.color,
                        label: participant.user.name,
                    });
                }

                const halo = haloFor(participant, options);

                if (halo !== null) {
                    halos ??= [];
                    halos.push(halo);
                }
            }

            if (cache.size > remote) {
                prune(participants);
            }

            if (cursors === null && halos === null) {
                return EMPTY_PRESENCE_OVERLAY;
            }

            return {
                cursors: cursors ?? EMPTY_PRESENCE_OVERLAY.cursors,
                halos: halos ?? EMPTY_PRESENCE_OVERLAY.halos,
            };
        },
    };
}
