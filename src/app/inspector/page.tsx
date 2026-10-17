"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Building2, FileText, Loader2, LogOut, Megaphone, Settings, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { DISTRICTS_INFO, normalizeLessons, type DistrictData, type TeacherStat } from "./shared";
import { TeachersTab } from "./TeachersTab";
import { NotesReview } from "./NotesReview";
import { CircularsTab } from "./CircularsTab";
import type { InspectorCircular, PedagogicalNote, TimetableSlot, UserProfile } from "@/lib/types";

type Tab = "teachers" | "notes" | "circulars";

export default function InspectorDashboardPage() {
  const router = useRouter();
  const { loading: profileLoading, profile } = useProfile();
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("teachers");
  const [data, setData] = useState<DistrictData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // لوحة المفتش محصورة في حسابات المفتشين والمشرف العام
  useEffect(() => {
    if (profileLoading) return;
    if (!profile) {
      router.push("/login?next=/inspector");
      return;
    }
    if (profile.role !== "inspector" && profile.role !== "admin") {
      router.push(profile.role === "teacher" ? "/admin" : "/login");
      return;
    }
    // المفتش مقيد بمقاطعته؛ المشرف العام يتنقل بين المقاطعات
    setDistrictId((cur) => cur ?? profile.district_id ?? 1);
  }, [profileLoading, profile, router]);

  const load = useCallback(async (district: number) => {
    setLoading(true);
    setError("");
    try {
      const [teachersRes, notesRes, circularsRes, schoolsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("role", "teacher").eq("district_id", district).order("full_name"),
        supabase.from("pedagogical_notes").select("*").eq("district_id", district).order("created_at", { ascending: false }),
        supabase.from("inspector_circulars").select("*").eq("district_id", district).order("created_at", { ascending: false }),
        supabase.from("middle_schools").select("id, name, commune").eq("district_id", district).order("name"),
      ]);
      const firstError = [teachersRes, notesRes, circularsRes, schoolsRes].find((r) => r.error)?.error;
      if (firstError) throw new Error(firstError.message);

      const teachers = (teachersRes.data as UserProfile[]) || [];
      const notes = (notesRes.data as PedagogicalNote[]) || [];
      const circulars = (circularsRes.data as InspectorCircular[]) || [];
      const teacherIds = teachers.map((t) => t.id);
      const circularIds = circulars.map((c) => c.id);

      const [workspacesRes, timetablesRes, readsRes] = await Promise.all([
        teacherIds.length
          ? supabase.from("teacher_public_data").select("teacher_id, updated_at, data").in("teacher_id", teacherIds)
          : Promise.resolve({ data: [], error: null }),
        teacherIds.length
          ? supabase.from("teacher_timetables").select("teacher_id, slots, image_path, updated_at").in("teacher_id", teacherIds)
          : Promise.resolve({ data: [], error: null }),
        circularIds.length
          ? supabase.from("circular_reads").select("circular_id, teacher_id, read_at").in("circular_id", circularIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const workspaceBy = new Map((workspacesRes.data || []).map((w: any) => [w.teacher_id, w]));
      const timetableBy = new Map((timetablesRes.data || []).map((t: any) => [t.teacher_id, t]));

      const stats: TeacherStat[] = teachers.map((t) => {
        const ws: any = workspaceBy.get(t.id);
        const lessons = normalizeLessons(ws?.data?.lessons);
        const lastLessonAt = lessons.reduce<string | null>(
          (latest, l) => (l.createdAt && (!latest || l.createdAt > latest) ? l.createdAt : latest),
          null
        );
        const teacherNotes = notes.filter((n) => n.teacher_id === t.id);
        const tt: any = timetableBy.get(t.id);
        return {
          profile: t,
          lessonsCount: lessons.length,
          imagesCount: lessons.reduce((sum, l) => sum + (l.images?.length || 0) + (l.homeworkImages?.length || 0), 0),
          lastLessonAt,
          lastActivityAt: ws?.updated_at ?? null,
          notesCount: teacherNotes.length,
          pendingNotes: teacherNotes.filter((n) => n.status === "submitted").length,
          timetable: tt ? { slots: (tt.slots as TimetableSlot[]) || [], image_path: tt.image_path, updated_at: tt.updated_at } : null,
        };
      });

      setData({
        teachers: stats,
        notes,
        circulars,
        reads: (readsRes.data as DistrictData["reads"]) || [],
        schools: schoolsRes.data || [],
      });
    } catch (e: any) {
      setError(e?.message || "تعذر تحميل بيانات المقاطعة");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (districtId) load(districtId);
  }, [districtId, load]);

  const totals = useMemo(() => {
    const t = data?.teachers || [];
    return {
      teachers: t.length,
      lessons: t.reduce((s, x) => s + x.lessonsCount, 0),
      pendingNotes: (data?.notes || []).filter((n) => n.status === "submitted").length,
      notes: data?.notes.length || 0,
      circulars: data?.circulars.length || 0,
      schools: new Set(t.map((x) => x.profile.middle_school_id || x.profile.school_custom_name).filter(Boolean)).size,
    };
  }, [data]);

  if (profileLoading || !profile || !districtId) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "teachers", label: `أساتذة المقاطعة (${totals.teachers})`, icon: <Users className="w-4 h-4" /> },
    { id: "notes", label: `فحص الوثائق (${totals.notes})`, icon: <FileText className="w-4 h-4" />, badge: totals.pendingNotes },
    { id: "circulars", label: `المناشير والندوات (${totals.circulars})`, icon: <Megaphone className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans" dir="rtl">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center text-white shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                فضاء المفتش — {profile.full_name}
              </h1>
              <p className="text-xs text-slate-500 truncate">ولاية الوادي • {DISTRICTS_INFO[districtId]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile.role === "admin" && (
              <select
                value={districtId}
                onChange={(e) => setDistrictId(Number(e.target.value))}
                className="py-1.5 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                aria-label="المقاطعة"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    المقاطعة {n}
                  </option>
                ))}
              </select>
            )}
            <a href="/forum" className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100" title="ملتقى الأساتذة">
              💬 الملتقى
            </a>
            <a href="/settings" className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50" title="إعدادات الحساب">
              <Settings className="w-5 h-5" />
            </a>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/login");
              }}
              className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50"
              title="تسجيل الخروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat icon={<Users className="w-5 h-5" />} tone="bg-blue-50 text-blue-600" value={totals.teachers} label="أساتذة مسجلين" />
          <Stat icon={<BookOpen className="w-5 h-5" />} tone="bg-emerald-50 text-emerald-600" value={totals.lessons} label="درس منشور للتلاميذ" />
          <Stat
            icon={<FileText className="w-5 h-5" />}
            tone="bg-amber-50 text-amber-600"
            value={`${totals.pendingNotes} / ${totals.notes}`}
            label="وثائق تنتظر المراجعة"
          />
          <Stat icon={<Building2 className="w-5 h-5" />} tone="bg-purple-50 text-purple-600" value={totals.schools} label="متوسطة نشطة" />
        </div>

        <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap flex items-center gap-2 ${
                tab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.icon}
              {t.label}
              {Boolean(t.badge) && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && <p className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-bold">{error}</p>}

        {loading || !data ? (
          <div className="p-12 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
            جاري جلب بيانات المقاطعة...
          </div>
        ) : tab === "teachers" ? (
          <TeachersTab data={data} />
        ) : tab === "notes" ? (
          <NotesReview data={data} onChanged={() => load(districtId)} />
        ) : (
          <CircularsTab data={data} districtId={districtId} inspector={profile} onChanged={() => load(districtId)} />
        )}
      </main>
    </div>
  );
}

function Stat({ icon, tone, value, label }: { icon: React.ReactNode; tone: string; value: React.ReactNode; label: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xl font-black text-slate-800">{value}</p>
        <p className="text-[11px] text-slate-500 font-medium">{label}</p>
      </div>
    </div>
  );
}
