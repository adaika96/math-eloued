"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCheck, Loader2, MapPin, Paperclip } from "lucide-react";
import { BUCKETS, getPrivateSignedUrl, supabase } from "@/lib/supabase";
import { CIRCULAR_IMPORTANCE, type InspectorCircular, type UserProfile } from "@/lib/types";

export function CircularsInbox({ profile, onRead }: { profile: UserProfile; onRead: () => void }) {
  const [circulars, setCirculars] = useState<InspectorCircular[]>([]);
  const [readAt, setReadAt] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    // سياسات RLS تعيد فقط مناشير مقاطعة الأستاذ الموجهة له أو لمتوسطته أو للجميع
    const [c, r] = await Promise.all([
      supabase.from("inspector_circulars").select("*").order("created_at", { ascending: false }),
      supabase.from("circular_reads").select("circular_id, read_at").eq("teacher_id", profile.id),
    ]);
    if (c.error) setError(c.error.message);
    setCirculars((c.data as InspectorCircular[]) || []);
    setReadAt(Object.fromEntries((r.data || []).map((x) => [x.circular_id, x.read_at])));
    setLoading(false);
  }, [profile.id]);

  useEffect(() => {
    load();
  }, [load]);

  // فتح المنشور = تسجيل إشعار الاطلاع لدى المفتش
  const toggle = async (c: InspectorCircular) => {
    setOpenId((cur) => (cur === c.id ? null : c.id));
    if (readAt[c.id]) return;
    const now = new Date().toISOString();
    const { error: insertError } = await supabase
      .from("circular_reads")
      .upsert({ circular_id: c.id, teacher_id: profile.id }, { onConflict: "circular_id,teacher_id", ignoreDuplicates: true });
    if (!insertError) {
      setReadAt((prev) => ({ ...prev, [c.id]: now }));
      onRead();
    }
  };

  const openAttachment = async (path: string) => {
    const url = await getPrivateSignedUrl(BUCKETS.INSPECTOR_DOCS, path, 900);
    if (url) window.open(url, "_blank", "noopener");
    else setError("تعذر فتح المرفق");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-3">
      {error && <p className="text-xs text-red-600 font-bold">{error}</p>}
      {circulars.length === 0 ? (
        <p className="text-center text-xs text-slate-400 py-8">لا توجد مناشير من مفتش المقاطعة بعد.</p>
      ) : (
        <ul className="space-y-2">
          {circulars.map((c) => {
            const importance = CIRCULAR_IMPORTANCE[c.importance] ?? CIRCULAR_IMPORTANCE.normal;
            const isRead = Boolean(readAt[c.id]);
            const isOpen = openId === c.id;
            return (
              <li
                key={c.id}
                className={`rounded-xl border transition ${isRead ? "border-slate-100 bg-white" : "border-indigo-200 bg-indigo-50/40"}`}
              >
                <button onClick={() => toggle(c)} className="w-full text-right p-3 flex items-start gap-2">
                  {!isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-indigo-600 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs ${isRead ? "font-bold text-slate-700" : "font-black text-slate-900"}`}>{c.title}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {c.created_at && new Date(c.created_at).toLocaleDateString("ar-DZ", { year: "numeric", month: "short", day: "numeric" })}
                      {c.district_id == null
                        ? " • منشور ولائي من المشرف العام"
                        : c.target_teacher_id
                        ? " • موجه لك شخصياً"
                        : c.target_school_id
                        ? " • موجه لمتوسطتك"
                        : " • لكل أساتذة المقاطعة"}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-bold ${importance.className}`}>
                    {importance.label}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    {c.importance === "seminar" && (c.event_date || c.event_place) && (
                      <div className="flex flex-wrap gap-3 p-2 rounded-lg bg-indigo-50 text-[11px] text-indigo-900 font-bold">
                        {c.event_date && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {new Date(c.event_date).toLocaleString("ar-DZ", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {c.event_place && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {c.event_place}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                    <div className="flex items-center justify-between gap-2">
                      {c.attachment_path ? (
                        <button
                          onClick={() => openAttachment(c.attachment_path!)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1"
                        >
                          <Paperclip className="w-3.5 h-3.5" /> المرفق
                        </button>
                      ) : (
                        <span />
                      )}
                      <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5" /> تم إشعار المفتش بالاطلاع
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
