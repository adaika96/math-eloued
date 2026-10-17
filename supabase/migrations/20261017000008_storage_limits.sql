-- ====================================================================
-- حدود مخازن الملفات: صور و PDF فقط، وبحد أقصى 10 ميغابايت للملف
-- (حماية إضافية للرفع المباشر من المتصفح إلى Supabase Storage)
-- ====================================================================

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
WHERE id IN ('public-lesson-media', 'private-pedagogical-notes', 'private-inspector-docs');
