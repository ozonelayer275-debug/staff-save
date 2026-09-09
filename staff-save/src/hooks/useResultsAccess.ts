import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { ClassRow } from '@/lib/types'

export interface ResultsAssignment {
  assignmentId: string
  classId: string
  className: string
  level: ClassRow['level']
  academicSession: string
  enabled: boolean
}

interface ResultsAccessState {
  loading: boolean
  assignments: ResultsAssignment[]
  hasAnyAssignment: boolean
  hasAnyEnabled: boolean
}

export function useResultsAccess(): ResultsAccessState {
  const auth = useAuth()
  const [state, setState] = useState<ResultsAccessState>({
    loading: true, assignments: [], hasAnyAssignment: false, hasAnyEnabled: false,
  })

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!auth.user || auth.role === 'admin') {
        if (mounted) setState({ loading: false, assignments: [], hasAnyAssignment: false, hasAnyEnabled: false })
        return
      }

      const { data: staffRow } = await supabase
        .from('staff').select('id').eq('auth_user_id', auth.user.id).maybeSingle()

      if (!staffRow) {
        if (mounted) setState({ loading: false, assignments: [], hasAnyAssignment: false, hasAnyEnabled: false })
        return
      }

      const { data } = await supabase
        .from('results_class_assignments')
        .select('id, class_id, academic_session, results_access_enabled, classes:results_classes(name, level)')
        .eq('staff_id', staffRow.id)

      const assignments: ResultsAssignment[] = (data ?? []).map((row: any) => ({
        assignmentId: row.id,
        classId: row.class_id,
        className: row.classes?.name ?? '—',
        level: row.classes?.level ?? 'jss',
        academicSession: row.academic_session,
        enabled: row.results_access_enabled,
      }))

      if (mounted) {
        setState({
          loading: false,
          assignments,
          hasAnyAssignment: assignments.length > 0,
          hasAnyEnabled: assignments.some(a => a.enabled),
        })
      }
    }

    if (!auth.loading) load()
  }, [auth.loading, auth.user, auth.role])

  return state
}
