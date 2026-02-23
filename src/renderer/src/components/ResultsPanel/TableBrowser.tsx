import { useEffect, useState, useCallback } from 'react'
import { useAppStore, type EditorTab } from '../../store/useAppStore'
import { ResultsGrid } from './ResultsGrid'
import { Button } from '../ui/button'
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import type { TableData } from '../../types'

const PAGE_SIZE = 100

export function TableBrowser({ tab }: { tab: EditorTab }): JSX.Element {
  const { updateTab } = useAppStore()
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)

  const meta = tab.tableMeta!

  const fetchPage = useCallback(
    async (pageNum: number) => {
      setLoading(true)
      try {
        const data = await window.api.query.fetchTable({
          connectionId: meta.connectionId,
          schema: meta.schema,
          table: meta.table,
          limit: PAGE_SIZE,
          offset: pageNum * PAGE_SIZE
        })
        updateTab(tab.id, { tableData: data })
        setPage(pageNum)
      } finally {
        setLoading(false)
      }
    },
    [meta, tab.id, updateTab]
  )

  useEffect(() => {
    if (!tab.tableData) fetchPage(0)
  }, [tab.id])

  const tableData = tab.tableData
  const totalPages = tableData ? Math.ceil(tableData.total / PAGE_SIZE) : 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 items-center justify-between border-b border-border bg-background/50 px-3">
        <span className="text-xs font-medium text-muted-foreground">
          {meta.schema}.{meta.table}
        </span>
        <div className="flex items-center gap-2">
          {tableData && (
            <span className="text-xs text-muted-foreground">
              {tableData.total.toLocaleString()} rows
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => fetchPage(page)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {tableData ? (
          <ResultsGrid
            rows={tableData.rows}
            fields={tableData.fields}
            connectionId={meta.connectionId}
            schema={meta.schema}
            table={meta.table}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex h-8 items-center justify-center gap-2 border-t border-border bg-background/50 px-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={page === 0 || loading}
            onClick={() => fetchPage(page - 1)}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => fetchPage(page + 1)}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
