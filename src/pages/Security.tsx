export function Security() {
  return (
    <div>
      <h2>Security</h2>

      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '1.5rem 2rem',
        maxWidth: 640,
      }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
          Security Posture
        </h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Altair ships with a defense-in-depth security model:
        </p>

        <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginLeft: '1.25rem' }}>
          <li>Supabase Row Level Security (RLS) gates every table</li>
          <li>Role-based access control (RBAC) via Casbin for API-level authorization</li>
          <li>Bearer JWT authentication enforced at the Vercel edge via <code>middleware.ts</code></li>
          <li>Column-level whitelists for the generic data/external APIs</li>
          <li>CSP headers on all non-API responses (see <code>vercel.json</code>)</li>
          <li>Server-side-only access to <code>SUPABASE_SERVICE_ROLE_KEY</code></li>
          <li>CI guards: authz lint, dependency audit, committed-secret scan (see <code>.github/workflows/</code>)</li>
        </ul>

        <p style={{
          marginTop: '1.5rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          fontStyle: 'italic',
          lineHeight: 1.5,
        }}>
          Replace this placeholder with your own attestation or security reports — for example, a penetration test letter
          of attestation (PDF in <code>public/security/</code>) linked from here.
        </p>
      </div>
    </div>
  )
}
