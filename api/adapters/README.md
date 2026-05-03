# Adapters

Altair ships as a PSA (Professional Services Automation) **exoskeleton** — the
data model, UI, auth, and RLS are built in, but integrations with your CRM,
task manager, HR system, or chat tool are **not**. Instead, Altair defines a
small set of interfaces (adapters) that you implement against your own systems.

This directory holds:

| File | What it is |
|---|---|
| `EngagementSource.ts` | Interface for ingesting projects/engagements from an external source of truth (CRM, ticketing system, spreadsheet) |
| `TaskSink.ts` | Interface for pushing project checklists/phase tasks to an external task manager |
| `TimeOffSource.ts` | Interface for importing PTO / time-off from an HR system |
| `NotificationSink.ts` | Interface for sending notifications (Slack, email, Teams, webhook) |
| `AuthProvider.ts` | Interface / documentation for plugging in SSO |

## Reference implementations

Each adapter ships with a minimal reference implementation to make the
integration pattern concrete:

| Adapter | Reference impl |
|---|---|
| EngagementSource | `POST /api/ingest/engagement` webhook (accepts JSON) |
| TaskSink | Built-in Postgres `tasks` table (no external system) |
| TimeOffSource | CSV import + manual UI entry |
| NotificationSink | Email via `api/_lib/email.ts` + Slack via `api/_lib/slack.ts` |
| AuthProvider | Supabase Auth email+password (configured in `src/pages/Login.tsx`) |

Use these as templates. When you're ready to wire your own systems, copy the
reference into a new file (e.g. `SalesforceEngagementSource.ts`) and replace
the logic with real API calls to your CRM.

## How Altair uses adapters

Today, Altair does **not** auto-dispatch to adapter implementations — there is
no plugin loader. Instead, you wire your implementation into the handlers that
need it. For example:

1. Implement `EngagementSource` in `api/adapters/MyCRMEngagementSource.ts`.
2. Call it from a sync handler (e.g. a new `api/rpc/sync-engagements.ts`) or a
   scheduled GitHub Actions workflow.
3. Persist ingested records into the `projects` table via `supabase-admin`.

This keeps the exoskeleton simple and unopinionated. Future versions may add
a plugin loader, but for now you're expected to glue the adapter into Altair
the same way you'd glue in any other module.

## Design principles

- **Minimal surface** — each interface exposes the smallest method set that
  matters. Extend in your own fork if you need more.
- **No shared state between adapters** — one integration failing must never
  break another.
- **All I/O returns Promises** — adapters can be sync or async under the hood.
- **Errors propagate** — adapters throw; callers decide what to do with the
  failure (retry, log to `sync_log`, fail the workflow).
- **No coupling to Supabase** — adapters are plain TypeScript; they don't
  know Altair's DB exists. The caller writes ingested data to Supabase.
