"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, Loader2, MessageSquare, RotateCcw, ShieldCheck } from "lucide-react";
import { getPrivateNoteSignedUrl, supabase } from "@/lib/supabase";
import {
  LEVELS,
  NOTE_STATUS,
  PEDAGOGICAL_DOC_TYPES,
  type PedagogicalDocType,
  type PedagogicalNote,
} from "@/lib/types";
import { formatDate, type DistrictData } from "./shared";

export function NotesReview({ data, onChanged }: { data: DistrictData; onChanged: () => void }) {
  const [status, setStatus] = useState<"all" | PedagogicalNote["status"]>("submitted");
  const [teacherId, setTeacherId] = useState("all");
  const [docType, setDocType] = useState<"all" | PedagogicalDocType>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const teacherName = useMemo(
    () => Object.fromEntries(data.teachers.map((t) => [t.profile.id, t.profile.full_name || "—"])),
    [data.teachers]
  );

  const notes = data.notes.filter(
    (n) =>
      (status === "all" || n.status === status) &&
      (teacherId === "all" || n.teacher_id === teacherId) &&
      (docType === "all" || (n.doc_type || "lesson_plan") === docType)
  );

  const review = async (note: PedagogicalNote, nextStatus: "reviewed" | "needs_revision") => {
    if (nextStatus === "needs_revision" && !feedback.trim()) {
      setError("اكتب للأستاذ ما يجب تعديله قبل طلب إعادة الرفع");
      return;
    }
    setSaving(true);
    setError("");
    const { error: updateError } = await supabase
      .from("pedagogical_notes")
      .update({
        inspector_feedback: feedback.trim() || null,
        status: nextStatus,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", note.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing(null);
    setFeedback("");
    onChanged();
  };

  const openFile = async (path?: string) => {
    const url = await getPrivateNoteSignedUrl(path || "", 900);
    if (url) window.open(url, "_blank", "noopener");
    else setError("تعذر فتح الملف المشفر أو انتهت صلاحيته");
  };

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 flex items-center gap-3 text-indigo-900 text-xs">
        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
        <p>
          <strong>فضاء سري:</strong> هذه الوثائق بين الأستاذ والمفتش فقط، وتُفتح بروابط مؤقتة (15 دقيقة) لا تصلح للمشاركة.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["submitted", "needs_revision", "reviewed", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
              status === s ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            {s === "all" ? "الكل" : NOTE_STATUS[s].label} ({data.notes.filter((n) => s === "all" || n.status === s).length})
          </button>
        ))}
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-xs">
          <option value="all">كل الأساتذة</option>
          {data.teachers.map((t) => (
            <option key={t.profile.id} value={t.profile.id}>
              {t.profile.full_name}
            </option>
          ))}
        </select>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value as typeof docType)}
          className="py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-xs"
        >
          <option value="all">كل أنواع الوثائق</option>
          {(Object.keys(PEDAGOGICAL_DOC_TYPES) as PedagogicalDocType[]).map((t) => (
            <option key={t} value={t}>
              {PEDAGOGICAL_DOC_TYPES[t].label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-red-600 font-bold">{error}</p>}

      {notes.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
          لا توجد وثائق مطابقة لهذا الفلتر.
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const type = PEDAGOGICAL_DOC_TYPES[(note.doc_type || "lesson_plan") as PedagogicalDocType];
            const isEditing = editing === note.id;
            return (
              <div key={note.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-slate-800 text-sm">
                        {type.icon} {note.lesson_title}
                      </h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${NOTE_STATUS[note.status].className}`}>
                        {NOTE_STATUS[note.status].label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      <strong className="text-slate-700">{teacherName[note.teacher_id || ""] || "أستاذ"}</strong> • {type.label} •{" "}
                      {LEVELS[note.level]?.short} • الفصل {note.semester}
                      {note.field ? ` • ${note.field}` : ""}
                      {note.section ? ` • ${note.section}` : ""}
                      {note.session_number ? ` • الحصة ${note.session_number}` : ""}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      أُرسلت: {formatDate(note.created_at, true)}
                      {note.reviewed_at ? ` • رُوجعت: ${formatDate(note.reviewed_at, true)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openFile(note.file_path)}
                      className="py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs text-slate-700 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> فتح الوثيقة
                    </button>
                    <button
                      onClick={() => {
                        setEditing(isEditing ? null : note.id);
                        setFeedback(note.inspector_feedback || "");
                        setError("");
                      }}
                      className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> {note.inspector_feedback ? "تعديل التوجيه" : "مراجعة"}
                    </button>
                  </div>
                </div>

                {note.teacher_notes && (
                  <div className="bg-slate-50 p-2.5 rounded-xl text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">ملاحظة الأستاذ: </span>
                    {note.teacher_notes}
                  </div>
                )}
                {note.inspector_feedback && !isEditing && (
                  <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl text-xs text-indigo-900 whitespace-pre-wrap">
                    <span className="font-bold">توجيهك: </span>
                    {note.inspector_feedback}
                  </div>
                )}

                {isEditing && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-indigo-200 space-y-2">
                    <textarea
                      rows={3}
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="ملاحظاتك وتوجيهاتك: مؤشرات الكفاءة، وضعية الانطلاق، سيرورة التعلمات، التقويم..."
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <button onClick={() => setEditing(null)} className="py-1.5 px-3 rounded-lg border border-slate-200 text-xs text-slate-600">
                        إلغاء
                      </button>
                      <button
                        disabled={saving}
                        onClick={() => review(note, "needs_revision")}
                        className="py-1.5 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> تحتاج تعديلاً وإعادة رفع
                      </button>
                      <button
                        disabled={saving}
                        onClick={() => review(note, "reviewed")}
                        className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        معاينة ومصادقة
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
