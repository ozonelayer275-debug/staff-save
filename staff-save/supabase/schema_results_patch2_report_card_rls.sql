-- ============================================================
-- Patch 2: fix results_report_cards insert/update RLS so any staff member
-- assigned+enabled for the class can edit report-card-level fields
-- (attendance, affective/psychomotor traits, adviser/form-master/principal
-- reports), not just whoever happened to be entered_by on the row.
--
-- Root cause: results_recompute_report_card_for() auto-creates a
-- results_report_cards row the moment ANY subject score is entered for a
-- student, setting entered_by to whichever staff member happened to enter
-- that first score — an accident of ordering, not a meaningful ownership
-- boundary. The old policy required the CURRENT editor's staff id to match
-- that entered_by, so a different staff member (e.g. the form teacher
-- filling in attendance/traits/reports, when a different subject teacher
-- entered the first score) would have their UPDATE silently match zero rows
-- — Postgres/Postgrest returns success with no error for an UPDATE whose
-- USING clause matches nothing, so the form would reload the unchanged
-- (old, likely empty) row and look like it had "cleared" the input.
--
-- Unlike results_entries (legitimately owned per-subject by whichever staff
-- teaches that subject), report-card-level fields are class-wide — so this
-- widens the policy to "any staff assigned+enabled for the class", matching
-- the same class-scoped check already used for SELECT.
--
-- Safe to run once against a database that already has schema_results.sql
-- and schema_results_entries.sql applied.
-- ============================================================

drop policy if exists "staff_insert_own_results_report_cards" on public.results_report_cards;
drop policy if exists "staff_update_own_draft_results_report_cards" on public.results_report_cards;

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
