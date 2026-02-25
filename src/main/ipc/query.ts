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
            fields: last.fields.map((f: { name: string; dataTypeID: number }) => ({
              name: f.name,
              dataTypeID: f.dataTypeID
            })),
            rowCount: last.rowCount ?? last.rows.length,
            durationMs,
            command: last.command
          }
        }

        return {
          rows: result.rows,
          fields: result.fields.map((f: { name: string; dataTypeID: number }) => ({
            name: f.name,
            dataTypeID: f.dataTypeID
          })),
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
        fields: dataResult.fields.map((f: { name: string; dataTypeID: number }) => ({
          name: f.name,
          dataTypeID: f.dataTypeID
        })),
        total: parseInt(countResult.rows[0].total as string),
        limit,
        offset
      }
    }
  )

  ipcMain.handle(
    'query:searchTable',
    async (
      _e,
      {
        connectionId,
        schema,
        table,
        term,
        orderBy
      }: {
        connectionId: string
        schema: string
        table: string
        term: string
        orderBy?: { column: string; dir: 'ASC' | 'DESC' }
      }
    ) => {
      const pool = getPool(connectionId)
      if (!pool) throw new Error('Not connected')

      // Get column names + data types for this table
      const colResult = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
        [schema, table]
      )
      // Skip binary/bytea columns that can't meaningfully cast to text
      const skipTypes = new Set(['bytea', 'ARRAY', 'USER-DEFINED'])
      const cols = colResult.rows
        .filter((r: Record<string, unknown>) => !skipTypes.has(r.data_type as string))
        .map((r: Record<string, unknown>) => r.column_name as string)
      if (cols.length === 0) return { matchingRows: [], total: 0 }

      const pattern = `%${term.replace(/[%_\\]/g, '\\$&')}%`
      const searchConditions = cols.map((c) => `COALESCE("${c}"::text, '') ILIKE $1`).join(' OR ')
      const orderClause = orderBy ? `ORDER BY "${orderBy.column}" ${orderBy.dir}` : ''

      // Number ALL rows using the same ordering the table browser uses,
      // then filter to only those matching. _rn is the global 0-based row index.
      const result = await pool.query(
        `SELECT _rn FROM (
          SELECT ROW_NUMBER() OVER (${orderClause}) - 1 AS _rn, *
          FROM "${schema}"."${table}"
        ) AS _numbered
        WHERE ${searchConditions}
        ORDER BY _rn`,
        [pattern]
      )

      return {
        matchingRows: result.rows.map((r: Record<string, unknown>) => Number(r._rn)),
        total: result.rows.length
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
