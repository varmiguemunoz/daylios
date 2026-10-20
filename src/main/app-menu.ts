import { BrowserWindow, Menu, Notification, app } from 'electron'
import { APP_NAME } from '@shared/app'

const hideAll = (): void => BrowserWindow.getAllWindows().forEach((w) => w.hide())

export function quitWithNotice(): void {
  if (Notification.isSupported())
    new Notification({
      title: APP_NAME,
      body: `Cerraste ${APP_NAME}. Claude no podrá usarla hasta que la vuelvas a abrir.`
    }).show()
  app.quit()
}

export function installMacMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: APP_NAME,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { label: 'Ocultar ventanas', accelerator: 'CmdOrCtrl+Q', click: hideAll },
          { label: `Salir de ${APP_NAME}`, accelerator: 'CmdOrCtrl+Alt+Q', click: quitWithNotice }
        ]
      },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      {
        label: 'Ventana',
        submenu: [
          { role: 'minimize' },
          { label: 'Cerrar ventana', accelerator: 'CmdOrCtrl+W', click: hideAll }
        ]
      }
    ])
  )
}
