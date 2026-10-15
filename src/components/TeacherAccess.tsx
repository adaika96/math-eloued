"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Sparkles, ExternalLink, X, ClipboardCheck, Settings, CheckCircle2 } from "lucide-react";

export function TeacherAccess() {
  const [isOpen, setIsOpen] = useState(false);
  const [typedCode, setTypedCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // 1. مراقبة الكتابة السرية في أي مكان بالصفحة (لو كتب adaika2026 يفتح فوراً)
  useEffect(() => {
    let buffer = "";
    const handleKeyDown = (e: KeyboardEvent) => {
      // تجاهل إذا كان يكتب داخل حقل إدخال عادي
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      buffer += e.key.toLowerCase();
      if (buffer.length > 20) buffer = buffer.slice(-20);

      if (buffer.includes("adaika2026")) {
        buffer = "";
        doAuth("adaika2026");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 2. فحص الرابط المباشر (مثل ?code=adaika2026)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code && code.toLowerCase() === "adaika2026") {
        doAuth("adaika2026");
      }
    }
  }, []);

  const doAuth = async (pass: string) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pass }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setIsOpen(true);
      } else {
        setErrorMsg(data.error || "الرمز غير صحيح");
      }
    } catch {
      setErrorMsg("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    doAuth(inputCode.trim());
  };

  return (
    <>
      {/* زر سري أنيق وغير مزعج في أسفل الصفحة */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-3 left-3 z-40 p-2.5 rounded-full bg-white/90 hover:bg-emerald-50 text-slate-400 hover:text-emerald-700 border border-slate-200/80 shadow-xs backdrop-blur-xs transition group"
        title="دخول خاص بالأستاذ (adaika2026)"
        aria-label="دخول الأستاذ"
      >
        <Lock className="w-4 h-4 group-hover:scale-110 transition-transform" />
      </button>

      {/* النافذة المنبثقة لمنطقة الأستاذ */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 fade-up">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">بوابة الأستاذ محمد عدايكة</h3>
                  <p className="text-[10px] text-slate-400">لوحة الإدارة والتقييم الميداني</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isAuthenticated ? (
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  أدخل الرمز السري الخاص بك للمتابعة مباشرة إلى أدوات الأستاذ:
                </p>
                <input
                  type="password"
                  className="w-full text-center py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="رمز الدخول (adaika2026)"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  dir="ltr"
                  autoFocus
                />
                {errorMsg && <p className="text-xs text-center text-red-600 font-bold">{errorMsg}</p>}

                <button
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition shadow-sm"
                >
                  {loading ? "جاري التحقق..." : "دخول مباشر"}
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>تم تسجيل الدخول بنجاح! اختر وجهتك:</span>
                </div>

                {/* خيار 1: دفتر التقييم الميداني السريع للهاتف */}
                <Link
                  href="/eval"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white hover:opacity-95 transition shadow-sm group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg font-black shrink-0">
                    ⚡
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black flex items-center gap-1.5">
                      <span>دفتر التقييم الميداني السريع</span>
                      <span className="bg-amber-400 text-slate-900 px-1.5 py-0.2 rounded text-[9px] font-black">
                        للهاتف 📱
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-100 mt-0.5 line-clamp-1">
                      تفقد الكراريس والواجبات والمعدلات التلقائية
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-emerald-200 group-hover:text-white transition" />
                </Link>

                {/* خيار 2: لوحة التحكم الكاملة */}
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Settings className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black">لوحة التحكم الكاملة</div>
                    <p className="text-[10px] text-slate-300 mt-0.5 line-clamp-1">
                      رفع الدروس وصور السبورة وحلول الواجبات والخصومات
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-white transition" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
