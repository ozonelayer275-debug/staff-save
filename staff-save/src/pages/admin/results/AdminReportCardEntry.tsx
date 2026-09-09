import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import ReportCardEntryForm from '@/components/results/ReportCardEntryForm'
import AdminStudentSubjectScores from '@/components/results/AdminStudentSubjectScores'
import type { ClassRow, Term } from '@/lib/types'

export default function AdminReportCardEntry() {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cls, setCls] = useState<ClassRow | null>(null)
  const term = (searchParams.get('term') ?? '1') as Term

  useEffect(() => {
    if (!classId) return
    supabase.from('results_classes').select('*').eq('id', classId).single().then(({ data }) => setCls(data ?? null))
  }, [classId])

  if (!classId || !studentId || !cls) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link to={`/admin/results/roster/${classId}`} className="text-xs text-stone-400 hover:text-stone-600">&larr; Back to Roster</Link>
        <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-1">
          {(['1', '2', '3'] as Term[]).map(t => (
            <button
              key={t}
              onClick={() => setSearchParams({ term: t })}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                term === t ? 'bg-brand-600 text-white' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Term {t}
            </button>
          ))}
        </div>
      </div>
      <AdminStudentSubjectScores studentId={studentId} classId={classId} academicSession={cls.academic_session} term={term} />
      <div className="border-t border-stone-200 pt-4">
        <ReportCardEntryForm studentId={studentId} classId={classId} academicSession={cls.academic_session} term={term} role="admin" />
      </div>
    </div>
  )
}
