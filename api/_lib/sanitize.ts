import { isColumnAllowed } from './columns.js'
import type { UserRole } from './types.js'

/**
 * Validates query parameters against column whitelists.
 * Returns an error message if any param references a disallowed column, or null if valid.
 */

interface QueryParams {
  filters?: Record<string, string>
  order?: string
  orFilter?: string
}

/**
 * Parse filter keys from Supabase-style query params.
 * e.g. { "client_name": "eq.Acme", "status": "in.(done,active)" }
 * The column name is the key itself.
 */
export function validateQueryParams(
  table: string,
  role: UserRole,
  params: QueryParams
): string | null {
  // Validate filter columns
  if (params.filters) {
    for (const column of Object.keys(params.filters)) {
      if (!isColumnAllowed(table, role, column)) {
        return 'Access denied'
      }
    }
  }

  // Validate order column
  if (params.order) {
    // Order format: "column_name.asc" or "column_name.desc" or just "column_name"
    const orderColumn = params.order.split('.')[0]
    if (!isColumnAllowed(table, role, orderColumn)) {
      return 'Access denied'
    }
  }

  // Validate columns inside or() expression
  // Format: "(col1.op.val,col2.op.val,...)" — extract column names
  // Reject nested parens and complex expressions that could bypass column checks
  if (params.orFilter) {
    const bare = params.orFilter.replace(/^\(|\)$/g, '')
    // Reject nested parentheses — these indicate complex sub-expressions
    // that our simple parser can't reliably extract columns from
    if (/[()]/.test(bare)) {
      return 'Access denied'
    }
    const segments = bare.split(',')
    for (const seg of segments) {
      const col = seg.split('.')[0]
      if (!col || !/^[a-z_][a-z0-9_]*$/.test(col) || !isColumnAllowed(table, role, col)) {
        return 'Access denied'
      }
    }
  }

  return null
}

/**
 * Scan outgoing JSON for potential key leakage.
 * Returns true if the response appears safe.
 */
export function sanitizeResponse(data: unknown): boolean {
  const str = JSON.stringify(data)
  // Check for JWT-like patterns (base64-encoded tokens starting with eyJ)
  if (/eyJ[A-Za-z0-9_-]{10,}/.test(str)) {
    return false
  }
  return true
}
