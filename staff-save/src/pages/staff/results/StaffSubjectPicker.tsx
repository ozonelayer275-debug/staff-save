import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useResultsAccess } from '@/hooks/useResultsAccess'
import type { SubjectRow } from '@/lib/types'

export default function StaffSubjectPicker() {
  const { classId } = useParams<{ classId: string }>()
  const { loading, assignments } = useResultsAccess()
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [subjectsLoading, setSubjectsLoading] = useState(true)

  const assignment = assignments.find(a => a.classId === classId)

  useEffect(() => {
    if (!classId) return
    supabase
      .from('results_class_subjects').select('subject_id, subjects:results_subjects(*)').eq('class_id', classId)
      .then(({ data }) => {
        setSubjects((data ?? []).map((r: any) => r.subjects).filter(Boolean).sort((a: SubjectRow, b: SubjectRow) => a.display_order - b.display_order))
        setSubjectsLoading(false)
      })
  }, [classId])

  if (loading) return <div className="text-sm text-stone-400 py-8 text-center">Loading…</div>
  if (!assignment || !assignment.enabled) return <Navigate to="/dashboard/results" replace />

  return (
    <div className="space-y-4">
      <Link to="/dashboard/results" className="text-xs text-stone-400 hover:text-stone-600">&larr; Back</Link>
      <div>
        <p className="font-semibold text-stone-800">{assignment.className} — Gradebook</p>
        <p className="text-xs text-stone-400">Choose a subject to enter scores.</p>
      </div>
      {subjectsLoading ? (
        <div className="text-sm text-stone-400 py-8 text-center">Loading subjects…</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {subjects.map(s => (
            <Link
              key={s.id}
              to={`/dashboard/results/entry/${classId}/${s.id}`}
              className="bg-white rounded-xl border border-stone-200/80 p-4 hover:border-brand-300 transition-colors"
            >
              <p className="font-medium text-stone-800 text-sm">{s.name}</p>
            </Link>
          ))}
          {subjects.length === 0 && (
            <div className="col-span-full text-center py-12 text-stone-400 text-sm">No subjects assigned to this class yet — ask admin to set them up.</div>
          )}
        </div>
      )}
    </div>
  )
}
