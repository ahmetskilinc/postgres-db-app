import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { ScrollArea } from '../ui/scroll-area'
import { Separator } from '../ui/separator'
import { ChevronRight, Loader2, Table2, Eye, KeyRound, Hash } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TableInfo, ColumnInfo } from '../../types'

export function SchemaTree(): JSX.Element {
  const { activeConnectionId, connectedIds, schemaStates, toggleSchema, openTableBrowser } =
    useAppStore()

  const connectionId = activeConnectionId
  const isConnected = connectionId ? connectedIds.includes(connectionId) : false
  const schemaState = connectionId ? schemaStates[connectionId] : undefined

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
      <ScrollArea className="flex-1">
        <div className="pb-4">
          {schemaState.schemas.map((schema) => (
            <SchemaSection
              key={schema}
              connectionId={connectionId}
              schema={schema}
              isExpanded={schemaState.expandedSchemas.includes(schema)}
              isLoading={schemaState.loadingTables.includes(schema)}
              tables={schemaState.tables[schema]}
              onToggle={() => toggleSchema(connectionId, schema)}
              onTableOpen={(table) => openTableBrowser(connectionId, schema, table)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function SchemaSection({
  connectionId,
  schema,
  isExpanded,
  isLoading,
  tables,
  onToggle,
  onTableOpen
}: {
  connectionId: string
  schema: string
  isExpanded: boolean
  isLoading: boolean
  tables?: TableInfo[]
  onToggle: () => void
  onTableOpen: (table: string) => void
}): JSX.Element {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-3 py-1 text-xs font-medium text-sidebar-foreground hover:bg-accent/50 transition-colors"
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

      {isExpanded && tables && (
        <div>
          {tables.length === 0 ? (
            <div className="py-1 pl-8 text-xs text-muted-foreground">No tables</div>
          ) : (
            tables.map((table) => (
              <TableRow
                key={`${table.schema}.${table.name}`}
                connectionId={connectionId}
                table={table}
                onOpen={() => onTableOpen(table.name)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function TableRow({
  connectionId,
  table,
  onOpen
}: {
  connectionId: string
  table: TableInfo
  onOpen: () => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [columns, setColumns] = useState<ColumnInfo[] | null>(null)
  const [loading, setLoading] = useState(false)

  const Icon = table.type === 'VIEW' || table.type === 'MATERIALIZED VIEW' ? Eye : Table2

  const handleToggle = async (): Promise<void> => {
    if (!expanded && columns === null) {
      setLoading(true)
      try {
        const cols = await window.api.schema.getColumns(connectionId, table.schema, table.name)
        setColumns(cols)
      } finally {
        setLoading(false)
      }
    }
    setExpanded((e) => !e)
  }

  return (
    <div>
      <div className="group flex w-full items-center text-xs text-sidebar-foreground hover:bg-accent/50 transition-colors">
        <button
          onClick={handleToggle}
          className="flex flex-1 items-center gap-2 py-1 pl-7 pr-1 min-w-0"
        >
          <ChevronRight
            className={cn(
              'h-2.5 w-2.5 shrink-0 text-muted-foreground/60 transition-transform',
              expanded && 'rotate-90'
            )}
          />
          <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{table.name}</span>
          {loading && <Loader2 className="ml-1 h-2.5 w-2.5 animate-spin text-muted-foreground" />}
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

      {expanded && columns && (
        <div className="pb-0.5">
          {columns.map((col) => (
            <ColumnRow key={col.name} col={col} />
          ))}
        </div>
      )}
    </div>
  )
}

function ColumnRow({ col }: { col: ColumnInfo }): JSX.Element {
  return (
    <div className="flex items-center gap-2 py-0.5 pl-14 pr-3 text-2xs text-muted-foreground hover:bg-accent/30 transition-colors">
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
}
