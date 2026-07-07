import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatNaira } from '@/lib/types'

interface RequestWithStaff {
  id: string
  staff_id: string
  amount: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  resolved_at: string | null
  staff: { full_name: string }
}

export default function AdminWithdrawals() {
  const [requests, setRequests] = useState<RequestWithStaff[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  useEffect(() => { fetchRequests() }, [filter])

  async function fetchRequests() {
    setLoading(true)
    let q = supabase
      .from('withdrawal_requests')
      .select('*, staff(full_name)')
      .order('requested_at', { ascending: false })

    if (filter === 'pending') q = q.eq('status', 'pending')

    const { data } = await q
    setRequests((data as RequestWithStaff[]) ?? [])
    setLoading(false)
  }

  async function resolve(req: RequestWithStaff, action: 'approved' | 'rejected') {
    setProcessing(req.id)
    const { data: { user } } = await supabase.auth.getUser()

    if (action === 'approved') {
      // Get latest entry to deduct from
      const { data: latest } = await supabase
        .from('savings_entries').select('*')
        .eq('staff_id', req.staff_id)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })
        .limit(1).maybeSingle()

      if (!latest) { setProcessing(null); return }

      const newBalance = latest.running_balance - req.amount
      const now = new Date()
      const historyEntry = {
        edited_at: now.toISOString(),
        edited_by: user?.id,
        previous: { running_balance: latest.running_balance, withdrawal_amount: latest.withdrawal_amount },
      }

      await supabase.from('savings_entries').update({
        withdrawal_amount: latest.withdrawal_amount + req.amount,
        running_balance: newBalance,
        edited_at: now.toISOString(),
        edit_history: [...(latest.edit_history ?? []), historyEntry],
        notes: latest.notes ? `${latest.notes}; withdrawal approved` : 'withdrawal approved',
      }).eq('id', latest.id)
    }

    await supabase.from('withdrawal_requests').update({
      status: action,
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id,
    }).eq('id', req.id)

    await fetchRequests()
    setProcessing(null)
  }

  const statusColor = (s: string) =>
    s === 'approved' ? 'text-green-700 bg-green-100' :
    s === 'rejected' ? 'text-red-600 bg-red-100' :
    'text-amber-700 bg-amber-100'

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-800 mr-auto">Withdrawal Requests</h2>
        <button onClick={() => setFilter('pending')} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filter === 'pending' ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600'}`}>Pending</button>
        <button onClick={() => setFilter('all')} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filter === 'all' ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600'}`}>All</button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">No {filter === 'pending' ? 'pending' : ''} requests.</div>
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-800 text-sm">{r.staff.full_name}</p>
                  <p className="text-lg font-bold text-brand-700">{formatNaira(r.amount)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.reason}</p>
                  <p className="text-xs text-gray-300 mt-0.5">{new Date(r.requested_at).toLocaleDateString('en-NG')}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(r.status)}`}>{r.status}</span>
                  {r.status === 'pending' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => resolve(r, 'approved')}
                        disabled={processing === r.id}
                        className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => resolve(r, 'rejected')}
                        disabled={processing === r.id}
                        className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
