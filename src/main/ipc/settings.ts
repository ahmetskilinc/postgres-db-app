import { ipcMain, nativeTheme, BrowserWindow } from 'electron'
import { store, type AppSettings } from '../store'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => store.get('settings'))

  ipcMain.handle('settings:set', (_e, settings: Partial<AppSettings>) => {
    const current = store.get('settings')
    const updated = { ...current, ...settings }
    store.set('settings', updated)

    if (updated.theme === 'dark') nativeTheme.themeSource = 'dark'
    else if (updated.theme === 'light') nativeTheme.themeSource = 'light'
    else nativeTheme.themeSource = 'system'

    const effectiveTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('theme-changed', effectiveTheme)
    })

    return updated
  })
}

export function applyStoredTheme(): void {
  const settings = store.get('settings')
  if (settings.theme === 'dark') nativeTheme.themeSource = 'dark'
  else if (settings.theme === 'light') nativeTheme.themeSource = 'light'
  else nativeTheme.themeSource = 'system'
}
