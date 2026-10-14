export interface CloudEnv {
  supabaseUrl: string
  anonKey: string
  cloudUrl: string
}

const local = (url: string): boolean => /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)

export function cloudEnv(env: ImportMetaEnv = import.meta.env): CloudEnv | null {
  const supabaseUrl = env.MAIN_VITE_SUPABASE_URL?.trim().replace(/\/+$/, '') ?? ''
  const anonKey = env.MAIN_VITE_SUPABASE_ANON_KEY?.trim() ?? ''
  const cloudUrl = env.MAIN_VITE_CLOUD_URL?.trim().replace(/\/+$/, '') ?? ''
  if (!supabaseUrl || !anonKey || !cloudUrl) return null
  if (!supabaseUrl.startsWith('https://')) return null
  if (!cloudUrl.startsWith('https://') && !local(cloudUrl)) return null
  return { supabaseUrl, anonKey, cloudUrl }
}
