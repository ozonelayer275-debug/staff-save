import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from './supabase.js'
import type { Term } from './types.js'
import type { ReportCardData } from '../components/results/reportCardTypes.js'

const SCHOOL = {
  name: 'MORE-DAYS PRIVATE SCHOOL.',
  tagline: 'We Find Wisdom In God',
  address: '3, MOREDAYS CLOSE, OFF UPPER ROOM STREET, IJERE ONIGBEDU, PAKURO, MOWE.',
  phone: '08035254630',
  email: 'moredaysprivatesch20@gmail.com',
}

// Accepts an injected client so the exact same query/transform logic runs
// client-side (anon key, RLS-scoped — on-screen preview) and server-side
// (service-role key, RLS-bypassed — the /print route the PDF pipeline
// navigates to). One implementation, no drift between preview and export.
export async function buildReportCardData(
  studentId: string, academicSession: string, term: Term, supabase: SupabaseClient = defaultClient,
): Promise<ReportCardData | null> {
  const [{ data: student }, { data: reportCard }, { data: entries }] = await Promise.all([
    supabase.from('results_students').select('*, classes:results_classes(*)').eq('id', studentId).single(),
    supabase.from('results_report_cards').select('*').eq('student_id', studentId).eq('academic_session', academicSession).eq('term', term).maybeSingle(),
    supabase.from('results_entries').select('*, subjects:results_subjects(name, display_order)').eq('student_id', studentId).eq('academic_session', academicSession).eq('term', term),
  ])

  if (!student) return null
  const cls = (student as any).classes
  if (!cls) return null

  const { data: gradingScale } = await supabase.from('results_grading_scales').select('*').eq('level', cls.level).order('display_order')

  let promotedToClassName: string | null = null
  if (reportCard?.promoted_to_class_id) {
    const { data: promotedClass } = await supabase.from('results_classes').select('name, section').eq('id', reportCard.promoted_to_class_id).single()
    if (promotedClass) promotedToClassName = `${promotedClass.name}${promotedClass.section ? ` ${promotedClass.section}` : ''}`
  }

  const subjects = (entries ?? [])
    .slice()
    .sort((a: any, b: any) => (a.subjects?.display_order ?? 0) - (b.subjects?.display_order ?? 0))
    .map((e: any) => ({
      name: e.subjects?.name ?? '—',
      test1: e.test1, test2: e.test2, exam: e.exam, total: e.total,
      grade: e.grade, remark: e.remark,
      subjectPosition: e.subject_position, classAverage: e.class_average,
      highestInClass: e.highest_in_class, lowestInClass: e.lowest_in_class,
      cumulativeAverage: e.cumulative_average, weightedScore: e.weighted_score,
    }))

  return {
    school: SCHOOL,
    student: {
      fullName: `${student.first_name} ${student.last_name}`,
      className: `${cls.name}${cls.section ? ` ${cls.section}` : ''}`,
      level: cls.level,
      gender: student.gender,
      ageOrDob: student.age_or_dob,
      photoUrl: student.photo_url,
      regNoOrBeceNo: student.reg_no_or_bece_no,
    },
    term: {
      number: term,
      session: academicSession,
      termEnded: null,
      nextTermBegins: null,
    },
    summary: {
      positionInClass: reportCard?.position_in_class ?? null,
      classSize: reportCard?.class_size ?? null,
      positionInSection: reportCard?.position_in_section ?? null,
      sectionSize: reportCard?.section_size ?? null,
      overallTotal: reportCard?.overall_total ?? null,
      overallAverage: reportCard?.overall_average ?? null,
      sectionAverage: reportCard?.section_average ?? null,
      highestAverageInSection: reportCard?.highest_average_in_section ?? null,
      lowestAverageInSection: reportCard?.lowest_average_in_section ?? null,
      overallPerformance: reportCard?.overall_performance ?? null,
      daysOpened: reportCard?.attendance_opened ?? 0,
      daysPresent: reportCard?.attendance_present ?? 0,
      daysAbsent: reportCard?.attendance_absent ?? 0,
      promotedToClassName,
    },
    subjects,
    // affective_traits stores both the 13-item main block and the 3-item secondary
    // block (Spirit of teamwork/Initiatives/Organizational ability) flat in one jsonb
    // object — the two label sets never collide, so the facsimile/form split them by
    // key membership (see reportCardConstants) rather than needing two DB columns.
    affectiveTraits: (reportCard?.affective_traits as Record<string, number>) ?? {},
    affectiveTraitsSecondary: (reportCard?.affective_traits as Record<string, number>) ?? {},
    psychomotorSkills: (reportCard?.psychomotor_skills as Record<string, number>) ?? {},
    gradingScale: gradingScale ?? [],
    reports: {
      adviser: reportCard?.adviser_report ?? null,
      formMaster: reportCard?.form_master_report ?? null,
      principal: reportCard?.principal_report ?? null,
    },
  }
}
