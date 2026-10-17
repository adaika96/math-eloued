import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./supabase";

// عميل بصلاحيات الخدمة (service_role) — على الخادم فقط، لإنشاء وحذف حسابات المصادقة
// يتطلب متغير البيئة SUPABASE_SERVICE_ROLE_KEY (لا يُضاف أبداً بالبادئة NEXT_PUBLIC_)
export function getSupabaseAdmin(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
