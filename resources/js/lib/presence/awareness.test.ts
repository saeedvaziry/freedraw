import { afterEach, describe, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import type { CollabAwareness } from '@/lib/persistence/collab-provider';
import type { SelectionFrame } from '@freedraw/engine';
import type {
    PresenceAwareness,
    PresenceFrame,
    PresenceState,
} from './awareness';
import {
    createPresenceRosterStore,
    createPresenceWriter,
    isPresenceStale,
    isSameRoster,
    normalizePresenceDragGhost,
    normalizePresenceLaser,
    normalizePresenceState,
    readPresenceParticipants,
    readPresenceRoster,
    PRESENCE_FIELD,
} from './awareness';
import type { PresenceIdentity } from './identity';
import { presenceColorFor, resolvePresenceIdentity } from './identity';

interface FakeAwareness extends PresenceAwareness {
    states: Map<number, Record<string, unknown>>;
    publishes: number;
    emit(): void;
}

function createFakeAwareness(clientID = 1): FakeAwareness {
    const states = new Map<number, Record<string, unknown>>();
    const handlers = new Set<() => void>();

    const emit = (): void => {
        handlers.forEach((handler) => handler());
    };

    const awareness: FakeAwareness = {
        clientID,
        states,
        publishes: 0,
        emit,
        getLocalState: () => states.get(clientID) ?? null,
        setLocalState: (state) => {
            if (state === null) {
                states.delete(clientID);
            } else {
                states.set(clientID, state);
            }

            emit();
        },
        setLocalStateField: (field, value) => {
            if (field === PRESENCE_FIELD) {
                awareness.publishes += 1;
            }

            states.set(clientID, {
                ...(states.get(clientID) ?? {}),
                [field]: value,
            });
            emit();
        },
        getStates: () => states,
        on: (_event, handler) => {
            handlers.add(handler);
        },
        off: (_event, handler) => {
            handlers.delete(handler);
        },
    };

    return awareness;
}

function identityFor(id: number, name: string): PresenceIdentity {
    return resolvePresenceIdentity({ user: { id, name } });
}

function readLocal(awareness: PresenceAwareness): PresenceState | null {
    const raw = awareness.getStates().get(awareness.clientID);

    return normalizePresenceState(raw?.[PRESENCE_FIELD]);
}

function remoteState(
    identity: PresenceIdentity,
    overrides: Partial<PresenceState> = {},
): Record<string, unknown> {
    return {
        [PRESENCE_FIELD]: {
            user: identity,
            cursor: null,
            selection: [],
            tool: null,
            viewport: null,
            drag: null,
            updatedAt: 1,
            ...overrides,
        },
    };
}

afterEach(() => {
    vi.useRealTimers();
});

describe('PresenceAwareness', () => {
    it('is satisfied by the y-protocols Awareness the collab provider owns', () => {
        const doc = new Y.Doc();
        const awareness = new Awareness(doc);
        const provided: CollabAwareness = awareness;
        const typed: PresenceAwareness = provided;

        expect(typed.clientID).toBe(awareness.clientID);
        expect(readPresenceParticipants(typed)).toEqual([]);

        awareness.destroy();
        doc.destroy();
    });
});

describe('PresenceFrame', () => {
    it('accepts an engine selection frame unchanged', () => {
        const selection: SelectionFrame = {
            bounds: { x: 1, y: 2, width: 3, height: 4 },
            center: { x: 2.5, y: 4 },
            rotation: 0.5,
        };
        const frame: PresenceFrame = selection;

        expect(frame.rotation).toBe(0.5);
    });
});

describe('createPresenceWriter', () => {
    it('publishes the identity immediately so peers see a roster entry', () => {
        const awareness = createFakeAwareness();
        const identity = identityFor(1, 'Ada');

        createPresenceWriter(awareness, identity);

        expect(awareness.publishes).toBe(1);
        expect(readLocal(awareness)?.user).toEqual(identity);
    });

    it('publishes selection and tool changes immediately', () => {
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'));
        awareness.publishes = 0;

        writer.setSelection(['a', 'b']);
        writer.setTool('freedraw');

        expect(awareness.publishes).toBe(2);
        expect(readLocal(awareness)?.selection).toEqual(['a', 'b']);
        expect(readLocal(awareness)?.tool).toBe('freedraw');
    });

    it('skips redundant selection and tool writes', () => {
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'));
        writer.setSelection(['a']);
        writer.setTool('select');
        awareness.publishes = 0;

        writer.setSelection(['a']);
        writer.setTool('select');

        expect(awareness.publishes).toBe(0);
    });

    it('throttles cursor writes to the cursor interval', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            cursorIntervalMs: 30,
        });
        awareness.publishes = 0;

        writer.setCursor({ x: 1, y: 1 });
        vi.advanceTimersByTime(29);
        writer.setCursor({ x: 2, y: 2 });

        expect(awareness.publishes).toBe(0);

        vi.advanceTimersByTime(1);

        expect(awareness.publishes).toBe(1);
        expect(readLocal(awareness)?.cursor).toEqual({ x: 2, y: 2 });

        vi.advanceTimersByTime(100);
        writer.setCursor({ x: 3, y: 3 });

        expect(awareness.publishes).toBe(2);
    });

    it('publishes a cleared cursor immediately', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            cursorIntervalMs: 30,
        });
        writer.setCursor({ x: 1, y: 1 });
        vi.advanceTimersByTime(30);
        awareness.publishes = 0;

        writer.setCursor(null);

        expect(awareness.publishes).toBe(1);
        expect(readLocal(awareness)?.cursor).toBeNull();
    });

    it('throttles viewport writes at a slower rate and coalesces with cursor', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            cursorIntervalMs: 30,
            viewportIntervalMs: 100,
        });
        awareness.publishes = 0;

        writer.setViewport({ x: 0, y: 0, width: 10, height: 10, zoom: 1 });
        vi.advanceTimersByTime(30);

        expect(awareness.publishes).toBe(0);

        writer.setCursor({ x: 5, y: 5 });
        vi.advanceTimersByTime(1);

        expect(awareness.publishes).toBe(1);
        expect(readLocal(awareness)?.viewport).toEqual({
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            zoom: 1,
        });
        expect(readLocal(awareness)?.cursor).toEqual({ x: 5, y: 5 });
    });

    it('publishes drag start and end immediately but throttles frames', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            cursorIntervalMs: 30,
        });
        const frame: PresenceFrame = {
            bounds: { x: 0, y: 0, width: 10, height: 10 },
            center: { x: 5, y: 5 },
            rotation: 0,
        };
        awareness.publishes = 0;

        writer.setDrag({ kind: 'move', frame });

        expect(awareness.publishes).toBe(1);

        writer.setDrag({
            kind: 'move',
            frame: { ...frame, center: { x: 6, y: 5 } },
        });

        expect(awareness.publishes).toBe(1);

        vi.advanceTimersByTime(30);

        expect(awareness.publishes).toBe(2);

        writer.setDrag(null);

        expect(awareness.publishes).toBe(3);
        expect(readLocal(awareness)?.drag).toBeNull();
    });

    it('carries the ghost delta on the drag and throttles it with the frame', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            cursorIntervalMs: 30,
        });
        const drag = (dx: number): void => {
            writer.setDrag({
                kind: 'move',
                frame: null,
                ghost: { ids: ['a', 'b'], dx, dy: 0 },
            });
        };
        awareness.publishes = 0;

        drag(10);

        expect(awareness.publishes).toBe(1);
        expect(readLocal(awareness)?.drag?.ghost).toEqual({
            ids: ['a', 'b'],
            dx: 10,
            dy: 0,
        });

        drag(20);

        expect(awareness.publishes).toBe(1);

        vi.advanceTimersByTime(30);

        expect(awareness.publishes).toBe(2);
        expect(readLocal(awareness)?.drag?.ghost?.dx).toBe(20);
    });

    it('publishes a ghost appearing or disappearing without waiting', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            cursorIntervalMs: 30,
        });
        const frame: PresenceFrame = {
            bounds: { x: 0, y: 0, width: 10, height: 10 },
            center: { x: 5, y: 5 },
            rotation: 0,
        };
        writer.setDrag({ kind: 'move', frame, ghost: null });
        awareness.publishes = 0;

        writer.setDrag({
            kind: 'move',
            frame,
            ghost: { ids: ['a'], dx: 1, dy: 2 },
        });

        expect(awareness.publishes).toBe(1);

        writer.setDrag({ kind: 'move', frame, ghost: null });

        expect(awareness.publishes).toBe(2);
        expect(readLocal(awareness)?.drag?.ghost).toBeNull();
    });

    it('skips a redundant ghost write that moved nothing', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            cursorIntervalMs: 30,
        });
        const ghost = { ids: ['a'], dx: 4, dy: 4 };
        writer.setDrag({ kind: 'move', frame: null, ghost });
        awareness.publishes = 0;

        writer.setDrag({ kind: 'move', frame: null, ghost: { ...ghost } });
        vi.advanceTimersByTime(60);

        expect(awareness.publishes).toBe(0);
    });

    it('carries the preview marker and drops any ghost that came with it', () => {
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'));

        writer.setDrag({
            kind: 'create',
            frame: null,
            ghost: { ids: ['a'], dx: 4, dy: 4 },
            preview: true,
        });

        expect(readLocal(awareness)?.drag?.preview).toBe(true);
        expect(readLocal(awareness)?.drag?.ghost).toBeNull();
    });

    it('publishes a preview flipping to a committed drag without waiting', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            cursorIntervalMs: 30,
        });
        const frame: PresenceFrame = {
            bounds: { x: 0, y: 0, width: 10, height: 10 },
            center: { x: 5, y: 5 },
            rotation: 0,
        };
        writer.setDrag({ kind: 'create', frame, preview: true });
        awareness.publishes = 0;

        writer.setDrag({
            kind: 'create',
            frame: { ...frame, center: { x: 6, y: 5 } },
            preview: true,
        });

        expect(awareness.publishes).toBe(0);

        writer.setDrag({ kind: 'create', frame });

        expect(awareness.publishes).toBe(1);
        expect(readLocal(awareness)?.drag?.preview).toBe(false);
    });

    it('never shares the ghost array it was handed', () => {
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'));
        const ids = ['a'];

        writer.setDrag({
            kind: 'move',
            frame: null,
            ghost: { ids, dx: 1, dy: 1 },
        });
        ids.push('b');

        expect(readLocal(awareness)?.drag?.ghost?.ids).toEqual(['a']);
    });

    it('flushes a pending throttled write on demand', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            cursorIntervalMs: 30,
        });
        awareness.publishes = 0;

        writer.setCursor({ x: 1, y: 1 });
        writer.flush();

        expect(awareness.publishes).toBe(1);

        vi.advanceTimersByTime(60);

        expect(awareness.publishes).toBe(1);
    });

    it('stops publishing after destroy and drops the presence field', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            cursorIntervalMs: 30,
        });

        writer.setCursor({ x: 1, y: 1 });
        writer.destroy();

        expect(readLocal(awareness)).toBeNull();

        awareness.publishes = 0;
        writer.setCursor({ x: 9, y: 9 });
        writer.setSelection(['a']);
        vi.advanceTimersByTime(1000);

        expect(awareness.publishes).toBe(0);
    });

    it('never publishes selection, tool or drag for a read-only viewer', () => {
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            readOnly: true,
        });
        awareness.publishes = 0;

        writer.setSelection(['a', 'b']);
        writer.setTool('freedraw');
        writer.setDrag({
            kind: 'move',
            frame: null,
            ghost: { ids: ['a'], dx: 5, dy: 5 },
        });

        expect(writer.readOnly).toBe(true);
        expect(awareness.publishes).toBe(0);
        expect(writer.getState().selection).toEqual([]);
        expect(writer.getState().tool).toBeNull();
        expect(writer.getState().drag).toBeNull();
    });

    it('still publishes cursor and viewport for a read-only viewer', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            cursorIntervalMs: 30,
            readOnly: true,
        });
        awareness.publishes = 0;

        writer.setCursor({ x: 1, y: 2 });
        writer.setViewport({ x: 0, y: 0, width: 10, height: 10, zoom: 1 });
        vi.advanceTimersByTime(30);

        expect(awareness.publishes).toBe(1);
        expect(readLocal(awareness)?.cursor).toEqual({ x: 1, y: 2 });
        expect(readLocal(awareness)?.viewport?.zoom).toBe(1);
    });

    it('drops an already published selection when the viewer is locked', () => {
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'));
        writer.setSelection(['a']);
        writer.setTool('freedraw');
        awareness.publishes = 0;

        writer.setReadOnly(true);

        expect(awareness.publishes).toBe(1);
        expect(readLocal(awareness)?.selection).toEqual([]);
        expect(readLocal(awareness)?.tool).toBeNull();
    });

    it('publishes nothing when locking a viewer that shared nothing', () => {
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'));
        awareness.publishes = 0;

        writer.setReadOnly(true);
        writer.setReadOnly(true);

        expect(awareness.publishes).toBe(0);
    });

    it('resumes publishing selection once the lock is lifted', () => {
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            readOnly: true,
        });
        writer.setSelection(['a']);
        awareness.publishes = 0;

        writer.setReadOnly(false);
        writer.setSelection(['a']);

        expect(writer.readOnly).toBe(false);
        expect(awareness.publishes).toBe(1);
        expect(readLocal(awareness)?.selection).toEqual(['a']);
    });

    it('writes through a real y-protocols awareness instance', () => {
        const doc = new Y.Doc();
        const awareness = new Awareness(doc);
        const identity = identityFor(3, 'Lin');
        const writer = createPresenceWriter(awareness, identity);

        writer.setSelection(['el-1']);

        const participants = readPresenceParticipants(awareness);

        expect(participants).toHaveLength(1);
        expect(participants[0].isLocal).toBe(true);
        expect(participants[0].selection).toEqual(['el-1']);
        expect(participants[0].user.color).toBe(presenceColorFor('user:3'));

        writer.destroy();
        awareness.destroy();
        doc.destroy();
    });
});

