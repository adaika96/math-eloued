"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, FileUp, Loader2, MessageSquareQuote, RefreshCw, Trash2, Upload } from "lucide-react";
import { BUCKETS, getPrivateNoteSignedUrl, supabase } from "@/lib/supabase";
import { compressIfImage, safeStorageName, validateUpload } from "@/lib/compress";
import {
  LEVELS,
  NOTE_STATUS,
  PEDAGOGICAL_DOC_TYPES,
  type PedagogicalDocType,
  type PedagogicalNote,
  type UserProfile,
} from "@/lib/types";

const inputCls =
  "w-full py-2 px-3 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500";

export function DocumentsTab({ profile }: { profile: UserProfile }) {
  const levels = (profile.levels_taught?.length ? profile.levels_taught : [1, 2, 3, 4]) as (1 | 2 | 3 | 4)[];
  const [notes, setNotes] = useState<PedagogicalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [filter, setFilter] = useState<"all" | PedagogicalNote["status"]>("all");

  // استمارة الرفع
  const [docType, setDocType] = useState<PedagogicalDocType>("lesson_plan");
  const [level, setLevel] = useState<number>(levels[0]);
  const [semester, setSemester] = useState(1);
  const [title, setTitle] = useState("");
  const [field, setField] = useState("");
  const [section, setSection] = useState("");
  const [sessionNumber, setSessionNumber] = useState("");
  const [teacherNotes, setTeacherNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pedagogical_notes")
      .select("*")
      .eq("teacher_id", profile.id)
      .order("created_at", { ascending: false });
    if (error) setMessage({ type: "err", text: error.message });
    setNotes((data as PedagogicalNote[]) || []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadToPrivateBucket = async (f: File) => {
    const invalid = validateUpload(f);
    if (invalid) throw new Error(invalid);
    const prepared = await compressIfImage(f);
    // المجلد الأول = معرّف الأستاذ (تفرضه سياسة التخزين الخاصة)
    const path = `${profile.id}/${safeStorageName(prepared.name)}`;
    const { error } = await supabase.storage.from(BUCKETS.PRIVATE_NOTES).upload(path, prepared, {
      contentType: prepared.type || undefined,
    });
    if (error) throw new Error(error.message);
    return { path, name: f.name };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    if (!profile.district_id) {
      setMessage({ type: "err", text: "حسابك غير مرتبط بمقاطعة تفتيشية. تواصل مع المشرف العام." });
      return;
    }
    setBusy("upload");
    setMessage(null);
    try {
      const uploaded = await uploadToPrivateBucket(file);
      const { error } = await supabase.from("pedagogical_notes").insert({
        teacher_id: profile.id,
        district_id: profile.district_id,
        doc_type: docType,
        level,
        semester,
        lesson_title: title.trim(),
        field: field.trim() || null,
        section: section.trim() || null,
        session_number: sessionNumber ? Number(sessionNumber) : null,
        teacher_notes: teacherNotes.trim() || null,
        file_path: uploaded.path,
        file_name: uploaded.name,
      });
      if (error) {
        await supabase.storage.from(BUCKETS.PRIVATE_NOTES).remove([uploaded.path]);
        throw new Error(error.message);
      }
      setTitle("");
      setField("");
      setSection("");
      setSessionNumber("");
      setTeacherNotes("");
      setFile(null);
      setFileKey((k) => k + 1);
      setMessage({ type: "ok", text: "✓ تم إرسال الوثيقة إلى مفتش المقاطعة بسرية تامة" });
      await load();
    } catch (err: any) {
      setMessage({ type: "err", text: "فشل الرفع: " + (err?.message || "خطأ غير معروف") });
    } finally {
      setBusy("");
    }
  };

  // إعادة رفع وثيقة طلب المفتش تعديلها (تعود الحالة إلى "قيد المراجعة")
  const resubmit = async (note: PedagogicalNote, f: File) => {
    setBusy(note.id);
    setMessage(null);
    try {
      const uploaded = await uploadToPrivateBucket(f);
      const { error } = await supabase
        .from("pedagogical_notes")
        .update({
          file_path: uploaded.path,
          file_name: uploaded.name,
          status: "submitted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", note.id);
      if (error) throw new Error(error.message);
      if (note.file_path) await supabase.storage.from(BUCKETS.PRIVATE_NOTES).remove([note.file_path]);
      setMessage({ type: "ok", text: "✓ تم رفع النسخة المعدلة وإعادتها للمراجعة" });
      await load();
    } catch (err: any) {
      setMessage({ type: "err", text: "فشل إعادة الرفع: " + (err?.message || "") });
    } finally {
      setBusy("");
    }
  };

  const remove = async (note: PedagogicalNote) => {
    if (!confirm(`حذف الوثيقة "${note.lesson_title}" نهائياً؟`)) return;
    setBusy(note.id);
    const { error } = await supabase.from("pedagogical_notes").delete().eq("id", note.id);
    if (!error && note.file_path) await supabase.storage.from(BUCKETS.PRIVATE_NOTES).remove([note.file_path]);
    setBusy("");
    if (error) setMessage({ type: "err", text: error.message });
    else await load();
  };

  const open = async (note: PedagogicalNote) => {
    const url = await getPrivateNoteSignedUrl(note.file_path || "", 900);
    if (url) window.open(url, "_blank", "noopener");
    else setMessage({ type: "err", text: "تعذر فتح الملف" });
  };

  const filtered = useMemo(() => notes.filter((n) => filter === "all" || n.status === filter), [notes, filter]);
  const counts = useMemo(
    () => ({
      all: notes.length,
      submitted: notes.filter((n) => n.status === "submitted").length,
      reviewed: notes.filter((n) => n.status === "reviewed").length,
      needs_revision: notes.filter((n) => n.status === "needs_revision").length,
    }),
    [notes]
  );

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`p-3 rounded-xl text-xs font-bold border ${
            message.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* استمارة رفع وثيقة جديدة */}
      <form onSubmit={submit} className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-2xs space-y-3">
        <h2 className="text-sm font-extrabold text-indigo-900 flex items-center gap-2">
          <FileUp className="w-4 h-4" /> إرسال وثيقة جديدة للمفتش
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {(Object.keys(PEDAGOGICAL_DOC_TYPES) as PedagogicalDocType[]).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setDocType(t)}
              className={`p-2 rounded-xl border text-[11px] font-bold text-center transition ${
                docType === t ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <span className="block text-base">{PEDAGOGICAL_DOC_TYPES[t].icon}</span>
              {PEDAGOGICAL_DOC_TYPES[t].label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-bold text-slate-600 space-y-1">
            <span>المستوى</span>
            <select className={inputCls} value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              {levels.map((lv) => (
                <option key={lv} value={lv}>
                  {LEVELS[lv].label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-bold text-slate-600 space-y-1">
            <span>الفصل</span>
            <select className={inputCls} value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
              <option value={1}>الفصل الأول</option>
              <option value={2}>الفصل الثاني</option>
              <option value={3}>الفصل الثالث</option>
            </select>
          </label>
        </div>

        <input
          className={inputCls}
          placeholder={docType === "lesson_plan" ? "موضوع المذكرة (مثال: جمع وطرح الأعداد النسبية)" : "عنوان الوثيقة"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {docType === "lesson_plan" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input className={inputCls} placeholder="الميدان (أنشطة عددية...)" value={field} onChange={(e) => setField(e.target.value)} />
            <input className={inputCls} placeholder="المقطع التعلمي" value={section} onChange={(e) => setSection(e.target.value)} />
            <input
              className={inputCls}
              placeholder="رقم الحصة"
              inputMode="numeric"
              value={sessionNumber}
              onChange={(e) => setSessionNumber(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        )}

        <textarea
          className={`${inputCls} min-h-16`}
          placeholder="ملاحظة للمفتش (اختيارات بيداغوجية، صعوبات...) — اختياري"
          value={teacherNotes}
          onChange={(e) => setTeacherNotes(e.target.value)}
        />

        <label className="block p-3 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 text-center cursor-pointer hover:bg-indigo-50">
          <Upload className="w-5 h-5 mx-auto text-indigo-500" />
          <span className="block text-xs font-bold text-indigo-900 mt-1">
            {file ? file.name : "اختر صورة المذكرة المكتوبة باليد أو ملف PDF"}
          </span>
          <span className="block text-[10px] text-slate-500">JPG / PNG / WebP / PDF — حتى 10 ميغابايت (تُضغط الصور تلقائياً)</span>
          <input
            key={fileKey}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <button
          disabled={!file || !title.trim() || busy === "upload"}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2"
        >
          {busy === "upload" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
          إرسال للمفتش 🔒
        </button>
      </form>

      {/* قائمة الوثائق المرسلة */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "submitted", "needs_revision", "reviewed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                filter === f ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {f === "all" ? "الكل" : NOTE_STATUS[f].label} ({counts[f]})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-8">لا توجد وثائق بعد.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((n) => {
              const type = PEDAGOGICAL_DOC_TYPES[(n.doc_type || "lesson_plan") as PedagogicalDocType];
              return (
                <li key={n.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-800">
                        {type.icon} {n.lesson_title}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {type.label} • {LEVELS[n.level]?.short} • الفصل {n.semester}
                        {n.session_number ? ` • الحصة ${n.session_number}` : ""}
                        {n.created_at ? ` • ${new Date(n.created_at).toLocaleDateString("ar-DZ", { day: "numeric", month: "short" })}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-bold ${NOTE_STATUS[n.status].className}`}>
                      {NOTE_STATUS[n.status].label}
                    </span>
                  </div>

                  {n.inspector_feedback && (
                    <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-900">
                      <p className="font-bold flex items-center gap-1 mb-0.5">
                        <MessageSquareQuote className="w-3.5 h-3.5" /> توجيه المفتش:
                      </p>
                      <p className="whitespace-pre-wrap leading-relaxed">{n.inspector_feedback}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => open(n)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> فتح
                    </button>
                    {n.status === "needs_revision" && (
                      <label className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                        {busy === n.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        رفع النسخة المعدلة
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && resubmit(n, e.target.files[0])}
                        />
                      </label>
                    )}
                    <button
                      onClick={() => remove(n)}
                      disabled={busy === n.id}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-red-600 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> حذف
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
