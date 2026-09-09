import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { ClassRow, Term } from '@/lib/types'

export default function AdminBatchExport() {
  const { classId } = useParams<{ classId: string }>()
  const [cls, setCls] = useState<ClassRow | null>(null)
  const [term, setTerm] = useState<Term>('1')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readyCount, setReadyCount] = useState<number | null>(null)

  useEffect(() => {
    if (!classId) return
    supabase.from('results_classes').select('*').eq('id', classId).single().then(({ data }) => setCls(data ?? null))
  }, [classId])

  useEffect(() => {
    if (!classId || !cls) return
    supabase
      .from('results_report_cards').select('id', { count: 'exact', head: true })
      .eq('class_id', classId).eq('academic_session', cls.academic_session).eq('term', term)
      .in('status', ['approved', 'locked'])
      .then(({ count }) => setReadyCount(count ?? 0))
  }, [classId, cls, term])

  async function handleExport() {
    if (!classId || !cls) return
    setExporting(true)
    setError(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) { setError('Not authenticated.'); setExporting(false); return }

    const res = await fetch('/api/batch-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ classId, academicSession: cls.academic_session, term }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? `Export failed (${res.status})`)
      setExporting(false)
      return
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition') ?? ''
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'Report_Cards.pdf'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  if (!cls) return null

  return (
    <div className="space-y-4">
      <Link to="/admin/results/classes" className="text-xs text-stone-400 hover:text-stone-600">&larr; Back to Classes</Link>

      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 max-w-md space-y-4">
        <div>
          <p className="font-semibold text-stone-800">{cls.name}{cls.section ? ` ${cls.section}` : ''}</p>
          <p className="text-xs text-stone-400">{cls.academic_session} · Merged multi-page report card export</p>
        </div>

        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1 w-fit">
          {(['1', '2', '3'] as Term[]).map(t => (
            <button
              key={t}
              onClick={() => setTerm(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                term === t ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Term {t}
            </button>
          ))}
        </div>

        <p className="text-sm text-stone-500">
          {readyCount == null ? 'Checking…' : readyCount === 0
            ? 'No approved or locked report cards for this term yet — nothing to export.'
            : `${readyCount} approved/locked report card${readyCount === 1 ? '' : 's'} ready to export.`}
        </p>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleExport}
          disabled={exporting || !readyCount}
          className="w-full bg-stone-800 text-white text-sm py-2.5 rounded-lg hover:bg-stone-900 disabled:opacity-40 transition-colors"
        >
          {exporting ? 'Generating PDF…' : 'Export Merged PDF'}
        </button>
      </div>
    </div>
  )
}
