import { describe, expect, it, vi } from 'vitest';
import type { PresenceOverlay } from '@freedraw/engine';
import type {
    PresenceDrag,
    PresenceFrame,
    PresenceParticipant,
} from './awareness';
import { PRESENCE_STALE_MS } from './awareness';
import { resolvePresenceIdentity } from './identity';
import type { PresenceFrameResolver, PresenceGhostResolver } from './overlay';
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

function ghostResolver(): PresenceGhostResolver {
    return vi.fn((ids: readonly string[], dx: number, dy: number) =>
        ids.map((_, index) => frameAt(index * 100 + dx, dy)),
    );
}

function dragOf(ids: string[], dx: number, dy: number): PresenceDrag {
    return { kind: 'move', frame: frameAt(dx, dy), ghost: { ids, dx, dy } };
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

    it('marks the halo of a peer drawing something that does not exist yet', () => {
        const mapper = createPresenceOverlayMapper();
        const peer = participant(2, {
            drag: { kind: 'create', frame: frameAt(5, 5), preview: true },
        });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(null),
            scene: {},
            now: NOW,
        });

        expect(overlay.halos).toEqual([
            {
                id: '2',
                frame: frameAt(5, 5),
                color: peer.user.color,
                preview: true,
            },
        ]);
    });

    it('never rebuilds a ghost from the ids of a preview drag', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveGhost = ghostResolver();
        const peer = participant(2, {
            drag: {
                ...dragOf(['a'], 40, 0),
                kind: 'draw',
                preview: true,
            },
        });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(null),
            resolveGhost,
            scene: {},
            now: NOW,
        });

        expect(overlay.ghosts).toEqual([]);
        expect(resolveGhost).not.toHaveBeenCalled();
        expect(overlay.halos[0].preview).toBe(true);
    });

    it('repaints when a drag turns from a preview into a committed move', () => {
        const mapper = createPresenceOverlayMapper();
        const scene = {};
        const preview = mapper.build(
            [
                participant(2, {
                    drag: {
                        kind: 'create',
                        frame: frameAt(5, 5),
                        preview: true,
                    },
                }),
            ],
            { resolveFrame: resolver(null), scene, now: NOW },
        );
        const committed = mapper.build(
            [
                participant(2, {
                    drag: { kind: 'move', frame: frameAt(5, 5) },
                }),
            ],
            { resolveFrame: resolver(null), scene, now: NOW },
        );

        expect(samePresenceOverlay(preview, committed)).toBe(false);
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

    it('rebuilds the peer ghost from the local elements and the peer delta', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveGhost = ghostResolver();
        const peer = participant(2, {
            selection: ['a', 'b'],
            drag: dragOf(['a', 'b'], 40, 5),
        });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(frameAt(0, 0)),
            resolveGhost,
            scene: {},
            now: NOW,
        });

        expect(resolveGhost).toHaveBeenCalledWith(['a', 'b'], 40, 5);
        expect(overlay.ghosts).toEqual([
            {
                id: '2',
                frames: [frameAt(40, 5), frameAt(140, 5)],
                color: peer.user.color,
            },
        ]);
    });

    it('paints the drag ghost alongside the live drag frame', () => {
        const mapper = createPresenceOverlayMapper();
        const peer = participant(2, { drag: dragOf(['a'], 40, 40) });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(null),
            resolveGhost: ghostResolver(),
            scene: {},
            now: NOW,
        });

        expect(overlay.halos).toHaveLength(1);
        expect(overlay.ghosts).toHaveLength(1);
    });

    it('skips the ghost when the dragged ids resolve to nothing locally', () => {
        const mapper = createPresenceOverlayMapper();
        const peer = participant(2, {
            drag: dragOf(['not-synced-yet'], 40, 0),
        });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(null),
            resolveGhost: vi.fn(() => null),
            scene: {},
            now: NOW,
        });

        expect(overlay.ghosts).toHaveLength(0);
        expect(overlay.halos).toHaveLength(1);
    });

    it('skips ghosts entirely when the caller resolves no elements', () => {
        const mapper = createPresenceOverlayMapper();
        const peer = participant(2, { drag: dragOf(['a'], 40, 0) });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(null),
            scene: {},
            now: NOW,
        });

        expect(overlay.ghosts).toHaveLength(0);
    });

    it('never paints a ghost for the local participant', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveGhost = ghostResolver();
        const local = participant(1, {
            isLocal: true,
            drag: dragOf(['a'], 40, 0),
        });

        const overlay = mapper.build([local], {
            resolveFrame: resolver(null),
            resolveGhost,
            scene: {},
            now: NOW,
        });

        expect(overlay).toBe(EMPTY_PRESENCE_OVERLAY);
        expect(resolveGhost).not.toHaveBeenCalled();
    });

    it('drops the drag ghost of a peer that has gone stale', () => {
        const mapper = createPresenceOverlayMapper();
        const peer = participant(2, {
            drag: dragOf(['a'], 40, 0),
            updatedAt: NOW - PRESENCE_STALE_MS - 1,
        });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(null),
            resolveGhost: ghostResolver(),
            scene: {},
            now: NOW,
        });

        expect(isEmptyPresenceOverlay(overlay)).toBe(true);
    });

    it('suspends drag ghosts while the caller previews another scene', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveGhost = ghostResolver();
        const peer = participant(2, {
            cursor: { x: 4, y: 6 },
            drag: dragOf(['a'], 40, 0),
        });

        const overlay = mapper.build([peer], {
            resolveFrame: resolver(null),
            resolveGhost,
            scene: {},
            now: NOW,
            halos: false,
        });

        expect(overlay.cursors).toHaveLength(1);
        expect(overlay.ghosts).toHaveLength(0);
        expect(resolveGhost).not.toHaveBeenCalled();
    });

    it('reuses the ghost while the scene and the delta hold still', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveGhost = ghostResolver();
        const scene = {};
        const build = (cursor: { x: number; y: number }): PresenceOverlay =>
            mapper.build(
                [participant(2, { cursor, drag: dragOf(['a'], 40, 0) })],
                { resolveFrame: resolver(null), resolveGhost, scene, now: NOW },
            );

        const first = build({ x: 1, y: 1 });
        const second = build({ x: 2, y: 2 });

        expect(resolveGhost).toHaveBeenCalledTimes(1);
        expect(second.ghosts[0]).toBe(first.ghosts[0]);
    });

    it('recomputes the ghost as the peer delta advances', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveGhost = ghostResolver();
        const scene = {};
        const build = (dx: number): PresenceOverlay =>
            mapper.build([participant(2, { drag: dragOf(['a'], dx, 0) })], {
                resolveFrame: resolver(null),
                resolveGhost,
                scene,
                now: NOW,
            });

        build(40);
        const second = build(60);

        expect(resolveGhost).toHaveBeenCalledTimes(2);
        expect(second.ghosts[0].frames).toEqual([frameAt(60, 0)]);
    });

    it('recomputes the ghost when the scene changes under a resting drag', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveGhost = ghostResolver();
        const peer = participant(2, { drag: dragOf(['a'], 40, 0) });

        mapper.build([peer], {
            resolveFrame: resolver(null),
            resolveGhost,
            scene: {},
            now: NOW,
        });
        mapper.build([peer], {
            resolveFrame: resolver(null),
            resolveGhost,
            scene: {},
            now: NOW,
        });

        expect(resolveGhost).toHaveBeenCalledTimes(2);
    });

    it('forgets ghosts of peers that left so the cache cannot grow forever', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveGhost = ghostResolver();
        const scene = {};
        const peer = participant(2, { drag: dragOf(['a'], 40, 0) });
        const other = participant(3, { drag: dragOf(['b'], 40, 0) });
        const build = (list: PresenceParticipant[]): void => {
            mapper.build(list, {
                resolveFrame: resolver(null),
                resolveGhost,
                scene,
                now: NOW,
            });
        };

        build([peer, other]);
        build([other]);
        build([peer, other]);

        expect(resolveGhost).toHaveBeenCalledTimes(3);
    });

    it('drops every cached ghost on reset', () => {
        const mapper = createPresenceOverlayMapper();
        const resolveGhost = ghostResolver();
        const scene = {};
        const peer = participant(2, { drag: dragOf(['a'], 40, 0) });

        mapper.build([peer], {
            resolveFrame: resolver(null),
            resolveGhost,
            scene,
            now: NOW,
        });
        mapper.reset();
        mapper.build([peer], {
            resolveFrame: resolver(null),
            resolveGhost,
            scene,
            now: NOW,
        });

        expect(resolveGhost).toHaveBeenCalledTimes(2);
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
        ghosts: [{ id: '2', frames: [frameAt(0, 0)], color: '#fff' }],
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
                ghosts: [{ id: '2', frames: [frameAt(0, 0)], color: '#fff' }],
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
                ghosts: base.ghosts,
            }),
        ).toBe(false);
    });

    it('detects a moved halo', () => {
        expect(
            samePresenceOverlay(base, {
                cursors: base.cursors,
                halos: [{ id: '2', frame: frameAt(5, 5), color: '#fff' }],
                ghosts: base.ghosts,
            }),
        ).toBe(false);
    });

    it('detects a ghost that advanced with the drag', () => {
        expect(
            samePresenceOverlay(base, {
                cursors: base.cursors,
                halos: base.halos,
                ghosts: [{ id: '2', frames: [frameAt(5, 5)], color: '#fff' }],
            }),
        ).toBe(false);
    });

    it('detects a ghost that gained or lost an element', () => {
        expect(
            samePresenceOverlay(base, {
                cursors: base.cursors,
                halos: base.halos,
                ghosts: [
                    {
                        id: '2',
                        frames: [frameAt(0, 0), frameAt(9, 9)],
                        color: '#fff',
                    },
                ],
            }),
        ).toBe(false);
    });

    it('detects a peer joining or leaving', () => {
        expect(
            samePresenceOverlay(base, {
                cursors: [],
                halos: base.halos,
                ghosts: base.ghosts,
            }),
        ).toBe(false);
        expect(
            samePresenceOverlay(base, {
                cursors: base.cursors,
                halos: [],
                ghosts: base.ghosts,
            }),
        ).toBe(false);
        expect(
            samePresenceOverlay(base, {
                cursors: base.cursors,
                halos: base.halos,
                ghosts: [],
            }),
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
                ghosts: [],
            }),
        ).toBe(false);
    });

    it('reports an overlay with only ghosts as painted', () => {
        expect(
            isEmptyPresenceOverlay({
                cursors: [],
                halos: [],
                ghosts: [{ id: '2', frames: [frameAt(0, 0)], color: '#fff' }],
            }),
        ).toBe(false);
    });
});
