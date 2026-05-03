-- ============================================================================
-- Altair — Consolidated Schema
--
-- Applies the full end-state schema (tables, enums, indexes, helper functions,
-- triggers, RPC functions, RLS policies, column grants, realtime publication)
-- that the app expects, in one pass against a fresh empty `public` schema.
--
-- Order of sections:
--   1. Extensions
--   2. Enums
--   3. Sequences
--   4. Tables (FK-dependency order)
--   5. Indexes
--   6. Helper functions (role checks, updated_at, altair_uid, audit)
--   7. Triggers
--   8. RPC functions (create_/update_/delete_/* called by the API layer)
--   9. Row-Level Security
--  10. Column-level grants
--  11. Realtime publication
--
-- Apply with:
--   psql $SUPABASE_DB_URL -f supabase/schema.sql
-- or via `npm run apply:remote` (which also applies revenue_engine.sql + seed.sql).
--
-- Idempotent-by-default: CREATE … IF NOT EXISTS / CREATE OR REPLACE are used
-- where possible, but the file assumes a fresh public schema. If re-applying
-- to an already-populated database, drop the schema first.
-- ============================================================================

-- ------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ------------------------------------------------------------------
-- 2. ENUMS
-- ------------------------------------------------------------------
CREATE TYPE public.project_type AS ENUM ('billable', 'non_billable', 'pto');

CREATE TYPE public.revenue_status AS ENUM (
  'to_do',              -- Imported upstream (Salesforce/CRM), not yet scheduled
  'soft_unconfirmed',   -- Scheduled, client hasn't confirmed
  'soft_at_risk',       -- Dates confirmed, SOW not signed
  'hard_scheduled',     -- SOW signed & confirmed
  'active',             -- Engagement in progress
  'done'                -- Engagement completed
);

CREATE TYPE public.user_role AS ENUM (
  'pmo_admin',           -- Full CRUD
  'consultant_readonly', -- Roster read basics
  'finance_viewer',      -- Read-only dashboards (revenue, margin)
  'leadership'           -- Read-most + write-some
);

-- ------------------------------------------------------------------
-- 3. SEQUENCES
-- ------------------------------------------------------------------
-- Monotonic JUP-#### id stamped onto every project row on insert.
CREATE SEQUENCE IF NOT EXISTS public.altair_uid_seq START 1000;

-- ------------------------------------------------------------------
-- 4. TABLES
-- ------------------------------------------------------------------

-- user_roles: permission gate for all RLS policies. No FKs (keyed by email).
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'consultant_readonly',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- passion_areas: configurable dropdown referenced by consultants.passion_area_id.
CREATE TABLE public.passion_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- skills: configurable dropdown referenced by consultant_skills.skill_id.
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- consultants: the human roster (seeded via TimeOffSource/HR adapter).
CREATE TABLE public.consultants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  title TEXT,
  manager TEXT,
  mentor TEXT,
  skills TEXT[] DEFAULT '{}',            -- legacy denorm; new code reads consultant_skills
  passion_area TEXT,                     -- legacy denorm; new code reads passion_area_id
  passion_area_id UUID REFERENCES public.passion_areas(id),
  country TEXT,
  is_active BOOLEAN DEFAULT true,
  is_mentor BOOLEAN NOT NULL DEFAULT false,
  department TEXT,
  utilization_target INTEGER NOT NULL DEFAULT 80,
  hire_date DATE,
  offboarded_at TIMESTAMPTZ,
  -- Current effective cost rate; history lives in consultant_cost_rates.
  hourly_cost_rate NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- projects: the engagements (seeded from EngagementSource adapter).
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable numeric id assigned by Altair (JUP-####).
  altair_uid TEXT UNIQUE NOT NULL,
  -- Free-form upstream id (Salesforce Opp id, Jira key, CSV ref, etc.).
  external_id TEXT UNIQUE,
  client_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_type public.project_type DEFAULT 'billable',
  sow_number TEXT,
  sow_amount NUMERIC(12,2),
  planned_hours NUMERIC(10,2),
  status public.revenue_status DEFAULT 'soft_unconfirmed',
  engagement_start DATE,   -- derived from assignments
  engagement_end DATE,     -- derived from assignments
  done_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  midway_notification_sent BOOLEAN NOT NULL DEFAULT false,
  -- Optional leadership fields (FK to consultants).
  manager_id UUID REFERENCES public.consultants(id),
  program_manager_id UUID REFERENCES public.consultants(id),
  managing_director_id UUID REFERENCES public.consultants(id),
  -- Free-form role names (derived from consultants.full_name at write time).
  practice_manager TEXT,
  project_manager TEXT,
  -- Client / engagement metadata.
  client_contact_email TEXT,
  sla TEXT,
  onsite_required BOOLEAN DEFAULT false,
  special_skills TEXT[] DEFAULT '{}',
  client_constraints TEXT[] DEFAULT '{}',
  pm_email TEXT,
  po_required BOOLEAN DEFAULT false,
  po_received BOOLEAN DEFAULT false,
  kickoff_internal DATE,
  kickoff_external DATE,
  readout_meeting DATE,
  box_folder_link TEXT,
  internal_slack_link TEXT,
  external_slack_link TEXT,
  -- Upstream sync timestamps (used by the EngagementSource adapter).
  upstream_synced_at TIMESTAMPTZ,
  upstream_writeback_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- assignments: consultant-to-project allocations (the core scheduling table).
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  consultant_id UUID NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_hours NUMERIC(10,2) NOT NULL,
  is_billable BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT assignments_valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT assignments_positive_hours CHECK (total_hours > 0)
);

-- consultant_skills: rating matrix (1-3) for skill search.
CREATE TABLE public.consultant_skills (
  consultant_id UUID NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 3),
  PRIMARY KEY (consultant_id, skill_id)
);

-- consultant_cost_rates: history of hourly cost rates (for margin calcs).
CREATE TABLE public.consultant_cost_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  hourly_rate NUMERIC(10,2) NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  modified_by TEXT,
  modified_at TIMESTAMPTZ,
  CONSTRAINT consultant_cost_rates_unique_date UNIQUE (consultant_id, effective_date)
);

-- monthly_snapshots: per-month revenue lock (trigger-maintained).
CREATE TABLE public.monthly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  month DATE NOT NULL,                   -- first day of the month
  total_hours NUMERIC(10,2) NOT NULL,
  bill_rate NUMERIC(10,2) NOT NULL,
  revenue NUMERIC(12,2) NOT NULL,
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,
  modified_by TEXT,
  modified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, month)
);

-- holidays: per-country holiday list for capacity calcs.
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (country, date)
);

-- sync_log: audit of adapter sync runs (EngagementSource, TimeOffSource, etc.).
CREATE TABLE public.sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,               -- 'engagement_sync','timeoff_sync','month_lock',…
  status TEXT NOT NULL,                  -- 'success','partial','error'
  records_processed INT DEFAULT 0,
  records_created INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- project_comments: free-form discussion pinned to a project.
CREATE TABLE public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- saved_views: per-user filter bookmarks on list pages.
CREATE TABLE public.saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  page TEXT NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- historical_revenue: optional overlay for pre-Altair revenue history.
CREATE TABLE public.historical_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month TEXT NOT NULL,                   -- "January", "February", …
  client_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  sow_number TEXT NOT NULL,
  revenue NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- tasks: generic project-task table backing the built-in TaskSink reference
-- implementation. Replace this table (and the related RPCs/RLS) if you wire
-- an external task manager — nothing in Altair's core depends on it.
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  template_id TEXT,
  phase TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','done','blocked','cancelled')),
  due_date DATE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  assigned_to TEXT,
  external_id TEXT,
  external_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- audit_log: records all row-level write operations on sensitive tables.
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- user_roles_audit_log: records role grants/revocations for compliance.
CREATE TABLE public.user_roles_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL,
  acting_user_email TEXT,
  target_user_id UUID,
  old_role TEXT,
  new_role TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------------
-- 5. INDEXES
-- ------------------------------------------------------------------
CREATE INDEX idx_consultants_active     ON public.consultants (is_active);
CREATE INDEX idx_consultants_manager    ON public.consultants (manager);
CREATE INDEX idx_consultants_mentor     ON public.consultants (mentor);
CREATE INDEX idx_consultants_department ON public.consultants (department);

CREATE INDEX idx_projects_active      ON public.projects (is_active);
CREATE INDEX idx_projects_external_id ON public.projects (external_id);

CREATE INDEX idx_assignments_project ON public.assignments (project_id);
CREATE INDEX idx_assignments_engineer ON public.assignments (consultant_id);
CREATE INDEX idx_assignments_dates   ON public.assignments (start_date, end_date);

CREATE INDEX idx_consultant_cost_rates_lookup
  ON public.consultant_cost_rates (consultant_id, effective_date DESC);

CREATE INDEX idx_snapshots_project_month ON public.monthly_snapshots (project_id, month);
CREATE INDEX idx_snapshots_locked        ON public.monthly_snapshots (is_locked);

CREATE INDEX idx_holidays_country ON public.holidays (country);
CREATE INDEX idx_holidays_date    ON public.holidays (date);

CREATE INDEX idx_sync_log_type_started ON public.sync_log (sync_type, started_at DESC);

CREATE INDEX idx_user_roles_email ON public.user_roles (email);
CREATE INDEX idx_user_roles_role  ON public.user_roles (role);

CREATE INDEX idx_project_comments_project_id ON public.project_comments (project_id);

CREATE INDEX idx_saved_views_user_page ON public.saved_views (user_email, page);
-- Enforce one default view per user-page pair.
CREATE UNIQUE INDEX idx_saved_views_default
  ON public.saved_views (user_email, page) WHERE is_default = true;

CREATE INDEX idx_historical_revenue_year       ON public.historical_revenue (year);
CREATE INDEX idx_historical_revenue_sow        ON public.historical_revenue (sow_number);
CREATE INDEX idx_historical_revenue_client     ON public.historical_revenue (client_name);
CREATE INDEX idx_historical_revenue_year_month ON public.historical_revenue (year, month);

CREATE INDEX idx_tasks_project ON public.tasks (project_id);
CREATE INDEX idx_tasks_status  ON public.tasks (status);
CREATE INDEX idx_tasks_due     ON public.tasks (due_date);

-- ------------------------------------------------------------------
-- 6. HELPER FUNCTIONS
-- ------------------------------------------------------------------

-- Role lookup: does the JWT subject have the given role in user_roles?
CREATE OR REPLACE FUNCTION public.has_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
      AND role = p_role::public.user_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_pmo_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
      AND role = 'pmo_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_pmo_or_leadership()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_pmo_admin() OR public.has_role('leadership');
$$;

-- Auto-updated updated_at column. Attached as BEFORE-UPDATE trigger.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Monotonic JUP-#### id; stamped onto projects on insert.
CREATE OR REPLACE FUNCTION public.set_altair_uid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.altair_uid IS NULL THEN
    NEW.altair_uid := 'JUP-' || LPAD(nextval('public.altair_uid_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Derive engagement_start/engagement_end on projects from assignment date ranges.
CREATE OR REPLACE FUNCTION public.update_project_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_project_id := OLD.project_id;
  ELSE
    v_project_id := NEW.project_id;
  END IF;

  UPDATE public.projects SET
    engagement_start = (SELECT MIN(start_date) FROM public.assignments WHERE project_id = v_project_id),
    engagement_end   = (SELECT MAX(end_date)   FROM public.assignments WHERE project_id = v_project_id),
    updated_at       = now()
  WHERE id = v_project_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Stamp completed_at when a task flips to 'done'; clear it on un-done.
CREATE OR REPLACE FUNCTION public.tasks_stamp_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at = now();
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Record every INSERT/UPDATE/DELETE on a sensitive table to audit_log.
CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_resource_id TEXT;
  v_user_email  TEXT;
  v_details     JSONB;
BEGIN
  v_user_email := COALESCE(auth.jwt() ->> 'email', 'service_role');

  IF TG_OP = 'DELETE' THEN
    v_resource_id := OLD.id::TEXT;
    v_details := jsonb_build_object('operation', TG_OP, 'old', to_jsonb(OLD));
  ELSIF TG_OP = 'UPDATE' THEN
    v_resource_id := NEW.id::TEXT;
    v_details := jsonb_build_object('operation', TG_OP, 'old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_resource_id := NEW.id::TEXT;
    v_details := jsonb_build_object('operation', TG_OP, 'new', to_jsonb(NEW));
  END IF;

  INSERT INTO public.audit_log (user_email, action, resource, resource_id, details)
  VALUES (v_user_email, TG_OP, TG_TABLE_NAME, v_resource_id, v_details);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Record role grants/revocations to user_roles_audit_log.
CREATE OR REPLACE FUNCTION public.audit_user_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_roles_audit_log (operation, acting_user_email, target_user_id, old_role, new_role)
    VALUES ('INSERT', auth.jwt() ->> 'email', NEW.id, NULL, NEW.role::TEXT);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.user_roles_audit_log (operation, acting_user_email, target_user_id, old_role, new_role)
    VALUES ('UPDATE', auth.jwt() ->> 'email', NEW.id, OLD.role::TEXT, NEW.role::TEXT);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.user_roles_audit_log (operation, acting_user_email, target_user_id, old_role, new_role)
    VALUES ('DELETE', auth.jwt() ->> 'email', OLD.id, OLD.role::TEXT, NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ------------------------------------------------------------------
-- 7. TRIGGERS
-- ------------------------------------------------------------------

-- updated_at maintenance
CREATE TRIGGER set_updated_at_consultants    BEFORE UPDATE ON public.consultants       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_projects       BEFORE UPDATE ON public.projects          FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_assignments    BEFORE UPDATE ON public.assignments       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_snapshots      BEFORE UPDATE ON public.monthly_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_user_roles     BEFORE UPDATE ON public.user_roles        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_saved_views    BEFORE UPDATE ON public.saved_views       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tasks_set_updated_at          BEFORE UPDATE ON public.tasks             FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Project engagement-date derivation from assignment rows.
CREATE TRIGGER derive_project_dates
  AFTER INSERT OR UPDATE OR DELETE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_project_dates();

-- Altair UID stamping on projects.
CREATE TRIGGER trg_set_altair_uid
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_altair_uid();

-- Task completed_at auto-stamp.
CREATE TRIGGER tasks_stamp_completed_trg
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_stamp_completed();

-- Audit triggers (financial / role changes — all captured).
CREATE TRIGGER trg_audit_consultant_cost_rates
  AFTER INSERT OR UPDATE OR DELETE ON public.consultant_cost_rates
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();
CREATE TRIGGER trg_audit_historical_revenue
  AFTER INSERT OR UPDATE OR DELETE ON public.historical_revenue
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();
CREATE TRIGGER trg_audit_consultants
  AFTER UPDATE OR DELETE ON public.consultants
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();
CREATE TRIGGER trg_audit_projects
  AFTER UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();
CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_changes();

-- NOTE: auto_refresh_snapshots + trigger_refresh_snapshots live in
-- revenue_engine.sql (applied separately) since that's the revenue-engine
-- concern. Keeping schema.sql focused on core table/RLS/RPC shape.

-- ------------------------------------------------------------------
-- 8. RPC FUNCTIONS
-- Everything in this section is called by name from /api/rpc/*.ts handlers
-- (see api/rpc/*.ts and src/lib/api.ts). Names and signatures must stay
-- stable; renaming requires a coordinated app update.
-- ------------------------------------------------------------------

-- --- Assignments -------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_assignment(
  p_project_id   UUID,
  p_consultant_id UUID,
  p_start_date   DATE,
  p_end_date     DATE,
  p_total_hours  NUMERIC,
  p_is_billable  BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  INSERT INTO public.assignments (project_id, consultant_id, start_date, end_date, total_hours, is_billable)
  VALUES (p_project_id, p_consultant_id, p_start_date, p_end_date, p_total_hours, p_is_billable)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_assignment(
  p_id          UUID,
  p_start_date  DATE,
  p_end_date    DATE,
  p_total_hours NUMERIC,
  p_notes       TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  UPDATE public.assignments
  SET start_date = p_start_date, end_date = p_end_date,
      total_hours = p_total_hours, notes = p_notes
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_assignment(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  DELETE FROM public.assignments WHERE id = p_id;
END;
$$;

-- --- Consultants -------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_consultant(
  p_full_name      TEXT,
  p_email          TEXT,
  p_title          TEXT DEFAULT NULL,
  p_manager        TEXT DEFAULT NULL,
  p_passion_area_id UUID DEFAULT NULL,
  p_is_active      BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  INSERT INTO public.consultants (full_name, email, title, manager, passion_area_id, is_active)
  VALUES (p_full_name, p_email, p_title, p_manager, p_passion_area_id, p_is_active)
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'Permission denied%' THEN RAISE; END IF;
    RAISE EXCEPTION 'An error occurred processing your request.';
END;
$$;

CREATE OR REPLACE FUNCTION public.update_consultant(
  p_id            UUID,
  p_full_name     TEXT DEFAULT NULL,
  p_email         TEXT DEFAULT NULL,
  p_title         TEXT DEFAULT NULL,
  p_manager       TEXT DEFAULT NULL,
  p_is_active     BOOLEAN DEFAULT NULL,
  p_country       TEXT DEFAULT NULL,
  p_offboarded_at TEXT DEFAULT NULL,
  p_mentor        TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  IF p_manager IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.consultants
      WHERE full_name = p_manager AND offboarded_at IS NULL
    ) THEN
      RAISE EXCEPTION 'CONSULTANT_INVALID_MANAGER';
    END IF;
  END IF;

  IF p_mentor IS NOT NULL AND p_mentor <> '__NULL__' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.consultants
      WHERE full_name = p_mentor AND offboarded_at IS NULL
    ) THEN
      RAISE EXCEPTION 'CONSULTANT_INVALID_MENTOR';
    END IF;
  END IF;

  UPDATE public.consultants SET
    full_name   = COALESCE(p_full_name, full_name),
    email       = COALESCE(p_email, email),
    title       = COALESCE(p_title, title),
    manager     = COALESCE(p_manager, manager),
    is_active   = COALESCE(p_is_active, is_active),
    country     = COALESCE(p_country, country),
    offboarded_at = CASE
      WHEN p_offboarded_at = '__NULL__' THEN NULL
      WHEN p_offboarded_at IS NOT NULL THEN p_offboarded_at::DATE
      ELSE offboarded_at
    END,
    mentor = CASE
      WHEN p_mentor = '__NULL__' THEN NULL
      WHEN p_mentor IS NOT NULL THEN p_mentor
      ELSE mentor
    END
  WHERE id = p_id;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'Permission denied%' THEN RAISE; END IF;
    IF SQLERRM IN ('CONSULTANT_INVALID_MANAGER', 'CONSULTANT_INVALID_MENTOR') THEN RAISE; END IF;
    RAISE EXCEPTION 'An error occurred processing your request.';
END;
$$;

CREATE OR REPLACE FUNCTION public.update_consultant_country(
  p_consultant_id UUID,
  p_country       TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  valid_countries TEXT[] := ARRAY[
    'United States', 'Canada', 'United Kingdom', 'India', 'Germany',
    'Australia', 'Netherlands', 'Ireland', 'Singapore', 'Japan',
    'Brazil', 'Mexico', 'France', 'Spain', 'Italy',
    'South Korea', 'Israel', 'Colombia', 'Argentina', 'Chile',
    'Costa Rica', 'Romania', 'Poland', 'Portugal', 'Sweden',
    'Norway', 'Denmark', 'Finland', 'Switzerland', 'Austria',
    'Belgium', 'Czech Republic', 'New Zealand', 'Philippines', 'Taiwan',
    'Hong Kong', 'Thailand', 'Vietnam', 'Indonesia', 'Malaysia',
    'South Africa', 'Nigeria', 'Kenya', 'Egypt', 'United Arab Emirates',
    'Saudi Arabia', 'Turkey', 'Greece', 'Ukraine', 'Pakistan',
    'Bangladesh', 'Sri Lanka', 'Nepal', 'China'
  ];
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_country IS NULL OR NOT (p_country = ANY(valid_countries)) THEN
    RAISE EXCEPTION 'COUNTRY_INVALID';
  END IF;

  UPDATE public.consultants
  SET country = p_country
  WHERE id = p_consultant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_consultant_passion(
  p_consultant_id  UUID,
  p_passion_area_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  UPDATE public.consultants
  SET passion_area_id = p_passion_area_id,
      passion_area    = (SELECT name FROM public.passion_areas WHERE id = p_passion_area_id)
  WHERE id = p_consultant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_consultant_utilization_target(
  p_consultant_id UUID,
  p_target        INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  UPDATE public.consultants
  SET utilization_target = p_target
  WHERE id = p_consultant_id;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'Permission denied%' THEN RAISE; END IF;
    RAISE EXCEPTION 'An error occurred processing your request.';
END;
$$;

-- Self-only: update the caller's own mentor (identity from JWT).
CREATE OR REPLACE FUNCTION public.update_own_mentor(
  p_mentor TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  IF (auth.jwt() ->> 'email') IS NULL OR (auth.jwt() ->> 'email') = '' THEN
    RAISE EXCEPTION 'MENTOR_NO_EMAIL';
  END IF;

  IF p_mentor IS NOT NULL AND p_mentor <> '__NULL__' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.consultants
      WHERE full_name = p_mentor AND offboarded_at IS NULL
    ) THEN
      RAISE EXCEPTION 'MENTOR_INVALID';
    END IF;
  END IF;

  UPDATE public.consultants SET
    mentor = CASE
      WHEN p_mentor = '__NULL__' THEN NULL
      WHEN p_mentor IS NOT NULL THEN p_mentor
      ELSE mentor
    END
  WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'MENTOR_NO_CONSULTANT';
  END IF;
  RETURN v_id;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('MENTOR_NO_EMAIL', 'MENTOR_NO_CONSULTANT', 'MENTOR_INVALID') THEN RAISE; END IF;
    RAISE EXCEPTION 'MENTOR_INTERNAL_ERROR';
END;
$$;

-- --- Consultant skills / cost rates -------------------------------
CREATE OR REPLACE FUNCTION public.upsert_consultant_skill(
  p_consultant_id UUID,
  p_skill_id      UUID,
  p_rating        INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  INSERT INTO public.consultant_skills (consultant_id, skill_id, rating)
  VALUES (p_consultant_id, p_skill_id, p_rating)
  ON CONFLICT (consultant_id, skill_id) DO UPDATE SET rating = p_rating;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_consultant_skill(
  p_consultant_id UUID,
  p_skill_id      UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  DELETE FROM public.consultant_skills
  WHERE consultant_id = p_consultant_id AND skill_id = p_skill_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_consultant_cost_rate(
  p_consultant_id  UUID,
  p_hourly_rate    NUMERIC(10,2),
  p_effective_date DATE,
  p_created_by     TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_pmo_admin() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin role required';
  END IF;

  INSERT INTO public.consultant_cost_rates (consultant_id, hourly_rate, effective_date, created_by, modified_by, modified_at)
  VALUES (
    p_consultant_id, p_hourly_rate, p_effective_date,
    COALESCE(p_created_by, auth.jwt() ->> 'email'),
    auth.jwt() ->> 'email', now()
  )
  ON CONFLICT (consultant_id, effective_date)
    DO UPDATE SET hourly_rate = EXCLUDED.hourly_rate,
                  created_by  = EXCLUDED.created_by,
                  created_at  = now(),
                  modified_by = auth.jwt() ->> 'email',
                  modified_at = now()
  RETURNING id INTO v_id;

  -- Keep denormalized consultants.hourly_cost_rate in sync with the most
  -- recent effective_date <= today.
  UPDATE public.consultants
  SET hourly_cost_rate = (
    SELECT hourly_rate
    FROM public.consultant_cost_rates
    WHERE consultant_id = p_consultant_id
      AND effective_date <= CURRENT_DATE
    ORDER BY effective_date DESC
    LIMIT 1
  )
  WHERE id = p_consultant_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_consultant_cost_rate(
  p_cost_rate_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_consultant_id UUID;
BEGIN
  IF NOT public.is_pmo_admin() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin role required';
  END IF;

  SELECT consultant_id INTO v_consultant_id
  FROM public.consultant_cost_rates
  WHERE id = p_cost_rate_id;

  IF v_consultant_id IS NULL THEN RETURN; END IF;

  DELETE FROM public.consultant_cost_rates WHERE id = p_cost_rate_id;

  UPDATE public.consultants
  SET hourly_cost_rate = (
    SELECT hourly_rate
    FROM public.consultant_cost_rates
    WHERE consultant_id = v_consultant_id
      AND effective_date <= CURRENT_DATE
    ORDER BY effective_date DESC
    LIMIT 1
  )
  WHERE id = v_consultant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cost_rate_at_date(
  p_consultant_id UUID,
  p_date          DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pmo_admin() AND NOT public.has_role('finance_viewer') THEN
    RAISE EXCEPTION 'Permission denied: insufficient role';
  END IF;

  RETURN (
    SELECT hourly_rate
    FROM public.consultant_cost_rates
    WHERE consultant_id = p_consultant_id
      AND effective_date <= p_date
    ORDER BY effective_date DESC
    LIMIT 1
  );
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'Permission denied%' THEN RAISE; END IF;
    RAISE EXCEPTION 'An error occurred processing your request.';
END;
$$;

-- --- Projects ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_project(
  p_client_name   TEXT,
  p_project_name  TEXT,
  p_project_type  TEXT DEFAULT 'billable',
  p_sow_number    TEXT DEFAULT NULL,
  p_sow_amount    NUMERIC DEFAULT NULL,
  p_planned_hours NUMERIC DEFAULT NULL,
  p_status        TEXT DEFAULT 'soft_unconfirmed',
  p_external_id   TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  INSERT INTO public.projects (
    client_name, project_name, project_type, sow_number,
    sow_amount, planned_hours, status, external_id
  )
  VALUES (
    p_client_name, p_project_name, p_project_type::public.project_type,
    p_sow_number, p_sow_amount, p_planned_hours,
    p_status::public.revenue_status, p_external_id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'Permission denied%' THEN RAISE; END IF;
    RAISE EXCEPTION 'An error occurred processing your request.';
END;
$$;

-- Slim post-v74 update_project signature. Every field is optional (NULL = no
-- change). TEXT-typed date params accept the sentinel '__NULL__' to explicitly
-- clear the column.
CREATE OR REPLACE FUNCTION public.update_project(
  p_id                   UUID,
  p_client_name          TEXT DEFAULT NULL,
  p_project_name         TEXT DEFAULT NULL,
  p_project_type         TEXT DEFAULT NULL,
  p_sow_number           TEXT DEFAULT NULL,
  p_sow_amount           NUMERIC DEFAULT NULL,
  p_planned_hours        NUMERIC DEFAULT NULL,
  p_status               TEXT DEFAULT NULL,
  p_external_id          TEXT DEFAULT NULL,
  p_done_at              TEXT DEFAULT NULL,
  p_notes                TEXT DEFAULT NULL,
  p_is_active            BOOLEAN DEFAULT NULL,
  p_archived_at          TEXT DEFAULT NULL,
  p_client_contact_email TEXT DEFAULT NULL,
  p_sla                  TEXT DEFAULT NULL,
  p_onsite_required      BOOLEAN DEFAULT NULL,
  p_special_skills       TEXT[] DEFAULT NULL,
  p_client_constraints   TEXT[] DEFAULT NULL,
  p_pm_email             TEXT DEFAULT NULL,
  p_po_required          BOOLEAN DEFAULT NULL,
  p_po_received          BOOLEAN DEFAULT NULL,
  p_kickoff_internal     TEXT DEFAULT NULL,
  p_kickoff_external     TEXT DEFAULT NULL,
  p_readout_meeting      TEXT DEFAULT NULL,
  p_box_folder_link      TEXT DEFAULT NULL,
  p_internal_slack_link  TEXT DEFAULT NULL,
  p_external_slack_link  TEXT DEFAULT NULL,
  p_practice_manager     TEXT DEFAULT NULL,
  p_project_manager      TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  IF p_practice_manager IS NOT NULL AND p_practice_manager <> '__NULL__' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.consultants
      WHERE full_name = p_practice_manager AND offboarded_at IS NULL
    ) THEN
      RAISE EXCEPTION 'PROJECT_INVALID_PM';
    END IF;
  END IF;

  IF p_project_manager IS NOT NULL AND p_project_manager <> '__NULL__' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.consultants
      WHERE full_name = p_project_manager AND offboarded_at IS NULL
    ) THEN
      RAISE EXCEPTION 'PROJECT_INVALID_PROJECT_MANAGER';
    END IF;
  END IF;

  UPDATE public.projects SET
    client_name          = COALESCE(p_client_name, client_name),
    project_name         = COALESCE(p_project_name, project_name),
    project_type         = COALESCE(p_project_type::public.project_type, project_type),
    sow_number           = COALESCE(p_sow_number, sow_number),
    sow_amount           = COALESCE(p_sow_amount, sow_amount),
    planned_hours        = COALESCE(p_planned_hours, planned_hours),
    status               = COALESCE(p_status::public.revenue_status, status),
    external_id          = COALESCE(p_external_id, external_id),
    done_at              = CASE WHEN p_done_at      = '__NULL__' THEN NULL WHEN p_done_at      IS NOT NULL THEN p_done_at::DATE      ELSE done_at      END,
    notes                = COALESCE(p_notes, notes),
    is_active            = COALESCE(p_is_active, is_active),
    archived_at          = CASE WHEN p_archived_at  = '__NULL__' THEN NULL WHEN p_archived_at  IS NOT NULL THEN p_archived_at::DATE  ELSE archived_at  END,
    client_contact_email = COALESCE(p_client_contact_email, client_contact_email),
    sla                  = COALESCE(p_sla, sla),
    onsite_required      = COALESCE(p_onsite_required, onsite_required),
    special_skills       = COALESCE(p_special_skills, special_skills),
    client_constraints   = COALESCE(p_client_constraints, client_constraints),
    pm_email             = COALESCE(p_pm_email, pm_email),
    po_required          = COALESCE(p_po_required, po_required),
    po_received          = COALESCE(p_po_received, po_received),
    kickoff_internal     = CASE WHEN p_kickoff_internal = '__NULL__' THEN NULL WHEN p_kickoff_internal IS NOT NULL THEN p_kickoff_internal::DATE ELSE kickoff_internal END,
    kickoff_external     = CASE WHEN p_kickoff_external = '__NULL__' THEN NULL WHEN p_kickoff_external IS NOT NULL THEN p_kickoff_external::DATE ELSE kickoff_external END,
    readout_meeting      = CASE WHEN p_readout_meeting  = '__NULL__' THEN NULL WHEN p_readout_meeting  IS NOT NULL THEN p_readout_meeting::DATE  ELSE readout_meeting  END,
    box_folder_link      = COALESCE(p_box_folder_link, box_folder_link),
    internal_slack_link  = COALESCE(p_internal_slack_link, internal_slack_link),
    external_slack_link  = COALESCE(p_external_slack_link, external_slack_link),
    practice_manager = CASE WHEN p_practice_manager = '__NULL__' THEN NULL WHEN p_practice_manager IS NOT NULL THEN p_practice_manager ELSE practice_manager END,
    project_manager  = CASE WHEN p_project_manager  = '__NULL__' THEN NULL WHEN p_project_manager  IS NOT NULL THEN p_project_manager  ELSE project_manager  END
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_project(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  DELETE FROM public.projects WHERE id = p_id;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'Permission denied%' THEN RAISE; END IF;
    RAISE EXCEPTION 'An error occurred processing your request.';
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_projects()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_count INTEGER;
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  UPDATE public.projects
  SET is_active = false,
      archived_at = now()
  WHERE status = 'done'
    AND done_at IS NOT NULL
    AND done_at < now() - INTERVAL '90 days'
    AND is_active = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- --- Project comments --------------------------------------------
CREATE OR REPLACE FUNCTION public.create_project_comment(
  p_project_id   UUID,
  p_content      TEXT,
  p_author_email TEXT DEFAULT NULL,
  p_author_name  TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id          UUID;
  v_caller_email TEXT;
  v_caller_name  TEXT;
BEGIN
  v_caller_email := auth.jwt() ->> 'email';

  SELECT full_name INTO v_caller_name
  FROM public.user_roles
  WHERE email = v_caller_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permission denied: user not in user_roles';
  END IF;

  INSERT INTO public.project_comments (project_id, author_email, author_name, content)
  VALUES (p_project_id, v_caller_email, COALESCE(v_caller_name, v_caller_email), p_content)
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'Permission denied%' THEN RAISE; END IF;
    RAISE EXCEPTION 'An error occurred processing your request.';
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_project_comment(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pmo_admin() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin role required';
  END IF;

  DELETE FROM public.project_comments WHERE id = p_id;
END;
$$;

-- --- Skills / passion areas / holidays ----------------------------
CREATE OR REPLACE FUNCTION public.add_skill(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  INSERT INTO public.skills (name)
  VALUES (p_name)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_passion_area(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_pmo_or_leadership() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin or leadership role required';
  END IF;

  INSERT INTO public.passion_areas (name)
  VALUES (p_name)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_holiday(
  p_country   TEXT,
  p_name      TEXT,
  p_date      DATE,
  p_recurring BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_pmo_admin() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin role required';
  END IF;

  INSERT INTO public.holidays (country, name, date, recurring)
  VALUES (p_country, p_name, p_date, p_recurring)
  ON CONFLICT (country, date) DO UPDATE SET name = EXCLUDED.name, recurring = EXCLUDED.recurring
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_holiday(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pmo_admin() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin role required';
  END IF;

  DELETE FROM public.holidays WHERE id = p_id;
END;
$$;

-- --- User roles ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_user_role(
  p_email     TEXT,
  p_full_name TEXT,
  p_role      TEXT DEFAULT 'consultant_readonly'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_pmo_admin() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin role required';
  END IF;

  INSERT INTO public.user_roles (email, full_name, role)
  VALUES (p_email, p_full_name, p_role::public.user_role)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_role(
  p_user_id UUID,
  p_role    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pmo_admin() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin role required';
  END IF;

  UPDATE public.user_roles
  SET role = p_role::public.user_role
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_user_role(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pmo_admin() THEN
    RAISE EXCEPTION 'Permission denied: pmo_admin role required';
  END IF;

  DELETE FROM public.user_roles WHERE id = p_user_id;
END;
$$;

-- ------------------------------------------------------------------
-- 9. ROW-LEVEL SECURITY
-- ------------------------------------------------------------------
ALTER TABLE public.user_roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_snapshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultant_skills      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultant_cost_rates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passion_areas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_views            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_revenue     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles_audit_log   ENABLE ROW LEVEL SECURITY;

-- --- user_roles: readable by pmo_admin+leadership; writable by pmo_admin.
CREATE POLICY role_based_read_user_roles  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_pmo_or_leadership());
CREATE POLICY pmo_admin_insert_user_roles ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_pmo_admin());
CREATE POLICY pmo_admin_update_user_roles ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_pmo_admin());
CREATE POLICY pmo_admin_delete_user_roles ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_pmo_admin());

-- --- consultants: all authed read; pmo_admin writes.
CREATE POLICY "Authenticated users can read consultants" ON public.consultants FOR SELECT TO authenticated USING (true);
CREATE POLICY "PMO admins can insert consultants" ON public.consultants FOR INSERT TO authenticated WITH CHECK (public.is_pmo_admin());
CREATE POLICY "PMO admins can update consultants" ON public.consultants FOR UPDATE TO authenticated USING (public.is_pmo_admin());
CREATE POLICY "PMO admins can delete consultants" ON public.consultants FOR DELETE TO authenticated USING (public.is_pmo_admin());

-- --- projects: all authed read; pmo_admin+leadership writes.
CREATE POLICY "Authenticated users can read projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY pmo_or_leadership_insert_projects ON public.projects FOR INSERT TO authenticated WITH CHECK (public.is_pmo_or_leadership());
CREATE POLICY pmo_or_leadership_update_projects ON public.projects FOR UPDATE TO authenticated USING (public.is_pmo_or_leadership());
CREATE POLICY pmo_or_leadership_delete_projects ON public.projects FOR DELETE TO authenticated USING (public.is_pmo_or_leadership());

-- --- assignments: all authed read; pmo_admin+leadership writes.
CREATE POLICY "Authenticated users can read assignments" ON public.assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY pmo_or_leadership_insert_assignments ON public.assignments FOR INSERT TO authenticated WITH CHECK (public.is_pmo_or_leadership());
CREATE POLICY pmo_or_leadership_update_assignments ON public.assignments FOR UPDATE TO authenticated USING (public.is_pmo_or_leadership());
CREATE POLICY pmo_or_leadership_delete_assignments ON public.assignments FOR DELETE TO authenticated USING (public.is_pmo_or_leadership());

-- --- monthly_snapshots: pmo_admin+finance_viewer+leadership read; pmo_admin writes.
CREATE POLICY role_based_read_snapshots ON public.monthly_snapshots FOR SELECT TO authenticated
  USING (public.is_pmo_admin() OR public.has_role('finance_viewer') OR public.has_role('leadership'));
CREATE POLICY "PMO admins can insert monthly_snapshots" ON public.monthly_snapshots FOR INSERT TO authenticated WITH CHECK (public.is_pmo_admin());
CREATE POLICY "PMO admins can update monthly_snapshots" ON public.monthly_snapshots FOR UPDATE TO authenticated USING (public.is_pmo_admin());
CREATE POLICY "PMO admins can delete monthly_snapshots" ON public.monthly_snapshots FOR DELETE TO authenticated USING (public.is_pmo_admin());

-- --- skills / passion_areas / holidays: all authed read; pmo_admin writes.
CREATE POLICY "Authenticated users can read skills" ON public.skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "PMO admins can insert skills" ON public.skills FOR INSERT TO authenticated WITH CHECK (public.is_pmo_admin());
CREATE POLICY "PMO admins can update skills" ON public.skills FOR UPDATE TO authenticated USING (public.is_pmo_admin());
CREATE POLICY "PMO admins can delete skills" ON public.skills FOR DELETE TO authenticated USING (public.is_pmo_admin());

CREATE POLICY "Authenticated users can read passion_areas" ON public.passion_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "PMO admins can insert passion_areas" ON public.passion_areas FOR INSERT TO authenticated WITH CHECK (public.is_pmo_admin());
CREATE POLICY "PMO admins can update passion_areas" ON public.passion_areas FOR UPDATE TO authenticated USING (public.is_pmo_admin());
CREATE POLICY "PMO admins can delete passion_areas" ON public.passion_areas FOR DELETE TO authenticated USING (public.is_pmo_admin());

CREATE POLICY "Authenticated users can read holidays" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "PMO admins can insert holidays" ON public.holidays FOR INSERT TO authenticated WITH CHECK (public.is_pmo_admin());
CREATE POLICY "PMO admins can update holidays" ON public.holidays FOR UPDATE TO authenticated USING (public.is_pmo_admin());
CREATE POLICY "PMO admins can delete holidays" ON public.holidays FOR DELETE TO authenticated USING (public.is_pmo_admin());

-- --- consultant_skills: all authed read; pmo_admin writes.
CREATE POLICY "Authenticated users can read consultant_skills" ON public.consultant_skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "PMO admins can insert consultant_skills" ON public.consultant_skills FOR INSERT TO authenticated WITH CHECK (public.is_pmo_admin());
CREATE POLICY "PMO admins can update consultant_skills" ON public.consultant_skills FOR UPDATE TO authenticated USING (public.is_pmo_admin());
CREATE POLICY "PMO admins can delete consultant_skills" ON public.consultant_skills FOR DELETE TO authenticated USING (public.is_pmo_admin());

-- --- consultant_cost_rates: pmo_admin+finance_viewer read; plus pmo_admin writes.
CREATE POLICY role_based_read_cost_rates ON public.consultant_cost_rates FOR SELECT TO authenticated
  USING (public.is_pmo_admin() OR public.has_role('finance_viewer'));

-- --- historical_revenue: pmo_admin+finance_viewer+leadership read; pmo_admin writes.
CREATE POLICY role_based_read_historical_revenue ON public.historical_revenue FOR SELECT TO authenticated
  USING (public.is_pmo_admin() OR public.has_role('finance_viewer') OR public.has_role('leadership'));
CREATE POLICY "PMO admins can insert historical_revenue" ON public.historical_revenue FOR INSERT TO authenticated WITH CHECK (public.is_pmo_admin());
CREATE POLICY "PMO admins can update historical_revenue" ON public.historical_revenue FOR UPDATE TO authenticated USING (public.is_pmo_admin());
CREATE POLICY "PMO admins can delete historical_revenue" ON public.historical_revenue FOR DELETE TO authenticated USING (public.is_pmo_admin());

-- --- sync_log: all authed read; pmo_admin writes.
CREATE POLICY "Authenticated users can read sync_log" ON public.sync_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "PMO admins can insert sync_log" ON public.sync_log FOR INSERT TO authenticated WITH CHECK (public.is_pmo_admin());
CREATE POLICY "PMO admins can update sync_log" ON public.sync_log FOR UPDATE TO authenticated USING (public.is_pmo_admin());
CREATE POLICY "PMO admins can delete sync_log" ON public.sync_log FOR DELETE TO authenticated USING (public.is_pmo_admin());

-- --- saved_views: each user reads/writes only their own rows.
CREATE POLICY saved_views_select ON public.saved_views FOR SELECT TO authenticated
  USING (user_email = (auth.jwt() ->> 'email'));
CREATE POLICY saved_views_insert ON public.saved_views FOR INSERT TO authenticated
  WITH CHECK (user_email = (auth.jwt() ->> 'email'));
CREATE POLICY saved_views_update ON public.saved_views FOR UPDATE TO authenticated
  USING (user_email = (auth.jwt() ->> 'email'));
CREATE POLICY saved_views_delete ON public.saved_views FOR DELETE TO authenticated
  USING (user_email = (auth.jwt() ->> 'email'));

-- --- project_comments: any authed-in-user_roles can read/insert; pmo_admin deletes.
CREATE POLICY "Authenticated users can read project_comments" ON public.project_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users in user_roles can insert project_comments"
  ON public.project_comments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE email = auth.jwt() ->> 'email'));
CREATE POLICY "PMO admins can delete project_comments" ON public.project_comments FOR DELETE TO authenticated USING (public.is_pmo_admin());

-- --- tasks: all authed read; pmo_admin writes.
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_pmo_admin());
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated USING (public.is_pmo_admin()) WITH CHECK (public.is_pmo_admin());
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated USING (public.is_pmo_admin());

-- --- audit_log / user_roles_audit_log: pmo_admin read-only.
CREATE POLICY "Only pmo_admin can read audit_log" ON public.audit_log FOR SELECT TO authenticated USING (public.is_pmo_admin());
CREATE POLICY "Only pmo_admin can read user_roles_audit_log" ON public.user_roles_audit_log FOR SELECT TO authenticated USING (public.is_pmo_admin());

-- ------------------------------------------------------------------
-- 10. COLUMN-LEVEL GRANTS
--
-- The API layer uses the service_role key and bypasses these grants. The
-- grants below protect against browser-side authenticated clients trying
-- to SELECT sensitive financial columns (hourly_cost_rate, sow_amount).
-- ------------------------------------------------------------------

-- consultants: authenticated can SELECT everything except hourly_cost_rate.
REVOKE SELECT ON public.consultants FROM authenticated;
GRANT SELECT (
  id, full_name, email, title, manager, mentor,
  skills, passion_area, passion_area_id, country,
  is_active, is_mentor, department, utilization_target,
  hire_date, offboarded_at, created_at, updated_at
) ON public.consultants TO authenticated;

-- projects: authenticated can SELECT everything except sow_amount.
REVOKE SELECT ON public.projects FROM authenticated;
GRANT SELECT (
  id, external_id, altair_uid, client_name, project_name, project_type,
  sow_number, planned_hours, status,
  engagement_start, engagement_end, done_at, archived_at,
  notes, is_active, midway_notification_sent,
  manager_id, program_manager_id, managing_director_id,
  practice_manager, project_manager,
  client_contact_email, sla, onsite_required, special_skills, client_constraints,
  pm_email, po_required, po_received,
  kickoff_internal, kickoff_external, readout_meeting,
  box_folder_link, internal_slack_link, external_slack_link,
  upstream_synced_at, upstream_writeback_at, created_at, updated_at
) ON public.projects TO authenticated;

-- consultant_cost_rates / user_roles: revoke table-level SELECT so proxy
-- PostgREST queries by authenticated users are blocked. The API layer uses
-- the service role (which bypasses grants) to serve filtered data.
REVOKE SELECT ON public.consultant_cost_rates FROM authenticated;
REVOKE SELECT ON public.user_roles            FROM authenticated;

-- saved_views + project_comments: authenticated manages their own rows via
-- RLS — grant table-level privileges so the RLS layer evaluates.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_views       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_comments  TO authenticated;
GRANT SELECT                         ON public.project_comments  TO anon;

-- service_role bypasses RLS but still needs table grants (Supabase's default
-- grants for service_role don't cover freshly-created tables). The API layer
-- uses service_role + JWT-derived Casbin checks to gate access.
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- authenticated needs INSERT/UPDATE/DELETE at the table level so RLS policies
-- can evaluate (table privileges are checked BEFORE RLS). SELECT is granted
-- column-wise above for consultants/projects and table-wise for others.
GRANT INSERT, UPDATE, DELETE ON public.consultants           TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.projects              TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.assignments           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passion_areas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultant_skills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_log      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks         TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_roles            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historical_revenue TO authenticated;
GRANT SELECT                                ON public.audit_log              TO authenticated;
GRANT SELECT                                ON public.user_roles_audit_log   TO authenticated;

-- ------------------------------------------------------------------
-- 11. REALTIME PUBLICATION
--
-- Supabase auto-creates `supabase_realtime`. Column lists exclude the
-- sensitive columns that are also revoked above so they never ship over
-- the Realtime WebSocket.
-- ------------------------------------------------------------------
DO $$
BEGIN
  -- consultants: publish everything except hourly_cost_rate.
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='consultants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.consultants (
      id, full_name, email, title, manager, mentor,
      skills, passion_area, passion_area_id, country,
      is_active, is_mentor, department, utilization_target,
      hire_date, offboarded_at, created_at, updated_at
    );
  END IF;

  -- projects: publish everything except sow_amount.
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='projects') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects (
      id, external_id, altair_uid, client_name, project_name, project_type,
      sow_number, planned_hours, status,
      engagement_start, engagement_end, done_at, archived_at,
      notes, is_active, midway_notification_sent,
      manager_id, program_manager_id, managing_director_id,
      practice_manager, project_manager,
      client_contact_email, sla, onsite_required, special_skills, client_constraints,
      pm_email, po_required, po_received,
      kickoff_internal, kickoff_external, readout_meeting,
      box_folder_link, internal_slack_link, external_slack_link,
      upstream_synced_at, upstream_writeback_at, created_at, updated_at
    );
  END IF;

  -- assignments: publish all columns (no sensitive data).
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='assignments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
  END IF;

  -- monthly_snapshots: publish all columns (financial, but RLS-gated).
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='monthly_snapshots') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_snapshots;
  END IF;

  -- sync_log: publish all columns (UI renders a live sync dashboard).
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='sync_log') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_log;
  END IF;
END;
$$;

-- Reload PostgREST schema cache so new function signatures are picked up.
NOTIFY pgrst, 'reload schema';
