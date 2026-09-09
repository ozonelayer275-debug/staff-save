import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { ClassRow, StudentRow } from '@/lib/types'
import StudentPhoto from './StudentPhoto'
import PromoteStudentModal from './PromoteStudentModal'

const EMPTY_FORM = { first_name: '', last_name: '', reg_no_or_bece_no: '', gender: 'M' as 'M' | 'F', age_or_dob: '' }

type Modal = { type: 'add' } | { type: 'edit'; row: StudentRow } | { type: 'promote'; row: StudentRow } | null

export default function RosterTable({ classId, allClasses, canDelete, basePath }: {
  classId: string
  allClasses: ClassRow[]
  canDelete: boolean
  basePath: '/admin/results' | '/dashboard/results'
}) {
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Modal>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<string | null>(null)

  const cls = allClasses.find(c => c.id === classId)

  useEffect(() => { fetchStudents() }, [classId])

  async function fetchStudents() {
    setLoading(true)
    const { data } = await supabase.from('results_students').select('*').eq('class_id', classId).order('first_name')
    setStudents(data ?? [])
    setLoading(false)
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setError(null)
    setModal({ type: 'add' })
  }

  function openEdit(row: StudentRow) {
    setForm({
      first_name: row.first_name, last_name: row.last_name,
      reg_no_or_bece_no: row.reg_no_or_bece_no, gender: row.gender,
      age_or_dob: row.age_or_dob ?? '',
    })
    setError(null)
    setModal({ type: 'edit', row })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      reg_no_or_bece_no: form.reg_no_or_bece_no.trim(),
      gender: form.gender,
      age_or_dob: form.age_or_dob.trim() || null,
    }

    const { error: err } = modal?.type === 'edit'
      ? await supabase.from('results_students').update(payload).eq('id', modal.row.id)
      : await supabase.from('results_students').insert({ ...payload, class_id: classId })

    if (err) { setError(err.message); setSaving(false); return }
    await fetchStudents()
    setModal(null)
    setSaving(false)
  }

  async function handleDelete(row: StudentRow) {
    if (!confirm(`Remove ${row.first_name} ${row.last_name} from the roster? This does not delete their existing result records.`)) return
    const { error: err } = await supabase.from('results_students').delete().eq('id', row.id)
    if (err) { alert(err.message); return }
    fetchStudents()
  }

  function triggerPhotoUpload(studentId: string) {
    uploadTargetRef.current = studentId
    fileInputRef.current?.click()
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const studentId = uploadTargetRef.current
    e.target.value = ''
    if (!file || !studentId) return

    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return }

    setUploadingFor(studentId)
    const path = `${studentId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`

    const { error: uploadErr } = await supabase.storage.from('results-student-photos').upload(path, file, { upsert: true })
    if (uploadErr) { alert(uploadErr.message); setUploadingFor(null); return }

    const { data: urlData } = supabase.storage.from('results-student-photos').getPublicUrl(path)
    const { error: updateErr } = await supabase.from('results_students').update({ photo_url: urlData.publicUrl }).eq('id', studentId)
    if (updateErr) { alert(updateErr.message); setUploadingFor(null); return }

    await fetchStudents()
    setUploadingFor(null)
  }

  if (loading) return <div className="text-sm text-stone-400 py-8 text-center">Loading roster…</div>

  return (
    <div className="space-y-4">
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoSelected} className="hidden" />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-stone-800">{cls ? `${cls.name}${cls.section ? ` ${cls.section}` : ''}` : 'Roster'}</p>
          <p className="text-xs text-stone-400">{cls?.academic_session} · {students.length} student{students.length === 1 ? '' : 's'}</p>
        </div>
        <button onClick={openAdd} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
          + Add Student
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {students.map(s => (
          <div key={s.id} className="bg-white rounded-xl border border-stone-200/80 p-3.5 space-y-3">
            <div className="flex items-center gap-3">
              <button onClick={() => triggerPhotoUpload(s.id)} className="relative shrink-0 group" title="Upload/replace photo">
                <StudentPhoto url={s.photo_url} name={`${s.first_name} ${s.last_name}`} />
                <span className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                  {uploadingFor === s.id && <span className="text-[10px] text-white font-medium">…</span>}
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-800 text-sm truncate">{s.first_name} {s.last_name}</p>
                <p className="text-xs text-stone-400">{s.reg_no_or_bece_no} · {s.gender}{s.age_or_dob ? ` · ${s.age_or_dob}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap border-t border-stone-100 pt-2.5">
              <Link to={`${basePath}/report-card/${classId}/${s.id}`} className="text-xs text-brand-600 hover:text-brand-800 font-medium">Report Card</Link>
              <button onClick={() => openEdit(s)} className="text-xs text-brand-600 hover:text-brand-800 font-medium">Edit</button>
              <button onClick={() => setModal({ type: 'promote', row: s })} className="text-xs text-stone-500 hover:text-stone-700 font-medium">Promote</button>
              {canDelete && (
                <button onClick={() => handleDelete(s)} className="text-xs text-red-400 hover:text-red-600 font-medium ml-auto">Remove</button>
              )}
            </div>
          </div>
        ))}
        {students.length === 0 && (
          <div className="col-span-full text-center py-12 text-stone-400 text-sm bg-white rounded-xl border border-stone-200/80">
            No students in this class yet. Click "+ Add Student" to get started.
          </div>
        )}
      </div>

      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-stone-800 mb-4">{modal.type === 'edit' ? 'Edit Student' : 'Add Student'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name" value={form.first_name} onChange={v => setForm(f => ({ ...f, first_name: v }))} required />
                <Field label="Last Name" value={form.last_name} onChange={v => setForm(f => ({ ...f, last_name: v }))} required />
              </div>
              <Field
                label={cls?.level === 'ss' ? 'BECE No.' : 'Reg. No.'}
                value={form.reg_no_or_bece_no}
                onChange={v => setForm(f => ({ ...f, reg_no_or_bece_no: v }))}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Gender</label>
                  <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value as 'M' | 'F' }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <Field label="Age" value={form.age_or_dob} onChange={v => setForm(f => ({ ...f, age_or_dob: v }))} placeholder="e.g. 11yrs" />
              </div>
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

      {modal?.type === 'promote' && (
        <PromoteStudentModal
          student={modal.row}
          classes={allClasses}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); fetchStudents() }}
        />
      )}
    </div>
  )
}

function Field({ label, value, onChange, required = false, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 mb-1">{label}</label>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        required={required} placeholder={placeholder}
        className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </div>
  )
}
