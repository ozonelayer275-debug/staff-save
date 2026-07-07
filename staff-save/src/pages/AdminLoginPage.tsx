import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const ADMIN_GATE = 'mabeladmin123#'

type Step = 'gate' | 'supabase'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('gate')
  const [gatePassword, setGatePassword] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleGate(e: FormEvent) {
    e.preventDefault()
    if (gatePassword === ADMIN_GATE) {
      setError(null)
      setStep('supabase')
    } else {
      setError('Incorrect admin password.')
    }
  }

  async function handleSupabaseLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    // Verify this user is actually in user_roles
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (!roleRow) {
      await supabase.auth.signOut()
      setError('This account does not have admin access.')
      setLoading(false)
      return
    }

    navigate('/admin', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-800 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-600 mb-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">Admin Access</h1>
          <p className="text-sm text-brand-300 mt-1">MPS Staff Savings</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          {step === 'gate' ? (
            <form onSubmit={handleGate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={gatePassword}
                  onChange={e => setGatePassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Enter admin password"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" className="w-full bg-brand-700 hover:bg-brand-800 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                Continue
              </button>
            </form>
          ) : (
            <form onSubmit={handleSupabaseLogin} className="space-y-4">
              <p className="text-xs text-green-600 font-medium mb-2">✓ Admin password verified</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email" required autoFocus value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="admin@school.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password" required value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="w-full bg-brand-700 hover:bg-brand-800 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-60">
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <button type="button" onClick={() => { setStep('gate'); setError(null) }} className="w-full text-xs text-gray-400 hover:text-gray-600 mt-1">
                ← Back
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-4">
          <a href="/login" className="text-brand-300 text-xs hover:text-white">Staff login →</a>
        </p>
      </div>
    </div>
  )
}
