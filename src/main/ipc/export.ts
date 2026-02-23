import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'

export function registerExportHandlers(): void {
  ipcMain.handle(
    'export:csv',
    async (_e, { rows, fields }: { rows: Record<string, unknown>[]; fields: { name: string }[] }) => {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) return

      const result = await dialog.showSaveDialog(win, {
        title: 'Export as CSV',
        defaultPath: 'export.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      })

      if (result.canceled || !result.filePath) return

      const header = fields.map((f) => `"${f.name}"`).join(',')
      const rowLines = rows.map((row) =>
        fields
          .map((f) => {
            const val = row[f.name]
            if (val === null || val === undefined) return ''
            const str = String(val)
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str
          })
          .join(',')
      )
      const csv = [header, ...rowLines].join('\n')
      await writeFile(result.filePath, csv, 'utf-8')
      return { success: true, path: result.filePath }
    }
  )

  ipcMain.handle(
    'export:json',
    async (_e, { rows }: { rows: Record<string, unknown>[] }) => {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) return

      const result = await dialog.showSaveDialog(win, {
        title: 'Export as JSON',
        defaultPath: 'export.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      })

      if (result.canceled || !result.filePath) return

      await writeFile(result.filePath, JSON.stringify(rows, null, 2), 'utf-8')
      return { success: true, path: result.filePath }
    }
  )
}
