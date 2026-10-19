"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCheck, Loader2, Megaphone, Paperclip, Send, Trash2 } from "lucide-react";
import { BUCKETS, getPrivateSignedUrl, supabase } from "@/lib/supabase";
import { safeStorageName, validateUpload } from "@/lib/compress";
import { CIRCULAR_IMPORTANCE, type InspectorCircular, type UserProfile } from "@/lib/types";
import { DISTRICTS_INFO } from "./districts";

const inputCls = "w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500";

// منشور موجه لكل أساتذة ومفتشي الولاية (district_id = NULL)
export function WilayaCircularTab({ admin, profiles }: { admin: UserProfile | null; profiles: UserProfile[] }) {
  const [circulars, setCirculars] = useState<InspectorCircular[] | null>(null);
  const [reads, setReads] = useState<{ circular_id: string; teacher_id: string }[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState<InspectorCircular["importance"]>("normal");
  const [eventDate, setEventDate] = useState("");
  const [eventPlace, setEventPlace] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const teachers = profiles.filter((p) => p.role === "teacher" && p.is_verified);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("inspector_circulars")
      .select("*")
      .is("district_id", null)
      .order("created_at", { ascending: false });
    const list = (data as InspectorCircular[]) || [];
    setCirculars(list);
    if (list.length) {
      const { data: r } = await supabase.from("circular_reads").select("circular_id, teacher_id").in("circular_id", list.map((c) => c.id));
      setReads(r || []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin || !title.trim() || !content.trim()) return;
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
        // المجلد wilaya/ يقرؤه كل الأساتذة والمفتشين (سياسة المخزن في 20261019000001)
        attachmentPath = `wilaya/${safeStorageName(file.name)}`;
        const { error } = await supabase.storage.from(BUCKETS.INSPECTOR_DOCS).upload(attachmentPath, file, { contentType: file.type });
        if (error) throw new Error(error.message);
      }
      const { error } = await supabase.from("inspector_circulars").insert({
        inspector_id: admin.id,
        district_id: null,
        title: title.trim(),
        content: content.trim(),
        importance,
        event_date: importance === "seminar" && eventDate ? new Date(eventDate).toISOString() : null,
        event_place: importance === "seminar" ? eventPlace.trim() || null : null,
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
      setMessage({ type: "ok", text: "✓ نُشر المنشور لكل أساتذة ومفتشي الولاية" });
      load();
    } catch (err: any) {
      setMessage({ type: "err", text: "فشل النشر: " + (err?.message || "") });
    } finally {
      setSending(false);
    }
  };

  const remove = async (c: InspectorCircular) => {
    if (!confirm(`حذف المنشور الولائي "${c.title}"؟`)) return;
    const { error } = await supabase.from("inspector_circulars").delete().eq("id", c.id);
    if (!error && c.attachment_path) await supabase.storage.from(BUCKETS.INSPECTOR_DOCS).remove([c.attachment_path]);
    if (error) setMessage({ type: "err", text: error.message });
    else load();
  };

  const openAttachment = async (path: string) => {
    const url = await getPrivateSignedUrl(BUCKETS.INSPECTOR_DOCS, path, 900);
    if (url) window.open(url, "_blank", "noopener");
  };

  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-4 lg:items-start">
      <form onSubmit={send} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 lg:sticky lg:top-4">
        <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-indigo-600" /> منشور ولائي جديد
        </h3>
        <p className="text-[11px] text-slate-500">يصل إلى كل أساتذة الولاية في ملفهم البيداغوجي وإلى المفتشين الخمسة.</p>
        {message && <p className={`text-xs font-bold ${message.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
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
          <div className="grid gap-2 p-2.5 rounded-xl bg-indigo-50/60">
            <label className="text-[11px] font-bold text-indigo-900 space-y-1">
              <span>موعد الندوة</span>
              <input type="datetime-local" className={inputCls} value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </label>
            <input className={inputCls} value={eventPlace} onChange={(e) => setEventPlace(e.target.value)} placeholder="مكان الانعقاد" />
          </div>
        )}
        <textarea className={`${inputCls} min-h-28`} required value={content} onChange={(e) => setContent(e.target.value)} placeholder="نص المنشور..." />
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
          disabled={sending || !admin}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} نشر لكل الولاية
        </button>
      </form>

      <div className="space-y-3">
        {!circulars ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : circulars.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-xs text-slate-400">لا توجد مناشير ولائية بعد.</div>
        ) : (
          circulars.map((c) => {
            const readers = new Set(reads.filter((r) => r.circular_id === c.id).map((r) => r.teacher_id));
            const readCount = teachers.filter((t) => readers.has(t.id)).length;
            const pct = teachers.length ? Math.round((readCount / teachers.length) * 100) : 0;
            const imp = CIRCULAR_IMPORTANCE[c.importance] ?? CIRCULAR_IMPORTANCE.normal;
            return (
              <article key={c.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{c.title}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${imp.className}`}>{imp.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {c.created_at && new Date(c.created_at).toLocaleDateString("ar-DZ", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <button onClick={() => remove(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="حذف" aria-label="حذف">
                    <Trash2 className="w-4 h-4" />
                  </button>
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
                <div className="space-y-1 pt-1">
                  <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCheck className="w-3.5 h-3.5" /> اطلع {readCount} من {teachers.length} أستاذ ({pct}%)
                  </p>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-500 flex flex-wrap gap-x-3">
                    {Object.entries(DISTRICTS_INFO).map(([id]) => {
                      const inDistrict = teachers.filter((t) => t.district_id === Number(id));
                      const n = inDistrict.filter((t) => readers.has(t.id)).length;
                      return (
                        <span key={id}>
                          م {id}: {n}/{inDistrict.length}
                        </span>
                      );
                    })}
                  </p>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
