import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useAppStore } from '../../store/useAppStore'
import { X, Copy, Check, Braces, List } from 'lucide-react'
import { cn, cellValueToString } from '../../lib/utils'
import { toast } from '../../hooks/use-toast'

type ViewMode = 'fields' | 'json'

export function RowInspector(): JSX.Element {
  const { inspectedRow, setInspectedRow } = useAppStore()
  const [mode, setMode] = useState<ViewMode>('fields')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Track whether this is the first open (for staggered entrance) vs already open
  const hasAnimated = useRef(false)
  if (!inspectedRow) {
    hasAnimated.current = false // reset so next open gets the full entrance
  }

  const copyValue = (key: string, value: string): void => {
    navigator.clipboard.writeText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1200)
  }

  const copyAll = (): void => {
    if (!inspectedRow) return
    navigator.clipboard.writeText(JSON.stringify(inspectedRow.row, null, 2))
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
      <AnimatePresence mode="wait">
        {!inspectedRow ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex h-full items-center justify-center text-xs text-muted-foreground/40"
          >
            Click a row to inspect it
          </motion.div>
        ) : (
          <motion.div
            key="inspector"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{
              duration: 0.25,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="flex h-full flex-col overflow-hidden"
          >
            {/* Header */}
            <div
              className="flex h-7 shrink-0 items-center justify-between border-b border-border px-3"
            >
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

            {/* Content — only animates on first open, instant swap on row switch */}
            {mode === 'json' ? (
              <div className="flex-1 overflow-auto p-3">
                <pre className="font-mono text-xs text-foreground/80 whitespace-pre-wrap break-words">
                  {JSON.stringify(inspectedRow.row, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    {inspectedRow.fields.map((field, i) => {
                      const { display, isNull, isJson } = formatValue(inspectedRow.row[field.name])
                      const isCopied = copiedKey === field.name
                      const shouldStagger = !hasAnimated.current

                      return (
                        <motion.tr
                          key={field.name}
                          initial={shouldStagger ? { opacity: 0, x: -6 } : false}
                          animate={{ opacity: 1, x: 0 }}
                          transition={
                            shouldStagger
                              ? {
                                  duration: 0.2,
                                  delay: Math.min(i * 0.02, 0.3),
                                  ease: [0.22, 1, 0.36, 1],
                                }
                              : { duration: 0 }
                          }
                          onAnimationComplete={() => {
                            hasAnimated.current = true
                          }}
                          className="group border-b border-border/40 hover:bg-accent/30"
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
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
