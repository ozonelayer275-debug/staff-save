import type { GradingScaleRow } from '@/lib/types'
import { RATING_LEGEND, REPORT_TEAL } from './reportCardConstants'

const cellStyle: React.CSSProperties = { border: '1px solid #d6d3d1', padding: '2px 6px', fontSize: '8px' }
const headStyle: React.CSSProperties = { ...cellStyle, background: REPORT_TEAL, color: '#fff', fontWeight: 700 }

export default function GradingScaleLegend({ scale }: { scale: GradingScaleRow[] }) {
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <table style={{ borderCollapse: 'collapse', flex: 1 }}>
        <thead>
          <tr>
            <th style={headStyle}>Score Range</th>
            <th style={headStyle}>Grade</th>
            <th style={headStyle}>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {scale.map(s => (
            <tr key={s.grade}>
              <td style={cellStyle}>{s.min_score}% – {s.max_score}%</td>
              <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>{s.grade}</td>
              <td style={cellStyle}>{s.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ borderCollapse: 'collapse', flex: 1 }}>
        <thead><tr><th colSpan={2} style={headStyle}>Observation Rating Guide</th></tr></thead>
        <tbody>
          {RATING_LEGEND.map(r => (
            <tr key={r.rating}>
              <td style={{ ...cellStyle, textAlign: 'center', width: '10%', fontWeight: 700 }}>{r.rating}</td>
              <td style={cellStyle}>{r.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
