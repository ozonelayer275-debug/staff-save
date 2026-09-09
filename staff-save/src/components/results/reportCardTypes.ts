import type { GradingScaleRow, ResultLevel, Term } from '../../lib/types.js'

export interface ReportCardSubjectRow {
  name: string
  test1: number
  test2: number
  exam: number
  total: number
  grade: string | null
  remark: string | null
  subjectPosition: number | null
  classAverage: number | null
  highestInClass: number | null
  lowestInClass: number | null
  cumulativeAverage: number | null // JSS only
  weightedScore: number | null     // SS only
}

export interface ReportCardData {
  school: { name: string; tagline: string; address: string; phone: string; email: string }
  student: {
    fullName: string
    className: string
    level: ResultLevel
    gender: 'M' | 'F'
    ageOrDob: string | null
    photoUrl: string | null
    regNoOrBeceNo: string
  }
  term: {
    number: Term
    session: string
    termEnded: string | null
    nextTermBegins: string | null
  }
  summary: {
    positionInClass: number | null
    classSize: number | null
    positionInSection: number | null
    sectionSize: number | null
    overallTotal: number | null
    overallAverage: number | null
    sectionAverage: number | null
    highestAverageInSection: number | null
    lowestAverageInSection: number | null
    overallPerformance: string | null
    daysOpened: number
    daysPresent: number
    daysAbsent: number
    promotedToClassName: string | null
  }
  subjects: ReportCardSubjectRow[]
  affectiveTraits: Record<string, number>
  affectiveTraitsSecondary: Record<string, number>
  psychomotorSkills: Record<string, number>
  gradingScale: GradingScaleRow[]
  reports: { adviser: string | null; formMaster: string | null; principal: string | null }
}
