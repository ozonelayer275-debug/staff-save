import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import ReportCardFacsimile from '@/components/results/ReportCardFacsimile'
import type { ReportCardData } from '@/components/results/reportCardTypes'

// Chrome-less route: this is the exact navigation target Puppeteer hits to
// generate the PDF (api/report-card.ts), so it deliberately renders nothing
// but the facsimile — no header/nav/sidebar, no Supabase client, no auth
// session. Data comes from api/print-data.ts via a short-lived signed token,
// not a logged-in session (Puppeteer carries no cookies/localStorage).
export default function PrintReportCard() {
  const { studentId, session, term } = useParams<{ studentId: string; session: string; term: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [data, setData] = useState<ReportCardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!studentId || !session || !term || !token) { setError('Missing parameters'); return }
    fetch(`/api/print-data?studentId=${studentId}&session=${encodeURIComponent(session)}&term=${term}&token=${encodeURIComponent(token)}`)
      .then(async res => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`)
        return res.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
  }, [studentId, session, term, token])

  if (error) return <div style={{ padding: 24, fontFamily: 'monospace', color: '#b91c1c' }}>Error: {error}</div>
  if (!data) return <div style={{ padding: 24, fontFamily: 'system-ui' }}>Loading…</div>

  return <ReportCardFacsimile data={data} />
}
