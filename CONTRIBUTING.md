# Contributing

> **This repo is not actively maintained.** Issues and discussion threads
> may go unread. PRs that match the patterns below have a real chance of
> landing; everything else is better as a fork.

This is a small project and should stay small — the goal is a clean,
readable exoskeleton that forks well, not a feature-rich platform.

## What fits

- **Bug fixes** — always welcome.
- **Generic improvements** — accessibility, test coverage, dependency updates,
  security hardening, build-time improvements.
- **New adapter reference implementations** — e.g. a `LinearTaskSink` or
  `SalesforceEngagementSource` committed alongside the existing reference impls.
- **Documentation** — if something took you more than ten minutes to figure
  out, write it down.

## What doesn't

- **Organization-specific features** — if the change only makes sense for
  one firm's workflow, keep it in your fork.
- **Broad architectural overhauls** — discuss in an issue before opening a PR.
- **Yet another UI framework** — the inline-style dark theme is intentional;
  keep it or propose an alternative in an issue first.

## Workflow

1. Open an issue for anything non-trivial so we can agree the approach before
   you invest time.
2. Create a feature branch off `main`.
3. Keep the PR focused — one change per PR.
4. Run `npm run lint` and `npm test` before pushing.
5. Describe the change in the PR body: what it does, why it's needed, and
   anything a reviewer should know.

## Commit style

- Imperative present tense: `add tasks table`, not `added tasks table`.
- One change per commit where practical.
- Reference issues in the body: `Closes #42`.

## Code style

- TypeScript strict mode — no `any` unless there's a reason you can explain.
- Inline styles via CSS variables (`var(--bg-card)`, etc.) — no CSS frameworks.
- Data fetching via `src/lib/api.ts` — no direct `supabase.from()` calls in
  pages (enforced by the `authz-lint.yml` CI check).
- API handlers wrapped in `withAuth()` or `withApiKeyAuth()` — no exceptions.

## Security

- Never commit `.env*` files — they're gitignored for a reason.
- All `SUPABASE_SERVICE_ROLE_KEY` usage stays server-side (`api/_lib/*`).
- Validate all input at API boundaries with the helpers in `api/_lib/validate.ts`.
- Read `docs/disaster-recovery.md` if you're touching backup / auth / RLS.

If you find a vulnerability, don't open a public issue — contact the
maintainers privately.
