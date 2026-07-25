export type PresenceKind = 'user' | 'guest';

export interface PresenceIdentity {
    id: string;
    kind: PresenceKind;
    name: string;
    color: string;
    avatar: string | null;
}

export interface PresenceUserInput {
    id: number | string;
    name?: string | null;
    avatar?: string | null;
}

export type PresenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface ResolvePresenceIdentityOptions {
    user?: PresenceUserInput | null;
    storage?: PresenceStorage | null;
    randomId?: () => string;
}

export const PRESENCE_COLORS = [
    '#e5484d',
    '#e93d82',
    '#d6409f',
    '#8e4ec6',
    '#5b5bd6',
    '#0090ff',
    '#00a2c7',
    '#12a594',
    '#30a46c',
    '#46a758',
    '#f76b15',
    '#ad7f58',
] as const;

export const GUEST_ADJECTIVES = [
    'Amber',
    'Brave',
    'Calm',
    'Clever',
    'Cosmic',
    'Eager',
    'Gentle',
    'Jolly',
    'Lucky',
    'Merry',
    'Swift',
    'Wandering',
] as const;

export const GUEST_ANIMALS = [
    'Otter',
    'Falcon',
    'Panda',
    'Heron',
    'Lynx',
    'Marmot',
    'Puffin',
    'Badger',
    'Dolphin',
    'Ibex',
    'Koala',
    'Raven',
] as const;

export const GUEST_ID_STORAGE_KEY = 'freedraw:presence:guest-id';

const STORAGE_PROBE_KEY = 'freedraw:presence:probe';
const MAX_NAME_LENGTH = 48;

export function createMemoryPresenceStorage(): PresenceStorage {
    const values = new Map<string, string>();

    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
            values.set(key, value);
        },
    };
}

const memoryStorage = createMemoryPresenceStorage();

export function hashPresenceKey(key: string): number {
    let hash = 0x811c9dc5;

    for (let index = 0; index < key.length; index += 1) {
        hash ^= key.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }

    return hash >>> 0;
}

function pick<T>(items: readonly T[], key: string): T {
    return items[hashPresenceKey(key) % items.length];
}

export function presenceColorFor(key: string): string {
    return pick(PRESENCE_COLORS, key);
}

export function guestNameFor(key: string): string {
    const adjective = pick(GUEST_ADJECTIVES, `${key}#adjective`);
    const animal = pick(GUEST_ANIMALS, `${key}#animal`);

    return `${adjective} ${animal}`;
}

export function randomPresenceToken(): string {
    const source: Crypto | undefined = globalThis.crypto;

    if (typeof source?.randomUUID === 'function') {
        return source.randomUUID();
    }

    if (typeof source?.getRandomValues === 'function') {
        const bytes = source.getRandomValues(new Uint8Array(16));

        return Array.from(bytes, (byte) =>
            byte.toString(16).padStart(2, '0'),
        ).join('');
    }

    const random = Math.random().toString(16).slice(2, 12);

    return `${Date.now().toString(16)}${random}`;
}

function resolveStorage(explicit?: PresenceStorage | null): PresenceStorage {
    if (explicit) {
        return explicit;
    }

    if (typeof window === 'undefined') {
        return memoryStorage;
    }

    try {
        const storage = window.sessionStorage;
        storage.setItem(STORAGE_PROBE_KEY, '1');
        storage.removeItem(STORAGE_PROBE_KEY);

        return storage;
    } catch {
        return memoryStorage;
    }
}

export function guestPresenceId(
    options: ResolvePresenceIdentityOptions = {},
): string {
    const storage = resolveStorage(options.storage);
    const existing = storage.getItem(GUEST_ID_STORAGE_KEY);

    if (typeof existing === 'string' && existing.trim() !== '') {
        return existing.trim();
    }

    const mint = options.randomId ?? randomPresenceToken;
    const minted = `guest:${mint()}`;
    storage.setItem(GUEST_ID_STORAGE_KEY, minted);

    return minted;
}

export function presenceDisplayName(id: string, name?: string | null): string {
    const trimmed = typeof name === 'string' ? name.trim() : '';

    if (trimmed === '') {
        return guestNameFor(id);
    }

    return trimmed.slice(0, MAX_NAME_LENGTH);
}

export function presenceAvatarUrl(avatar?: string | null): string | null {
    const trimmed = typeof avatar === 'string' ? avatar.trim() : '';

    if (trimmed === '') {
        return null;
    }

    const allowed =
        trimmed.startsWith('/') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('http://');

    return allowed ? trimmed : null;
}

export function resolvePresenceIdentity(
    options: ResolvePresenceIdentityOptions = {},
): PresenceIdentity {
    const user = options.user ?? null;
    const rawId = user === null ? '' : String(user.id ?? '').trim();

    if (rawId !== '') {
        const id = `user:${rawId}`;

        return {
            id,
            kind: 'user',
            name: presenceDisplayName(id, user?.name),
            color: presenceColorFor(id),
            avatar: presenceAvatarUrl(user?.avatar),
        };
    }

    const id = guestPresenceId(options);

    return {
        id,
        kind: 'guest',
        name: guestNameFor(id),
        color: presenceColorFor(id),
        avatar: null,
    };
}
