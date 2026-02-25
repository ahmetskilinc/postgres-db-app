import { create } from "zustand";
import type { SavedConnection, QueryResult, TableData, TableInfo, ColumnInfo } from "../types";

export interface EditorTab {
  id: string;
  title: string;
  sql: string;
  result: QueryResult | null;
  tableData: TableData | null;
  mode: "query" | "table";
  tableMeta: { schema: string; table: string; connectionId: string } | null;
  isLoading: boolean;
  error: string | null;
  connectionId: string | null;
}

export interface SchemaNode {
  schemas: string[];
  expandedSchemas: string[];
  tables: Record<string, TableInfo[]>;
  loadingTables: string[];
  columns: Record<string, ColumnInfo[]>;
}

interface AppState {
  connections: SavedConnection[];
  activeConnectionId: string | null;
  connectedIds: string[];
  tabs: EditorTab[];
  activeTabId: string | null;
  theme: "dark" | "light";
  connectionDialogOpen: boolean;
  editingConnectionId: string | null;
  schemaStates: Record<string, SchemaNode>;
  latency: Record<string, number | null>;
  updaterStatus: "idle" | "available" | "downloading" | "downloaded" | "error";
  updaterProgress: number | null;
  updaterError: string | null;
  settingsOpen: boolean;
  editorFontSize: number;
  themePreference: "auto" | "dark" | "light";
  analyticsEnabled: boolean;

  loadConnections: () => Promise<void>;
  setActiveConnection: (id: string | null) => void;
  setConnected: (id: string, connected: boolean) => void;
  addTab: (init?: Partial<EditorTab>) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<EditorTab>) => void;
  setTheme: (theme: "dark" | "light") => void;
  openConnectionDialog: (connectionId?: string | null) => void;
  closeConnectionDialog: () => void;
  deleteConnection: (id: string) => Promise<void>;
  connectToDb: (id: string) => Promise<void>;
  disconnectFromDb: (id: string) => Promise<void>;
  loadSchemas: (connectionId: string) => Promise<void>;
  toggleSchema: (connectionId: string, schema: string) => void;
  loadTables: (connectionId: string, schema: string) => Promise<void>;
  setLatency: (connectionId: string, ms: number | null) => void;
  openTableBrowser: (connectionId: string, schema: string, table: string) => void;
  setUpdaterState: (state: {
    status: "idle" | "available" | "downloading" | "downloaded" | "error";
    progress?: number | null;
    error?: string | null;
  }) => void;
  openSettings: () => void;
  closeSettings: () => void;
  loadSettings: () => Promise<void>;
  saveSettings: (s: Partial<{ theme: "auto" | "dark" | "light"; editorFontSize: number; analyticsEnabled: boolean }>) => Promise<void>;
  historyPanelOpen: boolean;
  toggleHistoryPanel: () => void;
  cacheColumns: (connectionId: string, schema: string, table: string, columns: ColumnInfo[]) => void;
  inspectedRow: { row: Record<string, unknown>; fields: { name: string; dataTypeID: number }[] } | null;
  setInspectedRow: (row: Record<string, unknown> | null, fields?: { name: string; dataTypeID: number }[]) => void;
  commandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
}

