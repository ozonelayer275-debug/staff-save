import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ClassRow, ResultLevel, SubjectRow } from '@/lib/types'

const EMPTY_FORM = { name: '', level: 'jss' as ResultLevel, weight: '1.0', display_order: '0' }

type Modal = { type: 'add' } | { type: 'edit'; row: SubjectRow } | null

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [mapping, setMapping] = useState<Record<string, Set<string>>>({}) // class_id -> subject_id set
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Modal>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [levelFilter, setLevelFilter] = useState<'all' | ResultLevel>('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: subj }, { data: cls }, { data: cs }] = await Promise.all([
      supabase.from('results_subjects').select('*').order('level').order('display_order'),
      supabase.from('results_classes').select('*').order('academic_session', { ascending: false }).order('name'),
      supabase.from('results_class_subjects').select('class_id, subject_id'),
    ])
    setSubjects(subj ?? [])
    setClasses(cls ?? [])
    const map: Record<string, Set<string>> = {}
    for (const row of cs ?? []) {
      if (!map[row.class_id]) map[row.class_id] = new Set()
      map[row.class_id].add(row.subject_id)
    }
    setMapping(map)
    setSelectedClassId(prev => prev || (cls?.[0]?.id ?? ''))
    setLoading(false)
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setError(null)
    setModal({ type: 'add' })
  }

  function openEdit(row: SubjectRow) {
    setForm({ name: row.name, level: row.level, weight: String(row.weight), display_order: String(row.display_order) })
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
      weight: Number(form.weight) || 1.0,
      display_order: Number(form.display_order) || 0,
    }

    const { error: err } = modal?.type === 'edit'
      ? await supabase.from('results_subjects').update(payload).eq('id', modal.row.id)
      : await supabase.from('results_subjects').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }
    await load()
    setModal(null)
    setSaving(false)
  }

  async function handleDelete(row: SubjectRow) {
    if (!confirm(`Delete subject "${row.name}"? This is only possible if no results reference it.`)) return
    const { error: err } = await supabase.from('results_subjects').delete().eq('id', row.id)
    if (err) { alert(err.message); return }
    load()
  }

  async function toggleClassSubject(subjectId: string) {
    if (!selectedClassId) return
    const has = mapping[selectedClassId]?.has(subjectId)
    if (has) {
      await supabase.from('results_class_subjects').delete().eq('class_id', selectedClassId).eq('subject_id', subjectId)
    } else {
      await supabase.from('results_class_subjects').insert({ class_id: selectedClassId, subject_id: subjectId })
    }
    load()
  }

  if (loading) return <div className="text-sm text-stone-400 py-8 text-center">Loading subjects…</div>

  const visibleSubjects = levelFilter === 'all' ? subjects : subjects.filter(s => s.level === levelFilter)
  const selectedClass = classes.find(c => c.id === selectedClassId)
  const assignedSet = mapping[selectedClassId] ?? new Set<string>()

  return (
    <div className="space-y-6">
      {/* Subject catalogue */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-stone-500">Level</label>
            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value as 'all' | ResultLevel)}
              className="border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              <option value="all">All</option>
              <option value="jss">KG/Nursery/Primary/JSS</option>
              <option value="ss">SS</option>
            </select>
          </div>
          <button onClick={openAdd} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
            + Add Subject
          </button>
        </div>

        <div className="bg-white rounded-xl border border-stone-200/80 divide-y divide-stone-50">
          {visibleSubjects.map(s => (
            <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide shrink-0 ${
                  s.level === 'jss' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-violet-50 text-violet-700 border border-violet-200'
                }`}>
                  {s.level}
                </span>
                <p className="text-sm font-medium text-stone-800 truncate">{s.name}</p>
                {s.level === 'ss' && s.weight !== 1 && (
                  <span className="text-xs text-stone-400 shrink-0">weight ×{s.weight}</span>
                )}
              </div>
              <div className="flex gap-3 shrink-0">
                <button onClick={() => openEdit(s)} className="text-xs text-brand-600 hover:text-brand-800 font-medium">Edit</button>
                <button onClick={() => handleDelete(s)} className="text-xs text-red-400 hover:text-red-600 font-medium">Delete</button>
              </div>
            </div>
          ))}
          {visibleSubjects.length === 0 && (
            <div className="text-center py-10 text-stone-400 text-sm">No subjects yet.</div>
          )}
        </div>
      </div>

      {/* Class ↔ subject mapping */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-stone-700">Assign subjects to a class</h3>
          <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
            className="border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` ${c.section}` : ''} — {c.academic_session}</option>)}
          </select>
        </div>
        {selectedClass && (
          <div className="bg-white rounded-xl border border-stone-200/80 p-4 grid sm:grid-cols-2 gap-2">
            {subjects.filter(s => s.level === selectedClass.level).map(s => (
              <label key={s.id} className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer">
                <input type="checkbox" checked={assignedSet.has(s.id)} onChange={() => toggleClassSubject(s.id)} className="accent-brand-600 w-4 h-4" />
                {s.name}
              </label>
            ))}
            {subjects.filter(s => s.level === selectedClass.level).length === 0 && (
              <p className="text-sm text-stone-400 col-span-full">No {selectedClass.level.toUpperCase()} subjects yet — add some above first.</p>
            )}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="font-semibold text-stone-800 mb-4">{modal.type === 'edit' ? `Edit — ${modal.row.name}` : 'Add Subject'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Field label="Subject Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required placeholder="e.g. Mathematics" />
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Level</label>
                <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value as ResultLevel }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="jss">KG/Nursery/Primary/JSS</option>
                  <option value="ss">SS</option>
                </select>
              </div>
              {form.level === 'ss' && (
                <Field label="Weight (for WEIGHTED SCORE)" type="number" value={form.weight} onChange={v => setForm(f => ({ ...f, weight: v }))} placeholder="1.0" />
              )}
              <Field label="Display Order" type="number" value={form.display_order} onChange={v => setForm(f => ({ ...f, display_order: v }))} placeholder="0" />
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
        required={required} placeholder={placeholder} step={type === 'number' ? '0.1' : undefined}
        className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </div>
  )
}