describe('normalizePresenceState', () => {
    it('rejects values without a usable identity', () => {
        expect(normalizePresenceState(null)).toBeNull();
        expect(normalizePresenceState('nope')).toBeNull();
        expect(normalizePresenceState({})).toBeNull();
        expect(normalizePresenceState({ user: { id: '  ' } })).toBeNull();
    });

    it('repairs a partial identity deterministically', () => {
        const state = normalizePresenceState({ user: { id: 'guest:z' } });

        expect(state?.user.kind).toBe('guest');
        expect(state?.user.color).toBe(presenceColorFor('guest:z'));
        expect(state?.user.name.length).toBeGreaterThan(0);
        expect(state?.user.avatar).toBeNull();
    });

    it('rejects a non-hex color and an unsafe avatar', () => {
        const state = normalizePresenceState({
            user: {
                id: 'user:1',
                color: 'var(--evil)',
                avatar: 'javascript:alert(1)',
            },
        });

        expect(state?.user.color).toBe(presenceColorFor('user:1'));
        expect(state?.user.avatar).toBeNull();
    });

    it('drops non-finite geometry', () => {
        const state = normalizePresenceState({
            user: { id: 'user:1' },
            cursor: { x: Number.NaN, y: 1 },
            viewport: { x: 0, y: 0, width: 1, height: 1, zoom: 0 },
            drag: { kind: 'teleport', frame: null },
        });

        expect(state?.cursor).toBeNull();
        expect(state?.viewport).toBeNull();
        expect(state?.drag).toBeNull();
    });

    it('keeps only string selection ids and caps the list', () => {
        const state = normalizePresenceState({
            user: { id: 'user:1' },
            selection: [
                'a',
                2,
                '',
                'b',
                ...Array.from({ length: 400 }, () => 'c'),
            ],
        });

        expect(state?.selection.slice(0, 2)).toEqual(['a', 'b']);
        expect(state?.selection.length).toBe(256);
    });

    it('keeps a well formed ghost delta on the drag', () => {
        const state = normalizePresenceState({
            user: { id: 'user:1' },
            drag: {
                kind: 'move',
                frame: null,
                ghost: { ids: ['a', 'b'], dx: -12.5, dy: 4 },
            },
        });

        expect(state?.drag?.ghost).toEqual({
            ids: ['a', 'b'],
            dx: -12.5,
            dy: 4,
        });
    });

    it('reads a drag without a preview marker as a committed drag', () => {
        const state = normalizePresenceState({
            user: { id: 'user:1' },
            drag: {
                kind: 'move',
                frame: null,
                ghost: { ids: ['a'], dx: 4, dy: 4 },
            },
        });

        expect(state?.drag?.preview).toBe(false);
        expect(state?.drag?.ghost).toEqual({ ids: ['a'], dx: 4, dy: 4 });
    });

    it('keeps the preview marker and refuses the ghost that rode with it', () => {
        const state = normalizePresenceState({
            user: { id: 'user:1' },
            drag: {
                kind: 'create',
                frame: null,
                ghost: { ids: ['a'], dx: 4, dy: 4 },
                preview: true,
            },
        });

        expect(state?.drag?.preview).toBe(true);
        expect(state?.drag?.ghost).toBeNull();
    });

    it('treats a non-boolean preview marker as no preview', () => {
        const state = normalizePresenceState({
            user: { id: 'user:1' },
            drag: { kind: 'move', frame: null, preview: 'yes' },
        });

        expect(state?.drag?.preview).toBe(false);
    });

    it('drops a ghost whose delta is not finite', () => {
        const state = normalizePresenceState({
            user: { id: 'user:1' },
            drag: {
                kind: 'move',
                frame: null,
                ghost: { ids: ['a'], dx: Number.NaN, dy: 4 },
            },
        });

        expect(state?.drag?.kind).toBe('move');
        expect(state?.drag?.ghost).toBeNull();
    });

    it('drops a ghost that names no elements', () => {
        expect(
            normalizePresenceDragGhost({ ids: [], dx: 1, dy: 1 }),
        ).toBeNull();
        expect(normalizePresenceDragGhost({ dx: 1, dy: 1 })).toBeNull();
        expect(normalizePresenceDragGhost(null)).toBeNull();
        expect(normalizePresenceDragGhost('nope')).toBeNull();
    });

    it('cleans and caps the ghost ids like a selection', () => {
        const ghost = normalizePresenceDragGhost({
            ids: ['a', 7, '', 'b', ...Array.from({ length: 400 }, () => 'c')],
            dx: 1,
            dy: 1,
        });

        expect(ghost?.ids.slice(0, 2)).toEqual(['a', 'b']);
        expect(ghost?.ids.length).toBe(256);
    });

    it('round-trips a ghost through a real y-protocols awareness', () => {
        const doc = new Y.Doc();
        const awareness = new Awareness(doc);
        const writer = createPresenceWriter(awareness, identityFor(3, 'Lin'));

        writer.setDrag({
            kind: 'move',
            frame: null,
            ghost: { ids: ['el-1', 'el-2'], dx: 8, dy: -3 },
        });

        expect(readPresenceParticipants(awareness)[0].drag?.ghost).toEqual({
            ids: ['el-1', 'el-2'],
            dx: 8,
            dy: -3,
        });

        writer.destroy();
        awareness.destroy();
        doc.destroy();
    });
});

