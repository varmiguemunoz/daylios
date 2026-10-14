import { BrowserWindow, ipcMain } from 'electron'
import type { InviteInput, OrgsState, Role } from '@shared/organizations'
import type { Organizations } from './organizations'

export function broadcastOrgs(state: OrgsState): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('orgs:changed', state)
}

export function registerOrgsIpc(orgs: Organizations): void {
  ipcMain.handle('orgs:state', () => orgs.state())
  ipcMain.handle('orgs:refresh', () => orgs.refresh())
  ipcMain.handle('orgs:create', (_e, name: string, bringLocal?: boolean) =>
    orgs.create(name, bringLocal === true)
  )
  ipcMain.handle('orgs:switch', (_e, orgId: string | null) => orgs.switchTo(orgId))
  ipcMain.handle('orgs:detail', () => orgs.detail())
  ipcMain.handle('orgs:rename', (_e, name: string) => orgs.rename(name))
  ipcMain.handle('orgs:remove', (_e, confirm: string) => orgs.remove(confirm))
  ipcMain.handle('orgs:transfer', (_e, userId: string) => orgs.transfer(userId))
  ipcMain.handle('orgs:invite', (_e, input: InviteInput) => orgs.invite(input))
  ipcMain.handle('orgs:resend', (_e, id: string) => orgs.resendInvite(id))
  ipcMain.handle('orgs:revoke', (_e, id: string) => orgs.revokeInvite(id))
  ipcMain.handle('orgs:role', (_e, userId: string, role: Role) => orgs.changeRole(userId, role))
  ipcMain.handle('orgs:removeMember', (_e, userId: string) => orgs.removeMember(userId))
  ipcMain.handle('orgs:leave', () => orgs.leave())
  ipcMain.handle('orgs:members', () => orgs.members())
  ipcMain.handle('orgs:authorship', (_e, table: string, id: string) => orgs.authorship(table, id))
}
