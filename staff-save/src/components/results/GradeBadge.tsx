function colorFor(meaning: string) {
  const m = meaning.toLowerCase()
  if (m.includes('excellent') || m.includes('very good') || m.includes('good')) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (m.includes('credit') || m.includes('pass')) return 'bg-sky-50 text-sky-700 border-sky-200'
  return 'bg-rose-50 text-rose-700 border-rose-200' // Poor / Fail
}

export default function GradeBadge({ grade, meaning }: { grade: string; meaning?: string }) {
  return (
    <span
      title={meaning}
      className={`inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-md text-xs font-bold border ${colorFor(meaning ?? '')}`}
    >
      {grade}
    </span>
  )
}
