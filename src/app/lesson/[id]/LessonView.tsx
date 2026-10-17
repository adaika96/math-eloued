"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Download,
  X,
  Maximize2,
  ChevronRight,
  ChevronLeft,
  Image as ImageIcon,
  StickyNote,
  BookOpen,
  ArrowRight,
  FileText,
  ExternalLink,
  CheckCircle2,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { useTeacherId, withTeacher, teacherHomeHref } from "@/lib/teacherParam";
import { LEVELS, NOTEBOOKS, isPdfFile, type Lesson, type LessonImage } from "@/lib/types";
import { Loading, Empty } from "@/components/ui";

export function LessonView({ id }: { id: string }) {
  const teacherId = useTeacherId();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [viewMode, setViewMode] = useState<"lesson" | "homework">("lesson");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(withTeacher(`/api/lessons/${id}?_t=${Date.now()}`), { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.lesson) {
          setLesson(data.lesson);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const images = viewMode === "homework" ? lesson?.homeworkImages || [] : lesson?.images || [];
  const activeImage: LessonImage | null =
    selectedIndex !== null && images[selectedIndex] ? images[selectedIndex] : null;

  const nextImage = useCallback(() => {
    if (selectedIndex === null) return;
    if (selectedIndex < images.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  }, [selectedIndex, images.length]);

  const prevImage = useCallback(() => {
    if (selectedIndex === null) return;
    if (selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  }, [selectedIndex]);

  // دعم أزرار الكيبورد
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === "Escape") setSelectedIndex(null);
      if (e.key === "ArrowRight") prevImage();
      if (e.key === "ArrowLeft") nextImage();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndex, nextImage, prevImage]);

  const fileName = (i: number) =>
    `درس-${lesson?.number ?? ""}-صورة-${i + 1}.jpg`;

  const isDirectedWork = lesson?.type === "directed_work";
  const isWorksheet = lesson?.type === "worksheets";
  const isSummary = lesson?.type === "summaries";
  const hasHomeworkTab = !isSummary || (lesson?.homeworkImages && lesson.homeworkImages.length > 0);

  return (
    <div className="pb-16 pt-3 space-y-4 fade-up">
      {/* رأس الصفحة وزر الرجوع المخصص */}
      <div className="flex items-start gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
        <Link
          href={lesson ? withTeacher(`/year/${lesson.level}`, teacherId) : teacherHomeHref(teacherId)}
          className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 transition shrink-0 mt-0.5"
          aria-label="الرجوع"
        >
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div className="min-w-0 flex-1">
          {lesson ? (
            <div className="space-y-1">
              {/* شارات التعريف بالقسم والمستوى */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold">
                <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md">
                  {LEVELS[lesson.level].label}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md ${
                    isDirectedWork
                      ? "bg-sky-50 text-sky-800"
                      : isWorksheet
                      ? "bg-indigo-50 text-indigo-800"
                      : isSummary
                      ? "bg-amber-50 text-amber-800"
                      : "bg-teal-50 text-teal-800"
                  }`}
                >
                  {isDirectedWork
                    ? "📗 كراس الأعمال الموجهة"
                    : isWorksheet
                    ? "📑 سلسلة تمارين"
                    : isSummary
                    ? "📌 ملخص ومطوية"
                    : "📘 كراس الدروس"}
                </span>
              </div>

              {/* العنوان الكامل للدرس دون أي اقتطاع */}
              <h1 className="text-base font-black text-slate-900 leading-snug break-words pt-0.5">
                {lesson.title}
              </h1>

              {/* تفاصيل الميدان والمقطع للكراس العادي والسلاسل */}
              {!isDirectedWork && !isSummary && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-bold pt-0.5">
                  {lesson.field && (
                    <span className="flex items-center gap-1">
                      <span>📐 الميدان:</span>
                      <span className="text-slate-800 font-black">{lesson.field}</span>
                    </span>
                  )}
                  {lesson.section && (
                    <span className="flex items-center gap-1">
                      <span>• 📑</span>
                      <span className="text-slate-700">{lesson.section}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm font-bold text-slate-400">جاري تحميل البيانات...</div>
          )}
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : !lesson ? (
        <Empty text="العنصر غير موجود" />
      ) : (
        <div className="space-y-4">
          {/* شريط التبديل الواضح بين صور الدرس والحل النموذجي للواجب المنزلي */}
          {hasHomeworkTab ? (
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setViewMode("lesson");
                  setSelectedIndex(null);
                }}
                className={`py-3 px-2 sm:px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 sm:gap-2 ${
                  viewMode === "lesson"
                    ? "bg-white text-emerald-900 shadow-xs border border-emerald-300/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {isWorksheet
                    ? "صور السلسلة"
                    : isDirectedWork
                    ? "صور الحصة"
                    : "صور الدرس (السبورة)"}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    viewMode === "lesson"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {lesson.images?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode("homework");
                  setSelectedIndex(null);
                }}
                className={`py-3 px-2 sm:px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 sm:gap-2 ${
                  viewMode === "homework"
                    ? "bg-white text-blue-900 shadow-xs border border-blue-300/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{isWorksheet ? "الحل النموذجي للسلسلة" : "حل الواجب المنزلي"}</span>
                {lesson.homeworkImages && lesson.homeworkImages.length > 0 ? (
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-black">
                    {lesson.homeworkImages.length} صور
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">
                    قريباً ⏳
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-xs text-amber-900 font-bold flex items-center gap-2">
              <span>📌</span>
              <span>صور الملخص والمطوية ({lesson.images?.length || 0} صور):</span>
            </div>
          )}

          {/* صندوق ملاحظات وتوجيهات الأستاذ للدرس */}
          {viewMode === "lesson" && lesson.notes && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 text-amber-900 font-black text-xs">
                <StickyNote className="w-4 h-4 text-amber-600" />
                <span>ملاحظات وتوجيهات الأستاذ للتلاميذ:</span>
              </div>
              <p className="text-xs text-amber-950 font-medium whitespace-pre-line leading-relaxed pr-6">
                {lesson.notes}
              </p>
            </div>
          )}

          {/* مهلة الواجب وموعد نشر الحل النموذجي */}
          {viewMode === "homework" && (lesson.homeworkDueAt || lesson.solutionLocked) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 font-bold space-y-1">
              {lesson.homeworkDueAt && (
                <p>
                  ⏰ آخر أجل لإنجاز الواجب:{" "}
                  {new Date(lesson.homeworkDueAt).toLocaleString("ar-DZ", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              {lesson.solutionLocked && lesson.solutionPublishAt && (
                <p>
                  🔒 سيُنشر الحل النموذجي هنا تلقائياً يوم{" "}
                  {new Date(lesson.solutionPublishAt).toLocaleString("ar-DZ", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                  {" "}— حاول حل الواجب بنفسك أولاً!
                </p>
              )}
            </div>
          )}

          {/* صندوق توجيهات وملاحظات الواجب المنزلي إن وجدت */}
          {viewMode === "homework" && lesson.homeworkNotes && (
            <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-4 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 text-blue-950 font-black text-xs">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>تمارين وتفاصيل الواجب المنزلي:</span>
              </div>
              <p className="text-xs text-blue-950 font-bold whitespace-pre-line leading-relaxed pr-6">
                {lesson.homeworkNotes}
              </p>
            </div>
          )}

          {/* صور المعاينة */}
          {images.length === 0 ? (
            viewMode === "homework" ? (
              <div className="text-center py-12 px-4 bg-white rounded-3xl border-2 border-dashed border-blue-200 shadow-2xs space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-2xl">
                  📝
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-slate-800 text-sm">
                    الحل النموذجي للواجب المنزلي
                  </h3>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed font-semibold">
                    «سيقوم الأستاذ برفع الحل النموذجي المفصل هنا بعد مناقشته وتصحيحه في القسم مع التلاميذ، لتمكينكم من المراجعة والتصحيح الذاتي في كراس المحاولات (96 صفحة).»
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>تذكير: المحاولة الفردية في كراس المحاولات ضرورية قبل الاطلاع على الحل!</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
                <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-bold text-slate-700 text-sm">لا توجد صور لهذا الدرس حالياً</h3>
                <p className="text-xs text-slate-400 mt-1">
                  سيقوم الأستاذ برفع صور السبورة والملخصات قريباً.
                </p>
              </div>
            )
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                <span>
                  {viewMode === "homework"
                    ? `صور حل الواجب المنزلي (${images.length}):`
                    : `صور السبورة المرفوعة (${images.length}):`}
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  يمكنك الضغط على الصورة لتكبيرها بملء الشاشة
                </span>
              </div>

              {images.map((img, i) => {
                const isPdf = isPdfFile(img);

                if (isPdf) {
                  return (
                    <div
                      key={img.id}
                      className="bg-white rounded-2xl border border-red-200/90 shadow-sm overflow-hidden p-4 sm:p-5 space-y-3.5 fade-up"
                    >
                      {/* رأس بطاقة المستند */}
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex flex-col items-center justify-center shrink-0 shadow-md shadow-red-600/20">
                          <FileText className="w-6 h-6" />
                          <span className="text-[8px] font-black tracking-wider uppercase">PDF</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full border border-red-200/80">
                              مستند PDF رسمي 📄
                            </span>
                            <span className="text-[11px] text-slate-400 font-bold">
                              {viewMode === "homework" ? "حل الواجب / السلسلة" : "ملف التحميل"}
                            </span>
                          </div>
                          <h4 className="font-black text-sm text-slate-900 mt-1 break-words">
                            {img.name || (viewMode === "homework" ? "حل الواجب المنزلي (PDF)" : "ملف السلسلة / الدرس (PDF)")}
                          </h4>
                        </div>
                      </div>

                      {/* أزرار الفتح والتحميل المباشرة */}
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <a
                          href={img.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-sm"
                        >
                          <FileText className="w-4 h-4" />
                          <span>فتح وقراءة مستند PDF في صفحة كاملة</span>
                        </a>
                        <a
                          href={img.downloadUrl || img.url}
                          download={img.name || `مستند-${lesson?.number ?? ""}.pdf`}
                          className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-4 h-4 text-slate-600" />
                          <span>تحميل الملف</span>
                        </a>
                      </div>

                      {/* معاينة مدمجة للشاشات المتوسطة والكبيرة */}
                      <div className="hidden sm:block pt-1">
                        <iframe
                          src={`${img.url}#toolbar=0`}
                          title={img.name || "معاينة PDF"}
                          className="w-full h-[500px] rounded-xl border border-slate-200 bg-slate-50"
                        />
                      </div>
                    </div>
                  );
                }

                return (
                  <figure
                    key={img.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden fade-up"
                  >
                    {/* شريط رقم الصورة */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <span
                          className={`w-6 h-6 rounded-lg text-white flex items-center justify-center text-xs font-black ${
                            viewMode === "homework" ? "bg-blue-600" : "bg-emerald-600"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span>
                          {viewMode === "homework"
                            ? `حل الواجب • صورة رقم ${i + 1} من ${images.length}`
                            : `صورة رقم ${i + 1} من ${images.length}`}
                        </span>
                      </span>
                      <span className="text-[11px] text-slate-400">اضغط للتكبير</span>
                    </div>

                    {/* معاينة الصورة */}
                    <button
                      onClick={() => setSelectedIndex(i)}
                      className="block w-full text-center bg-slate-900/5 relative group cursor-zoom-in"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={
                          viewMode === "homework"
                            ? `حل الواجب صورة رقم ${i + 1}`
                            : `صورة السبورة رقم ${i + 1}`
                        }
                        loading="lazy"
                        className="w-full h-auto max-h-[550px] object-contain mx-auto transition-transform group-hover:scale-[1.01]"
                      />
                    </button>

                    {/* أزرار الإجراءات السريعة */}
                    <div className="flex gap-2 p-3 border-t border-slate-100 bg-white">
                      <button
                        onClick={() => setSelectedIndex(i)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold active:scale-95 transition"
                      >
                        <Maximize2
                          className={`w-4 h-4 ${
                            viewMode === "homework" ? "text-blue-600" : "text-emerald-600"
                          }`}
                        />
                        <span>تكبير بملء الشاشة</span>
                      </button>
                      <a
                        href={img.downloadUrl || img.url}
                        download={
                          viewMode === "homework"
                            ? `حل-واجب-درس-${lesson?.number ?? ""}-صورة-${i + 1}.jpg`
                            : fileName(i)
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-white text-xs font-bold active:scale-95 transition shadow-sm ${
                          viewMode === "homework"
                            ? "bg-blue-600 hover:bg-blue-700"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        <Download className="w-4 h-4" />
                        <span>تحميل الصورة على الهاتف</span>
                      </a>
                    </div>
                  </figure>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* نافذة التكبير بملء الشاشة (Fullscreen Viewer Modal) */}
      {activeImage && selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col select-none"
          onClick={() => setSelectedIndex(null)}
        >
          {/* الشريط العلوي للشاشة الكاملة */}
          <div
            className="flex justify-between items-center p-3.5 bg-black/60 backdrop-blur-sm z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-white text-xs font-bold bg-white/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                {isPdfFile(activeImage) && <FileText className="w-3.5 h-3.5 text-red-400" />}
                <span>
                  {viewMode === "homework" ? "حل الواجب • " : ""}
                  {isPdfFile(activeImage)
                    ? `مستند PDF (${selectedIndex + 1}/${images.length})`
                    : `صورة ${selectedIndex + 1} من ${images.length}`}
                </span>
              </span>
              <a
                href={activeImage.downloadUrl || activeImage.url}
                download={fileName(selectedIndex)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold active:scale-95 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل</span>
              </a>
              {isPdfFile(activeImage) && (
                <a
                  href={activeImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold active:scale-95 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح كامل</span>
                </a>
              )}
            </div>

            <button
              onClick={() => setSelectedIndex(null)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition"
              aria-label="إغلاق"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* وسط الشاشة: الصورة أو مستند PDF مع أزرار التنقل */}
          <div className="flex-1 flex items-center justify-center relative p-2 min-h-0">
            {images.length > 1 && (
              <>
                <button
                  disabled={selectedIndex === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm border border-white/20 z-10 transition ${
                    selectedIndex === 0 ? "opacity-20 cursor-not-allowed" : "hover:bg-black/80"
                  }`}
                  aria-label="السابق"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>

                <button
                  disabled={selectedIndex === images.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm border border-white/20 z-10 transition ${
                    selectedIndex === images.length - 1 ? "opacity-20 cursor-not-allowed" : "hover:bg-black/80"
                  }`}
                  aria-label="التالي"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </>
            )}

            {isPdfFile(activeImage) ? (
              <div
                className="w-full max-w-4xl h-[80vh] bg-white rounded-2xl overflow-hidden flex flex-col shadow-2xl z-0"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-slate-900 text-white p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-red-400" />
                    <span className="font-bold text-xs truncate max-w-[200px] sm:max-w-md">
                      {activeImage.name || "مستند PDF"}
                    </span>
                  </div>
                  <a
                    href={activeImage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>نافذة خارجية</span>
                  </a>
                </div>
                <iframe
                  src={activeImage.url}
                  className="w-full flex-1 border-0"
                  title="PDF Document"
                />
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={activeImage.url}
                alt=""
                className="max-h-full max-w-full object-contain pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>

          {/* شريط الصور والملفات المصغرة السفلي */}
          {images.length > 1 && (
            <div
              className="p-3 bg-black/60 backdrop-blur-sm flex justify-center gap-2 overflow-x-auto z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, i) => {
                const isPdf = isPdfFile(img);
                return (
                  <button
                    key={img.id}
                    onClick={() => setSelectedIndex(i)}
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition shrink-0 flex items-center justify-center ${
                      i === selectedIndex
                        ? "border-emerald-500 scale-105"
                        : "border-transparent opacity-50 hover:opacity-80"
                    } ${isPdf ? "bg-red-500/20 text-red-400" : "bg-black/40"}`}
                  >
                    {isPdf ? (
                      <div className="flex flex-col items-center justify-center">
                        <FileText className="w-5 h-5 text-red-400" />
                        <span className="text-[8px] font-black text-white">PDF</span>
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
