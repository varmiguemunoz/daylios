import { describe, expect, it } from 'vitest'
import { PART_SIZE, conflictName, isIgnoredPath } from '../shared/files'
import { ManageFiles } from '../../services/cloud/src/application/files'
import type { MembershipRepository } from '../../services/cloud/src/ports'
import { MemoryBlobs, MemoryObjectStorage, ORG, member } from './support/memory-cloud'

const user = { userId: 'u1', email: 'a@acme.com' }
const HASH = 'a'.repeat(64)

const viewer: MembershipRepository = {
  find: async () => ({
    org: { id: ORG, name: 'Acme', plan: 'trial', maxMembers: 5 },
    membership: { orgId: ORG, userId: 'u1', role: 'viewer', status: 'active' }
  })
}

describe('archivos: reglas del cliente', () => {
  it('ignora sistema, temporales y grabaciones salvo que se activen', () => {
    expect(isIgnoredPath('.DS_Store', false)).toBe(true)
    expect(isIgnoredPath('Clientes/.git/HEAD', false)).toBe(true)
    expect(isIgnoredPath('Clientes/~$propuesta.docx', false)).toBe(true)
    expect(isIgnoredPath('_reuniones/2026-10-14.webm', false)).toBe(true)
    expect(isIgnoredPath('_reuniones/2026-10-14.webm', true)).toBe(false)
    expect(isIgnoredPath('Workspace/Nota.md', false)).toBe(false)
  })

  it('la copia de conflicto conserva carpeta y extensión', () => {
    const name = conflictName('Workspace/Ideas/Plan.md', 'Ana', new Date('2026-10-13T12:00:00'))
    expect(name.startsWith('Workspace/Ideas/Plan (conflicto de Ana, ')).toBe(true)
    expect(name.endsWith(').md')).toBe(true)
  })
})

describe('archivos: servidor', () => {
  const service = (m: MembershipRepository = member, max = 200 * 1024 * 1024): ManageFiles =>
    new ManageFiles(new MemoryObjectStorage(), new MemoryBlobs(), m, max)

  it('pequeño va en una subida; grande, por partes de 8 MB', async () => {
    const files = service()
    expect((await files.requestUpload(user, ORG, { hash: HASH, size: 1000 })).mode).toBe('single')
    const plan = await files.requestUpload(user, ORG, {
      hash: 'b'.repeat(64),
      size: 80 * 1024 * 1024
    })
    expect(plan.mode).toBe('multipart')
    if (plan.mode === 'multipart')
      expect(plan.parts).toHaveLength(Math.ceil((80 * 1024 * 1024) / PART_SIZE))
  })

  it('no sube dos veces el mismo contenido', async () => {
    const storage = new MemoryObjectStorage()
    const blobs = new MemoryBlobs()
    const files = new ManageFiles(storage, blobs, member, 1024 ** 3)
    await blobs.add(user, ORG, HASH, 10)
    expect((await files.requestUpload(user, ORG, { hash: HASH, size: 10 })).mode).toBe('exists')
  })

  it('rechaza archivos más grandes que el máximo y hashes rotos', async () => {
    const files = service(member, 1024)
    await expect(files.requestUpload(user, ORG, { hash: HASH, size: 2048 })).rejects.toThrow(
      /máximo/
    )
    await expect(files.requestUpload(user, ORG, { hash: 'nada', size: 1 })).rejects.toThrow(/Hash/)
  })

  it('confirmar exige que el objeto llegó completo', async () => {
    const files = service()
    await expect(files.completeUpload(user, ORG, { hash: HASH, size: 10 })).rejects.toThrow(
      /completo/
    )
  })

  it('un lector descarga pero no sube', async () => {
    const files = service(viewer)
    await expect(files.requestUpload(user, ORG, { hash: HASH, size: 1 })).rejects.toThrow(/lectura/)
    await expect(files.download(user, ORG, HASH)).rejects.toThrow(/no está/)
  })
})
