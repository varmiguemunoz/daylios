import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'fs'

export interface Cipher {
  isEncryptionAvailable(): boolean
  encryptString(text: string): Buffer
  decryptString(data: Buffer): string
}

export class SecureSessionStorage {
  private values: Record<string, string> = {}

  constructor(
    private readonly file: string,
    private readonly cipher: Cipher
  ) {
    this.values = this.read()
  }

  get persistent(): boolean {
    return this.cipher.isEncryptionAvailable()
  }

  getItem(key: string): string | null {
    return this.values[key] ?? null
  }

  setItem(key: string, value: string): void {
    this.values[key] = value
    this.write()
  }

  removeItem(key: string): void {
    delete this.values[key]
    this.write()
  }

  clear(): void {
    this.values = {}
    if (existsSync(this.file)) rmSync(this.file, { force: true })
  }

  private read(): Record<string, string> {
    if (!this.persistent || !existsSync(this.file)) return {}
    try {
      const parsed: unknown = JSON.parse(this.cipher.decryptString(readFileSync(this.file)))
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
    } catch {
      return {}
    }
  }

  private write(): void {
    if (!this.persistent) return
    if (!Object.keys(this.values).length) return this.clear()
    writeFileSync(this.file, this.cipher.encryptString(JSON.stringify(this.values)), {
      mode: 0o600
    })
    chmodSync(this.file, 0o600)
  }
}
