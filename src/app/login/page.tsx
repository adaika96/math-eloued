"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Lock, Mail, Loader2, AlertCircle, ArrowLeft, GraduationCap, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("لم يتم العثور على بيانات المستخدم");
      }

      // جلب الملف الشخصي لمعرفة الدور (أستاذ أو مفتش)
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role, full_name, district_id")
        .eq("id", data.user.id)
        .single();

      if (profileErr || !profile) {
        throw new Error("تعذر تحميل ملف الحساب، يرجى المحاولة مرة أخرى");
      }

      // توجيه ذكي حسب الدور، مع احترام صفحة الوجهة ?next= لحسابات الأساتذة
      const next = new URLSearchParams(window.location.search).get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

      if (profile.role === "admin") {
        router.push("/super-admin");
      } else if (profile.role === "inspector") {
        router.push("/inspector");
      } else {
        router.push(safeNext || "/admin");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setErrorMsg(
        err.message === "Invalid login credentials"
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
          : err.message || "حدث خطأ أثناء تسجيل الدخول"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans" dir="rtl">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20 mb-4">
          <GraduationCap className="w-9 h-9" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
          منصة رياضيات ولاية الوادي
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          تسجيل الدخول الموحد للأساتذة والمفتشين
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-100 sm:px-10">
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@mail.com"
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-md shadow-emerald-600/25 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  دخول إلى الفضاء التعليمي
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center space-y-3">
            <p className="text-sm text-slate-600">
              أستاذ جديد في ولاية الوادي؟{" "}
              <Link href="/register" className="text-emerald-600 font-semibold hover:underline">
                إنشاء حساب أستاذ جديد
              </Link>
            </p>

            <div>
              <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition">
                <ArrowLeft className="w-3.5 h-3.5" />
                العودة للصفحة الرئيسية
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
