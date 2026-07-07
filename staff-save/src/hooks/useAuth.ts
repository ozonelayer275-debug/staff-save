import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types'

interface AuthState {
  user: User | null
  role: UserRole | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, role: null, loading: true })

  useEffect(() => {
    let mounted = true

    async function resolveRole(user: User | null): Promise<UserRole | null> {
      if (!user) return null

      // Admin/bursar: present in user_roles table
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (roleRow) return 'admin'

      // Everyone else is treated as staff (includes self-registered accounts
      // that haven't been linked to a savings profile yet — the dashboard
      // shows a "pending setup" message in that case)
      return 'staff'
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const role = await resolveRole(session?.user ?? null)
      if (mounted) setState({ user: session?.user ?? null, role, loading: false })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const role = await resolveRole(session?.user ?? null)
      if (mounted) setState({ user: session?.user ?? null, role, loading: false })
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return state
}
