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
