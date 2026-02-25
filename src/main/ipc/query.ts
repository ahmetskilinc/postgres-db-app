import { ipcMain } from 'electron'
import { getPool } from '../db/client'
import { getPrimaryKeys } from '../db/introspect'

export function registerQueryHandlers(): void {
  ipcMain.handle(
    'query:insertRow',
    async (
      _e,
      {
        connectionId,
        schema,
        table,
        values
      }: { connectionId: string; schema: string; table: string; values: Record<string, unknown> }
    ) => {
      const pool = getPool(connectionId)
      if (!pool) throw new Error('Not connected')

      const cols = Object.keys(values)
      const placeholders = cols.map((_, i) => `$${i + 1}`)
      const result = await pool.query(
        `INSERT INTO "${schema}"."${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        Object.values(values)
      )
      return result.rows[0]
    }
  )

  ipcMain.handle(
    'query:deleteRows',
    async (
      _e,
      {
        connectionId,
        schema,
        table,
        primaryKeys,
        pkValuesList
      }: {
        connectionId: string
        schema: string
        table: string
        primaryKeys: string[]
        pkValuesList: Record<string, unknown>[]
      }
    ) => {
      const pool = getPool(connectionId)
      if (!pool) throw new Error('Not connected')

      let deleted = 0
      for (const pkValues of pkValuesList) {
        const whereClauses = primaryKeys.map((pk, i) => `"${pk}" = $${i + 1}`)
        await pool.query(
          `DELETE FROM "${schema}"."${table}" WHERE ${whereClauses.join(' AND ')}`,
          primaryKeys.map((pk) => pkValues[pk])
        )
        deleted++
      }
      return { deleted }
    }
  )
  ipcMain.handle(
    'query:execute',
    async (_e, { connectionId, sql }: { connectionId: string; sql: string }) => {
      const pool = getPool(connectionId)
      if (!pool) throw new Error('Not connected to database')

      const start = Date.now()
      try {
        const result = await pool.query(sql)
        const durationMs = Date.now() - start

        if (Array.isArray(result)) {
          const last = result[result.length - 1]
          return {
            rows: last.rows,
            fields: last.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
            rowCount: last.rowCount ?? last.rows.length,
            durationMs,
            command: last.command
          }
        }

        return {
          rows: result.rows,
          fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
          rowCount: result.rowCount ?? result.rows.length,
          durationMs,
          command: result.command
        }
      } catch (err) {
        throw new Error((err as Error).message)
      }
    }
  )

  ipcMain.handle(
    'query:fetchTable',
    async (
      _e,
      {
        connectionId,
        schema,
        table,
        limit,
        offset,
        orderBy,
        where
      }: {
        connectionId: string
        schema: string
        table: string
        limit: number
        offset: number
        orderBy?: { column: string; dir: 'ASC' | 'DESC' }
        where?: string
      }
    ) => {
      const pool = getPool(connectionId)
      if (!pool) throw new Error('Not connected')

      const orderClause = orderBy ? `ORDER BY "${orderBy.column}" ${orderBy.dir}` : ''
      const whereClause = where ? `WHERE ${where}` : ''

      const [dataResult, countResult] = await Promise.all([
        pool.query(
          `SELECT * FROM "${schema}"."${table}" ${whereClause} ${orderClause} LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
        pool.query(`SELECT COUNT(*) AS total FROM "${schema}"."${table}" ${whereClause}`)
      ])

      return {
        rows: dataResult.rows,
        fields: dataResult.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
        total: parseInt(countResult.rows[0].total as string),
        limit,
        offset
      }
    }
  )

  ipcMain.handle(
    'query:updateRow',
    async (
      _e,
      {
        connectionId,
        schema,
        table,
        primaryKeys,
        pkValues,
        updates
      }: {
        connectionId: string
        schema: string
        table: string
        primaryKeys: string[]
        pkValues: Record<string, unknown>
        updates: Record<string, unknown>
      }
    ) => {
      const pool = getPool(connectionId)
      if (!pool) throw new Error('Not connected')

      const setClauses = Object.keys(updates).map((col, i) => `"${col}" = $${i + 1}`)
      const whereClauses = primaryKeys.map(
        (pk, i) => `"${pk}" = $${Object.keys(updates).length + i + 1}`
      )
      const values = [...Object.values(updates), ...primaryKeys.map((pk) => pkValues[pk])]

      await pool.query(
        `UPDATE "${schema}"."${table}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`,
        values
      )
      return { success: true }
    }
  )

  ipcMain.handle(
    'query:getPrimaryKeys',
    async (_e, { connectionId, schema, table }: { connectionId: string; schema: string; table: string }) => {
      const pool = getPool(connectionId)
      if (!pool) throw new Error('Not connected')
      return getPrimaryKeys(pool, schema, table)
    }
  )
}
