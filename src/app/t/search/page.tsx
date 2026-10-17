import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PUBLIC_TEACHER_COLUMNS } from "@/lib/teachers";
import { Search, Building2, User, ArrowRight, ChevronLeft } from "lucide-react";

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function TeacherSearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  // إزالة المحارف الخاصة بصيغة فلاتر PostgREST لمنع التلاعب بالاستعلام
  const query = (q || "").replace(/[,()*%\:"]/g, " ").trim().slice(0, 60);

  let teachers: any[] = [];

  if (query) {
    const { data } = await supabase
      .from("profiles")
      .select(PUBLIC_TEACHER_COLUMNS)
      .eq("role", "teacher")
      .or(
        `full_name.ilike.%${query}%,school_custom_name.ilike.%${query}%,teacher_code.ilike.%${query}%`
      )
      .limit(20);

    teachers = data || [];
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans py-8 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <span className="text-xs font-bold text-emerald-700">دليل الأساتذة</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-600" />
            نتائج البحث عن: &quot;{query}&quot;
          </h2>

          <form action="/t/search" method="GET" className="relative">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="اكتب اسم الأستاذ، المتوسطة، أو الكود..."
              className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          </form>
        </div>

        <div className="space-y-3">
          {teachers.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-2">
              <User className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">لم يتم العثور على أستاذ يطابق بحثك</p>
              <p className="text-xs text-slate-400">
                تأكد من كتابة الاسم أو كود الأستاذ بشكل صحيح.
              </p>
            </div>
          ) : (
            teachers.map((teacher) => (
              <Link
                key={teacher.id}
                href={`/t/${teacher.slug || teacher.teacher_code}`}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-sm transition flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-base">
                    {teacher.full_name?.charAt(0) || "أ"}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition">
                      {teacher.full_name}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      {teacher.school_custom_name || "متوسطة بالولاية"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                    {teacher.teacher_code}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-emerald-700 group-hover:bg-emerald-50 transition">
                    <ChevronLeft className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
