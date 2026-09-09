-- ============================================================
-- Patch 1: correct CUMULATIVE AVERAGE to a genuine cross-term running
-- average (was previously total/3 per-term-alone, per initial reading of
-- the sample PDFs — corrected per direct confirmation from the school).
--
-- Safe to re-run against a database that already has schema_results.sql
-- and schema_results_entries.sql applied: every statement here is
-- `create or replace function`, so nothing errors on repeat runs (unlike
-- the full schema_results_entries.sql, which contains `create policy`
-- statements that DO error on a second run — don't re-run that file whole).
-- ============================================================

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

comment on column public.results_entries.cumulative_average is
  'Genuine cross-term running average, confirmed by the school directly: term N''s value is the mean of '
  '(total/3) across terms 1..N for that student+subject+session (Term 1 = its own total/3; Term 3 = mean of '
  'all 3 terms'' total/3 values, i.e. "addition of the 3 divided by 3"). Computed by '
  'results_recompute_cumulative_averages(), which walks every term for the student+subject+session on every '
  'write, so backfilling an earlier term correctly ripples forward (and backward) into sibling terms.';
