"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  Scale,
  Users,
  GraduationCap,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FolderCheck,
  ChevronDown,
} from "lucide-react";

export default function AnnouncementPage() {
  const [activeTab, setActiveTab] = useState<"all" | "supplies" | "reception">("all");

  return (
    <div className="pb-16 pt-3 fade-up space-y-5">
      {/* رأس الصفحة وزر الرجوع */}
      <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs">
        <Link
          href="/"
          className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 transition shrink-0"
          aria-label="الرجوع للرئيسية"
        >
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60 mb-0.5">
            <Sparkles className="w-3 h-3 text-emerald-600" /> دليل وتوجيهات رسمية
          </span>
          <h1 className="text-base font-extrabold text-slate-900 truncate">
            دليل التوجيهات التربوية وتنظيم الكراريس
          </h1>
          <p className="text-[11px] text-slate-500">
            الأستاذ محمد عدايكة — متوسطة المجاهد باهي علي
          </p>
        </div>
      </div>

      {/* شريط التبويبات السريعة للتنقل */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold items-center">
        {[
          { id: "all", label: "📋 الدليل كاملاً" },
          { id: "supplies", label: "📚 الكراريس والأدوات" },
          { id: "reception", label: "🤝 ساعة الاستقبال" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition shrink-0 ${
              activeTab === tab.id
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-100 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <Link
          href="/assessment"
          className="px-3.5 py-2 rounded-xl whitespace-nowrap bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition shrink-0 flex items-center gap-1.5 font-bold"
        >
          <span>⚖️ ميثاق التقويم (20/20)</span>
          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
        </Link>
      </div>

      {/* ==================== 2. قسم الأدوات وتنظيم الكراريس ==================== */}
      {(activeTab === "all" || activeTab === "supplies") && (
        <section className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800">الأدوات المدرسية وطريقة مسك وتنظيم الكراريس</h2>
              <p className="text-[11px] text-slate-400">تعليمات صارمة تضمن للتلميذ التفوق وحصد نقاط التقويم</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* كراس الدروس */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  كراس الدروس (192 صفحة)
                </span>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                  عليه 5 نقاط في التقويم
                </span>
              </div>
              <ul className="space-y-1.5 text-slate-600 pr-3 list-disc marker:text-emerald-500 text-[11px] leading-relaxed">
                <li><strong>تنظيم صارم وخط واضح:</strong> كراس منظم ومكتوب بطريقة صحيحة تُمكّن التلميذ من المراجعة الجيدة.</li>
                <li><strong>بداية كل مقطع تعليمي:</strong> نقوم بطي ورقة ونكتب فيها اسم المقطع التعليمي.</li>
                <li><strong>آخر 10 أوراق:</strong> تُخصص لحل الفروض والامتحانات السابقة وتصحيحها.</li>
                <li><strong className="text-red-600">تنبيه صارم في التقويم المستمر:</strong> لن يتم التهاون في الدروس الناقصة؛ فمثلاً إذا أنجزنا 20 درساً في الفصل وينقصك 3 دروس تنال (0 من 5) في نقطة الكراس!</li>
              </ul>
            </div>

            {/* كراس المحاولات */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                كراس المحاولات (96 صفحة)
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                مخصص للمحاولات الفردية داخل القسم، وحل الواجبات المنزلية في البيت. لا يُشترط كتابة التاريخ وإن كان أفضل، لكن <strong>الأهم هو بذل الجهد والمحاولة المستمرة في كل تمرين</strong>.
              </p>
            </div>

            {/* كراس الأعمال الموجهة */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                كراس الأعمال الموجهة (96 صفحة)
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                يُستعمل <strong>حصراً في حصص التفويج (نصف القسم)</strong> لحل سلاسل التمارين التطبيقية. يجب أن يكون منظماً جداً لأنه يمثل مرجعاً أساسياً ومكثفاً لمراجعة الاختبارات.
              </p>
            </div>

            {/* قاعدة الكتاب المدرسي واللوازم الهندسية */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
              <div className="font-extrabold text-amber-900 text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                قاعدة الكتاب المدرسي والأدوات الهندسية
              </div>
              <div className="text-amber-800 text-[11px] space-y-1 leading-relaxed">
                <p>
                  📖 <strong>كتاب الرياضيات:</strong> لتخفيف ثقل الحقيبة، يُكتفى بـ <strong>كتاب واحد مشترك لكل طاولة</strong> (تلميذين). لكن عدم وجود أي كتاب على الطاولة يعني إنقاص علامة لكلا التلميذين!
                </p>
                <p>
                  📐 <strong>اللوازم الضرورية دائماً:</strong> السيالة، المسطرة، والأدوات الهندسية كاملة (الكوس، نصف الدائرة، المدور).
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ==================== 3. بطاقة ميثاق التقويم (موجزة مع رابط مباشر للحاسبة) ==================== */}
      <section className="bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50/50 rounded-3xl p-5 border border-teal-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">ميثاق ومعايير التقويم المستمر (20 / 20)</h2>
              <p className="text-[11px] text-teal-800 font-bold">العدل والشفافية التامة — لا زيادة ولا إنقاص</p>
            </div>
          </div>
          <Link
            href="/assessment"
            className="shrink-0 px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-black hover:bg-teal-700 active:scale-95 transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <span>عرض الميثاق وحاسبة العلامة</span>
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </Link>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed font-medium">
          توزيع دقيق للـ 20 نقطة: الكراريس (5ن) • الواجبات المنزلية (5ن) • السلوك والأدوات (5ن) • النشاط داخل القسم (5ن).
          تم تخصيص صفحة مستقلة تفاعلية بحاسبة تقديرية تتيح لكل تلميذ وولي أمر معرفة تفاصيل التنقيط بكل وضوح دون أي إبهام.
        </p>
      </section>

      {/* ==================== 4. قسم استقبال الأولياء ==================== */}
      {(activeTab === "all" || activeTab === "reception") && (
        <section className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800">ساعة استقبال أولياء الأمور</h2>
              <p className="text-[11px] text-slate-400">التواصل المستمر لصالح التلميذ من بداية السنة</p>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2.5 text-xs">
            <div className="flex items-center gap-2 text-emerald-800 font-extrabold">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>الموعد: كل يوم أربعاء من 10:00 إلى 11:00 صباحاً</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              <strong>رسالة من القلب لأولياء الأمور:</strong> أرحب بكم بكل سرور في ساعة الاستقبال للاطمئنان على مستوى أبنائكم. نرجو أن يكون الحرص من بداية السنة (تفقد الكراس، التأكد من حل الواجبات، متابعة الانضباط)، وليس فقط الحضور بعد إعلان كشوف النقاط للمطالبة بزيادة العلامات؛ فالتنقيط أمانة وعدل لا محاباة فيه.
            </p>
          </div>
        </section>
      )}

      {/* ==================== 5. نبذة عن الأستاذ والمنصة ==================== */}
      <section className="bg-slate-900 text-white rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xs font-black">نبذة عن الأستاذ في مجال التعليم</h3>
            <p className="text-[10px] text-slate-400">محمد عدايكة — باحث وأستاذ مادة الرياضيات</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          • طالب دكتوراه (سنة 4) بجامعة برج بوعريرج.<br />
          • من مؤسسي منصة <strong>تعلم بلس</strong> لتطوير التعليم رقمياً، وتطبيقات تعليمية متوفرة على متجر Google Play.<br />
          • تم تطوير هذا الموقع الخاص بالدروس لمساعدة التلاميذ على تدارك أي درس غابوا عنه، لكن تبقى الكتابة الحية في القسم هي الأساس الإلزامي.
        </p>
      </section>

      {/* زر العودة للدروس */}
      <div className="text-center pt-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 active:scale-95 transition shadow-sm"
        >
          <span>العودة لاختيار السنة الدراسية والدروس</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </Link>
      </div>
    </div>
  );
}
