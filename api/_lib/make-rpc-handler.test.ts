// @vitest-environment node
// Tests for api/_lib/make-rpc-handler.ts -- the factory that absorbs the
// validate -> rpc -> audit -> respond boilerplate from mechanical handlers.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./middleware.js', () => ({
  withAuth: (h: unknown) => h,
}))

const auditCalls: Array<Record<string, unknown>> = []
vi.mock('./audit.js', () => ({
  logAudit: (_admin: unknown, entry: Record<string, unknown>) => {
    auditCalls.push(entry)
    return Promise.resolve()
  },
}))

import { makeRpcHandler } from './make-rpc-handler.js'
import { isString, isUUID } from './validate.js'

interface MockResp { statusCode: number; body: unknown; status(c: number): MockResp; json(b: unknown): MockResp }
function mockRes(): MockResp {
  const res: MockResp = {
    statusCode: 200,
    body: undefined,
    status(c) { res.statusCode = c; return res },
    json(b) { res.body = b; return res },
  }
  return res
}

function mockCtx(rpcResult: { data: unknown; error: unknown }) {
  return {
    userId: 'u-1',
    email: 'admin@example.com',
    role: 'pmo_admin' as const,
    supabaseAdmin: {} as unknown,
    supabaseUser: {
      rpc: vi.fn().mockResolvedValue(rpcResult),
    } as unknown,
  }
}

beforeEach(() => {
  auditCalls.length = 0
})

describe('makeRpcHandler -- single-field create (matches add-skill shape)', () => {
  const handler = makeRpcHandler({
    rpcName: 'add_skill',
    fields: {
      name: {
        rpcParam: 'p_name',
        validate: (v) => isString(v, 255),
        invalid: 'name must be a non-empty string with max length 255',
      },
    },
    audit: { action: 'create', resource: 'skills' },
    authz: { resource: 'skills', action: 'create' },
  }) as (req: unknown, res: unknown, ctx: unknown) => Promise<unknown>

  it('rejects non-POST with 405', async () => {
    const req = { method: 'GET', body: {} }
    const res = mockRes()
    await handler(req, res, mockCtx({ data: null, error: null }))
    expect(res.statusCode).toBe(405)
  })

  it('rejects missing required field with 400 + default message', async () => {
    const req = { method: 'POST', body: {} }
    const res = mockRes()
    await handler(req, res, mockCtx({ data: null, error: null }))
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'name required' })
  })

  it('rejects invalid field with 400 + custom invalid message', async () => {
    const req = { method: 'POST', body: { name: 12345 } }
    const res = mockRes()
    await handler(req, res, mockCtx({ data: null, error: null }))
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'name must be a non-empty string with max length 255' })
  })

  it('calls RPC with mapped param name + returns {id: data}', async () => {
    const ctx = mockCtx({ data: 'skill-id-123', error: null })
    const req = { method: 'POST', body: { name: 'Pentesting' } }
    const res = mockRes()
    await handler(req, res, ctx)
    expect((ctx.supabaseUser as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith('add_skill', { p_name: 'Pentesting' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ id: 'skill-id-123' })
  })

  it('logs audit with resource_id from RPC result by default', async () => {
    const req = { method: 'POST', body: { name: 'Pentesting' } }
    const res = mockRes()
    await handler(req, res, mockCtx({ data: 'skill-id-123', error: null }))
    expect(auditCalls).toHaveLength(1)
    expect(auditCalls[0]).toMatchObject({
      user_email: 'admin@example.com',
      action: 'create',
      resource: 'skills',
      resource_id: 'skill-id-123',
    })
  })

  it('returns 500 on RPC error and does NOT audit', async () => {
    const req = { method: 'POST', body: { name: 'Pentesting' } }
    const res = mockRes()
    await handler(req, res, mockCtx({ data: null, error: { message: 'db exploded' } }))
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Internal server error' })
    expect(auditCalls).toHaveLength(0)
  })
})

