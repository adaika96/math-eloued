"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type School = { id: string; district_id: number; name: string; commune: string };

const DISTRICTS = ["الوادي 1", "الوادي 2", "قمار", "الرقيبة", "الدبيلة والمقرن"];

// قائمة المتوسطات المعتمدة: تظهر في التسجيل وتصفح الأولياء واستهداف المناشير
export function SchoolsManager() {
  const [districtId, setDistrictId] = useState(1);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [commune, setCommune] = useState("");
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("middle_schools").select("*").eq("district_id", districtId).order("commune").order("name");
    setSchools((data as School[]) || []);
    setLoading(false);
  }, [districtId]);

  useEffect(() => {
    load();
  }, [load]);

  const insertRows = async (rows: { name: string; commune: string }[]) => {
    if (rows.length === 0) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase
      .from("middle_schools")
      .insert(rows.map((r) => ({ district_id: districtId, name: r.name.trim(), commune: r.commune.trim() })));
    setBusy(false);
    if (error) setMessage({ type: "err", text: error.code === "23505" ? "هذه المتوسطة مسجلة مسبقاً" : error.message });
    else {
      setMessage({ type: "ok", text: `✓ تمت إضافة ${rows.length} متوسطة` });
      setName("");
      setBulk("");
      load();
    }
  };

  // لصق قائمة: سطر لكل متوسطة بالشكل "اسم المتوسطة - البلدية"
  const addBulk = () => {
    const rows = bulk
      .split("\n")
      .map((line) => line.split(/\s+[-–]\s+/))
      .filter((parts) => parts[0]?.trim())
      .map(([n, c]) => ({ name: n, commune: (c || commune || "").trim() || "غير محددة" }));
    insertRows(rows);
  };

  const remove = async (s: School) => {
    if (!confirm(`حذف "${s.name}" من القائمة؟ (يبقى الأساتذة المرتبطون بها مع اسمها المكتوب)`)) return;
    const { error } = await supabase.from("middle_schools").delete().eq("id", s.id);
    if (error) setMessage({ type: "err", text: error.message });
    else load();
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-600" /> المتوسطات المعتمدة
        </h3>
        <select className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white" value={districtId} onChange={(e) => setDistrictId(Number(e.target.value))}>
          {DISTRICTS.map((d, i) => (
            <option key={d} value={i + 1}>
              المقاطعة {i + 1} — {d}
            </option>
          ))}
        </select>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && commune.trim()) insertRows([{ name, commune }]);
        }}
        className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-2"
      >
        <input className="px-3 py-2 rounded-xl border border-slate-200 text-xs" placeholder="اسم المتوسطة" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="px-3 py-2 rounded-xl border border-slate-200 text-xs" placeholder="البلدية" value={commune} onChange={(e) => setCommune(e.target.value)} />
        <button disabled={busy} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} إضافة
        </button>
      </form>

      <details className="rounded-xl bg-slate-50 p-3">
        <summary className="text-xs font-bold text-slate-600 cursor-pointer">إضافة قائمة كاملة دفعة واحدة</summary>
        <textarea
          className="mt-2 w-full min-h-28 p-2.5 rounded-xl border border-slate-200 text-xs"
          placeholder={"متوسطة الشهيد ... - الوادي\nمتوسطة ... - قمار"}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
        />
        <button type="button" onClick={addBulk} disabled={busy || !bulk.trim()} className="mt-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold disabled:opacity-50">
          إضافة القائمة
        </button>
      </details>

      {message && <p className={`text-xs font-bold ${message.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : schools.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">لم تُضف متوسطات لهذه المقاطعة بعد.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {schools.map((s) => (
            <li key={s.id} className="py-2 flex items-center justify-between text-xs">
              <span>
                <strong className="text-slate-800">{s.name}</strong> <span className="text-slate-500">— {s.commune}</span>
              </span>
              <button onClick={() => remove(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label="حذف">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
