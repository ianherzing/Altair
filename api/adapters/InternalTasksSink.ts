import { getSupabaseAdmin } from '../_lib/supabase-admin.js'
import type {
  TaskSink,
  TaskTemplate,
  CreatedTaskRef,
  TaskStatus,
} from './TaskSink.js'

/**
 * InternalTasksSink — reference TaskSink that writes to Altair's built-in
 * Postgres `tasks` table (see `supabase/migration_v72_tasks_table.sql`).
 *
 * Use this as-is if you don't have (or don't want to integrate) an external
 * task manager. For Linear / Jira / Asana, fork this file and replace the
 * Supabase calls with API calls to the external system.
 */
export class InternalTasksSink implements TaskSink {
  readonly name = 'internal-tasks'

  private db = getSupabaseAdmin()

  async createProjectTasks(params: {
    projectId: string
    projectName: string
    engagementStart?: Date | null
    template: TaskTemplate
  }): Promise<CreatedTaskRef[]> {
    const { projectId, engagementStart, template } = params

    const rows = template.items.map((item) => {
      let dueDate: string | null = null
      if (item.due_offset_days != null && engagementStart) {
        const d = new Date(engagementStart)
        d.setDate(d.getDate() + item.due_offset_days)
        dueDate = d.toISOString().slice(0, 10)
      }
      return {
        project_id: projectId,
        template_id: template.id,
        phase: item.phase ?? null,
        title: item.title,
        description: item.description ?? null,
        tags: item.tags ?? [],
        due_date: dueDate,
      }
    })

    const { data, error } = await this.db
      .from('tasks')
      .insert(rows)
      .select('id')

    if (error) throw new Error(`InternalTasksSink: insert failed: ${error.message}`)
    if (!data) return []

    return data.map((r) => ({ internal_id: r.id, external_id: r.id }))
  }

  async updateTaskStatus(taskRef: CreatedTaskRef, status: TaskStatus): Promise<void> {
    const id = taskRef.internal_id ?? taskRef.external_id
    const { error } = await this.db
      .from('tasks')
      .update({ status })
      .eq('id', id)
    if (error) throw new Error(`InternalTasksSink: update failed: ${error.message}`)
  }

  async closeProjectTasks(projectId: string): Promise<void> {
    const { error } = await this.db
      .from('tasks')
      .update({ status: 'done' })
      .eq('project_id', projectId)
      .neq('status', 'done')
    if (error) throw new Error(`InternalTasksSink: close failed: ${error.message}`)
  }
}
