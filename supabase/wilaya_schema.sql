-- ====================================================================
-- المنصة الرقمية الموحدة لمادة الرياضيات — ولاية الوادي
-- قاعدة بيانات Supabase (PostgreSQL Schema with Row Level Security)
-- ====================================================================

-- 1. تفعيل الامتدادات الضرورية
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. جدول المقاطعات التفتيشية الخمس بولاية الوادي
CREATE TABLE IF NOT EXISTS public.districts (
  id           SERIAL PRIMARY KEY,
  number       SMALLINT NOT NULL UNIQUE CHECK (number BETWEEN 1 AND 5),
  name         TEXT NOT NULL,                           -- مثال: المقاطعة الأولى (الوادي 1)
  description  TEXT,
  inspector_name TEXT,                                  -- اسم مفتش المقاطعة
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- إدراج المقاطعات الخمس الافتراضية لولاية الوادي
INSERT INTO public.districts (number, name, description)
VALUES 
  (1, 'المقاطعة التفتيشية الأولى — الوادي 1', 'تشمل متوسطات وسط مدينة الوادي والبلديات المجاورة'),
  (2, 'المقاطعة التفتيشية الثانية — الوادي 2', 'تشمل متوسطات جنوب وشرق الولاية'),
  (3, 'المقاطعة التفتيشية الثالثة — قمار', 'تشمل متوسطات دائرة قمار والبلديات التابعة لها'),
  (4, 'المقاطعة التفتيشية الرابعة — الرقيبة', 'تشمل متوسطات دائرة الرقيبة والبلديات التابعة لها'),
  (5, 'المقاطعة التفتيشية الخامسة — الدبيلة والمقرن', 'تشمل متوسطات دوائر الدبيلة والمقرن وحاسي خليفة')
ON CONFLICT (number) DO NOTHING;

-- 3. جدول المتوسطات (Middle Schools)
CREATE TABLE IF NOT EXISTS public.middle_schools (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id  INTEGER NOT NULL REFERENCES public.districts(id) ON DELETE RESTRICT,
  name         TEXT NOT NULL,                           -- اسم المتوسطة، مثال: متوسطة الشهيد أحمد بن عامر
  commune      TEXT NOT NULL,                           -- البلدية، مثال: الوادي، قمار، الدبيلة
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_middle_schools_district ON public.middle_schools(district_id);

-- 4. جدول الحسابات والملفات الشخصية (Profiles: Teachers, Inspectors, Admins)
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('teacher', 'inspector', 'admin')),
  full_name       TEXT NOT NULL,
  phone           TEXT,
  district_id     INTEGER REFERENCES public.districts(id) ON DELETE SET NULL,
  middle_school_id UUID REFERENCES public.middle_schools(id) ON DELETE SET NULL,
  school_custom_name TEXT,                              -- في حال أدخل الأستاذ اسم متوسطته يدوياً
  teacher_code    TEXT UNIQUE,                          -- كود سريع للأستاذ، مثال: MTH-101
  slug            TEXT UNIQUE,                          -- رابط فريد لصفحة الأستاذ، مثال: prof-adaika
  levels_taught   SMALLINT[] DEFAULT '{1,2,3,4}',       -- المستويات التي يدرسها (1، 2، 3، 4)
  avatar_url      TEXT,
  bio             TEXT,
  is_verified     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_district ON public.profiles(district_id);
CREATE INDEX IF NOT EXISTS idx_profiles_slug ON public.profiles(slug);

-- 5. جدول الدروس والسبورة (Lessons)
CREATE TABLE IF NOT EXISTS public.lessons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level           SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 4), -- 1, 2, 3, 4 متوسط
  number          INTEGER NOT NULL,                     -- رقم الدرس للترتيب
  title           TEXT NOT NULL,                        -- عنوان الدرس
  semester        SMALLINT NOT NULL DEFAULT 1 CHECK (semester IN (1, 2, 3)),
  type            TEXT NOT NULL DEFAULT 'lesson' CHECK (type IN ('lesson', 'worksheets', 'summaries')),
  notes           TEXT,                                 -- إرشادات أو ملاحظات الأستاذ للتلاميذ
  is_published    BOOLEAN NOT NULL DEFAULT TRUE,        -- هل الدرس متاح للتلاميذ والأولياء
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lessons_teacher_level ON public.lessons(teacher_id, level, number);

-- 6. جدول صور السبورة وملفات الدرس (Lesson Images & Attachments)
CREATE TABLE IF NOT EXISTS public.lesson_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,                        -- المسار داخل Supabase Storage
  name            TEXT NOT NULL,
  position        INTEGER NOT NULL DEFAULT 0,           -- ترتيب الصورة
  file_type       TEXT NOT NULL DEFAULT 'image' CHECK (file_type IN ('image', 'pdf')),
  is_homework     BOOLEAN NOT NULL DEFAULT FALSE,       -- هل هي صورة حل واجب / سلسلة
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lesson_images_lesson ON public.lesson_images(lesson_id, position);

