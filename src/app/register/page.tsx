"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  GraduationCap,
  Mail,
  Lock,
  User,
  Phone,
  Building2,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

const DISTRICTS = [
  { id: 1, name: "المقاطعة الأولى — الوادي 1" },
  { id: 2, name: "المقاطعة الثانية — الوادي 2" },
  { id: 3, name: "المقاطعة الثالثة — قمار" },
  { id: 4, name: "المقاطعة الرابعة — الرقيبة" },
  { id: 5, name: "المقاطعة الخامسة — الدبيلة والمقرن" },
];

export default function RegisterTeacherPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [districtId, setDistrictId] = useState("1");
  const [middleSchoolName, setMiddleSchoolName] = useState("");
  const [middleSchoolId, setMiddleSchoolId] = useState("");
  const [schools, setSchools] = useState<{ id: string; name: string; commune: string }[]>([]);

  // المقاطعة المختارة من بطاقة الصفحة الرئيسية (?district=)
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("district");
    if (d && ["1", "2", "3", "4", "5"].includes(d)) setDistrictId(d);
  }, []);

  // متوسطات المقاطعة المعتمدة (يضيفها المشرف العام)
  useEffect(() => {
    setMiddleSchoolId("");
    supabase
      .from("middle_schools")
      .select("id, name, commune")
      .eq("district_id", Number(districtId))
      .order("name")
      .then(({ data }) => setSchools(data || []));
  }, [districtId]);
  const [selectedLevels, setSelectedLevels] = useState<number[]>([1, 2]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const toggleLevel = (lvl: number) => {
    setSelectedLevels((prev) =>
      prev.includes(lvl) ? prev.filter((l) => l !== lvl) : [...prev, lvl].sort()
    );
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (selectedLevels.length === 0) {
      setErrorMsg("يرجى تحديد مستوى دراسي واحد على الأقل تدرسه هذا العام");
      return;
    }

    setLoading(true);

    try {
      // توليد كود ورابط فريد للأستاذ (أحرف لاتينية فقط لروابط نظيفة؛ القاعدة تعالج أي تكرار)
      const randomCode = "MTH-" + Math.floor(1000 + Math.random() * 9000);
      const cleanSlug = "prof-" + Math.random().toString(36).substring(2, 8);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            role: "teacher",
            full_name: fullName.trim(),
            phone: phone.trim(),
            district_id: Number(districtId),
            middle_school_id: middleSchoolId || "",
            school_custom_name: middleSchoolId
              ? schools.find((s) => s.id === middleSchoolId)?.name || middleSchoolName.trim()
              : middleSchoolName.trim(),
            teacher_code: randomCode,
            slug: cleanSlug,
            levels_taught: selectedLevels,
          },
        },
      });

      if (error) {
        throw error;
      }

      // إن كان تأكيد البريد مفعلاً فلا توجد جلسة بعد: نطلب من الأستاذ تأكيد بريده أولاً
      if (!data.session) {
        setNeedsConfirmation(true);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/admin");
      }, 1500);
    } catch (err: any) {
      console.error("Registration error:", err);
      setErrorMsg(err.message || "فشل إنشاء الحساب، يرجى المحاولة مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 sm:px-6 lg:px-8 font-sans" dir="rtl">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20 mb-4">
          <GraduationCap className="w-9 h-9" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
          انضمام أستاذ جديد — ولاية الوادي
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          أنشئ مساحتك التعليمية الخاصة لمشاركة الدروس والسبورة والتواصل مع مفتش مقاطعتك
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-100 sm:px-10">
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {needsConfirmation && (
            <div className="mb-5 p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-3 text-sky-800 text-sm">
              <Mail className="w-6 h-6 shrink-0 text-sky-600" />
              <div>
                <p className="font-bold">تم إنشاء حسابك! بقيت خطوة واحدة</p>
                <p className="text-xs text-sky-700 mt-0.5">افتح بريدك الإلكتروني واضغط على رابط التأكيد، ثم سجّل الدخول.</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm">
              <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-600" />
              <div>
                <p className="font-bold">تم إنشاء حسابك بنجاح!</p>
                <p className="text-xs text-emerald-700 mt-0.5">جاري توجيهك إلى لوحة التحكم الخاصة بك...</p>
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleRegister}>
            {/* الاسم الكامل */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                الاسم واللقب (كما يظهر للتلاميذ والمفتش) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: الأستاذ محمد عدايكة"
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition"
                />
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>

            {/* البريد وكلمة المرور */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  البريد الإلكتروني <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@mail.com"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  كلمة المرور <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6 أحرف أو أكثر"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
              </div>
            </div>

            {/* المقاطعة التفتيشية */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                المقاطعة التفتيشية (ولاية الوادي) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition"
                >
                  {DISTRICTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* اسم المتوسطة ورقم الهاتف */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  اسم المتوسطة <span className="text-red-500">*</span>
                </label>
                {schools.length > 0 && (
                  <select
                    value={middleSchoolId}
                    onChange={(e) => setMiddleSchoolId(e.target.value)}
                    className="w-full mb-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">— متوسطتي غير موجودة في القائمة —</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.commune}
                      </option>
                    ))}
                  </select>
                )}
                <div className={`relative ${middleSchoolId ? "hidden" : ""}`}>
                  <input
                    type="text"
                    required={!middleSchoolId}
                    value={middleSchoolName}
                    onChange={(e) => setMiddleSchoolName(e.target.value)}
                    placeholder="متوسطة الشهيد..."
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition"
                  />
                  <Building2 className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  رقم الهاتف (اختياري)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06xxxxxxxx"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
              </div>
            </div>

            {/* المستويات المسندة للأستاذ */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                السنوات المسندة لك هذا العام: <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { lvl: 1, label: "1 متوسط" },
                  { lvl: 2, label: "2 متوسط" },
                  { lvl: 3, label: "3 متوسط" },
                  { lvl: 4, label: "4 متوسط" },
                ].map((item) => {
                  const active = selectedLevels.includes(item.lvl);
                  return (
                    <button
                      key={item.lvl}
                      type="button"
                      onClick={() => toggleLevel(item.lvl)}
                      className={`py-2 px-3 rounded-xl border text-sm font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        active
                          ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || success}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium text-sm shadow-md shadow-emerald-600/25 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري إنشاء الحساب والمساحة الخاصة...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    إنشاء حساب أستاذ وتفعيل صفحتي
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center space-y-3">
            <p className="text-sm text-slate-600">
              لديك حساب بالفعل؟{" "}
              <Link href="/login" className="text-emerald-600 font-semibold hover:underline">
                تسجيل الدخول
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
