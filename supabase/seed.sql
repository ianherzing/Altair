-- ============================================================================
-- Altair Demo Seed — rich synthetic dataset for local evaluation
--
-- Idempotent: uses ON CONFLICT to skip existing rows. Safe to re-run.
-- All names, emails, clients, and SOW numbers are fictional. No real PII.
--
-- Data shape:
--   12 consultants (3 managers, 1 offboarded, 1 mentor-only)
--   15 skills + 6 passion areas + 20 US holidays
--   8 clients, 20 projects spanning all revenue_status values
--   ~70 assignments distributed across Jan–Oct 2026
--   Locked monthly_snapshots for Jan–Mar 2026
--   consultant_cost_rates: one rate per consultant
--
-- Designed so every dashboard (Resourcing / Capacity / Utilization /
-- Revenue / Margin / Projects / SkillsMatrix) renders with real-looking
-- numbers. Assumes "today" is around 2026-04-23.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PASSION AREAS
-- ---------------------------------------------------------------------------
INSERT INTO passion_areas (name, is_active) VALUES
  ('Cloud Platform',     true),
  ('Data Engineering',   true),
  ('Frontend',           true),
  ('Backend',            true),
  ('DevOps & Platform',  true),
  ('Strategy & Advisory', true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- SKILLS
-- ---------------------------------------------------------------------------
INSERT INTO skills (name, is_active) VALUES
  ('Cloud Architecture', true),
  ('Data Engineering',   true),
  ('Change Management',  true),
  ('Technical Advisory', true),
  ('Implementation',     true),
  ('Analytics',          true),
  ('API Design',         true),
  ('DevOps',             true),
  ('Frontend',           true),
  ('Backend',            true),
  ('Mobile',             true),
  ('Project Management', true),
  ('Product Strategy',   true),
  ('Migration',          true),
  ('Integration',        true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- HOLIDAYS (US, 2026)
-- ---------------------------------------------------------------------------
INSERT INTO holidays (country, name, date, recurring) VALUES
  ('US', 'New Year''s Day',              '2026-01-01', true),
  ('US', 'Martin Luther King Jr. Day',   '2026-01-19', true),
  ('US', 'Presidents'' Day',             '2026-02-16', true),
  ('US', 'Memorial Day',                 '2026-05-25', true),
  ('US', 'Juneteenth',                   '2026-06-19', true),
  ('US', 'Independence Day (observed)',  '2026-07-03', true),
  ('US', 'Labor Day',                    '2026-09-07', true),
  ('US', 'Thanksgiving',                 '2026-11-26', true),
  ('US', 'Day After Thanksgiving',       '2026-11-27', true),
  ('US', 'Christmas Day',                '2026-12-25', true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- CONSULTANTS
--
-- 3 managers: Sarah Miller, David Kim, Priya Shah
-- 1 practice manager at top: Blair Cortez (no manager)
-- 1 offboarded: Sydney Fleming
-- 1 mentor-only: Reggie Walsh (inactive but still appears in mentor picker)
-- ---------------------------------------------------------------------------
INSERT INTO consultants
  (full_name,       email,                        title,                manager,        country, skills,                                                        passion_area,         is_active, is_mentor, utilization_target, hire_date,      hourly_cost_rate, department)
VALUES
  ('Blair Cortez',   'blair.cortez@example.com',   'Practice Manager',   NULL,           'US', ARRAY['Strategy','Project Management','Change Management'],      'Strategy & Advisory', true,  true,  60, '2022-03-01', 200.00, 'Professional Services'),
  ('Sarah Miller',   'sarah.miller@example.com',   'Practice Manager',   'Blair Cortez', 'US', ARRAY['Cloud Architecture','Strategy','Technical Advisory'],     'Cloud Platform',      true,  true,  70, '2022-06-15', 180.00, 'Professional Services'),
  ('David Kim',      'david.kim@example.com',      'Practice Manager',   'Blair Cortez', 'US', ARRAY['Data Engineering','Analytics','Strategy'],                'Data Engineering',    true,  true,  70, '2022-09-01', 180.00, 'Professional Services'),
  ('Priya Shah',     'priya.shah@example.com',     'Practice Manager',   'Blair Cortez', 'US', ARRAY['DevOps','Backend','Technical Advisory'],                  'DevOps & Platform',   true,  true,  70, '2023-01-10', 175.00, 'Professional Services'),
  ('Alex Chen',      'alex.chen@example.com',      'Senior Consultant',  'Sarah Miller', 'US', ARRAY['Cloud Architecture','Migration','Integration'],           'Cloud Platform',      true,  false, 85, '2023-02-20', 140.00, 'Professional Services'),
  ('Jordan Rivera',  'jordan.rivera@example.com',  'Consultant',         'Sarah Miller', 'US', ARRAY['Data Engineering','Analytics','Integration'],             'Data Engineering',    true,  false, 90, '2024-05-12', 110.00, 'Professional Services'),
  ('Sam Patel',      'sam.patel@example.com',      'Principal Consultant','David Kim',   'US', ARRAY['Data Engineering','Analytics','Technical Advisory'],      'Data Engineering',    true,  true,  80, '2022-11-01', 160.00, 'Professional Services'),
  ('Taylor Nguyen',  'taylor.nguyen@example.com',  'Consultant',         'David Kim',    'US', ARRAY['Frontend','Implementation','Mobile'],                     'Frontend',            true,  false, 90, '2024-08-05', 105.00, 'Professional Services'),
  ('Morgan Brooks',  'morgan.brooks@example.com',  'Senior Consultant',  'Priya Shah',   'US', ARRAY['DevOps','Cloud Architecture','Backend'],                  'DevOps & Platform',   true,  true,  85, '2023-04-17', 135.00, 'Professional Services'),
  ('Casey Williams', 'casey.williams@example.com', 'Consultant',         'Priya Shah',   'US', ARRAY['Backend','API Design','Integration'],                     'Backend',             true,  false, 90, '2024-02-26', 110.00, 'Professional Services'),
  ('Riley Park',     'riley.park@example.com',     'Project Manager',    'Sarah Miller', 'US', ARRAY['Project Management','Change Management'],                 'Strategy & Advisory', true,  false, 75, '2023-07-10', 125.00, 'Professional Services'),
  ('Avery Diaz',     'avery.diaz@example.com',     'Project Manager',    'David Kim',    'CA', ARRAY['Project Management','Change Management','Product Strategy'], 'Strategy & Advisory', true,  false, 75, '2023-10-02', 120.00, 'Professional Services'),
  ('Quinn O''Brien', 'quinn.obrien@example.com',   'Principal Consultant','Priya Shah',  'US', ARRAY['DevOps','Cloud Architecture','Technical Advisory'],       'DevOps & Platform',   true,  true,  80, '2022-12-15', 165.00, 'Professional Services'),
  ('Drew Nakamura',  'drew.nakamura@example.com',  'Senior Consultant',  'Sarah Miller', 'US', ARRAY['Backend','API Design','Cloud Architecture'],              'Backend',             true,  false, 85, '2023-08-01', 140.00, 'Professional Services'),
  ('Sydney Fleming', 'sydney.fleming@example.com', 'Consultant',         'David Kim',    'US', ARRAY['Frontend','Mobile'],                                      'Frontend',            false, false, 00, '2023-05-05', 100.00, 'Professional Services'),
  ('Reggie Walsh',   'reggie.walsh@example.com',   'Staff Consultant',   NULL,           'US', ARRAY['Technical Advisory','Product Strategy'],                  'Strategy & Advisory', false, true,  00, '2021-01-15', 190.00, 'Professional Services')
ON CONFLICT (email) DO NOTHING;

-- Mark Sydney as offboarded
UPDATE consultants SET offboarded_at = '2024-11-30' WHERE email = 'sydney.fleming@example.com';
UPDATE consultants SET offboarded_at = '2024-06-30' WHERE email = 'reggie.walsh@example.com';

-- ---------------------------------------------------------------------------
-- CONSULTANT COST RATES (current effective rate per consultant)
-- ---------------------------------------------------------------------------
INSERT INTO consultant_cost_rates (consultant_id, hourly_rate, effective_date)
SELECT id, hourly_cost_rate, COALESCE(hire_date, '2024-01-01')
FROM consultants
WHERE hourly_cost_rate IS NOT NULL
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- PROJECTS (20 across 8 clients, mix of statuses)
--
-- Status distribution (matches revenue_status + app-side extensions):
--   4 done       (wrapped in Jan–Mar 2026)
--   6 active     (currently running, spanning today)
--   4 hard_scheduled (signed, starts May–Jul 2026)
--   3 soft_at_risk  (verbal commit, no signed SOW, mid-year)
--   3 soft_unconfirmed (sales pipeline, H2 2026)
-- ---------------------------------------------------------------------------
INSERT INTO projects
  (external_id,  client_name,            project_name,                            project_type, sow_number,      sow_amount, planned_hours, status,             practice_manager, project_manager, pm_email,                      client_contact_email,           notes)
VALUES
  -- DONE (wrapped)
  ('ENG-1001',   'GlobalBank Corp',      'Mobile Banking App Modernization',      'billable',   'SOW-2025-0389',  95000,   380,  'done',              'Priya Shah',     'Riley Park',     'riley.park@example.com',     'pm@globalbank.example.com',    'Completed on schedule; final readout Mar 13.'),
  ('ENG-1002',   'Crestwood Retail',     'E-commerce Platform Audit',             'billable',   'SOW-2025-0402',  60000,   240,  'done',              'Sarah Miller',   'Avery Diaz',     'avery.diaz@example.com',     'ops@crestwood.example.com',    'Delivered final deck; customer signed off.'),
  ('ENG-1003',   'Meridian Labs',        'Data Pipeline Migration — Phase 1',     'billable',   'SOW-2025-0415',  75000,   300,  'done',              'David Kim',      'Riley Park',     'riley.park@example.com',     'data@meridianlabs.example.com','Phase 1 complete; Phase 2 booked.'),
  ('ENG-1004',   'Nexus Media',          'Analytics Dashboard Rebuild',           'billable',   'SOW-2026-0012',  48000,   200,  'done',              'David Kim',      'Avery Diaz',     'avery.diaz@example.com',     'pm@nexusmedia.example.com',    NULL),

  -- ACTIVE (running now, span Jan/Feb through May)
  ('ENG-1005',   'Acme Financial',       'Cloud Migration Strategy',              'billable',   'SOW-2026-0142', 180000,   720,  'active',            'Sarah Miller',   'Riley Park',     'riley.park@example.com',     'pm@acmefinancial.example.com', 'Large multi-stream engagement.'),
  ('ENG-1006',   'TechCorp Industries',  'Platform Modernization',                'billable',   'SOW-2026-0158',  75000,   300,  'active',            'Priya Shah',     'Avery Diaz',     'avery.diaz@example.com',     'ops@techcorp.example.com',     NULL),
  ('ENG-1007',   'Orion Logistics',      'Data Warehouse Redesign',               'billable',   'SOW-2026-0171', 130000,   520,  'active',            'David Kim',      'Riley Park',     'riley.park@example.com',     'data@orion.example.com',       'Data modeling + backfill work streams.'),
  ('ENG-1008',   'Meridian Labs',        'Data Pipeline Migration — Phase 2',     'billable',   'SOW-2026-0175',  85000,   340,  'active',            'David Kim',      'Riley Park',     'riley.park@example.com',     'data@meridianlabs.example.com','Follow-on from ENG-1003.'),
  ('ENG-1009',   'HealthFirst Medical',  'Patient Portal UX Refresh',             'billable',   'SOW-2026-0180',  55000,   220,  'active',            'Sarah Miller',   'Avery Diaz',     'avery.diaz@example.com',     'product@healthfirst.example.com', NULL),
  ('ENG-1010',   'Crestwood Retail',     'Order Management Integration',          'billable',   'SOW-2026-0186',  42000,   170,  'active',            'Priya Shah',     'Avery Diaz',     'avery.diaz@example.com',     'ops@crestwood.example.com',    NULL),

  -- HARD SCHEDULED (starts May–Jul 2026)
  ('ENG-1011',   'Nexus Media',          'CDN & Performance Audit',               'billable',   'SOW-2026-0205',  38000,   150,  'hard_scheduled',    'Priya Shah',     'Avery Diaz',     'avery.diaz@example.com',     'pm@nexusmedia.example.com',    NULL),
  ('ENG-1012',   'GlobalBank Corp',      'Core Banking API Design',               'billable',   'SOW-2026-0212', 145000,   600,  'hard_scheduled',    'Priya Shah',     'Riley Park',     'riley.park@example.com',     'pm@globalbank.example.com',    'Kickoff May 18.'),
  ('ENG-1013',   'Acme Financial',       'Compliance Reporting Automation',       'billable',   'SOW-2026-0220',  90000,   360,  'hard_scheduled',    'David Kim',      'Avery Diaz',     'avery.diaz@example.com',     'pm@acmefinancial.example.com', NULL),
  ('ENG-1014',   'TechCorp Industries',  'SRE & Observability Rollout',           'billable',   'SOW-2026-0228',  70000,   280,  'hard_scheduled',    'Priya Shah',     'Riley Park',     'riley.park@example.com',     'ops@techcorp.example.com',     NULL),

  -- SOFT AT RISK (verbal but no signed SOW)
  ('ENG-1015',   'HealthFirst Medical',  'FHIR Integration Phase 1',              'billable',   NULL,             95000,   380,  'soft_at_risk',      'David Kim',      'Avery Diaz',     'avery.diaz@example.com',     'product@healthfirst.example.com', 'Awaiting legal review.'),
  ('ENG-1016',   'Orion Logistics',      'Carrier Portal Rebuild',                'billable',   NULL,             60000,   240,  'soft_at_risk',      'Sarah Miller',   'Riley Park',     'riley.park@example.com',     'data@orion.example.com',       NULL),
  ('ENG-1017',   'Meridian Labs',        'ML Platform Evaluation',                'billable',   NULL,             35000,   140,  'soft_at_risk',      'David Kim',      'Avery Diaz',     'avery.diaz@example.com',     'data@meridianlabs.example.com','Small advisory — at risk.'),

  -- SOFT UNCONFIRMED (pipeline, H2 2026)
  ('ENG-1018',   'Acme Financial',       'Data Lake Governance Review',           'billable',   NULL,             50000,   200,  'soft_unconfirmed',  'David Kim',      'Riley Park',     'riley.park@example.com',     'pm@acmefinancial.example.com', NULL),
  ('ENG-1019',   'Crestwood Retail',     'Storefront Platform Refactor',          'billable',   NULL,            120000,   480,  'soft_unconfirmed',  'Sarah Miller',   'Avery Diaz',     'avery.diaz@example.com',     'ops@crestwood.example.com',    NULL),
  ('ENG-1020',   'Nexus Media',          'Video Delivery Architecture',           'billable',   NULL,             85000,   340,  'soft_unconfirmed',  'Priya Shah',     'Riley Park',     'riley.park@example.com',     'pm@nexusmedia.example.com',    NULL)
ON CONFLICT (external_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- ASSIGNMENTS
-- (trigger auto-updates project.engagement_start / engagement_end)
--
-- Using a helper function via WITH so we don't repeat SELECT boilerplate.
-- Each row: (external_id, consultant_email, start_date, end_date, total_hours, notes)
-- ---------------------------------------------------------------------------
WITH a (external_id, email, start_date, end_date, total_hours, note) AS (VALUES
  -- ENG-1001  GlobalBank — done, Jan–Mar
  ('ENG-1001', 'taylor.nguyen@example.com', DATE '2026-01-05', DATE '2026-03-13', 200.0::numeric, 'Mobile app streams'),
  ('ENG-1001', 'jordan.rivera@example.com', DATE '2026-01-12', DATE '2026-03-06', 180.0::numeric, 'API + backend'),

  -- ENG-1002  Crestwood Retail — done, Feb
  ('ENG-1002', 'casey.williams@example.com', DATE '2026-02-02', DATE '2026-02-27', 140.0::numeric, 'Audit + recommendations'),
  ('ENG-1002', 'alex.chen@example.com',      DATE '2026-02-09', DATE '2026-02-27', 100.0::numeric, 'Architecture review'),

  -- ENG-1003  Meridian Labs Phase 1 — done, Jan–Feb
  ('ENG-1003', 'sam.patel@example.com',      DATE '2026-01-05', DATE '2026-02-27', 180.0::numeric, 'Lead architect'),
  ('ENG-1003', 'jordan.rivera@example.com',  DATE '2026-01-12', DATE '2026-02-20', 120.0::numeric, 'Pipeline rebuild'),

  -- ENG-1004  Nexus Media — done, Feb
  ('ENG-1004', 'jordan.rivera@example.com',  DATE '2026-02-02', DATE '2026-03-06', 120.0::numeric, 'Analytics rebuild'),
  ('ENG-1004', 'taylor.nguyen@example.com',  DATE '2026-02-09', DATE '2026-03-06',  80.0::numeric, 'Dashboard UI'),

  -- ENG-1005  Acme Financial — active, Feb–May
  ('ENG-1005', 'alex.chen@example.com',      DATE '2026-02-03', DATE '2026-05-29', 280.0::numeric, 'Lead cloud architect'),
  ('ENG-1005', 'morgan.brooks@example.com',  DATE '2026-02-17', DATE '2026-05-29', 220.0::numeric, 'Platform migration'),
  ('ENG-1005', 'quinn.obrien@example.com',   DATE '2026-03-02', DATE '2026-05-29', 120.0::numeric, 'Strategy + advisory'),
  ('ENG-1005', 'drew.nakamura@example.com',  DATE '2026-03-16', DATE '2026-05-29', 100.0::numeric, 'Backend migration'),

  -- ENG-1006  TechCorp — active, Mar–Apr
  ('ENG-1006', 'morgan.brooks@example.com',  DATE '2026-03-09', DATE '2026-04-24', 180.0::numeric, 'Platform modernization'),
  ('ENG-1006', 'alex.chen@example.com',      DATE '2026-03-16', DATE '2026-04-24', 120.0::numeric, 'Cloud architecture review'),

  -- ENG-1007  Orion Logistics — active, Mar–Jun
  ('ENG-1007', 'sam.patel@example.com',      DATE '2026-03-02', DATE '2026-06-26', 260.0::numeric, 'Lead data architect'),
  ('ENG-1007', 'jordan.rivera@example.com',  DATE '2026-03-16', DATE '2026-06-26', 180.0::numeric, 'Data modeling'),
  ('ENG-1007', 'drew.nakamura@example.com',  DATE '2026-04-06', DATE '2026-06-26',  80.0::numeric, 'Backfill pipelines'),

  -- ENG-1008  Meridian Labs Phase 2 — active, Apr–Jun
  ('ENG-1008', 'sam.patel@example.com',      DATE '2026-04-06', DATE '2026-06-26', 180.0::numeric, 'Lead architect (Phase 2)'),
  ('ENG-1008', 'jordan.rivera@example.com',  DATE '2026-04-13', DATE '2026-06-19', 160.0::numeric, 'Data quality + tests'),

  -- ENG-1009  HealthFirst — active, Mar–May
  ('ENG-1009', 'taylor.nguyen@example.com',  DATE '2026-03-23', DATE '2026-05-15', 140.0::numeric, 'UX implementation'),
  ('ENG-1009', 'casey.williams@example.com', DATE '2026-04-06', DATE '2026-05-15',  80.0::numeric, 'Backend integration'),

  -- ENG-1010  Crestwood Retail — active, Apr–May
  ('ENG-1010', 'casey.williams@example.com', DATE '2026-04-13', DATE '2026-05-22', 110.0::numeric, 'OMS integration'),
  ('ENG-1010', 'drew.nakamura@example.com',  DATE '2026-04-20', DATE '2026-05-22',  60.0::numeric, 'API design'),

  -- ENG-1011  Nexus Media — hard_scheduled, May
  ('ENG-1011', 'morgan.brooks@example.com',  DATE '2026-05-11', DATE '2026-05-29', 100.0::numeric, 'CDN audit'),
  ('ENG-1011', 'quinn.obrien@example.com',   DATE '2026-05-11', DATE '2026-05-29',  50.0::numeric, 'Performance advisory'),

  -- ENG-1012  GlobalBank — hard_scheduled, May–Aug
  ('ENG-1012', 'drew.nakamura@example.com',  DATE '2026-05-18', DATE '2026-08-14', 220.0::numeric, 'Lead API designer'),
  ('ENG-1012', 'casey.williams@example.com', DATE '2026-05-25', DATE '2026-08-14', 180.0::numeric, 'Implementation'),
  ('ENG-1012', 'alex.chen@example.com',      DATE '2026-06-01', DATE '2026-08-14', 120.0::numeric, 'Cloud integration'),
  ('ENG-1012', 'sam.patel@example.com',      DATE '2026-05-18', DATE '2026-08-14',  80.0::numeric, 'Strategy + data model'),

  -- ENG-1013  Acme Financial — hard_scheduled, Jun–Aug
  ('ENG-1013', 'jordan.rivera@example.com',  DATE '2026-06-08', DATE '2026-08-21', 200.0::numeric, 'Reporting automation'),
  ('ENG-1013', 'sam.patel@example.com',      DATE '2026-06-15', DATE '2026-08-21', 100.0::numeric, 'Data advisory'),

  -- ENG-1014  TechCorp — hard_scheduled, Jun–Jul
  ('ENG-1014', 'morgan.brooks@example.com',  DATE '2026-06-15', DATE '2026-07-31', 160.0::numeric, 'SRE rollout'),
  ('ENG-1014', 'quinn.obrien@example.com',   DATE '2026-06-15', DATE '2026-07-31', 120.0::numeric, 'Observability design'),

  -- ENG-1015  HealthFirst — soft_at_risk, Jul–Sep
  ('ENG-1015', 'alex.chen@example.com',      DATE '2026-07-06', DATE '2026-09-25', 200.0::numeric, 'Integration lead'),
  ('ENG-1015', 'casey.williams@example.com', DATE '2026-07-13', DATE '2026-09-25', 180.0::numeric, 'Implementation'),

  -- ENG-1016  Orion — soft_at_risk, Jul–Aug
  ('ENG-1016', 'taylor.nguyen@example.com',  DATE '2026-07-06', DATE '2026-08-28', 140.0::numeric, 'Portal rebuild'),
  ('ENG-1016', 'drew.nakamura@example.com',  DATE '2026-07-13', DATE '2026-08-28', 100.0::numeric, 'Backend'),

  -- ENG-1017  Meridian ML — soft_at_risk, Aug
  ('ENG-1017', 'sam.patel@example.com',      DATE '2026-08-03', DATE '2026-08-28', 100.0::numeric, 'ML platform advisory'),
  ('ENG-1017', 'quinn.obrien@example.com',   DATE '2026-08-03', DATE '2026-08-28',  40.0::numeric, 'Platform review'),

  -- ENG-1018  Acme Financial — soft_unconfirmed, Sep–Oct
  ('ENG-1018', 'jordan.rivera@example.com',  DATE '2026-09-07', DATE '2026-10-16', 120.0::numeric, 'Governance review'),
  ('ENG-1018', 'sam.patel@example.com',      DATE '2026-09-14', DATE '2026-10-16',  80.0::numeric, 'Data advisory'),

  -- ENG-1019  Crestwood — soft_unconfirmed, Sep–Dec
  ('ENG-1019', 'drew.nakamura@example.com',  DATE '2026-09-07', DATE '2026-12-11', 200.0::numeric, 'Storefront refactor'),
  ('ENG-1019', 'casey.williams@example.com', DATE '2026-09-14', DATE '2026-12-11', 180.0::numeric, 'Platform implementation'),
  ('ENG-1019', 'alex.chen@example.com',      DATE '2026-10-05', DATE '2026-12-11', 100.0::numeric, 'Architecture advisory'),

  -- ENG-1020  Nexus — soft_unconfirmed, Oct–Nov
  ('ENG-1020', 'morgan.brooks@example.com',  DATE '2026-10-05', DATE '2026-11-20', 180.0::numeric, 'Video delivery architecture'),
  ('ENG-1020', 'quinn.obrien@example.com',   DATE '2026-10-12', DATE '2026-11-20', 120.0::numeric, 'Platform advisory')
)
INSERT INTO assignments (project_id, consultant_id, start_date, end_date, total_hours, notes)
SELECT p.id, c.id, a.start_date, a.end_date, a.total_hours, a.note
FROM a
JOIN projects p    ON p.external_id = a.external_id
JOIN consultants c ON c.email = a.email
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Backfill done_at for completed projects so archived-filters behave correctly
-- ---------------------------------------------------------------------------
UPDATE projects SET done_at = '2026-03-13' WHERE external_id = 'ENG-1001';
UPDATE projects SET done_at = '2026-02-27' WHERE external_id = 'ENG-1002';
UPDATE projects SET done_at = '2026-02-27' WHERE external_id = 'ENG-1003';
UPDATE projects SET done_at = '2026-03-06' WHERE external_id = 'ENG-1004';

-- Backfill kickoff / readout dates on a handful of active projects
UPDATE projects SET kickoff_internal = '2026-02-02', kickoff_external = '2026-02-05', readout_meeting = '2026-05-29' WHERE external_id = 'ENG-1005';
UPDATE projects SET kickoff_internal = '2026-03-05', kickoff_external = '2026-03-09', readout_meeting = '2026-04-24' WHERE external_id = 'ENG-1006';
UPDATE projects SET kickoff_internal = '2026-03-02', kickoff_external = '2026-03-05', readout_meeting = '2026-06-26' WHERE external_id = 'ENG-1007';

-- ---------------------------------------------------------------------------
-- MONTHLY SNAPSHOTS — locked revenue for Jan, Feb, Mar 2026
--
-- bill_rate = sow_amount / planned_hours (simple model for demo).
-- total_hours per month = sum of assignment hours landing in that month
-- (proportional by overlap days; we approximate here by evenly spreading
-- each assignment across its active months for simplicity).
-- revenue = total_hours * bill_rate.
-- ---------------------------------------------------------------------------
WITH p AS (
  SELECT id, external_id, sow_amount::numeric / NULLIF(planned_hours, 0)::numeric AS bill_rate
  FROM projects
  WHERE external_id IN ('ENG-1001','ENG-1002','ENG-1003','ENG-1004','ENG-1005','ENG-1007','ENG-1008')
),
month_alloc (external_id, month, total_hours) AS (VALUES
  -- ENG-1001 GlobalBank done (Jan/Feb/Mar)
  ('ENG-1001', DATE '2026-01-01', 130.0::numeric),
  ('ENG-1001', DATE '2026-02-01', 140.0::numeric),
  ('ENG-1001', DATE '2026-03-01', 110.0::numeric),
  -- ENG-1002 Crestwood done (Feb)
  ('ENG-1002', DATE '2026-02-01', 240.0::numeric),
  -- ENG-1003 Meridian P1 done (Jan/Feb)
  ('ENG-1003', DATE '2026-01-01', 140.0::numeric),
  ('ENG-1003', DATE '2026-02-01', 160.0::numeric),
  -- ENG-1004 Nexus done (Feb/Mar)
  ('ENG-1004', DATE '2026-02-01', 100.0::numeric),
  ('ENG-1004', DATE '2026-03-01', 100.0::numeric),
  -- ENG-1005 Acme active (Feb/Mar)
  ('ENG-1005', DATE '2026-02-01',  80.0::numeric),
  ('ENG-1005', DATE '2026-03-01', 150.0::numeric),
  -- ENG-1007 Orion active (Mar)
  ('ENG-1007', DATE '2026-03-01', 120.0::numeric),
  -- ENG-1008 Meridian P2 starts Apr, no past months
  ('ENG-1008', DATE '2026-03-01',   0.0::numeric)
)
INSERT INTO monthly_snapshots (project_id, month, total_hours, bill_rate, revenue, is_locked, locked_at)
SELECT
  p.id,
  m.month,
  m.total_hours,
  p.bill_rate,
  m.total_hours * p.bill_rate,
  true,
  m.month + INTERVAL '1 month' - INTERVAL '1 second'
FROM month_alloc m
JOIN p ON p.external_id = m.external_id
WHERE m.total_hours > 0
ON CONFLICT (project_id, month) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Done. To verify: `SELECT count(*) FROM projects` should return 20.
-- ---------------------------------------------------------------------------
