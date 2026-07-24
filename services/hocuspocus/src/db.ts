import mysql from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'
import type { DbConfig } from './config.js'

export interface Queryable {
  query(sql: string, params?: ReadonlyArray<unknown>): Promise<[unknown, unknown]>
}

export function createPool(config: DbConfig): Pool {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    socketPath: config.socketPath,
    charset: config.charset,
    waitForConnections: true,
    connectionLimit: config.connectionLimit,
    maxIdle: config.connectionLimit,
    enableKeepAlive: true,
  })
}

export function asQueryable(pool: Pool): Queryable {
  return {
    query: (sql, params) => pool.query(sql, params as unknown[]) as Promise<[unknown, unknown]>,
  }
}
