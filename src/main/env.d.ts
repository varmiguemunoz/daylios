interface ImportMetaEnv {
  readonly MAIN_VITE_SUPABASE_URL?: string
  readonly MAIN_VITE_SUPABASE_ANON_KEY?: string
  readonly MAIN_VITE_CLOUD_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
