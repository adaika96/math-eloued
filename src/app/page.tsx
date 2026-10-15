import Link from "next/link";
import {
  ChevronLeft,
  Calendar,
  Clock,
  Megaphone,
  Users,
  BookOpen,
  Trophy,
  Scale,
  MessageSquare,
  Lock,
} from "lucide-react";
import { getLessonsData } from "@/lib/storage";
import HomeAnnouncements from "@/components/HomeAnnouncements";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const years = [
  {
    level: 1,
    title: "السنة الأولى متوسط",
    subtitle: "دروس مصورة • حلول الواجبات • الأنشطة والتمارين",
    tag: "1م",
    gradient: "from-emerald-600 to-teal-700",
    shadow: "shadow-emerald-600/15",
  },
  {
    level: 2,
    title: "السنة الثانية متوسط",
    subtitle: "دروس مصورة • حلول الواجبات • الأنشطة والتمارين",
    tag: "2م",
    gradient: "from-teal-600 to-cyan-700",
    shadow: "shadow-teal-600/15",
  },
];

export default async function Home() {
  const data = await getLessonsData();
  const announcements = data.announcements || [];

  return (
    <div className="pt-5 pb-12 fade-up space-y-4">
      {/* رأس الصفحة */}
      <div className="text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center text-2xl font-extrabold shadow-md shadow-emerald-600/20">
          ∑
        </div>
        <h1 className="mt-3 text-xl font-black text-slate-800 tracking-tight">
          دروس مادة الرياضيات
        </h1>
        <p className="mt-0.5 text-xs font-bold text-emerald-700">
          الأستاذ محمد عدايكة — متوسطة المجاهد باهي علي
        </p>
      </div>

      {/* خانة الإعلانات والتنبيهات المباشرة (غياب، تحديثات، دروس جديدة...) */}
      <HomeAnnouncements announcements={announcements} />

      {/* 1. الأساس: الدروس المصورة للسبورة (أول ما يراه التلميذ) */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
            <span>اختر سنتك الدراسية لعرض الدروس:</span>
          </span>
          <span className="text-[11px] text-slate-400 font-bold">1 متوسط • 2 متوسط</span>
        </div>

        <div className="space-y-2.5">
          {years.map((y) => (
            <Link
              key={y.level}
              href={`/year/${y.level}`}
              className="flex items-center gap-3.5 bg-white rounded-2xl p-4 shadow-2xs border border-slate-100 active:scale-[0.98] transition hover:border-emerald-200 group"
            >
              <div
                className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${y.gradient} text-white flex items-center justify-center text-lg font-black shadow-sm ${y.shadow} shrink-0 group-hover:scale-105 transition-transform`}
              >
                {y.tag}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black text-slate-900">{y.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-medium">{y.subtitle}</div>
              </div>
              <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-emerald-700 group-hover:bg-emerald-50 transition shrink-0">
                <ChevronLeft className="w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 2. خانة: أولياء أود استقبالهم (ظاهرة وسهلة الوصول - لصالح أبنائكم) */}
      <div className="pt-1">
        <Link
          href="/parents"
          className="flex items-center gap-3.5 bg-gradient-to-r from-sky-500/15 via-blue-500/10 to-emerald-500/10 rounded-2xl p-4 border-2 border-sky-300/80 shadow-xs hover:border-sky-400 hover:shadow-sm active:scale-[0.98] transition group"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-600 to-blue-700 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-600/25 group-hover:scale-105 transition-transform">
            <Users className="w-6 h-6 text-sky-100" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-slate-900">أولياء أود استقبالهم</span>
              <span className="text-[10px] bg-sky-100 text-sky-800 font-black px-2 py-0.5 rounded-md border border-sky-200">
                لصالح أبنائكم 🤝
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 line-clamp-1 font-semibold">
              أود التحدث معكم للتشاور ولمصلحة أبنائكم • المواعيد وقائمة التلاميذ
            </p>
          </div>
          <ChevronLeft className="w-5 h-5 text-sky-600 group-hover:text-sky-800 transition shrink-0" />
        </Link>
      </div>

      {/* 3. لوحة الشرف (تحفيزية وتنافسية شريفة للتلاميذ والأولياء) */}
      <div>
        <Link
          href="/honor"
          className="flex items-center gap-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-emerald-500/10 rounded-2xl p-3.5 border border-amber-200/80 shadow-2xs hover:border-amber-300 hover:shadow-xs active:scale-[0.98] transition group"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Trophy className="w-5 h-5 text-amber-100" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs text-slate-900">لوحة الشرف | نجوم الرياضيات</span>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.2 rounded">تميز 🏆</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1 font-medium">
              أفضل التلاميذ انضباطاً وإتقاناً في أقسامنا (1م1، 1م2، 1م3، 2م3)
            </p>
          </div>
          <ChevronLeft className="w-4 h-4 text-amber-600 group-hover:text-amber-800 transition shrink-0" />
        </Link>
      </div>

      {/* 4. صندوق الصراحة والشفافية (رسائل سرية ومجهولة للأستاذ) */}
      <div>
        <Link
          href="/messages"
          className="flex items-center gap-3.5 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-pink-500/10 rounded-2xl p-3.5 border border-purple-200/80 shadow-2xs hover:border-purple-300 hover:shadow-xs active:scale-[0.98] transition group"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm shadow-purple-600/20 group-hover:scale-105 transition-transform">
            <MessageSquare className="w-5 h-5 text-purple-100" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs text-slate-900">صندوق الصراحة والشفافية</span>
              <span className="text-[10px] bg-purple-100 text-purple-800 font-black px-1.5 py-0.2 rounded border border-purple-200">
                سري 100% 🔒
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1 font-medium">
              اطرح سؤالاً عن درس، قدّم اقتراحاً، أو اكتب ملاحظة صريحة للأستاذ دون كشف هويتك
            </p>
          </div>
          <ChevronLeft className="w-4 h-4 text-purple-600 group-hover:text-purple-800 transition shrink-0" />
        </Link>
      </div>

      {/* 5. قسم التوجيهات والإعلانات الهامة */}
      <div className="pt-2 space-y-2">
        <div className="text-xs font-bold text-slate-600 px-1">توجيهات وإعلانات هامة:</div>

        {/* بطاقة ميثاق التقويم المستمر (20/20) */}
        <Link
          href="/assessment"
          className="flex items-center gap-3 bg-white rounded-2xl p-3.5 border border-slate-100 shadow-2xs hover:border-emerald-200 active:scale-[0.98] transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs text-slate-900">ميثاق ومعايير التقويم المستمر (20/20)</span>
              <span className="text-[10px] bg-teal-50 text-teal-800 font-bold px-1.5 py-0.2 rounded">شفافية ⚖️</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
              توزيع الـ 20 نقطة: الكراريس 5ن • الواجبات 5ن • السلوك 5ن • النشاط 5ن + حاسبة العلامة
            </p>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition shrink-0" />
        </Link>

        {/* بطاقة التوجيهات التربوية وتنظيم الكراريس */}
        <Link
          href="/announcement"
          className="flex items-center gap-3 bg-white rounded-2xl p-3.5 border border-slate-100 shadow-2xs hover:border-slate-200 active:scale-[0.98] transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs text-slate-900">دليل تنظيم الكراريس والتوجيهات التربوية</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.2 rounded">دليل 📚</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
              تنظيم كراس الدروس والأعمال الموجهة • الأدوات المدرسية • ساعة الاستقبال الأسبوعية
            </p>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition shrink-0" />
        </Link>
      </div>
    </div>
  );
}
