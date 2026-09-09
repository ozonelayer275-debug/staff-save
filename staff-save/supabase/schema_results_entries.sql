-- ============================================================
-- More-Days Results Module — Part 2: results_entries / results_report_cards
-- File: supabase/schema_results_entries.sql
-- Run in the same Supabase project, after schema_results.sql.
-- Reuses is_school_user().
--
-- NAMING: same shared-project safety rule as schema_results.sql — every new
-- table/function is prefixed `results_`. Do not drop the prefix.
-- ============================================================

-- ─── RESULT ENTRIES ──────────────────────────────────────────────────────────
create table if not exists public.results_entries (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.results_students(id) on delete cascade,
  subject_id          uuid not null references public.results_subjects(id) on delete restrict,
  class_id            uuid not null references public.results_classes(id) on delete restrict, -- PINNED at insert (read fresh from results_students.class_id, never touched by results_promote_student)
  academic_session    text not null,
  term                text not null check (term in ('1', '2', '3')),
  test1               numeric(5,2) not null default 0 check (test1 between 0 and 20),
  test2               numeric(5,2) not null default 0 check (test2 between 0 and 20),
  exam                numeric(5,2) not null default 0 check (exam between 0 and 60),
  total               numeric(5,2) not null default 0,   -- server-computed: test1+test2+exam
  cumulative_average  numeric(5,2),                       -- non-SS levels only, server-computed running average across terms (see note below)
  weighted_score      numeric(6,2),                       -- SS only, server-computed = total * results_subjects.weight
  grade               text,                               -- server-computed, from results_grading_scales
  remark              text,                               -- server-computed, = results_grading_scales.meaning
  class_average       numeric(5,2),                       -- server-computed cohort stat
  highest_in_class    numeric(5,2),                       -- server-computed cohort stat
  lowest_in_class     numeric(5,2),                       -- server-computed cohort stat
  subject_position    smallint,                           -- server-computed cohort stat
  status              text not null default 'draft' check (status in ('draft','submitted','approved','locked')),
  entered_by          uuid references public.staff(id), -- nullable: admin may not have a linked staff profile
  edit_history        jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (student_id, subject_id, academic_session, term)
);

comment on column public.results_entries.cumulative_average is
  'Genuine cross-term running average, confirmed by the school directly: term N''s value is the mean of '
  '(total/3) across terms 1..N for that student+subject+session (Term 1 = its own total/3; Term 3 = mean of '
  'all 3 terms'' total/3 values, i.e. "addition of the 3 divided by 3"). Computed by '
  'results_recompute_cumulative_averages(), which walks every term for the student+subject+session on every '
  'write, so backfilling an earlier term correctly ripples forward (and backward) into sibling terms.';

