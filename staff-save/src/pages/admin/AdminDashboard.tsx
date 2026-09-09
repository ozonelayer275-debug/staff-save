import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatNaira } from '@/lib/types'
import type { StaffRow, SavingsEntry } from '@/lib/types'

interface StaffWithBalance extends StaffRow {
  balance: number
  lastPeriod: string
}

type SortKey = 'name' | 'balance' | 'date_joined'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

const AVATAR_COLORS = [
  'bg-amber-500','bg-emerald-500','bg-sky-500','bg-violet-500',
  'bg-rose-500','bg-teal-500','bg-orange-500','bg-indigo-500',
]
function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [staffList, setStaffList] = useState<StaffWithBalance[]>([])
  const [totalBalance, setTotalBalance] = useState(0)
  const [monthSaved, setMonthSaved] = useState(0)
  const [monthWithdrawn, setMonthWithdrawn] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('balance')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const now = new Date()
  const curMonth = now.getMonth() + 1
  const curYear = now.getFullYear()

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: staff }, { data: entries }, { data: pending }] = await Promise.all([
      supabase.from('staff').select('*').order('full_name'),
      supabase.from('savings_entries').select('*'),
      supabase.from('withdrawal_requests').select('id').eq('status', 'pending'),
    ])
    if (!staff || !entries) { setLoading(false); return }

    const latestMap = new Map<string, SavingsEntry>()
    for (const e of entries) {
      const cur = latestMap.get(e.staff_id)
      if (!cur || e.period_year > cur.period_year || (e.period_year === cur.period_year && e.period_month > cur.period_month)) {
        latestMap.set(e.staff_id, e)
      }
    }

    const enriched: StaffWithBalance[] = staff.map(s => {
      const latest = latestMap.get(s.id)
      return {
        ...s,
        balance: latest?.running_balance ?? 0,
        lastPeriod: latest ? `${MONTHS[latest.period_month - 1]} ${latest.period_year}` : '—',
      }
    })

    setTotalBalance(enriched.reduce((sum, s) => sum + s.balance, 0))
    setActiveCount(enriched.filter(s => s.status === 'active').length)
    setStaffList(enriched)

    const thisMonth = entries.filter(e => e.period_month === curMonth && e.period_year === curYear)
    setMonthSaved(thisMonth.reduce((s, e) => s + e.savings_amount, 0))
    setMonthWithdrawn(thisMonth.reduce((s, e) => s + e.withdrawal_amount, 0))
    setPendingCount(pending?.length ?? 0)
    setLoading(false)
  }

  function toggleSort(key: SortKey) {
    if (sort === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSort(key); setSortDir(key === 'balance' ? 'desc' : 'asc') }
  }

  const sorted = [...staffList].sort((a, b) => {
    let cmp = 0
    if (sort === 'name') cmp = a.full_name.localeCompare(b.full_name)
    else if (sort === 'balance') cmp = a.balance - b.balance
    else if (sort === 'date_joined') cmp = a.date_joined.localeCompare(b.date_joined)
    return sortDir === 'asc' ? cmp : -cmp
  })

  function exportCSV() {
    const header = 'Name,Role,Email,Phone,Date Joined,Status,Balance (₦)'
    const rows = staffList.map(s =>
      [s.full_name, s.role, s.email, s.phone ?? '', s.date_joined, s.status, (s.balance / 100).toFixed(2)].join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n'), { type: 'text/csv' }] as BlobPart[])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mps-savings-${curYear}-${String(curMonth).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function printStatement(s: StaffWithBalance) {
    const { data: entries } = await supabase
      .from('savings_entries').select('*').eq('staff_id', s.id)
      .order('period_year', { ascending: true }).order('period_month', { ascending: true })
    const rows = (entries ?? []).map(e =>
      `<tr><td>${MONTHS[e.period_month-1]} ${e.period_year}</td><td>₦${(e.gross_salary/100).toLocaleString()}</td><td>₦${(e.savings_amount/100).toLocaleString()}</td><td>${e.withdrawal_amount > 0 ? '₦'+(e.withdrawal_amount/100).toLocaleString() : '—'}</td><td><b>₦${(e.running_balance/100).toLocaleString()}</b></td><td>${e.notes??''}</td></tr>`
    ).join('')
    const html = `<!DOCTYPE html><html><head><title>Statement — ${s.full_name}</title><style>body{font-family:system-ui,sans-serif;padding:32px;max-width:720px;margin:auto;color:#1c1917}h1{font-size:20px;margin-bottom:4px}p{font-size:13px;color:#57534e;margin:2px 0}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #e7e5e4;padding:9px 12px;text-align:left;font-size:13px}th{background:#fafaf9;font-weight:600;color:#44403c}.total{font-size:16px;font-weight:700;color:#1a3318;margin-top:16px}@media print{button{display:none}}</style></head><body>
    <h1>MPS Staff Savings — Statement</h1>
    <p><b>${s.full_name}</b> · ${s.role}</p>
    <p>Generated: ${new Date().toLocaleDateString('en-NG', {day:'numeric',month:'long',year:'numeric'})}</p>
    <p class="total">Current Balance: ₦${(s.balance/100).toLocaleString('en-NG',{minimumFractionDigits:2})}</p>
    <table><thead><tr><th>Period</th><th>Gross Salary</th><th>Saved</th><th>Withdrawn</th><th>Balance</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>
    <br><button onclick="window.print()" style="margin-top:16px;padding:8px 20px;background:#3f7d37;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print Statement</button></body></html>`
    const w = window.open('', '_blank')
    w?.document.write(html)
    w?.document.close()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-stone-400">Loading dashboard…</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-stone-800">Good {greeting()}, Admin 👋</h2>
        <p className="text-sm text-stone-500 mt-0.5">{MONTHS[curMonth-1]} {curYear} · {activeCount} active staff</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Total Savings Held"
          value={formatNaira(totalBalance)}
          sub="across all staff"
          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>}
          accent
        />
        <StatCard
          label="Saved This Month"
          value={formatNaira(monthSaved)}
          sub={`${MONTHS[curMonth-1]} ${curYear}`}
          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>}
          color="emerald"
        />
        <StatCard
          label="Withdrawn"
          value={formatNaira(monthWithdrawn)}
          sub="this month"
          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 00-10 0v2M5 9h14l1 12H4L5 9z"/>}
          color="rose"
        />
        <StatCard
          label="Pending Requests"
          value={String(pendingCount)}
          sub={pendingCount > 0 ? 'needs attention' : 'all clear'}
          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>}
          color={pendingCount > 0 ? 'amber' : 'stone'}
          onClick={pendingCount > 0 ? () => navigate('/admin/withdrawals') : undefined}
        />
      </div>

      {/* Staff balances */}
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-[0_1px_3px_0_rgb(0,0,0,0.06)]">
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div>
            <p className="font-semibold text-stone-800 text-[15px]">Staff Balances</p>
            <p className="text-xs text-stone-400 mt-0.5">{staffList.length} members</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 bg-stone-100 rounded-lg p-1">
              {(['name', 'balance', 'date_joined'] as SortKey[]).map(k => (
                <button key={k} onClick={() => toggleSort(k)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${sort === k ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
                  {k === 'date_joined' ? 'Joined' : k === 'balance' ? 'Balance' : 'Name'}
                  {sort === k && <span className="ml-1 opacity-60">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </button>
              ))}
            </div>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors border border-brand-200/60">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Export
            </button>
          </div>
        </div>

        {/* Mobile list */}
        <div className="sm:hidden divide-y divide-stone-50">
          {sorted.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className={`w-9 h-9 rounded-full ${avatarColor(s.full_name)} flex items-center justify-center shrink-0`}>
                <span className="text-white text-xs font-bold">{initials(s.full_name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-800 text-sm truncate">{s.full_name}</p>
                <p className="text-xs text-stone-400">{s.role}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-stone-800 text-sm">{formatNaira(s.balance)}</p>
                <button onClick={() => printStatement(s)} className="text-[11px] text-brand-600 hover:text-brand-800 font-medium">Statement</button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <table className="w-full text-sm hidden sm:table">
          <thead>
            <tr className="bg-stone-50/60 border-b border-stone-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Staff Member</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Last Entry</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Balance</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {sorted.map(s => (
              <tr key={s.id} className="hover:bg-stone-50/60 transition-colors group">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${avatarColor(s.full_name)} flex items-center justify-center shrink-0`}>
                      <span className="text-white text-xs font-bold">{initials(s.full_name)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-stone-800 text-[13px]">{s.full_name}</p>
                      <p className="text-xs text-stone-400">{s.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-stone-600 text-[13px]">{s.role}</td>
                <td className="px-4 py-3.5 text-stone-500 text-xs">{s.lastPeriod}</td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-stone-100 text-stone-500 border border-stone-200'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'active' ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                    {s.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className="font-bold text-stone-800 text-[13px] font-mono">{formatNaira(s.balance)}</span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <button onClick={() => printStatement(s)}
                    className="text-xs text-brand-600 hover:text-brand-800 font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-md">
                    Statement
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-stone-400 text-sm">No staff added yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function StatCard({ label, value, sub, icon, accent, color, onClick }: {
  label: string; value: string; sub: string
  icon: React.ReactNode; accent?: boolean; color?: string; onClick?: () => void
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200/60 text-emerald-600',
    rose:    'bg-rose-50 border-rose-200/60 text-rose-600',
    amber:   'bg-amber-50 border-amber-200/60 text-amber-600',
    stone:   'bg-stone-50 border-stone-200/60 text-stone-500',
  }
  const iconBg = accent
    ? 'bg-white/20 text-white'
    : colorMap[color ?? 'stone']

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl p-4 md:p-5 border transition-all ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''} ${
        accent
          ? 'bg-gradient-to-br from-brand-700 to-brand-900 border-brand-800 text-white shadow-lg shadow-brand-900/20'
          : 'bg-white border-stone-200/80 shadow-[0_1px_3px_0_rgb(0,0,0,0.05)]'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className={`text-xs font-medium uppercase tracking-wide ${accent ? 'text-brand-200' : 'text-stone-500'}`}>{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">{icon}</svg>
        </div>
      </div>
      <p className={`text-2xl font-bold tracking-tight ${accent ? 'text-white' : 'text-stone-800'}`}>{value}</p>
      <p className={`text-xs mt-1 ${accent ? 'text-brand-300' : 'text-stone-400'}`}>{sub}</p>
    </div>
  )
}
