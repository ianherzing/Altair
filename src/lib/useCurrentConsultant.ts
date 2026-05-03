import { useEffect, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import type { Consultant } from '../types/database'

/**
 * Resolve the logged-in user to their consultant record by email (case-insensitive).
 * Returns `null` while loading or if no matching consultant exists.
 * Scope is narrow — callers typically only need `id` and `email` to gate
 * self-edit UI. Don't use this for anything security-relevant; the server
 * re-derives identity from the JWT.
 */
export function useCurrentConsultant(): { consultant: Consultant | null; loading: boolean } {
  const { user } = useAuth()
  const [consultant, setConsultant] = useState<Consultant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const email = user?.email
    if (!email) return

    let cancelled = false
    // Fetch all consultants and match client-side (case-insensitive). Avoids
    // PostgREST's case-sensitive eq and any email-casing mismatches. Cheap —
    // the roster is small and this fires once per session.
    api.getConsultants()
      .then(rows => {
        if (cancelled) return
        const needle = email.toLowerCase()
        const match = rows.find(r => r.email?.toLowerCase() === needle) ?? null
        setConsultant(match)
      })
      .catch(() => { if (!cancelled) setConsultant(null) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [user?.email])

  return { consultant, loading }
}
