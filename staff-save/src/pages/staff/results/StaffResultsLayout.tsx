import { Outlet } from 'react-router-dom'

export default function StaffResultsLayout() {
  return (
    <div className="space-y-4 pt-4">
      <div>
        <h2 className="text-lg font-bold text-stone-800">Class Results</h2>
        <p className="text-sm text-stone-500 mt-0.5">Enter and review results for your assigned class(es).</p>
      </div>
      <Outlet />
    </div>
  )
}
