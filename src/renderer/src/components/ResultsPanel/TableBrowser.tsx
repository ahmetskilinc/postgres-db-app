import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore, type EditorTab } from '../../store/useAppStore'
import { ResultsGrid, type SortState } from './ResultsGrid'
import { Button } from '../ui/button'
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Plus, Trash2, Filter, X } from 'lucide-react'
import { toast } from '../../hooks/use-toast'
import type { TableData } from '../../types'

const PAGE_SIZE = 200

export function TableBrowser({ tab }: { tab: EditorTab }): JSX.Element {
  const { updateTab } = useAppStore()
  const meta = tab.tableMeta!

  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sortState, setSortState] = useState<SortState>(null)
  const [filterInput, setFilterInput] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [filterError, setFilterError] = useState('')
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [pendingNewRow, setPendingNewRow] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const filterRef = useRef<HTMLInputElement>(null)

  const fetchPage = useCallback(
    async (pageNum: number, sort: SortState = sortState, filter: string = activeFilter) => {
      setLoading(true)
      setFilterError('')
      try {
        const data = await window.api.query.fetchTable({
          connectionId: meta.connectionId,
          schema: meta.schema,
          table: meta.table,
          limit: PAGE_SIZE,
          offset: pageNum * PAGE_SIZE,
          orderBy: sort ?? undefined,
          where: filter || undefined
        })
        updateTab(tab.id, { tableData: data })
        setPage(pageNum)
        setSelectedRows(new Set())
      } catch (err) {
        const msg = (err as Error).message
        if (filter) {
          setFilterError(msg)
        } else {
          toast({ title: 'Error', description: msg, variant: 'destructive' })
        }
      } finally {
        setLoading(false)
      }
    },
    [meta, tab.id, updateTab, sortState, activeFilter]
  )

  useEffect(() => {
    if (!tab.tableData) fetchPage(0, null, '')
  }, [tab.id])

  const handleSort = (col: string): void => {
    const next: SortState =
      sortState?.column === col
        ? sortState.dir === 'ASC'
          ? { column: col, dir: 'DESC' }
          : null
        : { column: col, dir: 'ASC' }
    setSortState(next)
    fetchPage(0, next)
  }

  const handleApplyFilter = (): void => {
    setActiveFilter(filterInput)
    fetchPage(0, sortState, filterInput)
  }

  const handleClearFilter = (): void => {
    setFilterInput('')
    setActiveFilter('')
    setFilterError('')
    fetchPage(0, sortState, '')
  }

  const handleFilterByValue = (col: string, value: string): void => {
    const clause = `"${col}" = '${value.replace(/'/g, "''")}'`
    setFilterInput(clause)
    setActiveFilter(clause)
    fetchPage(0, sortState, clause)
  }

  const handleRowSelect = (idx: number, selected: boolean): void => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (selected) next.add(idx)
      else next.delete(idx)
      return next
    })
  }

  const handleSelectAll = (): void => {
    const data = tab.tableData
    if (!data) return
    if (selectedRows.size === data.rows.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(data.rows.map((_, i) => i)))
    }
  }

  const handleDeleteSelected = async (): Promise<void> => {
    const data = tab.tableData
    if (!data || selectedRows.size === 0) return

    const pks = await window.api.query.getPrimaryKeys(meta.connectionId, meta.schema, meta.table)
    if (pks.length === 0) {
      toast({ title: 'No primary key', description: 'Cannot delete rows without a primary key.', variant: 'destructive' })
      return
    }

    const pkValuesList = Array.from(selectedRows).map((idx) =>
      Object.fromEntries(pks.map((pk) => [pk, data.rows[idx][pk]]))
    )

    setDeleting(true)
    try {
      const result = await window.api.query.deleteRows({
        connectionId: meta.connectionId,
        schema: meta.schema,
        table: meta.table,
        primaryKeys: pks,
        pkValuesList
      })
      toast({ title: `Deleted ${result.deleted} row${result.deleted !== 1 ? 's' : ''}` })
      fetchPage(page)
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const handleCommitNewRow = async (values: Record<string, unknown>): Promise<void> => {
    try {
      await window.api.query.insertRow({
        connectionId: meta.connectionId,
        schema: meta.schema,
        table: meta.table,
        values
      })
      toast({ title: 'Row inserted' })
      setPendingNewRow(false)
      fetchPage(page)
    } catch (err) {
      toast({ title: 'Insert failed', description: (err as Error).message, variant: 'destructive' })
      throw err
    }
  }

  const tableData = tab.tableData
  const totalPages = tableData ? Math.ceil(tableData.total / PAGE_SIZE) : 0
  const hasActiveFilter = activeFilter.length > 0

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
        <span className="text-xs font-medium text-muted-foreground shrink-0">
          {meta.schema}.{meta.table}
        </span>
        <div className="flex-1" />
        {selectedRows.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1.5 text-destructive hover:text-destructive"
            onClick={handleDeleteSelected}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Delete {selectedRows.size}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5"
          onClick={() => setPendingNewRow(true)}
          disabled={pendingNewRow}
        >
          <Plus className="h-3 w-3" />
          Insert row
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => fetchPage(page)}
          disabled={loading}
          title="Refresh"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
        {tableData && (
          <span className="text-xs text-muted-foreground shrink-0">
            {tableData.total.toLocaleString()} rows
          </span>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-muted/20 px-3">
        <Filter className={`h-3 w-3 shrink-0 ${hasActiveFilter ? 'text-primary' : 'text-muted-foreground/50'}`} />
        <input
          ref={filterRef}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
          placeholder='WHERE  e.g. email LIKE &apos;%@gmail.com&apos; or id > 100'
          value={filterInput}
          onChange={(e) => setFilterInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleApplyFilter()
            if (e.key === 'Escape') handleClearFilter()
          }}
          spellCheck={false}
        />
        {filterInput && (
          <button onClick={handleClearFilter} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3 w-3" />
          </button>
        )}
        {filterInput !== activeFilter && (
          <button
            onClick={handleApplyFilter}
            className="shrink-0 rounded bg-primary px-2 py-0.5 text-2xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Apply ↵
          </button>
        )}
        {filterError && (
          <span className="shrink-0 text-2xs text-destructive truncate max-w-[200px]" title={filterError}>
            {filterError.split('\n')[0]}
          </span>
        )}
      </div>

      {/* Select all bar — shown when rows exist */}
      {tableData && tableData.rows.length > 0 && (
        <div className="flex h-6 shrink-0 items-center gap-2 border-b border-border/50 bg-muted/10 px-3">
          <input
            type="checkbox"
            checked={selectedRows.size === tableData.rows.length && tableData.rows.length > 0}
            ref={(el) => {
              if (el) el.indeterminate = selectedRows.size > 0 && selectedRows.size < tableData.rows.length
            }}
            onChange={handleSelectAll}
            className="h-3 w-3 cursor-pointer rounded border-border accent-primary"
          />
          <span className="text-2xs text-muted-foreground">
            {selectedRows.size > 0 ? `${selectedRows.size} selected` : 'Select all'}
          </span>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-hidden">
        {tableData ? (
          <ResultsGrid
            rows={tableData.rows}
            fields={tableData.fields}
            connectionId={meta.connectionId}
            schema={meta.schema}
            table={meta.table}
            selectedRows={selectedRows}
            onRowSelect={handleRowSelect}
            sortState={sortState}
            onSort={handleSort}
            onFilterByValue={handleFilterByValue}
            pendingNewRow={pendingNewRow}
            onCancelNewRow={() => setPendingNewRow(false)}
            onCommitNewRow={handleCommitNewRow}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex h-7 shrink-0 items-center justify-center gap-2 border-t border-border bg-background/50 px-3">
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page === 0 || loading} onClick={() => fetchPage(page - 1)}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page >= totalPages - 1 || loading} onClick={() => fetchPage(page + 1)}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
