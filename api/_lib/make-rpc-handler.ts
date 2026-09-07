import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from './middleware.js'
import { logAudit } from './audit.js'
import type { AuthenticatedHandler, WithAuthOptions } from './types.js'

export type Validator = (value: unknown) => boolean

export interface FieldSpec {
  rpcParam: string
  validate: Validator
  missing?: string
  invalid?: string
}

export interface RpcErrorSpec {
  prefix: string
  status: number
  message: string
}

export interface MakeRpcHandlerOptions {
  rpcName: string
  fields: Record<string, FieldSpec>
  audit: {
    action: string
    resource: string
    /** Override audit row fields. Default: resource_id = rpcResult if not null/undefined, no details. */
    build?: (body: Record<string, unknown>, rpcResult: unknown) => { resource_id?: unknown; details?: Record<string, unknown> }
  }
  rpcErrors?: RpcErrorSpec[]
  authz: WithAuthOptions
}

/**
 * Build a Vercel handler for the common shape:
 *   POST /api/rpc/<name>
 *   -> validate body fields
 *   -> ctx.supabaseUser.rpc(rpcName, mapped params)
 *   -> logAudit(ctx.supabaseAdmin, ...)
 *   -> 200 with {id: data} or {ok: true}
 *
 * Use ONLY for mechanical handlers. Handlers with real policy (mention
 * filtering, rate limiting, multi-step orchestration) should stay hand-written.
 */
export function makeRpcHandler(opts: MakeRpcHandlerOptions) {
  const fieldNames = Object.keys(opts.fields)
  const handler: AuthenticatedHandler = async (req: VercelRequest, res: VercelResponse, ctx) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const body = (req.body ?? {}) as Record<string, unknown>

    const params: Record<string, unknown> = {}
    for (const name of fieldNames) {
      const spec = opts.fields[name]
      const value = body[name]
      if (value === undefined || value === null || value === '') {
        return res.status(400).json({ error: spec.missing ?? `${name} required` })
      }
      if (!spec.validate(value)) {
        return res.status(400).json({ error: spec.invalid ?? `${name} invalid` })
      }
      params[spec.rpcParam] = value
    }

    const { data, error } = await ctx.supabaseUser.rpc(opts.rpcName, params)
    if (error) {
      for (const err of opts.rpcErrors ?? []) {
        if (typeof error.message === 'string' && error.message.startsWith(err.prefix)) {
          return res.status(err.status).json({ error: err.message })
        }
      }
      return res.status(500).json({ error: 'Internal server error' })
    }

    const auditOverride = opts.audit.build?.(body, data) ?? {}
    const audit: { user_email: string; action: string; resource: string; resource_id?: string; details?: Record<string, unknown> } = {
      user_email: ctx.email,
      action: opts.audit.action,
      resource: opts.audit.resource,
    }
    if ('resource_id' in auditOverride) {
      audit.resource_id = auditOverride.resource_id as string | undefined
    } else if (data !== null && data !== undefined) {
      audit.resource_id = data as string
    }
    if (auditOverride.details) audit.details = auditOverride.details
    await logAudit(ctx.supabaseAdmin, audit)

    return res.status(200).json(data !== null && data !== undefined ? { id: data } : { ok: true })
  }
  return withAuth(handler, opts.authz)
}
