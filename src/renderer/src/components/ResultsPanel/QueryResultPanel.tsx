import { useAppStore } from '../../store/useAppStore'
import { ResultsGrid } from './ResultsGrid'
import { AlertCircle, Clock, Loader2 } from 'lucide-react'
import { formatDuration, formatRowCount } from '../../lib/utils'

export function QueryResultPanel(): JSX.Element {
  const { tabs, activeTabId } = useAppStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  if (!activeTab || activeTab.mode === 'table') return <div className="flex-1" />

  if (activeTab.isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Running query…
      </div>
    )
  }

  if (activeTab.error) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-destructive/10 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          <span className="text-xs font-medium text-destructive">Query Error</span>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <pre className="whitespace-pre-wrap font-mono text-xs text-destructive">
            {activeTab.error}
          </pre>
        </div>
      </div>
    )
  }

  if (!activeTab.result) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Run a query to see results
      </div>
    )
  }

  const { result } = activeTab

  if (result.rows.length === 0 && result.command !== 'SELECT') {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border bg-green-500/10 px-3 py-2">
          <span className="text-xs text-green-600 dark:text-green-400">
            {result.command} — {result.rowCount} row{result.rowCount !== 1 ? 's' : ''} affected
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDuration(result.durationMs)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <ResultsGrid rows={result.rows} fields={result.fields} />
  )
}
