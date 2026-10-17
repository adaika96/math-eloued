"use client";

import { useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";

const DISTRICTS = ["الوادي 1", "الوادي 2", "قمار", "الرقيبة", "الدبيلة والمقرن"];

type Row = {
  district: number;
  teachers: number;
  activeTeachers: number;
  inspectors: number;
  lessons: number;
  notes: number;
  pendingNotes: number;
  circulars: number;
};

// إحصائيات المنصة عبر مقاطعات ولاية الوادي الخمس
export function WilayaStats({ profiles }: { profiles: UserProfile[] }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: workspaces }, { data: notes }, { data: circulars }] = await Promise.all([
        supabase.from("teacher_public_data").select("teacher_id, updated_at, data"),
        supabase.from("pedagogical_notes").select("district_id, status"),
        supabase.from("inspector_circulars").select("district_id"),
      ]);
      const districtOf = new Map(profiles.map((p) => [p.id, p.district_id]));
      const monthAgo = Date.now() - 30 * 86_400_000;

      setRows(
        [1, 2, 3, 4, 5].map((d) => {
          const ws = (workspaces || []).filter((w: any) => districtOf.get(w.teacher_id) === d);
          return {
            district: d,
            teachers: profiles.filter((p) => p.role === "teacher" && p.district_id === d).length,
            activeTeachers: ws.filter((w: any) => new Date(w.updated_at).getTime() > monthAgo).length,
            inspectors: profiles.filter((p) => p.role === "inspector" && p.district_id === d).length,
            lessons: ws.reduce((s: number, w: any) => s + (Array.isArray(w.data?.lessons) ? w.data.lessons.length : 0), 0),
            notes: (notes || []).filter((n) => n.district_id === d).length,
            pendingNotes: (notes || []).filter((n) => n.district_id === d && n.status === "submitted").length,
            circulars: (circulars || []).filter((c) => c.district_id === d).length,
          };
        })
      );
    })();
  }, [profiles]);

  if (!rows) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const total = rows.reduce(
    (acc, r) => ({
      teachers: acc.teachers + r.teachers,
      activeTeachers: acc.activeTeachers + r.activeTeachers,
      lessons: acc.lessons + r.lessons,
      notes: acc.notes + r.notes,
    }),
    { teachers: 0, activeTeachers: 0, lessons: 0, notes: 0 }
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow p-4 space-y-3">
      <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-indigo-600" /> نشاط المنصة عبر المقاطعات
      </h3>
      <p className="text-[11px] text-slate-500">
        {total.teachers} أستاذ • {total.activeTeachers} نشط خلال 30 يوماً • {total.lessons} درس منشور • {total.notes} وثيقة بيداغوجية
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-slate-100">
              <th className="text-right py-2 font-bold">المقاطعة</th>
              <th className="py-2 font-bold">الأساتذة</th>
              <th className="py-2 font-bold">نشطون (30 يوماً)</th>
              <th className="py-2 font-bold">المفتش</th>
              <th className="py-2 font-bold">الدروس</th>
              <th className="py-2 font-bold">الوثائق (تنتظر)</th>
              <th className="py-2 font-bold">المناشير</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.district} className="border-b border-slate-50 text-center">
                <td className="text-right py-2 font-bold text-slate-800">
                  {r.district} — {DISTRICTS[r.district - 1]}
                </td>
                <td className="py-2">{r.teachers}</td>
                <td className="py-2">
                  {r.activeTeachers}
                  {r.teachers > 0 && <span className="text-slate-400"> ({Math.round((r.activeTeachers / r.teachers) * 100)}%)</span>}
                </td>
                <td className={`py-2 ${r.inspectors === 0 ? "text-red-600 font-bold" : ""}`}>{r.inspectors || "—"}</td>
                <td className="py-2">{r.lessons}</td>
                <td className="py-2">
                  {r.notes} {r.pendingNotes > 0 && <span className="text-amber-600">({r.pendingNotes})</span>}
                </td>
                <td className="py-2">{r.circulars}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
