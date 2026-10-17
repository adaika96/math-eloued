"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, CalendarClock, FolderLock, Loader2, ShieldCheck } from "lucide-react";
import { LoginRequired } from "@/components/LoginRequired";
import { useProfile } from "@/lib/useProfile";
import { supabase } from "@/lib/supabase";
import { DocumentsTab } from "./DocumentsTab";
import { CircularsInbox } from "./CircularsInbox";
import { TimetableEditor } from "./TimetableEditor";
import { markPedagogySeen } from "@/components/PedagogyAlerts";

type Tab = "documents" | "circulars" | "timetable";

export default function PedagogicalFilePage() {
  const { loading, profile } = useProfile();
  const [tab, setTab] = useState<Tab>("documents");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (profile?.role === "teacher") markPedagogySeen();
  }, [profile]);

  // عدد المناشير غير المقروءة (لشارة التبويب)
  useEffect(() => {
    if (!profile || profile.role !== "teacher") return;
    (async () => {
      const [{ data: circulars }, { data: reads }] = await Promise.all([
        supabase.from("inspector_circulars").select("id"),
        supabase.from("circular_reads").select("circular_id").eq("teacher_id", profile.id),
      ]);
      const readIds = new Set((reads || []).map((r) => r.circular_id));
      setUnread((circulars || []).filter((c) => !readIds.has(c.id)).length);
    })();
  }, [profile, tab]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!profile || profile.role !== "teacher") {
    return <LoginRequired next="/pedagogy" title="الملف البيداغوجي للأستاذ" />;
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "documents", label: "المذكرات والوثائق", icon: <FolderLock className="w-4 h-4" /> },
    { id: "circulars", label: "مناشير المفتش", icon: <Bell className="w-4 h-4" />, badge: unread },
    { id: "timetable", label: "جدول التوقيت", icon: <CalendarClock className="w-4 h-4" /> },
  ];

  return (
    <div className="pb-16 pt-3 space-y-4 fade-up">
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-3">
        <div className="flex items-start gap-3">
          <Link
            href="/admin"
            className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 shrink-0"
            aria-label="العودة للوحة التحكم"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-slate-800">الملف البيداغوجي — {profile.full_name}</h1>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              فضاء سري بينك وبين مفتش المقاطعة {profile.district_id ?? "—"} فقط، لا يراه الأولياء ولا التلاميذ.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-1 rounded-xl">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative py-2 px-1 rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                tab === t.id ? "bg-white text-indigo-700 shadow-xs border border-slate-200" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {Boolean(t.badge) && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "documents" && <DocumentsTab profile={profile} />}
      {tab === "circulars" && <CircularsInbox profile={profile} onRead={() => setUnread((n) => Math.max(0, n - 1))} />}
      {tab === "timetable" && <TimetableEditor profile={profile} />}
    </div>
  );
}
