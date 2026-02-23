import { Pool, PoolConfig } from 'pg'
import { decryptPassword, SavedConnection } from '../store'

const pools = new Map<string, Pool>()

export function getPool(connectionId: string): Pool | undefined {
  return pools.get(connectionId)
}

export async function connect(connection: SavedConnection): Promise<void> {
  if (pools.has(connection.id)) {
    await pools.get(connection.id)!.end().catch(() => {})
    pools.delete(connection.id)
  }

  const password = decryptPassword(connection.encryptedPassword)

  const config: PoolConfig = {
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.username,
    password,
    ssl: connection.ssl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  }

  const pool = new Pool(config)
  const client = await pool.connect()
  client.release()
  pools.set(connection.id, pool)
}

export async function disconnect(connectionId: string): Promise<void> {
  const pool = pools.get(connectionId)
  if (pool) {
    await pool.end().catch(() => {})
    pools.delete(connectionId)
  }
}

export async function testConnection(config: {
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl: boolean
}): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now()
  let pool: Pool | null = null
  try {
    pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: 1,
      connectionTimeoutMillis: 8000
    })
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    return { success: true, latencyMs: Date.now() - start }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  } finally {
    if (pool) await pool.end().catch(() => {})
  }
}

export async function getLatency(connectionId: string): Promise<number | null> {
  const pool = pools.get(connectionId)
  if (!pool) return null
  try {
    const start = Date.now()
    await pool.query('SELECT 1')
    return Date.now() - start
  } catch {
    return null
  }
}

export function isConnected(connectionId: string): boolean {
  return pools.has(connectionId)
}

export async function disconnectAll(): Promise<void> {
  const promises = Array.from(pools.values()).map((p) => p.end().catch(() => {}))
  await Promise.all(promises)
  pools.clear()
}
