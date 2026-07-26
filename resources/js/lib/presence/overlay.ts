import type {
    PresenceCursor,
    PresenceGhost,
    PresenceHalo,
    PresenceOverlay,
} from '@freedraw/engine';
import type {
    PresenceDragGhost,
    PresenceFrame,
    PresenceParticipant,
} from './awareness';
import { isPresenceStale } from './awareness';

export type PresenceFrameResolver = (
    selection: readonly string[],
) => PresenceFrame | null;

export type PresenceGhostResolver = (
    ids: readonly string[],
    dx: number,
    dy: number,
) => PresenceFrame[] | null;

export interface PresenceOverlayBuildOptions {
    resolveFrame: PresenceFrameResolver;
    resolveGhost?: PresenceGhostResolver;
    scene?: unknown;
    now?: number;
    ttlMs?: number;
    halos?: boolean;
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

interface GhostCacheEntry {
    scene: unknown;
    color: string;
    ids: readonly string[];
    dx: number;
    dy: number;
    ghost: PresenceGhost | null;
}

export const EMPTY_PRESENCE_OVERLAY: PresenceOverlay = {
    cursors: [],
    halos: [],
    ghosts: [],
};

export function isEmptyPresenceOverlay(overlay: PresenceOverlay): boolean {
    return (
        overlay.cursors.length === 0 &&
        overlay.halos.length === 0 &&
        overlay.ghosts.length === 0
    );
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

function sameFrame(a: PresenceFrame, b: PresenceFrame): boolean {
    return (
        a.rotation === b.rotation &&
        a.center.x === b.center.x &&
        a.center.y === b.center.y &&
        a.bounds.x === b.bounds.x &&
        a.bounds.y === b.bounds.y &&
        a.bounds.width === b.bounds.width &&
        a.bounds.height === b.bounds.height
    );
}

function sameHalo(a: PresenceHalo, b: PresenceHalo): boolean {
    if (a === b) {
        return true;
    }

    return a.id === b.id && a.color === b.color && sameFrame(a.frame, b.frame);
}

function sameGhost(a: PresenceGhost, b: PresenceGhost): boolean {
    if (a === b) {
        return true;
    }

    return (
        a.id === b.id &&
        a.color === b.color &&
        a.frames.length === b.frames.length &&
        a.frames.every((frame, index) => sameFrame(frame, b.frames[index]))
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

    if (a.ghosts.length !== b.ghosts.length) {
        return false;
    }

    return (
        a.cursors.every((cursor, index) =>
            sameCursor(cursor, b.cursors[index]),
        ) &&
        a.halos.every((halo, index) => sameHalo(halo, b.halos[index])) &&
        a.ghosts.every((ghost, index) => sameGhost(ghost, b.ghosts[index]))
    );
}

export function createPresenceOverlayMapper(): PresenceOverlayMapper {
    const cache = new Map<number, HaloCacheEntry>();
    const ghostCache = new Map<number, GhostCacheEntry>();

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

    const ghostFor = (
        participant: PresenceParticipant,
        delta: PresenceDragGhost,
        options: PresenceOverlayBuildOptions,
    ): PresenceGhost | null => {
        const resolve = options.resolveGhost;

        if (resolve === undefined) {
            return null;
        }

        const cached = ghostCache.get(participant.clientId);

        if (
            cached !== undefined &&
            cached.scene === options.scene &&
            cached.color === participant.user.color &&
            cached.dx === delta.dx &&
            cached.dy === delta.dy &&
            sameSelection(cached.ids, delta.ids)
        ) {
            return cached.ghost;
        }

        const frames = resolve(delta.ids, delta.dx, delta.dy);
        const ghost: PresenceGhost | null =
            frames === null || frames.length === 0
                ? null
                : {
                      id: String(participant.clientId),
                      frames,
                      color: participant.user.color,
                  };

        ghostCache.set(participant.clientId, {
            scene: options.scene,
            color: participant.user.color,
            ids: delta.ids,
            dx: delta.dx,
            dy: delta.dy,
            ghost,
        });

        return ghost;
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

        for (const clientId of ghostCache.keys()) {
            if (!live.has(clientId)) {
                ghostCache.delete(clientId);
            }
        }
    };

    return {
        reset() {
            cache.clear();
            ghostCache.clear();
        },
        build(participants, options) {
            const at = options.now ?? Date.now();
            const withHalos = options.halos !== false;

            if (!withHalos && (cache.size > 0 || ghostCache.size > 0)) {
                cache.clear();
                ghostCache.clear();
            }

            let cursors: PresenceCursor[] | null = null;
            let halos: PresenceHalo[] | null = null;
            let ghosts: PresenceGhost[] | null = null;
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

                if (!withHalos) {
                    continue;
                }

                const delta = participant.drag?.ghost ?? null;

                if (delta !== null) {
                    const ghost = ghostFor(participant, delta, options);

                    if (ghost !== null) {
                        ghosts ??= [];
                        ghosts.push(ghost);
                    }
                }

                const dragged = participant.drag?.frame ?? null;

                if (dragged !== null) {
                    halos ??= [];
                    halos.push({
                        id: String(participant.clientId),
                        frame: dragged,
                        color: participant.user.color,
                    });

                    continue;
                }

                const halo = haloFor(participant, options);

                if (halo !== null) {
                    halos ??= [];
                    halos.push(halo);
                }
            }

            if (cache.size > remote || ghostCache.size > remote) {
                prune(participants);
            }

            if (cursors === null && halos === null && ghosts === null) {
                return EMPTY_PRESENCE_OVERLAY;
            }

            return {
                cursors: cursors ?? EMPTY_PRESENCE_OVERLAY.cursors,
                halos: halos ?? EMPTY_PRESENCE_OVERLAY.halos,
                ghosts: ghosts ?? EMPTY_PRESENCE_OVERLAY.ghosts,
            };
        },
    };
}
