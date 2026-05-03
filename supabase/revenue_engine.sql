-- Altair Revenue Engine
-- Postgres functions for bill rate calculation, monthly snapshots, and month-end locking
-- Run this in Supabase SQL Editor after schema.sql and seed.sql

-- ============================================================
-- HELPER: Distribute assignment hours across months
-- Given an assignment's date range and total hours, returns
-- the proportional hours per month based on working days.
-- ============================================================
CREATE OR REPLACE FUNCTION distribute_hours_by_month(
  p_start_date DATE,
  p_end_date DATE,
  p_total_hours NUMERIC
)
RETURNS TABLE(month DATE, hours NUMERIC) AS $$
DECLARE
  total_days INTEGER;
  cur_month DATE;
  month_start DATE;
  month_end DATE;
  days_in_range INTEGER;
BEGIN
  -- Total calendar days in the assignment
  total_days := (p_end_date - p_start_date) + 1;

  IF total_days <= 0 THEN
    RETURN;
  END IF;

  -- Walk through each month that overlaps the assignment
  cur_month := date_trunc('month', p_start_date)::DATE;

  WHILE cur_month <= date_trunc('month', p_end_date)::DATE LOOP
    -- Clamp to assignment boundaries
    month_start := GREATEST(p_start_date, cur_month);
    month_end := LEAST(p_end_date, (cur_month + INTERVAL '1 month - 1 day')::DATE);

    days_in_range := (month_end - month_start) + 1;

    month := cur_month;
    hours := ROUND((p_total_hours * days_in_range::NUMERIC / total_days), 2);

    RETURN NEXT;

    cur_month := (cur_month + INTERVAL '1 month')::DATE;
  END LOOP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- CORE: Generate/refresh monthly snapshots for a project
-- Calculates bill rates respecting the locked-month rule:
--   1. Sum hours from all assignments, distributed by month
--   2. Locked months keep their frozen revenue
--   3. Remaining SOW budget spreads across open months
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_project_snapshots(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
  v_sow_amount NUMERIC;
  v_locked_revenue NUMERIC := 0;
  v_open_hours NUMERIC := 0;
  v_remaining_budget NUMERIC;
  v_bill_rate NUMERIC;
  rec RECORD;
BEGIN
  -- Get SOW amount
  SELECT sow_amount INTO v_sow_amount
  FROM projects WHERE id = p_project_id;

  IF v_sow_amount IS NULL THEN
    RETURN;
  END IF;

  -- Build monthly hours from all assignments on this project
  CREATE TEMP TABLE IF NOT EXISTS _monthly_hours (
    month DATE,
    total_hours NUMERIC
  ) ON COMMIT DROP;

  DELETE FROM _monthly_hours;

  INSERT INTO _monthly_hours (month, total_hours)
  SELECT dh.month, SUM(dh.hours)
  FROM assignments a
  CROSS JOIN LATERAL distribute_hours_by_month(a.start_date, a.end_date, a.total_hours) dh
  WHERE a.project_id = p_project_id
  GROUP BY dh.month
  ORDER BY dh.month;

  -- Calculate locked revenue (from already-locked snapshots)
  SELECT COALESCE(SUM(ms.revenue), 0) INTO v_locked_revenue
  FROM monthly_snapshots ms
  WHERE ms.project_id = p_project_id AND ms.is_locked = true;

  -- Calculate total open hours (months that are NOT locked)
  SELECT COALESCE(SUM(mh.total_hours), 0) INTO v_open_hours
  FROM _monthly_hours mh
  LEFT JOIN monthly_snapshots ms ON ms.project_id = p_project_id AND ms.month = mh.month AND ms.is_locked = true
  WHERE ms.id IS NULL;  -- Not locked

  -- Remaining budget for open months
  v_remaining_budget := v_sow_amount - v_locked_revenue;

  -- Bill rate for open months
  IF v_open_hours > 0 THEN
    v_bill_rate := ROUND(v_remaining_budget / v_open_hours, 2);
  ELSE
    v_bill_rate := 0;
  END IF;

  -- Upsert snapshots for each month
  FOR rec IN SELECT * FROM _monthly_hours LOOP
    INSERT INTO monthly_snapshots (project_id, month, total_hours, bill_rate, revenue, is_locked)
    VALUES (
      p_project_id,
      rec.month,
      rec.total_hours,
      -- If locked, keep existing rate; otherwise use new calculated rate
      COALESCE(
        (SELECT ms.bill_rate FROM monthly_snapshots ms WHERE ms.project_id = p_project_id AND ms.month = rec.month AND ms.is_locked = true),
        v_bill_rate
      ),
      -- If locked, keep existing revenue; otherwise calculate
      COALESCE(
        (SELECT ms.revenue FROM monthly_snapshots ms WHERE ms.project_id = p_project_id AND ms.month = rec.month AND ms.is_locked = true),
        ROUND(rec.total_hours * v_bill_rate, 2)
      ),
      -- Preserve lock status
      COALESCE(
        (SELECT ms.is_locked FROM monthly_snapshots ms WHERE ms.project_id = p_project_id AND ms.month = rec.month),
        false
      )
    )
    ON CONFLICT (project_id, month) DO UPDATE SET
      total_hours = CASE WHEN monthly_snapshots.is_locked THEN monthly_snapshots.total_hours ELSE EXCLUDED.total_hours END,
      bill_rate = CASE WHEN monthly_snapshots.is_locked THEN monthly_snapshots.bill_rate ELSE EXCLUDED.bill_rate END,
      revenue = CASE WHEN monthly_snapshots.is_locked THEN monthly_snapshots.revenue ELSE EXCLUDED.revenue END;
  END LOOP;

  -- Remove snapshots for months that no longer have assignments (unless locked)
  DELETE FROM monthly_snapshots
  WHERE project_id = p_project_id
    AND is_locked = false
    AND month NOT IN (SELECT month FROM _monthly_hours);

  DROP TABLE IF EXISTS _monthly_hours;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER: Auto-refresh snapshots when assignments change
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_refresh_snapshots()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh for the affected project
  PERFORM refresh_project_snapshots(COALESCE(NEW.project_id, OLD.project_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_refresh_snapshots ON assignments;
CREATE TRIGGER auto_refresh_snapshots
  AFTER INSERT OR UPDATE OR DELETE ON assignments
  FOR EACH ROW EXECUTE FUNCTION trigger_refresh_snapshots();

-- ============================================================
-- MONTH-END LOCK: Lock all snapshots for a given month
-- Call via GitHub Actions cron at 11:59 PM EST on last day of month
-- ============================================================
CREATE OR REPLACE FUNCTION lock_month(p_month DATE)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Normalize to first of month
  p_month := date_trunc('month', p_month)::DATE;

  UPDATE monthly_snapshots
  SET is_locked = true, locked_at = now()
  WHERE month = p_month AND is_locked = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- REFRESH ALL: Recalculate snapshots for all active projects
-- Useful after initial seed or bulk data changes
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_all_snapshots()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM projects WHERE is_active = true LOOP
    PERFORM refresh_project_snapshots(rec.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
