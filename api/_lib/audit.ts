import type { SupabaseClient } from '@supabase/supabase-js'

interface AuditEntry {
  user_email: string
  action: string
  resource: string
  resource_id?: string
  details?: Record<string, unknown>
}

/**
 * Log a write operation to the audit_log table.
 * Uses the service role client (fire-and-forget — never blocks the response).
 */
export async function logAudit(
  supabaseAdmin: SupabaseClient,
  entry: AuditEntry
): Promise<void> {
  try {
    await supabaseAdmin.from('audit_log').insert({
      user_email: entry.user_email,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resource_id ?? null,
      details: entry.details ?? null,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Audit logging should never break the request
    console.error('Audit log write failed')
  }
}
