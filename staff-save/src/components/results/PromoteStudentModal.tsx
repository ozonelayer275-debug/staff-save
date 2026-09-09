import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ClassRow, StudentRow } from '@/lib/types'

export default function PromoteStudentModal({ student, classes, onClose, onDone }: {
  student: StudentRow
  classes: ClassRow[]
  onClose: () => void
  onDone: () => void
}) {
  const [targetClassId, setTargetClassId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = classes.filter(c => c.id !== student.class_id)

  async function handlePromote(e: React.FormEvent) {
    e.preventDefault()
    if (!targetClassId) return
    setSaving(true)
    setError(null)

    const { error: err } = await supabase.rpc('results_promote_student', {
      p_student_id: student.id,
      p_new_class_id: targetClassId,
    })

    if (err) { setError(err.message); setSaving(false); return }
    onDone()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h3 className="font-semibold text-stone-800 mb-1">Promote Student</h3>
        <p className="text-sm text-stone-500 mb-4">
          Move <span className="font-medium text-stone-700">{student.first_name} {student.last_name}</span> to a new class.
          Their existing results stay attached to the class they were entered under — only future entries move.
        </p>
        <form onSubmit={handlePromote} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">New Class</label>
            <select
              value={targetClassId}
              onChange={e => setTargetClassId(e.target.value)}
              required
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="">Select a class…</option>
              {options.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.section ? ` ${c.section}` : ''} — {c.academic_session}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-stone-200 text-stone-600 text-sm py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
            <button type="submit" disabled={saving || !targetClassId} className="flex-1 bg-brand-600 text-white text-sm py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-60">
              {saving ? 'Promoting…' : 'Promote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
