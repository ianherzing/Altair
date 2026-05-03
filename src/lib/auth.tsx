import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { AUTH_TIMEOUT_MS } from './constants'
import type { UserRole } from '../types/database'

interface AuthContextValue {
  session: Session | null
  user: User | null
  role: UserRole | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
})

// Classic React Context pattern: hook + provider colocated in one file.
// Splitting into separate modules would churn every importer for a marginal
// HMR benefit (full reload vs. Fast Refresh only on this one file).
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  // Look up role via /api/auth/role endpoint instead of direct PostgREST.
  // This avoids exposing the user_roles table to direct queries and
  // works even after RLS lockdown (the endpoint uses service role).
  async function lookupRole(_email: string, accessToken: string): Promise<UserRole | null> {
    try {
      const res = await fetch('/api/auth/role', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.role ?? null
    } catch {
      return null
    }
  }

  async function establishSession(s: Session | null) {
    setSession(s)
    if (s?.user?.email && s.access_token) {
      const r = await lookupRole(s.user.email, s.access_token)
      setRole(r)
    } else {
      setRole(null)
    }
    setLoading(false)

    // Clean up auth callback artifacts from URL (hash for implicit, query for PKCE)
    if (window.location.hash.includes('access_token=') || window.location.search.includes('code=')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }

  useEffect(() => {
    let mounted = true
    const loadingRef = { current: true }

    // Safety timeout — never spin forever
    const timeout = setTimeout(() => {
      if (mounted && loadingRef.current) {
        setLoading(false)
        loadingRef.current = false
      }
    }, AUTH_TIMEOUT_MS)

    // Listen for auth state changes — catches SSO callback tokens,
    // automatic token refreshes, and sign-out events.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mounted) return

        if (event === 'SIGNED_OUT') {
          setSession(null)
          setRole(null)
          setLoading(false)
          loadingRef.current = false
          return
        }

        await establishSession(s)
        loadingRef.current = false
      }
    )

    // Also check for existing stored session (e.g. page refresh)
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return
      if (loadingRef.current) {
        await establishSession(s)
        loadingRef.current = false
      }
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    // When the user switches back to this tab after it has been
    // backgrounded, verify the session is still valid. Supabase's
    // auto-refresh may have been paused by the browser.
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible' || !mounted) return
      supabase.auth.getSession().then(async ({ data: { session: s } }) => {
        if (!mounted) return
        if (!s) {
          setSession(null)
          setRole(null)
          return
        }
        const remaining = (s.expires_at ?? 0) * 1000 - Date.now()
        if (remaining < 120_000) {
          const { error } = await supabase.auth.refreshSession()
          if (error) {
            console.warn('Visibility refresh failed:', error.message)
            await supabase.auth.signOut()
            setSession(null)
            setRole(null)
          }
        }
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setRole(null)
  }, [])

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    role,
    loading,
    signOut,
  }), [session, role, loading, signOut])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
