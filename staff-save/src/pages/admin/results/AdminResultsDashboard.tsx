import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

interface Counts {
  classes: number
  subjects: number
  students: number
  enabledAssignments: number
  totalAssignments: number
}

export default function AdminResultsDashboard() {
  const [counts, setCounts] = useState<Counts | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ count: classes }, { count: subjects }, { count: students }, { data: assignments }] = await Promise.all([
      supabase.from('results_classes').select('id', { count: 'exact', head: true }),
      supabase.from('results_subjects').select('id', { count: 'exact', head: true }),
      supabase.from('results_students').select('id', { count: 'exact', head: true }),
      supabase.from('results_class_assignments').select('results_access_enabled'),
    ])
    setCounts({
      classes: classes ?? 0,
      subjects: subjects ?? 0,
      students: students ?? 0,
      enabledAssignments: (assignments ?? []).filter(a => a.results_access_enabled).length,
      totalAssignments: (assignments ?? []).length,
    })
  }

  if (!counts) return <div className="text-sm text-stone-400 py-8 text-center">Loading…</div>

  const setupIncomplete = counts.classes === 0 || counts.subjects === 0

  return (
    <div className="space-y-5">
      {setupIncomplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800">Setup needed before staff can enter results</p>
          <p className="text-xs text-amber-700 mt-1">
            {counts.classes === 0 && 'Add at least one class. '}
            {counts.subjects === 0 && 'Add subjects and assign them to classes. '}
            Then assign staff to their classes and enable Results access.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Classes" value={counts.classes} to="/admin/results/classes" />
        <StatCard label="Subjects" value={counts.subjects} to="/admin/results/subjects" />
        <StatCard label="Students" value={counts.students} to="/admin/results/classes" />
        <StatCard
          label="Staff Access Enabled"
          value={`${counts.enabledAssignments}/${counts.totalAssignments}`}
          to="/admin/results/assignments"
        />
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/80 p-5">
        <p className="font-semibold text-stone-800 text-[15px] mb-1">Review Queue</p>
        <p className="text-sm text-stone-500 mb-3">
          Missing scores, outlier flags, and submitted-but-unreviewed entries will surface here once staff begin entering results.
        </p>
        <Link to="/admin/results/review" className="text-sm text-brand-700 hover:text-brand-900 font-medium">
          Open Review Queue →
        </Link>
      </div>
    </div>
  )
}

function StatCard({ label, value, to }: { label: string; value: string | number; to: string }) {
  return (
    <Link to={to} className="bg-white rounded-2xl p-4 md:p-5 border border-stone-200/80 shadow-[0_1px_3px_0_rgb(0,0,0,0.05)] hover:border-brand-300 transition-colors block">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500 mb-2">{label}</p>
      <p className="text-2xl font-bold tracking-tight text-stone-800">{value}</p>
    </Link>
  )
}
