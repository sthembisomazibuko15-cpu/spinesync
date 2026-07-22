-- ═══════════════════════════════════════════════════════
-- SPINESYNC DATABASE SCHEMA v3
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  hpcsa_number text,
  role text default 'biokineticist',
  approved boolean default false,
  site_id text,
  created_at timestamptz default now()
);

create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  name text not null,
  emp_id text,
  role text,
  age text,
  years_in_role text,
  assess_type text,
  notes text,
  risk text,
  risk_pct integer,
  program_started boolean default false,
  weeks_done integer default 0,
  fce_pending boolean default false,
  fce_complete boolean default false,
  fce_results jsonb default '{}'::jsonb,
  exercise_checked jsonb default '{}'::jsonb,
  assessed_date text,
  consent_shared boolean default false,
  site_id text
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references workers(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  assess_type text,
  scores jsonb default '{}'::jsonb,
  risk_tier text,
  risk_pct integer,
  risk_action text
);

create table if not exists clinical_notes (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references workers(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  author text default 'Attending BK',
  text text not null
);

-- ── ENABLE ROW LEVEL SECURITY
alter table profiles enable row level security;
alter table workers enable row level security;
alter table assessments enable row level security;
alter table clinical_notes enable row level security;

-- ── PROFILES POLICIES
create policy "Users view own profile" on profiles for select using (auth.uid() = id);
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- ── WORKERS POLICIES
-- Biokineticists: full access to all workers
create policy "BK full access workers" on workers for all
  using (exists (select 1 from profiles where id = auth.uid() and approved = true and role = 'biokineticist'))
  with check (exists (select 1 from profiles where id = auth.uid() and approved = true and role = 'biokineticist'));

-- Mine clients: can only SELECT workers for their site_id
-- and only see name/emp_id if consent_shared = true (enforced in app layer via fetchSiteReport)
create policy "Mine client view own site workers" on workers for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and approved = true
      and role = 'mine_client'
      and profiles.site_id = workers.site_id
    )
  );

-- ── ASSESSMENTS POLICIES
create policy "BK full access assessments" on assessments for all
  using (exists (select 1 from profiles where id = auth.uid() and approved = true and role = 'biokineticist'))
  with check (exists (select 1 from profiles where id = auth.uid() and approved = true and role = 'biokineticist'));

-- ── CLINICAL NOTES POLICIES (Biokineticist only — mines never see notes)
create policy "BK full access notes" on clinical_notes for all
  using (exists (select 1 from profiles where id = auth.uid() and approved = true and role = 'biokineticist'))
  with check (exists (select 1 from profiles where id = auth.uid() and approved = true and role = 'biokineticist'));

-- ── AUTO UPDATE TIMESTAMP
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger workers_updated_at
  before update on workers
  for each row execute function update_updated_at();

-- ═══════════════════════════════════════════════════════
-- AFTER RUNNING THIS SCHEMA:
--
-- 1. Create your user in Authentication → Users → Add User
--    (tick Auto Confirm User)
--
-- 2. Copy the User UID and run:
--    insert into profiles (id, full_name, approved, role)
--    values ('YOUR-USER-UID', 'Your Name', true, 'admin');
--
-- 3. To assign a mine client to a site, run:
--    update profiles set site_id = 'MINE-001', approved = true
--    where id = 'MINE-CLIENT-USER-UID';
--
--    Then update their workers to match:
--    update workers set site_id = 'MINE-001'
--    where emp_id in ('EMP-001','EMP-002',...);
--
-- 4. To grant a worker consent for identity sharing:
--    update workers set consent_shared = true
--    where id = 'WORKER-UUID';
--    (The app also does this via the toggle in the worker profile)
-- ═══════════════════════════════════════════════════════
