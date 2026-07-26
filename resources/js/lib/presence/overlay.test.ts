import { describe, expect, it, vi } from 'vitest';
import type { PresenceOverlay } from '@freedraw/engine';
import type { PresenceFrame, PresenceParticipant } from './awareness';
import { PRESENCE_STALE_MS } from './awareness';
import { resolvePresenceIdentity } from './identity';
import type { PresenceFrameResolver } from './overlay';
import {
    createPresenceOverlayMapper,
    isEmptyPresenceOverlay,
    samePresenceOverlay,
    EMPTY_PRESENCE_OVERLAY,
} from './overlay';

const NOW = 1_000_000;

function participant(
    clientId: number,
    overrides: Partial<PresenceParticipant> = {},
): PresenceParticipant {
    return {
        clientId,
        isLocal: false,
        user: resolvePresenceIdentity({
            user: { id: clientId, name: `Peer ${clientId}` },
        }),
        cursor: null,
        selection: [],
        tool: null,
        viewport: null,
        drag: null,
        updatedAt: NOW,
        ...overrides,
    };
}

function frameAt(x: number, y: number): PresenceFrame {
    return {
        bounds: { x, y, width: 10, height: 10 },
        center: { x: x + 5, y: y + 5 },
        rotation: 0,
    };
}

function resolver(frame: PresenceFrame | null): PresenceFrameResolver {
    return vi.fn(() => frame);
}

