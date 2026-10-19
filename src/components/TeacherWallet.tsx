"use client";

import { useEffect, useState } from "react";
import { BookOpen, Star, X, Plus, ExternalLink, Heart } from "lucide-react";
import Link from "next/link";

export interface SavedTeacher {
  slug: string;
  name: string;
  code: string;
  school?: string;
  savedAt: number;
  childName?: string; // اسم الابن/الابنة لتمييز المعلمين
}

const STORAGE_KEY = "math_eloued_wallet";

export function loadWallet(): SavedTeacher[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedTeacher[]) : [];
  } catch {
    return [];
  }
}

function saveWallet(items: SavedTeacher[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/* ─── دالة إضافة معلم (قابلة للاستيراد وتشغيلها خارجياً) ─── */
export function addTeacherToWallet(teacher: Omit<SavedTeacher, "savedAt">) {
  const current = loadWallet();
  if (current.some((t) => t.slug === teacher.slug)) return false; // موجود مسبقاً
  const updated = [{ ...teacher, savedAt: Date.now() }, ...current];
  saveWallet(updated);
  return true;
}

export function isTeacherInWallet(slug: string): boolean {
  return loadWallet().some((t) => t.slug === slug);
}

/* ─── المكوّن الرئيسي: محفظة معلمي الأبناء ─── */
export default function TeacherWallet() {
  const [wallet, setWallet] = useState<SavedTeacher[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setWallet(loadWallet());
  }, []);

  const removeTeacher = (slug: string) => {
    const updated = wallet.filter((t) => t.slug !== slug);
    saveWallet(updated);
    setWallet(updated);
  };

  const updateChildName = (slug: string, childName: string) => {
    const updated = wallet.map((t) =>
      t.slug === slug ? { ...t, childName } : t
    );
    saveWallet(updated);
    setWallet(updated);
  };

  if (!mounted || wallet.length === 0) return null;

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-xl shadow-amber-50 p-5 space-y-4">
      {/* العنوان */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
          <Heart className="w-5 h-5 text-amber-500 fill-amber-400" />
        </div>
        <div>
          <h3 className="font-black text-slate-900 text-sm">
            محفظة معلمي أبنائي
          </h3>
          <p className="text-[11px] text-slate-500">
            {wallet.length} معلم محفوظ · اضغط للوصول السريع
          </p>
        </div>
      </div>

      <Link
        href="/my-children"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition"
      >
        <BookOpen className="w-4 h-4" /> كل مستجدات أبنائي في صفحة واحدة
      </Link>

      {/* بطاقات المعلمين المحفوظين */}
      <div className="space-y-2">
        {wallet.map((teacher) => (
          <WalletCard
            key={teacher.slug}
            teacher={teacher}
            onRemove={() => removeTeacher(teacher.slug)}
            onUpdateChild={(name) => updateChildName(teacher.slug, name)}
          />
        ))}
      </div>

      <p className="text-[10px] text-slate-400 text-center">
        📱 محفوظة على هاتفك فقط · لا تسجيل مطلوب
      </p>
    </div>
  );
}

/* ─── بطاقة معلم واحد ─── */
function WalletCard({
  teacher,
  onRemove,
  onUpdateChild,
}: {
  teacher: SavedTeacher;
  onRemove: () => void;
  onUpdateChild: (name: string) => void;
}) {
  const [editingChild, setEditingChild] = useState(false);
  const [childInput, setChildInput] = useState(teacher.childName || "");

  return (
    <div className="flex items-center gap-3 bg-amber-50/60 hover:bg-amber-50 rounded-2xl p-3 transition group border border-amber-100">
      {/* أيقونة */}
      <div className="w-9 h-9 rounded-xl bg-white border border-amber-100 flex items-center justify-center text-sm font-black text-emerald-700 shrink-0 shadow-xs">
        {teacher.name.charAt(0)}
      </div>

      {/* المعلومات */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 text-xs truncate">{teacher.name}</p>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="font-mono text-emerald-700 font-bold">{teacher.code}</span>
          {teacher.school && (
            <span className="truncate">{teacher.school}</span>
          )}
        </div>

        {/* اسم الابن */}
        {editingChild ? (
          <div className="mt-1.5 flex gap-1.5">
            <input
              type="text"
              value={childInput}
              onChange={(e) => setChildInput(e.target.value)}
              placeholder="اسم ابنك/ابنتك..."
              autoFocus
              className="flex-1 text-[11px] border border-amber-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-amber-400 outline-none"
            />
            <button
              onClick={() => {
                onUpdateChild(childInput.trim());
                setEditingChild(false);
              }}
              className="px-2 py-1 rounded-lg bg-amber-400 text-white text-[10px] font-bold"
            >
              حفظ
            </button>
            <button
              onClick={() => setEditingChild(false)}
              className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold"
            >
              إلغاء
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingChild(true)}
            className="mt-0.5 text-[11px] text-amber-600 hover:underline"
          >
            {teacher.childName ? `👦 ${teacher.childName}` : "+ أضف اسم ابنك"}
          </button>
        )}
      </div>

      {/* أزرار */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <Link
          href={`/t/${teacher.slug}`}
          className="w-8 h-8 rounded-xl bg-white border border-amber-100 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition shadow-xs"
          title="فتح فضاء المعلم"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
        <button
          onClick={onRemove}
          className="w-8 h-8 rounded-xl bg-white border border-red-100 flex items-center justify-center text-red-400 hover:bg-red-50 hover:border-red-200 transition shadow-xs"
          title="حذف من المحفظة"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
