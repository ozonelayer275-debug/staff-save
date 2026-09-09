-- ============================================================
-- Results Module — Seed: classes + subjects + class_subjects
-- File: supabase/schema_results_seed.sql
-- Run after schema_results.sql. Independent of schema_results_entries.sql
-- (doesn't touch results_entries/results_report_cards).
--
-- Edit v_session below if the current academic session isn't 2025/2026.
-- Safe to re-run: every insert uses ON CONFLICT DO NOTHING against the
-- unique constraints already defined in schema_results.sql.
--
-- KG2/Nursery/Primary/JSS all share the JSS 6-band grading format
-- (level = 'jss'); only SS uses the WAEC 9-band format (level = 'ss').
-- Subject names kept exactly as specified by the school.
-- ============================================================

do $$
declare
  v_session text := '2025/2026';

  v_kg2            text[] := array['Health Habit','Social Norms','Quantitative Reasoning'];
  v_nursery1       text[] := array['Social Habit','Health Habit','Literacy','Numeracy','Pre-science','Bible Story','Moral Education','CCA','Quantitative Reasoning','Verbal Reasoning','Phonics','Rhymes'];
  v_nursery2_to_p2 text[] := array['English Studies','Mathematics','Basic Science','Physical and Health Education','Christian Religious Studies','Nigerian History','Social and Citizenship Studies','Cultural and Creative Arts','Quantitative Reasoning','Verbal Reasoning'];
  v_p3_to_p5       text[] := array['English Studies','Mathematics','Yoruba','Basic Science','Physical and Health Education','Christian Religious Studies','Nigerian History','Social and Citizenship Studies','Basic Digital Literacy','Pre-vocational Studies','French','Cultural and Creative Arts','Quantitative Reasoning','Verbal Reasoning'];
  v_jss            text[] := array['English Studies','Mathematics','Intermediate Science','Digital Technology','History','Social and Citizenship Studies','Cultural and Creative Arts','Business Studies','Physical and Health Education','Yoruba','Christian Religious Studies','French'];
  v_ss             text[] := array['English Studies','Mathematics','Citizenship Education','Digital Technology','Livestock','Biology','Chemistry','Physics','Agricultural Science','Government','Christian Religious Studies','Yoruba','Literature-In-English','Financial Accounting','Commerce','Marketing','Economics'];

  v_class_id uuid;
  v_subj text;
  v_order smallint;
begin
  -- ─── Subjects (jss-format group) ────────────────────────────────────────
  v_order := 0;
  foreach v_subj in array (v_kg2 || v_nursery1 || v_nursery2_to_p2 || v_p3_to_p5 || v_jss)
  loop
    v_order := v_order + 1;
    insert into public.results_subjects (name, level, display_order)
    values (v_subj, 'jss', v_order)
    on conflict (name, level) do nothing;
  end loop;

  -- ─── Subjects (ss-format group) ─────────────────────────────────────────
  v_order := 0;
  foreach v_subj in array v_ss
  loop
    v_order := v_order + 1;
    insert into public.results_subjects (name, level, display_order)
    values (v_subj, 'ss', v_order)
    on conflict (name, level) do nothing;
  end loop;

  -- ─── Classes ─────────────────────────────────────────────────────────────
  insert into public.results_classes (name, level, academic_session) values
    ('KG2', 'jss', v_session),
    ('Nursery 1', 'jss', v_session),
    ('Nursery 2', 'jss', v_session),
    ('Primary 1', 'jss', v_session),
    ('Primary 2', 'jss', v_session),
    ('Primary 3', 'jss', v_session),
    ('Primary 4', 'jss', v_session),
    ('Primary 5', 'jss', v_session),
    ('JSS1', 'jss', v_session),
    ('JSS2', 'jss', v_session),
    ('JSS3', 'jss', v_session),
    ('SS1', 'ss', v_session),
    ('SS2', 'ss', v_session),
    ('SS3', 'ss', v_session)
  on conflict (name, academic_session) do nothing;

  -- ─── class_subjects mappings ─────────────────────────────────────────────
  select id into v_class_id from public.results_classes where name = 'KG2' and academic_session = v_session;
  foreach v_subj in array v_kg2 loop
    insert into public.results_class_subjects (class_id, subject_id)
    select v_class_id, id from public.results_subjects where name = v_subj and level = 'jss'
    on conflict do nothing;
  end loop;

  select id into v_class_id from public.results_classes where name = 'Nursery 1' and academic_session = v_session;
  foreach v_subj in array v_nursery1 loop
    insert into public.results_class_subjects (class_id, subject_id)
    select v_class_id, id from public.results_subjects where name = v_subj and level = 'jss'
    on conflict do nothing;
  end loop;

  foreach v_class_id in array (
    select array_agg(id) from public.results_classes
    where name in ('Nursery 2','Primary 1','Primary 2') and academic_session = v_session
  )
  loop
    foreach v_subj in array v_nursery2_to_p2 loop
      insert into public.results_class_subjects (class_id, subject_id)
      select v_class_id, id from public.results_subjects where name = v_subj and level = 'jss'
      on conflict do nothing;
    end loop;
  end loop;

  foreach v_class_id in array (
    select array_agg(id) from public.results_classes
    where name in ('Primary 3','Primary 4','Primary 5') and academic_session = v_session
  )
  loop
    foreach v_subj in array v_p3_to_p5 loop
      insert into public.results_class_subjects (class_id, subject_id)
      select v_class_id, id from public.results_subjects where name = v_subj and level = 'jss'
      on conflict do nothing;
    end loop;
  end loop;

  foreach v_class_id in array (
    select array_agg(id) from public.results_classes
    where name in ('JSS1','JSS2','JSS3') and academic_session = v_session
  )
  loop
    foreach v_subj in array v_jss loop
      insert into public.results_class_subjects (class_id, subject_id)
      select v_class_id, id from public.results_subjects where name = v_subj and level = 'jss'
      on conflict do nothing;
    end loop;
  end loop;

  foreach v_class_id in array (
    select array_agg(id) from public.results_classes
    where name in ('SS1','SS2','SS3') and academic_session = v_session
  )
  loop
    foreach v_subj in array v_ss loop
      insert into public.results_class_subjects (class_id, subject_id)
      select v_class_id, id from public.results_subjects where name = v_subj and level = 'ss'
      on conflict do nothing;
    end loop;
  end loop;
end $$;
