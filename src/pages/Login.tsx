import { useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Default login: Supabase Auth email+password.
 *
 * To swap this for SSO (Okta, Azure AD, Google, etc.), wire an
 * AuthProvider adapter — see api/adapters/AuthProvider.ts.
 */
export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/altair-logo.svg" alt="Altair" className="login-logo" />
        <h1 className="login-title">Altair</h1>
        <p className="login-subtitle">Professional services operations</p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="login-input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="login-input"
          />
          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  )
}
