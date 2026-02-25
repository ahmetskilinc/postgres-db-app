import { contextBridge, ipcRenderer } from 'electron'

export interface SavedConnection {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
  ssl: boolean
  color: string
  createdAt: number
}

export interface ConnectionConfig {
  id?: string
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl: boolean
  color?: string
}

export interface QueryResult {
  rows: Record<string, unknown>[]
  fields: { name: string; dataTypeID: number }[]
  rowCount: number
  durationMs: number
  command: string
}

export interface TableData {
  rows: Record<string, unknown>[]
  fields: { name: string; dataTypeID: number }[]
  total: number
  limit: number
  offset: number
}

export interface TableInfo {
  schema: string
  name: string
  type: 'TABLE' | 'VIEW' | 'MATERIALIZED VIEW'
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  default: string | null
  isPrimary: boolean
}

export interface QueryHistoryEntry {
  id: string
  connectionId: string
  sql: string
  executedAt: number
  durationMs?: number
  rowCount?: number
}

const api = {
  connections: {
    list: (): Promise<SavedConnection[]> => ipcRenderer.invoke('connections:list'),
    save: (config: ConnectionConfig): Promise<SavedConnection> =>
      ipcRenderer.invoke('connections:save', config),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('connections:delete', id),
    connect: (id: string): Promise<{ connected: boolean }> =>
      ipcRenderer.invoke('connections:connect', id),
    disconnect: (id: string): Promise<void> => ipcRenderer.invoke('connections:disconnect', id),
    test: (config: Omit<ConnectionConfig, 'id' | 'name' | 'color'>): Promise<{
      success: boolean
      latencyMs?: number
      error?: string
    }> => ipcRenderer.invoke('connections:test', config),
    status: (id: string): Promise<{ connected: boolean }> =>
      ipcRenderer.invoke('connections:status', id)
  },
  query: {
    execute: (connectionId: string, sql: string): Promise<QueryResult> =>
      ipcRenderer.invoke('query:execute', { connectionId, sql }),
    fetchTable: (params: {
      connectionId: string
      schema: string
      table: string
      limit: number
      offset: number
      orderBy?: { column: string; dir: 'ASC' | 'DESC' }
      where?: string
    }): Promise<TableData> => ipcRenderer.invoke('query:fetchTable', params),
    insertRow: (params: {
      connectionId: string
      schema: string
      table: string
      values: Record<string, unknown>
    }): Promise<Record<string, unknown>> => ipcRenderer.invoke('query:insertRow', params),
    deleteRows: (params: {
      connectionId: string
      schema: string
      table: string
      primaryKeys: string[]
      pkValuesList: Record<string, unknown>[]
    }): Promise<{ deleted: number }> => ipcRenderer.invoke('query:deleteRows', params),
    updateRow: (params: {
      connectionId: string
      schema: string
      table: string
      primaryKeys: string[]
      pkValues: Record<string, unknown>
      updates: Record<string, unknown>
    }): Promise<{ success: boolean }> => ipcRenderer.invoke('query:updateRow', params),
    getPrimaryKeys: (connectionId: string, schema: string, table: string): Promise<string[]> =>
      ipcRenderer.invoke('query:getPrimaryKeys', { connectionId, schema, table }),
    searchTable: (params: {
      connectionId: string
      schema: string
      table: string
      term: string
      orderBy?: { column: string; dir: 'ASC' | 'DESC' }
    }): Promise<{ matchingRows: number[]; total: number }> =>
      ipcRenderer.invoke('query:searchTable', params)
  },
  schema: {
    getSchemas: (connectionId: string): Promise<string[]> =>
      ipcRenderer.invoke('schema:getSchemas', connectionId),
    getTables: (connectionId: string, schema: string): Promise<TableInfo[]> =>
      ipcRenderer.invoke('schema:getTables', { connectionId, schema }),
    getColumns: (
      connectionId: string,
      schema: string,
      table: string
    ): Promise<ColumnInfo[]> =>
      ipcRenderer.invoke('schema:getColumns', { connectionId, schema, table }),
    getFunctions: (
      connectionId: string,
      schema: string
    ): Promise<{ name: string; returnType: string; language: string }[]> =>
      ipcRenderer.invoke('schema:getFunctions', { connectionId, schema })
  },
  export: {
    csv: (
      rows: Record<string, unknown>[],
      fields: { name: string }[]
    ): Promise<{ success: boolean; path: string } | undefined> =>
      ipcRenderer.invoke('export:csv', { rows, fields }),
    json: (
      rows: Record<string, unknown>[]
    ): Promise<{ success: boolean; path: string } | undefined> =>
      ipcRenderer.invoke('export:json', { rows })
  },
  history: {
    add: (entry: Omit<QueryHistoryEntry, 'id'>): Promise<QueryHistoryEntry> =>
      ipcRenderer.invoke('history:add', entry),
    list: (connectionId?: string): Promise<QueryHistoryEntry[]> =>
      ipcRenderer.invoke('history:list', connectionId),
    clear: (connectionId?: string): Promise<void> =>
      ipcRenderer.invoke('history:clear', connectionId)
  },
  settings: {
    get: (): Promise<{
      theme: 'auto' | 'dark' | 'light'
      editorFontSize: number
      analyticsEnabled: boolean
    }> =>
      ipcRenderer.invoke('settings:get'),
    set: (
      settings: Partial<{
        theme: 'auto' | 'dark' | 'light'
        editorFontSize: number
        analyticsEnabled: boolean
      }>
    ): Promise<{
      theme: 'auto' | 'dark' | 'light'
      editorFontSize: number
      analyticsEnabled: boolean
    }> => ipcRenderer.invoke('settings:set', settings),
    onOpenRequest: (callback: () => void): (() => void) => {
      ipcRenderer.on('open-settings', callback)
      return () => ipcRenderer.removeListener('open-settings', callback)
    }
  },
  theme: {
    onChange: (callback: (theme: 'dark' | 'light') => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, theme: 'dark' | 'light'): void =>
        callback(theme)
      ipcRenderer.on('theme-changed', listener)
      return () => ipcRenderer.removeListener('theme-changed', listener)
    }
  },
  updater: {
    onUpdateAvailable: (callback: () => void): (() => void) => {
      ipcRenderer.on('update-available', callback)
      return () => ipcRenderer.removeListener('update-available', callback)
    },
    onUpdateDownloaded: (callback: () => void): (() => void) => {
      ipcRenderer.on('update-downloaded', callback)
      return () => ipcRenderer.removeListener('update-downloaded', callback)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.api = api
}
