import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { ClassRow, ResultLevel } from '@/lib/types'

const EMPTY_FORM = { name: '', level: 'jss' as ResultLevel, section: '', academic_session: currentSession() }

function currentSession() {
  const now = new Date()
  const y = now.getFullYear()
  // Nigerian school sessions typically run Sep–Jul; before September, treat as the tail of last year's session.
  return now.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

type Modal = { type: 'add' } | { type: 'edit'; row: ClassRow } | null

export default function AdminClasses() {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Modal>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionFilter, setSessionFilter] = useState<string>('all')

  useEffect(() => { fetchClasses() }, [])

  async function fetchClasses() {
    setLoading(true)
    const { data } = await supabase.from('results_classes').select('*').order('academic_session', { ascending: false }).order('name')
    setClasses(data ?? [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM, academic_session: sessionFilter !== 'all' ? sessionFilter : currentSession() })
    setError(null)
    setModal({ type: 'add' })
  }

  function openEdit(row: ClassRow) {
    setForm({ name: row.name, level: row.level, section: row.section ?? '', academic_session: row.academic_session })
    setError(null)
    setModal({ type: 'edit', row })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      level: form.level,
      section: form.section.trim() || null,
      academic_session: form.academic_session.trim(),
    }

    const { error: err } = modal?.type === 'edit'
      ? await supabase.from('results_classes').update(payload).eq('id', modal.row.id)
      : await supabase.from('results_classes').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }
    await fetchClasses()
    setModal(null)
    setSaving(false)
  }

  async function handleDelete(row: ClassRow) {
    if (!confirm(`Delete ${row.name} (${row.academic_session})? This is only possible if no students or assignments reference it.`)) return
    const { error: err } = await supabase.from('results_classes').delete().eq('id', row.id)
    if (err) { alert(err.message); return }
    fetchClasses()
  }

  if (loading) return <div className="text-sm text-stone-400 py-8 text-center">Loading classes…</div>

  const sessions = Array.from(new Set(classes.map(c => c.academic_session)))
  const visible = sessionFilter === 'all' ? classes : classes.filter(c => c.academic_session === sessionFilter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-stone-500">Session</label>
          <select
            value={sessionFilter}
            onChange={e => setSessionFilter(e.target.value)}
            className="border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="all">All sessions</option>
            {sessions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={openAdd} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
          + Add Class
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-stone-200/80 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-stone-800 text-sm">{c.name}{c.section ? ` ${c.section}` : ''}</p>
                <p className="text-xs text-stone-400 mt-0.5">{c.academic_session}</p>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide ${
                c.level === 'jss' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-violet-50 text-violet-700 border border-violet-200'
              }`}>
                {c.level}
              </span>
            </div>
            <div className="flex gap-3 mt-3 flex-wrap">
              <Link to={`/admin/results/roster/${c.id}`} className="text-xs text-brand-600 hover:text-brand-800 font-medium">Roster</Link>
              <Link to={`/admin/results/entry/${c.id}`} className="text-xs text-brand-600 hover:text-brand-800 font-medium">Gradebook</Link>
              <Link to={`/admin/results/export/${c.id}`} className="text-xs text-brand-600 hover:text-brand-800 font-medium">Export</Link>
              <button onClick={() => openEdit(c)} className="text-xs text-brand-600 hover:text-brand-800 font-medium">Edit</button>
              <button onClick={() => handleDelete(c)} className="text-xs text-red-400 hover:text-red-600 font-medium">Delete</button>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="col-span-full text-center py-12 text-stone-400 text-sm">No classes yet. Click "+ Add Class" to get started.</div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="font-semibold text-stone-800 mb-4">{modal.type === 'edit' ? `Edit — ${modal.row.name}` : 'Add Class'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Field label="Class Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required placeholder="e.g. JSS1, SSS2" />
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Level</label>
                <select
                  value={form.level}
                  onChange={e => setForm(f => ({ ...f, level: e.target.value as ResultLevel }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="jss">KG / Nursery / Primary / JSS (6-band grading)</option>
                  <option value="ss">SS (WAEC 9-band grading)</option>
                </select>
              </div>
              <Field label="Section (optional)" value={form.section} onChange={v => setForm(f => ({ ...f, section: v }))} placeholder="e.g. A" />
              <Field label="Academic Session" value={form.academic_session} onChange={v => setForm(f => ({ ...f, academic_session: v }))} required placeholder="e.g. 2025/2026" />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="flex-1 border border-stone-200 text-stone-600 text-sm py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-brand-600 text-white text-sm py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required = false, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 mb-1">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        required={required} placeholder={placeholder}
        className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </div>
  )
}
