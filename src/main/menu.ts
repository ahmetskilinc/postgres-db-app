import { Menu, app, BrowserWindow, shell } from 'electron'

export function buildAppMenu(): void {
  const isMac = process.platform === 'darwin'
  const sendToFocusedWindow = (channel: string): void => {
    const win = BrowserWindow.getFocusedWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel)
      return
    }
    const firstWindow = BrowserWindow.getAllWindows()[0]
    if (firstWindow && !firstWindow.isDestroyed()) {
      firstWindow.webContents.send(channel)
    }
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: 'Table',
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              {
                label: 'Preferences…',
                accelerator: 'CmdOrCtrl+,',
                click: () => {
                  BrowserWindow.getAllWindows().forEach((win) => {
                    win.webContents.send('open-settings')
                  })
                }
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ] as Electron.MenuItemConstructorOptions[])
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            sendToFocusedWindow('new-tab')
          }
        },
        {
          label: 'New Connection',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            sendToFocusedWindow('new-connection')
          }
        },
        { type: 'separator' },
        {
          label: 'Close Tab or Window',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            sendToFocusedWindow('close-tab-or-window')
          }
        },
        ...(isMac
          ? []
          : ([
              {
                label: 'Quit',
                accelerator: 'CmdOrCtrl+Q',
                role: 'quit'
              }
            ] as Electron.MenuItemConstructorOptions[]))
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? ([
              { type: 'separator' },
              { role: 'front' }
            ] as Electron.MenuItemConstructorOptions[])
          : ([
              {
                label: 'Close Tab or Window',
                accelerator: 'CmdOrCtrl+W',
                click: () => {
                  sendToFocusedWindow('close-tab-or-window')
                }
              }
            ] as Electron.MenuItemConstructorOptions[]))
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