describe('readPresenceParticipants', () => {
    it('returns an empty list without awareness', () => {
        expect(readPresenceParticipants(null)).toEqual([]);
    });

    it('flags the local client and sorts by client id', () => {
        const awareness = createFakeAwareness(5);
        awareness.states.set(9, remoteState(identityFor(9, 'Nine')));
        awareness.states.set(5, remoteState(identityFor(5, 'Five')));
        awareness.states.set(7, { other: 'field' });

        const participants = readPresenceParticipants(awareness);

        expect(participants.map((entry) => entry.clientId)).toEqual([5, 9]);
        expect(participants[0].isLocal).toBe(true);
        expect(participants[1].isLocal).toBe(false);
    });
});

describe('isSameRoster', () => {
    it('ignores cursor movement but notices identity changes', () => {
        const awareness = createFakeAwareness(1);
        awareness.states.set(1, remoteState(identityFor(1, 'Ada')));

        const before = readPresenceRoster(awareness);
        awareness.states.set(
            1,
            remoteState(identityFor(1, 'Ada'), { cursor: { x: 4, y: 4 } }),
        );

        expect(isSameRoster(before, readPresenceRoster(awareness))).toBe(true);

        awareness.states.set(2, remoteState(identityFor(2, 'Bo')));

        expect(isSameRoster(before, readPresenceRoster(awareness))).toBe(false);
    });
});

