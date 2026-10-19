// نص عربي لكل عملية في admin_audit_log (المحفزات في 20261019000001 وواجهة /api/admin/users)
const ROLE: Record<string, string> = { teacher: "أستاذ", inspector: "مفتش", admin: "مشرف" };

type Details = Record<string, unknown>;
const withTarget = (label: string, value: unknown) => (value ? `${label}: ${value}` : label);

const LABELS: Record<string, (d: Details) => string> = {
  role_changed: (d) => `تغيير الدور: ${ROLE[String(d.from)] ?? d.from} ← ${ROLE[String(d.to)] ?? d.to}`,
  district_changed: (d) => `نقل إلى المقاطعة ${d.to ?? "—"}`,
  account_suspended: () => "تعليق حساب",
  account_reactivated: () => "تفعيل حساب",
  school_added: (d) => withTarget("إضافة متوسطة", d.name),
  school_updated: (d) => withTarget("تعديل متوسطة", d.name),
  school_deleted: (d) => withTarget("حذف متوسطة", d.name),
  wilaya_circular_published: (d) => withTarget("نشر منشور ولائي", d.title),
  wilaya_circular_deleted: (d) => withTarget("حذف منشور ولائي", d.title),
  inspector_created: () => "إنشاء حساب مفتش",
  user_deleted: () => "حذف حساب نهائياً",
};

export const AUDIT_ACTIONS = Object.keys(LABELS);

export function auditLabel(row: { action: string; details: Details | null }): string {
  const label = LABELS[row.action];
  return label ? label(row.details ?? {}) : row.action;
}
