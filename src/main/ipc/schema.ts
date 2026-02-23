import { ipcMain } from 'electron'
import { getPool } from '../db/client'
import { getSchemas, getTables, getColumns, getFunctions } from '../db/introspect'

export function registerSchemaHandlers(): void {
  ipcMain.handle('schema:getSchemas', async (_e, connectionId: string) => {
    const pool = getPool(connectionId)
    if (!pool) throw new Error('Not connected')
    return getSchemas(pool)
  })

  ipcMain.handle(
    'schema:getTables',
    async (_e, { connectionId, schema }: { connectionId: string; schema: string }) => {
      const pool = getPool(connectionId)
      if (!pool) throw new Error('Not connected')
      return getTables(pool, schema)
    }
  )

  ipcMain.handle(
    'schema:getColumns',
    async (_e, { connectionId, schema, table }: { connectionId: string; schema: string; table: string }) => {
      const pool = getPool(connectionId)
      if (!pool) throw new Error('Not connected')
      return getColumns(pool, schema, table)
    }
  )

  ipcMain.handle(
    'schema:getFunctions',
    async (_e, { connectionId, schema }: { connectionId: string; schema: string }) => {
      const pool = getPool(connectionId)
      if (!pool) throw new Error('Not connected')
      return getFunctions(pool, schema)
    }
  )
}
