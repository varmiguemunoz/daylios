import type { Pool, PoolClient } from 'pg'
import type { AuthUser } from '../../ports'

/**
 * Ejecuta `work` con el rol `authenticated` y los datos del usuario, como hace Supabase con sus
 * propias peticiones. Así `auth.uid()` funciona y la RLS es una segunda barrera también para el
 * microservicio (ADR-07).
 */
export async function asUser<T>(
  pool: Pool,
  user: AuthUser,
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SET LOCAL ROLE authenticated')
    await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: user.userId, email: user.email, role: 'authenticated' })
    ])
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}
