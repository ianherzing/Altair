import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withApiKeyAuth } from '../_lib/api-key-auth.js'
import { getSupabaseAdmin } from '../_lib/supabase-admin.js'
import type { EngagementPayload } from '../adapters/EngagementSource.js'

/**
 * POST /api/ingest/engagement — reference EngagementSource webhook.
 *
 * Accepts a JSON body matching the EngagementPayload shape (see
 * `api/adapters/EngagementSource.ts`) and upserts it into the `projects`
 * table. Intended as a minimal, opinionated endpoint your CRM / ticketing
 * system can call whenever an engagement is created or updated.
 *
 * Auth: X-API-Key header matching ALTAIR_EXTERNAL_API_KEY env var.
 * Bypasses the Bearer JWT check in middleware.ts (see the `/api/ingest/` skip).
 *
 * This is a REFERENCE implementation — fork it for a real adapter. Typical
 * modifications:
 *   - Validate the payload against your source system's schema
 *   - Resolve `project_manager_email` to a consultant ID before writing
 *   - Write a sync_log row for auditability
 *   - Dispatch downstream work (create Linear tasks, notify Slack, etc.)
 */
async function handler(
  req: VercelRequest,
  res: VercelResponse,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const payload = req.body as EngagementPayload | undefined
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid JSON body' })
  }

  // --- Minimal validation ---
  if (!payload.external_id || typeof payload.external_id !== 'string') {
    return res.status(400).json({ error: 'external_id is required (string)' })
  }
  if (!payload.client_name || typeof payload.client_name !== 'string') {
    return res.status(400).json({ error: 'client_name is required (string)' })
  }
  if (!payload.project_name || typeof payload.project_name !== 'string') {
    return res.status(400).json({ error: 'project_name is required (string)' })
  }

  // --- Map adapter payload → projects row ---
  const row: Record<string, unknown> = {
    external_id: payload.external_id,
    client_name: payload.client_name,
    project_name: payload.project_name,
    sow_number: payload.sow_number ?? null,
    sow_amount: payload.sow_amount ?? null,
    planned_hours: payload.planned_hours ?? null,
    status: payload.status ?? 'soft_unconfirmed',
    engagement_start: payload.engagement_start ?? null,
    engagement_end: payload.engagement_end ?? null,
    notes: payload.notes ?? null,
    client_contact_email: payload.client_contact_email ?? null,
  }

  // --- Upsert ---
  const { data, error } = await supabaseAdmin
    .from('projects')
    .upsert(row, { onConflict: 'external_id' })
    .select('id, external_id')
    .single()

  if (error) {
    console.error('[ingest/engagement] upsert failed:', error.message)
    return res.status(500).json({ error: 'Failed to upsert engagement' })
  }

  return res.status(200).json({ ok: true, project_id: data.id, external_id: data.external_id })
}

export default withApiKeyAuth(handler)
