-- ====================================================================
-- فضاء كل أستاذ المستقل (Multi-Tenant Teacher Workspaces)
-- يحل محل ملف lessons-db.json المشترك: لكل أستاذ بياناته الخاصة
--   teacher_public_data  : الدروس، لوحة الشرف، الإعلانات، الاستدعاءات (يقرؤها الأولياء)
--   teacher_private_data : التقويم، العقوبات، قائمة التلاميذ، جلسات المراقبة، الرسائل المجهولة
-- يُطبَّق بعد 20261017000001_security_fixes.sql (يعتمد على public.is_admin / my_role / my_district)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.teacher_public_data (
  teacher_id  UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.teacher_private_data (
  teacher_id  UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teacher_public_data  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_private_data ENABLE ROW LEVEL SECURITY;

-- البيانات العامة: يقرؤها الجميع، ويكتبها صاحبها فقط
DROP POLICY IF EXISTS "public_data_read" ON public.teacher_public_data;
CREATE POLICY "public_data_read" ON public.teacher_public_data
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_data_owner_write" ON public.teacher_public_data;
CREATE POLICY "public_data_owner_write" ON public.teacher_public_data
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- البيانات الخاصة: صاحبها فقط (لا يراها الأولياء ولا المفتش)
DROP POLICY IF EXISTS "private_data_owner_all" ON public.teacher_private_data;
CREATE POLICY "private_data_owner_all" ON public.teacher_private_data
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- إرسال رسالة مجهولة لأستاذ (تلميذ / ولي بدون حساب) دون منحه أي صلاحية قراءة
CREATE OR REPLACE FUNCTION public.post_anonymous_message(p_teacher_id UUID, p_message JSONB)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  msg_content TEXT := btrim(COALESCE(p_message->>'content', ''));
BEGIN
  IF length(msg_content) < 3 OR length(msg_content) > 3000 THEN
    RAISE EXCEPTION 'invalid message length' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_teacher_id AND role = 'teacher') THEN
    RAISE EXCEPTION 'teacher not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.teacher_private_data (teacher_id, data)
  VALUES (p_teacher_id, '{}'::jsonb)
  ON CONFLICT (teacher_id) DO NOTHING;

  UPDATE public.teacher_private_data
  SET data = jsonb_set(
        data,
        '{anonymousMessages}',
        jsonb_build_array(
          jsonb_build_object(
            'id', 'msg_' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint || '_' || substr(md5(random()::text), 1, 4),
            'category', COALESCE(NULLIF(p_message->>'category', ''), 'other'),
            'targetLevel', NULLIF(btrim(COALESCE(p_message->>'targetLevel', '')), ''),
            'content', msg_content,
            'createdAt', to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'read', false
          )
        ) || COALESCE(data->'anonymousMessages', '[]'::jsonb)
      ),
      updated_at = NOW()
  WHERE teacher_id = p_teacher_id;
END;
$$;

REVOKE ALL ON FUNCTION public.post_anonymous_message(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_anonymous_message(UUID, JSONB) TO anon, authenticated;
