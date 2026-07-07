-- ============================================================
-- MPS Staff Savings — ADDITIVE schema
-- Run in the same Supabase project alongside the school schema.
-- Does NOT touch any existing tables.
-- ============================================================

-- ─── STAFF ───────────────────────────────────────────────────────────────────
create table if not exists public.staff (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  role         text not null,
  phone        text,
  email        text not null unique,
  date_joined  date not null,
  status       text not null default 'active' check (status in ('active', 'inactive')),
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ─── SAVINGS ENTRIES ─────────────────────────────────────────────────────────
create table if not exists public.savings_entries (
  id                uuid primary key default gen_random_uuid(),
  staff_id          uuid not null references public.staff(id) on delete cascade,
  period_month      smallint not null check (period_month between 1 and 12),
  period_year       smallint not null,
  gross_salary      bigint not null default 0,    -- kobo
  savings_amount    bigint not null default 0,    -- kobo
  withdrawal_amount bigint not null default 0,    -- kobo
  running_balance   bigint not null default 0,    -- kobo
  date_recorded     date not null,
  recorded_by       uuid not null references auth.users(id),
  notes             text,
  created_at        timestamptz not null default now(),
  edited_at         timestamptz,
  edit_history      jsonb,
  unique (staff_id, period_month, period_year)
);

-- ─── WITHDRAWAL REQUESTS ─────────────────────────────────────────────────────
create table if not exists public.withdrawal_requests (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references public.staff(id) on delete cascade,
  amount       bigint not null,   -- kobo
  reason       text not null,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references auth.users(id)
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index if not exists savings_entries_staff_id_idx  on public.savings_entries(staff_id);
create index if not exists savings_entries_period_idx    on public.savings_entries(period_year, period_month);
create index if not exists withdrawal_requests_staff_idx on public.withdrawal_requests(staff_id);
create index if not exists withdrawal_requests_status_idx on public.withdrawal_requests(status);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
alter table public.staff               enable row level security;
alter table public.savings_entries     enable row level security;
alter table public.withdrawal_requests enable row level security;

-- Reuse the existing is_school_user() function for admin access
-- (any user in user_roles = admin/bursar can manage all staff savings data)

-- staff
create policy "school_user_all_staff" on public.staff
  for all to authenticated
  using (is_school_user())
  with check (is_school_user());

create policy "staff_read_own_profile" on public.staff
  for select to authenticated
  using (auth_user_id = auth.uid());

-- savings_entries
create policy "school_user_all_savings" on public.savings_entries
  for all to authenticated
  using (is_school_user())
  with check (is_school_user());

create policy "staff_read_own_savings" on public.savings_entries
  for select to authenticated
  using (
    staff_id in (select id from public.staff where auth_user_id = auth.uid())
  );

-- withdrawal_requests
create policy "school_user_all_withdrawals" on public.withdrawal_requests
  for all to authenticated
  using (is_school_user())
  with check (is_school_user());

create policy "staff_read_own_withdrawals" on public.withdrawal_requests
  for select to authenticated
  using (
    staff_id in (select id from public.staff where auth_user_id = auth.uid())
  );

create policy "staff_insert_own_withdrawal" on public.withdrawal_requests
  for insert to authenticated
  with check (
    staff_id in (select id from public.staff where auth_user_id = auth.uid())
  );

-- ─── ROLE SETUP NOTES ────────────────────────────────────────────────────────
-- Existing admin/bursar users (already in user_roles) automatically get full
-- access to all staff savings tables via is_school_user().
--
-- For each staff member login you create via the admin panel, they will NOT
-- be in user_roles — that's intentional. Their access is governed purely by
-- the auth_user_id = auth.uid() policies above (read-only, own data only).
--
-- To create a staff login manually (before Phase 2 UI is built):
--   1. Add user in Supabase Auth dashboard (Authentication → Users → Add user)
--   2. Insert a row in public.staff with auth_user_id = that user's UUID
