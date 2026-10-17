-- ====================================================================
-- ملتقى الأساتذة التفاعلي وبنك الوضعيات (للأساتذة والمفتشين فقط — لا يراه الأولياء)
--   forum_topics  : سؤال/إشكالية بيداغوجية أو مورد مشترك (وضعية انطلاقية، تقويم تشخيصي...)
--   forum_replies : الإجابات (إجابة المفتش تُعلَّم "توجيه رسمي معتمد" وتثبت أولاً)
--   forum_votes   : أصوات التأييد (صوت واحد لكل عضو، ولا تصويت على مشاركته)
-- ====================================================================

-- عضو الملتقى: أستاذ موثق أو مفتش أو مشرف
CREATE OR REPLACE FUNCTION public.is_forum_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT role IN ('teacher', 'inspector', 'admin') AND is_verified
    FROM public.profiles WHERE id = auth.uid()
  ), false)
$$;

CREATE TABLE IF NOT EXISTS public.forum_topics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name     TEXT NOT NULL DEFAULT '',
  author_role     TEXT NOT NULL DEFAULT 'teacher',
  kind            TEXT NOT NULL DEFAULT 'question' CHECK (kind IN ('question', 'resource')),
  category        TEXT NOT NULL DEFAULT 'other'
                  CHECK (category IN ('situations', 'difficulties', 'assessments', 'diagnostic', 'tools', 'classroom', 'other')),
  level           SMALLINT CHECK (level BETWEEN 1 AND 4),
  title           TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  body            TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 3 AND 10000),
  attachment_path TEXT,
  attachment_name TEXT,
  votes           INTEGER NOT NULL DEFAULT 0,
  replies_count   INTEGER NOT NULL DEFAULT 0,
  has_official    BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forum_topics_recent ON public.forum_topics(is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_topics_kind ON public.forum_topics(kind, category, level);

CREATE TABLE IF NOT EXISTS public.forum_replies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id     UUID NOT NULL REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL DEFAULT '',
  author_role  TEXT NOT NULL DEFAULT 'teacher',
  body         TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 2 AND 10000),
  is_official  BOOLEAN NOT NULL DEFAULT FALSE,
  votes        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forum_replies_topic ON public.forum_replies(topic_id, is_official DESC, created_at);

CREATE TABLE IF NOT EXISTS public.forum_votes (
  target_type  TEXT NOT NULL CHECK (target_type IN ('topic', 'reply')),
  target_id    UUID NOT NULL,
  voter_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (target_type, target_id, voter_id)
);

ALTER TABLE public.forum_topics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_votes   ENABLE ROW LEVEL SECURITY;

-- القراءة: أعضاء الملتقى فقط
DROP POLICY IF EXISTS "forum_topics_read" ON public.forum_topics;
CREATE POLICY "forum_topics_read" ON public.forum_topics FOR SELECT TO authenticated USING (public.is_forum_member());
DROP POLICY IF EXISTS "forum_replies_read" ON public.forum_replies;
CREATE POLICY "forum_replies_read" ON public.forum_replies FOR SELECT TO authenticated USING (public.is_forum_member());
DROP POLICY IF EXISTS "forum_votes_read" ON public.forum_votes;
CREATE POLICY "forum_votes_read" ON public.forum_votes FOR SELECT TO authenticated USING (public.is_forum_member());

-- الكتابة: صاحب المشاركة (والمشرف للحذف والتثبيت)
DROP POLICY IF EXISTS "forum_topics_insert" ON public.forum_topics;
CREATE POLICY "forum_topics_insert" ON public.forum_topics FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_forum_member());
DROP POLICY IF EXISTS "forum_topics_update" ON public.forum_topics;
CREATE POLICY "forum_topics_update" ON public.forum_topics FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin() OR public.my_role() = 'inspector')
  WITH CHECK (author_id = auth.uid() OR public.is_admin() OR public.my_role() = 'inspector');
