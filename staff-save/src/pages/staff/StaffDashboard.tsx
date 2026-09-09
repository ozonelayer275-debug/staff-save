import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatNaira } from '@/lib/types'
import type { SavingsEntry, StaffRow } from '@/lib/types'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export default function StaffDashboard() {
  const [staff, setStaff] = useState<StaffRow | null>(null)
  const [entries, setEntries] = useState<SavingsEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: staffRow } = await supabase
        .from('staff').select('*').eq('auth_user_id', user.id).maybeSingle()

      if (!staffRow) { setLoading(false); return }
      setStaff(staffRow)

      const { data } = await supabase
        .from('savings_entries').select('*').eq('staff_id', staffRow.id)
        .order('period_year', { ascending: false }).order('period_month', { ascending: false })

      setEntries(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-7 h-7 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!staff) return (
    <div className="mt-6 bg-white rounded-2xl p-8 text-center border border-stone-200/80 shadow-sm">
      <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <p className="font-semibold text-stone-800 text-base">Account pending setup</p>
      <p className="text-sm text-stone-400 mt-2 leading-relaxed max-w-xs mx-auto">
        Your account is registered. The admin will link your savings profile shortly.
      </p>
    </div>
  )

  const latest = entries[0] ?? null
  const balance = latest?.running_balance ?? 0
  const asOf = latest ? `${MONTHS[latest.period_month - 1]} ${latest.period_year}` : null
  const totalSaved = entries.reduce((s, e) => s + e.savings_amount, 0)
  const totalWithdrawn = entries.reduce((s, e) => s + e.withdrawal_amount, 0)

  return (
    <div className="space-y-4 pt-2 max-w-lg mx-auto">

      {/* Hero balance card */}
      <div className="relative bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 rounded-3xl p-5 overflow-hidden shadow-xl shadow-brand-900/30">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-6 w-48 h-48 rounded-full bg-white/5" />

        <div className="relative">
          {/* Avatar + name */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 shrink-0 rounded-full bg-brand-400/40 border-2 border-brand-300/40 flex items-center justify-center">
              <span className="text-white font-bold text-xs">{initials(staff.full_name)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight truncate">{staff.full_name}</p>
              <p className="text-brand-300 text-xs truncate">{staff.role}</p>
            </div>
          </div>

          {/* Balance */}
          <p className="text-brand-200 text-xs font-medium uppercase tracking-widest mb-1">Current Balance</p>
          <p className="text-white text-3xl sm:text-4xl font-bold tracking-tight leading-none break-all">{formatNaira(balance)}</p>
          {asOf
            ? <p className="text-brand-300 text-xs mt-2">as of {asOf}</p>
            : <p className="text-brand-300 text-xs mt-2">No entries recorded yet</p>
          }

          {/* Mini stats row */}
          {entries.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-brand-300 text-[10px] uppercase tracking-wide">Total Saved</p>
                <p className="text-white font-semibold text-xs mt-0.5 break-all">{formatNaira(totalSaved)}</p>
              </div>
              <div className="border-x border-white/10 px-2">
                <p className="text-brand-300 text-[10px] uppercase tracking-wide">Withdrawn</p>
                <p className="text-white font-semibold text-xs mt-0.5 break-all">{formatNaira(totalWithdrawn)}</p>
              </div>
              <div className="pl-2">
                <p className="text-brand-300 text-[10px] uppercase tracking-wide">Months</p>
                <p className="text-white font-semibold text-xs mt-0.5">{entries.length}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      {entries.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <p className="font-semibold text-stone-800 text-[15px]">Recent Activity</p>
          </div>
          {entries.slice(0, 3).map((e, i) => (
            <div key={e.id} className={`flex items-center justify-between px-5 py-3.5 ${i < 2 ? 'border-b border-stone-50' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-700">{MONTHS[e.period_month - 1]} {e.period_year}</p>
                  {e.notes && <p className="text-xs text-stone-400">{e.notes}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-600">+{formatNaira(e.savings_amount)}</p>
                {e.withdrawal_amount > 0 && (
                  <p className="text-xs text-rose-500">-{formatNaira(e.withdrawal_amount)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