describe('makeRpcHandler -- rpcErrors map (matches add-tag shape)', () => {
  const handler = makeRpcHandler({
    rpcName: 'add_tag',
    fields: {
      name: { rpcParam: 'p_name', validate: (v) => isString(v, 255) },
    },
    audit: {
      action: 'create',
      resource: 'tag_dictionary',
      build: (body) => ({ resource_id: body.name as string }),
    },
    rpcErrors: [
      { prefix: 'TAG_ALREADY_EXISTS', status: 409, message: 'Tag already exists' },
      { prefix: 'TAG_FORBIDDEN', status: 403, message: 'Access denied' },
    ],
    authz: { resource: 'tag_dictionary', action: 'create' },
  }) as (req: unknown, res: unknown, ctx: unknown) => Promise<unknown>

  it('maps RPC error code to specific status + message', async () => {
    const req = { method: 'POST', body: { name: 'urgent' } }
    const res = mockRes()
    await handler(req, res, mockCtx({ data: null, error: { message: 'TAG_ALREADY_EXISTS: urgent' } }))
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'Tag already exists' })
  })

  it('falls through to 500 for unmapped RPC errors', async () => {
    const req = { method: 'POST', body: { name: 'urgent' } }
    const res = mockRes()
    await handler(req, res, mockCtx({ data: null, error: { message: 'something else' } }))
    expect(res.statusCode).toBe(500)
  })

  it('uses audit.build() override for resource_id from body when RPC returns void', async () => {
    const req = { method: 'POST', body: { name: 'urgent' } }
    const res = mockRes()
    await handler(req, res, mockCtx({ data: null, error: null }))
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(auditCalls[0]).toMatchObject({ resource_id: 'urgent', resource: 'tag_dictionary' })
  })
})

describe('makeRpcHandler -- multi-field delete (matches delete-consultant-skill shape)', () => {
  const handler = makeRpcHandler({
    rpcName: 'delete_consultant_skill',
    fields: {
      consultant_id: { rpcParam: 'p_consultant_id', validate: isUUID, invalid: 'consultant_id must be a valid UUID' },
      skill_id: { rpcParam: 'p_skill_id', validate: isUUID, invalid: 'skill_id must be a valid UUID' },
    },
    audit: {
      action: 'delete',
      resource: 'consultant_skills',
      build: (body) => ({ details: { consultant_id: body.consultant_id, skill_id: body.skill_id } }),
    },
    authz: { resource: 'consultant_skills', action: 'delete' },
  }) as (req: unknown, res: unknown, ctx: unknown) => Promise<unknown>

  const UUID_A = '11111111-1111-1111-1111-111111111111'
  const UUID_B = '22222222-2222-2222-2222-222222222222'

  it('rejects when first field missing', async () => {
    const req = { method: 'POST', body: { skill_id: UUID_B } }
    const res = mockRes()
    await handler(req, res, mockCtx({ data: null, error: null }))
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'consultant_id required' })
  })

  it('rejects when second field is not a UUID', async () => {
    const req = { method: 'POST', body: { consultant_id: UUID_A, skill_id: 'not-a-uuid' } }
    const res = mockRes()
    await handler(req, res, mockCtx({ data: null, error: null }))
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'skill_id must be a valid UUID' })
  })

  it('maps both fields to RPC params, returns {ok: true}, audits with details', async () => {
    const ctx = mockCtx({ data: null, error: null })
    const req = { method: 'POST', body: { consultant_id: UUID_A, skill_id: UUID_B } }
    const res = mockRes()
    await handler(req, res, ctx)
    expect((ctx.supabaseUser as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith('delete_consultant_skill', {
      p_consultant_id: UUID_A,
      p_skill_id: UUID_B,
    })
    expect(res.body).toEqual({ ok: true })
    expect(auditCalls[0]).toMatchObject({
      action: 'delete',
      resource: 'consultant_skills',
      details: { consultant_id: UUID_A, skill_id: UUID_B },
    })
    expect(auditCalls[0].resource_id).toBeUndefined()
  })
})
