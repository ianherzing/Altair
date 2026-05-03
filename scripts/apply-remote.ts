/**
 * Apply Altair's full SQL stack to a remote Supabase project in one command.
 *
 * Three files make up the stack:
 *   1. schema.sql         — tables, enums, indexes, triggers, RPCs, RLS
 *   2. revenue_engine.sql — monthly snapshot / billing rate functions
 *   3. seed.sql           — rich synthetic demo dataset (16 consultants, 20 projects, 46 assignments)
 *
 * Usage:
 *   npm run apply:remote
 *
 * Required env vars (read from .env.local if present, or set inline):
 *   SUPABASE_URL                — https://<project-ref>.supabase.co
 *   SUPABASE_DB_URL             — direct Postgres connection string
 *                                 (Settings → Database → Connection string → URI)
 *   SUPABASE_SERVICE_ROLE_KEY   — (Settings → API → service_role key)
 *
 * Flags:
 *   --seed-only   Skip schema and revenue_engine; just re-run seed.sql
 *   --skip-user   Skip creating the demo admin user
 *
 * Idempotency: schema.sql is authoritative — it expects a fresh public
 * schema (re-run `DROP SCHEMA public CASCADE` first when iterating). seed
 * uses ON CONFLICT DO NOTHING so it's safe to re-run. Demo user creation
 * is idempotent (skipped if the user already exists).
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Client } from 'pg'

type Env = {
  SUPABASE_URL: string
  SUPABASE_DB_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

const DEMO_EMAIL = 'demo@example.com'
const DEMO_PASSWORD = 'demo-password-1234'

async function loadEnv(): Promise<Env> {
  // Try .env.local first
  try {
    const text = await readFile(resolve('.env.local'), 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (m && !process.env[m[1]]) {
        // Strip surrounding quotes if present
        process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, '$1')
      }
    }
  } catch {
    // .env.local doesn't exist — fall back to process.env
  }

  const missing: string[] = []
  for (const key of ['SUPABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
    if (!process.env[key]) missing.push(key)
  }
  if (missing.length) {
    console.error(`❌ Missing env vars: ${missing.join(', ')}`)
    console.error('   Set them in .env.local (see script docstring for format).')
    process.exit(1)
  }

  return {
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }
}

async function runSqlFile(client: Client, path: string): Promise<void> {
  const sql = await readFile(path, 'utf8')
  try {
    await client.query(sql)
  } catch (err) {
    const e = err as Error & { position?: string; hint?: string }
    console.error(`\n❌ Failed applying ${path}`)
    console.error(`   ${e.message}`)
    if (e.hint) console.error(`   hint: ${e.hint}`)
    throw err
  }
}

async function createDemoUser(env: Env): Promise<void> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    }),
  })

  if (res.status >= 200 && res.status < 300) {
    console.log(`  ▸ auth user ${DEMO_EMAIL} created`)
  } else if (res.status === 422 || res.status === 409) {
    console.log(`  ▸ auth user ${DEMO_EMAIL} already exists`)
  } else {
    const body = await res.text()
    console.error(`  ⚠ auth user create returned HTTP ${res.status}: ${body}`)
  }
}

async function grantAdminRole(client: Client): Promise<void> {
  await client.query(
    `INSERT INTO public.user_roles (email, full_name, role)
     VALUES ($1, $2, 'pmo_admin')
     ON CONFLICT (email) DO UPDATE SET role = 'pmo_admin'`,
    [DEMO_EMAIL, 'Demo Admin'],
  )
}

async function main() {
  const argv = new Set(process.argv.slice(2))
  const seedOnly = argv.has('--seed-only')
  const skipUser = argv.has('--skip-user')

  const env = await loadEnv()

  console.log(`▶ Connecting to ${env.SUPABASE_URL}`)
  const client = new Client({
    connectionString: env.SUPABASE_DB_URL,
    // Supabase hosted always uses TLS; direct connection (port 5432) accepts
    // the provided certs without explicit CA file.
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    if (!seedOnly) {
      console.log('▶ Applying schema.sql (full consolidated schema)...')
      await runSqlFile(client, resolve('supabase/schema.sql'))

      console.log('▶ Applying revenue_engine.sql...')
      await runSqlFile(client, resolve('supabase/revenue_engine.sql'))
    }

    console.log('▶ Applying seed.sql...')
    await runSqlFile(client, resolve('supabase/seed.sql'))

    if (!skipUser) {
      console.log('▶ Creating demo admin user...')
      await createDemoUser(env)
      await grantAdminRole(client)
    }

    console.log('\n✅ Remote project ready.\n')
    console.log(`   URL:      ${env.SUPABASE_URL}`)
    console.log(`   Login:    ${DEMO_EMAIL} / ${DEMO_PASSWORD}`)
    console.log('\n   Next: npm run dev  →  http://localhost:5173\n')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
