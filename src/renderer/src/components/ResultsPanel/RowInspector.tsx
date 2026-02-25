import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { X, Copy, Check, Braces, List } from 'lucide-react'
import { cn, cellValueToString } from '../../lib/utils'
import { toast } from '../../hooks/use-toast'

type ViewMode = 'fields' | 'json'

export function RowInspector(): JSX.Element {
  const { inspectedRow, setInspectedRow } = useAppStore()
  const [mode, setMode] = useState<ViewMode>('fields')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  if (!inspectedRow) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40">
        Click a row to inspect it
      </div>
    )
  }

  const { row, fields } = inspectedRow

  const copyValue = (key: string, value: string): void => {
    navigator.clipboard.writeText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1200)
  }

  const copyAll = (): void => {
    navigator.clipboard.writeText(JSON.stringify(row, null, 2))
    toast({ title: 'Copied row as JSON' })
  }

  const formatValue = (value: unknown): { display: string; isNull: boolean; isJson: boolean } => {
    if (value === null || value === undefined) return { display: 'NULL', isNull: true, isJson: false }
    if (typeof value === 'object') {
      try {
        return { display: JSON.stringify(value, null, 2), isNull: false, isJson: true }
      } catch {
        return { display: String(value), isNull: false, isJson: false }
      }
    }
    return { display: cellValueToString(value), isNull: false, isJson: false }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-medium text-muted-foreground">Row Inspector</span>
        <div className="flex items-center gap-1">
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setMode('fields')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-2xs transition-colors',
                mode === 'fields' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="h-2.5 w-2.5" />
              Fields
            </button>
            <button
              onClick={() => setMode('json')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-2xs transition-colors border-l border-border',
                mode === 'json' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Braces className="h-2.5 w-2.5" />
              JSON
            </button>
          </div>
          <button
            onClick={copyAll}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Copy as JSON"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            onClick={() => setInspectedRow(null)}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      {mode === 'json' ? (
        <div className="flex-1 overflow-auto p-3">
          <pre className="font-mono text-xs text-foreground/80 whitespace-pre-wrap break-words">
            {JSON.stringify(row, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <tbody>
              {fields.map((field) => {
                const { display, isNull, isJson } = formatValue(row[field.name])
                const isCopied = copiedKey === field.name

                return (
                  <tr
                    key={field.name}
                    className="group border-b border-border/40 hover:bg-accent/30 transition-colors"
                  >
                    <td className="w-[160px] shrink-0 border-r border-border/40 px-3 py-1.5 align-top">
                      <span className="text-2xs font-medium text-muted-foreground/70 font-mono">
                        {field.name}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 align-top">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            'break-all text-xs',
                            isNull && 'italic text-muted-foreground/40 font-sans',
                            isJson && 'font-mono text-2xs whitespace-pre-wrap',
                            !isNull && !isJson && 'font-mono'
                          )}
                        >
                          {display}
                        </span>
                        <button
                          onClick={() => copyValue(field.name, display)}
                          className={cn(
                            'ml-2 shrink-0 rounded p-0.5 transition-all',
                            isCopied
                              ? 'text-green-500'
                              : 'text-muted-foreground/0 group-hover:text-muted-foreground/50 hover:!text-muted-foreground hover:bg-accent'
                          )}
                        >
                          {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
