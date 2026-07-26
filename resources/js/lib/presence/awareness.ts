import type { ToolId } from '@freedraw/engine';
import type { PresenceIdentity, PresenceKind } from './identity';
import {
    guestNameFor,
    presenceAvatarUrl,
    presenceColorFor,
    presenceDisplayName,
} from './identity';

export type PresenceAwarenessEvent = 'change' | 'update';

export interface PresenceAwareness {
    clientID: number;
    getLocalState(): Record<string, unknown> | null;
    setLocalState(state: Record<string, unknown> | null): void;
    setLocalStateField(field: string, value: unknown): void;
    getStates(): Map<number, Record<string, unknown>>;
    on(event: PresenceAwarenessEvent, handler: () => void): void;
    off(event: PresenceAwarenessEvent, handler: () => void): void;
}

export interface PresencePoint {
    x: number;
    y: number;
}

export interface PresenceRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface PresenceFrame {
    bounds: PresenceRect;
    center: PresencePoint;
    rotation: number;
}

export interface PresenceViewport {
    x: number;
    y: number;
    width: number;
    height: number;
    zoom: number;
}

export type PresenceDragKind = 'move' | 'resize' | 'rotate' | 'create' | 'draw';

export interface PresenceDragGhost {
    ids: string[];
    dx: number;
    dy: number;
}

export interface PresenceDrag {
    kind: PresenceDragKind;
    frame: PresenceFrame | null;
    ghost?: PresenceDragGhost | null;
}

export interface PresenceState {
    user: PresenceIdentity;
    cursor: PresencePoint | null;
    selection: string[];
    tool: string | null;
    viewport: PresenceViewport | null;
    drag: PresenceDrag | null;
    updatedAt: number;
}

export interface PresenceParticipant extends PresenceState {
    clientId: number;
    isLocal: boolean;
}

export interface PresenceRosterEntry {
    clientId: number;
    id: string;
    kind: PresenceKind;
    name: string;
    color: string;
    avatar: string | null;
    isLocal: boolean;
}

export interface PresenceWriterOptions {
    cursorIntervalMs?: number;
    viewportIntervalMs?: number;
    readOnly?: boolean;
    now?: () => number;
}

export interface PresenceWriter {
    readonly identity: PresenceIdentity;
    readonly readOnly: boolean;
    getState(): PresenceState;
    setCursor(point: PresencePoint | null): void;
    setSelection(ids: readonly string[]): void;
    setTool(tool: ToolId | null): void;
    setViewport(viewport: PresenceViewport | null): void;
    setDrag(drag: PresenceDrag | null): void;
    setReadOnly(readOnly: boolean): void;
    flush(): void;
    clear(): void;
    destroy(): void;
}

export interface PresenceRosterStore {
    subscribe(listener: () => void): () => void;
    getSnapshot(): PresenceRosterEntry[];
    getServerSnapshot(): PresenceRosterEntry[];
}

export const PRESENCE_FIELD = 'presence';
export const PRESENCE_CURSOR_INTERVAL_MS = 30;
export const PRESENCE_VIEWPORT_INTERVAL_MS = 100;
export const PRESENCE_STALE_MS = 20_000;
export const PRESENCE_MAX_SELECTION = 256;

const DRAG_KINDS: readonly PresenceDragKind[] = [
    'move',
    'resize',
    'rotate',
    'create',
    'draw',
];
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const EMPTY_ROSTER: PresenceRosterEntry[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function finite(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }

    return value;
}

function normalizePoint(value: unknown): PresencePoint | null {
    if (!isRecord(value)) {
        return null;
    }

    const x = finite(value.x);
    const y = finite(value.y);

    if (x === null || y === null) {
        return null;
    }

    return { x, y };
}

function normalizeRect(value: unknown): PresenceRect | null {
    if (!isRecord(value)) {
        return null;
    }

    const x = finite(value.x);
    const y = finite(value.y);
    const width = finite(value.width);
    const height = finite(value.height);

    if (x === null || y === null || width === null || height === null) {
        return null;
    }

    return { x, y, width, height };
}

