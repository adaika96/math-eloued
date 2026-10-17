"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const PEDAGOGY_SEEN_KEY = "pedagogy_seen_at";

export function markPedagogySeen() {
  try {
    localStorage.setItem(PEDAGOGY_SEEN_KEY, new Date().toISOString());
  } catch {
    /* التخزين المحلي غير متاح */
  }
}

// إشعارات الأستاذ: مناشير جديدة، وثائق تحتاج تعديلاً، ومراجعات المفتش منذ آخر زيارة
export function PedagogyAlerts({ teacherId }: { teacherId: string }) {
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    let seenAt = "1970-01-01T00:00:00Z";
    try {
      seenAt = localStorage.getItem(PEDAGOGY_SEEN_KEY) || seenAt;
    } catch {
      /* تجاهل */
    }
    (async () => {
      const [{ data: circulars }, { data: reads }, { data: notes }] = await Promise.all([
        supabase.from("inspector_circulars").select("id"),
        supabase.from("circular_reads").select("circular_id").eq("teacher_id", teacherId),
        supabase.from("pedagogical_notes").select("status, reviewed_at").eq("teacher_id", teacherId),
      ]);
      const read = new Set((reads || []).map((r) => r.circular_id));
      const unread = (circulars || []).filter((c) => !read.has(c.id)).length;
      const revision = (notes || []).filter((n) => n.status === "needs_revision").length;
      const reviewed = (notes || []).filter((n) => n.status === "reviewed" && n.reviewed_at && n.reviewed_at > seenAt).length;
      setAlerts(
        [
          unread ? `${unread} منشور جديد من المفتش` : "",
          revision ? `${revision} وثيقة تحتاج تعديلاً` : "",
          reviewed ? `${reviewed} وثيقة صادق عليها المفتش` : "",
        ].filter(Boolean)
      );
    })();
  }, [teacherId]);

  if (alerts.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1 mt-1">
      {alerts.map((a) => (
        <span key={a} className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black">
          🔔 {a}
        </span>
      ))}
    </span>
  );
}
