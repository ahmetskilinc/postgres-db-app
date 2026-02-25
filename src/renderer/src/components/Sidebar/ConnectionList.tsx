import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import {
  Plus,
  MoreHorizontal,
  Loader2,
  Unplug,
  Plug,
  Pencil,
  Trash2,
  Database
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { SavedConnection } from '../../types'
import { trackEvent } from '../../lib/analytics'

export function ConnectionList(): JSX.Element {
  const {
    connections,
    activeConnectionId,
    connectedIds,
    connectToDb,
    disconnectFromDb,
    setActiveConnection,
    openConnectionDialog,
    deleteConnection,
    loadConnections
  } = useAppStore()

  const [connecting, setConnecting] = useState<string | null>(null)

  useEffect(() => {
    loadConnections()
  }, [])

  const handleConnect = async (conn: SavedConnection): Promise<void> => {
    if (connectedIds.includes(conn.id)) {
      setActiveConnection(conn.id)
      return
    }
    setConnecting(conn.id)
    try {
      await connectToDb(conn.id)
      trackEvent('connection_connected', {
        ssl: conn.ssl
      })
    } catch (error) {
      trackEvent('connection_failed', {
        message: error instanceof Error ? error.message : 'unknown'
      })
      throw error
    } finally {
      setConnecting(null)
    }
  }

  const handleDisconnect = async (e: React.MouseEvent, id: string): Promise<void> => {
    e.stopPropagation()
    await disconnectFromDb(id)
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-2xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Connections
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => openConnectionDialog()}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">New connection</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-px px-1.5 py-1">
        {connections.length === 0 && (
          <button
            onClick={() => openConnectionDialog()}
            className="flex flex-col items-center gap-2 py-6 px-3 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
          >
            <Database className="h-8 w-8 opacity-30" />
            <span className="text-xs">Add your first connection</span>
          </button>
        )}

        {connections.map((conn) => {
          const isActive = activeConnectionId === conn.id
          const isConnected = connectedIds.includes(conn.id)
          const isConnecting = connecting === conn.id

          return (
            <div
              key={conn.id}
              onClick={() => handleConnect(conn)}
              className={cn(
                'group relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-accent/60 hover:text-foreground'
              )}
            >
              <div className="relative flex-shrink-0">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: conn.color }}
                />
                {isConnected && (
                  <div className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green-500 ring-1 ring-sidebar" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{conn.name}</div>
                <div className="truncate text-2xs text-muted-foreground">
                  {conn.host}:{conn.port}/{conn.database}
                </div>
              </div>

              {isConnecting && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-foreground',
                      'opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {isConnected ? (
                    <DropdownMenuItem
                      onClick={(e) => handleDisconnect(e, conn.id)}
                      className="text-xs"
                    >
                      <Unplug className="h-3 w-3" />
                      Disconnect
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleConnect(conn)
                      }}
                      className="text-xs"
                    >
                      <Plug className="h-3 w-3" />
                      Connect
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      openConnectionDialog(conn.id)
                    }}
                    className="text-xs"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteConnection(conn.id)
                    }}
                    className="text-xs text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>
    </div>
  )
}
