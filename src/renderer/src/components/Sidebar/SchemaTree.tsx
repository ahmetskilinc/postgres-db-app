import { useState, useCallback, useRef, useMemo, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAppStore } from '../../store/useAppStore'
import { Separator } from '../ui/separator'
import { ChevronRight, Loader2, Table2, Eye, KeyRound, Hash } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TableInfo, ColumnInfo } from '../../types'

/* ------------------------------------------------------------------ */
/*  Row type discriminated union for the flat virtual list             */
/* ------------------------------------------------------------------ */

type VirtualRow =
  | { kind: 'schema'; schema: string; isExpanded: boolean; isLoading: boolean }
  | { kind: 'empty'; schema: string }
  | { kind: 'table'; schema: string; table: TableInfo; isExpanded: boolean; isLoadingCols: boolean }
  | { kind: 'column'; schema: string; tableName: string; col: ColumnInfo }

/* ------------------------------------------------------------------ */
/*  Row heights                                                        */
/* ------------------------------------------------------------------ */
const SCHEMA_ROW_HEIGHT = 28
const TABLE_ROW_HEIGHT = 28
const COLUMN_ROW_HEIGHT = 22
const EMPTY_ROW_HEIGHT = 24

/* ------------------------------------------------------------------ */
/*  SchemaTree (top-level)                                             */
/* ------------------------------------------------------------------ */

