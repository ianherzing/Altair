import { PageTitle, Card } from '../components/ui'
import { Shield } from '../components/icons/geist'
import './Security.css'

export function Security() {
  return (
    <div className="sec">
      <PageTitle title="Security" style={{ margin: 0 }} />
      <Card padding="lg" className="sec-card">
        <div className="sec-kicker">
          <span className="sec-shield" aria-hidden="true"><Shield size={22} /></span>
          <h3>Security Posture</h3>
        </div>
        <p className="sec-lead">
          Altair ships with a defense-in-depth security model:
        </p>

        <ul className="sec-list">
          <li>Supabase Row Level Security (RLS) gates every table</li>
          <li>Role-based access control (RBAC) via Casbin for API-level authorization</li>
          <li>Bearer JWT authentication enforced at the Vercel edge via <code>middleware.ts</code></li>
          <li>Column-level whitelists for the generic data/external APIs</li>
          <li>CSP headers on all non-API responses (see <code>vercel.json</code>)</li>
          <li>Server-side-only access to <code>SUPABASE_SERVICE_ROLE_KEY</code></li>
          <li>CI guards: authz lint, dependency audit, committed-secret scan (see <code>.github/workflows/</code>)</li>
        </ul>

        <p className="sec-note">
          Replace this placeholder with your own attestation or security reports — for example, a penetration test letter
          of attestation (PDF in <code>public/security/</code>) linked from here.
        </p>
      </Card>
    </div>
  )
}
