import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { formatNaira } from '@/lib/types'
import type { SavingsEntry } from '@/lib/types'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const SavingsChart = lazy(() =>
  import('recharts').then(m => ({
    default: function Chart({ data }: { data: { label: string; balance: number }[] }) {
      return (
        <m.ResponsiveContainer width="100%" height={180}>
          <m.LineChart data={data}>
            <m.CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <m.XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <m.YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`} />
            <m.Tooltip formatter={(v: number) => [`₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`, 'Balance']} />
            <m.Line type="monotone" dataKey="balance" stroke="#a66518" strokeWidth={2} dot={{ r: 3 }} />
          </m.LineChart>
        </m.ResponsiveContainer>
      )
    },
  }))
)

export default function StaffHistory() {
  const [entries, setEntries] = useState<SavingsEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: staffRow } = await supabase
        .from('staff').select('id').eq('auth_user_id', user.id).maybeSingle()
      if (!staffRow) { setLoading(false); return }

      const { data } = await supabase
        .from('savings_entries')
        .select('*')
        .eq('staff_id', staffRow.id)
        .order('period_year', { ascending: true })
        .order('period_month', { ascending: true })

      setEntries(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-sm text-gray-400 text-center py-12">Loading…</div>
  if (entries.length === 0) return <div className="text-sm text-gray-400 text-center py-12">No savings recorded yet.</div>

  const chartData = entries.map(e => ({
    label: `${MONTHS[e.period_month - 1]} ${e.period_year}`,
    balance: e.running_balance / 100,
  }))

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">Savings Growth</p>
        <Suspense fallback={<div className="h-[180px] flex items-center justify-center text-xs text-gray-400">Loading chart…</div>}>
          <SavingsChart data={chartData} />
        </Suspense>
      </div>

      {/* History table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Period</th>
              <th className="text-right px-4 py-3">Saved</th>
              <th className="text-right px-4 py-3">Withdrawn</th>
              <th className="text-right px-4 py-3">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {[...entries].reverse().map(e => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-700">
                  {MONTHS[e.period_month - 1]} {e.period_year}
                  {e.notes && <div className="text-xs text-gray-400">{e.notes}</div>}
                </td>
                <td className="px-4 py-3 text-right text-green-700 font-mono text-xs">{formatNaira(e.savings_amount)}</td>
                <td className="px-4 py-3 text-right text-red-500 font-mono text-xs">
                  {e.withdrawal_amount > 0 ? formatNaira(e.withdrawal_amount) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800 font-mono text-xs">{formatNaira(e.running_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
