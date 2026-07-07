import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS = [
  {
    to: '/admin', label: 'Overview', end: true,
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    to: '/admin/staff', label: 'Staff', end: false,
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0zM3 7a3 3 0 116 0 3 3 0 01-6 0z"/>
      </svg>
    ),
  },
  {
    to: '/admin/savings', label: 'Savings', end: false,
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
  },
  {
    to: '/admin/withdrawals', label: 'Withdrawals', end: false,
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 00-10 0v2M5 9h14l1 12H4L5 9z"/>
      </svg>
    ),
  },
]

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Overview',
  '/admin/staff': 'Staff Registry',
  '/admin/savings': 'Savings Entry',
  '/admin/withdrawals': 'Withdrawals',
}

export default function AdminShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Admin'

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f7f4f0] flex">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 bg-[#3d1f07] shrink-0 fixed top-0 left-0 h-full z-20">
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-400 flex items-center justify-center shrink-0">
              <CoinIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">MPS Savings</p>
              <p className="text-brand-300 text-[10px] font-medium uppercase tracking-wider">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, end, icon }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-400/20 text-brand-300 border border-brand-400/30'
                    : 'text-white/60 hover:text-white hover:bg-white/8'
                }`
              }
            >
              {({ isActive }) => <>{icon(isActive)}{label}</>}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-5 border-t border-white/10 pt-4">
          <button onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/8 transition-all">
            <SignOutIcon className="w-[18px] h-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 md:ml-56 flex flex-col min-h-screen">

        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-[#f7f4f0]/90 backdrop-blur-sm border-b border-stone-200/60 px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Mobile: show logo mark */}
            <div className="md:hidden w-7 h-7 rounded-lg bg-brand-700 flex items-center justify-center">
              <CoinIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="font-semibold text-stone-800 text-[15px]">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Sign out on mobile topbar */}
            <button onClick={signOut}
              className="md:hidden flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors px-2 py-1.5 rounded-lg hover:bg-stone-200">
              <SignOutIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
            <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
          </div>
        </header>

        {/* Page content — extra bottom padding on mobile for the bottom bar */}
        <main className="flex-1 px-4 md:px-6 py-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#3d1f07] border-t border-white/10 flex">
        {NAV_ITEMS.map(({ to, label, end, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
                isActive ? 'text-brand-300' : 'text-white/40 hover:text-white/70'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {icon(isActive)}
                <span className="text-[10px] font-semibold tracking-wide">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function CoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
    </svg>
  )
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
    </svg>
  )
}
