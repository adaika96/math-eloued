-- ====================================================================
-- إصلاح التسجيل: احترام المستويات المختارة، ومنع فشل التسجيل عند تكرار الرابط أو الكود
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  meta   JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_slug TEXT  := COALESCE(NULLIF(meta->>'slug', ''), 'prof-' || SUBSTRING(NEW.id::text, 1, 6));
  v_code TEXT  := COALESCE(NULLIF(meta->>'teacher_code', ''), 'MTH-' || UPPER(SUBSTRING(NEW.id::text, 1, 4)));
  v_levels SMALLINT[];
BEGIN
  -- الرابط والكود فريدان: عند التكرار نضيف لاحقة من معرّف الحساب بدل إفشال التسجيل
  IF EXISTS (SELECT 1 FROM public.profiles WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || SUBSTRING(NEW.id::text, 1, 4);
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE teacher_code = v_code) THEN
    v_code := v_code || '-' || UPPER(SUBSTRING(NEW.id::text, 1, 3));
  END IF;

  -- المستويات التي يدرسها (1 إلى 4) كما اختارها الأستاذ في استمارة التسجيل
  IF jsonb_typeof(meta->'levels_taught') = 'array' THEN
    SELECT array_agg(DISTINCT lvl::SMALLINT ORDER BY lvl::SMALLINT)
    INTO v_levels
    FROM jsonb_array_elements_text(meta->'levels_taught') AS lvl
    WHERE lvl IN ('1', '2', '3', '4');
  END IF;

  INSERT INTO public.profiles (
    id, role, full_name, phone, district_id, middle_school_id,
    school_custom_name, teacher_code, slug, levels_taught
  )
  VALUES (
    NEW.id,
    'teacher', -- لا يُقبل الدور من بيانات التسجيل؛ الترقية حصراً عبر المشرف العام
    COALESCE(NULLIF(meta->>'full_name', ''), 'أستاذ جديد'),
    meta->>'phone',
    NULLIF(meta->>'district_id', '')::INTEGER,
    NULLIF(meta->>'middle_school_id', '')::UUID,
    meta->>'school_custom_name',
    v_code,
    v_slug,
    COALESCE(v_levels, ARRAY[1, 2, 3, 4]::SMALLINT[])
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
