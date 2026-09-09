import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PDFDocument } from 'pdf-lib'
import { verifyAdmin } from './_lib/verifyAdmin'
import { supabaseAdmin } from './_lib/supabaseAdmin'
import { mintPrintToken } from './_lib/printToken'
import { launchChromium } from './_lib/chromium'

export const config = { maxDuration: 60 }

// Merged multi-page PDF for a whole class — one file, one report card per
// student (confirmed decision: not a zip of individual files). Only
// approved/locked report cards are included; admin-only, server-verified.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const adminUserId = await verifyAdmin(req.headers.authorization)
  if (!adminUserId) return res.status(403).json({ error: 'Admin access required' })

  const { classId, academicSession, term } = req.body ?? {}
  if (!classId || !academicSession || !term) {
    return res.status(400).json({ error: 'Missing classId, academicSession, or term' })
  }

  const admin = supabaseAdmin()

  const { data: cls } = await admin.from('results_classes').select('name, section').eq('id', classId).single()
  if (!cls) return res.status(404).json({ error: 'Class not found' })

  const { data: reportCards } = await admin
    .from('results_report_cards').select('student_id, status')
    .eq('class_id', classId).eq('academic_session', academicSession).eq('term', term)
    .in('status', ['approved', 'locked'])

  if (!reportCards || reportCards.length === 0) {
    return res.status(404).json({ error: 'No approved or locked report cards found for this class/term' })
  }

  const proto = (req.headers['x-forwarded-proto'] as string) ?? 'https'
  const host = req.headers.host

  const browser = await launchChromium()
  try {
    const merged = await PDFDocument.create()

    for (const rc of reportCards) {
      const token = mintPrintToken(rc.student_id, academicSession, term)
      const printUrl = `${proto}://${host}/print/report-card/${rc.student_id}/${encodeURIComponent(academicSession)}/${term}?token=${encodeURIComponent(token)}`

      const page = await browser.newPage()
      await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 25000 })
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
      await page.close()

      const src = await PDFDocument.load(pdfBuffer)
      const copiedPages = await merged.copyPages(src, src.getPageIndices())
      copiedPages.forEach(p => merged.addPage(p))
    }

    const mergedBytes = await merged.save()
    const className = `${cls.name}${cls.section ? `_${cls.section}` : ''}`.replace(/\s+/g, '_')
    const filename = `Report_Cards_${className}_${academicSession.replace(/\//g, '-')}_Term${term}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(Buffer.from(mergedBytes))
  } finally {
    await browser.close()
  }
}
