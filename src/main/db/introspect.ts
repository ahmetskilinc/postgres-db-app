import { Pool } from 'pg'

export async function getSchemas(pool: Pool): Promise<string[]> {
  const result = await pool.query<{ schema_name: string }>(`
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND schema_name NOT LIKE 'pg_temp_%'
      AND schema_name NOT LIKE 'pg_toast_temp_%'
    ORDER BY schema_name
  `)
  return result.rows.map((r) => r.schema_name)
}

export interface TableInfo {
  schema: string
  name: string
  type: 'TABLE' | 'VIEW' | 'MATERIALIZED VIEW'
}

export async function getTables(pool: Pool, schema: string): Promise<TableInfo[]> {
  const result = await pool.query<{ schema: string; name: string; type: string }>(`
    SELECT
      n.nspname AS schema,
      c.relname AS name,
      CASE c.relkind
        WHEN 'r' THEN 'TABLE'
        WHEN 'p' THEN 'TABLE'
        WHEN 'v' THEN 'VIEW'
        WHEN 'm' THEN 'MATERIALIZED VIEW'
      END AS type
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1
      AND c.relkind IN ('r', 'p', 'v', 'm')
    ORDER BY c.relkind, c.relname
  `, [schema])
  return result.rows as TableInfo[]
}

export interface ForeignKeyRef {
  schema: string
  table: string
  column: string
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  default: string | null
  isPrimary: boolean
  foreignKeys?: ForeignKeyRef[]
}

interface FkRow {
  local_column: string
  ref_schema: string
  ref_table: string
  ref_column: string
}

export async function getForeignKeys(
  pool: Pool,
  schema: string,
  table: string
): Promise<Map<string, ForeignKeyRef[]>> {
  const result = await pool.query<FkRow>(`
    SELECT
      local.column_name AS local_column,
      refd.table_schema AS ref_schema,
      refd.table_name AS ref_table,
      refd.column_name AS ref_column
    FROM information_schema.table_constraints fk
    JOIN information_schema.referential_constraints ref
      ON fk.constraint_name = ref.constraint_name
      AND fk.constraint_schema = ref.constraint_schema
      AND fk.constraint_catalog = ref.constraint_catalog
    JOIN information_schema.key_column_usage local
      ON fk.constraint_name = local.constraint_name
      AND fk.table_schema = local.table_schema
      AND fk.table_catalog = local.table_catalog
    JOIN information_schema.key_column_usage refd
      ON ref.unique_constraint_name = refd.constraint_name
      AND ref.unique_constraint_schema = refd.constraint_schema
      AND ref.unique_constraint_catalog = refd.constraint_catalog
      AND local.position_in_unique_constraint = refd.ordinal_position
    WHERE fk.constraint_type = 'FOREIGN KEY'
      AND fk.table_schema = $1
      AND fk.table_name = $2
    ORDER BY local.column_name
  `, [schema, table])

  const map = new Map<string, ForeignKeyRef[]>()
  for (const row of result.rows) {
    const ref: ForeignKeyRef = {
      schema: row.ref_schema,
      table: row.ref_table,
      column: row.ref_column
    }
    const existing = map.get(row.local_column) ?? []
    existing.push(ref)
    map.set(row.local_column, existing)
  }
  return map
}

export async function getColumns(pool: Pool, schema: string, table: string): Promise<ColumnInfo[]> {
  const [colsResult, fkMap] = await Promise.all([
    pool.query<{
      name: string
      type: string
      nullable: boolean
      default: string | null
      isPrimary: boolean
    }>(`
      SELECT
        a.attname AS name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
        NOT a.attnotnull AS nullable,
        pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) AS default,
        COALESCE(
          (SELECT TRUE
           FROM pg_catalog.pg_constraint con
           WHERE con.conrelid = c.oid
             AND con.contype = 'p'
             AND a.attnum = ANY(con.conkey)
           LIMIT 1),
          FALSE
        ) AS "isPrimary"
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
      LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
      WHERE n.nspname = $1
        AND c.relname = $2
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    `, [schema, table]),
    getForeignKeys(pool, schema, table)
  ])

  return colsResult.rows.map((row) => {
    const foreignKeys = fkMap.get(row.name)
    return {
      ...row,
      foreignKeys: foreignKeys?.length ? foreignKeys : undefined
    }
  })
}

export interface FunctionInfo {
  schema: string
  name: string
  returnType: string
  language: string
}

export async function getFunctions(pool: Pool, schema: string): Promise<FunctionInfo[]> {
  const result = await pool.query<{
    schema: string
    name: string
    returnType: string
    language: string
  }>(`
    SELECT
      n.nspname AS schema,
      p.proname AS name,
      pg_get_function_result(p.oid) AS "returnType",
      l.lanname AS language
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = $1
      AND p.prokind = 'f'
    ORDER BY p.proname
    LIMIT 200
  `, [schema])
  return result.rows
}

export async function getPrimaryKeys(pool: Pool, schema: string, table: string): Promise<string[]> {
  const result = await pool.query<{ name: string }>(`
    SELECT a.attname AS name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_constraint con ON con.conrelid = c.oid AND con.contype = 'p'
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(con.conkey)
    WHERE n.nspname = $1
      AND c.relname = $2
    ORDER BY a.attnum
  `, [schema, table])
  return result.rows.map((r) => r.name)
}