DROP POLICY IF EXISTS "forum_topics_delete" ON public.forum_topics;
CREATE POLICY "forum_topics_delete" ON public.forum_topics FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "forum_replies_insert" ON public.forum_replies;
CREATE POLICY "forum_replies_insert" ON public.forum_replies FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_forum_member());
DROP POLICY IF EXISTS "forum_replies_update" ON public.forum_replies;
CREATE POLICY "forum_replies_update" ON public.forum_replies FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "forum_replies_delete" ON public.forum_replies;
CREATE POLICY "forum_replies_delete" ON public.forum_replies FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "forum_votes_insert" ON public.forum_votes;
CREATE POLICY "forum_votes_insert" ON public.forum_votes FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid() AND public.is_forum_member());
DROP POLICY IF EXISTS "forum_votes_delete" ON public.forum_votes;
CREATE POLICY "forum_votes_delete" ON public.forum_votes FOR DELETE TO authenticated
  USING (voter_id = auth.uid());

-- تعبئة اسم ودور الكاتب من ملفه، وتعليم إجابة المفتش رسمية (لا يمكن تزويرها من المتصفح)
CREATE OR REPLACE FUNCTION public.forum_stamp_author()
RETURNS trigger AS $$
DECLARE
  p RECORD;
BEGIN
  SELECT full_name, role INTO p FROM public.profiles WHERE id = NEW.author_id;
  NEW.author_name := COALESCE(p.full_name, 'عضو');
  NEW.author_role := COALESCE(p.role, 'teacher');
  IF TG_TABLE_NAME = 'forum_replies' THEN
    NEW.is_official := (p.role = 'inspector');
    NEW.votes := 0;
  ELSE
    NEW.votes := 0;
    NEW.replies_count := 0;
    NEW.has_official := FALSE;
    NEW.is_pinned := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS forum_topics_stamp ON public.forum_topics;
CREATE TRIGGER forum_topics_stamp BEFORE INSERT ON public.forum_topics
  FOR EACH ROW EXECUTE FUNCTION public.forum_stamp_author();
DROP TRIGGER IF EXISTS forum_replies_stamp ON public.forum_replies;
CREATE TRIGGER forum_replies_stamp BEFORE INSERT ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.forum_stamp_author();

-- الحقول المحسوبة لا يغيرها الكاتب؛ التثبيت للمفتش والمشرف فقط
CREATE OR REPLACE FUNCTION public.forum_guard_topic_update()
RETURNS trigger AS $$
BEGIN
  IF current_setting('forum.internal', true) = 'on' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.votes := OLD.votes;
  NEW.replies_count := OLD.replies_count;
  NEW.has_official := OLD.has_official;
  NEW.author_id := OLD.author_id;
  NEW.author_name := OLD.author_name;
  NEW.author_role := OLD.author_role;
  IF NOT (public.is_admin() OR public.my_role() = 'inspector') THEN
    NEW.is_pinned := OLD.is_pinned;
  END IF;
  -- المفتش (غير الكاتب) يثبت الموضوع فقط ولا يعدل محتواه
  IF OLD.author_id <> auth.uid() AND NOT public.is_admin() THEN
    NEW.title := OLD.title;
    NEW.body := OLD.body;
    NEW.kind := OLD.kind;
    NEW.category := OLD.category;
    NEW.level := OLD.level;
    NEW.attachment_path := OLD.attachment_path;
    NEW.attachment_name := OLD.attachment_name;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS forum_topics_guard ON public.forum_topics;
CREATE TRIGGER forum_topics_guard BEFORE UPDATE ON public.forum_topics
  FOR EACH ROW EXECUTE FUNCTION public.forum_guard_topic_update();

CREATE OR REPLACE FUNCTION public.forum_guard_reply_update()
RETURNS trigger AS $$
BEGIN
  IF current_setting('forum.internal', true) = 'on' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.votes := OLD.votes;
  NEW.is_official := OLD.is_official;
  NEW.topic_id := OLD.topic_id;
  NEW.author_id := OLD.author_id;
  NEW.author_name := OLD.author_name;
  NEW.author_role := OLD.author_role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS forum_replies_guard ON public.forum_replies;
CREATE TRIGGER forum_replies_guard BEFORE UPDATE ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.forum_guard_reply_update();

-- عدادات الإجابات والتوجيه الرسمي
CREATE OR REPLACE FUNCTION public.forum_reply_counters()
RETURNS trigger AS $$
DECLARE
  t UUID := COALESCE(NEW.topic_id, OLD.topic_id);
