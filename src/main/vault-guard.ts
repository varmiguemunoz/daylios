export function fromApp(request: Request, devUrl?: string): boolean {
  const source = request.headers.get('origin') ?? request.referrer
  if (!source || source === 'about:client' || source === 'null') return true
  try {
    const url = new URL(source)
    if (url.protocol === 'file:' || url.protocol === 'vault:') return true
    return Boolean(devUrl && url.origin === new URL(devUrl).origin)
  } catch {
    return false
  }
}
