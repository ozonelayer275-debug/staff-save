import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ClassRow, GradingScaleRow, ResultEntryRow, SubjectRow, Term } from '@/lib/types'
import StatusChip from './StatusChip'
import GradeBadge from './GradeBadge'
import { AutoSaveIndicator, AdminRowActions, ScoreInput } from './GradebookGrid'

interface Row {
  subject: SubjectRow
  existing: ResultEntryRow | null
  test1: string
  test2: string
  exam: string
}

// Student-centric counterpart to GradebookGrid (which is subject-centric:
// one subject x all students). This is one student x all their subjects, so
// admin can review, edit, and approve everything for a student in one place
// instead of hunting through each subject's gradebook separately.
export default function AdminStudentSubjectScores({ studentId, classId, academicSession, term }: {
  studentId: string; classId: string; academicSession: string; term: Term
}) {
  const [cls, setCls] = useState<ClassRow | null>(null)
  const [scales, setScales] = useState<GradingScaleRow[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingAll, setApprovingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowStatus, setRowStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({})
  const hasLoadedOnceRef = useRef(false)
  const rowsRef = useRef<Row[]>([])
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // Resolved once, if this admin happens to also have a linked staff profile
  // — purely for an accurate entered_by/edited_by audit trail. Falls back to
  // null (now allowed, see patch4) rather than blocking the save.
  const staffIdRef = useRef<string | null>(null)

  useEffect(() => { rowsRef.current = rows }, [rows])
  useEffect(() => { load() }, [studentId, classId, academicSession, term])
  useEffect(() => () => { Object.values(saveTimers.current).forEach(clearTimeout) }, [])

  async function load() {
    if (!hasLoadedOnceRef.current) setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      const { data: staffRow } = await supabase.from('staff').select('id').eq('auth_user_id', userData.user.id).maybeSingle()
      staffIdRef.current = staffRow?.id ?? null
    }

    const { data: classRow } = await supabase.from('results_classes').select('*').eq('id', classId).single()
    setCls(classRow ?? null)

    const [{ data: scaleRows }, { data: classSubjects }, { data: entries }] = await Promise.all([
      classRow ? supabase.from('results_grading_scales').select('*').eq('level', classRow.level).order('display_order') : Promise.resolve({ data: [] as GradingScaleRow[] }),
      supabase.from('results_class_subjects').select('subject_id, subjects:results_subjects(*)').eq('class_id', classId),
      supabase.from('results_entries').select('*').eq('student_id', studentId).eq('academic_session', academicSession).eq('term', term),
    ])
    setScales(scaleRows ?? [])

    const subjects = (classSubjects ?? [])
      .map((r: any) => r.subjects as SubjectRow)
      .filter(Boolean)
      .sort((a, b) => a.display_order - b.display_order)
    const entryMap = new Map((entries ?? []).map(e => [e.subject_id, e]))

    setRows(subjects.map(subject => {
      const ex = entryMap.get(subject.id) ?? null
      return {
        subject, existing: ex,
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
    return !row.existing || row.existing.status !== 'locked'
  }

  // Admin edits auto-save the same way the gradebook does — per-row debounce,
  // no manual Save button.
  function updateRow(idx: number, field: 'test1' | 'test2' | 'exam', value: string) {
    const subjectId = rows[idx].subject.id
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
    if (saveTimers.current[subjectId]) clearTimeout(saveTimers.current[subjectId])
    saveTimers.current[subjectId] = setTimeout(() => { saveRow(subjectId) }, 900)
  }

  async function saveRow(subjectId: string) {
    delete saveTimers.current[subjectId]
    const row = rowsRef.current.find(r => r.subject.id === subjectId)
    if (!cls || !row || !canEditRow(row)) return
    if (row.test1 === '' && row.test2 === '' && row.exam === '') return

    setRowStatus(s => ({ ...s, [subjectId]: 'saving' }))
    setError(null)

    const staffId = staffIdRef.current
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
          student_id: studentId, subject_id: subjectId, class_id: classId,
          academic_session: academicSession, term,
          test1: t1, test2: t2, exam: ex,
          status: 'draft', entered_by: staffId,
        }).select().single()

    if (result.error) {
      setError(result.error.message)
      setRowStatus(s => ({ ...s, [subjectId]: 'error' }))
      return
    }

    setRows(prev => prev.map(r => r.subject.id === subjectId ? { ...r, existing: result.data } : r))
    setRowStatus(s => ({ ...s, [subjectId]: 'saved' }))
    setTimeout(() => setRowStatus(s => { const { [subjectId]: _omit, ...rest } = s; return rest }), 2000)
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
    const { data: userData } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('results_entries').update({
      status: 'draft',
      edit_history: [...(row.existing.edit_history ?? []), { action: 'reject', at: new Date().toISOString(), by: userData.user?.id, note }],
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

  async function handleApproveAll() {
    setApprovingAll(true)
    setError(null)
    const submittedIds = rowsRef.current.filter(r => r.existing?.status === 'submitted').map(r => r.existing!.id)
    if (submittedIds.length === 0) { setApprovingAll(false); return }
    const { error: err } = await supabase.from('results_entries').update({ status: 'approved' }).in('id', submittedIds)
    if (err) { setError(err.message); setApprovingAll(false); return }
    await load()
    setApprovingAll(false)
  }

  if (loading) return <div className="text-sm text-stone-400 py-8 text-center">Loading subject scores…</div>

  const submittedCount = rows.filter(r => r.existing?.status === 'submitted').length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-semibold text-stone-800">Subject Scores</p>
        {submittedCount > 0 && (
          <button
            onClick={handleApproveAll}
            disabled={approvingAll}
            className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            {approvingAll ? 'Approving…' : `Approve All ${submittedCount} Submitted`}
          </button>
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {rows.map((row, idx) => {
          const t1 = parseFloat(row.test1 || '0'), t2 = parseFloat(row.test2 || '0'), ex = parseFloat(row.exam || '0')
          const total = t1 + t2 + ex
          const grade = computeGrade(total)
          const editable = canEditRow(row)
          return (
            <div key={row.subject.id} className="bg-white rounded-xl border border-stone-200/80 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="font-medium text-stone-800 text-sm">{row.subject.name}</p>
                <div className="flex items-center gap-1.5">
                  <AutoSaveIndicator status={rowStatus[row.subject.id]} />
                  <StatusChip status={row.existing?.status ?? null} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ScoreInput label="Test 1 (20)" value={row.test1} onChange={v => updateRow(idx, 'test1', v)} max={20} disabled={!editable} id={`s-t1-${idx}`} onTab={() => document.getElementById(`s-t2-${idx}`)?.focus()} />
                <ScoreInput label="Test 2 (20)" value={row.test2} onChange={v => updateRow(idx, 'test2', v)} max={20} disabled={!editable} id={`s-t2-${idx}`} onTab={() => document.getElementById(`s-exam-${idx}`)?.focus()} />
                <ScoreInput label="Exam (60)" value={row.exam} onChange={v => updateRow(idx, 'exam', v)} max={60} disabled={!editable} id={`s-exam-${idx}`} onTab={() => document.getElementById(`s-t1-${idx + 1}`)?.focus()} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-stone-700">Total: {total || '—'}</span>
                {grade && <GradeBadge grade={grade.grade} meaning={grade.meaning} />}
              </div>
              {row.existing && <AdminRowActions row={row.existing} onApprove={() => handleApprove(row)} onReject={() => handleReject(row)} onLock={() => handleLock(row)} onUnlock={() => handleUnlock(row)} />}
            </div>
          )
        })}
        {rows.length === 0 && (
          <div className="text-center py-10 text-stone-400 text-sm bg-white rounded-xl border border-stone-200/80">No subjects mapped to this class yet.</div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl border border-stone-200/80 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-stone-50/60 text-stone-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Subject</th>
              <th className="text-left px-3 py-3">Test 1 (20)</th>
              <th className="text-left px-3 py-3">Test 2 (20)</th>
              <th className="text-left px-3 py-3">Exam (60)</th>
              <th className="text-left px-3 py-3">Total</th>
              <th className="text-left px-3 py-3">Grade</th>
              <th className="text-left px-3 py-3">Status</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {rows.map((row, idx) => {
              const t1 = parseFloat(row.test1 || '0'), t2 = parseFloat(row.test2 || '0'), ex = parseFloat(row.exam || '0')
              const total = t1 + t2 + ex
              const grade = computeGrade(total)
              const editable = canEditRow(row)
              return (
                <tr key={row.subject.id}>
                  <td className="px-4 py-2 font-medium text-stone-800 whitespace-nowrap">{row.subject.name}</td>
                  <td className="px-2 py-2"><ScoreInput label="" value={row.test1} onChange={v => updateRow(idx, 'test1', v)} max={20} disabled={!editable} id={`s-t1-${idx}`} onTab={() => document.getElementById(`s-t2-${idx}`)?.focus()} /></td>
                  <td className="px-2 py-2"><ScoreInput label="" value={row.test2} onChange={v => updateRow(idx, 'test2', v)} max={20} disabled={!editable} id={`s-t2-${idx}`} onTab={() => document.getElementById(`s-exam-${idx}`)?.focus()} /></td>
                  <td className="px-2 py-2"><ScoreInput label="" value={row.exam} onChange={v => updateRow(idx, 'exam', v)} max={60} disabled={!editable} id={`s-exam-${idx}`} onTab={() => document.getElementById(`s-t1-${idx + 1}`)?.focus()} /></td>
                  <td className="px-3 py-2 font-mono font-semibold text-stone-700">{total || '—'}</td>
                  <td className="px-3 py-2">{grade && <GradeBadge grade={grade.grade} meaning={grade.meaning} />}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <AutoSaveIndicator status={rowStatus[row.subject.id]} />
                      <StatusChip status={row.existing?.status ?? null} />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {row.existing && <AdminRowActions row={row.existing} onApprove={() => handleApprove(row)} onReject={() => handleReject(row)} onLock={() => handleLock(row)} onUnlock={() => handleUnlock(row)} />}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-stone-400 text-sm">No subjects mapped to this class yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  )
}
