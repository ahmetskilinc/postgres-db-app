import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ExportMenu } from './ExportMenu'
import { useAppStore } from '../../store/useAppStore'
import { cellValueToString, cn } from '../../lib/utils'
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { toast } from '../../hooks/use-toast'
import { trackEvent } from '../../lib/analytics'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuTrigger
} from '../ui/context-menu'

export type SortState = { column: string; dir: 'ASC' | 'DESC' } | null

interface Props {
  rows: Record<string, unknown>[]
  fields: { name: string; dataTypeID: number }[]
  connectionId?: string
  schema?: string
  table?: string
  selectedRows?: Set<number>
  onRowSelect?: (idx: number, selected: boolean) => void
  sortState?: SortState
  onSort?: (col: string) => void
  onFilterByValue?: (col: string, value: string) => void
  pendingNewRow?: boolean
  onCancelNewRow?: () => void
  onCommitNewRow?: (values: Record<string, unknown>) => Promise<void>
  searchTerm?: string
  scrollToRow?: number
}

interface EditState {
  rowIdx: number
  col: string
}

export function ResultsGrid({
  rows,
  fields,
  connectionId,
  schema,
  table,
  selectedRows,
  onRowSelect,
  sortState,
  onSort,
  onFilterByValue,
  pendingNewRow,
  onCancelNewRow,
  onCommitNewRow,
  searchTerm,
  scrollToRow
}: Props): JSX.Element {
  const [pendingEdits, setPendingEdits] = useState<Map<string, Record<string, unknown>>>(new Map())
  const [editCell, setEditCell] = useState<EditState | null>(null)
  const [savingRows, setSavingRows] = useState<Set<number>>(new Set())
  const [newRowValues, setNewRowValues] = useState<Record<string, unknown>>({})
  const parentRef = useRef<HTMLDivElement>(null)

  const { setInspectedRow } = useAppStore()
  const isEditable = Boolean(connectionId && schema && table)
  const canEdit = isEditable && pendingEdits.size > 0
  const hasSelection = selectedRows !== undefined && onRowSelect !== undefined

  const normalizedSearch = useMemo(() => searchTerm?.toLowerCase() ?? '', [searchTerm])

  const highlightText = useCallback(
    (text: string): React.ReactNode => {
      if (!normalizedSearch || !text) return text
      const lower = text.toLowerCase()
      const idx = lower.indexOf(normalizedSearch)
      if (idx === -1) return text
      const parts: React.ReactNode[] = []
      let lastEnd = 0
      let pos = idx
      let key = 0
      // Find all occurrences
      while (pos !== -1) {
        if (pos > lastEnd) parts.push(text.slice(lastEnd, pos))
        parts.push(
          <mark
            key={key++}
            className="rounded-sm bg-orange-400/30 text-orange-700 dark:bg-orange-500/25 dark:text-orange-300"
          >
            {text.slice(pos, pos + normalizedSearch.length)}
          </mark>
        )
        lastEnd = pos + normalizedSearch.length
        pos = lower.indexOf(normalizedSearch, lastEnd)
      }
      if (lastEnd < text.length) parts.push(text.slice(lastEnd))
      return parts
    },
    [normalizedSearch]
  )

  const columns: ColumnDef<Record<string, unknown>>[] = fields.map((field) => ({
    id: field.name,
    accessorKey: field.name,
    header: field.name,
    size: 160,
    cell: ({ row, column }) => {
      const rowIdx = row.index
      const colId = column.id
      const isEditing = editCell?.rowIdx === rowIdx && editCell.col === colId
      const pendingRow = pendingEdits.get(String(rowIdx))
      const rawValue = pendingRow?.[colId] ?? row.original[colId]
      const displayValue = cellValueToString(rawValue)
      const isModified = pendingRow && colId in pendingRow

      if (isEditing) {
        return (
          <input
            autoFocus
            className="w-full bg-primary/10 px-1.5 py-0.5 font-mono text-xs outline-none ring-1 ring-primary"
            defaultValue={displayValue}
            onBlur={(e) => {
              const newVal = e.target.value
              if (newVal !== cellValueToString(row.original[colId])) {
                setPendingEdits((prev) => {
                  const next = new Map(prev)
                  const existing = next.get(String(rowIdx)) ?? {}
                  next.set(String(rowIdx), { ...existing, [colId]: newVal })
                  return next
                })
              }
              setEditCell(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditCell(null)
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
        )
      }

      const hasMatch = normalizedSearch.length > 0 && rawValue !== null &&
        displayValue.toLowerCase().includes(normalizedSearch)

      const cellEl = (
        <div
          className={cn(
            'truncate px-2 py-0.5 font-mono text-xs',
            rawValue === null && 'text-muted-foreground/40',
            isModified && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
            hasMatch && 'bg-orange-500/8'
          )}
          onDoubleClick={() => isEditable && setEditCell({ rowIdx, col: colId })}
          title={displayValue}
        >
          {rawValue === null ? (
            <span className="font-sans italic text-muted-foreground/40">NULL</span>
          ) : normalizedSearch ? highlightText(displayValue) : displayValue}
        </div>
      )

      return (
        <ContextMenu>
          <ContextMenuTrigger asChild>{cellEl}</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel>Cell — {colId}</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => navigator.clipboard.writeText(displayValue)}
            >
              Copy value
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                navigator.clipboard.writeText(JSON.stringify(row.original, null, 2))
              }
            >
              Copy row as JSON
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                const cols = fields.map((f) => `"${f.name}"`).join(', ')
                const vals = fields
                  .map((f) => {
                    const v = row.original[f.name]
                    if (v === null) return 'NULL'
                    if (typeof v === 'number') return String(v)
                    return `'${String(v).replace(/'/g, "''")}'`
                  })
                  .join(', ')
                navigator.clipboard.writeText(
                  `INSERT INTO "${schema}"."${table}" (${cols}) VALUES (${vals});`
                )
              }}
            >
              Copy as SQL INSERT
            </ContextMenuItem>
            {onFilterByValue && rawValue !== null && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onFilterByValue(colId, displayValue)}>
                  Filter by this value
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
      )
    }
  }))

  const table_instance = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange'
  })

  const { rows: tableRows } = table_instance.getRowModel()

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 26,
    overscan: 20
  })

  useEffect(() => {
    if (scrollToRow !== undefined && scrollToRow >= 0 && scrollToRow < tableRows.length) {
      rowVirtualizer.scrollToIndex(scrollToRow, { align: 'center', behavior: 'smooth' })
    }
  }, [scrollToRow, rowVirtualizer, tableRows.length])

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  const handleSaveRow = useCallback(
    async (rowIdx: number) => {
      if (!connectionId || !schema || !table) return
      const updates = pendingEdits.get(String(rowIdx))
      if (!updates) return
      const row = rows[rowIdx]
      const pks = await window.api.query.getPrimaryKeys(connectionId, schema, table)
      if (pks.length === 0) {
        toast({ title: 'No primary key', description: 'Cannot edit rows without a primary key.', variant: 'destructive' })
        return
      }
      const pkValues = Object.fromEntries(pks.map((pk) => [pk, row[pk]]))
      setSavingRows((p) => new Set(p).add(rowIdx))
      try {
        await window.api.query.updateRow({ connectionId, schema, table, primaryKeys: pks, pkValues, updates })
        trackEvent('rows_updated', { count: 1 })
        setPendingEdits((prev) => { const next = new Map(prev); next.delete(String(rowIdx)); return next })
        toast({ title: 'Row updated' })
      } catch (err) {
        toast({ title: 'Update failed', description: (err as Error).message, variant: 'destructive' })
      } finally {
        setSavingRows((p) => { const next = new Set(p); next.delete(rowIdx); return next })
      }
    },
    [connectionId, schema, table, rows, pendingEdits]
  )

  const handleDiscardRow = useCallback((rowIdx: number) => {
    setPendingEdits((prev) => { const next = new Map(prev); next.delete(String(rowIdx)); return next })
  }, [])

  const getSortIcon = (colName: string): JSX.Element => {
    if (!sortState || sortState.column !== colName) return <ArrowUpDown className="h-3 w-3 opacity-30" />
    if (sortState.dir === 'ASC') return <ArrowUp className="h-3 w-3 text-primary" />
    return <ArrowDown className="h-3 w-3 text-primary" />
  }

  const totalCols = columns.length + (hasSelection ? 1 : 0) + (canEdit ? 1 : 0)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs text-muted-foreground">
          {rows.length.toLocaleString()} rows
        </span>
        {fields.length > 0 && <ExportMenu rows={rows} fields={fields} />}
      </div>

      {rows.length === 0 && !pendingNewRow ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          No rows returned
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
            <thead className="sticky top-0 z-10 bg-background border-b border-border">
              {table_instance.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hasSelection && (
                    <th className="w-8 border-r border-border/60 px-2 py-1.5" />
                  )}
                  {canEdit && (
                    <th className="w-16 border-r border-border/60 px-2 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground/50" />
                  )}
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="border-r border-border/60 px-2 py-1.5 text-left last:border-r-0"
                      style={{ width: header.getSize() }}
                    >
                      <button
                        className="flex w-full items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors"
                        onClick={() => onSort?.(header.id)}
                        disabled={!onSort}
                      >
                        <span className="truncate">{header.id}</span>
                        {onSort && getSortIcon(header.id)}
                      </button>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {/* New row input */}
              {pendingNewRow && (
                <tr className="border-b border-primary/40 bg-primary/5">
                  {hasSelection && <td className="w-8 border-r border-border/60" />}
                  {canEdit && <td className="w-16 border-r border-border/60 px-1 py-0.5">
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => onCommitNewRow?.(newRowValues).then(() => setNewRowValues({}))}
                        className="rounded px-1.5 py-0.5 text-2xs font-medium text-primary hover:bg-primary/10"
                      >
                        Insert
                      </button>
                      <button
                        onClick={() => { onCancelNewRow?.(); setNewRowValues({}) }}
                        className="rounded px-1 py-0.5 text-2xs text-muted-foreground hover:bg-accent"
                      >✕</button>
                    </div>
                  </td>}
                  {fields.map((f) => (
                    <td key={f.name} className="border-r border-border/40 last:border-r-0">
                      <input
                        className="w-full bg-transparent px-2 py-0.5 font-mono text-xs outline-none placeholder:text-muted-foreground/40 focus:bg-primary/5"
                        placeholder={f.name}
                        value={newRowValues[f.name] !== undefined ? String(newRowValues[f.name]) : ''}
                        onChange={(e) => setNewRowValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      />
                    </td>
                  ))}
                </tr>
              )}

              <tr style={{ height: virtualItems[0]?.start ?? 0 }}>
                <td colSpan={totalCols} />
              </tr>
              {virtualItems.map((virtualRow) => {
                const row = tableRows[virtualRow.index]
                const rowIdx = virtualRow.index
                const hasPending = pendingEdits.has(String(rowIdx))
                const isSaving = savingRows.has(rowIdx)
                const isSelected = selectedRows?.has(rowIdx) ?? false
                const isEven = rowIdx % 2 === 0

                return (
                  <tr
                    key={row.id}
                    onClick={() => setInspectedRow(row.original, fields)}
                    className={cn(
                      'cursor-pointer border-b border-border/40 transition-colors hover:bg-accent/50',
                      isEven && 'bg-muted/20',
                      hasPending && 'bg-amber-500/5 hover:bg-amber-500/10',
                      isSelected && 'bg-primary/8 hover:bg-primary/10'
                    )}
                    style={{ height: virtualRow.size }}
                  >
                    {hasSelection && (
                      <td className="w-8 border-r border-border/60 px-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => onRowSelect?.(rowIdx, e.target.checked)}
                          className="h-3 w-3 cursor-pointer rounded border-border accent-primary"
                        />
                      </td>
                    )}
                    {canEdit && (
                      <td className="w-16 border-r border-border/60 px-1 py-0.5">
                        {hasPending && (
                          <div className="flex items-center gap-0.5">
                            {isSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                <button onClick={() => handleSaveRow(rowIdx)} className="rounded px-1.5 py-0.5 text-2xs font-medium text-green-500 hover:bg-green-500/10">Save</button>
                                <button onClick={() => handleDiscardRow(rowIdx)} className="rounded px-1 py-0.5 text-2xs text-muted-foreground hover:bg-accent">✕</button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="border-r border-border/40 last:border-r-0" style={{ width: cell.column.getSize() }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )
              })}
              <tr style={{ height: totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0) }}>
                <td colSpan={totalCols} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
