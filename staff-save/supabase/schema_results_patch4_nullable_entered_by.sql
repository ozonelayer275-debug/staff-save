-- ============================================================
-- Patch 4: make results_entries.entered_by nullable.
--
-- It was NOT NULL, but an admin account may have no linked staff profile
-- (staff rows are for savings-account holders; not every admin has one).
-- The new admin "review a student's subjects at once" screen lets admin
-- fill in a subject score directly for a student who has no entry yet,
-- which is an INSERT — and that INSERT would fail outright for such an
-- admin. results_report_cards.entered_by is already nullable for the same
-- reason; this brings results_entries in line with it. Staff still can't
-- insert/update with a null entered_by — the existing RLS policies require
-- `entered_by in (select id from staff where auth_user_id = auth.uid())`,
-- and `null in (...)` is never true — only admin's blanket policy can.
--
-- Safe to run once against a database that already has schema_results.sql
-- and schema_results_entries.sql applied.
-- ============================================================

alter table public.results_entries alter column entered_by drop not null;
