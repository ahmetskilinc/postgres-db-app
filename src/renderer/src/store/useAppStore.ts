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

export interface SessionTab {
  id: string;
  title: string;
  sql: string;
  mode: "query" | "table";
  tableMeta: { schema: string; table: string; connectionId: string } | null;
  connectionId: string | null;
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
  preReleaseUpdates: boolean;

  loadConnections: () => Promise<void>;
  setActiveConnection: (id: string | null) => void;
  setConnected: (id: string, connected: boolean) => void;
  addTab: (init?: Partial<EditorTab>) => string;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (id: string) => void;
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
  saveSettings: (s: Partial<{ theme: "auto" | "dark" | "light"; editorFontSize: number; analyticsEnabled: boolean; preReleaseUpdates: boolean }>) => Promise<void>;
  historyPanelOpen: boolean;
  toggleHistoryPanel: () => void;
  cacheColumns: (connectionId: string, schema: string, table: string, columns: ColumnInfo[]) => void;
  inspectedRow: { row: Record<string, unknown>; fields: { name: string; dataTypeID: number }[] } | null;
  setInspectedRow: (row: Record<string, unknown> | null, fields?: { name: string; dataTypeID: number }[]) => void;
  commandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;

  restoreSession: () => Promise<void>;
  saveSession: () => void;
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
  preReleaseUpdates: false,
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

  closeAllTabs: () => {
    const defaultTab = makeDefaultTab();
    set({ tabs: [defaultTab], activeTabId: defaultTab.id });
  },

  closeOtherTabs: (id) => {
    set((s) => {
      const tab = s.tabs.find((t) => t.id === id);
      if (!tab) return {};
      return { tabs: [tab], activeTabId: id };
    });
  },

  setActiveTab: (id) => set({ activeTabId: id, inspectedRow: null }),

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
    const existingState = get().schemaStates[connectionId];
    // Auto-expand if there's only one schema
    const shouldAutoExpand = schemas.length === 1 && !existingState?.expandedSchemas?.length;
    set((s) => ({
      schemaStates: {
        ...s.schemaStates,
        [connectionId]: {
          schemas,
          expandedSchemas: shouldAutoExpand ? [schemas[0]] : (s.schemaStates[connectionId]?.expandedSchemas ?? []),
          tables: s.schemaStates[connectionId]?.tables ?? {},
          loadingTables: [],
          columns: s.schemaStates[connectionId]?.columns ?? {},
        },
      },
    }));
    // Load tables for the auto-expanded schema
    if (shouldAutoExpand) {
      get().loadTables(connectionId, schemas[0]);
    }
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
    // Check if a tab for this table already exists
    const existingTab = get().tabs.find(
      (t) =>
        t.mode === "table" &&
        t.tableMeta?.connectionId === connectionId &&
        t.tableMeta?.schema === schema &&
        t.tableMeta?.table === table
    );
    
    if (existingTab) {
      // Switch to existing tab
      set({ activeTabId: existingTab.id });
      return;
    }
    
    // Create new tab
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
      analyticsEnabled: settings.analyticsEnabled,
      preReleaseUpdates: settings.preReleaseUpdates
    });
  },

  saveSettings: async (s) => {
    if (!window.api) return;
    const updated = await window.api.settings.set(s);
    set({
      themePreference: updated.theme,
      editorFontSize: updated.editorFontSize,
      analyticsEnabled: updated.analyticsEnabled,
      preReleaseUpdates: updated.preReleaseUpdates
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

  restoreSession: async () => {
    if (!window.api?.session) return;
    const session = await window.api.session.get();
    if (!session || session.tabs.length === 0) return;

    // Reconnect FIRST so table browser tabs don't fire fetches before
    // the connection pool is ready.
    if (session.activeConnectionId) {
      try {
        await window.api.connections.connect(session.activeConnectionId);
        get().setConnected(session.activeConnectionId, true);
        get().setActiveConnection(session.activeConnectionId);
      } catch {
        // Connection may no longer be valid — silently skip
      }
    }

    // Now restore tabs — table browsers will mount and fetch against
    // the already-live connection.
    const restoredTabs: EditorTab[] = session.tabs.map((st: SessionTab) => ({
      id: st.id,
      title: st.title,
      sql: st.sql,
      result: null,
      tableData: null,
      mode: st.mode,
      tableMeta: st.tableMeta,
      isLoading: false,
      error: null,
      connectionId: st.connectionId,
    }));

    set({
      tabs: restoredTabs,
      activeTabId: session.activeTabId ?? restoredTabs[0]?.id ?? null,
    });
  },

  saveSession: () => {
    if (!window.api?.session) return;
    const { activeConnectionId, activeTabId, tabs } = get();
    const sessionTabs: SessionTab[] = tabs.map((t) => ({
      id: t.id,
      title: t.title,
      sql: t.sql,
      mode: t.mode,
      tableMeta: t.tableMeta,
      connectionId: t.connectionId,
    }));
    window.api.session.save({
      activeConnectionId,
      activeTabId,
      tabs: sessionTabs,
    });
  },
}));

// Auto-save session on relevant state changes (debounced)
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
useAppStore.subscribe(
  (state, prev) => {
    // Only save when tabs, activeTabId, or activeConnectionId change
    if (
      state.tabs === prev.tabs &&
      state.activeTabId === prev.activeTabId &&
      state.activeConnectionId === prev.activeConnectionId
    ) {
      return;
    }
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      useAppStore.getState().saveSession();
    }, 500);
  }
);