export function normalizePresenceFrame(value: unknown): PresenceFrame | null {
    if (!isRecord(value)) {
        return null;
    }

    const bounds = normalizeRect(value.bounds);
    const center = normalizePoint(value.center);
    const rotation = finite(value.rotation);

    if (bounds === null || center === null || rotation === null) {
        return null;
    }

    return { bounds, center, rotation };
}

export function normalizePresenceViewport(
    value: unknown,
): PresenceViewport | null {
    const rect = normalizeRect(value);

    if (rect === null || !isRecord(value)) {
        return null;
    }

    const zoom = finite(value.zoom);

    if (zoom === null || zoom <= 0) {
        return null;
    }

    return { ...rect, zoom };
}

function normalizeSelection(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const ids: string[] = [];

    for (const entry of value) {
        if (typeof entry === 'string' && entry !== '') {
            ids.push(entry);
        }

        if (ids.length >= PRESENCE_MAX_SELECTION) {
            break;
        }
    }

    return ids;
}

export function normalizePresenceDragGhost(
    value: unknown,
): PresenceDragGhost | null {
    if (!isRecord(value)) {
        return null;
    }

    const dx = finite(value.dx);
    const dy = finite(value.dy);
    const ids = normalizeSelection(value.ids);

    if (dx === null || dy === null || ids.length === 0) {
        return null;
    }

    return { ids, dx, dy };
}

function normalizeDrag(value: unknown): PresenceDrag | null {
    if (!isRecord(value)) {
        return null;
    }

    const kind = DRAG_KINDS.find((candidate) => candidate === value.kind);

    if (kind === undefined) {
        return null;
    }

    return {
        kind,
        frame: normalizePresenceFrame(value.frame),
        ghost: normalizePresenceDragGhost(value.ghost),
    };
}

function normalizeTool(value: unknown): string | null {
    if (typeof value !== 'string' || value.trim() === '') {
        return null;
    }

    return value.trim().slice(0, 32);
}

function normalizeColor(value: unknown, id: string): string {
    if (typeof value === 'string' && HEX_COLOR.test(value.trim())) {
        return value.trim();
    }

    return presenceColorFor(id);
}

export function normalizePresenceIdentity(
    value: unknown,
): PresenceIdentity | null {
    if (!isRecord(value)) {
        return null;
    }

    const id = typeof value.id === 'string' ? value.id.trim() : '';

    if (id === '') {
        return null;
    }

    const name =
        typeof value.name === 'string'
            ? presenceDisplayName(id, value.name)
            : guestNameFor(id);

    return {
        id,
        kind: value.kind === 'user' ? 'user' : 'guest',
        name,
        color: normalizeColor(value.color, id),
        avatar: presenceAvatarUrl(
            typeof value.avatar === 'string' ? value.avatar : null,
        ),
    };
}

export function normalizePresenceState(value: unknown): PresenceState | null {
    if (!isRecord(value)) {
        return null;
    }

    const user = normalizePresenceIdentity(value.user);

    if (user === null) {
        return null;
    }

    return {
        user,
        cursor: normalizePoint(value.cursor),
        selection: normalizeSelection(value.selection),
        tool: normalizeTool(value.tool),
        viewport: normalizePresenceViewport(value.viewport),
        drag: normalizeDrag(value.drag),
        updatedAt: finite(value.updatedAt) ?? 0,
    };
}

export function readPresenceParticipants(
    awareness: PresenceAwareness | null,
): PresenceParticipant[] {
    if (awareness === null) {
        return [];
    }

    const participants: PresenceParticipant[] = [];
    const local = awareness.clientID;

    awareness.getStates().forEach((raw, clientId) => {
        const state = normalizePresenceState(raw[PRESENCE_FIELD]);

        if (state === null) {
            return;
        }

        participants.push({ ...state, clientId, isLocal: clientId === local });
    });

    participants.sort((a, b) => a.clientId - b.clientId);

    return participants;
}

export function toPresenceRosterEntry(
    participant: PresenceParticipant,
): PresenceRosterEntry {
    return {
        clientId: participant.clientId,
        id: participant.user.id,
        kind: participant.user.kind,
        name: participant.user.name,
        color: participant.user.color,
        avatar: participant.user.avatar,
        isLocal: participant.isLocal,
    };
}

