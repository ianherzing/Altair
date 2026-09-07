// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

// vi.mock is hoisted before imports by Vitest's transform.
// Since useAuth is fully replaced by a vi.fn(), calling useIsReadOnly /
// useIsPmoAdmin in tests never touches React's useContext — so no DOM needed.
vi.mock('./auth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from './auth'
import { canAccess, canWrite, useIsReadOnly, useIsPmoAdmin } from './permissions'

const mockUseAuth = vi.mocked(useAuth)

describe('canAccess', () => {
  describe('pmo_admin', () => {
    it('can access any path', () => {
      expect(canAccess('pmo_admin', '/')).toBe(true)
      expect(canAccess('pmo_admin', '/projects')).toBe(true)
      expect(canAccess('pmo_admin', '/some-unknown-route')).toBe(true)
      expect(canAccess('pmo_admin', '/admin/settings/advanced')).toBe(true)
    })
  })

  describe('consultant_readonly', () => {
    it('can access allowed routes exactly', () => {
      expect(canAccess('consultant_readonly', '/')).toBe(true)
      expect(canAccess('consultant_readonly', '/projects')).toBe(true)
      expect(canAccess('consultant_readonly', '/resourcing')).toBe(true)
      expect(canAccess('consultant_readonly', '/consultants')).toBe(true)
      expect(canAccess('consultant_readonly', '/skills')).toBe(true)
      expect(canAccess('consultant_readonly', '/holidays')).toBe(true)
    })

    it('can access sub-paths of allowed routes (prefix match)', () => {
      expect(canAccess('consultant_readonly', '/projects/abc-123')).toBe(true)
      expect(canAccess('consultant_readonly', '/consultants/456')).toBe(true)
    })

    it('cannot access /consultants/archive despite prefix match on /consultants', () => {
      expect(canAccess('consultant_readonly', '/consultants/archive')).toBe(false)
    })

    it('cannot access routes outside their allowed list', () => {
      expect(canAccess('consultant_readonly', '/revenue')).toBe(false)
      expect(canAccess('consultant_readonly', '/permissions')).toBe(false)
      expect(canAccess('consultant_readonly', '/sync-log')).toBe(false)
      expect(canAccess('consultant_readonly', '/capacity')).toBe(false)
      expect(canAccess('consultant_readonly', '/margin')).toBe(false)
    })

    it('does not match "/" as a prefix for all paths', () => {
      // "/" is only matched exactly — it should NOT give access to /revenue
      expect(canAccess('consultant_readonly', '/revenue')).toBe(false)
    })
  })

  describe('finance_viewer', () => {
    it('can access their allowed routes', () => {
      expect(canAccess('finance_viewer', '/')).toBe(true)
      expect(canAccess('finance_viewer', '/projects')).toBe(true)
      expect(canAccess('finance_viewer', '/resourcing')).toBe(true)
      expect(canAccess('finance_viewer', '/consultants')).toBe(true)
      expect(canAccess('finance_viewer', '/skills')).toBe(true)
    })

    it('can access financial dashboards (revenue, historicals, margin)', () => {
      expect(canAccess('finance_viewer', '/revenue')).toBe(true)
      expect(canAccess('finance_viewer', '/historicals')).toBe(true)
      expect(canAccess('finance_viewer', '/margin')).toBe(true)
    })

    it('cannot access /holidays (not in their list)', () => {
      expect(canAccess('finance_viewer', '/holidays')).toBe(false)
    })

    it('cannot access leadership-only routes not in their list', () => {
      expect(canAccess('finance_viewer', '/capacity')).toBe(false)
      expect(canAccess('finance_viewer', '/utilization')).toBe(false)
      expect(canAccess('finance_viewer', '/permissions')).toBe(false)
      expect(canAccess('finance_viewer', '/sync-log')).toBe(false)
      expect(canAccess('finance_viewer', '/security')).toBe(false)
    })

    it('can access sub-paths of allowed routes', () => {
      expect(canAccess('finance_viewer', '/projects/xyz')).toBe(true)
    })

    it('cannot access /consultants/archive despite prefix match on /consultants', () => {
      expect(canAccess('finance_viewer', '/consultants/archive')).toBe(false)
    })
  })

  describe('leadership', () => {
    it('can access their broad set of routes', () => {
      expect(canAccess('leadership', '/')).toBe(true)
      expect(canAccess('leadership', '/revenue')).toBe(true)
      expect(canAccess('leadership', '/historicals')).toBe(true)
      expect(canAccess('leadership', '/capacity')).toBe(true)
      expect(canAccess('leadership', '/margin')).toBe(true)
      expect(canAccess('leadership', '/utilization')).toBe(true)
      expect(canAccess('leadership', '/permissions')).toBe(true)
      expect(canAccess('leadership', '/sync-log')).toBe(true)
      expect(canAccess('leadership', '/security')).toBe(true)
    })

    it('can access sub-paths of allowed routes', () => {
      expect(canAccess('leadership', '/permissions/settings')).toBe(true)
      expect(canAccess('leadership', '/projects/detail/123')).toBe(true)
    })
  })

  describe('prefix matching edge cases', () => {
    it('does not match a route as a prefix of a different route name', () => {
      // /skills should not match /skills-matrix (if it existed)
      // The implementation requires path.startsWith(route + '/'), so /skills only
      // prefix-matches /skills/something — not /skillsmatrix
      expect(canAccess('consultant_readonly', '/skillsmatrix')).toBe(false)
    })
  })
})

describe('canWrite', () => {
  it('returns true for pmo_admin', () => {
    expect(canWrite('pmo_admin')).toBe(true)
  })

  it('returns true for leadership', () => {
    expect(canWrite('leadership')).toBe(true)
  })

  it('returns false for consultant_readonly', () => {
    expect(canWrite('consultant_readonly')).toBe(false)
  })

  it('returns false for finance_viewer', () => {
    expect(canWrite('finance_viewer')).toBe(false)
  })

  it('returns false for null role', () => {
    expect(canWrite(null)).toBe(false)
  })
})

describe('useIsReadOnly', () => {
  it('returns false for pmo_admin (write role)', () => {
    mockUseAuth.mockReturnValue({ role: 'pmo_admin', session: null, user: null, loading: false, signOut: async () => {} })
    expect(useIsReadOnly()).toBe(false)
  })

  it('returns false for leadership (write role)', () => {
    mockUseAuth.mockReturnValue({ role: 'leadership', session: null, user: null, loading: false, signOut: async () => {} })
    expect(useIsReadOnly()).toBe(false)
  })

  it('returns true for consultant_readonly (read-only role)', () => {
    mockUseAuth.mockReturnValue({ role: 'consultant_readonly', session: null, user: null, loading: false, signOut: async () => {} })
    expect(useIsReadOnly()).toBe(true)
  })

  it('returns true for finance_viewer (read-only role)', () => {
    mockUseAuth.mockReturnValue({ role: 'finance_viewer', session: null, user: null, loading: false, signOut: async () => {} })
    expect(useIsReadOnly()).toBe(true)
  })

  it('returns true when role is null (unauthenticated)', () => {
    mockUseAuth.mockReturnValue({ role: null, session: null, user: null, loading: false, signOut: async () => {} })
    expect(useIsReadOnly()).toBe(true)
  })
})

describe('useIsPmoAdmin', () => {
  it('returns true only for pmo_admin role', () => {
    mockUseAuth.mockReturnValue({ role: 'pmo_admin', session: null, user: null, loading: false, signOut: async () => {} })
    expect(useIsPmoAdmin()).toBe(true)
  })

  it('returns false for leadership', () => {
    mockUseAuth.mockReturnValue({ role: 'leadership', session: null, user: null, loading: false, signOut: async () => {} })
    expect(useIsPmoAdmin()).toBe(false)
  })

  it('returns false for consultant_readonly', () => {
    mockUseAuth.mockReturnValue({ role: 'consultant_readonly', session: null, user: null, loading: false, signOut: async () => {} })
    expect(useIsPmoAdmin()).toBe(false)
  })

  it('returns false for finance_viewer', () => {
    mockUseAuth.mockReturnValue({ role: 'finance_viewer', session: null, user: null, loading: false, signOut: async () => {} })
    expect(useIsPmoAdmin()).toBe(false)
  })

  it('returns false when role is null', () => {
    mockUseAuth.mockReturnValue({ role: null, session: null, user: null, loading: false, signOut: async () => {} })
    expect(useIsPmoAdmin()).toBe(false)
  })
})
