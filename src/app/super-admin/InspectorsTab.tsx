"use client";

import { ShieldCheck } from "lucide-react";
import type { UserProfile } from "@/lib/types";
import { CreateInspectorForm } from "./CreateInspectorForm";
import { DISTRICTS_INFO } from "./districts";

// إنشاء حسابات المفتشين وعرضهم حسب المقاطعة
export function InspectorsTab({ profiles, onChanged }: { profiles: UserProfile[]; onChanged: () => void }) {
  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-4 lg:items-start">
      <CreateInspectorForm onCreated={onChanged} />
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(DISTRICTS_INFO).map(([id, name]) => {
          const list = profiles.filter((p) => p.role === "inspector" && p.district_id === Number(id));
          return (
            <section key={id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 space-y-1.5">
              <h3 className="text-xs font-black text-slate-800">{name}</h3>
              {list.length === 0 ? (
                <p className="text-[11px] font-bold text-rose-600">لا يوجد مفتش لهذه المقاطعة</p>
              ) : (
                list.map((p) => (
                  <p key={p.id} className="text-xs text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    {p.full_name || "—"}
                    {!p.is_verified && <span className="text-[10px] text-rose-600">(معلق)</span>}
                  </p>
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