export function readPresenceRoster(
    awareness: PresenceAwareness | null,
): PresenceRosterEntry[] {
    return readPresenceParticipants(awareness).map(toPresenceRosterEntry);
}

export function isSameRoster(
    a: readonly PresenceRosterEntry[],
    b: readonly PresenceRosterEntry[],
): boolean {
    if (a.length !== b.length) {
        return false;
    }

    return a.every((entry, index) => {
        const other = b[index];

        return (
            entry.clientId === other.clientId &&
            entry.id === other.id &&
            entry.kind === other.kind &&
            entry.name === other.name &&
            entry.color === other.color &&
            entry.avatar === other.avatar &&
            entry.isLocal === other.isLocal
        );
    });
}

export function isPresenceStale(
    state: PresenceState,
    at: number = Date.now(),
    ttlMs: number = PRESENCE_STALE_MS,
): boolean {
    return at - state.updatedAt > ttlMs;
}

export function subscribePresence(
    awareness: PresenceAwareness | null,
    listener: () => void,
): () => void {
    if (awareness === null) {
        return () => undefined;
    }

    awareness.on('change', listener);

    return () => {
        awareness.off('change', listener);
    };
}

export function createPresenceRosterStore(
    awareness: PresenceAwareness | null,
): PresenceRosterStore {
    let snapshot: PresenceRosterEntry[] | null = null;
    let detach: (() => void) | null = null;
    const listeners = new Set<() => void>();

    const read = (): PresenceRosterEntry[] => {
        const next = readPresenceRoster(awareness);

        if (snapshot !== null && isSameRoster(snapshot, next)) {
            return snapshot;
        }

        snapshot = next;

        return next;
    };

    const getSnapshot = (): PresenceRosterEntry[] => snapshot ?? read();

    const notify = (): void => {
        const before = snapshot;

        if (before === null || read() === before) {
            return;
        }

        listeners.forEach((listener) => listener());
    };

    return {
        getSnapshot,
        getServerSnapshot: () => EMPTY_ROSTER,
        subscribe(listener) {
            listeners.add(listener);

            if (detach === null) {
                detach = subscribePresence(awareness, notify);
                notify();
            }

            return () => {
                listeners.delete(listener);

                if (listeners.size === 0 && detach !== null) {
                    detach();
                    detach = null;
                }
            };
        },
    };
}

function samePoint(a: PresencePoint | null, b: PresencePoint | null): boolean {
    if (a === null || b === null) {
        return a === b;
    }

    return a.x === b.x && a.y === b.y;
}

function sameRect(a: PresenceRect, b: PresenceRect): boolean {
    return (
        a.x === b.x &&
        a.y === b.y &&
        a.width === b.width &&
        a.height === b.height
    );
}

function sameFrame(a: PresenceFrame | null, b: PresenceFrame | null): boolean {
    if (a === null || b === null) {
        return a === b;
    }

    return (
        sameRect(a.bounds, b.bounds) &&
        samePoint(a.center, b.center) &&
        a.rotation === b.rotation
    );
}

function sameViewport(
    a: PresenceViewport | null,
    b: PresenceViewport | null,
): boolean {
    if (a === null || b === null) {
        return a === b;
    }

    return sameRect(a, b) && a.zoom === b.zoom;
}

function sameSelection(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((id, index) => id === b[index]);
}

function sameGhost(
    a: PresenceDragGhost | null,
    b: PresenceDragGhost | null,
): boolean {
    if (a === null || b === null) {
        return a === b;
    }

    return a.dx === b.dx && a.dy === b.dy && sameSelection(a.ids, b.ids);
}

function sameDrag(a: PresenceDrag | null, b: PresenceDrag | null): boolean {
    if (a === null || b === null) {
        return a === b;
    }

    return (
        a.kind === b.kind &&
        sameFrame(a.frame, b.frame) &&
        sameGhost(a.ghost ?? null, b.ghost ?? null)
    );
}

function cloneFrame(frame: PresenceFrame | null): PresenceFrame | null {
    if (frame === null) {
        return null;
    }

    return {
        bounds: { ...frame.bounds },
        center: { ...frame.center },
        rotation: frame.rotation,
    };
}

