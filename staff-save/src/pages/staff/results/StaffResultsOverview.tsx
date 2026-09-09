import { Link } from 'react-router-dom'
import { useResultsAccess } from '@/hooks/useResultsAccess'

export default function StaffResultsOverview() {
  const { loading, assignments } = useResultsAccess()

  if (loading) return <div className="text-sm text-stone-400 py-8 text-center">Loading…</div>

  return (
    <div className="space-y-2.5 max-w-2xl mx-auto">
      {assignments.map(a => (
        <div key={a.assignmentId} className="bg-white rounded-xl border border-stone-200/80 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-stone-800 text-sm">{a.className}</p>
            <p className="text-xs text-stone-400 mt-0.5">{a.level.toUpperCase()} · {a.academicSession}</p>
          </div>
          {a.enabled ? (
            <div className="flex items-center gap-2">
              <Link to={`/dashboard/results/roster/${a.classId}`} className="text-sm border border-brand-300 text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 font-medium">
                Roster
              </Link>
              <Link to={`/dashboard/results/entry/${a.classId}`} className="text-sm bg-brand-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-brand-700 font-medium">
                Gradebook
              </Link>
            </div>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-stone-400 bg-stone-100 px-3 py-1.5 rounded-lg">
              <LockIcon className="w-3.5 h-3.5" />
              Access disabled by admin
            </span>
          )}
        </div>
      ))}
      {assignments.length === 0 && (
        <div className="text-center py-12 text-stone-400 text-sm">You have no class assignments yet.</div>
      )}
    </div>
  )
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}
