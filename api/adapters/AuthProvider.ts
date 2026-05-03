/**
 * AuthProvider — documentation / type guidance for plugging in SSO.
 *
 * Unlike the other adapters, authentication is not pluggable at the TypeScript
 * interface level in Altair — it's handled by Supabase Auth, which natively
 * supports:
 *
 *   - Email + password (default, ships configured in `src/pages/Login.tsx`)
 *   - Magic-link email
 *   - OAuth (Google, GitHub, etc.)
 *   - SAML SSO (Supabase paid tier)
 *   - SCIM / Okta / Entra ID (Supabase paid tier)
 *
 * To change the auth method, edit `src/pages/Login.tsx` to call the appropriate
 * `supabase.auth.*` method instead of `signInWithPassword`. For SSO, also
 * configure the provider in the Supabase dashboard (Authentication → Providers).
 *
 * Reference: https://supabase.com/docs/guides/auth
 *
 * The types below exist for adapters that need to identify a user from a
 * request context outside the normal Supabase flow (e.g. a webhook that needs
 * to audit-log which external service triggered a change).
 */

export interface AuthContext {
  /** Opaque user ID (Supabase auth.users.id, or equivalent from your SSO). */
  userId: string

  /** Email associated with the authenticated user. */
  email: string

  /** Display name, if the provider sends one. */
  name?: string

  /** Role assigned in Altair's `user_roles` table. */
  role?: string
}
