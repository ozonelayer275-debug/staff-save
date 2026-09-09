import type { ResultStatus } from '@/lib/types'

const STYLES: Record<ResultStatus, string> = {
  draft:     'bg-stone-100 text-stone-500 border-stone-200',
  submitted: 'bg-sky-50 text-sky-700 border-sky-200',
  approved:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  locked:    'bg-violet-50 text-violet-700 border-violet-200',
}

const LABELS: Record<ResultStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  locked: 'Locked',
}

export default function StatusChip({ status }: { status: ResultStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium border bg-white text-stone-400 border-stone-200">
        Not started
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border ${STYLES[status]}`}>
      {status === 'locked' && (
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 1a4 4 0 00-4 4v2H5a1 1 0 00-1 1v9a2 2 0 002 2h8a2 2 0 002-2v-9a1 1 0 00-1-1h-1V5a4 4 0 00-4-4zm2 6V5a2 2 0 10-4 0v2h4z" clipRule="evenodd" />
        </svg>
      )}
      {LABELS[status]}
    </span>
  )
}
