import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ClassAssignmentRow, ClassRow, StaffRow } from '@/lib/types'

interface EnrichedAssignment extends ClassAssignmentRow {
  staff?: StaffRow
  cls?: ClassRow
}

export default function AdminClassAssignments() {
  const [assignments, setAssignments] = useState<EnrichedAssignment[]>([])
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ staff_id: '', class_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: asg }, { data: staffList }, { data: classList }] = await Promise.all([
      supabase.from('results_class_assignments').select('*').order('academic_session', { ascending: false }),
      supabase.from('staff').select('*').order('full_name'),
      supabase.from('results_classes').select('*').order('academic_session', { ascending: false }).order('name'),
    ])
    const staffMap = new Map((staffList ?? []).map(s => [s.id, s]))
    const classMap = new Map((classList ?? []).map(c => [c.id, c]))
    setAssignments((asg ?? []).map(a => ({ ...a, staff: staffMap.get(a.staff_id), cls: classMap.get(a.class_id) })))
    setStaff(staffList ?? [])
    setClasses(classList ?? [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ staff_id: staff[0]?.id ?? '', class_id: classes[0]?.id ?? '' })
    setError(null)
    setModalOpen(true)
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const cls = classes.find(c => c.id === form.class_id)
    if (!cls) { setError('Select a class.'); setSaving(false); return }

    const { error: err } = await supabase.from('results_class_assignments').insert({
      staff_id: form.staff_id,
      class_id: form.class_id,
      academic_session: cls.academic_session,
      results_access_enabled: false,
    })

    if (err) { setError(err.message); setSaving(false); return }
    await load()
    setModalOpen(false)
    setSaving(false)
  }

  async function toggleEnabled(a: EnrichedAssignment) {
    await supabase.from('results_class_assignments').update({ results_access_enabled: !a.results_access_enabled }).eq('id', a.id)
    load()
  }

  async function handleRemove(a: EnrichedAssignment) {
    if (!confirm(`Remove ${a.staff?.full_name ?? 'this staff member'}'s assignment to ${a.cls?.name ?? 'this class'}? Their draft entries remain but they'll lose access.`)) return
    await supabase.from('results_class_assignments').delete().eq('id', a.id)
    load()
  }

  if (loading) return <div className="text-sm text-stone-400 py-8 text-center">Loading assignments…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">Assign staff to classes, and control who currently has Results access.</p>
        <button onClick={openAdd} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors shrink-0">
          + Assign Staff
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-200/80 divide-y divide-stone-50">
        {assignments.map(a => (
          <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3.5 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-800">{a.staff?.full_name ?? '—'}</p>
              <p className="text-xs text-stone-400">{a.cls?.name ?? '—'}{a.cls?.section ? ` ${a.cls.section}` : ''} · {a.academic_session}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => toggleEnabled(a)}
                className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  a.results_access_enabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${a.results_access_enabled ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                {a.results_access_enabled ? 'Access enabled' : 'Access disabled'}
              </button>
              <button onClick={() => handleRemove(a)} className="text-xs text-red-400 hover:text-red-600 font-medium">Remove</button>
            </div>
          </div>
        ))}
        {assignments.length === 0 && (
          <div className="text-center py-12 text-stone-400 text-sm">No assignments yet. Click "+ Assign Staff" to get started.</div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="font-semibold text-stone-800 mb-4">Assign Staff to Class</h3>
            <form onSubmit={handleAssign} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Staff Member</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" required>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Class</label>
                <select value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" required>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` ${c.section}` : ''} — {c.academic_session}</option>)}
                </select>
              </div>
              <p className="text-xs text-stone-400">New assignments start with Results access disabled — enable it from the list once ready.</p>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 border border-stone-200 text-stone-600 text-sm py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
                <button type="submit" disabled={saving || staff.length === 0 || classes.length === 0} className="flex-1 bg-brand-600 text-white text-sm py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-60">
                  {saving ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
