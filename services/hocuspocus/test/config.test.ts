import { describe, expect, it } from 'vitest'
import { assertAuthConfig, loadConfig } from '../src/config.js'

describe('loadConfig REQUIRE_COLLAB_AUTH', () => {
  it('defaults requireCollabAuth to false when unset', () => {
    expect(loadConfig({}).requireCollabAuth).toBe(false)
  })

  it('reads a truthy REQUIRE_COLLAB_AUTH as true', () => {
    expect(loadConfig({ REQUIRE_COLLAB_AUTH: 'true' }).requireCollabAuth).toBe(true)
    expect(loadConfig({ REQUIRE_COLLAB_AUTH: '1' }).requireCollabAuth).toBe(true)
  })

  it('reads a falsy REQUIRE_COLLAB_AUTH as false', () => {
    expect(loadConfig({ REQUIRE_COLLAB_AUTH: 'false' }).requireCollabAuth).toBe(false)
    expect(loadConfig({ REQUIRE_COLLAB_AUTH: '0' }).requireCollabAuth).toBe(false)
  })
})

describe('loadConfig COLLAB_INTERNAL_SECRET', () => {
  it('defaults the internal secret to an empty string', () => {
    expect(loadConfig({}).internalSecret).toBe('')
  })

  it('reads COLLAB_INTERNAL_SECRET', () => {
    expect(loadConfig({ COLLAB_INTERNAL_SECRET: 'shared' }).internalSecret).toBe('shared')
  })
})

describe('assertAuthConfig', () => {
  it('throws when auth is required but no secret is configured', () => {
    const config = loadConfig({ REQUIRE_COLLAB_AUTH: 'true' })

    expect(() => assertAuthConfig(config)).toThrow(/REQUIRE_COLLAB_AUTH is set but COLLAB_SECRET is missing/)
  })

  it('does not throw when auth is required and a secret is present', () => {
    const config = loadConfig({ REQUIRE_COLLAB_AUTH: 'true', COLLAB_SECRET: 'top-secret' })

    expect(() => assertAuthConfig(config)).not.toThrow()
  })

  it('does not throw when auth is not required even without a secret', () => {
    const config = loadConfig({})

    expect(() => assertAuthConfig(config)).not.toThrow()
  })
})
