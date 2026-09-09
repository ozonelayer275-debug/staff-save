import { AFFECTIVE_TRAITS_MAIN, AFFECTIVE_TRAITS_SECONDARY, PSYCHOMOTOR_SKILLS, REPORT_TEAL } from './reportCardConstants'

const cellStyle: React.CSSProperties = { border: '1px solid #d6d3d1', padding: '3px 6px', fontSize: '9px' }
const headStyle: React.CSSProperties = { ...cellStyle, background: REPORT_TEAL, color: '#fff', fontWeight: 700, textTransform: 'uppercase' as const }

function TraitRow({ label, value }: { label: string; value: number | undefined }) {
  return (
    <tr>
      <td style={cellStyle}>{label}</td>
      <td style={{ ...cellStyle, textAlign: 'center', width: '20%' }}>{value ?? '—'}</td>
    </tr>
  )
}

export default function AffectivePsychomotorFooter({ affectiveTraits, affectiveTraitsSecondary, psychomotorSkills }: {
  affectiveTraits: Record<string, number>
  affectiveTraitsSecondary: Record<string, number>
  psychomotorSkills: Record<string, number>
}) {
  return (
    <div style={{ display: 'flex', gap: '8px', fontSize: '9px' }}>
      <table style={{ borderCollapse: 'collapse', flex: 1 }}>
        <thead><tr><th colSpan={2} style={headStyle}>Affective Traits</th></tr></thead>
        <tbody>
          {AFFECTIVE_TRAITS_MAIN.map(t => <TraitRow key={t} label={t} value={affectiveTraits[t]} />)}
        </tbody>
      </table>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead><tr><th colSpan={2} style={headStyle}>Affective Traits</th></tr></thead>
          <tbody>
            {AFFECTIVE_TRAITS_SECONDARY.map(t => <TraitRow key={t} label={t} value={affectiveTraitsSecondary[t]} />)}
          </tbody>
        </table>

        <table style={{ borderCollapse: 'collapse' }}>
          <thead><tr><th colSpan={2} style={headStyle}>Psychomotor Skills</th></tr></thead>
          <tbody>
            {PSYCHOMOTOR_SKILLS.map(t => <TraitRow key={t} label={t} value={psychomotorSkills[t]} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
