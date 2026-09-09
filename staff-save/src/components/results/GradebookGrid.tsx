import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ClassRow, GradingScaleRow, ResultEntryRow, ResultStatus, StudentRow, SubjectRow, Term } from '@/lib/types'
import StatusChip from './StatusChip'
import GradeBadge from './GradeBadge'

interface Row {
  student: StudentRow
  existing: ResultEntryRow | null
  test1: string
  test2: string
  exam: string
}

export default function GradebookGrid({ classId, subjectId, term, role }: {
  classId: string
  subjectId: string
  term: Term
  role: 'staff' | 'admin'
}) {
  const [cls, setCls] = useState<ClassRow | null>(null)
  const [subject, setSubject] = useState<SubjectRow | null>(null)
  const [scales, setScales] = useState<GradingScaleRow[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowStatus, setRowStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({})
  const staffIdRef = useRef<string | null>(null)
  const hasLoadedOnceRef = useRef(false)
  const rowsRef = useRef<Row[]>([])
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingStudentIds = useRef<Set<string>>(new Set())

  useEffect(() => { rowsRef.current = rows }, [rows])
  useEffect(() => { load() }, [classId, subjectId, term])
  useEffect(() => () => {
    // Cancel pending debounced saves on unmount to avoid a save firing (and
    // setting state) after the component is gone.
    Object.values(saveTimers.current).forEach(clearTimeout)
  }, [])

  // Only the very first load shows the full-page loading state — reloads
  // after save/submit/approve/etc keep the grid visible instead of
  // unmounting it, so a save doesn't look like it silently cleared the screen.
  async function load() {
    if (!hasLoadedOnceRef.current) setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      const { data: staffRow } = await supabase.from('staff').select('id').eq('auth_user_id', userData.user.id).maybeSingle()
      staffIdRef.current = staffRow?.id ?? null
    }

    const [{ data: classRow }, { data: subjectRow }, { data: students }] = await Promise.all([
      supabase.from('results_classes').select('*').eq('id', classId).single(),
      supabase.from('results_subjects').select('*').eq('id', subjectId).single(),
      supabase.from('results_students').select('*').eq('class_id', classId).order('first_name'),
    ])
    setCls(classRow ?? null)
    setSubject(subjectRow ?? null)

    if (classRow) {
      const { data: scaleRows } = await supabase.from('results_grading_scales').select('*').eq('level', classRow.level).order('display_order')
      setScales(scaleRows ?? [])
    }

    const { data: entries } = await supabase
      .from('results_entries').select('*')
      .eq('class_id', classId).eq('subject_id', subjectId).eq('academic_session', classRow?.academic_session ?? '').eq('term', term)

    const entryMap = new Map((entries ?? []).map(e => [e.student_id, e]))

    setRows((students ?? []).map(s => {
      const ex = entryMap.get(s.id) ?? null
      return {
        student: s,
        existing: ex,
        test1: ex ? String(ex.test1) : '',
        test2: ex ? String(ex.test2) : '',
        exam: ex ? String(ex.exam) : '',
      }
    }))
    setLoading(false)
    hasLoadedOnceRef.current = true
  }

  function computeGrade(total: number) {
    return scales.find(s => total >= s.min_score && total <= s.max_score) ?? null
  }

  function canEditRow(row: Row) {
    if (role === 'admin') return !row.existing || row.existing.status !== 'locked'
    return !row.existing || row.existing.status === 'draft'
  }

  // Auto-save: every keystroke schedules a debounced per-student save (900ms
  // after the last change to that row), so typing across multiple rows saves
  // each independently without a manual Save button. Reads from rowsRef
  // (kept in sync with `rows` via effect) rather than closing over `rows`
  // directly, since the debounce timer's callback would otherwise capture a
  // stale snapshot from whenever the timer was (re)scheduled.
  function updateRow(idx: number, field: 'test1' | 'test2' | 'exam', value: string) {
    const studentId = rows[idx].student.id
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
    pendingStudentIds.current.add(studentId)
    if (saveTimers.current[studentId]) clearTimeout(saveTimers.current[studentId])
    saveTimers.current[studentId] = setTimeout(() => { saveRow(studentId) }, 900)
  }

  async function saveRow(studentId: string) {
    delete saveTimers.current[studentId]
    pendingStudentIds.current.delete(studentId)

    const staffId = staffIdRef.current
    const row = rowsRef.current.find(r => r.student.id === studentId)
    // staffId is allowed to be null (e.g. an admin with no linked staff
    // profile) — entered_by/edited_by just end up null for that write, an
    // audit-trail detail, not a save-blocking requirement.
    if (!cls || !row || !canEditRow(row)) return
    if (row.test1 === '' && row.test2 === '' && row.exam === '') return // nothing entered yet

    setRowStatus(s => ({ ...s, [studentId]: 'saving' }))
    setError(null)

    const t1 = parseFloat(row.test1 || '0')
    const t2 = parseFloat(row.test2 || '0')
    const ex = parseFloat(row.exam || '0')

    const result = row.existing
      ? await supabase.from('results_entries').update({
          test1: t1, test2: t2, exam: ex,
          edit_history: [...(row.existing.edit_history ?? []), {
            edited_at: new Date().toISOString(), edited_by: staffId,
            previous: { test1: row.existing.test1, test2: row.existing.test2, exam: row.existing.exam },
          }],
        }).eq('id', row.existing.id).select().single()
      : await supabase.from('results_entries').insert({
          student_id: row.student.id, subject_id: subjectId, class_id: classId,
          academic_session: cls.academic_session, term,
          test1: t1, test2: t2, exam: ex,
          status: 'draft' as ResultStatus, entered_by: staffId,
        }).select().single()

    if (result.error) {
      setError(result.error.message)
      setRowStatus(s => ({ ...s, [studentId]: 'error' }))
      return
    }

    setRows(prev => prev.map(r => r.student.id === studentId ? { ...r, existing: result.data } : r))
    setRowStatus(s => ({ ...s, [studentId]: 'saved' }))
    setTimeout(() => setRowStatus(s => { const { [studentId]: _omit, ...rest } = s; return rest }), 2000)
  }

  // Submit deliberately stays a manual action. Flush any still-pending
  // debounced saves first so a very-last-second edit isn't left unsaved.
  async function handleSubmitForReview() {
    setSubmitting(true)
    setError(null)

    const pending = Array.from(pendingStudentIds.current)
    pending.forEach(id => { if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]) })
    await Promise.all(pending.map(id => saveRow(id)))

    const draftIds = rowsRef.current.filter(r => r.existing?.status === 'draft').map(r => r.existing!.id)
    if (draftIds.length === 0) { setSubmitting(false); return }
    const { error: err } = await supabase.from('results_entries').update({ status: 'submitted' }).in('id', draftIds)
    if (err) { setError(err.message); setSubmitting(false); return }
    await load()
    setSubmitting(false)
  }

  async function handleApprove(row: Row) {
    if (!row.existing) return
    const { error: err } = await supabase.from('results_entries').update({ status: 'approved' }).eq('id', row.existing.id)
    if (err) { alert(err.message); return }
    load()
  }

  async function handleReject(row: Row) {
    if (!row.existing) return
    const note = prompt('Note for the staff member on why this is being sent back (recorded in edit history):') ?? ''
    const historyEntry = { action: 'reject', at: new Date().toISOString(), by: staffIdRef.current, note }
    const { error: err } = await supabase.from('results_entries').update({
      status: 'draft',
      edit_history: [...(row.existing.edit_history ?? []), historyEntry],
    }).eq('id', row.existing.id)
    if (err) { alert(err.message); return }
    load()
  }

  async function handleLock(row: Row) {
    if (!row.existing) return
    const { error: err } = await supabase.from('results_entries').update({ status: 'locked' }).eq('id', row.existing.id)
    if (err) { alert(err.message); return }
    load()
  }

  async function handleUnlock(row: Row) {
    if (!row.existing) return
    const reason = prompt('Reason for unlocking (recorded in edit history):') ?? ''
    const { error: err } = await supabase.rpc('results_unlock_result_entry', { p_id: row.existing.id, p_reason: reason })
    if (err) { alert(err.message); return }
    load()
  }

  if (loading) return <div className="text-sm text-stone-400 py-8 text-center">Loading gradebook…</div>

  const draftCount = rows.filter(r => r.existing?.status === 'draft').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-stone-800">{subject?.name}</p>
          <p className="text-xs text-stone-400">
            {cls?.name}{cls?.section ? ` ${cls.section}` : ''} · {cls?.academic_session} · Term {term}
          </p>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {rows.map((row, idx) => {
          const t1 = parseFloat(row.test1 || '0'), t2 = parseFloat(row.test2 || '0'), ex = parseFloat(row.exam || '0')
          const total = t1 + t2 + ex
          const grade = computeGrade(total)
          const editable = canEditRow(row)
          return (
            <div key={row.student.id} className="bg-white rounded-xl border border-stone-200/80 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="font-medium text-stone-800 text-sm">{row.student.first_name} {row.student.last_name}</p>
                <div className="flex items-center gap-1.5">
                  <AutoSaveIndicator status={rowStatus[row.student.id]} />
                  <StatusChip status={row.existing?.status ?? null} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ScoreInput label="Test 1 (20)" value={row.test1} onChange={v => updateRow(idx, 'test1', v)} max={20} disabled={!editable} id={`t1-${idx}`} onTab={() => focusCell(idx, 't2')} />
                <ScoreInput label="Test 2 (20)" value={row.test2} onChange={v => updateRow(idx, 'test2', v)} max={20} disabled={!editable} id={`t2-${idx}`} onTab={() => focusCell(idx, 'exam')} />
                <ScoreInput label="Exam (60)" value={row.exam} onChange={v => updateRow(idx, 'exam', v)} max={60} disabled={!editable} id={`exam-${idx}`} onTab={() => focusCell(idx + 1, 't1')} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-stone-700">Total: {total || '—'}</span>
                {grade && <GradeBadge grade={grade.grade} meaning={grade.meaning} />}
              </div>
              {role === 'admin' && row.existing && <AdminRowActions row={row.existing} onApprove={() => handleApprove(row)} onReject={() => handleReject(row)} onLock={() => handleLock(row)} onUnlock={() => handleUnlock(row)} />}
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl border border-stone-200/80 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-stone-50/60 text-stone-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Student</th>
              <th className="text-left px-3 py-3">Test 1 (20)</th>
              <th className="text-left px-3 py-3">Test 2 (20)</th>
              <th className="text-left px-3 py-3">Exam (60)</th>
              <th className="text-left px-3 py-3">Total</th>
              <th className="text-left px-3 py-3">Grade</th>
              <th className="text-left px-3 py-3">Status</th>
              {role === 'admin' && <th className="px-3 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {rows.map((row, idx) => {
              const t1 = parseFloat(row.test1 || '0'), t2 = parseFloat(row.test2 || '0'), ex = parseFloat(row.exam || '0')
              const total = t1 + t2 + ex
              const grade = computeGrade(total)
              const editable = canEditRow(row)
              return (
                <tr key={row.student.id}>
                  <td className="px-4 py-2 font-medium text-stone-800 whitespace-nowrap">{row.student.first_name} {row.student.last_name}</td>
                  <td className="px-2 py-2"><ScoreInput label="" value={row.test1} onChange={v => updateRow(idx, 'test1', v)} max={20} disabled={!editable} id={`t1-${idx}`} onTab={() => focusCell(idx, 't2')} /></td>
                  <td className="px-2 py-2"><ScoreInput label="" value={row.test2} onChange={v => updateRow(idx, 'test2', v)} max={20} disabled={!editable} id={`t2-${idx}`} onTab={() => focusCell(idx, 'exam')} /></td>
                  <td className="px-2 py-2"><ScoreInput label="" value={row.exam} onChange={v => updateRow(idx, 'exam', v)} max={60} disabled={!editable} id={`exam-${idx}`} onTab={() => focusCell(idx + 1, 't1')} /></td>
                  <td className="px-3 py-2 font-mono font-semibold text-stone-700">{total || '—'}</td>
                  <td className="px-3 py-2">{grade && <GradeBadge grade={grade.grade} meaning={grade.meaning} />}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <AutoSaveIndicator status={rowStatus[row.student.id]} />
                      <StatusChip status={row.existing?.status ?? null} />
                    </div>
                  </td>
                  {role === 'admin' && (
                    <td className="px-3 py-2">
                      {row.existing && <AdminRowActions row={row.existing} onApprove={() => handleApprove(row)} onReject={() => handleReject(row)} onLock={() => handleLock(row)} onUnlock={() => handleUnlock(row)} />}
                    </td>
                  )}
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-stone-400 text-sm">No students in this class yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Scores auto-save as you type (900ms after your last keystroke per
          row) — Submit for Review is the only manual action left. */}
      {role === 'staff' && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSubmitForReview}
            disabled={submitting || draftCount === 0}
            className="bg-brand-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Submitting…' : `Submit ${draftCount > 0 ? draftCount : ''} for Review`}
          </button>
        </div>
      )}
    </div>
  )
}

