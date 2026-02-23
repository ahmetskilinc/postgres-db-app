import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { store, QueryHistoryEntry } from '../store'

const MAX_HISTORY = 500

export function registerHistoryHandlers(): void {
  ipcMain.handle('history:add', (_e, entry: Omit<QueryHistoryEntry, 'id'>) => {
    const history = store.get('queryHistory')
    const newEntry: QueryHistoryEntry = { ...entry, id: randomUUID() }
    const updated = [newEntry, ...history].slice(0, MAX_HISTORY)
    store.set('queryHistory', updated)
    return newEntry
  })

  ipcMain.handle('history:list', (_e, connectionId?: string) => {
    const history = store.get('queryHistory')
    if (connectionId) {
      return history.filter((h) => h.connectionId === connectionId)
    }
    return history
  })

  ipcMain.handle('history:clear', (_e, connectionId?: string) => {
    if (connectionId) {
      store.set(
        'queryHistory',
        store.get('queryHistory').filter((h) => h.connectionId !== connectionId)
      )
    } else {
      store.set('queryHistory', [])
    }
  })
}
