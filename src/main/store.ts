import ElectronStore from 'electron-store'
const Store = ElectronStore
import { safeStorage } from 'electron'

export interface SavedConnection {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
  encryptedPassword: string
  ssl: boolean
  color: string
  createdAt: number
}

export interface QueryHistoryEntry {
  id: string
  connectionId: string
  sql: string
  executedAt: number
  durationMs?: number
  rowCount?: number
}

export interface AppSettings {
  theme: 'auto' | 'dark' | 'light'
  editorFontSize: number
}

interface StoreSchema {
  connections: SavedConnection[]
  queryHistory: QueryHistoryEntry[]
  settings: AppSettings
}

export const store = new Store<StoreSchema>({
  name: 'table-data',
  defaults: {
    connections: [],
    queryHistory: [],
    settings: {
      theme: 'auto',
      editorFontSize: 13
    }
  }
})

export function encryptPassword(password: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(password).toString('base64')
  }
  return safeStorage.encryptString(password).toString('base64')
}

export function decryptPassword(encrypted: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(encrypted, 'base64').toString('utf-8')
  }
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch {
    return ''
  }
}