export function AutoSaveIndicator({ status }: { status: 'saving' | 'saved' | 'error' | undefined }) {
  if (status === 'saving') return <span className="text-[10px] text-stone-400 italic">Saving…</span>
  if (status === 'saved') return <span className="text-[10px] text-emerald-600 font-medium">Saved</span>
  if (status === 'error') return <span className="text-[10px] text-red-500 font-medium">Save failed</span>
  return null
}

export function AdminRowActions({ row, onApprove, onReject, onLock, onUnlock }: {
  row: ResultEntryRow; onApprove: () => void; onReject: () => void; onLock: () => void; onUnlock: () => void
}) {
  if (row.status === 'submitted') {
    return (
      <div className="flex items-center gap-2">
        <button onClick={onApprove} className="text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-md hover:bg-emerald-700">Approve</button>
        <button onClick={onReject} className="text-xs text-stone-500 hover:text-stone-700 font-medium">Reject</button>
      </div>
    )
  }
  if (row.status === 'approved') {
    return <button onClick={onLock} className="text-xs text-stone-500 hover:text-stone-700 font-medium">Lock</button>
  }
  if (row.status === 'locked') {
    return <button onClick={onUnlock} className="text-xs text-amber-600 hover:text-amber-800 font-medium">Unlock</button>
  }
  return null
}

export function ScoreInput({ label, value, onChange, max, disabled, id, onTab }: {
  label: string; value: string; onChange: (v: string) => void; max: number
  disabled: boolean; id: string; onTab: () => void
}) {
  return (
    <div>
      {label && <label className="text-xs text-stone-400 mb-1 block">{label}</label>}
      <input
        id={id} type="number" min="0" max={max} step="0.5" value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); onTab() } }}
        disabled={disabled}
        placeholder="0"
        className="w-16 border border-stone-200 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:bg-stone-50 disabled:text-stone-400"
      />
    </div>
  )
}

function focusCell(rowIdx: number, field: 't1' | 't2' | 'exam') {
  document.getElementById(`${field}-${rowIdx}`)?.focus()
}
