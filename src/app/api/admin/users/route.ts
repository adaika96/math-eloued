import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSessionProfile } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const { user, profile } = await getSessionProfile();
  return user && profile?.role === "admin" ? user : null;
}

const NOT_CONFIGURED = NextResponse.json(
  { error: "إنشاء وحذف الحسابات يتطلب ضبط SUPABASE_SERVICE_ROLE_KEY على الخادم" },
  { status: 503 }
);

// إنشاء حساب مفتش مقاطعة مباشرة (بكلمة مرور مؤقتة يسلمها المشرف للمفتش)
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NOT_CONFIGURED;

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.fullName || "").trim();
  const districtId = Number(body.districtId);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName || !(districtId >= 1 && districtId <= 5)) {
    return NextResponse.json({ error: "البريد والاسم والمقاطعة (1-5) مطلوبة" }, { status: 400 });
  }

  const tempPassword = `Insp-${randomBytes(6).toString("base64url")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, district_id: districtId },
  });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message || "تعذر إنشاء الحساب" }, { status: 400 });
  }

  // المحفز ينشئ ملف "أستاذ"؛ نرقيه إلى مفتش بصلاحيات الخدمة
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: "inspector", district_id: districtId, is_verified: true })
    .eq("id", data.user.id);
  if (roleError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId: data.user.id, email, tempPassword });
}

// حذف حساب نهائياً (المصادقة + الملف + بياناته المرتبطة)
export async function DELETE(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NOT_CONFIGURED;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "معرّف الحساب مطلوب" }, { status: 400 });
  if (id === me.id) return NextResponse.json({ error: "لا يمكنك حذف حسابك الخاص" }, { status: 400 });

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
