"use client";

import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { auditLabel, AUDIT_ACTIONS } from "@/lib/auditLabels";
import type { UserProfile } from "@/lib/types";

export type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

const PAGE = 50;

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("ar-DZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// اسم الهدف: من التفاصيل المحفوظة وقت العملية، وإلا من قائمة الحسابات
export function targetName(row: AuditRow, names: Map<string, string>) {
  const d = row.details || {};
  return String(d.full_name || d.name || d.title || (row.target_id && names.get(row.target_id)) || "—");
}

export function AuditLogTab({ profiles }: { profiles: UserProfile[] }) {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const names = new Map(profiles.map((p) => [p.id, p.full_name || "—"]));

  useEffect(() => {
    setRows(null);
    let q = supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE);
    if (action !== "all") q = q.eq("action", action);
    q.then(({ data }) => {
      const list = (data as AuditRow[]) || [];
      setHasMore(list.length > PAGE);
      setRows(list.slice(0, PAGE));
    });
  }, [action, page]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-black text-sm text-slate-900 flex items-center gap-2 ml-auto">
          <History className="w-4 h-4 text-indigo-600" /> سجل العمليات
        </h3>
        <select
          value={action}
          onChange={(e) => {
            setPage(0);
            setAction(e.target.value);
          }}
          className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white"
          aria-label="نوع العملية"
        >
          <option value="all">كل العمليات</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {auditLabel({ action: a, details: {} })}
            </option>
          ))}
        </select>
      </div>

      {!rows ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-center text-xs text-slate-400 py-10">لا توجد عمليات بعد</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-100 text-right">
                <th className="py-2 font-bold">الوقت</th>
                <th className="py-2 font-bold">المنفّذ</th>
                <th className="py-2 font-bold">العملية</th>
                <th className="py-2 font-bold">الهدف</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="py-2 text-slate-500 whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                  <td className="py-2 font-bold text-slate-700">{(r.actor_id && names.get(r.actor_id)) || "—"}</td>
                  <td className="py-2">{auditLabel(r)}</td>
                  <td className="py-2 text-slate-600">{targetName(r, names)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(page > 0 || hasMore) && (
        <div className="flex justify-between">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 disabled:opacity-40"
          >
            الأحدث
          </button>
          <button
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 disabled:opacity-40"
          >
            الأقدم
          </button>
        </div>
      )}
    </div>
  );
}
