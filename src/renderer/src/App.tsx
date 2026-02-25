import { useEffect } from 'react'
import { cn } from './lib/utils'
import { useAppStore } from './store/useAppStore'
import { ConnectionList } from './components/Sidebar/ConnectionList'
import { SchemaTree } from './components/Sidebar/SchemaTree'
import { TitleBar } from './components/TitleBar/TitleBar'
import { QueryHistoryPanel } from './components/QueryHistory/QueryHistoryPanel'
import { EditorTab } from './components/QueryEditor/EditorTab'
import { QueryResultPanel } from './components/ResultsPanel/QueryResultPanel'
import { StatusBar } from './components/StatusBar/StatusBar'
import { ConnectionDialog } from './components/Dialogs/ConnectionDialog'
import { SettingsDialog } from './components/Dialogs/SettingsDialog'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { Toaster } from './components/ui/toaster'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable'
import { TooltipProvider } from './components/ui/tooltip'

export default function App(): JSX.Element {
  const { theme, setTheme, setUpdateAvailable, openSettings, loadSettings, historyPanelOpen } =
    useAppStore()

  useEffect(() => {
    if (!window.api) return

    loadSettings()

    const unlisten = window.api.theme.onChange((t) => {
      setTheme(t)
      document.documentElement.classList.toggle('dark', t === 'dark')
    })

    const unlistenUpdate = window.api.updater.onUpdateAvailable(() => setUpdateAvailable(true))
    const unlistenSettings = window.api.settings.onOpenRequest(() => openSettings())

    return () => {
      unlisten()
      unlistenUpdate()
      unlistenSettings()
    }
  }, [])

  return (
    <TooltipProvider delayDuration={600}>
      <div className={cn('flex h-screen flex-col overflow-hidden', theme === 'dark' && 'dark')}>
        <TitleBar />

        <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
          {/* Left sidebar — connections + schema tree */}
          <ResizablePanel
            defaultSize={20}
            minSize={14}
            maxSize={35}
            className="flex flex-col sidebar-bg border-r border-sidebar-border"
          >
            <ConnectionList />
            <SchemaTree />
          </ResizablePanel>

          <ResizableHandle />

          {/* Main content */}
          <ResizablePanel defaultSize={historyPanelOpen ? 60 : 80} className="flex flex-col bg-background">
            <ResizablePanelGroup direction="vertical" className="flex-1 overflow-hidden">
              <ResizablePanel defaultSize={55} minSize={20}>
                <EditorTab />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={45} minSize={10}>
                <QueryResultPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          {/* Right sidebar — query history, collapsible */}
          {historyPanelOpen && (
            <>
              <ResizableHandle />
              <ResizablePanel
                defaultSize={20}
                minSize={14}
                maxSize={35}
                className="flex flex-col sidebar-bg border-l border-sidebar-border"
              >
                <QueryHistoryPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        <StatusBar />
        <ConnectionDialog />
        <SettingsDialog />
        <CommandPalette />
        <Toaster />
      </div>
    </TooltipProvider>
  )
}
