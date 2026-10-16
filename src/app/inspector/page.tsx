"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, getPrivateNoteSignedUrl } from "@/lib/supabase";
import {
  ShieldCheck,
  Users,
  FileText,
  Megaphone,
  BookOpen,
  Search,
  Filter,
  LogOut,
  ExternalLink,
  Download,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  Building2,
  GraduationCap,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { District, UserProfile, PedagogicalNote, InspectorCircular } from "@/lib/types";

const DISTRICTS_INFO: Record<number, string> = {
  1: "المقاطعة الأولى — الوادي 1",
  2: "المقاطعة الثانية — الوادي 2",
  3: "المقاطعة الثالثة — قمار",
  4: "المقاطعة الرابعة — الرقيبة",
  5: "المقاطعة الخامسة — الدبيلة والمقرن",
};

export default function InspectorDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentInspector, setCurrentInspector] = useState<UserProfile | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"teachers" | "notes" | "circulars">("teachers");

  // بيانات المقاطعة
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [notes, setNotes] = useState<PedagogicalNote[]>([]);
  const [circulars, setCirculars] = useState<InspectorCircular[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // نموذج إنشاء منشور جديد
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newImportance, setNewImportance] = useState<"normal" | "urgent" | "seminar">("normal");
  const [publishingCircular, setPublishingCircular] = useState(false);

  // فحص الملاحظات
  const [feedbackNoteId, setFeedbackNoteId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);

  useEffect(() => {
    checkInspectorAuth();
  }, [selectedDistrictId]);

  const checkInspectorAuth = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      // جلب ملف المستخدم
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setCurrentInspector(profile);
        if (profile.district_id) {
          setSelectedDistrictId(profile.district_id);
        }
      }

      // جلب أساتذة المقاطعة
      const { data: teachersData } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "teacher")
        .eq("district_id", selectedDistrictId);

      setTeachers(teachersData || []);

      // جلب المذكرات الخاصة بالمقاطعة
      const { data: notesData } = await supabase
        .from("pedagogical_notes")
        .select("*")
        .eq("district_id", selectedDistrictId)
        .order("created_at", { ascending: false });

      setNotes(notesData || []);

      // جلب المناشير
      const { data: circularsData } = await supabase
        .from("inspector_circulars")
        .select("*")
        .eq("district_id", selectedDistrictId)
        .order("created_at", { ascending: false });

      setCirculars(circularsData || []);
    } catch (e) {
      console.error("Inspector load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleSendCircular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !currentInspector) return;

    setPublishingCircular(true);
    try {
      const { error } = await supabase.from("inspector_circulars").insert({
        inspector_id: currentInspector.id,
        district_id: selectedDistrictId,
        title: newTitle.trim(),
        content: newContent.trim(),
        importance: newImportance,
      });

      if (error) throw error;

      setNewTitle("");
      setNewContent("");
      // تحديث المناشير
      const { data } = await supabase
        .from("inspector_circulars")
        .select("*")
        .eq("district_id", selectedDistrictId)
        .order("created_at", { ascending: false });
      setCirculars(data || []);
      alert("تم إرسال المنشور التوجيهي لجميع أساتذة المقاطعة بنجاح!");
    } catch (err: any) {
      alert("فشل إرسال المنشور: " + err.message);
    } finally {
      setPublishingCircular(false);
    }
  };

  const handleSaveFeedback = async (noteId: string) => {
    if (!feedbackText.trim()) return;
    setSavingFeedback(true);
    try {
      const { error } = await supabase
        .from("pedagogical_notes")
        .update({
          inspector_feedback: feedbackText.trim(),
          reviewed_at: new Date().toISOString(),
          status: "reviewed",
        })
        .eq("id", noteId);

      if (error) throw error;

      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, inspector_feedback: feedbackText.trim(), status: "reviewed" }
            : n
        )
      );
      setFeedbackNoteId(null);
      setFeedbackText("");
      alert("تم إرسال التوجيهات البيداغوجية للأستاذ بنجاح!");
    } catch (err: any) {
      alert("فشل حفظ التوجيه: " + err.message);
    } finally {
      setSavingFeedback(false);
    }
  };

  const openNoteFile = async (path: string) => {
    try {
      const signedUrl = await getPrivateNoteSignedUrl(path, 900);
      if (signedUrl) {
        window.open(signedUrl, "_blank");
      } else {
        alert("تعذر فتح الملف المشفر أو انتهت صلاحيته");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      t.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.school_custom_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.teacher_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans" dir="rtl">
      {/* الشريط العلوي للمفتش */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                فضاء مفتش التعليم المتوسط — مادة الرياضيات
              </h1>
              <p className="text-xs text-slate-500">
                ولاية الوادي • {DISTRICTS_INFO[selectedDistrictId]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* اختيار المقاطعة للمفتش */}
            <select
              value={selectedDistrictId}
              onChange={(e) => setSelectedDistrictId(Number(e.target.value))}
              className="py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[1, 2, 3, 4, 5].map((num) => (
                <option key={num} value={num}>
                  المقاطعة {num}
                </option>
              ))}
            </select>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* إحصائيات المقاطعة السريعة */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">{teachers.length}</p>
              <p className="text-xs text-slate-500 font-medium">أساتذة مسجلين</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">{notes.length}</p>
              <p className="text-xs text-slate-500 font-medium">مذكرات مرفوعة</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">{circulars.length}</p>
              <p className="text-xs text-slate-500 font-medium">مناشير وتوجيهات</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">
                {new Set(teachers.map((t) => t.school_custom_name)).size}
              </p>
              <p className="text-xs text-slate-500 font-medium">متوسطة نشطة</p>
            </div>
          </div>
        </div>

        {/* التبويبات الثلاثة الرئيسية */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab("teachers")}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === "teachers"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            دليل أساتذة المقاطعة ({teachers.length})
          </button>

          <button
            onClick={() => setActiveTab("notes")}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === "notes"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            فحص المذكرات والوثائق التربوية ({notes.length})
          </button>

          <button
            onClick={() => setActiveTab("circulars")}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === "circulars"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Megaphone className="w-4 h-4" />
            إرسال المناشير والتوجيهات ({circulars.length})
          </button>
        </div>

        {/* 1. تبويب أساتذة المقاطعة */}
        {activeTab === "teachers" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث باسم الأستاذ، المتوسطة، أو الكود..."
                  className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              </div>
              <p className="text-xs text-slate-500">
                عرض {filteredTeachers.length} من أصل {teachers.length} أستاذ
              </p>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
                جاري جلب بيانات الأساتذة...
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-700">لا يوجد أساتذة مسجلين في هذه المقاطعة حالياً</h3>
                <p className="text-xs text-slate-400 mt-1">
                  يمكن للأساتذة التسجيل عبر رابط التسجيل واختيار هذه المقاطعة ليظهروا هنا فوراً.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTeachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-lg">
                          {teacher.full_name?.charAt(0) || "أ"}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{teacher.full_name}</h4>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3" />
                            {teacher.school_custom_name || "متوسطة غير محددة"}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                        {teacher.teacher_code || "كود"}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center justify-between pt-2 border-t border-slate-100">
                      <span>السنوات: {teacher.levels_taught?.join(" ، ") || "1، 2"} متوسط</span>
                      <Link
                        href={`/t/${teacher.slug || teacher.teacher_code}`}
                        target="_blank"
                        className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                      >
                        معاينة الفضاء
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. تبويب فحص المذكرات التربوية */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center gap-3 text-indigo-900 text-xs">
              <ShieldCheck className="w-6 h-6 text-indigo-600 shrink-0" />
              <p>
                <strong>فضاء مشفر وسري:</strong> هذه المذكرات خاصة بين الأستاذ والمفتش فقط، ولا تظهر للأولياء أو التلاميذ إطلاقاً في أي صفحة عامة.
              </p>
            </div>

            {notes.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-700">لا توجد مذكرات مرفوعة حالياً</h3>
                <p className="text-xs text-slate-400 mt-1">
                  عندما يرفع أساتذة المقاطعة مذكراتهم البيداغوجية، ستظهر هنا للفحص وكتابة التوجيهات.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800 text-sm">{note.lesson_title}</h4>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {note.level} متوسط
                          </span>
                          {note.status === "reviewed" ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3 h-3" /> تم الفحص
                            </span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3" /> قيد المراجعة
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          تاريخ الرفع: {new Date(note.created_at || Date.now()).toLocaleDateString("ar-DZ")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openNoteFile(note.file_path || "")}
                          className="py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          تحميل المذكرة
                        </button>
                        <button
                          onClick={() => {
                            setFeedbackNoteId(note.id);
                            setFeedbackText(note.inspector_feedback || "");
                          }}
                          className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {note.inspector_feedback ? "تعديل الملاحظات" : "كتابة توجيه"}
                        </button>
                      </div>
                    </div>

                    {note.teacher_notes && (
                      <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600">
                        <span className="font-semibold text-slate-700">ملاحظة الأستاذ: </span>
                        {note.teacher_notes}
                      </div>
                    )}

                    {note.inspector_feedback && (
                      <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-xs text-indigo-900">
                        <span className="font-bold text-indigo-800">توجيهات المفتش: </span>
                        {note.inspector_feedback}
                      </div>
                    )}

                    {/* حقل كتابة الملاحظات */}
                    {feedbackNoteId === note.id && (
                      <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-indigo-200 space-y-3">
                        <label className="block text-xs font-bold text-indigo-900">
                          كتابة التوجيهات والملاحظات البيداغوجية للأستاذ:
                        </label>
                        <textarea
                          rows={3}
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder="اكتب ملاحظاتك وتوجيهاتك بخصوص المذكرة ومطابقتها للمنهاج..."
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setFeedbackNoteId(null)}
                            className="py-1.5 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            disabled={savingFeedback}
                            onClick={() => handleSaveFeedback(note.id)}
                            className="py-1.5 px-4 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer flex items-center gap-1.5"
                          >
                            {savingFeedback && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            إرسال التوجيه للأستاذ
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. تبويب إرسال المناشير والتعميمات */}
        {activeTab === "circulars" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 h-fit">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-indigo-600" />
                إرسال منشور توجيهي جديد
              </h3>
              <form onSubmit={handleSendCircular} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    عنوان المنشور أو التعميم
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="مثال: تعليمات بخصوص فروض الفصل الأول..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    نوع الإرسالية
                  </label>
                  <select
                    value={newImportance}
                    onChange={(e) => setNewImportance(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="normal">توجيه بيداغوجي عادي</option>
                    <option value="urgent">هام وعاجل</option>
                    <option value="seminar">دعوة لندوة تربوية / ملتقى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    نص التوجيهات
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="تفاصيل المنشور أو التوجيهات للأساتذة..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={publishingCircular}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {publishingCircular ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  تعميم المنشور على أساتذة المقاطعة
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">
                المناشير السابقة لمقاطعة {selectedDistrictId}
              </h3>
              {circulars.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                  لم يتم إرسال أي مناشير بعد لهذه المقاطعة.
                </div>
              ) : (
                circulars.map((c) => (
                  <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-sm">{c.title}</h4>
                      <span className="text-[11px] text-slate-400">
                        {new Date(c.created_at || Date.now()).toLocaleDateString("ar-DZ")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
