import { BrowserWindow, ipcMain } from 'electron'
import type { AccountState } from '@shared/account'
import type { Account } from './account'

export function broadcastAccount(state: AccountState): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('account:changed', state)
}

export function registerAccountIpc(account: Account): void {
  ipcMain.handle('account:state', () => account.current())
  ipcMain.handle('account:google', () => account.signInWithGoogle())
  ipcMain.handle('account:sendCode', (_e, email: string) => account.sendEmailCode(email))
  ipcMain.handle('account:verifyCode', (_e, code: string) => account.verifyEmailCode(code))
  ipcMain.handle('account:cancel', () => account.cancel())
  ipcMain.handle('account:signOut', () => account.signOut())
  ipcMain.handle('account:signOutEverywhere', () => account.signOutEverywhere())
  ipcMain.handle('account:rename', (_e, name: string) => account.rename(name))
  ipcMain.handle('account:devices', () => account.devices())
  ipcMain.handle('account:delete', (_e, confirm: string) => account.deleteAccount(confirm))
}
