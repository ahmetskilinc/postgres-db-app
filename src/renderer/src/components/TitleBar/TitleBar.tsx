import { useAppStore } from '../../store/useAppStore'
import { Button } from '../ui/button'
import { Plus, X, Code2, Table2, Settings, Unplug } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { EditorTab } from '../../store/useAppStore'

export function TitleBar(): JSX.Element {
  const {
    connections,
    activeConnectionId,
    connectedIds,
    tabs,
    activeTabId,
    addTab,
    closeTab,
    setActiveTab,
    disconnectFromDb,
    openConnectionDialog,
    openSettings
  } = useAppStore()

  const activeConn = connections.find((c) => c.id === activeConnectionId)
  const isConnected = activeConnectionId ? connectedIds.includes(activeConnectionId) : false

  return (
    <div className="titlebar-region flex h-[38px] shrink-0 items-center border-b border-border bg-background">
      {/* Traffic lights space — must remain drag */}
      <div className="w-[76px] shrink-0" />

      {/* Connection pill — no-drag */}
      <div className="titlebar-no-drag shrink-0">
        {isConnected && activeConn ? (
          <div className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-accent cursor-default transition-colors">
            <div
              className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: activeConn.color }}
            />
            <span className="max-w-[140px] truncate text-xs font-medium text-foreground/80">
              {activeConn.name}
            </span>
            <button
              onClick={() => disconnectFromDb(activeConn.id)}
              title="Disconnect"
              className="ml-0.5 rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <Unplug className="h-2.5 w-2.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => openConnectionDialog()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            No connection
          </button>
        )}
      </div>

      {isConnected && <div className="mx-2 h-4 w-px shrink-0 bg-border" />}

      {/* Tabs row — the container itself stays drag, only each tab is no-drag */}
      <div className="flex flex-1 items-center gap-0.5 overflow-x-hidden">
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onActivate={() => setActiveTab(tab.id)}
            onClose={() => closeTab(tab.id)}
          />
        ))}
        <div className="titlebar-no-drag">
          <button
            onClick={() => addTab()}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Right actions — no-drag */}
      <div className="titlebar-no-drag ml-2 flex shrink-0 items-center gap-0.5 pr-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          onClick={openSettings}
          title="Preferences (⌘,)"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function Tab({
  tab,
  isActive,
  onActivate,
  onClose
}: {
  tab: EditorTab
  isActive: boolean
  onActivate: () => void
  onClose: () => void
}): JSX.Element {
  const Icon = tab.mode === 'table' ? Table2 : Code2

  return (
    <div
      className="titlebar-no-drag shrink-0"
      onClick={onActivate}
    >
      <div
        className={cn(
          'group flex h-7 max-w-[180px] cursor-default items-center gap-1.5 rounded px-2.5 text-xs transition-colors select-none',
          isActive
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
        )}
      >
        <Icon className="h-3 w-3 shrink-0 opacity-60" />
        <span className="truncate max-w-[120px]">{tab.title}</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className={cn(
            'ml-auto flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            isActive
              ? 'opacity-50 hover:opacity-100'
              : 'opacity-0 group-hover:opacity-50 hover:!opacity-100'
          )}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  )
}
