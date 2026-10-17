import Link from "next/link";
import { ArrowRight, Building2, ChevronLeft, MapPin, School } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PUBLIC_TEACHER_COLUMNS } from "@/lib/teachers";

export const dynamic = "force-dynamic";

const DISTRICTS: Record<number, string> = {
  1: "المقاطعة الأولى — الوادي 1",
  2: "المقاطعة الثانية — الوادي 2",
  3: "المقاطعة الثالثة — قمار",
  4: "المقاطعة الرابعة — الرقيبة",
  5: "المقاطعة الخامسة — الدبيلة والمقرن",
};

type PublicTeacher = {
  id: string;
  full_name: string;
  slug: string | null;
  teacher_code: string | null;
  school_custom_name: string | null;
  middle_school_id: string | null;
  levels_taught: number[] | null;
};

// تصفح الأولياء: المقاطعة ⬅️ المتوسطة ⬅️ الأستاذ
export default async function BrowseBySchoolPage({ searchParams }: { searchParams: Promise<{ district?: string }> }) {
  const { district } = await searchParams;
  const districtId = Number(district);
  const valid = Number.isInteger(districtId) && districtId >= 1 && districtId <= 5;

  let groups: { key: string; name: string; commune?: string; teachers: PublicTeacher[] }[] = [];

  if (valid) {
    const [{ data: schools }, { data: teachers }] = await Promise.all([
      supabase.from("middle_schools").select("id, name, commune").eq("district_id", districtId).order("name"),
      supabase
        .from("profiles")
        .select(PUBLIC_TEACHER_COLUMNS)
        .eq("role", "teacher")
        .eq("district_id", districtId)
        .order("full_name"),
    ]);

    const list = (teachers as unknown as PublicTeacher[]) || [];
    const byKey = new Map<string, { key: string; name: string; commune?: string; teachers: PublicTeacher[] }>();
    for (const s of schools || []) byKey.set(s.id, { key: s.id, name: s.name, commune: s.commune, teachers: [] });
    for (const t of list) {
      // المتوسطة من القائمة الرسمية، وإلا بالاسم الذي كتبه الأستاذ
      const key = t.middle_school_id && byKey.has(t.middle_school_id) ? t.middle_school_id : `name:${(t.school_custom_name || "متوسطة غير محددة").trim()}`;
      if (!byKey.has(key)) byKey.set(key, { key, name: (t.school_custom_name || "متوسطة غير محددة").trim(), teachers: [] });
      byKey.get(key)!.teachers.push(t);
    }
    groups = [...byKey.values()].filter((g) => g.teachers.length > 0).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-8 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-5">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 font-medium">
          <ArrowRight className="w-4 h-4" /> العودة للرئيسية
        </Link>
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <School className="w-6 h-6 text-emerald-600" /> البحث عن أستاذ حسب المتوسطة
          </h1>
          <p className="text-xs text-slate-500 mt-1">اختر المقاطعة ثم متوسطة ابنك لتجد أستاذ الرياضيات.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Link
              key={n}
              href={`/t/schools?district=${n}`}
              className={`p-2.5 rounded-xl border text-center text-[11px] font-bold ${
                districtId === n ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
              }`}
            >
              {DISTRICTS[n].split(" — ")[1]}
              <span className="block text-[10px] opacity-75">المقاطعة {n}</span>
            </Link>
          ))}
        </div>

        {!valid ? (
          <p className="text-center text-xs text-slate-400 py-10">اختر مقاطعة لعرض متوسطاتها.</p>
        ) : groups.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-10">لا يوجد أساتذة مسجلون في {DISTRICTS[districtId]} بعد.</p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <details key={g.key} className="bg-white rounded-2xl border border-slate-200 shadow-xs group" open={groups.length <= 3}>
                <summary className="p-4 cursor-pointer flex items-center justify-between gap-2 list-none">
                  <span className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="min-w-0">
                      <strong className="block text-sm text-slate-800 truncate">{g.name}</strong>
                      {g.commune && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {g.commune}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">
                    {g.teachers.length} أستاذ
                  </span>
                </summary>
                <ul className="px-4 pb-4 space-y-2">
                  {g.teachers.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/t/${t.slug || t.id}`}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 transition"
                      >
                        <span>
                          <strong className="text-xs text-slate-800">{t.full_name}</strong>
                          <span className="block text-[10px] text-slate-500">
                            {t.teacher_code} • المستويات: {(t.levels_taught || []).join("، ")} متوسط
                          </span>
                        </span>
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
