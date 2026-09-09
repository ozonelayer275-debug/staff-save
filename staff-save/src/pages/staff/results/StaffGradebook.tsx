import { useParams, useSearchParams, Link, Navigate } from 'react-router-dom'
import { useResultsAccess } from '@/hooks/useResultsAccess'
import GradebookGrid from '@/components/results/GradebookGrid'
import type { Term } from '@/lib/types'

export default function StaffGradebook() {
  const { classId, subjectId } = useParams<{ classId: string; subjectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { loading, assignments } = useResultsAccess()

  const assignment = assignments.find(a => a.classId === classId)
  const term = (searchParams.get('term') ?? '1') as Term

  if (loading) return <div className="text-sm text-stone-400 py-8 text-center">Loading…</div>
  if (!assignment || !assignment.enabled || !classId || !subjectId) return <Navigate to="/dashboard/results" replace />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link to={`/dashboard/results/entry/${classId}`} className="text-xs text-stone-400 hover:text-stone-600">&larr; Back to Subjects</Link>
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
      <GradebookGrid classId={classId} subjectId={subjectId} term={term} role="staff" />
    </div>
  )
}
