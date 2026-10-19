export interface CloudConfig {
  port: number
  supabaseUrl: string
  databaseUrl: string
  serviceRoleKey: string
  publicUrl: string
  mailProvider: string
  resendApiKey: string | null
  mailFrom: string
  downloadUrl: string | null
  s3: {
    endpoint: string
    region: string
    bucket: string
    accessKeyId: string
    secretAccessKey: string
  }
  maxFileBytes: number
  cronSecret: string | null
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): CloudConfig {
  const need = (key: string): string => {
    const value = env[key]?.trim()
    if (!value) throw new Error(`Falta la variable de entorno ${key}.`)
    return value
  }
  const supabaseUrl = need('SUPABASE_URL').replace(/\/+$/, '')
  if (!supabaseUrl.startsWith('https://')) throw new Error('SUPABASE_URL debe usar https.')
  const publicUrl = need('PUBLIC_URL').replace(/\/+$/, '')
  if (!publicUrl.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(publicUrl)) {
    throw new Error('PUBLIC_URL debe usar https.')
  }
  return {
    port: Number(env.PORT ?? 8787),
    supabaseUrl,
    databaseUrl: need('DATABASE_URL'),
    serviceRoleKey: need('SUPABASE_SERVICE_ROLE_KEY'),
    publicUrl,
    mailProvider: env.MAIL_PROVIDER?.trim().toLowerCase() || 'resend',
    resendApiKey: env.RESEND_API_KEY?.trim() || null,
    mailFrom: env.MAIL_FROM?.trim() || 'DayliOS <hola@daylios.app>',
    downloadUrl: env.DOWNLOAD_URL?.trim() || null,
    s3: {
      endpoint: need('S3_ENDPOINT'),
      region: env.S3_REGION?.trim() || 'auto',
      bucket: need('S3_BUCKET'),
      accessKeyId: need('S3_ACCESS_KEY_ID'),
      secretAccessKey: need('S3_SECRET_ACCESS_KEY')
    },
    maxFileBytes: Math.max(1, Number(env.FILE_MAX_MB ?? 200)) * 1024 * 1024,
    cronSecret: env.CRON_SECRET?.trim() || null
  }
}
