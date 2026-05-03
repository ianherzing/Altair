# Altair: Backup & Disaster Recovery

Altair runs on three platforms:

| Platform | Role |
|----------|------|
| **Supabase** | Postgres database, API, Realtime |
| **GitHub** | Source code, CI/CD (Actions), secrets |
| **Vercel** | React frontend hosting, deployments |

---

## Backup Strategy

### Automatic

| Layer | Mechanism | Frequency | Retention | RPO |
|-------|-----------|-----------|-----------|-----|
| **Supabase database** | Supabase Pro daily backups | Daily | 7 days | 24 hours |
| **Source code** | Git | Every push | Unlimited | Real-time |
| **Vercel deployments** | Vercel retention policy | Every deploy | Per Vercel plan | Real-time |

For longer retention than Supabase's 7-day window, set up your own pg_dump-based backup workflow (see "External backups" below).

### Manual

| Item | Backup Method | Store Where | Frequency |
|------|--------------|-------------|-----------|
| GitHub Actions secrets | Copy to your secret manager | 1Password / equivalent | On any change |
| Vercel environment variables | `vercel env pull` | Your secret manager | On any change |

### What Can Be Reconstructed

Data ingested via the EngagementSource / TimeOffSource adapters can be re-synced from the source system. **Critical irreplaceable data** (not re-syncable):

- `monthly_snapshots` with `is_locked = true` — point-in-time revenue records
- Manual engineer assignments and any assignment overrides
- Custom cost rates, billing overrides, and other manual financial adjustments

These must be recovered from backups.

---

## External backups (optional, recommended for production)

Supabase dashboard backups retain 7 days. For longer retention, run `pg_dump` against your Supabase Postgres on a schedule and store the artifact somewhere durable (GitHub Actions artifact, S3, etc.). A minimal sketch:

```bash
# Run from CI with PGPASSWORD + connection details as secrets.
pg_dump --no-owner --no-privileges \
  --dbname "$SUPABASE_DB_URL" \
  --file altair-$(date -u +%Y%m%d).sql
```

Schedule it daily, retain artifacts as long as your backup policy requires, and test-restore quarterly. The restore commands in "Scenario 2 — Option B" below assume a `pg_dump` output exists.

---

## Recovery Procedures

### Scenario 1: Bad Vercel Deployment

**Recovery time:** Seconds

1. Vercel Dashboard → your Altair project → **Instant Rollback**
2. Or CLI: `vercel rollback [deployment-url]`

After rollback, auto-deployment is disabled. To resume: `vercel promote [deployment-url]`.

### Scenario 2: Accidental Data Deletion (< 7 days)

**Option A — Restore from Supabase dashboard backup**
1. Supabase Dashboard → Database → Backups → Scheduled backups
2. Select a backup before the deletion
3. Click Restore (project is inaccessible during restore)

**Option B — Restore from your own external backup**
Requires that you've set up the workflow described in "External backups" above.

1. Locate your latest backup artifact (GitHub Actions artifacts, S3, etc.).
2. Restore (preferably to a staging project first):
```bash
psql --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --command 'SET session_replication_role = replica' \
  --file altair-YYYYMMDD.sql \
  --dbname "$TARGET_DB_URL"
```

### Scenario 3: Full Database Recovery (> 7 days ago)

Supabase dashboard backups only retain 7 days. Recovery beyond that window requires your own external backups (see "External backups" above) — without them, data older than 7 days is unrecoverable.

1. Retrieve the desired backup from your external store
2. Create a new Supabase project (or reuse an existing one)
3. Restore with `psql` as in Scenario 2, Option B
4. **Post-restore:**
   - Reset passwords for custom database roles
   - If permission errors arise, comment out `ALTER ... OWNER TO "supabase_admin"` lines
   - Re-enable Database Webhooks if used
   - Re-enable Realtime publication settings
   - Update `SUPABASE_DB_URL` secret in GitHub if the project changed

### Scenario 4: Complete Platform Recovery

1. **Supabase** — create new project, restore from CLI backup (Scenario 3)
2. **Vercel** — import the repo; restore env vars from your secret manager:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - Any adapter-specific env vars (see `.env.example`)
3. **GitHub Actions secrets** — restore from your secret manager
4. **Re-seed external data** — trigger each adapter sync workflow

---

## GitHub Actions Secrets Inventory

Maintain these in your secret manager of choice as source of truth:

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Supabase REST API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server-side only) |
| `SUPABASE_DB_URL` | Direct Postgres connection string (backups) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | SMTP for notifications (optional) |
| `SLACK_BOT_TOKEN` / `SLACK_CHANNEL_ID` | Slack notifications (optional) |
| `ALTAIR_EXTERNAL_API_KEY` | API key for `/api/external/*` read API and `/api/ingest/*` webhooks |
| Adapter-specific secrets | Whatever your EngagementSource / TaskSink / TimeOffSource adapters need |

---

## Maintenance Checklist

### On Any Secret Change
- Update your secret manager
- Rotate the corresponding value in GitHub Actions secrets and Vercel env

### Monthly
- Verify your external backup workflow (if any) has been running successfully
- Test-restore a recent backup into a throwaway Supabase project

### Quarterly
- Rotate API tokens for any wired adapters
- Confirm Supabase dashboard shows daily backups active
- Check database size (consider PITR if growth is significant)