export function SchemaTree(): JSX.Element {
  const connectionId = useAppStore((s) => s.activeConnectionId)
  const connectedIds = useAppStore((s) => s.connectedIds)
  const schemaState = useAppStore((s) =>
    s.activeConnectionId ? s.schemaStates[s.activeConnectionId] : undefined
  )
  const toggleSchema = useAppStore((s) => s.toggleSchema)
  const openTableBrowser = useAppStore((s) => s.openTableBrowser)
  const cacheColumns = useAppStore((s) => s.cacheColumns)

  const isConnected = connectionId ? connectedIds.includes(connectionId) : false

  // Track which tables have their columns expanded (lifted from per-row state)
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  // Track which tables are currently loading columns
  const [loadingCols, setLoadingCols] = useState<Set<string>>(new Set())

  const scrollRef = useRef<HTMLDivElement>(null)

  const toggleTableExpanded = useCallback(
    async (connId: string, schema: string, table: TableInfo) => {
      const key = `${schema}.${table.name}`
      setExpandedTables((prev) => {
        const next = new Set(prev)
        if (next.has(key)) {
          next.delete(key)
        } else {
          next.add(key)
        }
        return next
      })

      // Load columns if not yet cached
      const cached =
        useAppStore.getState().schemaStates[connId]?.columns[key]
      if (!cached) {
        setLoadingCols((prev) => new Set(prev).add(key))
        try {
          const cols = await window.api.schema.getColumns(connId, schema, table.name)
          cacheColumns(connId, schema, table.name, cols)
        } finally {
          setLoadingCols((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
          })
        }
      }
    },
    [cacheColumns]
  )

  // Build the flat list of virtual rows
  const flatRows: VirtualRow[] = useMemo(() => {
    if (!schemaState) return []
    const rows: VirtualRow[] = []

    for (const schema of schemaState.schemas) {
      const isExpanded = schemaState.expandedSchemas.includes(schema)
      const isLoading = schemaState.loadingTables.includes(schema)
      rows.push({ kind: 'schema', schema, isExpanded, isLoading })

      if (isExpanded) {
        const tables = schemaState.tables[schema]
        if (!tables || tables.length === 0) {
          if (!isLoading) {
            rows.push({ kind: 'empty', schema })
          }
        } else {
          for (const table of tables) {
            const key = `${schema}.${table.name}`
            const tableExpanded = expandedTables.has(key)
            const isLoadingTableCols = loadingCols.has(key)
            rows.push({
              kind: 'table',
              schema,
              table,
              isExpanded: tableExpanded,
              isLoadingCols: isLoadingTableCols,
            })

            if (tableExpanded) {
              const cols = schemaState.columns[key]
              if (cols) {
                for (const col of cols) {
                  rows.push({ kind: 'column', schema, tableName: table.name, col })
                }
              }
            }
          }
        }
      }
    }
    return rows
  }, [schemaState, expandedTables, loadingCols])

  const estimateSize = useCallback(
    (index: number) => {
      const row = flatRows[index]
      if (!row) return TABLE_ROW_HEIGHT
      switch (row.kind) {
        case 'schema':
          return SCHEMA_ROW_HEIGHT
        case 'table':
          return TABLE_ROW_HEIGHT
        case 'column':
          return COLUMN_ROW_HEIGHT
        case 'empty':
          return EMPTY_ROW_HEIGHT
      }
    },
    [flatRows]
  )

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: 15,
  })

  if (!connectionId || !isConnected) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-xs text-muted-foreground">
        Connect to a database to browse schemas
      </div>
    )
  }

  if (!schemaState || schemaState.schemas.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Separator />
      <div className="px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
          Schema
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((vItem) => {
            const row = flatRows[vItem.index]
            return (
              <div
                key={vItem.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: vItem.size,
                  transform: `translateY(${vItem.start}px)`,
                }}
              >
                {row.kind === 'schema' && (
                  <SchemaRow
                    schema={row.schema}
                    isExpanded={row.isExpanded}
                    isLoading={row.isLoading}
                    onToggle={() => connectionId && toggleSchema(connectionId, row.schema)}
                  />
                )}
                {row.kind === 'empty' && (
                  <div className="py-1 pl-8 text-xs text-muted-foreground">No tables</div>
                )}
                {row.kind === 'table' && (
                  <TableRow
                    table={row.table}
                    isExpanded={row.isExpanded}
                    isLoadingCols={row.isLoadingCols}
                    onToggle={() =>
                      connectionId && toggleTableExpanded(connectionId, row.schema, row.table)
                    }
                    onOpen={() =>
                      connectionId && openTableBrowser(connectionId, row.schema, row.table.name)
                    }
                  />
                )}
                {row.kind === 'column' && <ColumnRow col={row.col} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Schema row                                                         */
/* ------------------------------------------------------------------ */

const SchemaRow = memo(function SchemaRow({
  schema,
  isExpanded,
  isLoading,
  onToggle,
}: {
  schema: string
  isExpanded: boolean
  isLoading: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 px-3 py-1 text-xs font-medium text-sidebar-foreground hover:bg-accent/50"
    >
      <ChevronRight
        className={cn(
          'h-3 w-3 text-muted-foreground transition-transform',
          isExpanded && 'rotate-90'
        )}
      />
      <span className="truncate">{schema}</span>
      {isLoading && <Loader2 className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />}
    </button>
  )
})

/* ------------------------------------------------------------------ */
/*  Table row                                                          */
/* ------------------------------------------------------------------ */

const TableRow = memo(function TableRow({
  table,
  isExpanded,
  isLoadingCols,
  onToggle,
  onOpen,
}: {
  table: TableInfo
  isExpanded: boolean
  isLoadingCols: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const Icon = table.type === 'VIEW' || table.type === 'MATERIALIZED VIEW' ? Eye : Table2

  return (
    <div className="group flex w-full items-center text-xs text-sidebar-foreground hover:bg-accent/50">
      <button
        onClick={onToggle}
        className="flex flex-1 items-center gap-2 py-1 pl-7 pr-1 min-w-0"
      >
        <ChevronRight
          className={cn(
            'h-2.5 w-2.5 shrink-0 text-muted-foreground/60 transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{table.name}</span>
        {isLoadingCols && (
          <Loader2 className="ml-1 h-2.5 w-2.5 animate-spin text-muted-foreground" />
        )}
        {table.type !== 'TABLE' && (
          <span className="ml-auto shrink-0 pr-2 text-2xs text-muted-foreground/60">
            {table.type === 'VIEW' ? 'view' : 'mat'}
          </span>
        )}
      </button>
      <button
        onClick={onOpen}
        title="Open table"
        className="mr-2 hidden shrink-0 rounded px-1.5 py-0.5 text-2xs text-muted-foreground hover:bg-accent hover:text-foreground group-hover:flex"
      >
        Open
      </button>
    </div>
  )
})

/* ------------------------------------------------------------------ */
/*  Column row                                                         */
/* ------------------------------------------------------------------ */

const ColumnRow = memo(function ColumnRow({ col }: { col: ColumnInfo }) {
  return (
    <div className="flex items-center gap-2 py-0.5 pl-14 pr-3 text-2xs text-muted-foreground hover:bg-accent/30">
      {col.isPrimary ? (
        <KeyRound className="h-2.5 w-2.5 shrink-0 text-yellow-500 dark:text-yellow-400" />
      ) : (
        <Hash className="h-2.5 w-2.5 shrink-0 opacity-40" />
      )}
      <span className={cn('truncate', col.isPrimary && 'font-medium text-foreground/70')}>
        {col.name}
      </span>
      <span className="ml-auto shrink-0 font-mono opacity-50">{col.type}</span>
    </div>
  )
})
