-- ====================================================================
-- الملف البيداغوجي للأستاذ (بين الأستاذ ومفتش مقاطعته فقط)
--   1) أنواع الوثائق: مذكرة حصة، توزيع سنوي، دفتر النصوص، تقويم تشخيصي، أخرى
--   2) جدول التوقيت الأسبوعي (لبرمجة زيارات التفتيش)
--   3) إشعارات القراءة للمناشير (circular_reads)
-- ====================================================================

-- 1) توسيع جدول المذكرات ليشمل كل الوثائق البيداغوجية
ALTER TABLE public.pedagogical_notes
  ADD COLUMN IF NOT EXISTS doc_type TEXT NOT NULL DEFAULT 'lesson_plan',
  ADD COLUMN IF NOT EXISTS field TEXT,             -- الميدان
  ADD COLUMN IF NOT EXISTS section TEXT,           -- المقطع
  ADD COLUMN IF NOT EXISTS session_number INTEGER; -- رقم الحصة

ALTER TABLE public.pedagogical_notes DROP CONSTRAINT IF EXISTS pedagogical_notes_doc_type_check;
ALTER TABLE public.pedagogical_notes ADD CONSTRAINT pedagogical_notes_doc_type_check
  CHECK (doc_type IN ('lesson_plan', 'annual_distribution', 'cahier_textes', 'diagnostic', 'other'));

-- 2) جدول التوقيت الأسبوعي
CREATE TABLE IF NOT EXISTS public.teacher_timetables (
  teacher_id  UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- [{ "day": "الأحد", "start": "08:00", "end": "09:00", "className": "2م1", "room": "04" }]
  slots       JSONB NOT NULL DEFAULT '[]'::jsonb,
  image_path  TEXT,  -- صورة اختيارية لجدول الحصص المعتمد (في المخزن الخاص للمذكرات)
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.teacher_timetables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timetable_owner_all" ON public.teacher_timetables;
CREATE POLICY "timetable_owner_all" ON public.teacher_timetables
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "timetable_inspector_read" ON public.teacher_timetables;
CREATE POLICY "timetable_inspector_read" ON public.teacher_timetables
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      public.my_role() = 'inspector'
      AND EXISTS (
        SELECT 1 FROM public.profiles t
        WHERE t.id = teacher_timetables.teacher_id AND t.district_id = public.my_district()
      )
    )
  );

-- 3) إشعارات قراءة المناشير
DROP POLICY IF EXISTS "reads_teacher_insert" ON public.circular_reads;
CREATE POLICY "reads_teacher_insert" ON public.circular_reads
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    -- لا يسجل الأستاذ قراءة إلا لمنشور يحق له رؤيته (تطبق سياسات inspector_circulars)
    AND EXISTS (SELECT 1 FROM public.inspector_circulars c WHERE c.id = circular_reads.circular_id)
  );

DROP POLICY IF EXISTS "reads_teacher_select" ON public.circular_reads;
CREATE POLICY "reads_teacher_select" ON public.circular_reads
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "reads_inspector_select" ON public.circular_reads;
CREATE POLICY "reads_inspector_select" ON public.circular_reads
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.inspector_circulars c
      WHERE c.id = circular_reads.circular_id
        AND c.district_id = public.my_district()
        AND public.my_role() = 'inspector'
    )
  );

-- 4) يحق للأستاذ إعادة رفع وثيقة طُلب تعديلها: إعادة الحالة إلى "قيد المراجعة" مسموحة
--    (سياسة notes_teacher_all تغطي التعديل؛ نمنع فقط تزوير ملاحظات المفتش)
CREATE OR REPLACE FUNCTION public.guard_note_review_fields()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() OR public.my_role() = 'inspector' THEN
    RETURN NEW;
  END IF;
  -- الأستاذ لا يكتب توجيه المفتش ولا يعتمد وثيقته بنفسه
  IF NEW.inspector_feedback IS DISTINCT FROM OLD.inspector_feedback
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'submitted') THEN
    RAISE EXCEPTION 'لا يمكن للأستاذ تعديل حالة المراجعة أو توجيهات المفتش' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_note_review_fields ON public.pedagogical_notes;
CREATE TRIGGER guard_note_review_fields
  BEFORE UPDATE ON public.pedagogical_notes
  FOR EACH ROW EXECUTE FUNCTION public.guard_note_review_fields();

-- منع الأستاذ من إدراج وثيقة "معتمدة" مسبقاً
CREATE OR REPLACE FUNCTION public.guard_note_insert()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    NEW.status := 'submitted';
    NEW.inspector_feedback := NULL;
    NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_note_insert ON public.pedagogical_notes;
CREATE TRIGGER guard_note_insert
  BEFORE INSERT ON public.pedagogical_notes
  FOR EACH ROW EXECUTE FUNCTION public.guard_note_insert();
