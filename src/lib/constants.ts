/** Default timeout for data-loading hooks (ms) */
export const LOAD_TIMEOUT_MS = 10_000

/** Auth provider initialization timeout (ms) */
export const AUTH_TIMEOUT_MS = 10_000

/** Resourcing page uses a longer timeout due to heavy data joins */
export const RESOURCING_TIMEOUT_MS = 15_000

/** Kanban hides Done projects this many days after done_at (archive itself still runs at 90) */
export const KANBAN_DONE_HIDE_AFTER_DAYS = 7
