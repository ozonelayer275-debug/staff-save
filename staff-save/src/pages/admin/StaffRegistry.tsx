import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { StaffRow } from '@/lib/types'

const EMPTY_FORM = {
  full_name: '',
  role: '',
  phone: '',
  email: '',
  date_joined: new Date().toISOString().split('T')[0],
  status: 'active' as const,
}

interface AuthUser {
  id: string
  email: string
  created_at: string
}

type Modal =
  | { type: 'add' }
  | { type: 'edit'; staff: StaffRow }
  | { type: 'link'; staff: StaffRow }
  | null

export default function StaffRegistry() {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Modal>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([])
  const [selectedAuthUserId, setSelectedAuthUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchStaff() }, [])

  async function fetchStaff() {
    const { data } = await supabase.from('staff').select('*').order('full_name')
    setStaff(data ?? [])
    setLoading(false)
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setError(null)
    setModal({ type: 'add' })
  }

  function openEdit(s: StaffRow) {
    setForm({
      full_name: s.full_name,
      role: s.role,
      phone: s.phone ?? '',
      email: s.email,
      date_joined: s.date_joined,
      status: s.status,
    })
    setError(null)
    setModal({ type: 'edit', staff: s })
  }

  async function openLink(s: StaffRow) {
    setSelectedAuthUserId('')
    setError(null)
    setModal({ type: 'link', staff: s })

    // Fetch all auth users via the secure RPC function
    const { data, error: rpcErr } = await supabase.rpc('get_auth_users')
    if (rpcErr) { setError(rpcErr.message); return }

    // Exclude auth users already linked to a staff profile
    const linkedIds = new Set(staff.map(x => x.auth_user_id).filter(Boolean))
    const available = (data as AuthUser[]).filter(u => !linkedIds.has(u.id))
    setAuthUsers(available)
  }

  async function handleAddEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (modal?.type === 'edit') {
      const { error: err } = await supabase.from('staff').update({
        full_name: form.full_name,
        role: form.role,
        phone: form.phone || null,
        date_joined: form.date_joined,
        status: form.status,
      }).eq('id', modal.staff.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('staff').insert({
        full_name: form.full_name,
        role: form.role,
        phone: form.phone || null,
        email: form.email,
        date_joined: form.date_joined,
        status: form.status,
        auth_user_id: null,
      })
      if (err) { setError(err.message); setSaving(false); return }
    }

    await fetchStaff()
    setModal(null)
    setSaving(false)
  }

  async function handleLink(e: React.FormEvent) {
    e.preventDefault()
    if (modal?.type !== 'link') return
    if (!selectedAuthUserId) { setError('Please select an account.'); return }
    setSaving(true)
    setError(null)

    // Link the selected auth user to this staff profile
    const { error: err } = await supabase
      .from('staff')
      .update({ auth_user_id: selectedAuthUserId })
      .eq('id', modal.staff.id)

    if (err) { setError(err.message); setSaving(false); return }

    // If the selected auth user already has their own staff row (self-registered), delete it
    const duplicate = staff.find(
      x => x.auth_user_id === selectedAuthUserId && x.id !== modal.staff.id
    )
    if (duplicate) {
      await supabase.from('staff').delete().eq('id', duplicate.id)
    }

    await fetchStaff()
    setModal(null)
    setSaving(false)
  }

  async function handleUnlink(s: StaffRow) {
    if (!confirm(`Remove account link for ${s.full_name}? They will no longer be able to log in.`)) return
    await supabase.from('staff').update({ auth_user_id: null }).eq('id', s.id)
    fetchStaff()
  }

  async function toggleStatus(s: StaffRow) {
    await supabase.from('staff')
      .update({ status: s.status === 'active' ? 'inactive' : 'active' })
      .eq('id', s.id)
    fetchStaff()
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading staff…</div>

  const unlinked = staff.filter(s => !s.auth_user_id)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Staff Registry</h2>
        <button onClick={openAdd} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
          + Add Staff
        </button>
      </div>

      {/* Unlinked accounts banner */}
      {unlinked.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800">
            ⚠️ {unlinked.length} staff member{unlinked.length > 1 ? 's' : ''} not linked to a login account
          </p>
          <p className="text-xs text-amber-700">
            Ask them to register at <span className="font-mono bg-amber-100 px-1 rounded">/register</span>, then click "Link Account" below to connect their login to their savings profile.
          </p>
        </div>
      )}

      {/* Staff cards — mobile-first */}
      <div className="space-y-2">
        {staff.map(s => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-3">
              {/* Left: info */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-800 text-sm">{s.full_name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.status}
                  </span>
                  {s.auth_user_id
                    ? <span className="text-xs text-green-600 font-medium">✓ Linked</span>
                    : <span className="text-xs text-amber-600 font-medium">⚠ No login</span>
                  }
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{s.role}</p>
                <p className="text-xs text-gray-400">{s.email}</p>
                {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
                <p className="text-xs text-gray-300 mt-1">Joined {s.date_joined}</p>
              </div>

              {/* Right: actions */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => openEdit(s)}
                  className="text-xs text-brand-600 hover:text-brand-800 font-medium text-right"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleStatus(s)}
                  className="text-xs text-gray-400 hover:text-gray-600 text-right"
                >
                  {s.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                {s.auth_user_id ? (
                  <button
                    onClick={() => handleUnlink(s)}
                    className="text-xs text-red-400 hover:text-red-600 text-right"
                  >
                    Unlink
                  </button>
                ) : (
                  <button
                    onClick={() => openLink(s)}
                    className="text-xs bg-brand-600 text-white px-2 py-1 rounded-lg hover:bg-brand-700 font-medium"
                  >
                    Link Account
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {staff.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No staff added yet. Click "+ Add Staff" to get started.
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-gray-800 mb-4">
              {modal.type === 'edit' ? `Edit — ${modal.staff.full_name}` : 'Add Staff Member'}
            </h3>
            <form onSubmit={handleAddEdit} className="space-y-3">
              <Field label="Full Name" value={form.full_name} onChange={v => setForm(f => ({ ...f, full_name: v }))} required />
              <Field label="Role / Position" value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))} required placeholder="e.g. Class Teacher, Accountant" />
              <Field label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="e.g. 08012345678" />
              {modal.type === 'add' && (
                <Field label="Email" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} required />
              )}
              <Field label="Date Joined" type="date" value={form.date_joined} onChange={v => setForm(f => ({ ...f, date_joined: v }))} required />
              {modal.type === 'edit' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-brand-600 text-white text-sm py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link account modal */}
      {modal?.type === 'link' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-1">Link Login Account</h3>
            <p className="text-sm text-gray-500 mb-4">
              Select the account that belongs to{' '}
              <span className="font-medium text-gray-700">{modal.staff.full_name}</span>.
            </p>
            <form onSubmit={handleLink} className="space-y-3">
              {authUsers.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                  No unlinked accounts found. Ask the staff member to sign up at{' '}
                  <span className="font-mono text-xs bg-amber-100 px-1 rounded">/register</span> first.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {authUsers.map(u => (
                    <label
                      key={u.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedAuthUserId === u.id
                          ? 'border-brand-400 bg-brand-50'
                          : 'border-gray-200 hover:border-brand-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="account"
                        value={u.id}
                        checked={selectedAuthUserId === u.id}
                        onChange={() => setSelectedAuthUserId(u.id)}
                        className="accent-brand-600"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{u.email}</p>
                        <p className="text-xs text-gray-400">
                          Signed up {new Date(u.created_at).toLocaleDateString('en-NG')}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || authUsers.length === 0 || !selectedAuthUserId}
                  className="flex-1 bg-brand-600 text-white text-sm py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-60"
                >
                  {saving ? 'Linking…' : 'Link Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required = false, disabled = false, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; required?: boolean; disabled?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        required={required} disabled={disabled} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:bg-gray-50 disabled:text-gray-400"
      />
    </div>
  )
}
