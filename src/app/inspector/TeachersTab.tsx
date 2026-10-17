"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CalendarClock, ExternalLink, Eye, Image as ImageIcon, Search, X } from "lucide-react";
import { getPrivateNoteSignedUrl } from "@/lib/supabase";
import { SCHOOL_DAYS } from "@/lib/types";
import { daysSince, formatDate, type DistrictData, type TeacherStat } from "./shared";

export function TeachersTab({ data }: { data: DistrictData }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "activity" | "lessons">("activity");
  const [timetableOf, setTimetableOf] = useState<TeacherStat | null>(null);

  const teachers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data.teachers.filter(
      (t) =>
        !q ||
        t.profile.full_name?.toLowerCase().includes(q) ||
        t.profile.school_custom_name?.toLowerCase().includes(q) ||
        t.profile.teacher_code?.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      if (sort === "lessons") return b.lessonsCount - a.lessonsCount;
      if (sort === "activity") return (b.lastActivityAt || "").localeCompare(a.lastActivityAt || "");
      return (a.profile.full_name || "").localeCompare(b.profile.full_name || "", "ar");
    });
  }, [data.teachers, query, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="relative w-full sm:w-80">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث باسم الأستاذ، المتوسطة، أو الكود..."
            className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="py-2 px-3 rounded-xl border border-slate-200 bg-white text-xs"
        >
          <option value="activity">الأحدث نشاطاً</option>
          <option value="lessons">الأكثر نشراً للدروس</option>
          <option value="name">الترتيب الأبجدي</option>
        </select>
      </div>

      {teachers.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
          لا يوجد أساتذة مسجلون في هذه المقاطعة بعد. يظهر الأستاذ هنا فور تسجيله واختياره لهذه المقاطعة.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {teachers.map((t) => {
            const idle = daysSince(t.lastActivityAt);
            const activityTone =
              idle === null ? "bg-slate-100 text-slate-500" : idle <= 7 ? "bg-emerald-50 text-emerald-700" : idle <= 21 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
            return (
              <div key={t.profile.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-lg shrink-0">
                      {t.profile.full_name?.charAt(0) || "أ"}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-800 text-sm truncate">{t.profile.full_name}</h4>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                        <Building2 className="w-3 h-3 shrink-0" />
                        {t.profile.school_custom_name || "متوسطة غير محددة"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md shrink-0">
                    {t.profile.teacher_code}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <Metric value={t.lessonsCount} label="درس منشور" />
                  <Metric value={t.imagesCount} label="صورة سبورة" />
                  <Metric value={t.pendingNotes ? `${t.pendingNotes}/${t.notesCount}` : t.notesCount} label="وثيقة (جديدة)" />
                </div>

                <div className={`text-[11px] font-bold px-2 py-1 rounded-lg ${activityTone}`}>
                  {idle === null
                    ? "لم ينشر أي محتوى بعد"
                    : `آخر نشاط: ${formatDate(t.lastActivityAt)} (${idle === 0 ? "اليوم" : `منذ ${idle} يوم`})`}
                  {t.lastLessonAt && <span className="block font-medium opacity-80">آخر درس: {formatDate(t.lastLessonAt)}</span>}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500">المستويات: {t.profile.levels_taught?.join("، ") || "—"} م</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setTimetableOf(t)}
                      disabled={!t.timetable}
                      className="text-indigo-600 disabled:text-slate-300 flex items-center gap-1 font-medium"
                      title={t.timetable ? "جدول التوقيت" : "لم يُدخل جدول التوقيت بعد"}
                    >
                      <CalendarClock className="w-3.5 h-3.5" /> التوقيت
                    </button>
                    <Link
                      href={`/t/${t.profile.slug || t.profile.id}`}
                      target="_blank"
                      className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                    >
                      معاينة الفضاء <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {timetableOf?.timetable && <TimetableModal teacher={timetableOf} onClose={() => setTimetableOf(null)} />}
    </div>
  );
}

function Metric({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="p-2 rounded-xl bg-slate-50">
      <p className="text-base font-black text-slate-800">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

function TimetableModal({ teacher, onClose }: { teacher: TeacherStat; onClose: () => void }) {
  const slots = teacher.timetable?.slots || [];
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">جدول توقيت {teacher.profile.full_name}</h3>
            <p className="text-[11px] text-slate-500">آخر تحديث: {formatDate(teacher.timetable?.updated_at)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>

        {SCHOOL_DAYS.map((day) => {
          const daySlots = slots.filter((s) => s.day === day);
          if (daySlots.length === 0) return null;
          return (
            <div key={day} className="space-y-1">
              <p className="text-xs font-black text-indigo-800">{day}</p>
              {daySlots.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-slate-50">
                  <span className="font-mono" dir="ltr">
                    {s.start} – {s.end}
                  </span>
                  <span className="font-bold">{s.className}</span>
                  <span className="text-slate-500">{s.room ? `قاعة ${s.room}` : ""}</span>
                </div>
              ))}
            </div>
          );
        })}
        {slots.length === 0 && <p className="text-xs text-slate-400 text-center py-4">لا توجد حصص مسجلة.</p>}

        {teacher.timetable?.image_path && (
          <button
            onClick={async () => {
              const url = await getPrivateNoteSignedUrl(teacher.timetable!.image_path!);
              if (url) window.open(url, "_blank", "noopener");
            }}
            className="w-full py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5"
          >
            <ImageIcon className="w-4 h-4" /> صورة الجدول المعتمد <Eye className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
