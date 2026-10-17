-- ====================================================================
-- فضاء الولي: بطاقة الاستقبال الرسمية للأستاذ (قابلة للتعديل من لوحته)
-- {"officialDay":"الأربعاء","officialTime":"10:00 - 11:00","extraDay":"","extraTime":"",
--  "location":"قاعة الأساتذة","guidance":"توجيهات الأستاذ للأولياء..."}
-- ====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reception JSONB;

-- إخفاء رقم الهاتف عن الزوار (المعلومات العامة للأستاذ فقط)
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, role, full_name, district_id, middle_school_id, school_custom_name,
  teacher_code, slug, levels_taught, avatar_url, bio, is_verified, reception, created_at
) ON public.profiles TO anon;
