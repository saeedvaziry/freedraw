import { Server, type Extension } from '@hocuspocus/server'
import { loadConfig } from './config.js'
import { asQueryable, createPool } from './db.js'
import { MysqlPageStore } from './page-store.js'
import { RealtimeAuth } from './realtime-auth.js'
import { UpdateLogDatabase, type Logger } from './update-log-database.js'

const logger: Logger = {
  info: (message, meta) => console.info(message, meta ?? ''),
  warn: (message, meta) => console.warn(message, meta ?? ''),
  error: (message, meta) => console.error(message, meta ?? ''),
}

async function main(): Promise<void> {
  const config = loadConfig(process.env)
  const pool = createPool(config.db)
  const store = new MysqlPageStore(asQueryable(pool), { seqMaxRetries: config.seqMaxRetries })

  const extension = new UpdateLogDatabase({
    store,
    logger,
    stampAssetReferences: config.stampAssetReferences,
    pruneSupersededSnapshots: config.pruneSupersededSnapshots,
  })

  const extensions: Extension[] = [extension]

  if (config.collabSecret.length > 0) {
    extensions.push(new RealtimeAuth(config.collabSecret))
  } else {
    logger.warn('COLLAB_SECRET is not set; realtime authentication is disabled')
  }

  const server = new Server({
    name: config.name,
    port: config.port,
    address: config.address,
    timeout: config.timeout,
    debounce: config.debounce,
    maxDebounce: config.maxDebounce,
    quiet: config.quiet,
    extensions,
  })

  let shuttingDown = false
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return
    }

    shuttingDown = true
    logger.info(`UpdateLogDatabase: received ${signal}, shutting down`)

    try {
      await server.destroy()
    } finally {
      await pool.end()
      process.exit(0)
    }
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  await server.listen()
  logger.info(`Hocuspocus listening on ${config.address}:${config.port}`)
}

main().catch((error) => {
  console.error('Failed to start Hocuspocus server', error)
  process.exit(1)
})
