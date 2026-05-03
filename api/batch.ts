import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth, safeSend } from './_lib/middleware.js'
import { getSelectString } from './_lib/columns.js'
import { validateQueryParams } from './_lib/sanitize.js'
import { checkPermission } from './_lib/casbin.js'
import type { AuthContext, BatchQuery } from './_lib/types.js'
import { MAX_PAGE_SIZE } from './_lib/constants.js'

/**
 * POST /api/batch
 *
 * Multi-query endpoint for pages that need multiple data fetches.
 * - Each query gets independent Casbin check
 * - All-or-nothing: if any query is denied, entire batch fails with 403
 * - Max 10 queries per batch
 */

const ALLOWED_TABLES = new Set([
  'projects', 'assignments', 'consultants', 'consultant_cost_rates',
  'monthly_snapshots', 'historical_revenue', 'skills', 'consultant_skills',
  'passion_areas', 'holidays', 'sync_log', 'user_roles',
  'project_comments', 'saved_views',
])

const MAX_QUERIES = 10

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { queries } = req.body as { queries?: BatchQuery[] }

  if (!Array.isArray(queries) || queries.length === 0) {
    return res.status(400).json({ error: 'queries array required' })
  }

  if (queries.length > MAX_QUERIES) {
    return res.status(400).json({ error: `Maximum ${MAX_QUERIES} queries per batch` })
  }

  // Phase 1: Validate ALL queries before executing any (all-or-nothing)
  for (const q of queries) {
    if (!q.resource || !ALLOWED_TABLES.has(q.resource)) {
      return res.status(400).json({ error: 'Access denied' })
    }

    const allowed = await checkPermission(ctx.role, q.resource, 'read')
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const selectString = getSelectString(q.resource, ctx.role)
    if (selectString === null) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (q.filters || q.order) {
      const validationError = validateQueryParams(q.resource, ctx.role, {
        filters: q.filters,
        order: q.order,
      })
      if (validationError) {
        return res.status(400).json({ error: 'Access denied' })
      }
    }
  }

  // Phase 2: Execute all queries (keyed by index to prevent collision when same resource appears twice)
  const results: Record<string, unknown> = {}

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i]
    const selectString = getSelectString(q.resource, ctx.role)!
    let query = ctx.supabaseAdmin.from(q.resource).select(selectString)

    if (q.filters) {
      for (const [column, value] of Object.entries(q.filters)) {
        const dotIndex = value.indexOf('.')
        if (dotIndex === -1) {
          query = query.eq(column, value)
        } else {
          const op = value.slice(0, dotIndex)
          const val = value.slice(dotIndex + 1)
          switch (op) {
            case 'eq': query = query.eq(column, val); break
            case 'neq': query = query.neq(column, val); break
            case 'gt': query = query.gt(column, val); break
            case 'gte': query = query.gte(column, val); break
            case 'lt': query = query.lt(column, val); break
            case 'lte': query = query.lte(column, val); break
            case 'is': query = query.is(column, val === 'null' ? null : val === 'true'); break
            case 'in': {
              const items = val.replace(/^\(|\)$/g, '').split(',')
              query = query.in(column, items)
              break
            }
            default: query = query.eq(column, value)
          }
        }
      }
    }

    if (q.order) {
      const [orderCol, orderDir] = q.order.split('.')
      query = query.order(orderCol, { ascending: orderDir !== 'desc' })
    }

    if (q.limit && q.limit > 0 && q.limit <= MAX_PAGE_SIZE) {
      query = query.limit(q.limit)
    }

    const { data, error } = await query
    if (error) {
      return res.status(500).json({ error: 'Internal server error' })
    }

    results[q.key ?? q.resource ?? String(i)] = data
  }

  return safeSend(res, 200, results)
}

// withAuth() handles JWT + role lookup; Casbin checks done per-query inside handler
export default withAuth(handler)