function makeDefaultTab(init?: Partial<EditorTab>): EditorTab {
  return {
    id: crypto.randomUUID(),
    title: "Query",
    sql: "",
    result: null,
    tableData: null,
    mode: "query",
    tableMeta: null,
    isLoading: false,
    error: null,
    connectionId: null,
    ...init,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  connectedIds: [],
  tabs: [makeDefaultTab()],
  activeTabId: null,
  theme: "light",
  connectionDialogOpen: false,
  editingConnectionId: null,
  schemaStates: {},
  latency: {},
  updaterStatus: "idle",
  updaterProgress: null,
  updaterError: null,
  settingsOpen: false,
  editorFontSize: 13,
  themePreference: "auto" as const,
  analyticsEnabled: true,
  historyPanelOpen: false,
  inspectedRow: null,

  loadConnections: async () => {
    if (!window.api) return;
    const connections = await window.api.connections.list();
    set((s) => {
      const activeTabId = s.activeTabId ?? (s.tabs.length > 0 ? s.tabs[0].id : null);
      return { connections, activeTabId };
    });
  },

  setActiveConnection: (id) => {
    set({ activeConnectionId: id });
    if (id) get().loadSchemas(id);
  },

  setConnected: (id, connected) => {
    set((s) => ({
      connectedIds: connected ? (s.connectedIds.includes(id) ? s.connectedIds : [...s.connectedIds, id]) : s.connectedIds.filter((cid) => cid !== id),
    }));
  },

  addTab: (init) => {
    const tab = makeDefaultTab({
      connectionId: get().activeConnectionId,
      ...init,
    });
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
    return tab.id;
  },

  closeTab: (id) => {
    set((s) => {
      const filtered = s.tabs.filter((t) => t.id !== id);
      const tabs = filtered.length > 0 ? filtered : [makeDefaultTab()];
      const activeTabId = s.activeTabId === id ? tabs[Math.max(0, s.tabs.findIndex((t) => t.id === id) - 1)].id : s.activeTabId;
      return { tabs, activeTabId };
    });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, updates) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  setTheme: (theme) => set({ theme }),

  openConnectionDialog: (connectionId = null) => {
    set({ connectionDialogOpen: true, editingConnectionId: connectionId ?? null });
  },

  closeConnectionDialog: () => {
    set({ connectionDialogOpen: false, editingConnectionId: null });
    get().loadConnections();
  },

  deleteConnection: async (id) => {
    await window.api.connections.delete(id);
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== id),
      connectedIds: s.connectedIds.filter((cid) => cid !== id),
      activeConnectionId: s.activeConnectionId === id ? null : s.activeConnectionId,
    }));
  },

  connectToDb: async (id) => {
    await window.api.connections.connect(id);
    get().setConnected(id, true);
    get().setActiveConnection(id);
  },

  disconnectFromDb: async (id) => {
    await window.api.connections.disconnect(id);
    get().setConnected(id, false);
    set((s) => ({
      activeConnectionId: s.activeConnectionId === id ? null : s.activeConnectionId,
    }));
  },

  loadSchemas: async (connectionId) => {
    const schemas = await window.api.schema.getSchemas(connectionId);
    set((s) => ({
      schemaStates: {
        ...s.schemaStates,
        [connectionId]: {
          schemas,
          expandedSchemas: s.schemaStates[connectionId]?.expandedSchemas ?? [],
          tables: s.schemaStates[connectionId]?.tables ?? {},
          loadingTables: [],
          columns: s.schemaStates[connectionId]?.columns ?? {},
        },
      },
    }));
  },

  toggleSchema: (connectionId, schema) => {
    set((s) => {
      const node = s.schemaStates[connectionId];
      if (!node) return {};
      const expanded = node.expandedSchemas.includes(schema) ? node.expandedSchemas.filter((sc) => sc !== schema) : [...node.expandedSchemas, schema];
      return {
        schemaStates: {
          ...s.schemaStates,
          [connectionId]: { ...node, expandedSchemas: expanded },
        },
      };
    });

    const node = get().schemaStates[connectionId];
    if (node && node.expandedSchemas.includes(schema) && !node.tables[schema]) {
      get().loadTables(connectionId, schema);
    }
  },

  loadTables: async (connectionId, schema) => {
    set((s) => {
      const node = s.schemaStates[connectionId];
      if (!node) return {};
      return {
        schemaStates: {
          ...s.schemaStates,
          [connectionId]: {
            ...node,
            loadingTables: [...node.loadingTables, schema],
          },
        },
      };
    });
    try {
      const tables = await window.api.schema.getTables(connectionId, schema);
      set((s) => {
        const node = s.schemaStates[connectionId];
        if (!node) return {};
        return {
          schemaStates: {
            ...s.schemaStates,
            [connectionId]: {
              ...node,
              tables: { ...node.tables, [schema]: tables },
              loadingTables: node.loadingTables.filter((sc) => sc !== schema),
            },
          },
        };
      });
    } catch {
      set((s) => {
        const node = s.schemaStates[connectionId];
        if (!node) return {};
        return {
          schemaStates: {
            ...s.schemaStates,
            [connectionId]: {
              ...node,
              loadingTables: node.loadingTables.filter((sc) => sc !== schema),
            },
          },
        };
      });
    }
  },

  setLatency: (connectionId, ms) => {
    set((s) => ({ latency: { ...s.latency, [connectionId]: ms } }));
  },

  openTableBrowser: (connectionId, schema, table) => {
    const tabId = get().addTab({
      title: `${schema}.${table}`,
      mode: "table",
      tableMeta: { schema, table, connectionId },
      connectionId,
    });
    set({ activeTabId: tabId });
  },

  setUpdaterState: (state) =>
    set((s) => ({
      updaterStatus: state.status,
      updaterProgress: state.progress ?? (state.status === "downloading" ? s.updaterProgress : null),
      updaterError: state.error ?? (state.status === "error" ? s.updaterError : null),
    })),

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  loadSettings: async () => {
    if (!window.api) return;
    const settings = await window.api.settings.get();
    set({
      themePreference: settings.theme,
      editorFontSize: settings.editorFontSize,
      analyticsEnabled: settings.analyticsEnabled
    });
  },

  saveSettings: async (s) => {
    if (!window.api) return;
    const updated = await window.api.settings.set(s);
    set({
      themePreference: updated.theme,
      editorFontSize: updated.editorFontSize,
      analyticsEnabled: updated.analyticsEnabled
    });
  },

  toggleHistoryPanel: () => set((s) => ({ historyPanelOpen: !s.historyPanelOpen })),

  setInspectedRow: (row, fields) =>
    set({ inspectedRow: row && fields ? { row, fields } : null }),

  cacheColumns: (connectionId, schema, table, columns) => {
    const key = `${schema}.${table}`;
    set((s) => {
      const node = s.schemaStates[connectionId];
      if (!node) return {};
      return {
        schemaStates: {
          ...s.schemaStates,
          [connectionId]: { ...node, columns: { ...node.columns, [key]: columns } },
        },
      };
    });
  },

  commandPaletteOpen: false,
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
}));
