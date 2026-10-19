-- اختبارات ترحيل لوحة المشرف العام (20261019000001_central_dashboard.sql)
-- التشغيل: docker exec -i <db container> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/central_dashboard.test.sql
-- يعمل داخل معاملة ثم يتراجع عنها، فلا يترك أي بيانات.
BEGIN;

-- ---------- حسابات الاختبار (محفز التسجيل ينشئ الملفات الشخصية) ----------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'cd-admin@test.local',  '{"full_name":"cd admin","district_id":1}'),
  ('c2000000-0000-4000-8000-000000000002', 'cd-insp1@test.local',  '{"full_name":"cd insp1","district_id":1}'),
  ('c3000000-0000-4000-8000-000000000003', 'cd-teach1@test.local', '{"full_name":"cd teach1","district_id":1}'),
  ('c4000000-0000-4000-8000-000000000004', 'cd-teach2@test.local', '{"full_name":"cd teach2","district_id":2}'),
  ('c5000000-0000-4000-8000-000000000005', 'cd-teach3@test.local', '{"full_name":"cd teach3","district_id":3}'),
  ('c6000000-0000-4000-8000-000000000006', 'cd-insp2@test.local',  '{"full_name":"cd insp2","district_id":2}');
UPDATE public.profiles SET role = 'admin' WHERE id = 'c1000000-0000-4000-8000-000000000001';
UPDATE public.profiles SET role = 'inspector' WHERE id IN ('c2000000-0000-4000-8000-000000000002', 'c6000000-0000-4000-8000-000000000006');

INSERT INTO public.teacher_public_data (teacher_id, data) VALUES
  ('c3000000-0000-4000-8000-000000000003', '{"lessons":[{"id":"1"},{"id":"2"},{"id":"3"}],
    "announcements":[{"id":"n1","title":"active one","content":"c","category":"general","createdAt":"2026-10-18T10:00:00Z"},
                     {"id":"n2","title":"hidden one","content":"c","category":"general","active":false,"createdAt":"2026-10-18T11:00:00Z"},
                     {"id":"n3","title":"bad date","content":"c","category":"general","createdAt":"2026-99-99T00:00:00Z"}]}'),
  ('c4000000-0000-4000-8000-000000000004', '{"lessons":{}}');

INSERT INTO storage.objects (bucket_id, name) VALUES
  ('private-inspector-docs', 'wilaya/cd-test-a.pdf'),
  ('private-inspector-docs', '2/cd-test-b.pdf');

-- ---------- الإحصائيات (قبل أي تغيير في الأدوار) ----------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

DO $$ -- stats_counts
DECLARE n int; l int;
BEGIN
  SELECT count(*) INTO n FROM public.admin_wilaya_stats();
  IF n <> 5 THEN RAISE EXCEPTION 'stats_counts failed: % rows', n; END IF;
  SELECT lessons INTO l FROM public.admin_wilaya_stats() WHERE district_id = 1;
  IF l < 3 THEN RAISE EXCEPTION 'stats_counts failed: district 1 lessons %', l; END IF;
END $$;

DO $$ -- stats_tolerates_bad_lessons (الأستاذ 2 في المقاطعة 2 بدروس ليست مصفوفة)
DECLARE t int;
BEGIN
  SELECT teachers INTO t FROM public.admin_wilaya_stats() WHERE district_id = 2;
  IF t < 1 THEN RAISE EXCEPTION 'stats_tolerates_bad_lessons failed: teachers %', t; END IF;
END $$;

