/**
 * TaskSink — adapter for pushing project checklists / phase tasks to an
 * external task manager (Linear, Jira, Asana, Trello, etc.).
 *
 * When a project is created in Altair, the caller (a sync handler) loads a
 * project template from `templates/` and asks the TaskSink to materialize the
 * template's checklist items in the external system. Status changes flow
 * either direction depending on your integration.
 *
 * Reference impl: `api/adapters/InternalTasksSink.ts` — writes tasks to a
 * built-in Postgres `tasks` table so you can use Altair without any
 * external task manager at all.
 *
 * To wire your own: copy this file to e.g. `LinearTaskSink.ts`, implement
 * the interface, and call it from the handler that creates projects.
 */

export interface TaskTemplate {
  /** Template identifier (matches a filename in `templates/`). */
  id: string

  /** Display name. */
  name: string

  /** Optional grouping — e.g. ["Setup", "Active", "Closeout"]. */
  phases?: string[]

  /** Checklist items to materialize when a project is created. */
  items: TaskTemplateItem[]
}

export interface TaskTemplateItem {
  /** Short title shown to the assignee. */
  title: string

  /** Optional long description. */
  description?: string

  /** Which phase (if any) this item belongs to. Must match a value in `phases`. */
  phase?: string

  /**
   * Due-date offset relative to engagement start (days). Negative numbers
   * = before start (e.g. -14 = two weeks before kickoff). Null = no due date.
   */
  due_offset_days?: number | null

  /** Freeform tags for downstream filtering. */
  tags?: string[]
}

export interface CreatedTaskRef {
  /** Altair's internal task ID (if the impl creates a Altair row too). */
  internal_id?: string

  /** External system's task ID (Linear issue ID, Jira key, etc.). */
  external_id: string

  /** Optional link for the UI to "Open in external system". */
  external_link?: string
}

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled'

export interface TaskSink {
  /** Adapter name — used in `sync_log.sync_type`. */
  readonly name: string

  /**
   * Materialize a template's items as tasks against a project.
   * Returns one CreatedTaskRef per template item, in the same order.
   */
  createProjectTasks(params: {
    projectId: string
    projectName: string
    engagementStart?: Date | null
    template: TaskTemplate
  }): Promise<CreatedTaskRef[]>

  /**
   * Update the status of an existing task.
   */
  updateTaskStatus(taskRef: CreatedTaskRef, status: TaskStatus): Promise<void>

  /**
   * Close / archive all tasks for a project (typically called when the
   * engagement reaches `done`). Implementations can no-op if their system
   * doesn't support archival.
   */
  closeProjectTasks?(projectId: string): Promise<void>
}
