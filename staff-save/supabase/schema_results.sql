-- ============================================================
-- More-Days Results Module — Part 1: reference/roster schema
-- File: supabase/schema_results.sql
-- Run in the same Supabase project, after schema.sql.
-- Reuses is_school_user() (already defined in the live project
-- for the school schema — see schema.sql's notes).
-- Does NOT touch staff / savings_entries / withdrawal_requests.
--
-- NAMING: this Supabase project is SHARED with other applications
-- (confirmed live: an unrelated `public.students` table already exists,
-- with completely different columns — name/class/guardian_name/status).
-- Every new table and function below is therefore prefixed `results_`,
-- even ones that don't collide today, since generic names like `classes`/
-- `subjects` are exactly what another app could plausibly add later.
-- Never remove this prefix.
-- ============================================================

-- ─── CLASSES ─────────────────────────────────────────────────────────────────
create table if not exists public.results_classes (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,                  -- e.g. 'JSS1', 'SSS1 A'
  level             text not null check (level in ('jss', 'ss')),
  section           text,                            -- nullable if the school has no sections
  academic_session  text not null,                   -- e.g. '2025/2026'
  created_at        timestamptz not null default now(),
  unique (name, academic_session)
);

-- ─── SUBJECTS ────────────────────────────────────────────────────────────────
create table if not exists public.results_subjects (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  level          text not null check (level in ('jss', 'ss')),
  weight         numeric(4,2) not null default 1.0,   -- SS "weighted score" multiplier; unused for jss
  display_order  smallint not null default 0,
  unique (name, level)
);

create table if not exists public.results_class_subjects (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.results_classes(id) on delete cascade,
  subject_id  uuid not null references public.results_subjects(id) on delete cascade,
  unique (class_id, subject_id)
);

-- ─── CLASS ASSIGNMENTS ───────────────────────────────────────────────────────
create table if not exists public.results_class_assignments (
  id                      uuid primary key default gen_random_uuid(),
  staff_id                uuid not null references public.staff(id) on delete cascade,
  class_id                uuid not null references public.results_classes(id) on delete cascade,
  academic_session        text not null,              -- kept for query convenience; trigger-enforced to match results_classes.academic_session
  results_access_enabled  boolean not null default false,
  created_at              timestamptz not null default now(),
  created_by              uuid references auth.users(id),
  unique (staff_id, class_id, academic_session)
);

-- data-integrity guard: results_class_assignments.academic_session must always
-- match the session of the class it points at (class_id already implies it — avoids drift)
create or replace function public.trg_results_class_assignments_session_matches_class()
returns trigger language plpgsql as $$
declare v_session text;
begin
  select academic_session into v_session from public.results_classes where id = new.class_id;
  if v_session is null then
    raise exception 'class_id % does not exist', new.class_id;
  end if;
  if new.academic_session <> v_session then
    raise exception 'results_class_assignments.academic_session (%) must match results_classes.academic_session (%) for class_id %',
      new.academic_session, v_session, new.class_id;
  end if;
  return new;
end;
$$;

drop trigger if exists results_class_assignments_session_check on public.results_class_assignments;
create trigger results_class_assignments_session_check
  before insert or update of class_id, academic_session on public.results_class_assignments
  for each row execute function public.trg_results_class_assignments_session_matches_class();

-- ─── STUDENTS ────────────────────────────────────────────────────────────────
-- NOTE: named results_students, NOT students — a public.students table with a
-- completely different shape already exists in this shared project from
-- another application. Do not rename this to `students`.
create table if not exists public.results_students (
  id                  uuid primary key default gen_random_uuid(),
  class_id            uuid not null references public.results_classes(id) on delete restrict, -- CURRENT class
  first_name          text not null,
  last_name           text not null,
  reg_no_or_bece_no   text not null,
  gender              text not null check (gender in ('M', 'F')),
  age_or_dob          text,                       -- free text ("11yrs") to match the reference PDFs' "Age: 11yrs" field
  photo_url           text,                       -- Supabase Storage public URL; null = blank placeholder
  admission_date      date not null default current_date,
  class_history       jsonb not null default '[]'::jsonb,   -- promotion audit log, written only by results_promote_student()
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  unique (reg_no_or_bece_no)
);

-- ─── GRADING SCALES ──────────────────────────────────────────────────────────
create table if not exists public.results_grading_scales (
  id            uuid primary key default gen_random_uuid(),
  level         text not null check (level in ('jss', 'ss')),
  min_score     numeric(5,2) not null,
  max_score     numeric(5,2) not null,
  grade         text not null,
  meaning       text not null,
  grade_point   numeric(3,1),
  display_order smallint not null default 0
);

insert into public.results_grading_scales (level, min_score, max_score, grade, meaning, display_order)
select * from (values
  ('jss',  0::numeric, 30::numeric,  'F',  'Fail',      1::smallint),
  ('jss', 30, 40,  'E', 'Poor',      2),
  ('jss', 40, 50,  'D', 'Pass',      3),
  ('jss', 50, 60,  'C', 'Good',      4),
  ('jss', 60, 70,  'B', 'Very good', 5),
  ('jss', 70, 100, 'A', 'Excellent', 6),
  ('ss',   0, 40,  'F9', 'Fail',      1),
  ('ss',  40, 45,  'E8', 'Pass',      2),
  ('ss',  45, 50,  'D7', 'Pass',      3),
  ('ss',  50, 55,  'C6', 'Credit',    4),
  ('ss',  55, 60,  'C5', 'Credit',    5),
  ('ss',  60, 65,  'C4', 'Credit',    6),
  ('ss',  65, 70,  'B3', 'Good',      7),
  ('ss',  70, 75,  'B2', 'Very good', 8),
  ('ss',  75, 100, 'A1', 'Excellent', 9)
) as seed(level, min_score, max_score, grade, meaning, display_order)
where not exists (select 1 from public.results_grading_scales g where g.level = seed.level and g.grade = seed.grade);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index if not exists results_class_assignments_staff_idx         on public.results_class_assignments(staff_id);
create index if not exists results_class_assignments_class_session_idx on public.results_class_assignments(class_id, academic_session);
create index if not exists results_students_class_idx                  on public.results_students(class_id);
create index if not exists results_class_subjects_class_idx            on public.results_class_subjects(class_id);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
alter table public.results_classes           enable row level security;
alter table public.results_subjects          enable row level security;
alter table public.results_class_subjects    enable row level security;
alter table public.results_class_assignments enable row level security;
alter table public.results_students          enable row level security;
alter table public.results_grading_scales    enable row level security;

-- results_classes / results_subjects / results_class_subjects / results_grading_scales:
-- non-sensitive reference data needed for dropdowns and roster/report rendering —
-- every authenticated user may read, only admin writes.
create policy "school_user_all_results_classes" on public.results_classes for all to authenticated
  using (is_school_user()) with check (is_school_user());
create policy "authenticated_read_results_classes" on public.results_classes for select to authenticated using (true);

create policy "school_user_all_results_subjects" on public.results_subjects for all to authenticated
  using (is_school_user()) with check (is_school_user());
create policy "authenticated_read_results_subjects" on public.results_subjects for select to authenticated using (true);

create policy "school_user_all_results_class_subjects" on public.results_class_subjects for all to authenticated
  using (is_school_user()) with check (is_school_user());
create policy "authenticated_read_results_class_subjects" on public.results_class_subjects for select to authenticated using (true);

create policy "school_user_all_results_grading_scales" on public.results_grading_scales for all to authenticated
  using (is_school_user()) with check (is_school_user());
create policy "authenticated_read_results_grading_scales" on public.results_grading_scales for select to authenticated using (true);

-- results_class_assignments: only the owning staff member (needs to know their
-- own enabled/disabled state) + admin can read; only admin writes.
create policy "school_user_all_results_class_assignments" on public.results_class_assignments for all to authenticated
  using (is_school_user()) with check (is_school_user());
create policy "staff_read_own_results_class_assignments" on public.results_class_assignments for select to authenticated
  using (staff_id in (select id from public.staff where auth_user_id = auth.uid()));

-- results_students: admin full access; staff select/insert/update only within
-- classes they are currently assigned to with results_access_enabled = true;
-- no staff delete policy at all (removal is admin-only).
create policy "school_user_all_results_students" on public.results_students for all to authenticated
  using (is_school_user()) with check (is_school_user());

create policy "staff_select_assigned_class_results_students" on public.results_students
  for select to authenticated
  using (exists (
    select 1 from public.results_class_assignments ca
    join public.staff s on s.id = ca.staff_id
    where s.auth_user_id = auth.uid()
      and ca.class_id = results_students.class_id
      and ca.results_access_enabled = true
  ));

create policy "staff_insert_assigned_class_results_students" on public.results_students
  for insert to authenticated
  with check (exists (
    select 1 from public.results_class_assignments ca
    join public.staff s on s.id = ca.staff_id
    where s.auth_user_id = auth.uid()
      and ca.class_id = results_students.class_id
      and ca.results_access_enabled = true
  ));

create policy "staff_update_assigned_class_results_students" on public.results_students
  for update to authenticated
  using (exists (
    select 1 from public.results_class_assignments ca
    join public.staff s on s.id = ca.staff_id
    where s.auth_user_id = auth.uid()
      and ca.class_id = results_students.class_id
      and ca.results_access_enabled = true
  ))
  with check (exists (
    select 1 from public.results_class_assignments ca
    join public.staff s on s.id = ca.staff_id
    where s.auth_user_id = auth.uid()
      and ca.class_id = results_students.class_id
      and ca.results_access_enabled = true
  ));

-- ─── PROMOTION SAFETY: class_id can only change via results_promote_student() ─
-- Column-level privilege: the `authenticated` role (further gated by RLS above)
-- may update these columns only. class_id is deliberately excluded — it can
-- only change through results_promote_student() below, never a raw UPDATE,
-- regardless of whether RLS would otherwise allow it.
revoke update on public.results_students from authenticated;
grant update (first_name, last_name, reg_no_or_bece_no, gender, age_or_dob, photo_url, admission_date)
  on public.results_students to authenticated;

create or replace function public.results_promote_student(p_student_id uuid, p_new_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_class_id uuid;
  v_is_owning_teacher boolean;
begin
  select class_id into v_old_class_id from public.results_students where id = p_student_id;
  if v_old_class_id is null then
    raise exception 'Student % not found', p_student_id;
  end if;

  select exists (
    select 1 from public.results_class_assignments ca
    join public.staff s on s.id = ca.staff_id
    where s.auth_user_id = auth.uid()
      and ca.class_id = v_old_class_id
      and ca.results_access_enabled = true
  ) into v_is_owning_teacher;

  if not (is_school_user() or v_is_owning_teacher) then
    raise exception 'Not authorized to promote this student';
  end if;

  if not exists (select 1 from public.results_classes where id = p_new_class_id) then
    raise exception 'Target class % does not exist', p_new_class_id;
  end if;

  update public.results_students
    set class_id = p_new_class_id,
        class_history = class_history || jsonb_build_object(
          'from_class_id', v_old_class_id,
          'to_class_id',   p_new_class_id,
          'promoted_by',   auth.uid(),
          'promoted_at',   now()
        )
    where id = p_student_id;
end;
$$;

revoke execute on function public.results_promote_student(uuid, uuid) from public;
grant execute on function public.results_promote_student(uuid, uuid) to authenticated;

-- ─── STORAGE: results-student-photos bucket ──────────────────────────────────
-- Bucket name is also prefixed for the same shared-project safety reason.
-- The bucket itself ('results-student-photos', public read or signed-URL —
-- admin choice) must be created via the Supabase dashboard/Storage API, not
-- SQL. Path convention: {student_id}/{timestamp}-{filename}
create policy "authenticated_read_results_student_photos" on storage.objects
  for select to authenticated using (bucket_id = 'results-student-photos');

create policy "school_user_write_results_student_photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'results-student-photos' and is_school_user());
create policy "school_user_update_results_student_photos" on storage.objects
  for update to authenticated using (bucket_id = 'results-student-photos' and is_school_user());
create policy "school_user_delete_results_student_photos" on storage.objects
  for delete to authenticated using (bucket_id = 'results-student-photos' and is_school_user());

create policy "assigned_teacher_write_results_student_photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'results-student-photos'
    and exists (
      select 1 from public.results_students st
      join public.results_class_assignments ca on ca.class_id = st.class_id
      join public.staff s on s.id = ca.staff_id
      where s.auth_user_id = auth.uid()
        and ca.results_access_enabled = true
        and st.id::text = (storage.foldername(name))[1]
    )
  );

create policy "assigned_teacher_update_results_student_photos" on storage.objects
  for update to authenticated using (
    bucket_id = 'results-student-photos'
    and exists (
      select 1 from public.results_students st
      join public.results_class_assignments ca on ca.class_id = st.class_id
      join public.staff s on s.id = ca.staff_id
      where s.auth_user_id = auth.uid()
        and ca.results_access_enabled = true
        and st.id::text = (storage.foldername(name))[1]
    )
  );

-- ─── SETUP NOTES ─────────────────────────────────────────────────────────────
-- 1. Create the 'results-student-photos' bucket via Supabase Studio → Storage
--    before any photo upload code runs; the policies above assume it already
--    exists.
-- 2. results_classes/results_subjects/results_grading_scales are seeded/managed
--    by admin via the Admin > Results > Classes/Subjects screens
--    (results_grading_scales ships pre-seeded above with the JSS 6-band and
--    SS/WAEC 9-band tables).
-- 3. Part 2 (results_entries, results_report_cards, computation triggers,
--    locking) lives in supabase/schema_results_entries.sql — run after this
--    file.
-- 4. Before running this file, always re-check for name collisions in this
--    shared project: `select table_name from information_schema.tables
--    where table_schema='public' and table_name like 'results_%';` should be
--    empty on a first run.
