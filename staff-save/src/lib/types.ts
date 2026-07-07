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
