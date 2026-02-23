import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { store, encryptPassword, SavedConnection } from '../store'
import { connect, disconnect, testConnection, isConnected } from '../db/client'

export function registerConnectionHandlers(): void {
  ipcMain.handle('connections:list', () => {
    return store.get('connections').map((c) => {
      const { encryptedPassword: _pw, ...rest } = c
      return rest
    })
  })

  ipcMain.handle(
    'connections:save',
    async (
      _e,
      data: Omit<SavedConnection, 'encryptedPassword' | 'createdAt'> & {
        password: string
        id?: string
      }
    ) => {
      const connections = store.get('connections')
      const encryptedPassword = encryptPassword(data.password)

      if (data.id) {
        const idx = connections.findIndex((c) => c.id === data.id)
        if (idx !== -1) {
          const updated = { ...connections[idx], ...data, encryptedPassword }
          connections[idx] = updated
          store.set('connections', connections)
          const { encryptedPassword: _pw, ...rest } = updated
          return rest
        }
      }

      const newConn: SavedConnection = {
        id: randomUUID(),
        name: data.name,
        host: data.host,
        port: data.port,
        database: data.database,
        username: data.username,
        encryptedPassword,
        ssl: data.ssl,
        color: data.color ?? '#6366f1',
        createdAt: Date.now()
      }

      store.set('connections', [...connections, newConn])
      const { encryptedPassword: _pw, ...rest } = newConn
      return rest
    }
  )

  ipcMain.handle('connections:delete', async (_e, id: string) => {
    await disconnect(id).catch(() => {})
    store.set(
      'connections',
      store.get('connections').filter((c) => c.id !== id)
    )
  })

  ipcMain.handle('connections:connect', async (_e, id: string) => {
    const connection = store.get('connections').find((c) => c.id === id)
    if (!connection) throw new Error('Connection not found')
    await connect(connection)
    return { connected: true }
  })

  ipcMain.handle('connections:disconnect', async (_e, id: string) => {
    await disconnect(id)
  })

  ipcMain.handle(
    'connections:test',
    async (
      _e,
      config: {
        host: string
        port: number
        database: string
        username: string
        password: string
        ssl: boolean
      }
    ) => {
      return testConnection(config)
    }
  )

  ipcMain.handle('connections:status', (_e, id: string) => {
    return { connected: isConnected(id) }
  })
}
