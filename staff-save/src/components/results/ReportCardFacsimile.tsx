import { useState } from 'react'
import type { ReportCardData } from './reportCardTypes'
import { REPORT_TEAL, TERM_ORDINALS } from './reportCardConstants'
import SubjectTable from './SubjectTable'
import AffectivePsychomotorFooter from './AffectivePsychomotorFooter'
import GradingScaleLegend from './GradingScaleLegend'
import StudentPhoto from './StudentPhoto'

const infoCell: React.CSSProperties = { border: '1px solid #d6d3d1', padding: '4px 8px', fontSize: '9px' }
const infoLabel: React.CSSProperties = { color: '#57534e', fontWeight: 600, marginRight: '4px' }

export default function ReportCardFacsimile({ data }: { data: ReportCardData }) {
  const [logoFailed, setLogoFailed] = useState(false)
  const s = data.summary

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#1c1917', background: '#fff', width: '210mm', minHeight: '297mm', padding: '10mm', boxSizing: 'border-box' }}>
      {/* Letterhead */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: `2px solid ${REPORT_TEAL}`, paddingBottom: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ width: '56px', height: '56px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!logoFailed ? (
              <img src="/logo.png" alt="School logo" onError={() => setLogoFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', borderRadius: '8px', border: `2px solid ${REPORT_TEAL}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: REPORT_TEAL, textAlign: 'center', fontWeight: 700 }}>
                LOGO
              </div>
            )}
          </div>
          <div>
            <p style={{ fontSize: '18px', fontWeight: 800, color: REPORT_TEAL, margin: 0, letterSpacing: '0.3px' }}>{data.school.name}</p>
            <p style={{ fontSize: '9px', fontStyle: 'italic', color: '#57534e', margin: '1px 0' }}>{data.school.tagline}</p>
            <p style={{ fontSize: '8px', color: '#57534e', margin: '1px 0' }}>{data.school.address}</p>
            <p style={{ fontSize: '8px', color: '#57534e', margin: '1px 0' }}>Phone: {data.school.phone}</p>
            <p style={{ fontSize: '8px', color: '#1d4ed8', margin: '1px 0' }}>{data.school.email}</p>
          </div>
        </div>
        <StudentPhoto url={data.student.photoUrl} name={data.student.fullName} size="lg" />
      </div>

      <p style={{ textAlign: 'center', fontWeight: 800, fontSize: '13px', letterSpacing: '0.5px', margin: '4px 0 8px' }}>
        {TERM_ORDINALS[data.term.number]} TERM {data.term.session}
      </p>

      {/* Info grid */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px' }}>
        <tbody>
          <tr>
            <td style={infoCell}><span style={infoLabel}>Session</span>{data.term.session}/Term{data.term.number}</td>
            <td style={infoCell}><span style={infoLabel}>Term</span>{TERM_ORDINALS[data.term.number]}</td>
            <td style={infoCell}><span style={infoLabel}>Age</span>{data.student.ageOrDob ?? '—'}, <span style={infoLabel}>Gender</span>{data.student.gender}</td>
          </tr>
          <tr>
            <td style={infoCell}><span style={infoLabel}>Name of student</span>{data.student.fullName}</td>
            <td style={infoCell}>
              <span style={infoLabel}>{data.student.level === 'ss' ? 'BECE No.' : 'Reg. No'}</span>{data.student.regNoOrBeceNo}
            </td>
            <td style={infoCell}><span style={infoLabel}>Next term begins</span>{data.term.nextTermBegins ?? '—'}</td>
          </tr>
          <tr>
            <td style={infoCell}><span style={infoLabel}>Class</span>{data.student.className}</td>
            <td style={infoCell}><span style={infoLabel}>Term ended</span>{data.term.termEnded ?? '—'}</td>
            <td style={infoCell} />
          </tr>
        </tbody>
      </table>

      {/* Summary block */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
        <tbody>
          <tr>
            <td style={infoCell}><span style={infoLabel}>Position in entire class</span>{s.positionInClass ?? '—'}</td>
            <td style={infoCell}><span style={infoLabel}>No. of students in class</span>{s.classSize ?? '—'}</td>
            <td style={infoCell}><span style={infoLabel}>No. of days school opened</span>{s.daysOpened}</td>
          </tr>
          <tr>
            <td style={infoCell}><span style={infoLabel}>Position in class section</span>{s.positionInSection ?? '—'}</td>
            <td style={infoCell}><span style={infoLabel}>No. of students in class section</span>{s.sectionSize ?? '—'}</td>
            <td style={infoCell}><span style={infoLabel}>No. of days present</span>{s.daysPresent}</td>
          </tr>
          <tr>
            <td style={infoCell}><span style={infoLabel}>Overall total score</span>{s.overallTotal ?? '—'}</td>
            <td style={infoCell}><span style={infoLabel}>Class section average score</span>{s.sectionAverage ?? '—'}</td>
            <td style={infoCell}><span style={infoLabel}>No. of days absent</span>{s.daysAbsent}</td>
          </tr>
          <tr>
            <td style={infoCell}><span style={infoLabel}>Student's average score</span>{s.overallAverage ?? '—'}</td>
            <td style={infoCell}><span style={infoLabel}>Lowest average in class section</span>{s.lowestAverageInSection ?? '—'}</td>
            <td style={{ ...infoCell, fontWeight: 700, color: REPORT_TEAL }}>
              {s.promotedToClassName ? `PROMOTED TO ${s.promotedToClassName}` : ''}
            </td>
          </tr>
          <tr>
            <td style={infoCell}><span style={infoLabel}>Highest average in class section</span>{s.highestAverageInSection ?? '—'}</td>
            <td style={infoCell}><span style={infoLabel}>Overall performance</span>{s.overallPerformance ?? '—'}</td>
            <td style={infoCell} />
          </tr>
        </tbody>
      </table>

      <SubjectTable level={data.student.level} subjects={data.subjects} />

      <div style={{ height: '8px' }} />

      <AffectivePsychomotorFooter
        affectiveTraits={data.affectiveTraits}
        affectiveTraitsSecondary={data.affectiveTraitsSecondary}
        psychomotorSkills={data.psychomotorSkills}
      />

      <div style={{ height: '8px' }} />

      <GradingScaleLegend scale={data.gradingScale} />

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
        <tbody>
          <ReportRow label="Academic adviser's report" value={data.reports.adviser} />
          <ReportRow label="Form master's report" value={data.reports.formMaster} />
          <ReportRow label="Principal's report" value={data.reports.principal} />
        </tbody>
      </table>
    </div>
  )
}

function ReportRow({ label, value }: { label: string; value: string | null }) {
  return (
    <tr>
      <td style={{ border: '1px solid #d6d3d1', padding: '4px 8px', fontSize: '9px', fontWeight: 700, width: '18%', background: '#f7f7f5' }}>{label}</td>
      <td style={{ border: '1px solid #d6d3d1', padding: '4px 8px', fontSize: '9px' }}>{value || '—'}</td>
    </tr>
  )
}
