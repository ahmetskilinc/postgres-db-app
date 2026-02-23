import { useRef, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useAppStore } from '../../store/useAppStore'
import { Button } from '../ui/button'
import { Play, Loader2 } from 'lucide-react'
import { TableBrowser } from '../ResultsPanel/TableBrowser'

export function EditorTab(): JSX.Element {
  const { tabs, activeTabId, activeConnectionId, connectedIds, updateTab, theme, editorFontSize } = useAppStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)

  const isConnected = activeConnectionId ? connectedIds.includes(activeConnectionId) : false

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    editor.addAction({
      id: 'run-query',
      label: 'Run Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => handleRun()
    })
  }

  const handleRun = useCallback(async () => {
    if (!activeTabId || !activeConnectionId || !isConnected) return
    const editor = editorRef.current
    if (!editor) return

    const selection = editor.getSelection()
    const model = editor.getModel()
    if (!model) return

    const selectedText = selection && !selection.isEmpty() ? model.getValueInRange(selection) : null
    const sql = selectedText || model.getValue()
    if (!sql.trim()) return

    updateTab(activeTabId, { isLoading: true, error: null, result: null })

    try {
      const result = await window.api.query.execute(activeConnectionId, sql.trim())
      updateTab(activeTabId, { result, isLoading: false })

      await window.api.history.add({
        connectionId: activeConnectionId,
        sql: sql.trim(),
        executedAt: Date.now(),
        durationMs: result.durationMs,
        rowCount: result.rowCount
      })
    } catch (err) {
      updateTab(activeTabId, {
        error: (err as Error).message,
        isLoading: false
      })
    }
  }, [activeTabId, activeConnectionId, isConnected, updateTab])

  if (!activeTab) return <div className="flex-1" />

  if (activeTab.mode === 'table' && activeTab.tableMeta) {
    return <TableBrowser tab={activeTab} />
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-7 items-center justify-between border-b border-border bg-background px-3">
        <span className="text-xs text-muted-foreground">
          {isConnected ? `Connected` : 'No connection — select one from the sidebar'}
        </span>
        <Button
          size="sm"
          onClick={handleRun}
          disabled={!isConnected || activeTab.isLoading}
          className="h-6 gap-1.5 text-xs"
        >
          {activeTab.isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          Run
          <kbd className="ml-1 hidden rounded bg-primary-foreground/20 px-1 text-2xs opacity-70 sm:inline">
            ⌘↵
          </kbd>
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language="sql"
          value={activeTab.sql}
          onChange={(val) => activeTabId && updateTab(activeTabId, { sql: val ?? '' })}
          beforeMount={(monaco) => {
            monaco.editor.defineTheme('pg-dark', {
              base: 'vs-dark',
              inherit: true,
              rules: [],
              colors: {
                'editor.background': '#1a1a1a',
                'editor.lineHighlightBackground': '#232323',
                'editorLineNumber.foreground': '#444444',
                'editorLineNumber.activeForeground': '#888888',
                'editor.selectionBackground': '#0a84ff33',
                'editorCursor.foreground': '#0a84ff',
                'editorGutter.background': '#1a1a1a'
              }
            })
            monaco.editor.defineTheme('pg-light', {
              base: 'vs',
              inherit: true,
              rules: [],
              colors: {
                'editor.background': '#ffffff',
                'editor.lineHighlightBackground': '#f5f5f5',
                'editorLineNumber.foreground': '#cccccc',
                'editorLineNumber.activeForeground': '#999999',
                'editor.selectionBackground': '#0a84ff22'
              }
            })
          }}
          theme={theme === 'dark' ? 'pg-dark' : 'pg-light'}
          onMount={handleMount}
          options={{
            fontSize: editorFontSize,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderLineHighlight: 'gutter',
            padding: { top: 12, bottom: 12 },
            folding: true,
            wordWrap: 'off',
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            tabSize: 2,
            insertSpaces: true,
            automaticLayout: true,
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6
            }
          }}
        />
      </div>
    </div>
  )
}
