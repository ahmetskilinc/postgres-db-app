import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

import { ExportMenu } from './ExportMenu'
import { useAppStore } from '../../store/useAppStore'
import { cellValueToString, cn } from '../../lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuTrigger
} from '../ui/context-menu'

interface ContextMenuTarget {
  rowIdx: number
  colId: string
  displayValue: string
  rawValue: unknown
  rowData: Record<string, unknown>
}

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
  searchTerm?: string
  scrollToRow?: number
  // Lifted state for batch saving (optional for read-only query mode)
  pendingEdits?: Map<string, Record<string, unknown>>
  onPendingEditsChange?: (edits: Map<string, Record<string, unknown>>) => void
  newRowValues?: Record<string, unknown>
  onNewRowValuesChange?: (values: Record<string, unknown>) => void
  // Select all
  onSelectAll?: (checked: boolean) => void
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
  searchTerm,
  scrollToRow,
  pendingEdits = new Map(),
  onPendingEditsChange,
  newRowValues = {},
  onNewRowValuesChange,
  onSelectAll
}: Props): JSX.Element {
  const [editCell, setEditCell] = useState<EditState | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const [ctxTarget, setCtxTarget] = useState<ContextMenuTarget | null>(null)

  const setInspectedRow = useAppStore((s) => s.setInspectedRow)
  const inspectedRow = useAppStore((s) => s.inspectedRow)
  const isEditable = Boolean(connectionId && schema && table)
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

  const handleCellContextMenu = useCallback(
    (e: React.MouseEvent, rowIdx: number, colId: string, rawValue: unknown, rowData: Record<string, unknown>) => {
      const displayValue = cellValueToString(rawValue)
      setCtxTarget({ rowIdx, colId, displayValue, rawValue, rowData })
    },
    []
  )

  // Refs so the memoized column cell renderer always reads current values
  // without forcing columns to be recreated on every scroll-triggered render
  const editCellRef = useRef(editCell)
  editCellRef.current = editCell
  const pendingEditsRef = useRef(pendingEdits)
  pendingEditsRef.current = pendingEdits
  const normalizedSearchRef = useRef(normalizedSearch)
  normalizedSearchRef.current = normalizedSearch
  const highlightTextRef = useRef(highlightText)
  highlightTextRef.current = highlightText

  const columns: ColumnDef<Record<string, unknown>>[] = useMemo(
    () =>
      fields.map((field) => ({
        id: field.name,
        accessorKey: field.name,
        header: field.name,
        size: 160,
        cell: ({ row, column }) => {
          const rowIdx = row.index
          const colId = column.id
          const currentEditCell = editCellRef.current
          const currentPendingEdits = pendingEditsRef.current
          const currentSearch = normalizedSearchRef.current
          const currentHighlight = highlightTextRef.current
          const isEditing = currentEditCell?.rowIdx === rowIdx && currentEditCell.col === colId
          const pendingRow = currentPendingEdits.get(String(rowIdx))
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
                    const next = new Map(pendingEditsRef.current)
                    const existing = next.get(String(rowIdx)) ?? {}
                    next.set(String(rowIdx), { ...existing, [colId]: newVal })
                    onPendingEditsChange?.(next)
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

          const hasMatch = currentSearch.length > 0 && rawValue !== null &&
            displayValue.toLowerCase().includes(currentSearch)

          return (
            <div
              className={cn(
                'truncate px-2 py-0.5 font-mono text-xs',
                rawValue === null && 'text-muted-foreground/40',
                isModified && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                hasMatch && 'bg-orange-500/8'
              )}
              onDoubleClick={() => isEditable && setEditCell({ rowIdx, col: colId })}
              onContextMenu={(e) => handleCellContextMenu(e, rowIdx, colId, rawValue, row.original)}
              title={displayValue}
            >
              {rawValue === null ? (
                <span className="font-sans italic text-muted-foreground/40">NULL</span>
              ) : currentSearch ? currentHighlight(displayValue) : displayValue}
            </div>
          )
        }
      })),
    [fields, isEditable, handleCellContextMenu]
  )

  const coreRowModel = useMemo(() => getCoreRowModel(), [])

  const table_instance = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: coreRowModel,
    columnResizeMode: 'onChange'
  })

  const { rows: tableRows } = table_instance.getRowModel()

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 26,
    overscan: 5
  })

  useEffect(() => {
    if (scrollToRow !== undefined && scrollToRow >= 0 && scrollToRow < tableRows.length) {
      rowVirtualizer.scrollToIndex(scrollToRow, { align: 'center', behavior: 'smooth' })
    }
  }, [scrollToRow, rowVirtualizer, tableRows.length])

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  const getSortIcon = (colName: string): JSX.Element => {
    if (!sortState || sortState.column !== colName) return <ArrowUpDown className="h-3 w-3 opacity-30" />
    if (sortState.dir === 'ASC') return <ArrowUp className="h-3 w-3 text-primary" />
    return <ArrowDown className="h-3 w-3 text-primary" />
  }

  const totalCols = columns.length + (hasSelection ? 1 : 0)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-border px-3">
        {onSelectAll && selectedRows ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedRows.size === rows.length && rows.length > 0}
              ref={(el) => {
                if (el) el.indeterminate = selectedRows.size > 0 && selectedRows.size < rows.length
              }}
              onChange={(e) => onSelectAll(e.target.checked)}
              className="h-3 w-3 cursor-pointer rounded border-border accent-primary"
            />
            <span className="text-xs text-muted-foreground">
              {selectedRows.size > 0 ? `${selectedRows.size} selected` : 'Select all'}
            </span>
          </label>
        ) : (
          <span />
        )}
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
                  {fields.map((f) => (
                    <td key={f.name} className="border-r border-border/40 last:border-r-0">
                      <input
                        className="w-full bg-transparent px-2 py-0.5 font-mono text-xs outline-none placeholder:text-muted-foreground/40 focus:bg-primary/5"
                        placeholder={f.name}
                        value={newRowValues[f.name] !== undefined ? String(newRowValues[f.name]) : ''}
                        onChange={(e) => onNewRowValuesChange?.({ ...newRowValues, [f.name]: e.target.value })}
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
                const isSelected = selectedRows?.has(rowIdx) ?? false
                const isEven = rowIdx % 2 === 0

                return (
                  <tr
                    key={row.id}
                    onClick={() => inspectedRow?.row === row.original ? setInspectedRow(null) : setInspectedRow(row.original, fields)}
                    className={cn(
                      'cursor-pointer border-b border-border/40 hover:bg-accent/50',
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
      </ContextMenuTrigger>
      <ContextMenuContent>
        {ctxTarget ? (
          <>
            <ContextMenuLabel>Cell — {ctxTarget.colId}</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => navigator.clipboard.writeText(ctxTarget.displayValue)}
            >
              Copy value
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                navigator.clipboard.writeText(JSON.stringify(ctxTarget.rowData, null, 2))
              }
            >
              Copy row as JSON
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                const cols = fields.map((f) => `"${f.name}"`).join(', ')
                const vals = fields
                  .map((f) => {
                    const v = ctxTarget.rowData[f.name]
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
            {onFilterByValue && ctxTarget.rawValue !== null && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onFilterByValue(ctxTarget.colId, ctxTarget.displayValue)}>
                  Filter by this value
                </ContextMenuItem>
              </>
            )}
          </>
        ) : (
          <ContextMenuItem disabled>Right-click a cell</ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
