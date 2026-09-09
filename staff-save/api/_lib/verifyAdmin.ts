import { supabaseAdmin } from './supabaseAdmin'

// Verifies the caller's Supabase JWT and checks user_roles server-side via the
// service-role client — never trust a client-claimed role for a privileged
// export endpoint. Returns the authenticated user id if they're admin/bursar,
// or null otherwise.
export async function verifyAdmin(authHeader: string | undefined | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const jwt = authHeader.slice('Bearer '.length)

  const admin = supabaseAdmin()
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData.user) return null

  const { data: roleRow } = await admin
    .from('user_roles').select('role').eq('user_id', userData.user.id).maybeSingle()

  return roleRow ? userData.user.id : null
}
