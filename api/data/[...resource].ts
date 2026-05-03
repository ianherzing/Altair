import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth, safeSend } from '../_lib/middleware.js'
import { getSelectString } from '../_lib/columns.js'
import { validateQueryParams } from '../_lib/sanitize.js'
import { checkPermission } from '../_lib/casbin.js'
import type { AuthContext } from '../_lib/types.js'
import { MAX_PAGE_SIZE } from '../_lib/constants.js'

/**
 * GET /api/data/:table
 *
 * Catch-all read handler with:
 * - Strict table name allowlist (11 tables)
 * - Per-request Casbin RBAC check with actual table name
 * - Per-role column whitelists (never fetch columns the role shouldn't see)
 * - Filter/order param validation against same whitelist
 * - No user-supplied select passthrough (no PostgREST relationship traversal)
 */

const ALLOWED_TABLES = new Set([
  'projects',
  'assignments',
  'consultants',
  'consultant_cost_rates',
  'monthly_snapshots',
  'historical_revenue',
  'skills',
  'consultant_skills',
  'passion_areas',
  'holidays',
  'sync_log',
  'user_roles',
  'saved_views',
  'project_comments',
])

const RESERVED_PARAMS = new Set(['...resource', 'resource', 'order', 'limit', 'offset', 'or'])

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Extract table name from catch-all route: /api/data/consultants → ['consultants']
  // Vercel stores catch-all params with '...' prefix in req.query
  const resourceParam = req.query['...resource'] ?? req.query['resource']
  const segments = Array.isArray(resourceParam) ? resourceParam : resourceParam ? [resourceParam] : []
  const table = segments[0]

  if (!table || !ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Invalid resource' })
  }

  // Casbin check with actual table name
  const allowed = await checkPermission(ctx.role, table, 'read')
  if (!allowed) {
    return res.status(403).json({ error: 'Access denied' })
  }

  // Get column whitelist for this role on this table
  const selectString = getSelectString(table, ctx.role)
  if (selectString === null) {
    return res.status(403).json({ error: 'Access denied' })
  }

  // Extract filters from query params (everything except reserved params)
  const filters: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.query)) {
    if (RESERVED_PARAMS.has(key)) continue
    if (typeof value === 'string') {
      filters[key] = value
    }
  }

  const order = typeof req.query.order === 'string' ? req.query.order : undefined
  const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined
  const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : undefined
  const orFilter = typeof req.query.or === 'string' ? req.query.or : undefined

  // Validate filters and order against column whitelist
  const validationError = validateQueryParams(table, ctx.role, { filters, order, orFilter })
  if (validationError) {
    return res.status(400).json({ error: validationError })
  }

  // Build Supabase query — no user-supplied select passthrough
  let query = ctx.supabaseAdmin.from(table).select(selectString)

  // Apply filters
  for (const [column, value] of Object.entries(filters)) {
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
        // like/ilike intentionally omitted — wildcard patterns enable blind enumeration
        case 'is': query = query.is(column, val === 'null' ? null : val === 'true'); break
        case 'not': {
          // Compound negation: not.is.null, not.is.true, etc.
          const innerDot = val.indexOf('.')
          if (innerDot !== -1) {
            const innerOp = val.slice(0, innerDot)
            const innerVal = val.slice(innerDot + 1)
            if (innerOp === 'is') {
              query = query.not(column, 'is', innerVal === 'null' ? null : innerVal === 'true')
            }
          }
          break
        }
        case 'in': {
          const items = val.replace(/^\(|\)$/g, '').split(',')
          query = query.in(column, items)
          break
        }
        default: query = query.eq(column, value)
      }
    }
  }

  // Apply OR filter (PostgREST logical operator)
  if (orFilter) {
    // Strip outer parens if present — Supabase .or() expects bare expression
    const orExpr = orFilter.replace(/^\(|\)$/g, '')
    query = query.or(orExpr)
  }

  // Apply order
  if (order) {
    const [orderCol, orderDir] = order.split('.')
    query = query.order(orderCol, { ascending: orderDir !== 'desc' })
  }

  // Apply pagination (max MAX_PAGE_SIZE per page)
  if (limit && limit > 0 && limit <= MAX_PAGE_SIZE) {
    query = query.limit(limit)
  }
  if (offset && offset > 0) {
    query = query.range(offset, offset + (limit || MAX_PAGE_SIZE) - 1)
  }

  const { data, error } = await query

  if (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }

  return safeSend(res, 200, data)
}

// withAuth() handles JWT + role lookup; Casbin check done inside handler with dynamic table
export default withAuth(handler)
