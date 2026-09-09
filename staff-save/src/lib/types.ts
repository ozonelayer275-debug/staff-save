export type UserRole = 'admin' | 'staff'

export interface StaffRow {
  id: string
  full_name: string
  role: string
  phone: string | null
  email: string
  date_joined: string
  status: 'active' | 'inactive'
  auth_user_id: string | null
  created_at: string
}

export interface SavingsEntry {
  id: string
  staff_id: string
  period_month: number
  period_year: number
  gross_salary: number        // kobo
  savings_amount: number      // kobo
  withdrawal_amount: number   // kobo
  running_balance: number     // kobo
  date_recorded: string
  recorded_by: string
  notes: string | null
  created_at: string
  edited_at: string | null
  edit_history: EditHistoryEntry[] | null
}

export interface EditHistoryEntry {
  edited_at: string
  edited_by: string
  previous: Partial<SavingsEntry>
}

export interface WithdrawalRequest {
  id: string
  staff_id: string
  amount: number   // kobo
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  resolved_at: string | null
  resolved_by: string | null
}

export interface UserRoleRow {
  id: string
  user_id: string
  role: 'admin' | 'bursar'
  created_at: string
}

// ─── Results / report-card module ───────────────────────────────────────────

export type ResultLevel = 'jss' | 'ss'
export type Term = '1' | '2' | '3'
export type ResultStatus = 'draft' | 'submitted' | 'approved' | 'locked'

export interface ClassRow {
  id: string
  name: string
  level: ResultLevel
  section: string | null
  academic_session: string
  created_at: string
}

export interface SubjectRow {
  id: string
  name: string
  level: ResultLevel
  weight: number
  display_order: number
}

export interface ClassSubjectRow {
  id: string
  class_id: string
  subject_id: string
}

export interface ClassAssignmentRow {
  id: string
  staff_id: string
  class_id: string
  academic_session: string
  results_access_enabled: boolean
  created_at: string
  created_by: string | null
}

export interface GradingScaleRow {
  id: string
  level: ResultLevel
  min_score: number
  max_score: number
  grade: string
  meaning: string
  grade_point: number | null
  display_order: number
}

export interface ClassHistoryEntry {
  from_class_id: string
  to_class_id: string
  promoted_by: string
  promoted_at: string
}

export interface StudentRow {
  id: string
  class_id: string
  first_name: string
  last_name: string
  reg_no_or_bece_no: string
  gender: 'M' | 'F'
  age_or_dob: string | null
  photo_url: string | null
  admission_date: string
  class_history: ClassHistoryEntry[]
  created_by: string | null
  created_at: string
}

export interface ResultEntryRow {
  id: string
  student_id: string
  subject_id: string
  class_id: string
  academic_session: string
  term: Term
  test1: number
  test2: number
  exam: number
  total: number
  cumulative_average: number | null
  weighted_score: number | null
  grade: string | null
  remark: string | null
  class_average: number | null
  highest_in_class: number | null
  lowest_in_class: number | null
  subject_position: number | null
  status: ResultStatus
  entered_by: string
  edit_history: EditHistoryEntry[]
  created_at: string
  updated_at: string
}

export interface ReportCardRow {
  id: string
  student_id: string
  class_id: string
  academic_session: string
  term: Term
  attendance_opened: number
  attendance_present: number
  attendance_absent: number
  overall_total: number | null
  overall_average: number | null
  position_in_class: number | null
  position_in_section: number | null
  class_size: number | null
  section_size: number | null
  section_average: number | null
  highest_average_in_section: number | null
  lowest_average_in_section: number | null
  overall_performance: string | null
  promoted_to_class_id: string | null
  affective_traits: Record<string, number>
  psychomotor_skills: Record<string, number>
  adviser_report: string | null
  form_master_report: string | null
  principal_report: string | null
  status: ResultStatus
  entered_by: string | null
  edit_history: EditHistoryEntry[]
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

// Supabase Database type — replace with `supabase gen types typescript` output later
export type Database = {
  public: {
    Tables: {
      staff: {
        Row: StaffRow
        Insert: Omit<StaffRow, 'id' | 'created_at'>
        Update: Partial<Omit<StaffRow, 'id' | 'created_at'>>
      }
      savings_entries: {
        Row: SavingsEntry
        Insert: Omit<SavingsEntry, 'id' | 'created_at'>
        Update: Partial<Omit<SavingsEntry, 'id' | 'created_at'>>
      }
      withdrawal_requests: {
        Row: WithdrawalRequest
        Insert: Omit<WithdrawalRequest, 'id' | 'requested_at'>
        Update: Partial<Omit<WithdrawalRequest, 'id' | 'requested_at'>>
      }
      user_roles: {
        Row: UserRoleRow
        Insert: Omit<UserRoleRow, 'id' | 'created_at'>
        Update: Partial<Omit<UserRoleRow, 'id' | 'created_at'>>
      }
      // Prefixed `results_*` — this Supabase project is shared with another
      // application that already has its own unrelated `students` table.
      results_classes: {
        Row: ClassRow
        Insert: Omit<ClassRow, 'id' | 'created_at'>
        Update: Partial<Omit<ClassRow, 'id' | 'created_at'>>
      }
      results_subjects: {
        Row: SubjectRow
        Insert: Omit<SubjectRow, 'id'>
        Update: Partial<Omit<SubjectRow, 'id'>>
      }
      results_class_subjects: {
        Row: ClassSubjectRow
        Insert: Omit<ClassSubjectRow, 'id'>
        Update: Partial<Omit<ClassSubjectRow, 'id'>>
      }
      results_class_assignments: {
        Row: ClassAssignmentRow
        Insert: Omit<ClassAssignmentRow, 'id' | 'created_at'>
        Update: Partial<Omit<ClassAssignmentRow, 'id' | 'created_at'>>
      }
      results_grading_scales: {
        Row: GradingScaleRow
        Insert: Omit<GradingScaleRow, 'id'>
        Update: Partial<Omit<GradingScaleRow, 'id'>>
      }
      results_students: {
        Row: StudentRow
        Insert: Omit<StudentRow, 'id' | 'created_at' | 'class_history'>
        Update: Partial<Omit<StudentRow, 'id' | 'created_at' | 'class_id' | 'class_history'>>
      }
      results_entries: {
        Row: ResultEntryRow
        Insert: Omit<ResultEntryRow, 'id' | 'created_at' | 'updated_at' | 'total' | 'cumulative_average' | 'weighted_score' | 'grade' | 'remark' | 'class_average' | 'highest_in_class' | 'lowest_in_class' | 'subject_position'>
        Update: Partial<Omit<ResultEntryRow, 'id' | 'created_at' | 'updated_at'>>
      }
      results_report_cards: {
        Row: ReportCardRow
        Insert: Omit<ReportCardRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ReportCardRow, 'id' | 'created_at' | 'updated_at'>>
      }
    }
  }
}

/** Convert kobo integer → ₦ display string */
export function formatNaira(kobo: number): string {
  return '₦' + (kobo / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
