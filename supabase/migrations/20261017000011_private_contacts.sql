-- ====================================================================
-- نقل رقم الهاتف إلى جدول خاص (كان يقرؤه أي مستخدم مسجل عبر سياسة القراءة العامة لـ profiles)
-- يقرؤه: صاحبه، والمشرف العام، ومفتش مقاطعته فقط
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.profile_contacts (
  id          UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_self_all" ON public.profile_contacts;
CREATE POLICY "contacts_self_all" ON public.profile_contacts
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "contacts_staff_read" ON public.profile_contacts;
CREATE POLICY "contacts_staff_read" ON public.profile_contacts
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      public.my_role() = 'inspector'
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_contacts.id AND p.district_id = public.my_district())
    )
  );

-- نقل الأرقام الحالية ثم حذف العمود من profiles (آمن لإعادة التشغيل)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    INSERT INTO public.profile_contacts (id, phone)
    SELECT id, phone FROM public.profiles WHERE phone IS NOT NULL AND btrim(phone) <> ''
    ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone;
    ALTER TABLE public.profiles DROP COLUMN phone;
  END IF;
END $$;

-- المحفز: يحفظ الهاتف في الجدول الخاص
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  meta   JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_slug TEXT  := COALESCE(NULLIF(meta->>'slug', ''), 'prof-' || SUBSTRING(NEW.id::text, 1, 6));
  v_code TEXT  := COALESCE(NULLIF(meta->>'teacher_code', ''), 'MTH-' || UPPER(SUBSTRING(NEW.id::text, 1, 4)));
  v_levels SMALLINT[];
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || SUBSTRING(NEW.id::text, 1, 4);
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE teacher_code = v_code) THEN
    v_code := v_code || '-' || UPPER(SUBSTRING(NEW.id::text, 1, 3));
  END IF;

  IF jsonb_typeof(meta->'levels_taught') = 'array' THEN
    SELECT array_agg(DISTINCT lvl::SMALLINT ORDER BY lvl::SMALLINT)
    INTO v_levels
    FROM jsonb_array_elements_text(meta->'levels_taught') AS lvl
    WHERE lvl IN ('1', '2', '3', '4');
  END IF;

  INSERT INTO public.profiles (
    id, role, full_name, district_id, middle_school_id,
    school_custom_name, teacher_code, slug, levels_taught
  )
  VALUES (
    NEW.id,
    'teacher', -- لا يُقبل الدور من بيانات التسجيل؛ الترقية حصراً عبر المشرف العام
    COALESCE(NULLIF(meta->>'full_name', ''), 'أستاذ جديد'),
    NULLIF(meta->>'district_id', '')::INTEGER,
    NULLIF(meta->>'middle_school_id', '')::UUID,
    meta->>'school_custom_name',
    v_code,
    v_slug,
    COALESCE(v_levels, ARRAY[1, 2, 3, 4]::SMALLINT[])
  )
  ON CONFLICT (id) DO NOTHING;

  IF NULLIF(btrim(COALESCE(meta->>'phone', '')), '') IS NOT NULL THEN
    INSERT INTO public.profile_contacts (id, phone)
    VALUES (NEW.id, btrim(meta->>'phone'))
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- صلاحيات الأعمدة للزوار (بعد حذف عمود الهاتف)
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, role, full_name, district_id, middle_school_id, school_custom_name,
  teacher_code, slug, levels_taught, avatar_url, bio, is_verified, reception, created_at
) ON public.profiles TO anon;
