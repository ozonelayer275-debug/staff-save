import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buildReportCardData } from '@/lib/buildReportCardData'
import type { ReportCardData } from './reportCardTypes'
import type { ReportCardRow, Term } from '@/lib/types'
import { AFFECTIVE_TRAITS_MAIN, AFFECTIVE_TRAITS_SECONDARY, PSYCHOMOTOR_SKILLS } from './reportCardConstants'
import ReportCardFacsimile from './ReportCardFacsimile'
import StatusChip from './StatusChip'

export default function ReportCardEntryForm({ studentId, classId, academicSession, term, role }: {
  studentId: string; classId: string; academicSession: string; term: Term; role: 'staff' | 'admin'
}) {
  const [existing, setExisting] = useState<ReportCardRow | null>(null)
  const [preview, setPreview] = useState<ReportCardData | null>(null)
  const [attendance, setAttendance] = useState({ opened: '0', present: '0', absent: '0' })
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [psychomotor, setPsychomotor] = useState<Record<string, number>>({})
  const [reports, setReports] = useState({ adviser: '', formMaster: '', principal: '' })
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const staffIdRef = useRef<string | null>(null)
  const hasLoadedOnceRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const formRef = useRef({ attendance, ratings, psychomotor, reports })
  useEffect(() => { formRef.current = { attendance, ratings, psychomotor, reports } }, [attendance, ratings, psychomotor, reports])

  useEffect(() => { load() }, [studentId, academicSession, term])
  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])

  // Only the very first load shows the full-page "Loading…" state — reloads
  // triggered by save/submit/approve/etc keep the form visible so a save
  // doesn't look like it silently wiped the screen while it refetches.
  async function load() {
    if (!hasLoadedOnceRef.current) setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      const { data: staffRow } = await supabase.from('staff').select('id').eq('auth_user_id', userData.user.id).maybeSingle()
      staffIdRef.current = staffRow?.id ?? null
    }

    const { data: rc } = await supabase
      .from('results_report_cards').select('*')
      .eq('student_id', studentId).eq('academic_session', academicSession).eq('term', term).maybeSingle()

    setExisting(rc)
    setAttendance({
      opened: String(rc?.attendance_opened ?? 0),
      present: String(rc?.attendance_present ?? 0),
      absent: String(rc?.attendance_absent ?? 0),
    })
    setRatings((rc?.affective_traits as Record<string, number>) ?? {})
    setPsychomotor((rc?.psychomotor_skills as Record<string, number>) ?? {})
    setReports({
      adviser: rc?.adviser_report ?? '',
      formMaster: rc?.form_master_report ?? '',
      principal: rc?.principal_report ?? '',
    })

    const data = await buildReportCardData(studentId, academicSession, term, supabase)
    setPreview(data)
    setLoading(false)
    hasLoadedOnceRef.current = true
  }

  const editable = role === 'admin' ? existing?.status !== 'locked' : (!existing || existing.status === 'draft')

  // Auto-save: any change to attendance/traits/psychomotor/reports schedules
  // a single debounced save (900ms after the last change) for the whole
  // form — there's no manual Save button. Reads from formRef (kept in sync
  // via effect) rather than closing over the state directly, since the
  // debounce timer's callback would otherwise capture a stale snapshot from
  // whenever it was (re)scheduled and drop the very last keystroke.
  function scheduleAutoSave() {
    if (!editable) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(performSave, 900)
  }

  async function performSave() {
    saveTimerRef.current = null
    const staffId = staffIdRef.current
    const { attendance: a, ratings: r, psychomotor: p, reports: rep } = formRef.current

    setSaveStatus('saving')
    setError(null)

    const payload = {
      attendance_opened: Number(a.opened) || 0,
      attendance_present: Number(a.present) || 0,
      attendance_absent: Number(a.absent) || 0,
      affective_traits: r,
      psychomotor_skills: p,
      adviser_report: rep.adviser || null,
      form_master_report: rep.formMaster || null,
      principal_report: rep.principal || null,
    }

    const result = existing
      ? await supabase.from('results_report_cards').update(payload).eq('id', existing.id).select().single()
      : await supabase.from('results_report_cards').insert({
          student_id: studentId, class_id: classId, academic_session: academicSession, term,
          status: 'draft', entered_by: staffId, ...payload,
        }).select().single()

    if (result.error) { setError(result.error.message); setSaveStatus('error'); return }

    setExisting(result.data)
    const data = await buildReportCardData(studentId, academicSession, term, supabase)
    setPreview(data)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus(undefined), 2000)
  }

  // Submit deliberately stays a manual action. Flush any pending debounced
  // save first so a very-last-second edit isn't left unsaved.
  async function handleSubmit() {
    if (!existing) return
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); await performSave() }
    await supabase.from('results_report_cards').update({ status: 'submitted' }).eq('id', existing.id)
    load()
  }

  async function handleApprove() {
    if (!existing) return
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('results_report_cards').update({
      status: 'approved', approved_by: userData.user?.id, approved_at: new Date().toISOString(),
    }).eq('id', existing.id)
    load()
  }

  async function handleReject() {
    if (!existing) return
    const note = prompt('Note for the staff member (recorded in edit history):') ?? ''
    await supabase.from('results_report_cards').update({
      status: 'draft',
      edit_history: [...(existing.edit_history ?? []), { action: 'reject', at: new Date().toISOString(), note }],
    }).eq('id', existing.id)
    load()
  }

  async function handleLock() {
    if (!existing) return
    await supabase.from('results_report_cards').update({ status: 'locked' }).eq('id', existing.id)
    load()
  }

  async function handleUnlock() {
    if (!existing) return
    const reason = prompt('Reason for unlocking (recorded in edit history):') ?? ''
    const { error: err } = await supabase.rpc('results_unlock_report_card', { p_id: existing.id, p_reason: reason })
    if (err) { alert(err.message); return }
    load()
  }

  const [exporting, setExporting] = useState(false)

  async function handleExportPdf() {
    setExporting(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) { alert('Not authenticated.'); setExporting(false); return }

    const res = await fetch('/api/report-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ studentId, academicSession, term }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? `Export failed (${res.status})`)
      setExporting(false)
      return
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition') ?? ''
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'Report_Card.pdf'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  if (loading) return <div className="text-sm text-stone-400 py-8 text-center">Loading…</div>

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-stone-800">Report Card Details</p>
          <div className="flex items-center gap-1.5">
            <AutoSaveIndicator status={saveStatus} />
            <StatusChip status={existing?.status ?? null} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200/80 p-4 space-y-3">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Attendance</p>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="Days Opened" value={attendance.opened} onChange={v => { setAttendance(a => ({ ...a, opened: v })); scheduleAutoSave() }} disabled={!editable} />
            <NumField label="Days Present" value={attendance.present} onChange={v => { setAttendance(a => ({ ...a, present: v })); scheduleAutoSave() }} disabled={!editable} />
            <NumField label="Days Absent" value={attendance.absent} onChange={v => { setAttendance(a => ({ ...a, absent: v })); scheduleAutoSave() }} disabled={!editable} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200/80 p-4 space-y-2">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Affective Traits</p>
          {[...AFFECTIVE_TRAITS_MAIN, ...AFFECTIVE_TRAITS_SECONDARY].map(trait => (
            <RatingRow key={trait} label={trait} max={5} value={ratings[trait]} disabled={!editable}
              onChange={v => { setRatings(r => ({ ...r, [trait]: v })); scheduleAutoSave() }}
              onClear={() => { setRatings(r => { const { [trait]: _omit, ...rest } = r; return rest }); scheduleAutoSave() }} />
          ))}
        </div>

        <div className="bg-white rounded-xl border border-stone-200/80 p-4 space-y-2">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Psychomotor Skills</p>
          {PSYCHOMOTOR_SKILLS.map(skill => (
            <RatingRow key={skill} label={skill} max={5} value={psychomotor[skill]} disabled={!editable}
              onChange={v => { setPsychomotor(p => ({ ...p, [skill]: v })); scheduleAutoSave() }}
              onClear={() => { setPsychomotor(p => { const { [skill]: _omit, ...rest } = p; return rest }); scheduleAutoSave() }} />
          ))}
        </div>

        <div className="bg-white rounded-xl border border-stone-200/80 p-4 space-y-3">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Reports</p>
          <TextField label="Academic adviser's report" value={reports.adviser} onChange={v => { setReports(r => ({ ...r, adviser: v })); scheduleAutoSave() }} disabled={!editable} />
          <TextField label="Form master's report" value={reports.formMaster} onChange={v => { setReports(r => ({ ...r, formMaster: v })); scheduleAutoSave() }} disabled={!editable} />
          <TextField label="Principal's report" value={reports.principal} onChange={v => { setReports(r => ({ ...r, principal: v })); scheduleAutoSave() }} disabled={!editable} />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex items-center gap-2 flex-wrap">
          {role === 'staff' && existing?.status === 'draft' && (
            <button onClick={handleSubmit} className="bg-brand-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-brand-700">
              Submit for Review
            </button>
          )}
          {role === 'admin' && existing?.status === 'submitted' && (
            <>
              <button onClick={handleApprove} className="bg-emerald-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-emerald-700">Approve</button>
              <button onClick={handleReject} className="border border-stone-300 text-stone-600 text-sm px-5 py-2.5 rounded-lg hover:bg-stone-50">Reject</button>
            </>
          )}
          {role === 'admin' && existing?.status === 'approved' && (
            <button onClick={handleLock} className="border border-stone-300 text-stone-600 text-sm px-5 py-2.5 rounded-lg hover:bg-stone-50">Lock</button>
          )}
          {role === 'admin' && existing?.status === 'locked' && (
            <button onClick={handleUnlock} className="border border-amber-300 text-amber-700 text-sm px-5 py-2.5 rounded-lg hover:bg-amber-50">Unlock</button>
          )}
          {/* Staff never gets an export/print/download button anywhere, even for their own approved results — view-only on screen. */}
          {role === 'admin' && (existing?.status === 'approved' || existing?.status === 'locked') && (
            <button onClick={handleExportPdf} disabled={exporting} className="ml-auto bg-stone-800 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-stone-900 disabled:opacity-60">
              {exporting ? 'Exporting…' : 'Export PDF'}
            </button>
          )}
        </div>
      </div>

      {/* Live on-screen facsimile — the exact component reused for PDF export.
          Uses CSS zoom (not transform: scale) so the element's layout box
          actually shrinks with it — it fits the available column width at
          every breakpoint instead of always reserving the full 210mm and
          forcing a horizontal scrollbar on narrow screens. */}
      <div>
        <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-stone-500">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Live preview — read-only. Enter details on the left; this updates automatically.
        </div>
        <div className="bg-stone-100 rounded-xl border border-stone-200/80 p-4 overflow-auto max-h-[80vh]">
        {preview ? (
          <div className="zoom-[0.35] sm:zoom-[0.5] lg:zoom-[0.62]">
            <ReportCardFacsimile data={preview} />
          </div>
        ) : (
          <p className="text-sm text-stone-400 text-center py-12">No data yet — enter subject scores first.</p>
        )}
        </div>
      </div>
    </div>
  )
}

