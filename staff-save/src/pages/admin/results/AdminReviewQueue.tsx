import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { ClassRow, ResultEntryRow, SubjectRow, Term } from '@/lib/types'

interface ClassSummary {
  cls: ClassRow
  studentCount: number
  submitted: { term: Term; subject: SubjectRow; count: number }[]
  outliers: { term: Term; subject: SubjectRow; studentName: string; total: number; classAverage: number }[]
  missing: { term: Term; subject: SubjectRow; count: number }[]
}

export default function AdminReviewQueue() {
  const [summaries, setSummaries] = useState<ClassSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: classes }, { data: classSubjects }, { data: students }, { data: entries }] = await Promise.all([
      supabase.from('results_classes').select('*'),
      supabase.from('results_class_subjects').select('class_id, subject_id, subjects:results_subjects(*)'),
      supabase.from('results_students').select('id, class_id'),
      supabase.from('results_entries').select('*, students:results_students(first_name, last_name)'),
    ])

    const studentCountByClass = new Map<string, number>()
    for (const s of students ?? []) studentCountByClass.set(s.class_id, (studentCountByClass.get(s.class_id) ?? 0) + 1)

    const subjectsByClass = new Map<string, SubjectRow[]>()
    for (const cs of classSubjects ?? []) {
      const list = subjectsByClass.get((cs as any).class_id) ?? []
      if ((cs as any).subjects) list.push((cs as any).subjects)
      subjectsByClass.set((cs as any).class_id, list)
    }

    const entryRows = (entries ?? []) as (ResultEntryRow & { students: { first_name: string; last_name: string } | null })[]

    const result: ClassSummary[] = (classes ?? []).map(cls => {
      const classEntries = entryRows.filter(e => e.class_id === cls.id)
      const classSubjectList = subjectsByClass.get(cls.id) ?? []
      const studentCount = studentCountByClass.get(cls.id) ?? 0

      const submitted: ClassSummary['submitted'] = []
      const outliers: ClassSummary['outliers'] = []
      const missing: ClassSummary['missing'] = []

      for (const term of ['1', '2', '3'] as Term[]) {
        for (const subject of classSubjectList) {
          const combo = classEntries.filter(e => e.term === term && e.subject_id === subject.id)
          if (combo.length === 0) continue // not started — not a review-queue concern

          const submittedCount = combo.filter(e => e.status === 'submitted').length
          if (submittedCount > 0) submitted.push({ term, subject, count: submittedCount })

          if (studentCount > combo.length) {
            missing.push({ term, subject, count: studentCount - combo.length })
          }

          for (const e of combo) {
            if (e.status !== 'draft' && e.class_average != null && Math.abs(e.total - e.class_average) > 25) {
              outliers.push({
                term, subject,
                studentName: e.students ? `${e.students.first_name} ${e.students.last_name}` : 'Unknown',
                total: e.total, classAverage: e.class_average,
              })
            }
          }
        }
      }

      return { cls, studentCount, submitted, outliers, missing }
    }).filter(s => s.submitted.length > 0 || s.outliers.length > 0 || s.missing.length > 0)

    setSummaries(result)
    setLoading(false)
  }

  if (loading) return <div className="text-sm text-stone-400 py-8 text-center">Loading review queue…</div>

  if (summaries.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 p-8 text-center">
        <p className="text-sm text-stone-500">
          Nothing needs attention right now. Missing scores, outlier flags, and submitted-but-unreviewed entries will appear here once staff begin entering results.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {summaries.map(s => (
        <div key={s.cls.id} className="bg-white rounded-2xl border border-stone-200/80 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-stone-800">{s.cls.name}{s.cls.section ? ` ${s.cls.section}` : ''}</p>
            <span className="text-xs text-stone-400">{s.cls.academic_session}</span>
          </div>

          {s.submitted.length > 0 && (
            <QueueSection title="Awaiting review" tone="sky">
              {s.submitted.map((row, i) => (
                <QueueRow key={i} classId={s.cls.id} subjectId={row.subject.id} term={row.term}
                  text={`${row.subject.name} · Term ${row.term} — ${row.count} submitted`} />
              ))}
            </QueueSection>
          )}

          {s.outliers.length > 0 && (
            <QueueSection title="Outlier flags" tone="rose">
              {s.outliers.map((row, i) => (
                <QueueRow key={i} classId={s.cls.id} subjectId={row.subject.id} term={row.term}
                  text={`${row.studentName} — ${row.subject.name} Term ${row.term}: total ${row.total} vs class average ${row.classAverage}`} />
              ))}
            </QueueSection>
          )}

          {s.missing.length > 0 && (
            <QueueSection title="Missing scores" tone="amber">
              {s.missing.map((row, i) => (
                <QueueRow key={i} classId={s.cls.id} subjectId={row.subject.id} term={row.term}
                  text={`${row.subject.name} · Term ${row.term} — ${row.count} student${row.count === 1 ? '' : 's'} not yet entered`} />
              ))}
            </QueueSection>
          )}
        </div>
      ))}
    </div>
  )
}

function QueueSection({ title, tone, children }: { title: string; tone: 'sky' | 'rose' | 'amber'; children: React.ReactNode }) {
  const dot = { sky: 'bg-sky-500', rose: 'bg-rose-500', amber: 'bg-amber-500' }[tone]
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function QueueRow({ classId, subjectId, term, text }: { classId: string; subjectId: string; term: Term; text: string }) {
  return (
    <Link
      to={`/admin/results/entry/${classId}/${subjectId}?term=${term}`}
      className="block text-sm text-stone-600 hover:text-brand-700 hover:bg-brand-50/60 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
    >
      {text}
    </Link>
  )
}
