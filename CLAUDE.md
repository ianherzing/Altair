# Altair — Development Guide (for Claude Code / AI assistants)

## Stack
- **Frontend:** React 19 + TypeScript + Vite
- **Database:** Supabase (Postgres + Realtime)
- **API:** Vercel serverless functions (`/api/`)
- **Hosting:** Vercel

## Key Directories

- `src/pages/` — Page components (Resourcing, Projects, Engineers, etc.)
- `src/components/` — Shared UI components
- `src/hooks/` — Data-fetching hooks (one per dashboard)
- `src/lib/` — Supabase client, API client, auth context, utilities
- `src/types/` — TypeScript types mirroring the DB schema
- `api/` — Vercel serverless functions
- `api/_lib/` — Shared backend helpers (auth, Casbin, Supabase admin, email, slack)
- `api/adapters/` — Adapter interfaces + reference implementations for
  EngagementSource / TaskSink / TimeOffSource / NotificationSink
- `api/ingest/` — Webhook handlers (X-API-Key-authed)
- `api/rpc/` — Authenticated write RPCs
- `supabase/` — Schema and numbered migrations
- `templates/` — JSON project-task templates

## Conventions

- **CSS:** Inline styles via CSS variables (`var(--bg-card)`, `var(--text-primary)`, etc.). No CSS frameworks. Neutral dark palette — override in `src/index.css` to rebrand.
- **State:** React `useState` / `useMemo`. No state management library.
- **Data access:** Pages call `src/lib/api.ts` helpers. **Pages must not call `supabase.from()` or `supabase.rpc()` directly** — the `authz-lint.yml` CI check enforces this.
- **API handlers:** Always wrap in `withAuth()` (JWT-authed) or `withApiKeyAuth()` (x-api-key-authed). Missing wrapper = CI failure.
- **TypeScript:** Strict mode. Avoid `any`.
- **Validation:** Use `api/_lib/validate.ts` helpers (`isUUID`, `isEmail`, etc.) for all user-supplied inputs.
- **Permissions:** Casbin + Supabase RLS + column whitelists. Never bypass RLS from the client.

## Working on Adapters

Adapters live in `api/adapters/`. Each adapter has:
1. An **interface** file defining the contract (`EngagementSource.ts`, etc.)
2. A **reference implementation** (`InternalTasksSink.ts`, `CsvTimeOffSource.ts`, etc.)
3. Optionally a **webhook/handler** that exposes it over HTTP (`api/ingest/*`)

When wiring a new external system, add a new file next to the references (do not modify the references). Read `api/adapters/README.md` first.

## Branch Strategy

- `main` — production-ready code. Protected.
- Feature branches off `main`. Small, focused PRs.

## Testing

- `npm run lint` — ESLint
- `npm test` — Vitest (runs what's in `src/**/*.test.ts`)
- No e2e harness yet.
