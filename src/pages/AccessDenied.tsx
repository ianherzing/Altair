import { useAuth } from '../lib/auth'

export function AccessDenied() {
  const { user, signOut } = useAuth()

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/altair-logo.svg" alt="Altair" className="login-logo" />
        <h1 className="login-title">Altair</h1>
        <p className="login-subtitle">Access Not Configured</p>

        <div style={{
          background: 'rgba(230, 57, 72, 0.1)',
          border: '1px solid rgba(230, 57, 72, 0.3)',
          borderRadius: 6,
          padding: '1rem',
          marginBottom: '1.5rem',
          fontSize: '0.85rem',
          color: '#ccc',
          lineHeight: 1.5,
        }}>
          <p style={{ margin: '0 0 0.5rem 0' }}>
            You signed in as <strong style={{ color: '#fff' }}>{user?.email}</strong>, but your account
            doesn't have a role assigned in Altair yet.
          </p>
          <p style={{ margin: 0 }}>
            Contact your administrator to be assigned a role.
          </p>
        </div>

        <button onClick={signOut} className="login-button" style={{ background: 'var(--bg-card)' }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
