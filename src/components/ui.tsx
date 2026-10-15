"use client";

import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

export function BackHeader({ href, title, subtitle }: { href: string; title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-[#f6f8fb]/90 backdrop-blur flex items-center gap-3">
      <Link
        href={href}
        className="w-10 h-10 shrink-0 rounded-xl bg-white border border-slate-200 flex items-center justify-center active:scale-95 transition"
        aria-label="رجوع"
      >
        <ArrowRight className="w-5 h-5" />
      </Link>
      <div className="min-w-0">
        <h1 className="text-base font-extrabold truncate">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>
    </header>
  );
}

export function Loading() {
  return (
    <div className="flex justify-center py-16 text-slate-400">
      <Loader2 className="w-7 h-7 animate-spin" />
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="text-center py-16 text-slate-400 text-sm bg-white rounded-2xl border border-dashed border-slate-200">
      {text}
    </div>
  );
}
