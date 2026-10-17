-- ====================================================================
-- حجب الحل النموذجي حتى موعد نشره على مستوى قاعدة البيانات
-- (كان الحجب في واجهة Next.js فقط، بينما يمكن قراءة teacher_public_data مباشرة عبر REST)
-- ====================================================================

-- 1) لا قراءة مباشرة للجدول إلا لصاحبه وللمفتش (مقاطعته) والمشرف
DROP POLICY IF EXISTS "public_data_read" ON public.teacher_public_data;
DROP POLICY IF EXISTS "public_data_staff_read" ON public.teacher_public_data;
CREATE POLICY "public_data_staff_read" ON public.teacher_public_data
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.is_admin()
    OR (
      public.my_role() = 'inspector'
      AND EXISTS (
        SELECT 1 FROM public.profiles t
        WHERE t.id = teacher_public_data.teacher_id AND t.district_id = public.my_district()
      )
    )
  );

-- 2) القراءة العامة (الأولياء والتلاميذ) عبر دالة تحذف صور الحل قبل موعد نشره
CREATE OR REPLACE FUNCTION public.get_teacher_public_data(p_teacher_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN d.data IS NULL THEN NULL
    WHEN jsonb_typeof(d.data->'lessons') <> 'array' THEN d.data
    ELSE jsonb_set(
      d.data,
      '{lessons}',
      COALESCE((
        SELECT jsonb_agg(
          CASE
            WHEN (l->>'solutionPublishAt') IS NOT NULL
             AND (l->>'solutionPublishAt')::timestamptz > now()
            THEN l || jsonb_build_object('homeworkImages', '[]'::jsonb, 'solutionLocked', true)
            ELSE l
          END
          ORDER BY ord
        )
        FROM jsonb_array_elements(d.data->'lessons') WITH ORDINALITY AS e(l, ord)
      ), '[]'::jsonb)
    )
  END
  FROM public.teacher_public_data d
  JOIN public.profiles p ON p.id = d.teacher_id
  WHERE d.teacher_id = p_teacher_id
    AND p.role = 'teacher'
    AND p.is_verified
$$;

REVOKE ALL ON FUNCTION public.get_teacher_public_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_teacher_public_data(UUID) TO anon, authenticated;

-- 3) منع سرد ملفات المخزن العام (التحميل بالرابط العام يبقى يعمل لأن المخزن public)
DROP POLICY IF EXISTS "Public read lesson media" ON storage.objects;
DROP POLICY IF EXISTS "Teacher list own lesson media" ON storage.objects;
CREATE POLICY "Teacher list own lesson media" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'public-lesson-media' AND (storage.foldername(name))[1] = auth.uid()::text);
