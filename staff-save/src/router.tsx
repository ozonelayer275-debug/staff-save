import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useResultsAccess } from '@/hooks/useResultsAccess'
import type { UserRole } from '@/lib/types'
import LoginPage from '@/pages/LoginPage'
import AdminLoginPage from '@/pages/AdminLoginPage'
import RegisterPage from '@/pages/RegisterPage'
import PrintReportCard from '@/pages/PrintReportCard'
import AdminShell from '@/pages/admin/AdminShell'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import StaffRegistry from '@/pages/admin/StaffRegistry'
import SavingsEntryPage from '@/pages/admin/SavingsEntry'
import AdminWithdrawals from '@/pages/admin/AdminWithdrawals'
import StaffShell from '@/pages/staff/StaffShell'
import StaffDashboard from '@/pages/staff/StaffDashboard'
import StaffHistory from '@/pages/staff/StaffHistory'
import WithdrawRequest from '@/pages/staff/WithdrawRequest'
import AdminResultsLayout from '@/pages/admin/results/AdminResultsLayout'
import AdminResultsDashboard from '@/pages/admin/results/AdminResultsDashboard'
import AdminClasses from '@/pages/admin/results/AdminClasses'
import AdminSubjects from '@/pages/admin/results/AdminSubjects'
import AdminClassAssignments from '@/pages/admin/results/AdminClassAssignments'
import AdminReviewQueue from '@/pages/admin/results/AdminReviewQueue'
import AdminRoster from '@/pages/admin/results/AdminRoster'
import AdminSubjectPicker from '@/pages/admin/results/AdminSubjectPicker'
import AdminGradebook from '@/pages/admin/results/AdminGradebook'
import AdminReportCardEntry from '@/pages/admin/results/AdminReportCardEntry'
import AdminBatchExport from '@/pages/admin/results/AdminBatchExport'
import StaffResultsLayout from '@/pages/staff/results/StaffResultsLayout'
import StaffResultsOverview from '@/pages/staff/results/StaffResultsOverview'
import StaffRoster from '@/pages/staff/results/StaffRoster'
import StaffSubjectPicker from '@/pages/staff/results/StaffSubjectPicker'
import StaffGradebook from '@/pages/staff/results/StaffGradebook'
import StaffReportCardEntry from '@/pages/staff/results/StaffReportCardEntry'

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading…</div>
)

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  if (auth.loading) return <Spinner />
  if (!auth.user || auth.role !== 'admin') return <Navigate to="/admin-login" replace />
  return <>{children}</>
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  if (auth.loading) return <Spinner />
  // Allow any authenticated user (staff role OR unlinked — dashboard handles the pending state)
  if (!auth.user) return <Navigate to="/login" replace />
  if (auth.role === 'admin') return <Navigate to="/admin" replace />
  return <>{children}</>
}

// Gates only on "zero class assignments" (total invisibility). The per-class
// results_access_enabled toggle (grayed-out-but-explained state) is handled
// inside StaffResultsLayout/StaffShell instead, since one staff member can
// have several assignments in different enabled states simultaneously.
function RequireResultsAccess({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const access = useResultsAccess()
  if (auth.loading || access.loading) return <Spinner />
  if (!access.hasAnyAssignment) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function Router() {
  const auth = useAuth()

  const staffHome = auth.role === 'admin' ? '/admin' : '/dashboard'

  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route
          path="/login"
          element={
            auth.loading ? null :
            auth.user ? <Navigate to={staffHome} replace /> :
            <LoginPage />
          }
        />
        <Route
          path="/register"
          element={
            auth.loading ? null :
            auth.user ? <Navigate to={staffHome} replace /> :
            <RegisterPage />
          }
        />
        <Route
          path="/admin-login"
          element={
            auth.loading ? null :
            (auth.user && auth.role === 'admin') ? <Navigate to="/admin" replace /> :
            <AdminLoginPage />
          }
        />

        {/* Admin routes */}
        <Route path="/admin" element={<RequireAdmin><AdminShell /></RequireAdmin>}>
          <Route index element={<AdminDashboard />} />
          <Route path="staff" element={<StaffRegistry />} />
          <Route path="savings" element={<SavingsEntryPage />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
          <Route path="results" element={<AdminResultsLayout />}>
            <Route index element={<AdminResultsDashboard />} />
            <Route path="classes" element={<AdminClasses />} />
            <Route path="subjects" element={<AdminSubjects />} />
            <Route path="assignments" element={<AdminClassAssignments />} />
            <Route path="roster/:classId" element={<AdminRoster />} />
            <Route path="entry/:classId" element={<AdminSubjectPicker />} />
            <Route path="entry/:classId/:subjectId" element={<AdminGradebook />} />
            <Route path="report-card/:classId/:studentId" element={<AdminReportCardEntry />} />
            <Route path="export/:classId" element={<AdminBatchExport />} />
            <Route path="review" element={<AdminReviewQueue />} />
          </Route>
        </Route>

        {/* Staff routes */}
        <Route path="/dashboard" element={<RequireAuth><StaffShell /></RequireAuth>}>
          <Route index element={<StaffDashboard />} />
          <Route path="history" element={<StaffHistory />} />
          <Route path="withdraw" element={<WithdrawRequest />} />
          <Route path="results" element={<RequireResultsAccess><StaffResultsLayout /></RequireResultsAccess>}>
            <Route index element={<StaffResultsOverview />} />
            <Route path="roster/:classId" element={<StaffRoster />} />
            <Route path="entry/:classId" element={<StaffSubjectPicker />} />
            <Route path="entry/:classId/:subjectId" element={<StaffGradebook />} />
            <Route path="report-card/:classId/:studentId" element={<StaffReportCardEntry />} />
          </Route>
        </Route>

        {/* Chrome-less print target — navigated to by headless Chrome, not by users */}
        <Route path="/print/report-card/:studentId/:session/:term" element={<PrintReportCard />} />

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
