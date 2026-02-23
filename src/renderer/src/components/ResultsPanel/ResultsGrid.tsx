import { useState, useRef, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAppStore } from '../../store/useAppStore'
import { ExportMenu } from './ExportMenu'
import { cellValueToString } from '../../lib/utils'
import { cn } from '../../lib/utils'
import { Loader2 } from 'lucide-react'
import { toast } from '../../hooks/use-toast'

interface Props {
  rows: Record<string, unknown>[]
  fields: { name: string; dataTypeID: number }[]
  connectionId?: string
  schema?: string
  table?: string
}

interface EditState {
  rowIdx: number
  col: string
  value: string
}

export function ResultsGrid({ rows, fields, connectionId, schema, table }: Props): JSX.Element {
  const [pendingEdits, setPendingEdits] = useState<Map<string, Record<string, unknown>>>(new Map())
  const [editCell, setEditCell] = useState<EditState | null>(null)
  const [savingRows, setSavingRows] = useState<Set<number>>(new Set())
  const parentRef = useRef<HTMLDivElement>(null)

  const canEdit = Boolean(connectionId && schema && table)

  const columns: ColumnDef<Record<string, unknown>>[] = fields.map((field) => ({
    id: field.name,
    accessorKey: field.name,
    header: field.name,
    size: 160,
    cell: ({ row, column }) => {
      const rowIdx = row.index
      const colId = column.id
      const isEditing = editCell?.rowIdx === rowIdx && editCell.col === colId
      const editKey = `${rowIdx}:${colId}`
      const pendingRow = pendingEdits.get(String(rowIdx))
      const rawValue = pendingRow?.[colId] ?? row.original[colId]
      const displayValue = cellValueToString(rawValue)
      const isModified = pendingRow && colId in pendingRow

      if (isEditing) {
        return (
          <input
            autoFocus
            className="w-full bg-primary/10 px-1.5 py-0.5 text-xs outline-none ring-1 ring-primary"
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

      return (
        <div
          className={cn(
            'truncate px-2 py-0.5 font-mono text-xs',
            rawValue === null && 'italic text-muted-foreground/40 not-italic',
            isModified && 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          )}
          onDoubleClick={() => canEdit && setEditCell({ rowIdx, col: colId, value: displayValue })}
          title={displayValue}
        >
          {rawValue === null ? (
            <span className="font-sans text-muted-foreground/40 not-italic">NULL</span>
          ) : displayValue}
        </div>
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
        toast({ title: 'Cannot edit', description: 'Table has no primary key', variant: 'destructive' })
        return
      }

      const pkValues = Object.fromEntries(pks.map((pk) => [pk, row[pk]]))

      setSavingRows((p) => new Set(p).add(rowIdx))
      try {
        await window.api.query.updateRow({ connectionId, schema, table, primaryKeys: pks, pkValues, updates })
        setPendingEdits((prev) => {
          const next = new Map(prev)
          next.delete(String(rowIdx))
          return next
        })
        toast({ title: 'Row saved' })
      } catch (err) {
        toast({ title: 'Save failed', description: (err as Error).message, variant: 'destructive' })
      } finally {
        setSavingRows((p) => {
          const next = new Set(p)
          next.delete(rowIdx)
          return next
        })
      }
    },
    [connectionId, schema, table, rows, pendingEdits]
  )

  const handleDiscardRow = useCallback((rowIdx: number) => {
    setPendingEdits((prev) => {
      const next = new Map(prev)
      next.delete(String(rowIdx))
      return next
    })
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs text-muted-foreground">
          {rows.length.toLocaleString()} rows
        </span>
        {fields.length > 0 && <ExportMenu rows={rows} fields={fields} />}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          No rows returned
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
            <thead className="sticky top-0 z-10 bg-background border-b border-border">
              {table_instance.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {canEdit && <th className="w-16 border-r border-border/60 px-2 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground/70" />}
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="border-r border-border/60 px-2 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground/70 last:border-r-0"
                      style={{ width: header.getSize() }}
                    >
                      <div className="truncate">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              <tr style={{ height: virtualItems[0]?.start ?? 0 }}>
                <td colSpan={columns.length + (canEdit ? 1 : 0)} />
              </tr>
              {virtualItems.map((virtualRow) => {
                const row = tableRows[virtualRow.index]
                const rowIdx = virtualRow.index
                const hasPending = pendingEdits.has(String(rowIdx))
                const isSaving = savingRows.has(rowIdx)
                const isEven = virtualRow.index % 2 === 0

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-border/40 transition-colors hover:bg-accent/50',
                      isEven && 'bg-muted/20',
                      hasPending && 'bg-amber-500/5 hover:bg-amber-500/10'
                    )}
                    style={{ height: virtualRow.size }}
                  >
                    {canEdit && (
                      <td className="w-16 border-r border-border/60 px-1 py-0.5">
                        {hasPending && (
                          <div className="flex items-center gap-0.5">
                            {isSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                <button
                                  onClick={() => handleSaveRow(rowIdx)}
                                  className="rounded px-1.5 py-0.5 text-2xs font-medium text-green-500 hover:bg-green-500/10"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => handleDiscardRow(rowIdx)}
                                  className="rounded px-1 py-0.5 text-2xs text-muted-foreground hover:bg-accent"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="border-r border-border/40 last:border-r-0"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )
              })}
              <tr style={{ height: totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0) }}>
                <td colSpan={columns.length + (canEdit ? 1 : 0)} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
