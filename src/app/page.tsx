import Link from "next/link";
import {
  GraduationCap,
  ShieldCheck,
  Search,
  Building2,
  Users,
  MapPin,
  Sparkles,
  ArrowLeft,
  BookOpen,
  ChevronLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import TeacherWallet from "@/components/TeacherWallet";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DISTRICTS = [
  { id: 1, name: "المقاطعة الأولى", zone: "الوادي 1", desc: "متوسطات وسط مدينة الوادي والبلديات المجاورة" },
  { id: 2, name: "المقاطعة الثانية", zone: "الوادي 2", desc: "متوسطات جنوب وشرق الولاية" },
  { id: 3, name: "المقاطعة الثالثة", zone: "قمار", desc: "متوسطات دائرة قمار والبلديات التابعة لها" },
  { id: 4, name: "المقاطعة الرابعة", zone: "الرقيبة", desc: "متوسطات دائرة الرقيبة والبلديات التابعة لها" },
  { id: 5, name: "المقاطعة الخامسة", zone: "الدبيلة والمقرن", desc: "متوسطات دوائر الدبيلة والمقرن وحاسي خليفة" },
];

export default async function WilayaHomePage() {
  // جلب عدد الأساتذة المسجلين في الولاية
  const { count: teacherCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "teacher");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16" dir="rtl">
      {/* 1. الترويسة الرئيسية والترحيب */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-emerald-900 text-white pt-10 pb-16 px-4 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
        {/* شارة الولاية */}
        <div className="max-w-4xl mx-auto text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-400/20 px-3.5 py-1.5 rounded-full text-emerald-300 text-xs font-bold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>مديرية التربية لولاية الوادي • مادة الرياضيات (التعليم المتوسط)</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            المنصة الرقمية الموحدة لمادة الرياضيات
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            الفضاء التعليمي والبيداغوجي المشترك لأساتذة ومفتشي التعليم المتوسط، ونافذة الأولياء والتلاميذ لمتابعة دروس وسبورة المادة عبر كافة مقاطعات ولاية الوادي.
          </p>

          {/* أزرار الدخول السريع للأساتذة والمفتشين */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              دخول الأستاذ / المفتش
            </Link>
            <Link
              href="/register"
              className="py-2.5 px-5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold text-xs backdrop-blur-sm transition flex items-center gap-2 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              انضمام أستاذ جديد
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-8 space-y-8 relative z-20">
        {/* 2. بطاقة البحث السريع للأولياء والتلاميذ */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/60 space-y-4">
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
            <Search className="w-5 h-5 text-emerald-600" />
            <h3>فضاء الولي والتلميذ: البحث عن أستاذك</h3>
          </div>
          <p className="text-xs text-slate-500">
            أدخل كود الأستاذ المكتوب في الكراس (مثال: MTH-102) أو اسمه للانتقال مباشرة لدروسه وسبورته:
          </p>

          <form action="/t/search" method="GET" className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                name="q"
                placeholder="اكتب كود الأستاذ أو اسمه..."
                className="w-full pl-3 pr-10 py-3 rounded-2xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            </div>
            <button
              type="submit"
              className="py-3 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer shrink-0"
            >
              عرض الدروس
            </button>
          </form>

          {/* فضاء الأستاذ المؤسس كنموذج رائد */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">النموذج المعتمد:</span>
            <Link
              href="/year/1"
              className="text-emerald-700 font-bold hover:underline flex items-center gap-1"
            >
              <span>فضاء الأستاذ محمد عدايكة (متوسطة المجاهد باهي علي)</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* محفظة الولي — تظهر فقط إذا كان للولي معلمون محفوظون */}
        <TeacherWallet />

        {/* 3. مقاطعات ولاية الوادي التفتيشية الخمس */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              المقاطعات التفتيشية لمادة الرياضيات (ولاية الوادي)
            </h3>
            <span className="text-xs text-slate-400 font-bold">5 مقاطعات</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {DISTRICTS.map((d) => (
              <div
                key={d.id}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                    {d.name}
                  </span>
                  <span className="text-xs font-bold text-slate-600">{d.zone}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{d.desc}</p>
                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>التعليم المتوسط</span>
                  <Link
                    href={`/register?district=${d.id}`}
                    className="text-emerald-600 group-hover:underline font-bold"
                  >
                    تسجيل أستاذ بالمقاطعة ←
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. مميزات المنصة للمعلمين والأولياء */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-3xl p-6 border border-emerald-100 space-y-4">
          <h3 className="font-black text-emerald-950 text-sm">
            لماذا هذه المنصة لأساتذة ومفتشي ولاية الوادي؟
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-700">
            <div className="space-y-1">
              <p className="font-bold text-emerald-800">🔒 خصوصية مطلقة</p>
              <p className="text-slate-500 text-[11px]">
                عزل كامل بين وثائق ومذكرات الأستاذ والمفتش وبين ما ينشر للأولياء والتلاميذ.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-emerald-800">📸 جودة وسرعة السبورة</p>
              <p className="text-slate-500 text-[11px]">
                ضغط فائق للصور وترتيب دقيق لسبورة الدروس بدون انقطاع للتلاميذ من الهاتف.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-emerald-800">📢 تواصل بيداغوجي مباشر</p>
              <p className="text-slate-500 text-[11px]">
                استلام فوري لمناشير وتوجيهات مفتش المقاطعة ومتابعة التدرج السنوي بانتظام.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
