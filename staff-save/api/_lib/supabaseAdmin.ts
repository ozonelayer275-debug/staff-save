import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/types'

// Service-role client — server-only, bypasses RLS entirely. Never import this
// file (or SUPABASE_SERVICE_ROLE_KEY) into anything that ends up in the
// client bundle; it only runs inside Vercel serverless functions under api/.
let cached: ReturnType<typeof createClient<Database>> | null = null

export function supabaseAdmin() {
  if (cached) return cached

  const url = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  }

  cached = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}