function AutoSaveIndicator({ status }: { status: 'saving' | 'saved' | 'error' | undefined }) {
  if (status === 'saving') return <span className="text-[10px] text-stone-400 italic">Saving…</span>
  if (status === 'saved') return <span className="text-[10px] text-emerald-600 font-medium">Saved</span>
  if (status === 'error') return <span className="text-[10px] text-red-500 font-medium">Save failed</span>
  return null
}

function NumField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div>
      <label className="text-xs text-stone-400 mb-1 block">{label}</label>
      <input type="number" min="0" value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:bg-stone-50 disabled:text-stone-400" />
    </div>
  )
}

function RatingRow({ label, max, value, onChange, onClear, disabled }: {
  label: string; max: number; value: number | undefined
  onChange: (v: number) => void; onClear: () => void; disabled: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-stone-600">{label}</span>
      <select
        value={value ?? ''}
        onChange={e => e.target.value === '' ? onClear() : onChange(Number(e.target.value))}
        disabled={disabled}
        className="border border-stone-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:bg-stone-50 disabled:text-stone-400"
      >
        <option value="">—</option>
        {Array.from({ length: max + 1 }, (_, i) => i).map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  )
}

function TextField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div>
      <label className="text-xs text-stone-500 mb-1 block">{label}</label>
      <textarea
        value={value} onChange={e => onChange(e.target.value)} disabled={disabled} rows={2}
        className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:bg-stone-50 disabled:text-stone-400 resize-none"
      />
    </div>
  )
}
