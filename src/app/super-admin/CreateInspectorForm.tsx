"use client";

import { useState } from "react";
import { Copy, Loader2, ShieldPlus } from "lucide-react";

const DISTRICTS = ["الوادي 1", "الوادي 2", "قمار", "الرقيبة", "الدبيلة والمقرن"];

// إنشاء حساب مفتش مقاطعة (الخيار الموصى به في خطة المنصة)
export function CreateInspectorForm({ onCreated }: { onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [districtId, setDistrictId] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setCreated(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, districtId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر إنشاء الحساب");
      setCreated({ email: data.email, tempPassword: data.tempPassword });
      setFullName("");
      setEmail("");
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-3xl border border-indigo-100 shadow p-4 space-y-3">
      <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
        <ShieldPlus className="w-4 h-4 text-indigo-600" /> إنشاء حساب مفتش مقاطعة
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
          placeholder="الاسم الكامل للمفتش"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <input
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
          type="email"
          dir="ltr"
          placeholder="inspector@mail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white" value={districtId} onChange={(e) => setDistrictId(Number(e.target.value))}>
          {DISTRICTS.map((d, i) => (
            <option key={d} value={i + 1}>
              المقاطعة {i + 1} — {d}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-red-600 font-bold">{error}</p>}
      {created && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
          <p className="font-bold">✓ تم إنشاء الحساب. سلّم هذه البيانات للمفتش (تظهر مرة واحدة فقط):</p>
          <p className="font-mono" dir="ltr">
            {created.email} / {created.tempPassword}
          </p>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(`${created.email}\n${created.tempPassword}`).catch(() => {})}
            className="inline-flex items-center gap-1 text-emerald-700 font-bold"
          >
            <Copy className="w-3.5 h-3.5" /> نسخ
          </button>
          <p className="text-emerald-800">يطلب منه تغيير كلمة المرور من صفحة الإعدادات بعد أول دخول.</p>
        </div>
      )}
      <button
        disabled={busy}
        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} إنشاء الحساب
      </button>
    </form>
  );
}
