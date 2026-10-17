import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const SUPABASE_URL = supabaseUrl || "https://placeholder.supabase.co";
export const SUPABASE_ANON_KEY = supabaseAnonKey || "placeholder-anon-key";

// في المتصفح: عميل يحفظ الجلسة في الكوكيز (لتصل إلى نقاط النهاية /api على الخادم)
// على الخادم (صفحات عامة): عميل مجهول للقراءة العامة فقط
export const supabase =
  typeof window === "undefined"
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// أسماء مخازن الملفات السحابية
export const BUCKETS = {
  PUBLIC_LESSONS: "public-lesson-media",
  PRIVATE_NOTES: "private-pedagogical-notes",
  INSPECTOR_DOCS: "private-inspector-docs",
} as const;

// رابط علني سريع لصور السبورة وملفات الدروس والواجبات الموجهة للتلاميذ والأولياء
export function getPublicMediaUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return supabase.storage.from(BUCKETS.PUBLIC_LESSONS).getPublicUrl(path).data.publicUrl;
}

// رابط مشفر ومؤقت (15 دقيقة) للملفات الخاصة بين الأستاذ والمفتش فقط
export async function getPrivateSignedUrl(
  bucket: (typeof BUCKETS)["PRIVATE_NOTES"] | (typeof BUCKETS)["INSPECTOR_DOCS"],
  path: string,
  expiresInSeconds = 900
) {
  if (!path) return "";
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("Error creating signed URL:", error);
    return "";
  }
  return data.signedUrl;
}

export async function getPrivateNoteSignedUrl(path: string, expiresInSeconds = 900) {
  return getPrivateSignedUrl(BUCKETS.PRIVATE_NOTES, path, expiresInSeconds);
}
