import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/lib/types'
import LoginPage from '@/pages/LoginPage'
import AdminLoginPage from '@/pages/AdminLoginPage'
import RegisterPage from '@/pages/RegisterPage'
import AdminShell from '@/pages/admin/AdminShell'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import StaffRegistry from '@/pages/admin/StaffRegistry'
import SavingsEntryPage from '@/pages/admin/SavingsEntry'
import AdminWithdrawals from '@/pages/admin/AdminWithdrawals'
import StaffShell from '@/pages/staff/StaffShell'
import StaffDashboard from '@/pages/staff/StaffDashboard'
import StaffHistory from '@/pages/staff/StaffHistory'
import WithdrawRequest from '@/pages/staff/WithdrawRequest'

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
        </Route>

        {/* Staff routes */}
        <Route path="/dashboard" element={<RequireAuth><StaffShell /></RequireAuth>}>
          <Route index element={<StaffDashboard />} />
          <Route path="history" element={<StaffHistory />} />
          <Route path="withdraw" element={<WithdrawRequest />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
