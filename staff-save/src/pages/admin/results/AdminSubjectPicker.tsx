import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { ClassRow, SubjectRow } from '@/lib/types'

export default function AdminSubjectPicker() {
  const { classId } = useParams<{ classId: string }>()
  const [cls, setCls] = useState<ClassRow | null>(null)
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!classId) return
    Promise.all([
      supabase.from('results_classes').select('*').eq('id', classId).single(),
      supabase.from('results_class_subjects').select('subject_id, subjects:results_subjects(*)').eq('class_id', classId),
    ]).then(([{ data: classRow }, { data: cs }]) => {
      setCls(classRow ?? null)
      setSubjects((cs ?? []).map((r: any) => r.subjects).filter(Boolean).sort((a: SubjectRow, b: SubjectRow) => a.display_order - b.display_order))
      setLoading(false)
    })
  }, [classId])

  if (loading) return <div className="text-sm text-stone-400 py-8 text-center">Loading…</div>

  return (
    <div className="space-y-4">
      <Link to="/admin/results/classes" className="text-xs text-stone-400 hover:text-stone-600">&larr; Back to Classes</Link>
      <div>
        <p className="font-semibold text-stone-800">{cls?.name}{cls?.section ? ` ${cls.section}` : ''} — Gradebook</p>
        <p className="text-xs text-stone-400">{cls?.academic_session} · Choose a subject to enter or review scores.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {subjects.map(s => (
          <Link
            key={s.id}
            to={`/admin/results/entry/${classId}/${s.id}`}
            className="bg-white rounded-xl border border-stone-200/80 p-4 hover:border-brand-300 transition-colors"
          >
            <p className="font-medium text-stone-800 text-sm">{s.name}</p>
          </Link>
        ))}
        {subjects.length === 0 && (
          <div className="col-span-full text-center py-12 text-stone-400 text-sm">
            No subjects assigned to this class yet. <Link to="/admin/results/subjects" className="text-brand-600 hover:underline">Set them up</Link>.
          </div>
        )}
      </div>
    </div>
  )
}
