import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { formatDuration, formatRowCount } from '../../lib/utils'
import { Clock, Rows3, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'

export function StatusBar(): JSX.Element {
  const {
    activeConnectionId,
    connectedIds,
    connections,
    tabs,
    activeTabId,
    latency,
    setLatency,
    updaterStatus,
    updaterProgress,
    updaterError,
    setUpdaterState
  } = useAppStore()

  const latencyInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const [updateMenuOpen, setUpdateMenuOpen] = useState(false)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const isConnected = activeConnectionId ? connectedIds.includes(activeConnectionId) : false
  const activeConn = connections.find((c) => c.id === activeConnectionId)
  const currentLatency = activeConnectionId ? latency[activeConnectionId] : null
  const hasUpdateIndicator =
    updaterStatus === 'available' ||
    updaterStatus === 'downloading' ||
    updaterStatus === 'downloaded' ||
    updaterStatus === 'error'

  const updateLabel =
    updaterStatus === 'downloading'
      ? `Downloading ${Math.round(updaterProgress ?? 0)}%`
      : updaterStatus === 'downloaded'
      ? 'Restart to update'
      : updaterStatus === 'error'
      ? 'Update failed'
      : 'Update available'

  const handleDownloadUpdate = async (): Promise<void> => {
    setUpdaterState({ status: 'downloading', progress: 0, error: null })
    try {
      await window.api.updater.download()
      setUpdateMenuOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download update'
      setUpdaterState({ status: 'error', error: message })
    }
  }

  const handleInstallUpdate = async (): Promise<void> => {
    await window.api.updater.quitAndInstall()
    setUpdateMenuOpen(false)
  }

  useEffect(() => {
    if (latencyInterval.current) clearInterval(latencyInterval.current)

    if (!activeConnectionId || !isConnected) return

    const measure = async (): Promise<void> => {
      const result = await window.api.connections.status(activeConnectionId)
      if (result.connected) {
        const start = Date.now()
        await window.api.connections.status(activeConnectionId)
        setLatency(activeConnectionId, Date.now() - start)
      }
    }

    measure()
    latencyInterval.current = setInterval(measure, 10000)
    return () => {
      if (latencyInterval.current) clearInterval(latencyInterval.current)
    }
  }, [activeConnectionId, isConnected])

  const latencyColor =
    currentLatency === null
      ? 'text-muted-foreground'
      : currentLatency < 20
      ? 'text-green-500'
      : currentLatency < 100
      ? 'text-yellow-500'
      : 'text-red-500'

  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-muted/40 px-3 text-2xs text-muted-foreground">
      <div className="flex items-center gap-4">
        {isConnected && activeConn ? (
          <>
            <div className="flex items-center gap-1.5">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: activeConn.color }}
              />
              <span className="font-medium text-foreground/70">{activeConn.name}</span>
            </div>
            <span className="text-muted-foreground/60">
              {activeConn.database}@{activeConn.host}
            </span>
            {currentLatency !== null && (
              <div className={cn('flex items-center gap-1', latencyColor)}>
                <Wifi className="h-2.5 w-2.5" />
                <span>{currentLatency}ms</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground/60">
            <WifiOff className="h-2.5 w-2.5" />
            <span>Not connected</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {hasUpdateIndicator && (
          <DropdownMenu open={updateMenuOpen} onOpenChange={setUpdateMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-primary transition-opacity hover:opacity-90"
              >
                <RefreshCw className={cn('h-2.5 w-2.5', updaterStatus === 'downloading' && 'animate-spin')} />
                <span>{updateLabel}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {updaterStatus === 'available' && (
                <DropdownMenuItem onSelect={() => void handleDownloadUpdate()}>
                  Download update
                </DropdownMenuItem>
              )}
              {updaterStatus === 'downloading' && (
                <DropdownMenuItem disabled>Downloading {Math.round(updaterProgress ?? 0)}%</DropdownMenuItem>
              )}
              {updaterStatus === 'downloaded' && (
                <DropdownMenuItem onSelect={() => void handleInstallUpdate()}>
                  Restart to update
                </DropdownMenuItem>
              )}
              {updaterStatus === 'error' && (
                <>
                  <DropdownMenuLabel className="max-w-56 truncate">
                    {updaterError ?? 'Update failed'}
                  </DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => void handleDownloadUpdate()}>
                    Retry download
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setUpdateMenuOpen(false)}>Later</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {activeTab?.result && (
          <>
            <div className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              <span>{formatDuration(activeTab.result.durationMs)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Rows3 className="h-2.5 w-2.5" />
              <span>{formatRowCount(activeTab.result.rowCount)}</span>
            </div>
          </>
        )}
        {activeTab?.tableData && (
          <div className="flex items-center gap-1">
            <Rows3 className="h-2.5 w-2.5" />
            <span>{activeTab.tableData.total.toLocaleString()} total rows</span>
          </div>
        )}
      </div>
    </div>
  )
}