DO $$ -- recent_announcements
DECLARE n int; h int;
BEGIN
  SELECT count(*) FILTER (WHERE title = 'active one'), count(*) FILTER (WHERE title = 'hidden one')
    INTO n, h FROM public.admin_recent_announcements(50);
  IF n <> 1 OR h <> 0 THEN RAISE EXCEPTION 'recent_announcements failed: active % hidden %', n, h; END IF;
  -- bad_date_tolerated: تاريخ غير صالح لا يُسقط القائمة ويُرتّب في آخرها
  IF (SELECT count(*) FROM public.admin_recent_announcements(50) WHERE title = 'bad date' AND created_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'bad_date_tolerated failed';
  END IF;
END $$;

-- ---------- المنشور الولائي ----------
INSERT INTO public.inspector_circulars (inspector_id, district_id, title, content)
VALUES ('c1000000-0000-4000-8000-000000000001', NULL, 'cd wilaya circular', 'نص');

DO $$ -- wilaya_circular_logged
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_audit_log WHERE action = 'wilaya_circular_published'
                 AND actor_id = 'c1000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'wilaya_circular_logged failed';
  END IF;
END $$;

DO $$ -- wilaya_circular_untargeted
BEGIN
  INSERT INTO public.inspector_circulars (inspector_id, district_id, title, content, target_teacher_id)
  VALUES ('c1000000-0000-4000-8000-000000000001', NULL, 'targeted', 'x', 'c3000000-0000-4000-8000-000000000003');
  RAISE EXCEPTION 'wilaya_circular_untargeted failed';
EXCEPTION WHEN check_violation THEN NULL;
END $$;

-- أستاذ في المقاطعة 3 يرى المنشور الولائي ومرفقه فقط
SELECT set_config('request.jwt.claims', '{"sub":"c5000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
DO $$ -- wilaya_circular_visible (teacher) + wilaya_attachment_readable
DECLARE n int; f text;
BEGIN
  SELECT count(*) INTO n FROM public.inspector_circulars WHERE title = 'cd wilaya circular';
  IF n <> 1 THEN RAISE EXCEPTION 'wilaya_circular_visible failed for teacher: %', n; END IF;
  SELECT string_agg(name, ',') INTO f FROM storage.objects WHERE bucket_id = 'private-inspector-docs' AND name LIKE '%cd-test-%';
  IF f IS DISTINCT FROM 'wilaya/cd-test-a.pdf' THEN RAISE EXCEPTION 'wilaya_attachment_readable failed: %', f; END IF;
END $$;

DO $$ -- log_admin_only (teacher)
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.admin_audit_log;
  IF n <> 0 THEN RAISE EXCEPTION 'log_admin_only failed: teacher sees % rows', n; END IF;
  BEGIN
    INSERT INTO public.admin_audit_log (action, target_type) VALUES ('fake', 'profile');
    RAISE EXCEPTION 'log_admin_only failed: teacher inserted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

DO $$ -- admin_functions_reject_non_admin (teacher)
BEGIN
  BEGIN PERFORM public.admin_wilaya_stats(); RAISE EXCEPTION 'admin_functions_reject_non_admin failed: stats';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.admin_recent_announcements(5); RAISE EXCEPTION 'admin_functions_reject_non_admin failed: announcements';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- مفتش المقاطعة 2 يرى المنشور الولائي، ومفتش المقاطعة 1 لا ينشر منشوراً ولائياً
SELECT set_config('request.jwt.claims', '{"sub":"c6000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
DO $$ -- wilaya_circular_visible (inspector)
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.inspector_circulars WHERE title = 'cd wilaya circular';
  IF n <> 1 THEN RAISE EXCEPTION 'wilaya_circular_visible failed for inspector: %', n; END IF;
  SELECT count(*) INTO n FROM public.admin_audit_log;
  IF n <> 0 THEN RAISE EXCEPTION 'log_admin_only failed: inspector sees % rows', n; END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"sub":"c2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
DO $$ -- inspector_cannot_publish_wilaya
BEGIN
  INSERT INTO public.inspector_circulars (inspector_id, district_id, title, content)
  VALUES ('c2000000-0000-4000-8000-000000000002', NULL, 'x', 'y');
  RAISE EXCEPTION 'inspector_cannot_publish_wilaya failed';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ---------- سجل العمليات ----------
SELECT set_config('request.jwt.claims', '{"sub":"c3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
UPDATE public.profiles SET bio = 'my own bio' WHERE id = 'c3000000-0000-4000-8000-000000000003';

SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
DO $$ -- owner_edit_not_logged
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.admin_audit_log WHERE target_id = 'c3000000-0000-4000-8000-000000000003';
  IF n <> 0 THEN RAISE EXCEPTION 'owner_edit_not_logged failed: % rows', n; END IF;
END $$;

UPDATE public.profiles SET role = 'inspector', district_id = 4 WHERE id = 'c4000000-0000-4000-8000-000000000004';
UPDATE public.profiles SET is_verified = false WHERE id = 'c3000000-0000-4000-8000-000000000003';
INSERT INTO public.middle_schools (district_id, name, commune) VALUES (1, 'cd test school', 'الوادي');
DELETE FROM public.middle_schools WHERE name = 'cd test school';

DO $$ -- role_change_logged, suspend_logged, school_delete_logged
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.admin_audit_log WHERE action = 'role_changed' AND target_id = 'c4000000-0000-4000-8000-000000000004';
  IF r IS NULL OR r.actor_id <> 'c1000000-0000-4000-8000-000000000001' OR r.details->>'to' <> 'inspector' OR r.details->>'from' <> 'teacher' THEN
    RAISE EXCEPTION 'role_change_logged failed: %', row_to_json(r);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_audit_log WHERE action = 'district_changed' AND target_id = 'c4000000-0000-4000-8000-000000000004'
                 AND details->>'to' = '4') THEN
    RAISE EXCEPTION 'role_change_logged failed: no district_changed';
  END IF;
  IF (SELECT count(*) FROM public.admin_audit_log WHERE action = 'account_suspended' AND target_id = 'c3000000-0000-4000-8000-000000000003') <> 1 THEN
    RAISE EXCEPTION 'suspend_logged failed';
  END IF;
  IF (SELECT count(*) FROM public.admin_audit_log WHERE action IN ('school_added', 'school_deleted') AND details->>'name' = 'cd test school') <> 2 THEN
    RAISE EXCEPTION 'school_delete_logged failed';
  END IF;
END $$;

-- ---------- مراقبة الملتقى: حذف المشرف يُسجَّل، وحذف صاحب المشاركة لا يُسجَّل ----------
RESET ROLE;
INSERT INTO public.forum_topics (id, author_id, title, body)
VALUES ('d1000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000005', 'cd forum topic', 'cd topic body');
INSERT INTO public.forum_replies (id, topic_id, author_id, body)
VALUES ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000005', 'cd reply body');
INSERT INTO public.forum_replies (id, topic_id, author_id, body)
VALUES ('d4000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000005', 'cd cascaded reply');
INSERT INTO public.forum_topics (id, author_id, title, body)
VALUES ('d3000000-0000-4000-8000-000000000003', 'c5000000-0000-4000-8000-000000000005', 'cd own topic', 'cd own body');
SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
DELETE FROM public.forum_replies WHERE id = 'd2000000-0000-4000-8000-000000000002';
DELETE FROM public.forum_topics WHERE id = 'd1000000-0000-4000-8000-000000000001';

SELECT set_config('request.jwt.claims', '{"sub":"c5000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
DELETE FROM public.forum_topics WHERE id = 'd3000000-0000-4000-8000-000000000003';

SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
DO $$ -- forum_moderation_logged
BEGIN
  IF (SELECT count(*) FROM public.admin_audit_log WHERE action = 'forum_reply_deleted' AND target_id = 'd2000000-0000-4000-8000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'forum_moderation_logged failed: reply';
  END IF;
  IF (SELECT count(*) FROM public.admin_audit_log WHERE action = 'forum_topic_deleted' AND details->>'title' = 'cd forum topic') <> 1 THEN
    RAISE EXCEPTION 'forum_moderation_logged failed: topic';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_audit_log WHERE target_id = 'd3000000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'forum_moderation_logged failed: author deleting own topic was logged';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_audit_log WHERE target_id = 'd4000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'forum_moderation_logged failed: cascaded reply was logged separately';
  END IF;
END $$;

-- ---------- الزائر المجهول ----------
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ -- admin_functions_reject_non_admin (anon)
BEGIN
  BEGIN PERFORM public.admin_wilaya_stats(); RAISE EXCEPTION 'admin_functions_reject_non_admin failed: anon stats';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.admin_recent_announcements(5); RAISE EXCEPTION 'admin_functions_reject_non_admin failed: anon announcements';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

RESET ROLE;
SELECT 'central_dashboard tests passed' AS result;
ROLLBACK;
