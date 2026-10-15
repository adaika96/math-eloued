-- =========================================================
-- قاعدة بيانات دروس الرياضيات (1 و 2 متوسط)
-- انسخ هذا الملف كاملاً في: Supabase > SQL Editor > Run
-- =========================================================

-- 1) جدول الدروس
create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  level       smallint not null check (level in (1, 2)),   -- 1 = أولى متوسط ، 2 = ثانية متوسط
  number      integer  not null,                           -- رقم الدرس (للترتيب)
  title       text     not null,
  created_at  timestamptz not null default now()
);
create index if not exists lessons_level_number_idx on public.lessons (level, number);

-- 2) جدول صور الدروس
create table if not exists public.lesson_images (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  path        text not null,              -- مسار الصورة داخل Storage
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists lesson_images_lesson_idx on public.lesson_images (lesson_id, position);

-- 3) الحماية: الجميع يقرأ ، الأستاذ (مسجّل الدخول) فقط يضيف ويحذف
alter table public.lessons       enable row level security;
alter table public.lesson_images enable row level security;

drop policy if exists "public read lessons" on public.lessons;
create policy "public read lessons" on public.lessons for select using (true);
drop policy if exists "admin write lessons" on public.lessons;
create policy "admin write lessons" on public.lessons for all
  to authenticated using (true) with check (true);

drop policy if exists "public read images" on public.lesson_images;
create policy "public read images" on public.lesson_images for select using (true);
drop policy if exists "admin write images" on public.lesson_images;
create policy "admin write images" on public.lesson_images for all
  to authenticated using (true) with check (true);

-- 4) مخزن الصور (Bucket عام للقراءة)
insert into storage.buckets (id, name, public)
values ('lesson-images', 'lesson-images', true)
on conflict (id) do update set public = true;

drop policy if exists "public read lesson-images" on storage.objects;
create policy "public read lesson-images" on storage.objects for select
  using (bucket_id = 'lesson-images');

drop policy if exists "admin upload lesson-images" on storage.objects;
create policy "admin upload lesson-images" on storage.objects for insert
  to authenticated with check (bucket_id = 'lesson-images');

drop policy if exists "admin delete lesson-images" on storage.objects;
create policy "admin delete lesson-images" on storage.objects for delete
  to authenticated using (bucket_id = 'lesson-images');
