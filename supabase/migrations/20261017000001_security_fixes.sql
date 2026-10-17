-- ====================================================================
-- إصلاحات أمنية حرجة (PROJECT_REVIEW.md #4 - #6)
-- 1) منع اختيار الدور (admin / inspector) عند التسجيل
-- 2) منع الأستاذ من ترقية نفسه أو تغيير مقاطعته
-- 3) عزل المذكرات والمخازن الخاصة حسب صاحبها ومقاطعته
-- + دوال مساعدة SECURITY DEFINER لتفادي التكرار اللانهائي في سياسات profiles
-- يُطبَّق مرة واحدة في: Supabase > SQL Editor > Run (آمن لإعادة التشغيل)
-- ====================================================================

-- --------------------------------------------------------------------
-- أ) دوال مساعدة (تتجاوز RLS لقراءة دور المستخدم الحالي فقط)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.my_district()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT district_id FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()), false) $$;

-- --------------------------------------------------------------------
-- ب) #4 المحفز: كل حساب جديد أستاذ دائماً (تجاهل role القادم من المتصفح)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    phone,
    district_id,
    middle_school_id,
    school_custom_name,
    teacher_code,
    slug,
    levels_taught
  )
  VALUES (
    NEW.id,
    'teacher', -- لا يُقبل الدور من بيانات التسجيل؛ الترقية حصراً عبر المشرف العام
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'أستاذ جديد'),
    NEW.raw_user_meta_data->>'phone',
    NULLIF(NEW.raw_user_meta_data->>'district_id', '')::INTEGER,
    CASE
      WHEN NEW.raw_user_meta_data->>'middle_school_id' IS NOT NULL AND NEW.raw_user_meta_data->>'middle_school_id' <> ''
      THEN (NEW.raw_user_meta_data->>'middle_school_id')::UUID
      ELSE NULL
    END,
    NEW.raw_user_meta_data->>'school_custom_name',
    COALESCE(NEW.raw_user_meta_data->>'teacher_code', 'MTH-' || UPPER(SUBSTRING(NEW.id::text, 1, 4))),
    COALESCE(NEW.raw_user_meta_data->>'slug', 'prof-' || SUBSTRING(NEW.id::text, 1, 6)),
    ARRAY[1, 2, 3, 4]::SMALLINT[]
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- تصحيح أي حساب سبق أن سجّل نفسه بدور مرتفع: راجع النتيجة يدوياً قبل التخفيض
-- SELECT id, full_name, role, created_at FROM public.profiles WHERE role IN ('admin', 'inspector');

-- --------------------------------------------------------------------
-- ج) #5 سياسات profiles: تعديل الملف الشخصي دون الدور/المقاطعة/التوثيق
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_self_read_write" ON public.profiles;
DROP POLICY IF EXISTS "profiles_inspector_read_district" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_staff_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;

CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_staff_read" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (public.my_role() = 'inspector' AND district_id = public.my_district())
  );

CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles_admin_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- حارس الأعمدة الحساسة: فقط المشرف العام (أو SQL Editor / service_role) يغيّر الدور والمقاطعة والتوثيق
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger AS $$
BEGIN
  -- auth.uid() فارغ عند التنفيذ من SQL Editor أو بمفتاح service_role (الزوار anon ممنوعون من التعديل بالـ RLS)
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.district_id IS DISTINCT FROM OLD.district_id
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    RAISE EXCEPTION 'غير مسموح بتغيير الدور أو المقاطعة أو حالة التوثيق إلا من طرف المشرف العام'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_profile_privileges ON public.profiles;
CREATE TRIGGER guard_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

-- سياسة المفتش على الدروس بدون استعلام متداخل على profiles
DROP POLICY IF EXISTS "lessons_inspector_read" ON public.lessons;
CREATE POLICY "lessons_inspector_read" ON public.lessons
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      public.my_role() = 'inspector'
      AND EXISTS (
        SELECT 1 FROM public.profiles teacher_p
        WHERE teacher_p.id = lessons.teacher_id
          AND teacher_p.district_id = public.my_district()
      )
    )
  );

