import { describe, expect, it, vi } from 'vitest';
import {
    createMemoryPresenceStorage,
    guestNameFor,
    guestPresenceId,
    hashPresenceKey,
    presenceAvatarUrl,
    presenceColorFor,
    presenceDisplayName,
    resolvePresenceIdentity,
    GUEST_ADJECTIVES,
    GUEST_ANIMALS,
    GUEST_ID_STORAGE_KEY,
    PRESENCE_COLORS,
} from './identity';

describe('hashPresenceKey', () => {
    it('is deterministic and unsigned', () => {
        expect(hashPresenceKey('user:1')).toBe(hashPresenceKey('user:1'));
        expect(hashPresenceKey('user:1')).toBeGreaterThanOrEqual(0);
        expect(hashPresenceKey('user:1')).not.toBe(hashPresenceKey('user:2'));
    });

    it('spreads keys across the palette', () => {
        const seen = new Set<string>();

        for (let index = 0; index < 200; index += 1) {
            seen.add(presenceColorFor(`user:${index}`));
        }

        expect(seen.size).toBe(PRESENCE_COLORS.length);
    });
});

describe('presenceColorFor', () => {
    it('always returns a palette color for the same key', () => {
        const color = presenceColorFor('user:42');

        expect(PRESENCE_COLORS).toContain(color);
        expect(presenceColorFor('user:42')).toBe(color);
    });
});

describe('guestNameFor', () => {
    it('builds a deterministic adjective and animal pair', () => {
        const name = guestNameFor('guest:abc');
        const [adjective, animal] = name.split(' ');

        expect(GUEST_ADJECTIVES).toContain(adjective);
        expect(GUEST_ANIMALS).toContain(animal);
        expect(guestNameFor('guest:abc')).toBe(name);
    });
});

describe('presenceDisplayName', () => {
    it('trims and caps the given name', () => {
        expect(presenceDisplayName('user:1', '  Saeed  ')).toBe('Saeed');
        expect(presenceDisplayName('user:1', 'a'.repeat(200))).toHaveLength(48);
    });

    it('falls back to a deterministic guest name when blank', () => {
        expect(presenceDisplayName('user:1', '   ')).toBe(
            guestNameFor('user:1'),
        );
        expect(presenceDisplayName('user:1', null)).toBe(
            guestNameFor('user:1'),
        );
    });
});

describe('presenceAvatarUrl', () => {
    it('keeps relative and http(s) urls', () => {
        expect(presenceAvatarUrl('/storage/a.png')).toBe('/storage/a.png');
        expect(presenceAvatarUrl('https://cdn.test/a.png')).toBe(
            'https://cdn.test/a.png',
        );
    });

    it('rejects anything else', () => {
        expect(presenceAvatarUrl('javascript:alert(1)')).toBeNull();
        expect(presenceAvatarUrl('data:image/png;base64,AA')).toBeNull();
        expect(presenceAvatarUrl('')).toBeNull();
        expect(presenceAvatarUrl(null)).toBeNull();
    });
});

describe('guestPresenceId', () => {
    it('mints a guest id once and reuses it from storage', () => {
        const storage = createMemoryPresenceStorage();
        const randomId = vi.fn(() => 'fixed-uuid');

        const first = guestPresenceId({ storage, randomId });
        const second = guestPresenceId({ storage, randomId });

        expect(first).toBe('guest:fixed-uuid');
        expect(second).toBe(first);
        expect(randomId).toHaveBeenCalledTimes(1);
        expect(storage.getItem(GUEST_ID_STORAGE_KEY)).toBe(first);
    });

    it('replaces a blank stored value', () => {
        const storage = createMemoryPresenceStorage();
        storage.setItem(GUEST_ID_STORAGE_KEY, '   ');

        expect(guestPresenceId({ storage, randomId: () => 'x' })).toBe(
            'guest:x',
        );
    });

    it('persists to sessionStorage when no storage is injected', () => {
        window.sessionStorage.removeItem(GUEST_ID_STORAGE_KEY);

        const id = guestPresenceId();

        expect(id.startsWith('guest:')).toBe(true);
        expect(window.sessionStorage.getItem(GUEST_ID_STORAGE_KEY)).toBe(id);
        expect(guestPresenceId()).toBe(id);
    });
});

describe('resolvePresenceIdentity', () => {
    it('derives a stable identity for an authenticated user', () => {
        const identity = resolvePresenceIdentity({
            user: { id: 7, name: 'Saeed', avatar: '/storage/me.png' },
        });

        expect(identity).toEqual({
            id: 'user:7',
            kind: 'user',
            name: 'Saeed',
            color: presenceColorFor('user:7'),
            avatar: '/storage/me.png',
        });
    });

    it('gives every viewer of the same user the same color', () => {
        const a = resolvePresenceIdentity({ user: { id: 7, name: 'A' } });
        const b = resolvePresenceIdentity({ user: { id: '7', name: 'B' } });

        expect(a.color).toBe(b.color);
        expect(a.id).toBe(b.id);
    });

    it('drops an unsafe avatar', () => {
        const identity = resolvePresenceIdentity({
            user: { id: 7, name: 'Saeed', avatar: 'javascript:alert(1)' },
        });

        expect(identity.avatar).toBeNull();
    });

    it('mints a guest identity when there is no user', () => {
        const storage = createMemoryPresenceStorage();
        const identity = resolvePresenceIdentity({
            storage,
            randomId: () => 'abc',
        });

        expect(identity.id).toBe('guest:abc');
        expect(identity.kind).toBe('guest');
        expect(identity.name).toBe(guestNameFor('guest:abc'));
        expect(identity.color).toBe(presenceColorFor('guest:abc'));
        expect(identity.avatar).toBeNull();
    });

    it('keeps the guest identity stable across calls in a session', () => {
        const storage = createMemoryPresenceStorage();
        const first = resolvePresenceIdentity({ storage });
        const second = resolvePresenceIdentity({ storage, user: null });

        expect(second).toEqual(first);
    });
});