describe('createPresenceRosterStore', () => {
    it('only notifies when the roster itself changes', () => {
        const awareness = createFakeAwareness(1);
        awareness.states.set(1, remoteState(identityFor(1, 'Ada')));

        const store = createPresenceRosterStore(awareness);
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);
        const snapshot = store.getSnapshot();

        awareness.states.set(
            1,
            remoteState(identityFor(1, 'Ada'), { cursor: { x: 1, y: 1 } }),
        );
        awareness.emit();

        expect(listener).not.toHaveBeenCalled();
        expect(store.getSnapshot()).toBe(snapshot);

        awareness.states.set(2, remoteState(identityFor(2, 'Bo')));
        awareness.emit();

        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.getSnapshot()).toHaveLength(2);

        unsubscribe();
        awareness.states.delete(2);
        awareness.emit();

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('returns a stable empty snapshot without awareness', () => {
        const store = createPresenceRosterStore(null);

        expect(store.getSnapshot()).toEqual([]);
        expect(store.getServerSnapshot()).toEqual([]);
        expect(store.subscribe(vi.fn())).toBeTypeOf('function');
    });
});

describe('isPresenceStale', () => {
    it('compares the last publish time against the ttl', () => {
        const state = normalizePresenceState({
            user: { id: 'user:1' },
            updatedAt: 1_000,
        });

        expect(isPresenceStale(state as PresenceState, 5_000, 10_000)).toBe(
            false,
        );
        expect(isPresenceStale(state as PresenceState, 20_000, 10_000)).toBe(
            true,
        );
    });
});

