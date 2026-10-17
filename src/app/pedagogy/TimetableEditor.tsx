"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, ImageUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { BUCKETS, getPrivateNoteSignedUrl, supabase } from "@/lib/supabase";
import { compressIfImage, safeStorageName, validateUpload } from "@/lib/compress";
import { SCHOOL_DAYS, type TimetableSlot, type UserProfile } from "@/lib/types";

const cell = "py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500";

export function sortSlots(slots: TimetableSlot[]) {
  return [...slots].sort(
    (a, b) => SCHOOL_DAYS.indexOf(a.day) - SCHOOL_DAYS.indexOf(b.day) || a.start.localeCompare(b.start)
  );
}

export function TimetableEditor({ profile }: { profile: UserProfile }) {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("teacher_timetables").select("*").eq("teacher_id", profile.id).maybeSingle();
      setSlots(sortSlots((data?.slots as TimetableSlot[]) || []));
      setImagePath(data?.image_path ?? null);
      setLoading(false);
    })();
  }, [profile.id]);

  const update = (i: number, patch: Partial<TimetableSlot>) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const addSlot = () => {
    const last = slots[slots.length - 1];
    setSlots((prev) => [
      ...prev,
      { day: last?.day ?? "الأحد", start: last?.end ?? "08:00", end: "", className: last?.className ?? "", room: last?.room ?? "" },
    ]);
  };

  const save = async (nextImagePath = imagePath) => {
    const invalid = slots.find((s) => !s.start || !s.end || !s.className.trim() || s.end <= s.start);
    if (invalid) {
      setMessage({ type: "err", text: "تأكد من إدخال القسم ووقت بداية ونهاية صحيحين لكل حصة" });
      return false;
    }
    setSaving(true);
    setMessage(null);
    const clean = sortSlots(slots.map((s) => ({ ...s, className: s.className.trim(), room: s.room?.trim() || undefined })));
    const { error } = await supabase.from("teacher_timetables").upsert({
      teacher_id: profile.id,
      slots: clean,
      image_path: nextImagePath,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      setMessage({ type: "err", text: error.message });
      return false;
    }
    setSlots(clean);
    setMessage({ type: "ok", text: "✓ تم حفظ جدول التوقيت؛ يظهر لمفتش مقاطعتك فقط" });
    return true;
  };

  const uploadImage = async (f: File) => {
    const invalid = validateUpload(f);
    if (invalid) return setMessage({ type: "err", text: invalid });
    setSaving(true);
    const prepared = await compressIfImage(f);
    const path = `${profile.id}/timetable-${safeStorageName(prepared.name)}`;
    const { error } = await supabase.storage.from(BUCKETS.PRIVATE_NOTES).upload(path, prepared, { contentType: prepared.type });
    setSaving(false);
    if (error) return setMessage({ type: "err", text: error.message });
    const previous = imagePath;
    setImagePath(path);
    if (await save(path)) {
      if (previous) await supabase.storage.from(BUCKETS.PRIVATE_NOTES).remove([previous]);
    }
  };

  const weeklyHours = useMemo(() => {
    const minutes = slots.reduce((sum, s) => {
      if (!s.start || !s.end) return sum;
      const [sh, sm] = s.start.split(":").map(Number);
      const [eh, em] = s.end.split(":").map(Number);
      return sum + Math.max(0, eh * 60 + em - (sh * 60 + sm));
    }, 0);
    return Math.round((minutes / 60) * 10) / 10;
  }, [slots]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800">جدول التوقيت الأسبوعي</h2>
          <p className="text-[11px] text-slate-500">
            يساعد المفتش على برمجة زيارات التفتيش والتوجيه • المجموع: <strong>{weeklyHours} ساعة</strong>
          </p>
        </div>
        <button
          onClick={addSlot}
          className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> حصة
        </button>
      </div>

      {message && (
        <p className={`text-xs font-bold ${message.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>
      )}

      {slots.length === 0 ? (
        <p className="text-center text-xs text-slate-400 py-6">أضف حصصك الأسبوعية: اليوم، الوقت، الفوج والقاعة.</p>
      ) : (
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[1.2fr_1fr_1fr_1fr_0.8fr_auto] gap-2 text-[10px] font-bold text-slate-500 px-1">
            <span>اليوم</span>
            <span>من</span>
            <span>إلى</span>
            <span>القسم / الفوج</span>
            <span>القاعة</span>
            <span />
          </div>
          {slots.map((s, i) => (
            <div
              key={i}
              className="grid grid-cols-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr_0.8fr_auto] gap-2 p-2 sm:p-0 rounded-xl bg-slate-50 sm:bg-transparent"
            >
              <select className={cell} value={s.day} onChange={(e) => update(i, { day: e.target.value as TimetableSlot["day"] })}>
                {SCHOOL_DAYS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <input type="time" className={cell} value={s.start} onChange={(e) => update(i, { start: e.target.value })} aria-label="من" />
              <input type="time" className={cell} value={s.end} onChange={(e) => update(i, { end: e.target.value })} aria-label="إلى" />
              <input className={cell} placeholder="2م1" value={s.className} onChange={(e) => update(i, { className: e.target.value })} />
              <input className={cell} placeholder="04" value={s.room ?? ""} onChange={(e) => update(i, { room: e.target.value })} />
              <button
                onClick={() => setSlots((prev) => prev.filter((_, idx) => idx !== i))}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 justify-self-end"
                aria-label="حذف الحصة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
        <button
          onClick={() => save()}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ الجدول
        </button>
        <label className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
          <ImageUp className="w-4 h-4" /> {imagePath ? "تغيير صورة الجدول المعتمد" : "رفع صورة الجدول المعتمد (اختياري)"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
          />
        </label>
        {imagePath && (
          <button
            onClick={async () => {
              const url = await getPrivateNoteSignedUrl(imagePath);
              if (url) window.open(url, "_blank", "noopener");
            }}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5"
          >
            <Eye className="w-4 h-4" /> معاينة الصورة
          </button>
        )}
      </div>
    </div>
  );
}
