import type { ResultLevel } from '@/lib/types'
import type { ReportCardSubjectRow } from './reportCardTypes'
import { REPORT_TEAL, SUBJECT_TABLE_MIN_ROWS } from './reportCardConstants'

interface Column {
  key: string
  label: string
  rotated: boolean
  width: string
  render: (row: ReportCardSubjectRow) => React.ReactNode
}

function remarkColor(remark: string | null) {
  if (!remark) return '#44403c'
  const m = remark.toLowerCase()
  if (m.includes('excellent') || m.includes('very good') || m.includes('good')) return '#15803d'
  if (m.includes('credit') || m.includes('pass')) return '#1d4ed8'
  return '#b91c1c' // Poor / Fail
}

function buildColumns(level: ResultLevel): Column[] {
  const shared: Column[] = [
    { key: 'test1', label: 'TEST 1 (20)', rotated: true, width: '5%', render: r => r.test1 },
    { key: 'test2', label: 'TEST 2 (20)', rotated: true, width: '5%', render: r => r.test2 },
    { key: 'exam', label: 'EXAM (60)', rotated: true, width: '5%', render: r => r.exam },
    { key: 'total', label: 'TOTAL (100)', rotated: true, width: '6%', render: r => <strong>{r.total}</strong> },
  ]

  if (level === 'jss') {
    return [
      { key: 'subject', label: 'SUBJECT', rotated: false, width: '20%', render: r => r.name },
      ...shared,
      { key: 'cumulative_average', label: 'CUMULATIVE AVERAGE', rotated: true, width: '7%', render: r => r.cumulativeAverage ?? '—' },
      { key: 'grade', label: 'GRADE', rotated: true, width: '5%', render: r => <strong>{r.grade ?? '—'}</strong> },
      { key: 'subject_position', label: 'SUBJECT POSITION', rotated: true, width: '6%', render: r => ordinal(r.subjectPosition) },
      { key: 'class_average', label: 'CLASS AVERAGE', rotated: true, width: '6%', render: r => r.classAverage ?? '—' },
      { key: 'highest_in_class', label: 'HIGHEST IN CLASS', rotated: true, width: '6%', render: r => r.highestInClass ?? '—' },
      { key: 'lowest_in_class', label: 'LOWEST IN CLASS', rotated: true, width: '6%', render: r => r.lowestInClass ?? '—' },
      { key: 'remark', label: 'REMARK', rotated: false, width: '13%', render: r => <span style={{ color: remarkColor(r.remark) }}>{r.remark ?? '—'}</span> },
    ]
  }

  return [
    { key: 'subject', label: 'SUBJECT', rotated: false, width: '18%', render: r => r.name },
    ...shared,
    { key: 'grade', label: 'GRADE', rotated: true, width: '5%', render: r => <strong>{r.grade ?? '—'}</strong> },
    { key: 'subject_position', label: 'SUBJECT POSITION', rotated: true, width: '6%', render: r => ordinal(r.subjectPosition) },
    { key: 'class_average', label: 'CLASS AVERAGE', rotated: true, width: '6%', render: r => r.classAverage ?? '—' },
    { key: 'weighted_score', label: 'WEIGHTED SCORE', rotated: true, width: '7%', render: r => r.weightedScore ?? '—' },
    { key: 'highest_in_subject', label: 'HIGHEST IN SUBJECT', rotated: true, width: '6%', render: r => r.highestInClass ?? '—' },
    { key: 'lowest_in_subject', label: 'LOWEST IN SUBJECT', rotated: true, width: '6%', render: r => r.lowestInClass ?? '—' },
    { key: 'remark', label: 'REMARK', rotated: false, width: '13%', render: r => <span style={{ color: remarkColor(r.remark) }}>{r.remark ?? '—'}</span> },
  ]
}

function ordinal(n: number | null) {
  if (n == null) return '—'
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function SubjectTable({ level, subjects }: { level: ResultLevel; subjects: ReportCardSubjectRow[] }) {
  const columns = buildColumns(level)
  const fillerCount = Math.max(0, SUBJECT_TABLE_MIN_ROWS - subjects.length)

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', tableLayout: 'fixed' }}>
      <colgroup>
        {columns.map(c => <col key={c.key} style={{ width: c.width }} />)}
      </colgroup>
      <thead>
        <tr style={{ background: REPORT_TEAL, color: '#fff' }}>
          {columns.map(c => (
            <th
              key={c.key}
              style={{
                border: '1px solid #fff', padding: c.rotated ? '4px 1px' : '6px 4px',
                fontSize: c.rotated ? '7px' : '9px', fontWeight: 700, textAlign: 'center',
                writingMode: c.rotated ? 'vertical-rl' : 'horizontal-tb',
                transform: c.rotated ? 'rotate(180deg)' : undefined,
                height: c.rotated ? '76px' : undefined,
                whiteSpace: 'nowrap',
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {subjects.map((row, i) => (
          <tr key={i} style={{ background: i % 2 === 1 ? '#f7f7f5' : '#fff' }}>
            {columns.map(c => (
              <td key={c.key} style={{ border: '1px solid #d6d3d1', padding: '3px 4px', textAlign: c.key === 'subject' || c.key === 'remark' ? 'left' : 'center' }}>
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
        {Array.from({ length: fillerCount }).map((_, i) => (
          <tr key={`filler-${i}`}>
            {columns.map(c => (
              <td key={c.key} style={{ border: '1px solid #d6d3d1', padding: '3px 4px', height: '18px' }}>&nbsp;</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
