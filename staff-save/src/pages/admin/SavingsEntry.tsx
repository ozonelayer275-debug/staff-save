import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatNaira } from '@/lib/types'
import type { StaffRow, SavingsEntry } from '@/lib/types'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface BulkRow {
  staff: StaffRow
  existing: SavingsEntry | null
  gross_salary: string
  savings_amount: string
  withdrawal_amount: string
  notes: string
}

export default function SavingsEntryPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [rows, setRows] = useState<BulkRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const userRef = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { userRef.current = data.user?.id ?? null })
  }, [])

  useEffect(() => { loadRows() }, [month, year])

  async function loadRows() {
    setLoading(true)
    const [{ data: staffList }, { data: entries }] = await Promise.all([
      supabase.from('staff').select('*').eq('status', 'active').order('full_name'),
      supabase.from('savings_entries').select('*').eq('period_month', month).eq('period_year', year),
    ])

    const entryMap = new Map((entries ?? []).map(e => [e.staff_id, e]))

    setRows((staffList ?? []).map(s => {
      const ex = entryMap.get(s.id) ?? null
      return {
        staff: s,
        existing: ex,
        gross_salary: ex ? String(ex.gross_salary / 100) : '',
        savings_amount: ex ? String(ex.savings_amount / 100) : '',
        withdrawal_amount: ex ? String(ex.withdrawal_amount / 100) : '',
        notes: ex?.notes ?? '',
      }
    }))
    setLoading(false)
  }

  function updateRow(idx: number, field: keyof Omit<BulkRow, 'staff' | 'existing'>, value: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  async function getPreviousBalance(staffId: string): Promise<number> {
    const { data } = await supabase
      .from('savings_entries')
      .select('running_balance, period_year, period_month')
      .eq('staff_id', staffId)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(2)

    if (!data || data.length === 0) return 0
    const prev = data.find(e => !(e.period_month === month && e.period_year === year))
    return prev?.running_balance ?? 0
  }

  async function handleSaveAll() {
    setSaving(true)
    setError(null)
    const userId = userRef.current
    if (!userId) { setError('Not authenticated'); setSaving(false); return }

    for (const row of rows) {
      const gross = Math.round(parseFloat(row.gross_salary || '0') * 100)
      const savings = Math.round(parseFloat(row.savings_amount || '0') * 100)
      const withdrawal = Math.round(parseFloat(row.withdrawal_amount || '0') * 100)
      if (gross === 0 && savings === 0) continue

      const prevBalance = await getPreviousBalance(row.staff.id)
      const running_balance = prevBalance + savings - withdrawal

      if (row.existing) {
        const historyEntry = {
          edited_at: new Date().toISOString(),
          edited_by: userId,
          previous: {
            gross_salary: row.existing.gross_salary,
            savings_amount: row.existing.savings_amount,
            withdrawal_amount: row.existing.withdrawal_amount,
            running_balance: row.existing.running_balance,
            notes: row.existing.notes,
          },
        }
        const { error: err } = await supabase.from('savings_entries').update({
          gross_salary: gross,
          savings_amount: savings,
          withdrawal_amount: withdrawal,
          running_balance,
          notes: row.notes || null,
          edited_at: new Date().toISOString(),
          edit_history: [...(row.existing.edit_history ?? []), historyEntry],
        }).eq('id', row.existing.id)
        if (err) { setError(err.message); setSaving(false); return }
      } else {
        const { error: err } = await supabase.from('savings_entries').insert({
          staff_id: row.staff.id,
          period_month: month,
          period_year: year,
          gross_salary: gross,
          savings_amount: savings,
          withdrawal_amount: withdrawal,
          running_balance,
          date_recorded: new Date().toISOString().split('T')[0],
          recorded_by: userId,
          notes: row.notes || null,
          edit_history: null,
        })
        if (err) { setError(err.message); setSaving(false); return }
      }
    }

    await loadRows()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-800 mr-auto">Savings Entry</h2>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((row, idx) => {
              const savings = parseFloat(row.savings_amount || '0') * 100
              const withdrawal = parseFloat(row.withdrawal_amount || '0') * 100
              const prevBal = row.existing
                ? row.existing.running_balance - row.existing.savings_amount + row.existing.withdrawal_amount
                : 0
              const projected = prevBal + savings - withdrawal
              return (
                <div key={row.staff.id} className={`bg-white rounded-xl border p-4 space-y-3 ${row.existing ? 'border-amber-200' : 'border-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-800 text-sm">{row.staff.full_name}</p>
                    <div className="flex items-center gap-2">
                      {row.existing && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">edit</span>}
                      <span className="text-xs font-mono font-semibold text-brand-700">{formatNaira(projected)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Gross Salary (₦)</label>
                      <NumInput value={row.gross_salary} onChange={v => updateRow(idx, 'gross_salary', v)} onTab={() => focusCell(idx, 'savings')} id={`gross-${idx}`} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Savings (₦)</label>
                      <NumInput value={row.savings_amount} onChange={v => updateRow(idx, 'savings_amount', v)} onTab={() => focusCell(idx, 'withdrawal')} id={`savings-${idx}`} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Withdrawal (₦)</label>
                      <NumInput value={row.withdrawal_amount} onChange={v => updateRow(idx, 'withdrawal_amount', v)} onTab={() => focusCell(idx, 'notes')} id={`withdrawal-${idx}`} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Notes</label>
                      <input
                        id={`notes-${idx}`}
                        value={row.notes}
                        onChange={e => updateRow(idx, 'notes', e.target.value)}
                        placeholder="optional"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Staff</th>
                  <th className="text-left px-4 py-3">Gross Salary (₦)</th>
                  <th className="text-left px-4 py-3">Savings (₦)</th>
                  <th className="text-left px-4 py-3">Withdrawal (₦)</th>
                  <th className="text-left px-4 py-3">Balance</th>
                  <th className="text-left px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, idx) => {
                  const savings = parseFloat(row.savings_amount || '0') * 100
                  const withdrawal = parseFloat(row.withdrawal_amount || '0') * 100
                  const prevBal = row.existing
                    ? row.existing.running_balance - row.existing.savings_amount + row.existing.withdrawal_amount
                    : 0
                  const projected = prevBal + savings - withdrawal
                  return (
                    <tr key={row.staff.id} className={row.existing ? 'bg-amber-50/40' : ''}>
                      <td className="px-4 py-2 font-medium text-gray-800 whitespace-nowrap">
                        {row.staff.full_name}
                        {row.existing && <span className="ml-1 text-xs text-amber-600">(edit)</span>}
                      </td>
                      <td className="px-2 py-2">
                        <NumInput value={row.gross_salary} onChange={v => updateRow(idx, 'gross_salary', v)} onTab={() => focusCell(idx, 'savings')} id={`gross-${idx}`} />
                      </td>
                      <td className="px-2 py-2">
                        <NumInput value={row.savings_amount} onChange={v => updateRow(idx, 'savings_amount', v)} onTab={() => focusCell(idx, 'withdrawal')} id={`savings-${idx}`} />
                      </td>
                      <td className="px-2 py-2">
                        <NumInput value={row.withdrawal_amount} onChange={v => updateRow(idx, 'withdrawal_amount', v)} onTab={() => focusCell(idx, 'notes')} id={`withdrawal-${idx}`} />
                      </td>
                      <td className="px-4 py-2 text-gray-700 whitespace-nowrap font-mono text-xs">
                        {formatNaira(projected)}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          id={`notes-${idx}`}
                          value={row.notes}
                          onChange={e => updateRow(idx, 'notes', e.target.value)}
                          onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); focusCell(idx + 1, 'gross') } }}
                          placeholder="optional"
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="w-full md:w-auto bg-brand-600 text-white text-sm px-6 py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : `Save ${MONTHS[month - 1]} ${year}`}
            </button>
            {saved && <span className="text-green-600 text-sm">✓ Saved successfully</span>}
          </div>
        </>
      )}
    </div>
  )
}

function NumInput({ value, onChange, onTab, id }: {
  value: string; onChange: (v: string) => void; onTab: () => void; id: string
}) {
  return (
    <input
      id={id} type="number" min="0" step="0.01" value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); onTab() } }}
      placeholder="0"
      className="w-full border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-400"
    />
  )
}

function focusCell(rowIdx: number, field: 'gross' | 'savings' | 'withdrawal' | 'notes') {
  document.getElementById(`${field}-${rowIdx}`)?.focus()
}