-- 7. جدول المذكرات التربوية السرية (Pedagogical Notes — بين الأستاذ والمفتش فقط 🔒)
CREATE TABLE IF NOT EXISTS public.pedagogical_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  district_id     INTEGER NOT NULL REFERENCES public.districts(id) ON DELETE RESTRICT,
  level           SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 4),
  semester        SMALLINT NOT NULL DEFAULT 1 CHECK (semester IN (1, 2, 3)),
  lesson_title    TEXT NOT NULL,                        -- موضوع المذكرة
  file_path       TEXT NOT NULL,                        -- مسار ملف المذكرة المشفر في المخزن الخاص
  file_name       TEXT NOT NULL,
  teacher_notes   TEXT,                                 -- تعليق الأستاذ على المذكرة
  inspector_feedback TEXT,                              -- ملاحظات وتوجيهات المفتش البيداغوجية
  reviewed_at     TIMESTAMPTZ,                          -- تاريخ اطلاع وتقييم المفتش
  status          TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'needs_revision')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pedagogical_notes_district ON public.pedagogical_notes(district_id, teacher_id);

-- 8. جدول مناشير ومراسلات مفتش المقاطعة (Inspector Circulars & Bulletins 📢)
CREATE TABLE IF NOT EXISTS public.inspector_circulars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspector_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  district_id     INTEGER NOT NULL REFERENCES public.districts(id) ON DELETE RESTRICT,
  target_school_id UUID REFERENCES public.middle_schools(id) ON DELETE SET NULL, -- NULL يعني لكل مدارس المقاطعة
  target_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,      -- NULL يعني لكل أساتذة المقاطعة
  title           TEXT NOT NULL,                        -- عنوان المنشور / الإرسالية
  content         TEXT NOT NULL,                        -- نص التوجيهات
  attachment_path TEXT,                                 -- ملف مرفق (PDF / نموذج فرض / وثيقة وزارية)
  importance      TEXT NOT NULL DEFAULT 'normal' CHECK (importance IN ('normal', 'urgent', 'seminar')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_circulars_district ON public.inspector_circulars(district_id);

-- 9. جدول تتبع قراءة المناشير (Circular Reads Receipts)
CREATE TABLE IF NOT EXISTS public.circular_reads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circular_id     UUID NOT NULL REFERENCES public.inspector_circulars(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(circular_id, teacher_id)
);

-- 10. جدول الإعلانات المدرسية للأستاذ (Announcements)
CREATE TABLE IF NOT EXISTS public.announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  target_levels   SMALLINT[] DEFAULT '{1,2,3,4}',
  is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. جدول لوحة الشرف (Honor Board)
CREATE TABLE IF NOT EXISTS public.honors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_name    TEXT NOT NULL,
  class_name      TEXT NOT NULL,                        -- مثال: 1م1 ، 2م3
  rank            SMALLINT NOT NULL DEFAULT 1,
  score           NUMERIC(4, 2),                        -- المعدل من 20
  semester        SMALLINT NOT NULL DEFAULT 1,
  badge           TEXT DEFAULT 'امتياز',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- سياسات الأمان ومنع تسرب البيانات (ROW LEVEL SECURITY - RLS)
-- ====================================================================

-- 1) تفعيل RLS على جميع الجداول بلا استثناء
ALTER TABLE public.districts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.middle_schools       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_images        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedagogical_notes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspector_circulars  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circular_reads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.honors               ENABLE ROW LEVEL SECURITY;

-- 2) سياسات جدول المقاطعات والمتوسطات (عامة للقراءة للجميع لتسهيل التسجيل والبحث)
CREATE POLICY "public_read_districts" ON public.districts FOR SELECT USING (true);
CREATE POLICY "public_read_middle_schools" ON public.middle_schools FOR SELECT USING (true);

-- 3) سياسات جدول الحسابات (Profiles)
CREATE POLICY "profiles_public_read_teachers" ON public.profiles
  FOR SELECT USING (role = 'teacher' AND is_verified = true);

-- 4) سياسات جدول الدروس (Lessons)
CREATE POLICY "lessons_public_read" ON public.lessons
  FOR SELECT USING (is_published = true);

CREATE POLICY "lessons_teacher_all" ON public.lessons
  FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- 5) سياسات صور الدروس (Lesson Images)
CREATE POLICY "images_public_read" ON public.lesson_images FOR SELECT USING (true);
CREATE POLICY "images_teacher_all" ON public.lesson_images
  FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- 8) سياسات الإعلانات ولوحة الشرف (عامة للقراءة بحسب الأستاذ)
CREATE POLICY "announcements_public_read" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "announcements_teacher_all" ON public.announcements
  FOR ALL TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "honors_public_read" ON public.honors FOR SELECT USING (true);
CREATE POLICY "honors_teacher_all" ON public.honors
  FOR ALL TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

-- ====================================================================
-- إعداد مخازن الملفات السحابية (Storage Buckets Setup)
-- ====================================================================

-- أ) مخزن صور السبورة والواجبات (Public CDN)
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-lesson-media', 'public-lesson-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ب) مخزن المذكرات التربوية السرية (Strict Private 🔒)
INSERT INTO storage.buckets (id, name, public)
VALUES ('private-pedagogical-notes', 'private-pedagogical-notes', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ج) مخزن مناشير وملفات المفتش (Strict Private 🔒)
INSERT INTO storage.buckets (id, name, public)
VALUES ('private-inspector-docs', 'private-inspector-docs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- د) سياسات التخزين (Storage Objects Policies)
DROP POLICY IF EXISTS "Public read lesson media" ON storage.objects;
CREATE POLICY "Public read lesson media" ON storage.objects
  FOR SELECT USING (bucket_id = 'public-lesson-media');

-- ====================================================================
-- الدوال المساعدة، المحفز، وسياسات الحسابات والمذكرات والمناشير والتخزين
-- (مطابقة لـ supabase/migrations/20261017000001_security_fixes.sql)
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
