import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAdmin } from './_lib/verifyAdmin.js'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import { mintPrintToken } from './_lib/printToken.js'
import { launchChromium } from './_lib/chromium.js'

export const config = { maxDuration: 30 }

// Single-student PDF export, admin-only. Navigates headless Chrome to this
// app's own /print/report-card route (same deployed bundle a human would
// visually compare against) rather than server-rendering a parallel HTML
// string — guarantees pixel parity with the on-screen preview by construction.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const adminUserId = await verifyAdmin(req.headers.authorization)
  if (!adminUserId) return res.status(403).json({ error: 'Admin access required' })

  const { studentId, academicSession, term } = req.body ?? {}
  if (!studentId || !academicSession || !term) {
    return res.status(400).json({ error: 'Missing studentId, academicSession, or term' })
  }

  const admin = supabaseAdmin()

  const { data: reportCard } = await admin
    .from('results_report_cards').select('status')
    .eq('student_id', studentId).eq('academic_session', academicSession).eq('term', term)
    .maybeSingle()

  if (!reportCard || !['approved', 'locked'].includes(reportCard.status)) {
    return res.status(403).json({ error: 'Only approved or locked report cards can be exported' })
  }

  const { data: student } = await admin
    .from('results_students').select('first_name, last_name, reg_no_or_bece_no')
    .eq('id', studentId).single()
  if (!student) return res.status(404).json({ error: 'Student not found' })

  const token = mintPrintToken(studentId, academicSession, term)
  const proto = (req.headers['x-forwarded-proto'] as string) ?? 'https'
  const host = req.headers.host
  const printUrl = `${proto}://${host}/print/report-card/${studentId}/${encodeURIComponent(academicSession)}/${term}?token=${encodeURIComponent(token)}`

  const browser = await launchChromium()
  try {
    const page = await browser.newPage()
    await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 25000 })
    const pdf = await page.pdf({ format: 'A4', printBackground: true })

    const filename = `Report_Card_${student.reg_no_or_bece_no}_${student.first_name}_${student.last_name}.pdf`.replace(/\s+/g, '_')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(Buffer.from(pdf))
  } finally {
    await browser.close()
  }
}
