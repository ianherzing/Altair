import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client authenticated with the user's JWT.
 * Used for RPC calls where the function needs auth.jwt() to see
 * the real user (not the service role).
 */
export function createUserClient(jwt: string): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim()
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) {
    throw new Error('Supabase environment variables not configured')
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  })
}
