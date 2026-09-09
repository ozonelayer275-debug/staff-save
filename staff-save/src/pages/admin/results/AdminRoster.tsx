import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { ClassRow } from '@/lib/types'
import RosterTable from '@/components/results/RosterTable'

export default function AdminRoster() {
  const { classId } = useParams<{ classId: string }>()
  const [classes, setClasses] = useState<ClassRow[]>([])

  useEffect(() => {
    supabase.from('results_classes').select('*').order('academic_session', { ascending: false }).order('name')
      .then(({ data }) => setClasses(data ?? []))
  }, [])

  if (!classId) return null

  return (
    <div className="space-y-4">
      <Link to="/admin/results/classes" className="text-xs text-stone-400 hover:text-stone-600">&larr; Back to Classes</Link>
      <RosterTable classId={classId} allClasses={classes} canDelete basePath="/admin/results" />
    </div>
  )
}
