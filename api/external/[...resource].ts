import { timingSafeEqual } from 'crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase-admin.js'
import { getSelectString } from '../_lib/columns.js'
import { validateQueryParams, sanitizeResponse } from '../_lib/sanitize.js'
import { checkPermission } from '../_lib/casbin.js'
import { logAudit } from '../_lib/audit.js'
import { isUUID, isISODate, isString, isEmail, isEnum, isBool } from '../_lib/validate.js'
import type { UserRole } from '../_lib/types.js'
import { MAX_PAGE_SIZE } from '../_lib/constants.js'

/**
 * GET /api/external/:table — read data
 * PATCH /api/external/projects — update writable fields (dates, status, links, contacts)
 *
 * Authenticates via static API key (X-API-Key header).
 * Forces 'pmo_admin' role — full visibility and update permission.
 */

const ROLE: UserRole = 'pmo_admin'

/** Field types for per-field validation */
type FieldType = 'date' | 'text' | 'url' | 'email' | 'status' | 'boolean'

const VALID_STATUSES = ['to_do', 'soft_unconfirmed', 'soft_at_risk', 'hard_scheduled', 'active', 'done'] as const

/** Fields that the external API is allowed to write on each table */
const WRITABLE_FIELDS: Record<string, Record<string, FieldType>> = {
  projects: {
    kickoff_internal: 'date',
    kickoff_external: 'date',
    readout_meeting: 'date',
    box_folder_link: 'text',
    internal_slack_link: 'text',
    external_slack_link: 'text',
    external_id: 'text',
    client_contact_email: 'email',
    status: 'status',
    notes: 'text',
  },
}

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
  'saved_views',
])

const RESERVED_PARAMS = new Set(['...resource', 'resource', 'order', 'limit', 'offset', 'or'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET' && req.method !== 'PATCH') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // Validate API key
    const apiKey = req.headers['x-api-key']
    const expectedKey = process.env.ALTAIR_EXTERNAL_API_KEY?.trim()
    if (!expectedKey) {
      console.error('[external] ALTAIR_EXTERNAL_API_KEY not configured')
      return res.status(500).json({ error: 'Internal server error' })
    }
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length !== expectedKey.length || !timingSafeEqual(Buffer.from(apiKey), Buffer.from(expectedKey))) {
      return res.status(401).json({ error: 'Invalid or missing API key' })
    }

    // Extract table name
    const resourceParam = req.query['...resource'] ?? req.query['resource']
    const segments = Array.isArray(resourceParam) ? resourceParam : resourceParam ? [resourceParam] : []
    const table = segments[0]

    if (!table || !ALLOWED_TABLES.has(table)) {
      return res.status(400).json({ error: 'Invalid resource', allowed: [...ALLOWED_TABLES] })
    }

    // --- PATCH: update writable fields ---
    if (req.method === 'PATCH') {
      const writableFields = WRITABLE_FIELDS[table]
      if (!writableFields) {
        return res.status(405).json({ error: `Write not supported for table: ${table}` })
      }

      const allowed = await checkPermission(ROLE, table, 'update')
      if (!allowed) {
        return res.status(403).json({ error: 'Access denied' })
      }

      const { id, ...fields } = req.body || {}
      if (!id || !isUUID(id)) {
        return res.status(400).json({ error: 'id must be a valid UUID' })
      }

      // Only allow whitelisted fields with per-type validation
      const updateData: Record<string, string | boolean | null> = {}
      for (const [key, value] of Object.entries(fields)) {
        const fieldType = writableFields[key]
        if (!fieldType) {
          return res.status(400).json({ error: `Field not writable: ${key}`, writable: Object.keys(writableFields) })
        }
        if (value === null) {
          updateData[key] = null
          continue
        }
        switch (fieldType) {
          case 'date':
            if (!isISODate(value)) return res.status(400).json({ error: `${key} must be a valid ISO date (YYYY-MM-DD) or null` })
            break
          case 'text':
            if (!isString(value, 2000)) return res.status(400).json({ error: `${key} must be a non-empty string (max 2000 chars) or null` })
            break
          case 'url':
            if (!isString(value, 1000) || !/^https?:\/\//i.test(value as string)) return res.status(400).json({ error: `${key} must be an http(s) URL (max 1000 chars) or null` })
            break
          case 'email':
            if (!isEmail(value)) return res.status(400).json({ error: `${key} must be a valid email address or null` })
            break
          case 'status':
            if (!isEnum(value, [...VALID_STATUSES])) return res.status(400).json({ error: `${key} must be one of: ${VALID_STATUSES.join(', ')}` })
            break
          case 'boolean':
            if (!isBool(value)) return res.status(400).json({ error: `${key} must be a boolean or null` })
            updateData[key] = value
            continue
        }
        updateData[key] = value as string
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No fields to update', writable: Object.keys(writableFields) })
      }

      const supabase = getSupabaseAdmin()
      const { error } = await supabase.from(table).update(updateData).eq('id', id)

      if (error) {
        console.error('[external] Update error:', error.message)
        return res.status(500).json({ error: 'Internal server error' })
      }

      await logAudit(supabase, {
        user_email: 'external-api', action: 'update', resource: table, resource_id: id,
      })

      return res.status(200).json({ ok: true })
    }

    // --- GET: read data ---

    // RBAC check (leadership role)
    const allowed = await checkPermission(ROLE, table, 'read')
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Column whitelist
    const selectString = getSelectString(table, ROLE)
    if (selectString === null) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Extract filters
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

    // Validate filters against column whitelist
    const validationError = validateQueryParams(table, ROLE, { filters, order, orFilter })
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }

    // Build query
    const supabase = getSupabaseAdmin()
    let query = supabase.from(table).select(selectString)

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
          case 'is': query = query.is(column, val === 'null' ? null : val === 'true'); break
          case 'not': {
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

    if (orFilter) {
      const orExpr = orFilter.replace(/^\(|\)$/g, '')
      query = query.or(orExpr)
    }

    if (order) {
      const [orderCol, orderDir] = order.split('.')
      query = query.order(orderCol, { ascending: orderDir !== 'desc' })
    }

    if (limit && limit > 0 && limit <= MAX_PAGE_SIZE) {
      query = query.limit(limit)
    }
    if (offset && offset > 0) {
      query = query.range(offset, offset + (limit || MAX_PAGE_SIZE) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('[external] Query error:', error.message)
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!sanitizeResponse(data)) {
      console.error('[external] Response sanitization failed')
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(200).json(data)
  } catch (err) {
    console.error('[external] Unhandled error:', err instanceof Error ? err.message : err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
