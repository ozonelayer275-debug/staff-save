import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useResultsAccess } from '@/hooks/useResultsAccess'
import RosterTable from '@/components/results/RosterTable'
import type { ClassRow } from '@/lib/types'

export default function StaffRoster() {
  const { classId } = useParams<{ classId: string }>()
  const { loading, assignments } = useResultsAccess()
  const [allClasses, setAllClasses] = useState<ClassRow[]>([])

  useEffect(() => {
    // classes is readable by any authenticated user (needed here so a teacher can
    // promote a student into a class they don't personally teach, e.g. JSS1 -> JSS2)
    supabase.from('results_classes').select('*').order('academic_session', { ascending: false }).order('name')
      .then(({ data }) => setAllClasses(data ?? []))
  }, [])

  if (loading) return <div className="text-sm text-stone-400 py-8 text-center">Loading…</div>

  const assignment = assignments.find(a => a.classId === classId)
  // Staff can only manage the roster of a class they're currently assigned to
  // with results access enabled — anything else (unassigned, or disabled) bounces back.
  if (!assignment || !assignment.enabled) return <Navigate to="/dashboard/results" replace />

  return (
    <div className="space-y-4">
      <Link to="/dashboard/results" className="text-xs text-stone-400 hover:text-stone-600">&larr; Back</Link>
      <RosterTable classId={assignment.classId} allClasses={allClasses} canDelete={false} basePath="/dashboard/results" />
    </div>
  )
}
