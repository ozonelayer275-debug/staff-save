import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from './_lib/supabaseAdmin'
import { verifyPrintToken } from './_lib/printToken'
import { buildReportCardData } from '../src/lib/buildReportCardData'
import type { Term } from '../src/lib/types'

// Token-verified JSON feed for the chrome-less /print route. Deliberately
// decoupled from Supabase auth entirely — PrintReportCard.tsx never
// instantiates a Supabase client, it just fetches this endpoint. This is the
// one deliberate server-side trust boundary: a valid short-lived signed
// token (minted only by api/report-card.ts after an admin check) stands in
// for a real session, since Puppeteer carries no cookies/localStorage.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { studentId, session, term, token } = req.query
  if (typeof studentId !== 'string' || typeof session !== 'string' || typeof term !== 'string' || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing studentId, session, term, or token' })
  }

  if (!verifyPrintToken(token, studentId, session, term)) {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }

  const data = await buildReportCardData(studentId, session, term as Term, supabaseAdmin())
  if (!data) return res.status(404).json({ error: 'Report card data not found' })

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json(data)
}
