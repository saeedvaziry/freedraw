export interface DbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  socketPath?: string
  charset: string
  connectionLimit: number
}

export interface AppConfig {
  name: string
  port: number
  address: string
  timeout: number
  debounce: number
  maxDebounce: number
  quiet: boolean
  seqMaxRetries: number
  stampAssetReferences: boolean
  pruneSupersededSnapshots: boolean
  collabSecret: string
  requireCollabAuth: boolean
  internalSecret: string
  db: DbConfig
}

type Env = Record<string, string | undefined>

function readString(env: Env, key: string, fallback: string): string {
  const value = env[key]
  return value === undefined || value === '' ? fallback : value
}

function readOptionalString(env: Env, key: string): string | undefined {
  const value = env[key]
  return value === undefined || value === '' ? undefined : value
}

function readNumber(env: Env, key: string, fallback: number): number {
  const value = env[key]
  if (value === undefined || value === '') {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readBoolean(env: Env, key: string, fallback: boolean): boolean {
  const value = env[key]
  if (value === undefined || value === '') {
    return fallback
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export function loadConfig(env: Env = process.env): AppConfig {
  return {
    name: readString(env, 'HOCUSPOCUS_NAME', 'freedraw-hocuspocus'),
    port: readNumber(env, 'HOCUSPOCUS_PORT', readNumber(env, 'PORT', 1234)),
    address: readString(env, 'HOCUSPOCUS_ADDRESS', '0.0.0.0'),
    timeout: readNumber(env, 'HOCUSPOCUS_TIMEOUT', 30000),
    debounce: readNumber(env, 'HOCUSPOCUS_DEBOUNCE', 2000),
    maxDebounce: readNumber(env, 'HOCUSPOCUS_MAX_DEBOUNCE', 10000),
    quiet: readBoolean(env, 'HOCUSPOCUS_QUIET', false),
    seqMaxRetries: readNumber(env, 'HOCUSPOCUS_SEQ_MAX_RETRIES', 5),
    stampAssetReferences: readBoolean(env, 'HOCUSPOCUS_STAMP_ASSETS', true),
    pruneSupersededSnapshots: readBoolean(env, 'HOCUSPOCUS_PRUNE_SNAPSHOTS', true),
    collabSecret: readString(env, 'COLLAB_SECRET', ''),
    requireCollabAuth: readBoolean(env, 'REQUIRE_COLLAB_AUTH', false),
    internalSecret: readString(env, 'COLLAB_INTERNAL_SECRET', ''),
    db: {
      host: readString(env, 'DB_HOST', '127.0.0.1'),
      port: readNumber(env, 'DB_PORT', 3306),
      user: readString(env, 'DB_USERNAME', 'root'),
      password: readString(env, 'DB_PASSWORD', ''),
      database: readString(env, 'DB_DATABASE', 'freedraw'),
      socketPath: readOptionalString(env, 'DB_SOCKET'),
      charset: readString(env, 'DB_CHARSET', 'utf8mb4'),
      connectionLimit: readNumber(env, 'DB_POOL_SIZE', 10),
    },
  }
}

export function assertAuthConfig(config: AppConfig): void {
  if (config.requireCollabAuth && config.collabSecret.length === 0) {
    throw new Error(
      'REQUIRE_COLLAB_AUTH is set but COLLAB_SECRET is missing — refusing to start with authentication disabled',
    )
  }
}
