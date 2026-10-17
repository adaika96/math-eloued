-- ====================================================================
-- أدوات المشرف العام: إدارة قائمة المتوسطات المعتمدة لكل مقاطعة
-- ====================================================================

DROP POLICY IF EXISTS "middle_schools_admin_write" ON public.middle_schools;
CREATE POLICY "middle_schools_admin_write" ON public.middle_schools
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- منع تكرار نفس المتوسطة في نفس البلدية
CREATE UNIQUE INDEX IF NOT EXISTS uq_middle_schools_name_commune
  ON public.middle_schools(district_id, lower(name), lower(commune));