describe('PresenceWriter laser', () => {
    it('publishes the first trail point immediately', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            laserIntervalMs: 40,
        });
        awareness.publishes = 0;

        writer.setLaser({ points: [{ x: 1, y: 2 }] });

        expect(awareness.publishes).toBe(1);
        expect(readLocal(awareness)?.laser?.points).toEqual([{ x: 1, y: 2 }]);
    });

    it('throttles trail growth to the laser interval', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            laserIntervalMs: 40,
        });
        writer.setLaser({ points: [{ x: 0, y: 0 }] });
        awareness.publishes = 0;

        writer.setLaser({
            points: [
                { x: 0, y: 0 },
                { x: 5, y: 0 },
            ],
        });
        vi.advanceTimersByTime(39);

        expect(awareness.publishes).toBe(0);

        vi.advanceTimersByTime(1);

        expect(awareness.publishes).toBe(1);
        expect(readLocal(awareness)?.laser?.points).toHaveLength(2);
    });

    it('publishes the end of a trail immediately', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            laserIntervalMs: 40,
        });
        writer.setLaser({ points: [{ x: 0, y: 0 }] });
        awareness.publishes = 0;

        writer.setLaser(null);

        expect(awareness.publishes).toBe(1);
        expect(readLocal(awareness)?.laser).toBeNull();
    });

    it('skips redundant trail writes', () => {
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'));
        writer.setLaser({ points: [{ x: 1, y: 1 }], alpha: 1 });
        awareness.publishes = 0;

        writer.setLaser({ points: [{ x: 1, y: 1 }] });
        writer.setLaser(null);
        writer.setLaser(null);

        expect(awareness.publishes).toBe(1);
    });

    it('publishes the fade of a resting trail through the throttle', () => {
        vi.useFakeTimers();
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            laserIntervalMs: 40,
        });
        writer.setLaser({ points: [{ x: 1, y: 1 }] });
        awareness.publishes = 0;

        writer.setLaser({ points: [{ x: 1, y: 1 }], alpha: 0.5 });
        vi.advanceTimersByTime(40);

        expect(awareness.publishes).toBe(1);
        expect(readLocal(awareness)?.laser?.alpha).toBe(0.5);
    });

    it('never shares the point array it was handed', () => {
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'));
        const points = [{ x: 1, y: 1 }];

        writer.setLaser({ points });
        points.push({ x: 2, y: 2 });

        expect(readLocal(awareness)?.laser?.points).toEqual([{ x: 1, y: 1 }]);
    });

    it('keeps only the newest points within the awareness budget', () => {
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'));

        writer.setLaser({
            points: Array.from({ length: 80 }, (_, index) => ({
                x: index,
                y: 0,
            })),
        });

        const trail = readLocal(awareness)?.laser;

        expect(trail?.points).toHaveLength(32);
        expect(trail?.points[0]).toEqual({ x: 48, y: 0 });
    });

    it('treats a spent trail as no trail at all', () => {
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'));
        awareness.publishes = 0;

        writer.setLaser({ points: [{ x: 1, y: 1 }], alpha: 0 });
        writer.setLaser({ points: [] });

        expect(awareness.publishes).toBe(0);
        expect(readLocal(awareness)?.laser).toBeNull();
    });

    it('never publishes a laser trail for a read-only viewer', () => {
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'), {
            readOnly: true,
        });
        awareness.publishes = 0;

        writer.setLaser({ points: [{ x: 1, y: 1 }] });

        expect(awareness.publishes).toBe(0);
        expect(writer.getState().laser).toBeNull();
    });

    it('drops a live trail when the viewer is locked', () => {
        const awareness = createFakeAwareness();
        const writer = createPresenceWriter(awareness, identityFor(1, 'Ada'));
        writer.setLaser({ points: [{ x: 1, y: 1 }] });
        awareness.publishes = 0;

        writer.setReadOnly(true);

        expect(awareness.publishes).toBe(1);
        expect(readLocal(awareness)?.laser).toBeNull();
    });

    it('round-trips a trail through a real y-protocols awareness', () => {
        const doc = new Y.Doc();
        const awareness = new Awareness(doc);
        const writer = createPresenceWriter(awareness, identityFor(3, 'Lin'));

        writer.setLaser({
            points: [
                { x: 1, y: 2 },
                { x: 3, y: 4 },
            ],
            alpha: 0.25,
        });

        expect(readPresenceParticipants(awareness)[0].laser).toEqual({
            points: [
                { x: 1, y: 2 },
                { x: 3, y: 4 },
            ],
            alpha: 0.25,
        });

        writer.destroy();
        awareness.destroy();
        doc.destroy();
    });
});