-- ─── REPORT CARDS ────────────────────────────────────────────────────────────
create table if not exists public.results_report_cards (
  id                           uuid primary key default gen_random_uuid(),
  student_id                   uuid not null references public.results_students(id) on delete cascade,
  class_id                     uuid not null references public.results_classes(id) on delete restrict, -- PINNED at insert
  academic_session             text not null,
  term                         text not null check (term in ('1','2','3')),
  attendance_opened            smallint not null default 0,
  attendance_present           smallint not null default 0,
  attendance_absent            smallint not null default 0,
  overall_total                numeric(7,2),
  overall_average               numeric(5,2),
  position_in_class            smallint,
  position_in_section          smallint,
  class_size                   smallint,
  section_size                 smallint,
  section_average               numeric(5,2),
  highest_average_in_section    numeric(5,2),
  lowest_average_in_section     numeric(5,2),
  overall_performance           text,
  promoted_to_class_id         uuid references public.results_classes(id),
  affective_traits             jsonb not null default '{}'::jsonb,
  psychomotor_skills           jsonb not null default '{}'::jsonb,
  adviser_report                text,
  form_master_report            text,
  principal_report               text,
  status                        text not null default 'draft' check (status in ('draft','submitted','approved','locked')),
  entered_by                    uuid references public.staff(id),
  edit_history                  jsonb not null default '[]'::jsonb,
  approved_by                   uuid references auth.users(id),
  approved_at                   timestamptz,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  unique (student_id, academic_session, term)
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index if not exists results_entries_student_idx                 on public.results_entries(student_id);
create index if not exists results_entries_class_session_term_idx      on public.results_entries(class_id, academic_session, term);
create index if not exists results_entries_student_subject_session_idx on public.results_entries(student_id, subject_id, academic_session);
create index if not exists results_report_cards_student_idx            on public.results_report_cards(student_id);
create index if not exists results_report_cards_class_session_term_idx on public.results_report_cards(class_id, academic_session, term);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
alter table public.results_entries      enable row level security;
alter table public.results_report_cards enable row level security;

create policy "school_user_all_results_entries" on public.results_entries for all to authenticated
  using (is_school_user()) with check (is_school_user());

-- staff SELECT: read-only, ANY status, ANY term/session, but only for classes
-- they're CURRENTLY assigned+enabled for (view-only history / term switcher)
create policy "staff_select_assigned_results_entries" on public.results_entries
  for select to authenticated
  using (exists (
    select 1 from public.results_class_assignments ca
    join public.staff s on s.id = ca.staff_id
    where s.auth_user_id = auth.uid()
      and ca.class_id = results_entries.class_id
      and ca.academic_session = results_entries.academic_session
      and ca.results_access_enabled = true
  ));

create policy "staff_insert_own_results_entries" on public.results_entries
  for insert to authenticated
  with check (
    status = 'draft'
    and entered_by in (select id from public.staff where auth_user_id = auth.uid())
    and exists (
      select 1 from public.results_class_assignments ca
      join public.staff s on s.id = ca.staff_id
      where s.auth_user_id = auth.uid()
        and ca.class_id = results_entries.class_id
        and ca.academic_session = results_entries.academic_session
        and ca.results_access_enabled = true
    )
  );

-- staff UPDATE: only while the EXISTING row is 'draft' (using = old row), and only
-- into {draft, submitted} (with check = new row) — this policy IS the "submit" action.
create policy "staff_update_own_draft_results_entries" on public.results_entries
  for update to authenticated
  using (
    status = 'draft'
    and entered_by in (select id from public.staff where auth_user_id = auth.uid())
    and exists (
      select 1 from public.results_class_assignments ca
      join public.staff s on s.id = ca.staff_id
      where s.auth_user_id = auth.uid()
        and ca.class_id = results_entries.class_id
        and ca.academic_session = results_entries.academic_session
        and ca.results_access_enabled = true
    )
  )
  with check (
    status in ('draft', 'submitted')
    and entered_by in (select id from public.staff where auth_user_id = auth.uid())
    and exists (
      select 1 from public.results_class_assignments ca
      join public.staff s on s.id = ca.staff_id
      where s.auth_user_id = auth.uid()
        and ca.class_id = results_entries.class_id
        and ca.academic_session = results_entries.academic_session
        and ca.results_access_enabled = true
    )
  );
-- No staff DELETE policy — even draft rows can only be removed by admin
-- (school_user_all_results_entries covers admin delete).

create policy "school_user_all_results_report_cards" on public.results_report_cards for all to authenticated
  using (is_school_user()) with check (is_school_user());

create policy "staff_select_assigned_results_report_cards" on public.results_report_cards
  for select to authenticated
  using (exists (
    select 1 from public.results_class_assignments ca
    join public.staff s on s.id = ca.staff_id
    where s.auth_user_id = auth.uid()
      and ca.class_id = results_report_cards.class_id
      and ca.academic_session = results_report_cards.academic_session
      and ca.results_access_enabled = true
  ));

-- Unlike results_entries (per-subject, legitimately owned by whichever staff
-- member teaches that subject), report-card-level fields (attendance,
-- affective/psychomotor traits, adviser/form-master/principal reports) are
-- class-wide, not subject-specific — so any staff member currently
-- assigned+enabled for the class may create/edit them while in draft, not
-- just whoever happened to be the first to enter a subject score (which is
-- who results_recompute_report_card_for() auto-creates the row as
-- entered_by, an accident of ordering, not an authorization boundary).
create policy "staff_insert_results_report_cards_for_class" on public.results_report_cards
  for insert to authenticated
  with check (
    status = 'draft'
    and exists (
      select 1 from public.results_class_assignments ca
      join public.staff s on s.id = ca.staff_id
      where s.auth_user_id = auth.uid()
        and ca.class_id = results_report_cards.class_id
        and ca.academic_session = results_report_cards.academic_session
        and ca.results_access_enabled = true
    )
  );

create policy "staff_update_draft_results_report_cards_for_class" on public.results_report_cards
  for update to authenticated
  using (
    status = 'draft'
    and exists (
      select 1 from public.results_class_assignments ca
      join public.staff s on s.id = ca.staff_id
      where s.auth_user_id = auth.uid()
        and ca.class_id = results_report_cards.class_id
        and ca.academic_session = results_report_cards.academic_session
        and ca.results_access_enabled = true
    )
  )
  with check (
    status in ('draft', 'submitted')
    and exists (
      select 1 from public.results_class_assignments ca
      join public.staff s on s.id = ca.staff_id
      where s.auth_user_id = auth.uid()
        and ca.class_id = results_report_cards.class_id
        and ca.academic_session = results_report_cards.academic_session
        and ca.results_access_enabled = true
    )
  );

-- ─── LOCKING: a real DB stop, not just a UI convention ───────────────────────
-- Blocks writes to a `locked` row (even admin's blanket policy) unless a
-- transaction-local GUC is set, which only the SECURITY DEFINER unlock
-- functions below are allowed to set.
create or replace function public.trg_results_prevent_locked_edit()
returns trigger language plpgsql as $$
begin
  if old.status = 'locked' and coalesce(current_setting('app.allow_unlock', true), 'false') <> 'true' then
    raise exception 'Row % is locked; call results_unlock_result_entry()/results_unlock_report_card() to edit it', old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists results_entries_prevent_locked_edit on public.results_entries;
create trigger results_entries_prevent_locked_edit
  before update on public.results_entries
  for each row execute function public.trg_results_prevent_locked_edit();

drop trigger if exists results_report_cards_prevent_locked_edit on public.results_report_cards;
create trigger results_report_cards_prevent_locked_edit
  before update on public.results_report_cards
  for each row execute function public.trg_results_prevent_locked_edit();

create or replace function public.results_unlock_result_entry(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_school_user() then raise exception 'Admin only'; end if;
  perform set_config('app.allow_unlock', 'true', true); -- transaction-local
  update public.results_entries
    set status = 'approved',
        edit_history = edit_history || jsonb_build_object(
          'action', 'unlock', 'by', auth.uid(), 'at', now(), 'reason', p_reason)
    where id = p_id;
end;
$$;
revoke execute on function public.results_unlock_result_entry(uuid, text) from public;
grant execute on function public.results_unlock_result_entry(uuid, text) to authenticated;

create or replace function public.results_unlock_report_card(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_school_user() then raise exception 'Admin only'; end if;
  perform set_config('app.allow_unlock', 'true', true);
  update public.results_report_cards
    set status = 'approved',
        edit_history = edit_history || jsonb_build_object(
          'action', 'unlock', 'by', auth.uid(), 'at', now(), 'reason', p_reason)
    where id = p_id;
end;
$$;
revoke execute on function public.results_unlock_report_card(uuid, text) from public;
grant execute on function public.results_unlock_report_card(uuid, text) to authenticated;

-- ─── COMPUTATION ENGINE ──────────────────────────────────────────────────────

-- Layer A: per-row derived fields, recomputed on every write to the score
-- columns. total/grade/remark/weighted_score are trivial per-row derivations.
-- cumulative_average is NOT set here — it depends on sibling term rows for the
-- same student+subject+session, so it's left to Layer B's cross-term walk
-- (results_recompute_cumulative_averages) in the AFTER trigger below.
create or replace function public.trg_results_entries_before_write()
returns trigger language plpgsql as $$
declare
  v_level text;
  v_weight numeric;
begin
  new.total := coalesce(new.test1, 0) + coalesce(new.test2, 0) + coalesce(new.exam, 0);
  new.updated_at := now();

  select level into v_level from public.results_classes where id = new.class_id;

  select grade, meaning into new.grade, new.remark
  from public.results_grading_scales
  where level = v_level and new.total >= min_score and new.total <= max_score
  order by display_order limit 1;

  if v_level = 'ss' then
    select weight into v_weight from public.results_subjects where id = new.subject_id;
    new.weighted_score := round(new.total * coalesce(v_weight, 1), 2);
  else
    new.weighted_score := null;
  end if;

  return new;
end;
$$;

drop trigger if exists results_entries_before_write on public.results_entries;
create trigger results_entries_before_write
  before insert or update of test1, test2, exam on public.results_entries
  for each row execute function public.trg_results_entries_before_write();

-- Layer B(0): cross-term running average for one student+subject+session
-- (non-SS levels only). Walks every term 1->3 present for that combination,
-- in order, accumulating (total/3) per term and writing the running mean
-- back to each row's cumulative_average. This is what makes a backfill to
-- an earlier term correctly ripple forward into later terms (and a later
-- term's edit correctly re-settle if an earlier term is edited afterward) —
-- it always recomputes ALL terms for the student+subject+session, not just
-- the one just written.
create or replace function public.results_recompute_cumulative_averages(
  p_student_id uuid, p_subject_id uuid, p_academic_session text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  running_sum numeric := 0;
  running_count int := 0;
begin
  for r in
    select id, total from public.results_entries
    where student_id = p_student_id and subject_id = p_subject_id
      and academic_session = p_academic_session
    order by term asc
  loop
    running_sum := running_sum + coalesce(r.total, 0) / 3.0;
    running_count := running_count + 1;
    update public.results_entries
      set cumulative_average = round(running_sum / running_count, 2)
      where id = r.id;
  end loop;
end;
$$;

-- Layer B(i): class-cohort stats for one subject/term/class, scoped to the
-- PINNED class_id (the roster as it stood for that term). Only counts
-- non-draft rows, so an incomplete classmate's draft never skews the average —
-- cohort numbers naturally settle as more of the class submits.
create or replace function public.results_recompute_subject_cohort(
  p_class_id uuid, p_subject_id uuid, p_academic_session text, p_term text)
returns void language sql security definer set search_path = public as $$
  with cohort as (
    select id, total,
           avg(total) over () as avg_total,
           max(total) over () as max_total,
           min(total) over () as min_total,
           rank() over (order by total desc) as pos
    from public.results_entries
    where class_id = p_class_id and subject_id = p_subject_id
      and academic_session = p_academic_session and term = p_term
      and status <> 'draft'
  )
  update public.results_entries re
  set class_average = round(cohort.avg_total, 2),
      highest_in_class = cohort.max_total,
      lowest_in_class = cohort.min_total,
      subject_position = cohort.pos
  from cohort where re.id = cohort.id;
$$;

-- Layer B(ii): report-card rollups for one student/session/term — sums that
-- student's results_entries for the same class_id/session/term and ranks
-- across the class (and section, where results_classes.section is set).
create or replace function public.results_recompute_report_card_for(
  p_student_id uuid, p_academic_session text, p_term text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_class_id uuid;
  v_section text;
  v_total numeric;
  v_avg numeric;
  v_count int;
begin
  select re.class_id into v_class_id
  from public.results_entries re
  where re.student_id = p_student_id and re.academic_session = p_academic_session and re.term = p_term
  limit 1;

  if v_class_id is null then
    return; -- no entries yet for this student/session/term — nothing to roll up
  end if;

  select sum(total), avg(total), count(*)
    into v_total, v_avg, v_count
  from public.results_entries
  where student_id = p_student_id and class_id = v_class_id
    and academic_session = p_academic_session and term = p_term
    and status <> 'draft';

  select section into v_section from public.results_classes where id = v_class_id;

  -- Ensure a results_report_cards row exists so the trigger-driven flow
  -- doesn't require staff to have separately created one before entering scores.
  insert into public.results_report_cards (student_id, class_id, academic_session, term, entered_by)
  values (
    p_student_id, v_class_id, p_academic_session, p_term,
    (select entered_by from public.results_entries
      where student_id = p_student_id and class_id = v_class_id
        and academic_session = p_academic_session and term = p_term
      limit 1)
  )
  on conflict (student_id, academic_session, term) do nothing;

  update public.results_report_cards
    set overall_total = v_total,
        overall_average = round(v_avg, 2)
    where student_id = p_student_id and academic_session = p_academic_session and term = p_term;

  -- Class-wide position, computed from every student's overall_average in the same class/session/term
  with ranked as (
    select id, rank() over (order by overall_average desc nulls last) as pos, count(*) over () as n
    from public.results_report_cards
    where class_id = v_class_id and academic_session = p_academic_session and term = p_term
      and status <> 'draft'
  )
  update public.results_report_cards rc
  set position_in_class = ranked.pos,
      class_size = ranked.n
  from ranked where rc.id = ranked.id;

  -- Section-wide position/stats, only meaningful when the class has a section value
  if v_section is not null then
    with section_ranked as (
      select rc.id,
             rank() over (order by rc.overall_average desc nulls last) as pos,
             count(*) over () as n,
             avg(rc.overall_average) over () as sec_avg,
             max(rc.overall_average) over () as sec_max,
             min(rc.overall_average) over () as sec_min
      from public.results_report_cards rc
      join public.results_classes c on c.id = rc.class_id
      where c.section = v_section and c.academic_session = p_academic_session
        and rc.term = p_term and rc.status <> 'draft'
    )
    update public.results_report_cards rc
    set position_in_section = section_ranked.pos,
        section_size = section_ranked.n,
        section_average = round(section_ranked.sec_avg, 2),
        highest_average_in_section = section_ranked.sec_max,
        lowest_average_in_section = section_ranked.sec_min
    from section_ranked where rc.id = section_ranked.id;
  end if;
end;
$$;

-- Layer B driver: fires after every results_entries write.
create or replace function public.trg_results_entries_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_level text;
begin
  select level into v_level from public.results_classes where id = new.class_id;

  if v_level <> 'ss' then
    perform public.results_recompute_cumulative_averages(new.student_id, new.subject_id, new.academic_session);
  end if;

  if new.status <> 'draft' then
    perform public.results_recompute_subject_cohort(new.class_id, new.subject_id, new.academic_session, new.term);
  end if;
  perform public.results_recompute_report_card_for(new.student_id, new.academic_session, new.term);
  return new;
end;
$$;

-- IMPORTANT: restricted to `of test1, test2, exam, status` (not a bare
-- `after insert or update`). This function's own helpers
-- (results_recompute_cumulative_averages, results_recompute_subject_cohort)
-- write back to results_entries' derived columns (cumulative_average,
-- class_average, highest_in_class, lowest_in_class, subject_position) — an
-- unrestricted `after update` trigger would re-fire itself on those writes,
-- recompute again, write again, forever, until Postgres aborts with
-- "stack depth limit exceeded". Restricting to the genuinely user-driven
-- columns means the helpers' derived-column-only updates never re-trigger
-- this function, while a real score edit or status change (draft ->
-- submitted -> approved) still correctly does.
drop trigger if exists results_entries_after_write on public.results_entries;
create trigger results_entries_after_write
  after insert or update of test1, test2, exam, status on public.results_entries
  for each row execute function public.trg_results_entries_after_write();

-- ─── SETUP NOTES ─────────────────────────────────────────────────────────────
-- 1. "Submit for review" is an ordinary staff UPDATE (status: draft -> submitted),
--    permitted by staff_update_own_draft_results_entries's `with check`. There
--    is no separate submit RPC.
-- 2. "Approve"/"Lock" are ordinary admin UPDATEs (status -> approved / locked),
--    permitted by the school_user_all_* blanket policies. There is no separate
--    approve RPC — the after-write trigger recomputes rollups on every write
--    regardless of which status transition triggered it.
-- 3. Only unlocking requires an RPC (results_unlock_result_entry /
--    results_unlock_report_card), since the locked-row trigger blocks even
--    admin's blanket UPDATE policy.
