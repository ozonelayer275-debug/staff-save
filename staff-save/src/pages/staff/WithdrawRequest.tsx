import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatNaira } from '@/lib/types'
import type { WithdrawalRequest } from '@/lib/types'

export default function WithdrawRequest() {
  const [staffId, setStaffId] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [requests, setRequests] = useState<WithdrawalRequest[]>([])
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: staffRow } = await supabase
        .from('staff').select('id').eq('auth_user_id', user.id).maybeSingle()
      if (!staffRow) return
      setStaffId(staffRow.id)

      const { data: latest } = await supabase
        .from('savings_entries').select('running_balance')
        .eq('staff_id', staffRow.id)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })
        .limit(1).maybeSingle()
      setBalance(latest?.running_balance ?? 0)

      const { data: reqs } = await supabase
        .from('withdrawal_requests').select('*')
        .eq('staff_id', staffRow.id)
        .order('requested_at', { ascending: false })
      setRequests(reqs ?? [])
    }
    load()
  }, [success])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!staffId) return
    setError(null)
    setSubmitting(true)

    const kobo = Math.round(parseFloat(amount) * 100)
    if (kobo <= 0 || kobo > balance) {
      setError(`Amount must be between ₦1 and ${formatNaira(balance)}`)
      setSubmitting(false)
      return
    }

    const { error: err } = await supabase.from('withdrawal_requests').insert({
      staff_id: staffId,
      amount: kobo,
      reason,
      status: 'pending',
    })

    if (err) { setError(err.message); setSubmitting(false); return }
    setAmount('')
    setReason('')
    setSubmitting(false)
    setSuccess(s => !s)
  }

  const statusColor = (s: string) =>
    s === 'approved' ? 'text-green-700 bg-green-100' :
    s === 'rejected' ? 'text-red-600 bg-red-100' :
    'text-amber-700 bg-amber-100'

  return (
    <div className="max-w-sm mx-auto space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs text-gray-500 mb-1">Available Balance</p>
        <p className="text-2xl font-bold text-brand-700">{formatNaira(balance)}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Request a Withdrawal</p>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Amount (₦)</label>
          <input
            type="number" min="1" step="0.01" required
            value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Reason</label>
          <textarea
            required value={reason} onChange={e => setReason(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            placeholder="Brief reason for withdrawal"
          />
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button type="submit" disabled={submitting} className="w-full bg-brand-600 text-white text-sm py-2 rounded-lg hover:bg-brand-700 disabled:opacity-60">
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>

      {requests.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <p className="text-xs font-medium text-gray-500 px-4 py-3 border-b border-gray-50">Past Requests</p>
          {requests.map(r => (
            <div key={r.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">{formatNaira(r.amount)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(r.status)}`}>{r.status}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{r.reason}</p>
              <p className="text-xs text-gray-300 mt-0.5">{new Date(r.requested_at).toLocaleDateString('en-NG')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