function cloneGhost(ghost: PresenceDragGhost | null): PresenceDragGhost | null {
    if (ghost === null) {
        return null;
    }

    return { ids: [...ghost.ids], dx: ghost.dx, dy: ghost.dy };
}

export function createPresenceWriter(
    awareness: PresenceAwareness,
    identity: PresenceIdentity,
    options: PresenceWriterOptions = {},
): PresenceWriter {
    const now = options.now ?? Date.now;
    const cursorInterval =
        options.cursorIntervalMs ?? PRESENCE_CURSOR_INTERVAL_MS;
    const viewportInterval =
        options.viewportIntervalMs ?? PRESENCE_VIEWPORT_INTERVAL_MS;

    let readOnly = options.readOnly ?? false;
    let destroyed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let deadline = Number.POSITIVE_INFINITY;
    let publishedAt = Number.NEGATIVE_INFINITY;

    const state: PresenceState = {
        user: identity,
        cursor: null,
        selection: [],
        tool: null,
        viewport: null,
        drag: null,
        updatedAt: 0,
    };

    const cancel = (): void => {
        if (timer === null) {
            return;
        }

        clearTimeout(timer);
        timer = null;
        deadline = Number.POSITIVE_INFINITY;
    };

    const publish = (): void => {
        if (destroyed) {
            return;
        }

        cancel();
        publishedAt = now();
        state.updatedAt = publishedAt;
        awareness.setLocalStateField(PRESENCE_FIELD, {
            ...state,
            selection: [...state.selection],
        });
    };

    const schedule = (interval: number): void => {
        if (destroyed) {
            return;
        }

        const at = now();

        if (at - publishedAt >= interval) {
            publish();

            return;
        }

        const next = publishedAt + interval;

        if (timer !== null && deadline <= next) {
            return;
        }

        cancel();
        deadline = next;
        timer = setTimeout(publish, Math.max(0, next - at));
    };

    publish();

    return {
        identity,
        get readOnly() {
            return readOnly;
        },
        getState: () => ({ ...state, selection: [...state.selection] }),
        setCursor(point) {
            const next = point === null ? null : { x: point.x, y: point.y };

            if (samePoint(state.cursor, next)) {
                return;
            }

            state.cursor = next;

            if (next === null) {
                publish();

                return;
            }

            schedule(cursorInterval);
        },
        setSelection(ids) {
            if (readOnly || sameSelection(state.selection, ids)) {
                return;
            }

            state.selection = [...ids];
            publish();
        },
        setTool(tool) {
            if (readOnly || state.tool === tool) {
                return;
            }

            state.tool = tool;
            publish();
        },
        setViewport(viewport) {
            if (sameViewport(state.viewport, viewport)) {
                return;
            }

            state.viewport = viewport === null ? null : { ...viewport };

            if (viewport === null) {
                publish();

                return;
            }

            schedule(viewportInterval);
        },
        setDrag(drag) {
            if (readOnly || sameDrag(state.drag, drag)) {
                return;
            }

            const ghost = drag === null ? null : cloneGhost(drag.ghost ?? null);
            const structural =
                state.drag === null ||
                drag === null ||
                state.drag.kind !== drag.kind ||
                ((state.drag.ghost ?? null) === null) !== (ghost === null);

            state.drag =
                drag === null
                    ? null
                    : { kind: drag.kind, frame: cloneFrame(drag.frame), ghost };

            if (structural) {
                publish();

                return;
            }

            schedule(cursorInterval);
        },
        setReadOnly(next) {
            if (readOnly === next) {
                return;
            }

            readOnly = next;

            if (!next) {
                return;
            }

            const published =
                state.selection.length > 0 ||
                state.tool !== null ||
                state.drag !== null;

            state.selection = [];
            state.tool = null;
            state.drag = null;

            if (published) {
                publish();
            }
        },
        flush() {
            if (timer === null) {
                return;
            }

            publish();
        },
        clear() {
            cancel();
            awareness.setLocalStateField(PRESENCE_FIELD, null);
        },
        destroy() {
            if (destroyed) {
                return;
            }

            cancel();
            awareness.setLocalStateField(PRESENCE_FIELD, null);
            destroyed = true;
        },
    };
}
