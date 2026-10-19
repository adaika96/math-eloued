-- ====================================================================
-- لوحة المشرف العام: منشور ولائي، سجل العمليات، إحصائيات من قاعدة البيانات
-- يُطبّق بعد 20261017000011. قابل لإعادة التشغيل.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1) المنشور الولائي: district_id = NULL يعني كل المقاطعات (للمشرف وحده)
-- --------------------------------------------------------------------
ALTER TABLE public.inspector_circulars ALTER COLUMN district_id DROP NOT NULL;

DROP POLICY IF EXISTS "circulars_inspector_all" ON public.inspector_circulars;
CREATE POLICY "circulars_inspector_all" ON public.inspector_circulars
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR (auth.uid() = inspector_id AND public.my_role() = 'inspector'
        AND district_id IS NOT NULL AND district_id = public.my_district())
  )
  WITH CHECK (
    public.is_admin()
    OR (auth.uid() = inspector_id AND public.my_role() = 'inspector'
        AND district_id IS NOT NULL AND district_id = public.my_district())
  );

DROP POLICY IF EXISTS "circulars_teacher_read" ON public.inspector_circulars;
CREATE POLICY "circulars_teacher_read" ON public.inspector_circulars
  FOR SELECT TO authenticated
  USING (
    public.my_role() = 'teacher'
    AND (district_id IS NULL OR district_id = public.my_district())
    AND (target_teacher_id IS NULL OR target_teacher_id = auth.uid())
    AND (
      target_school_id IS NULL
      OR target_school_id = (SELECT middle_school_id FROM public.profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "circulars_inspector_read_wilaya" ON public.inspector_circulars;
CREATE POLICY "circulars_inspector_read_wilaya" ON public.inspector_circulars
  FOR SELECT TO authenticated
  USING (public.my_role() = 'inspector' AND district_id IS NULL);

-- مرفقات المنشور الولائي في المجلد wilaya/ يقرؤها كل الأساتذة والمفتشين
DROP POLICY IF EXISTS "District read inspector docs" ON storage.objects;
CREATE POLICY "District read inspector docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'private-inspector-docs'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = public.my_district()::text
      OR ((storage.foldername(name))[1] = 'wilaya' AND public.my_role() IN ('teacher', 'inspector'))
    )
  );

-- --------------------------------------------------------------------
-- 2) سجل العمليات: يملؤه المحفز فقط، ويقرؤه المشرف وحده
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_admin_read" ON public.admin_audit_log;
CREATE POLICY "audit_admin_read" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_admin_action(p_action TEXT, p_target_type TEXT, p_target_id TEXT, p_details JSONB)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, COALESCE(p_details, '{}'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.log_admin_action(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- تغييرات الملف الشخصي التي يجريها غير صاحبه (ترقية، نقل مقاطعة، تعليق)
CREATE OR REPLACE FUNCTION public.audit_profile_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = NEW.id THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    PERFORM public.log_admin_action('role_changed', 'profile', NEW.id::text,
      jsonb_build_object('from', OLD.role, 'to', NEW.role, 'full_name', NEW.full_name));
  END IF;
  IF NEW.district_id IS DISTINCT FROM OLD.district_id THEN
    PERFORM public.log_admin_action('district_changed', 'profile', NEW.id::text,
      jsonb_build_object('from', OLD.district_id, 'to', NEW.district_id, 'full_name', NEW.full_name));
  END IF;
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    PERFORM public.log_admin_action(
      CASE WHEN NEW.is_verified THEN 'account_reactivated' ELSE 'account_suspended' END,
      'profile', NEW.id::text, jsonb_build_object('full_name', NEW.full_name));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_profile_change ON public.profiles;
CREATE TRIGGER trg_audit_profile_change
  AFTER UPDATE OF role, district_id, is_verified ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_change();

CREATE OR REPLACE FUNCTION public.audit_school_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.middle_schools;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN NULL;
  END IF;
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  PERFORM public.log_admin_action(
    CASE TG_OP WHEN 'INSERT' THEN 'school_added' WHEN 'UPDATE' THEN 'school_updated' ELSE 'school_deleted' END,
    'school', r.id::text,
    jsonb_build_object('name', r.name, 'commune', r.commune, 'district_id', r.district_id));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_audit_school_change ON public.middle_schools;
CREATE TRIGGER trg_audit_school_change
  AFTER INSERT OR UPDATE OR DELETE ON public.middle_schools
  FOR EACH ROW EXECUTE FUNCTION public.audit_school_change();

CREATE OR REPLACE FUNCTION public.audit_wilaya_circular()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.inspector_circulars;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF r.district_id IS NULL THEN
    PERFORM public.log_admin_action(
      CASE TG_OP WHEN 'INSERT' THEN 'wilaya_circular_published' ELSE 'wilaya_circular_deleted' END,
      'circular', r.id::text, jsonb_build_object('title', r.title));
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_audit_wilaya_circular ON public.inspector_circulars;
CREATE TRIGGER trg_audit_wilaya_circular
  AFTER INSERT OR DELETE ON public.inspector_circulars
  FOR EACH ROW EXECUTE FUNCTION public.audit_wilaya_circular();

-- --------------------------------------------------------------------
-- 3) إحصائيات الولاية محسوبة في قاعدة البيانات (للمشرف وحده)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_wilaya_stats()
RETURNS TABLE (
  district_id INT, district_name TEXT, inspector_name TEXT,
  teachers INT, inspectors INT, active_teachers INT, lessons INT,
  notes_submitted INT, notes_reviewed INT, circulars INT, suspended INT, new_this_week INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    d.id,
    d.name,
    (SELECT p.full_name FROM public.profiles p WHERE p.role = 'inspector' AND p.district_id = d.id ORDER BY p.created_at LIMIT 1),
    (SELECT count(*)::int FROM public.profiles p WHERE p.role = 'teacher' AND p.district_id = d.id),
    (SELECT count(*)::int FROM public.profiles p WHERE p.role = 'inspector' AND p.district_id = d.id),
    (SELECT count(*)::int FROM public.profiles p
       LEFT JOIN public.teacher_public_data pub ON pub.teacher_id = p.id
       LEFT JOIN public.teacher_private_data prv ON prv.teacher_id = p.id
      WHERE p.role = 'teacher' AND p.district_id = d.id
        AND GREATEST(pub.updated_at, prv.updated_at) > now() - interval '7 days'),
    (SELECT COALESCE(sum(CASE WHEN jsonb_typeof(pub.data->'lessons') = 'array'
                              THEN jsonb_array_length(pub.data->'lessons') ELSE 0 END), 0)::int
       FROM public.teacher_public_data pub JOIN public.profiles p ON p.id = pub.teacher_id
      WHERE p.role = 'teacher' AND p.district_id = d.id),
    (SELECT count(*)::int FROM public.pedagogical_notes n WHERE n.district_id = d.id),
    (SELECT count(*)::int FROM public.pedagogical_notes n WHERE n.district_id = d.id AND n.status <> 'submitted'),
    (SELECT count(*)::int FROM public.inspector_circulars c WHERE c.district_id = d.id),
    (SELECT count(*)::int FROM public.profiles p WHERE p.district_id = d.id AND NOT p.is_verified),
    (SELECT count(*)::int FROM public.profiles p WHERE p.district_id = d.id AND p.created_at > now() - interval '7 days')
  FROM public.districts d
  ORDER BY d.id;
END $$;

REVOKE ALL ON FUNCTION public.admin_wilaya_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_wilaya_stats() TO authenticated;

-- آخر إعلانات الأساتذة العامة لمراقبة المحتوى (قراءة فقط)
CREATE OR REPLACE FUNCTION public.admin_recent_announcements(p_limit INT DEFAULT 50)
RETURNS TABLE (
  teacher_id UUID, teacher_name TEXT, slug TEXT, title TEXT, content TEXT, category TEXT, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.slug, a->>'title', a->>'content', a->>'category',
         (a->>'createdAt')::timestamptz AS created
  FROM public.teacher_public_data pub
  JOIN public.profiles p ON p.id = pub.teacher_id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(pub.data->'announcements') = 'array' THEN pub.data->'announcements' ELSE '[]'::jsonb END
  ) AS a
  WHERE COALESCE(a->>'active', 'true') <> 'false'
    AND (a->>'createdAt') ~ '^\d{4}-\d{2}-\d{2}'
  ORDER BY created DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
END $$;

REVOKE ALL ON FUNCTION public.admin_recent_announcements(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recent_announcements(INT) TO authenticated;
