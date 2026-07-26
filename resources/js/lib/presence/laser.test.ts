import { describe, expect, it, vi } from 'vitest';
import { PRESENCE_MAX_LASER_POINTS } from './awareness';
import { createLaserStore, LASER_TRAIL_MS } from './laser';

const NOW = 1_000_000;

function clockedStore(start = NOW) {
    let at = start;

    const store = createLaserStore({ now: () => at });

    return {
        store,
        advance(ms: number) {
            at += ms;

            return at;
        },
        get at() {
            return at;
        },
    };
}

describe('createLaserStore', () => {
    it('keeps the trail in pointer order at full strength while it moves', () => {
        const { store, advance } = clockedStore();

        store.push({ x: 0, y: 0 });
        advance(16);
        store.push({ x: 10, y: 0 });
        advance(16);
        store.push({ x: 20, y: 0 });

        expect(store.read(NOW + 32)).toEqual({
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 20, y: 0 },
            ],
            alpha: 1,
        });
    });

    it('reads nothing from an untouched trail', () => {
        const { store } = clockedStore();

        expect(store.read(NOW)).toBeNull();
        expect(store.toTrail(NOW)).toBeNull();
        expect(store.isEmpty()).toBe(true);
    });

    it('ignores points that are not finite', () => {
        const { store } = clockedStore();

        store.push({ x: Number.NaN, y: 0 });
        store.push({ x: 0, y: Number.POSITIVE_INFINITY });

        expect(store.isEmpty()).toBe(true);
    });

    it('refreshes the head instead of appending when the pointer barely moves', () => {
        const { store, advance } = clockedStore();

        store.push({ x: 0, y: 0 });
        advance(20);
        store.push({ x: 0.1, y: 0 });

        const frame = store.read(NOW + 20);

        expect(frame?.points).toEqual([{ x: 0, y: 0 }]);
        expect(frame?.alpha).toBe(1);
    });

    it('fades the trail as the newest sample ages', () => {
        const { store } = clockedStore();

        store.push({ x: 0, y: 0 });

        expect(store.read(NOW + LASER_TRAIL_MS / 2)?.alpha).toBeCloseTo(0.5);
        expect(store.read(NOW + LASER_TRAIL_MS)).toBeNull();
    });

    it('drops samples that outlive the trail window', () => {
        const { store, advance } = clockedStore();

        store.push({ x: 0, y: 0 });
        advance(LASER_TRAIL_MS - 100);
        store.push({ x: 50, y: 0 });
        const at = advance(200);

        expect(store.read(at)?.points).toEqual([{ x: 50, y: 0 }]);
    });

    it('prunes spent samples out of the buffer', () => {
        const { store, advance } = clockedStore();

        store.push({ x: 0, y: 0 });
        advance(LASER_TRAIL_MS + 1);
        store.prune();

        expect(store.isEmpty()).toBe(true);
    });

    it('caps the buffer at the awareness point budget', () => {
        const { store, advance } = clockedStore();

        for (
            let index = 0;
            index < PRESENCE_MAX_LASER_POINTS + 12;
            index += 1
        ) {
            store.push({ x: index * 5, y: 0 });
            advance(1);
        }

        const frame = store.read(NOW + PRESENCE_MAX_LASER_POINTS + 11);

        expect(frame?.points).toHaveLength(PRESENCE_MAX_LASER_POINTS);
        expect(frame?.points.at(-1)).toEqual({
            x: (PRESENCE_MAX_LASER_POINTS + 11) * 5,
            y: 0,
        });
    });

    it('publishes a wire trail that carries the current fade', () => {
        const { store } = clockedStore();

        store.push({ x: 4, y: 6 });

        expect(store.toTrail(NOW)).toEqual({
            points: [{ x: 4, y: 6 }],
            alpha: 1,
        });
        expect(store.toTrail(NOW + LASER_TRAIL_MS / 2)?.alpha).toBeCloseTo(0.5);
        expect(store.toTrail(NOW + LASER_TRAIL_MS)).toBeNull();
    });

    it('notifies subscribers when the trail grows, shrinks or is dropped', () => {
        const { store, advance } = clockedStore();
        const listener = vi.fn();
        const detach = store.subscribe(listener);

        store.push({ x: 0, y: 0 });

        expect(listener).toHaveBeenCalledTimes(1);

        store.prune();

        expect(listener).toHaveBeenCalledTimes(1);

        advance(LASER_TRAIL_MS + 1);
        store.prune();

        expect(listener).toHaveBeenCalledTimes(2);

        store.clear();

        expect(listener).toHaveBeenCalledTimes(2);

        store.push({ x: 1, y: 1 });
        store.clear();

        expect(listener).toHaveBeenCalledTimes(4);

        detach();
        store.push({ x: 2, y: 2 });

        expect(listener).toHaveBeenCalledTimes(4);
    });

    it('honours a custom trail window and point budget', () => {
        const short = createLaserStore({
            trailMs: 100,
            maxPoints: 3,
            now: () => NOW,
        });

        expect(short.trailMs).toBe(100);

        short.push({ x: 0, y: 0 });
        short.push({ x: 10, y: 0 });
        short.push({ x: 20, y: 0 });
        short.push({ x: 30, y: 0 });

        expect(short.read(NOW)?.points).toEqual([
            { x: 10, y: 0 },
            { x: 20, y: 0 },
            { x: 30, y: 0 },
        ]);

        expect(short.read(NOW + 100)).toBeNull();
    });
});