describe('normalizePresenceLaser', () => {
    it('rejects anything that is not a point list', () => {
        expect(normalizePresenceLaser(null)).toBeNull();
        expect(normalizePresenceLaser('nope')).toBeNull();
        expect(normalizePresenceLaser({})).toBeNull();
        expect(normalizePresenceLaser({ points: 'nope' })).toBeNull();
        expect(normalizePresenceLaser({ points: [] })).toBeNull();
    });

    it('drops points that are not finite', () => {
        const trail = normalizePresenceLaser({
            points: [
                { x: 1, y: 1 },
                { x: Number.NaN, y: 2 },
                'nope',
                { x: 3, y: 3 },
            ],
        });

        expect(trail?.points).toEqual([
            { x: 1, y: 1 },
            { x: 3, y: 3 },
        ]);
    });

    it('caps the point list at the awareness budget', () => {
        const trail = normalizePresenceLaser({
            points: Array.from({ length: 200 }, (_, index) => ({
                x: index,
                y: 0,
            })),
        });

        expect(trail?.points).toHaveLength(32);
    });

    it('leaves a trail without a fade at full strength', () => {
        expect(normalizePresenceLaser({ points: [{ x: 1, y: 1 }] })).toEqual({
            points: [{ x: 1, y: 1 }],
        });
        expect(
            normalizePresenceLaser({
                points: [{ x: 1, y: 1 }],
                alpha: 'nope',
            })?.alpha,
        ).toBeUndefined();
    });

    it('clamps a fade above one and discards a spent trail', () => {
        expect(
            normalizePresenceLaser({ points: [{ x: 1, y: 1 }], alpha: 4 })
                ?.alpha,
        ).toBe(1);
        expect(
            normalizePresenceLaser({ points: [{ x: 1, y: 1 }], alpha: 0 }),
        ).toBeNull();
        expect(
            normalizePresenceLaser({ points: [{ x: 1, y: 1 }], alpha: -1 }),
        ).toBeNull();
    });

    it('reads the trail off a full presence state', () => {
        const state = normalizePresenceState({
            user: { id: 'user:1' },
            laser: { points: [{ x: 2, y: 2 }], alpha: 0.5 },
        });

        expect(state?.laser).toEqual({ points: [{ x: 2, y: 2 }], alpha: 0.5 });
        expect(
            normalizePresenceState({ user: { id: 'user:1' } })?.laser,
        ).toBeNull();
    });
});
