-- ============================================================
-- Patch 3: fix infinite trigger recursion on results_entries that causes
-- "stack depth limit exceeded" when saving subject scores.
--
-- Root cause: results_entries_after_write fired on ANY update to
-- results_entries. Its own helper functions (results_recompute_cumulative_averages,
-- results_recompute_subject_cohort) write the derived columns
-- (cumulative_average, class_average, highest_in_class, lowest_in_class,
-- subject_position) back onto the same table — each of those writes
-- re-fired the same AFTER trigger, which recomputed and wrote again,
-- infinitely, until Postgres aborted with "stack depth limit exceeded".
--
-- Fix: restrict the trigger to fire only when test1/test2/exam/status
-- actually change (the genuinely user-driven columns) — the helpers never
-- touch those columns, so their writes no longer re-trigger this function,
-- while a real score edit or status change still correctly does.
--
-- Safe to run once against a database that already has schema_results.sql
-- and schema_results_entries.sql applied.
-- ============================================================

drop trigger if exists results_entries_after_write on public.results_entries;
create trigger results_entries_after_write
  after insert or update of test1, test2, exam, status on public.results_entries
  for each row execute function public.trg_results_entries_after_write();