describe('createPresenceOverlayMapper', () => {
    it('paints a cursor and a halo for a remote peer', () => {
        const mapper = createPresenceOverlayMapper();
        const peer = participant(2, {
            cursor: { x: 4, y: 6 },
            selection: ['a'],
        });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(frameAt(0, 0)),
            scene: {},
            now: NOW,
        });

        expect(overlay.cursors).toEqual([
            {
                id: '2',
                point: { x: 4, y: 6 },
                color: peer.user.color,
                label: peer.user.name,
            },
        ]);
        expect(overlay.halos).toEqual([
            { id: '2', frame: frameAt(0, 0), color: peer.user.color },
        ]);
    });

    it('never paints the local participant', () => {
        const mapper = createPresenceOverlayMapper();
        const local = participant(1, {
            isLocal: true,
            cursor: { x: 1, y: 1 },
            selection: ['a'],
        });
        const resolveFrame = resolver(frameAt(0, 0));

        const overlay = mapper.build([local], {
            resolveFrame,
            scene: {},
            now: NOW,
        });

        expect(overlay).toBe(EMPTY_PRESENCE_OVERLAY);
        expect(resolveFrame).not.toHaveBeenCalled();
    });

    it('drops peers whose state has gone stale', () => {
        const mapper = createPresenceOverlayMapper();
        const peer = participant(2, {
            cursor: { x: 1, y: 1 },
            selection: ['a'],
            updatedAt: NOW - PRESENCE_STALE_MS - 1,
        });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(frameAt(0, 0)),
            scene: {},
            now: NOW,
        });

        expect(isEmptyPresenceOverlay(overlay)).toBe(true);
    });

    it('honours a custom staleness window', () => {
        const mapper = createPresenceOverlayMapper();
        const peer = participant(2, {
            cursor: { x: 1, y: 1 },
            updatedAt: NOW - 500,
        });

        const fresh = mapper.build([peer], {
            resolveFrame: resolver(null),
            now: NOW,
            ttlMs: 1_000,
        });
        const expired = mapper.build([peer], {
            resolveFrame: resolver(null),
            now: NOW,
            ttlMs: 100,
        });

        expect(fresh.cursors).toHaveLength(1);
        expect(expired.cursors).toHaveLength(0);
    });

    it('omits the cursor for a peer that has left the canvas', () => {
        const mapper = createPresenceOverlayMapper();
        const peer = participant(2, { cursor: null, selection: ['a'] });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(frameAt(0, 0)),
            scene: {},
            now: NOW,
        });

        expect(overlay.cursors).toHaveLength(0);
        expect(overlay.halos).toHaveLength(1);
    });

    it('skips the halo when the selection resolves to nothing locally', () => {
        const mapper = createPresenceOverlayMapper();
        const peer = participant(2, {
            cursor: { x: 1, y: 1 },
            selection: ['not-synced-yet'],
        });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(null),
            scene: {},
            now: NOW,
        });

        expect(overlay.cursors).toHaveLength(1);
        expect(overlay.halos).toHaveLength(0);
    });

    it('never asks for a frame when the peer has no selection', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveFrame = resolver(frameAt(0, 0));

        mapper.build([participant(2, { cursor: { x: 1, y: 1 } })], {
            resolveFrame,
            scene: {},
            now: NOW,
        });

        expect(resolveFrame).not.toHaveBeenCalled();
    });

    it('reuses the halo while the scene and the selection hold still', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveFrame = resolver(frameAt(0, 0));
        const scene = {};
        const build = (cursor: { x: number; y: number }): PresenceOverlay =>
            mapper.build([participant(2, { cursor, selection: ['a'] })], {
                resolveFrame,
                scene,
                now: NOW,
            });

        const first = build({ x: 1, y: 1 });
        const second = build({ x: 2, y: 2 });

        expect(resolveFrame).toHaveBeenCalledTimes(1);
        expect(second.halos[0]).toBe(first.halos[0]);
    });

    it('recomputes the halo when the scene changes', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveFrame = resolver(frameAt(0, 0));
        const peer = participant(2, { selection: ['a'] });

        mapper.build([peer], { resolveFrame, scene: {}, now: NOW });
        mapper.build([peer], { resolveFrame, scene: {}, now: NOW });

        expect(resolveFrame).toHaveBeenCalledTimes(2);
    });

    it('recomputes the halo when the selection changes', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveFrame = resolver(frameAt(0, 0));
        const scene = {};

        mapper.build([participant(2, { selection: ['a'] })], {
            resolveFrame,
            scene,
            now: NOW,
        });
        mapper.build([participant(2, { selection: ['a', 'b'] })], {
            resolveFrame,
            scene,
            now: NOW,
        });

        expect(resolveFrame).toHaveBeenCalledTimes(2);
    });

    it('forgets peers that left so the cache cannot grow forever', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveFrame = resolver(frameAt(0, 0));
        const scene = {};
        const peer = participant(2, { selection: ['a'] });
        const other = participant(3, { selection: ['b'] });

        mapper.build([peer, other], { resolveFrame, scene, now: NOW });
        mapper.build([other], { resolveFrame, scene, now: NOW });
        mapper.build([peer, other], { resolveFrame, scene, now: NOW });

        expect(resolveFrame).toHaveBeenCalledTimes(3);
    });

    it('drops every cached halo on reset', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveFrame = resolver(frameAt(0, 0));
        const scene = {};
        const peer = participant(2, { selection: ['a'] });

        mapper.build([peer], { resolveFrame, scene, now: NOW });
        mapper.reset();
        mapper.build([peer], { resolveFrame, scene, now: NOW });

        expect(resolveFrame).toHaveBeenCalledTimes(2);
    });

    it('paints the live drag frame instead of the committed selection halo', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveFrame = resolver(frameAt(0, 0));
        const peer = participant(2, {
            selection: ['a'],
            drag: { kind: 'move', frame: frameAt(40, 40) },
        });

        const overlay = mapper.build([peer], {
            resolveFrame,
            scene: {},
            now: NOW,
        });

        expect(overlay.halos).toEqual([
            { id: '2', frame: frameAt(40, 40), color: peer.user.color },
        ]);
        expect(resolveFrame).not.toHaveBeenCalled();
    });

    it('paints a drag frame for a peer that has nothing selected', () => {
        const mapper = createPresenceOverlayMapper();
        const peer = participant(2, {
            drag: { kind: 'create', frame: frameAt(5, 5) },
        });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(null),
            scene: {},
            now: NOW,
        });

        expect(overlay.halos).toEqual([
            { id: '2', frame: frameAt(5, 5), color: peer.user.color },
        ]);
    });

    it('falls back to the committed halo once the drag ends', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveFrame = resolver(frameAt(0, 0));
        const scene = {};
        const peer = participant(2, { selection: ['a'] });

        mapper.build(
            [{ ...peer, drag: { kind: 'move', frame: frameAt(40, 40) } }],
            { resolveFrame, scene, now: NOW },
        );
        const overlay = mapper.build([peer], {
            resolveFrame,
            scene,
            now: NOW,
        });

        expect(overlay.halos).toEqual([
            { id: '2', frame: frameAt(0, 0), color: peer.user.color },
        ]);
        expect(resolveFrame).toHaveBeenCalledTimes(1);
    });

    it('ignores a drag that carries no frame yet', () => {
        const mapper = createPresenceOverlayMapper();
        const peer = participant(2, {
            selection: ['a'],
            drag: { kind: 'move', frame: null },
        });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(frameAt(0, 0)),
            scene: {},
            now: NOW,
        });

        expect(overlay.halos).toEqual([
            { id: '2', frame: frameAt(0, 0), color: peer.user.color },
        ]);
    });

    it('drops the drag frame of a peer that has gone stale', () => {
        const mapper = createPresenceOverlayMapper();
        const peer = participant(2, {
            drag: { kind: 'move', frame: frameAt(40, 40) },
            updatedAt: NOW - PRESENCE_STALE_MS - 1,
        });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(null),
            scene: {},
            now: NOW,
        });

        expect(isEmptyPresenceOverlay(overlay)).toBe(true);
    });

    it('suspends the drag frame while the caller previews another scene', () => {
        const mapper = createPresenceOverlayMapper();
        const peer = participant(2, {
            cursor: { x: 4, y: 6 },
            drag: { kind: 'move', frame: frameAt(40, 40) },
        });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(null),
            scene: {},
            now: NOW,
            halos: false,
        });

        expect(overlay.cursors).toHaveLength(1);
        expect(overlay.halos).toHaveLength(0);
    });

    it('suspends halos while the caller previews another scene', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveFrame = resolver(frameAt(0, 0));
        const peer = participant(2, {
            cursor: { x: 4, y: 6 },
            selection: ['a'],
        });

        const overlay = mapper.build([peer], {
            resolveFrame,
            scene: {},
            now: NOW,
            halos: false,
        });

        expect(overlay.cursors).toHaveLength(1);
        expect(overlay.halos).toHaveLength(0);
        expect(resolveFrame).not.toHaveBeenCalled();
    });

    it('returns the shared empty overlay when only halos are suspended', () => {
        const mapper = createPresenceOverlayMapper();

        const overlay = mapper.build([participant(2, { selection: ['a'] })], {
            resolveFrame: resolver(frameAt(0, 0)),
            scene: {},
            now: NOW,
            halos: false,
        });

        expect(overlay).toBe(EMPTY_PRESENCE_OVERLAY);
    });

    it('drops cached halos when halos are suspended so no scene is held', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveFrame = resolver(frameAt(0, 0));
        const scene = {};
        const peer = participant(2, { selection: ['a'] });

        mapper.build([peer], { resolveFrame, scene, now: NOW });
        mapper.build([peer], { resolveFrame, scene, now: NOW, halos: false });
        mapper.build([peer], { resolveFrame, scene, now: NOW });

        expect(resolveFrame).toHaveBeenCalledTimes(2);
    });

    it('returns the shared empty overlay when nobody is present', () => {
        const mapper = createPresenceOverlayMapper();

        const overlay = mapper.build([], {
            resolveFrame: resolver(null),
            now: NOW,
        });

        expect(overlay).toBe(EMPTY_PRESENCE_OVERLAY);
    });
});

