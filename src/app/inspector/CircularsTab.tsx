"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CheckCheck, ChevronDown, Clock, Loader2, MapPin, Megaphone, Paperclip, Send, Trash2 } from "lucide-react";
import { BUCKETS, getPrivateSignedUrl, supabase } from "@/lib/supabase";
import { safeStorageName, validateUpload } from "@/lib/compress";
import { CIRCULAR_IMPORTANCE, type InspectorCircular, type UserProfile } from "@/lib/types";
import { formatDate, type DistrictData } from "./shared";

const inputCls = "w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500";

export function CircularsTab({
  data,
  districtId,
  inspector,
  onChanged,
}: {
  data: DistrictData;
  districtId: number;
  inspector: UserProfile;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState<InspectorCircular["importance"]>("normal");
  const [eventDate, setEventDate] = useState("");
  const [eventPlace, setEventPlace] = useState("");
  const [target, setTarget] = useState<"all" | "school" | "teacher">("all");
  const [targetSchool, setTargetSchool] = useState("");
  const [targetTeacher, setTargetTeacher] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const teacherName = useMemo(
    () => Object.fromEntries(data.teachers.map((t) => [t.profile.id, t.profile.full_name || "—"])),
    [data.teachers]
  );
  const schoolName = useMemo(() => Object.fromEntries(data.schools.map((s) => [s.id, s.name])), [data.schools]);

  // الأساتذة المعنيون بكل منشور (لحساب نسبة الاطلاع)
  const audienceOf = (c: InspectorCircular) =>
    data.teachers
      .map((t) => t.profile)
      .filter((p) =>
        c.target_teacher_id ? p.id === c.target_teacher_id : c.target_school_id ? p.middle_school_id === c.target_school_id : true
      );

  const upcomingSeminars = data.circulars
    .filter((c) => c.importance === "seminar" && c.event_date && new Date(c.event_date).getTime() > Date.now() - 86_400_000)
    .sort((a, b) => (a.event_date || "").localeCompare(b.event_date || ""));

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    if (importance === "seminar" && !eventDate) {
      setMessage({ type: "err", text: "حدد موعد الندوة" });
      return;
    }
    setSending(true);
    setMessage(null);
    let attachmentPath: string | null = null;
    try {
      if (file) {
        const invalid = validateUpload(file);
        if (invalid) throw new Error(invalid);
        // المجلد الأول = رقم المقاطعة (تفرضه سياسة مخزن مناشير المفتش)
        attachmentPath = `${districtId}/${safeStorageName(file.name)}`;
        const { error } = await supabase.storage.from(BUCKETS.INSPECTOR_DOCS).upload(attachmentPath, file, { contentType: file.type });
        if (error) throw new Error(error.message);
      }
      const { error } = await supabase.from("inspector_circulars").insert({
        inspector_id: inspector.id,
        district_id: districtId,
        title: title.trim(),
        content: content.trim(),
        importance,
        event_date: importance === "seminar" && eventDate ? new Date(eventDate).toISOString() : null,
        event_place: importance === "seminar" ? eventPlace.trim() || null : null,
        target_school_id: target === "school" && targetSchool ? targetSchool : null,
        target_teacher_id: target === "teacher" && targetTeacher ? targetTeacher : null,
        attachment_path: attachmentPath,
      });
      if (error) {
        if (attachmentPath) await supabase.storage.from(BUCKETS.INSPECTOR_DOCS).remove([attachmentPath]);
        throw new Error(error.message);
      }
      setTitle("");
      setContent("");
      setEventDate("");
      setEventPlace("");
      setFile(null);
      setFileKey((k) => k + 1);
      setMessage({ type: "ok", text: "✓ تم إرسال المنشور؛ ستظهر هنا قائمة من اطلع عليه" });
      onChanged();
    } catch (err: any) {
      setMessage({ type: "err", text: "فشل الإرسال: " + (err?.message || "") });
    } finally {
      setSending(false);
    }
  };

  const remove = async (c: InspectorCircular) => {
    if (!confirm(`حذف المنشور "${c.title}"؟`)) return;
    const { error } = await supabase.from("inspector_circulars").delete().eq("id", c.id);
    if (!error && c.attachment_path) await supabase.storage.from(BUCKETS.INSPECTOR_DOCS).remove([c.attachment_path]);
    if (error) setMessage({ type: "err", text: error.message });
    else onChanged();
  };

  const openAttachment = async (path: string) => {
    const url = await getPrivateSignedUrl(BUCKETS.INSPECTOR_DOCS, path, 900);
    if (url) window.open(url, "_blank", "noopener");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="space-y-4">
        <form onSubmit={send} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-indigo-600" /> منشور أو دعوة جديدة
          </h3>
          {message && (
            <p className={`text-xs font-bold ${message.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>
          )}
          <input className={inputCls} required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان" />

          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(CIRCULAR_IMPORTANCE) as InspectorCircular["importance"][]).map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => setImportance(k)}
                className={`py-1.5 rounded-lg border text-[11px] font-bold ${
                  importance === k ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                {CIRCULAR_IMPORTANCE[k].label}
              </button>
            ))}
          </div>

          {importance === "seminar" && (
            <div className="grid grid-cols-1 gap-2 p-2.5 rounded-xl bg-indigo-50/60">
              <label className="text-[11px] font-bold text-indigo-900 space-y-1">
                <span>موعد الندوة</span>
                <input type="datetime-local" className={inputCls} value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </label>
              <input
                className={inputCls}
                value={eventPlace}
                onChange={(e) => setEventPlace(e.target.value)}
                placeholder="المتوسطة المستقبلة / مكان الانعقاد"
              />
            </div>
          )}

          <textarea
            className={`${inputCls} min-h-24`}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="نص التوجيهات، جدول الأعمال، الأساتذة المعنيون..."
          />

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-600">الجهة المستهدفة</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ["all", "كل المقاطعة"],
                  ["school", "متوسطة"],
                  ["teacher", "أستاذ"],
                ] as const
              ).map(([k, label]) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setTarget(k)}
                  disabled={k === "school" && data.schools.length === 0}
                  className={`py-1.5 rounded-lg border text-[11px] font-bold disabled:opacity-40 ${
                    target === k ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {target === "school" && (
              <select className={inputCls} value={targetSchool} onChange={(e) => setTargetSchool(e.target.value)} required>
                <option value="">اختر المتوسطة...</option>
                {data.schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.commune}
                  </option>
                ))}
              </select>
            )}
            {target === "teacher" && (
              <select className={inputCls} value={targetTeacher} onChange={(e) => setTargetTeacher(e.target.value)} required>
                <option value="">اختر الأستاذ...</option>
                {data.teachers.map((t) => (
                  <option key={t.profile.id} value={t.profile.id}>
                    {t.profile.full_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <label className="flex items-center gap-2 p-2.5 rounded-xl border border-dashed border-slate-300 text-xs text-slate-600 cursor-pointer">
            <Paperclip className="w-4 h-4 shrink-0" />
            <span className="truncate">{file ? file.name : "إرفاق مستند (PDF / صورة) — اختياري"}</span>
            <input
              key={fileKey}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <button
            disabled={sending}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} إرسال
          </button>
        </form>

        {/* روزنامة الندوات القادمة */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-600" /> روزنامة الندوات القادمة
          </h3>
          {upcomingSeminars.length === 0 ? (
            <p className="text-xs text-slate-400">لا توجد ندوات مبرمجة.</p>
          ) : (
            upcomingSeminars.map((c) => (
              <div key={c.id} className="p-2.5 rounded-xl bg-indigo-50/60 text-xs space-y-0.5">
                <p className="font-bold text-indigo-900">{c.title}</p>
                <p className="text-indigo-800 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(c.event_date!).toLocaleString("ar-DZ", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                </p>
                {c.event_place && (
                  <p className="text-indigo-700 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {c.event_place}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* المناشير السابقة مع كشف الاطلاع */}
      <div className="lg:col-span-2 space-y-3">
        {data.circulars.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">لم ترسل أي منشور بعد.</div>
        ) : (
          data.circulars.map((c) => {
            const audience = audienceOf(c);
            const reads = new Map(data.reads.filter((r) => r.circular_id === c.id).map((r) => [r.teacher_id, r.read_at]));
            const readCount = audience.filter((p) => reads.has(p.id)).length;
            const pct = audience.length ? Math.round((readCount / audience.length) * 100) : 0;
            const imp = CIRCULAR_IMPORTANCE[c.importance] ?? CIRCULAR_IMPORTANCE.normal;
            const isOpen = expanded === c.id;
            return (
              <div key={c.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{c.title}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${imp.className}`}>{imp.label}</span>
                      {c.district_id == null && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md border font-bold bg-amber-50 text-amber-800 border-amber-200">منشور ولائي</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatDate(c.created_at, true)} •{" "}
                      {c.district_id == null
                        ? "من المشرف العام إلى كل أساتذة الولاية"
                        : c.target_teacher_id
                        ? `إلى: ${teacherName[c.target_teacher_id] || "أستاذ"}`
                        : c.target_school_id
                        ? `إلى: ${schoolName[c.target_school_id] || "متوسطة"}`
                        : "إلى كل أساتذة المقاطعة"}
                    </p>
                  </div>
                  {c.inspector_id === inspector.id && (
                    <button onClick={() => remove(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="حذف">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-600 whitespace-pre-wrap">{c.content}</p>
                {c.attachment_path && (
                  <button
                    onClick={() => openAttachment(c.attachment_path!)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1"
                  >
                    <Paperclip className="w-3.5 h-3.5" /> المرفق
                  </button>
                )}

                {c.district_id != null && (
                <button onClick={() => setExpanded(isOpen ? null : c.id)} className="w-full text-right space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCheck className="w-3.5 h-3.5" /> اطلع {readCount} من {audience.length} ({pct}%)
                    </span>
                    <span className="text-slate-500 flex items-center gap-1">
                      كشف الاطلاع <ChevronDown className={`w-3.5 h-3.5 transition ${isOpen ? "rotate-180" : ""}`} />
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </button>
                )}

                {isOpen && c.district_id != null && (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                    {audience.map((p) => {
                      const at = reads.get(p.id);
                      return (
                        <li
                          key={p.id}
                          className={`text-[11px] px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 ${
                            at ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-500"
                          }`}
                        >
                          <span className="font-bold truncate">{p.full_name}</span>
                          <span className="shrink-0">{at ? formatDate(at, true) : "لم يطلع بعد"}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
