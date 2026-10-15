import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

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

// رابط مشفر ومؤقت (15 دقيقة) للمذكرات التربوية بين الأستاذ والمفتش فقط
export async function getPrivateNoteSignedUrl(path: string, expiresInSeconds = 900) {
  if (!path) return "";
  const { data, error } = await supabase.storage
    .from(BUCKETS.PRIVATE_NOTES)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("Error creating signed URL for pedagogical note:", error);
    return "";
  }
  return data.signedUrl;
}