describe('samePresenceOverlay', () => {
    const base: PresenceOverlay = {
        cursors: [
            { id: '2', point: { x: 1, y: 2 }, color: '#fff', label: 'A' },
        ],
        halos: [{ id: '2', frame: frameAt(0, 0), color: '#fff' }],
    };

    it('treats structurally identical overlays as equal', () => {
        expect(
            samePresenceOverlay(base, {
                cursors: [
                    {
                        id: '2',
                        point: { x: 1, y: 2 },
                        color: '#fff',
                        label: 'A',
                    },
                ],
                halos: [{ id: '2', frame: frameAt(0, 0), color: '#fff' }],
            }),
        ).toBe(true);
    });

    it('detects a moved cursor', () => {
        expect(
            samePresenceOverlay(base, {
                cursors: [
                    {
                        id: '2',
                        point: { x: 9, y: 2 },
                        color: '#fff',
                        label: 'A',
                    },
                ],
                halos: base.halos,
            }),
        ).toBe(false);
    });

    it('detects a moved halo', () => {
        expect(
            samePresenceOverlay(base, {
                cursors: base.cursors,
                halos: [{ id: '2', frame: frameAt(5, 5), color: '#fff' }],
            }),
        ).toBe(false);
    });

    it('detects a peer joining or leaving', () => {
        expect(
            samePresenceOverlay(base, { cursors: [], halos: base.halos }),
        ).toBe(false);
        expect(
            samePresenceOverlay(base, { cursors: base.cursors, halos: [] }),
        ).toBe(false);
    });
});

describe('isEmptyPresenceOverlay', () => {
    it('reports the shared empty overlay as empty', () => {
        expect(isEmptyPresenceOverlay(EMPTY_PRESENCE_OVERLAY)).toBe(true);
    });

    it('reports an overlay with only halos as painted', () => {
        expect(
            isEmptyPresenceOverlay({
                cursors: [],
                halos: [{ id: '2', frame: frameAt(0, 0), color: '#fff' }],
            }),
        ).toBe(false);
    });
});
