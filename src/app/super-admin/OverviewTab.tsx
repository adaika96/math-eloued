"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { auditLabel } from "@/lib/auditLabels";
import { summarizeStats, type DistrictStats } from "@/lib/adminStats";
import type { UserProfile } from "@/lib/types";
import { fmtDateTime, targetName, type AuditRow } from "./AuditLogTab";

const card = "bg-white rounded-2xl border border-slate-100 shadow-sm";

export function OverviewTab({ profiles, onOpenLog }: { profiles: UserProfile[]; onOpenLog: () => void }) {
  const [rows, setRows] = useState<DistrictStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<AuditRow[]>([]);
  const names = new Map(profiles.map((p) => [p.id, p.full_name || "—"]));

  useEffect(() => {
    supabase.rpc("admin_wilaya_stats").then(({ data, error }) => {
      if (error) setError(error.message);
      else setRows((data as DistrictStats[]) || []);
    });
    supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setLog((data as AuditRow[]) || []));
  }, []);

  if (error) {
    return (
      <p className={`${card} p-4 text-xs text-red-600 flex items-center gap-2`}>
        <AlertCircle className="w-4 h-4" /> تعذر تحميل الإحصائيات: {error}
      </p>
    );
  }
  if (!rows) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const t = summarizeStats(rows);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const newcomers = profiles.filter((p) => p.created_at && new Date(p.created_at).getTime() > weekAgo).slice(0, 5);
  const kpis = [
    { label: "الأساتذة", value: t.teachers, tone: "text-slate-900" },
    { label: "نشطون هذا الأسبوع", value: t.activeTeachers, tone: "text-slate-900", sub: t.teachers ? `${Math.round((t.activeTeachers / t.teachers) * 100)}%` : "" },
    { label: "دروس منشورة", value: t.lessons, tone: "text-slate-900" },
    { label: "مذكرات بانتظار المفتش", value: t.notesWaiting, tone: "text-amber-600" },
    { label: "حسابات معلقة", value: t.suspended, tone: "text-rose-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {kpis.map((k) => (
          <div key={k.label} className={`${card} p-3`}>
            <p className="text-[11px] text-slate-500">{k.label}</p>
            <p className={`text-2xl font-black ${k.tone}`}>{k.value.toLocaleString("ar-DZ")}</p>
            {k.sub && <p className="text-[10px] text-slate-400">{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4 lg:items-start">
        <section className={`${card} p-4 lg:col-span-2 space-y-3`}>
          <h3 className="font-black text-sm text-slate-900">المقاطعات الخمس</h3>
          {/* الحاسوب: جدول */}
          <table className="hidden lg:table w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100 text-right">
                <th className="py-2 font-bold">المقاطعة</th>
                <th className="py-2 font-bold">المفتش</th>
                <th className="py-2 font-bold">أساتذة</th>
                <th className="py-2 font-bold">نشطون</th>
                <th className="py-2 font-bold w-40">مذكرات مراجعة / مرسلة</th>
                <th className="py-2 font-bold">مناشير</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r) => (
                <tr key={r.district_id}>
                  <td className="py-2.5 font-bold text-slate-800">{r.district_name}</td>
                  <td className={`py-2.5 ${r.inspector_name ? "text-slate-700" : "text-rose-600 font-bold"}`}>{r.inspector_name || "— بدون مفتش"}</td>
                  <td className="py-2.5">{r.teachers}</td>
                  <td className="py-2.5">{r.active_teachers}</td>
                  <td className="py-2.5">
                    <NotesBar reviewed={r.notes_reviewed} submitted={r.notes_submitted} />
                  </td>
                  <td className="py-2.5">{r.circulars}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* الهاتف: بطاقات */}
          <div className="lg:hidden space-y-2">
            {rows.map((r) => (
              <div key={r.district_id} className="rounded-xl border border-slate-100 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <p className="font-black text-slate-800">{r.district_name}</p>
                  <p className={r.inspector_name ? "text-slate-500" : "text-rose-600 font-bold"}>{r.inspector_name || "بدون مفتش"}</p>
                </div>
                <p className="text-slate-500">
                  {r.teachers} أستاذ • {r.active_teachers} نشط • {r.circulars} منشور
                </p>
                <NotesBar reviewed={r.notes_reviewed} submitted={r.notes_submitted} />
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section className={`${card} p-4 space-y-2`}>
            <h3 className="font-black text-sm text-slate-900">
              تسجيلات جديدة هذا الأسبوع <span className="text-indigo-600">({t.newThisWeek})</span>
            </h3>
            {newcomers.length === 0 ? (
              <p className="text-xs text-slate-400">لا تسجيلات جديدة</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {newcomers.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="font-bold text-slate-700 truncate">{p.full_name || "—"}</span>
                    {p.slug ? (
                      <Link href={`/t/${p.slug}`} target="_blank" className="text-indigo-600 shrink-0">
                        م {p.district_id ?? "—"} ←
                      </Link>
                    ) : (
                      <span className="text-slate-400 shrink-0">م {p.district_id ?? "—"}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${card} p-4 space-y-2`}>
            <div className="flex justify-between items-center">
              <h3 className="font-black text-sm text-slate-900">آخر العمليات</h3>
              <button onClick={onOpenLog} className="text-[11px] font-bold text-indigo-600">
                السجل كاملاً ←
              </button>
            </div>
            {log.length === 0 ? (
              <p className="text-xs text-slate-400">لا توجد عمليات بعد</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-slate-600">
                {log.map((r) => (
                  <li key={r.id}>
                    • {auditLabel(r)} — <span className="font-bold">{targetName(r, names)}</span>{" "}
                    <span className="text-slate-400">{fmtDateTime(r.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function NotesBar({ reviewed, submitted }: { reviewed: number; submitted: number }) {
  const pct = submitted ? Math.round((reviewed / submitted) * 100) : 0;
  const tone = pct >= 60 ? "bg-emerald-500" : pct >= 30 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded" role="img" aria-label={`${reviewed} من ${submitted} مراجعة`}>
        {submitted > 0 && <div className={`h-1.5 rounded ${tone}`} style={{ width: `${pct}%` }} />}
      </div>
      <span className="text-[10px] text-slate-500 shrink-0">
        {reviewed}/{submitted}
      </span>
    </div>
  );
}
