import { useParams, useSearchParams, Link } from 'react-router-dom'
import GradebookGrid from '@/components/results/GradebookGrid'
import type { Term } from '@/lib/types'

export default function AdminGradebook() {
  const { classId, subjectId } = useParams<{ classId: string; subjectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const term = (searchParams.get('term') ?? '1') as Term

  if (!classId || !subjectId) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link to={`/admin/results/entry/${classId}`} className="text-xs text-stone-400 hover:text-stone-600">&larr; Back to Subjects</Link>
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
      <GradebookGrid classId={classId} subjectId={subjectId} term={term} role="admin" />
    </div>
  )
}
