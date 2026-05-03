import { supabase } from './supabase'
import type {
  Consultant, Project, Assignment, MonthlySnapshot, Skill, ConsultantSkill,
  PassionArea, Holiday, SyncLog, ConsultantCostRate, HistoricalRevenue,
  RevenueStatus, UserRole, SavedView, ProjectComment,
} from '../types/database'

/**
 * Typed API client that routes all data access through Vercel API routes.
 * Replaces direct supabase.from() and supabase.rpc() calls.
 *
 * All requests carry the current user's Bearer token.
 * The API layer enforces Casbin RBAC + column whitelists.
 */

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(body.error || `API error: ${res.status}`)
  }

  return res.json()
}

function buildQuery(resource: string, filters?: Record<string, string>, order?: string, limit?: number, offset?: number): string {
  const params = new URLSearchParams()
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      params.set(key, value)
    }
  }
  if (order) params.set('order', order)
  if (limit) params.set('limit', String(limit))
  if (offset) params.set('offset', String(offset))
  const qs = params.toString()
  return `/api/data/${resource}${qs ? `?${qs}` : ''}`
}

// ========== Read API ==========

export const api = {
  // Projects
  async getProjects(filters?: Record<string, string>): Promise<Project[]> {
    return fetchApi(buildQuery('projects', filters))
  },

  async getProjectById(id: string): Promise<Project> {
    const results = await fetchApi<Project[]>(buildQuery('projects', { id: `eq.${id}` }, undefined, 1))
    if (!results[0]) throw new Error('Project not found')
    return results[0]
  },

  // Consultants
  async getConsultants(filters?: Record<string, string>): Promise<Consultant[]> {
    return fetchApi(buildQuery('consultants', filters))
  },

  // Consultants eligible to appear as mentors: active consultants PLUS anyone
  // explicitly flagged as a mentor (e.g., archived staff who still mentor).
  async getMentorableConsultants(): Promise<Consultant[]> {
    return fetchApi(buildQuery('consultants', { or: '(is_active.eq.true,is_mentor.eq.true)' }))
  },

  // Assignments
  async getAssignments(filters?: Record<string, string>): Promise<Assignment[]> {
    return fetchApi(buildQuery('assignments', filters))
  },

  // Snapshots
  async getMonthlySnapshots(filters?: Record<string, string>): Promise<MonthlySnapshot[]> {
    return fetchApi(buildQuery('monthly_snapshots', filters))
  },

  // Cost Rates
  async getCostRates(filters?: Record<string, string>): Promise<ConsultantCostRate[]> {
    return fetchApi(buildQuery('consultant_cost_rates', filters))
  },

  // Historical Revenue
  async getHistoricalRevenue(filters?: Record<string, string>, order?: string, limit?: number, offset?: number): Promise<HistoricalRevenue[]> {
    return fetchApi(buildQuery('historical_revenue', filters, order, limit, offset))
  },

  // Skills
  async getSkills(): Promise<Skill[]> {
    return fetchApi(buildQuery('skills'))
  },

  async getConsultantSkills(): Promise<ConsultantSkill[]> {
    return fetchApi(buildQuery('consultant_skills'))
  },

  // Passion Areas
  async getPassionAreas(): Promise<PassionArea[]> {
    return fetchApi(buildQuery('passion_areas'))
  },

  // Holidays
  async getHolidays(filters?: Record<string, string>): Promise<Holiday[]> {
    return fetchApi(buildQuery('holidays', filters))
  },

  // Sync Log
  async getSyncLog(): Promise<SyncLog[]> {
    return fetchApi(buildQuery('sync_log', undefined, 'started_at.desc'))
  },

  // User Roles
  async getMyRole(): Promise<UserRole> {
    const result = await fetchApi<{ role: UserRole }>('/api/auth/role')
    return result.role
  },

  async getUserRoles(): Promise<Array<{ id: string; email: string; full_name: string; role: string; created_at: string }>> {
    return fetchApi(buildQuery('user_roles', undefined, 'full_name.asc'))
  },

  // Batch — for pages needing multiple queries
  async batch(queries: Array<{ resource: string; filters?: Record<string, string>; order?: string; limit?: number }>): Promise<Record<string, unknown[]>> {
    return fetchApi('/api/batch', {
      method: 'POST',
      body: JSON.stringify({ queries }),
    })
  },

  // ========== Write API (RPC endpoints) ==========

  // Assignments
  async createAssignment(data: { project_id: string; consultant_id: string; start_date: string; end_date: string; total_hours: number; is_billable?: boolean }): Promise<{ id: string }> {
    return fetchApi('/api/rpc/create-assignment', { method: 'POST', body: JSON.stringify(data) })
  },

  async updateAssignment(data: { id: string; start_date: string; end_date: string; total_hours: number; notes?: string }): Promise<void> {
    await fetchApi('/api/rpc/update-assignment', { method: 'POST', body: JSON.stringify(data) })
  },

  async deleteAssignment(id: string): Promise<void> {
    await fetchApi('/api/rpc/delete-assignment', { method: 'POST', body: JSON.stringify({ id }) })
  },

  // Projects
  async createProject(data: { client_name: string; project_name: string; project_type?: string; sow_number?: string; sow_amount?: number; planned_hours?: number; status?: string }): Promise<{ id: string }> {
    return fetchApi('/api/rpc/create-project', { method: 'POST', body: JSON.stringify(data) })
  },

  async updateProject(data: { id: string; [key: string]: unknown }): Promise<void> {
    await fetchApi('/api/rpc/update-project', { method: 'POST', body: JSON.stringify(data) })
  },

  async deleteProject(id: string): Promise<void> {
    await fetchApi('/api/rpc/delete-project', { method: 'POST', body: JSON.stringify({ id }) })
  },

  async archiveProjects(): Promise<{ archived_count: number }> {
    return fetchApi('/api/rpc/archive-projects', { method: 'POST', body: '{}' })
  },

  async updateProjectStatus(id: string, status: RevenueStatus): Promise<void> {
    const data: Record<string, unknown> = { id, status }
    if (status === 'done') {
      data.done_at = new Date().toISOString().split('T')[0]
    } else {
      data.done_at = null
    }
    await fetchApi('/api/rpc/update-project', { method: 'POST', body: JSON.stringify(data) })
  },

  // Consultants
  async createConsultant(data: { full_name: string; email: string; title?: string; manager?: string; passion_area_id?: string }): Promise<{ id: string }> {
    return fetchApi('/api/rpc/create-consultant', { method: 'POST', body: JSON.stringify(data) })
  },

  async updateConsultant(id: string, fields: Record<string, unknown>): Promise<void> {
    await fetchApi('/api/rpc/update-consultant', { method: 'POST', body: JSON.stringify({ id, ...fields }) })
  },

  // Self-only mentor update — identity derived server-side from JWT.
  async updateOwnMentor(mentor: string | null): Promise<void> {
    await fetchApi('/api/rpc/update-own-mentor', { method: 'POST', body: JSON.stringify({ mentor }) })
  },

  async updateConsultantPassion(consultant_id: string, passion_area_id: string | null): Promise<void> {
    await fetchApi('/api/rpc/update-consultant-passion', { method: 'POST', body: JSON.stringify({ consultant_id, passion_area_id }) })
  },

  async updateConsultantCountry(consultant_id: string, country: string): Promise<void> {
    await fetchApi('/api/rpc/update-consultant-country', { method: 'POST', body: JSON.stringify({ consultant_id, country }) })
  },

  async updateConsultantUtilizationTarget(consultant_id: string, target: number): Promise<void> {
    await fetchApi('/api/rpc/update-consultant-utilization-target', { method: 'POST', body: JSON.stringify({ consultant_id, target }) })
  },

  // Skills
  async addSkill(name: string): Promise<{ id: string }> {
    return fetchApi('/api/rpc/add-skill', { method: 'POST', body: JSON.stringify({ name }) })
  },

  async upsertConsultantSkill(consultant_id: string, skill_id: string, rating: number): Promise<void> {
    await fetchApi('/api/rpc/upsert-consultant-skill', { method: 'POST', body: JSON.stringify({ consultant_id, skill_id, rating }) })
  },

  async deleteConsultantSkill(consultant_id: string, skill_id: string): Promise<void> {
    await fetchApi('/api/rpc/delete-consultant-skill', { method: 'POST', body: JSON.stringify({ consultant_id, skill_id }) })
  },

  // Passion Areas
  async addPassionArea(name: string): Promise<{ id: string }> {
    return fetchApi('/api/rpc/add-passion-area', { method: 'POST', body: JSON.stringify({ name }) })
  },

  // Holidays
  async addHoliday(data: { country: string; name: string; date: string; recurring?: boolean }): Promise<{ id: string }> {
    return fetchApi('/api/rpc/add-holiday', { method: 'POST', body: JSON.stringify(data) })
  },

  async deleteHoliday(id: string): Promise<void> {
    await fetchApi('/api/rpc/delete-holiday', { method: 'POST', body: JSON.stringify({ id }) })
  },

  // Cost Rates
  async addCostRate(data: { consultant_id: string; hourly_rate: number; effective_date: string }): Promise<{ id: string }> {
    return fetchApi('/api/rpc/add-consultant-cost-rate', { method: 'POST', body: JSON.stringify(data) })
  },

  async deleteCostRate(cost_rate_id: string): Promise<void> {
    await fetchApi('/api/rpc/delete-consultant-cost-rate', { method: 'POST', body: JSON.stringify({ cost_rate_id }) })
  },

  // User Roles
  async addUserRole(data: { email: string; full_name: string; role?: string }): Promise<{ id: string }> {
    return fetchApi('/api/rpc/add-user-role', { method: 'POST', body: JSON.stringify(data) })
  },

  async updateUserRole(user_id: string, role: string): Promise<void> {
    await fetchApi('/api/rpc/update-user-role', { method: 'POST', body: JSON.stringify({ user_id, role }) })
  },

  async removeUserRole(user_id: string): Promise<void> {
    await fetchApi('/api/rpc/remove-user-role', { method: 'POST', body: JSON.stringify({ user_id }) })
  },

  // Saved Views
  async getSavedViews(page: string): Promise<SavedView[]> {
    return fetchApi('/api/rpc/list-views', { method: 'POST', body: JSON.stringify({ page }) })
  },

  async saveView(data: { id?: string; page: string; name: string; filters: Record<string, unknown>; is_default?: boolean }): Promise<{ id: string }> {
    return fetchApi('/api/rpc/save-view', { method: 'POST', body: JSON.stringify(data) })
  },

  async deleteView(id: string): Promise<void> {
    await fetchApi('/api/rpc/delete-view', { method: 'POST', body: JSON.stringify({ id }) })
  },

  // Project Comments
  async getProjectComments(project_id: string): Promise<ProjectComment[]> {
    return fetchApi(buildQuery('project_comments', { project_id: `eq.${project_id}` }, 'created_at.desc'))
  },

  async createComment(project_id: string, content: string): Promise<{ id: string }> {
    return fetchApi('/api/rpc/create-comment', { method: 'POST', body: JSON.stringify({ project_id, content }) })
  },

  async deleteComment(id: string): Promise<void> {
    await fetchApi('/api/rpc/delete-comment', { method: 'POST', body: JSON.stringify({ id }) })
  },

  // Scheduling Email
  async sendSchedulingEmail(project_id: string): Promise<void> {
    await fetchApi('/api/rpc/send-scheduling-email', { method: 'POST', body: JSON.stringify({ project_id }) })
  },

  // Sync
  async triggerSync(sync_type: string): Promise<void> {
    await fetchApi('/api/trigger-sync', { method: 'POST', body: JSON.stringify({ sync_type }) })
  },
}