BEGIN
  PERFORM set_config('forum.internal', 'on', true);
  UPDATE public.forum_topics
  SET replies_count = (SELECT count(*) FROM public.forum_replies WHERE topic_id = t),
      has_official  = EXISTS (SELECT 1 FROM public.forum_replies WHERE topic_id = t AND is_official)
  WHERE id = t;
  PERFORM set_config('forum.internal', 'off', true);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS forum_replies_counters ON public.forum_replies;
CREATE TRIGGER forum_replies_counters AFTER INSERT OR DELETE ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.forum_reply_counters();

-- منع التصويت على المشاركة الشخصية + تحديث عدد الأصوات
CREATE OR REPLACE FUNCTION public.forum_vote_check()
RETURNS trigger AS $$
DECLARE
  owner UUID;
BEGIN
  IF NEW.target_type = 'topic' THEN
    SELECT author_id INTO owner FROM public.forum_topics WHERE id = NEW.target_id;
  ELSE
    SELECT author_id INTO owner FROM public.forum_replies WHERE id = NEW.target_id;
  END IF;
  IF owner IS NULL THEN
    RAISE EXCEPTION 'المشاركة غير موجودة' USING ERRCODE = 'P0002';
  END IF;
  IF owner = NEW.voter_id THEN
    RAISE EXCEPTION 'لا يمكن التصويت على مشاركتك' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS forum_votes_check ON public.forum_votes;
CREATE TRIGGER forum_votes_check BEFORE INSERT ON public.forum_votes
  FOR EACH ROW EXECUTE FUNCTION public.forum_vote_check();

CREATE OR REPLACE FUNCTION public.forum_vote_counters()
RETURNS trigger AS $$
DECLARE
  tt TEXT := COALESCE(NEW.target_type, OLD.target_type);
  tid UUID := COALESCE(NEW.target_id, OLD.target_id);
  n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM public.forum_votes WHERE target_type = tt AND target_id = tid;
  PERFORM set_config('forum.internal', 'on', true);
  IF tt = 'topic' THEN
    UPDATE public.forum_topics SET votes = n WHERE id = tid;
  ELSE
    UPDATE public.forum_replies SET votes = n WHERE id = tid;
  END IF;
  PERFORM set_config('forum.internal', 'off', true);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS forum_votes_counters ON public.forum_votes;
CREATE TRIGGER forum_votes_counters AFTER INSERT OR DELETE ON public.forum_votes
  FOR EACH ROW EXECUTE FUNCTION public.forum_vote_counters();

-- نقاط التفاعل: 10 لكل صوت تأييد، 5 لكل مورد مشترك، 2 لكل إجابة، 1 لكل سؤال
CREATE OR REPLACE FUNCTION public.forum_leaderboard(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (author_id UUID, author_name TEXT, author_role TEXT, points BIGINT, posts BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH contributions AS (
    SELECT author_id, author_name, author_role,
           votes * 10 + CASE WHEN kind = 'resource' THEN 5 ELSE 1 END AS pts
    FROM public.forum_topics
    UNION ALL
    SELECT author_id, author_name, author_role, votes * 10 + 2 FROM public.forum_replies
  )
  SELECT author_id, max(author_name), max(author_role), sum(pts)::BIGINT, count(*)::BIGINT
  FROM contributions
  WHERE public.is_forum_member()
  GROUP BY author_id
  ORDER BY sum(pts) DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
$$;
GRANT EXECUTE ON FUNCTION public.forum_leaderboard(INTEGER) TO authenticated;

-- مرفقات الملتقى (مذكرات نموذجية، سلاسل، وضعيات): للأعضاء فقط، في مجلد صاحبها
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('forum-files', 'forum-files', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Forum members read files" ON storage.objects;
CREATE POLICY "Forum members read files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'forum-files' AND public.is_forum_member());
DROP POLICY IF EXISTS "Forum members upload own files" ON storage.objects;
CREATE POLICY "Forum members upload own files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'forum-files' AND public.is_forum_member() AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Forum members delete own files" ON storage.objects;
CREATE POLICY "Forum members delete own files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'forum-files' AND (storage.foldername(name))[1] = auth.uid()::text);
