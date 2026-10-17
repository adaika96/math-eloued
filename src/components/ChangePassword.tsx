"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

// تغيير كلمة المرور (مهم للمفتشين الذين أنشأ المشرف حساباتهم بكلمة مؤقتة)
export function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setMessage({ type: "err", text: "8 أحرف على الأقل" });
    if (password !== confirm) return setMessage({ type: "err", text: "كلمتا المرور غير متطابقتين" });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage({ type: "err", text: error.message });
    else {
      setPassword("");
      setConfirm("");
      setMessage({ type: "ok", text: "✓ تم تغيير كلمة المرور" });
    }
  };

  return (
    <form onSubmit={submit} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-2">
      <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-slate-500" /> تغيير كلمة المرور
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="password"
          autoComplete="new-password"
          className="py-2 px-3 rounded-xl border border-slate-200 text-xs"
          placeholder="كلمة المرور الجديدة"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          type="password"
          autoComplete="new-password"
          className="py-2 px-3 rounded-xl border border-slate-200 text-xs"
          placeholder="تأكيد كلمة المرور"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {message && <p className={`text-xs font-bold ${message.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
      <button disabled={busy || !password} className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} تحديث
      </button>
    </form>
  );
}
