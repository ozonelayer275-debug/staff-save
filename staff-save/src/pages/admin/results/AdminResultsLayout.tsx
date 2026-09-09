import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/admin/results', label: 'Dashboard', end: true },
  { to: '/admin/results/classes', label: 'Classes', end: false },
  { to: '/admin/results/subjects', label: 'Subjects', end: false },
  { to: '/admin/results/assignments', label: 'Assignments', end: false },
  { to: '/admin/results/review', label: 'Review Queue', end: false },
]

export default function AdminResultsLayout() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-stone-800">Class Results</h2>
        <p className="text-sm text-stone-500 mt-0.5">Report cards, gradebooks, and roster management.</p>
      </div>

      <div className="flex items-center gap-1 bg-white border border-stone-200/80 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}