-- --------------------------------------------------------------------
-- د) #6 المذكرات التربوية: الأستاذ داخل مقاطعته فقط، والمفتش قراءة + توجيه
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "notes_teacher_all" ON public.pedagogical_notes;
DROP POLICY IF EXISTS "notes_inspector_access" ON public.pedagogical_notes;
DROP POLICY IF EXISTS "notes_inspector_read" ON public.pedagogical_notes;
DROP POLICY IF EXISTS "notes_inspector_review" ON public.pedagogical_notes;

CREATE POLICY "notes_teacher_all" ON public.pedagogical_notes
  FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id AND district_id = public.my_district());

CREATE POLICY "notes_inspector_read" ON public.pedagogical_notes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (public.my_role() = 'inspector' AND district_id = public.my_district())
  );

CREATE POLICY "notes_inspector_review" ON public.pedagogical_notes
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (public.my_role() = 'inspector' AND district_id = public.my_district())
  )
  WITH CHECK (
    public.is_admin()
    OR (public.my_role() = 'inspector' AND district_id = public.my_district())
  );

-- مناشير المفتش: النشر للمفتش داخل مقاطعته فقط (كان بإمكان أي أستاذ النشر باسمه)
DROP POLICY IF EXISTS "circulars_inspector_all" ON public.inspector_circulars;
DROP POLICY IF EXISTS "circulars_teacher_read" ON public.inspector_circulars;

CREATE POLICY "circulars_inspector_all" ON public.inspector_circulars
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR (auth.uid() = inspector_id AND public.my_role() = 'inspector' AND district_id = public.my_district())
  )
  WITH CHECK (
    public.is_admin()
    OR (auth.uid() = inspector_id AND public.my_role() = 'inspector' AND district_id = public.my_district())
  );

CREATE POLICY "circulars_teacher_read" ON public.inspector_circulars
  FOR SELECT TO authenticated
  USING (
    public.my_role() = 'teacher'
    AND district_id = public.my_district()
    AND (target_teacher_id IS NULL OR target_teacher_id = auth.uid())
    AND (
      target_school_id IS NULL
      OR target_school_id = (SELECT middle_school_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- --------------------------------------------------------------------
-- هـ) #6 سياسات التخزين: كل ملف داخل مجلد صاحبه
--   public-lesson-media        : <teacher_id>/...
--   private-pedagogical-notes  : <teacher_id>/...
--   private-inspector-docs     : <district_id>/...
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated upload lesson media" ON storage.objects;
DROP POLICY IF EXISTS "Teacher manage own lesson media" ON storage.objects;
DROP POLICY IF EXISTS "Teacher update own lesson media" ON storage.objects;
DROP POLICY IF EXISTS "Teacher delete own lesson media" ON storage.objects;

CREATE POLICY "Teacher manage own lesson media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public-lesson-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Teacher update own lesson media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'public-lesson-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'public-lesson-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Teacher delete own lesson media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'public-lesson-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Teacher and Inspector read private notes" ON storage.objects;
DROP POLICY IF EXISTS "Teacher upload private notes" ON storage.objects;
DROP POLICY IF EXISTS "Teacher delete own private notes" ON storage.objects;

CREATE POLICY "Teacher and Inspector read private notes" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'private-pedagogical-notes'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
      OR (
        public.my_role() = 'inspector'
        AND EXISTS (
          SELECT 1 FROM public.profiles teacher_p
          WHERE teacher_p.id::text = (storage.foldername(name))[1]
            AND teacher_p.district_id = public.my_district()
        )
      )
    )
  );

CREATE POLICY "Teacher upload private notes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'private-pedagogical-notes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Teacher delete own private notes" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'private-pedagogical-notes' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "District read inspector docs" ON storage.objects;
DROP POLICY IF EXISTS "Inspector upload inspector docs" ON storage.objects;
DROP POLICY IF EXISTS "Inspector delete inspector docs" ON storage.objects;

CREATE POLICY "District read inspector docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'private-inspector-docs'
    AND (public.is_admin() OR (storage.foldername(name))[1] = public.my_district()::text)
  );

CREATE POLICY "Inspector upload inspector docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'private-inspector-docs'
    AND (
      public.is_admin()
      OR (public.my_role() = 'inspector' AND (storage.foldername(name))[1] = public.my_district()::text)
    )
  );

CREATE POLICY "Inspector delete inspector docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'private-inspector-docs'
    AND (
      public.is_admin()
      OR (public.my_role() = 'inspector' AND (storage.foldername(name))[1] = public.my_district()::text)
    )
  );
