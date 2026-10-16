"use client";

import { useEffect, useState } from "react";
import { Heart, Check } from "lucide-react";

const STORAGE_KEY = "math_eloued_wallet";

interface SavedTeacher {
  slug: string;
  name: string;
  code: string;
  school?: string;
  savedAt: number;
  childName?: string;
}

function loadWallet(): SavedTeacher[] {
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

interface SaveToWalletButtonProps {
  slug: string;
  name: string;
  code: string;
  school?: string;
}

export default function SaveToWalletButton({ slug, name, code, school }: SaveToWalletButtonProps) {
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setMounted(true);
    const wallet = loadWallet();
    setSaved(wallet.some((t) => t.slug === slug));
  }, [slug]);

  const handleSave = () => {
    const current = loadWallet();
    if (current.some((t) => t.slug === slug)) {
      setSaved(true);
      return;
    }
    const updated = [
      { slug, name, code, school, savedAt: Date.now() },
      ...current,
    ];
    saveWallet(updated);
    setSaved(true);
    setShowConfirm(true);
    setTimeout(() => setShowConfirm(false), 2500);
  };

  const handleRemove = () => {
    const updated = loadWallet().filter((t) => t.slug !== slug);
    saveWallet(updated);
    setSaved(false);
  };

  if (!mounted) return null;

  return (
    <div className="relative">
      {showConfirm && (
        <div className="absolute bottom-full mb-2 right-0 bg-emerald-600 text-white text-[11px] font-bold px-3 py-2 rounded-xl shadow-lg whitespace-nowrap z-10">
          ✅ تم الحفظ في محفظتك!
        </div>
      )}
      {saved ? (
        <button
          onClick={handleRemove}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-red-500 text-white text-xs font-bold transition shadow-sm"
          title="حذف من المحفظة"
        >
          <Check className="w-3.5 h-3.5" />
          محفوظ في محفظتي
        </button>
      ) : (
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-amber-400 border border-white/25 hover:border-amber-300 text-white text-xs font-bold transition backdrop-blur-sm shadow-sm"
          title="حفظ هذا الأستاذ في محفظتك"
        >
          <Heart className="w-3.5 h-3.5" />
          حفظ في محفظتي
        </button>
      )}
    </div>
  );
}
