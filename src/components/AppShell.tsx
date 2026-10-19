"use client";

import { usePathname } from "next/navigation";
import { layoutFor } from "@/lib/layoutMode";

// صفحات المنصة الولائية بعرض كامل؛ فضاءات الأستاذ والتلميذ بعرض الهاتف، وبعضها يتسع على الحاسوب
export function AppShell({ children }: { children: React.ReactNode }) {
  const mode = layoutFor(usePathname() || "/");

  if (mode === "full") {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className={`mx-auto max-w-xl min-h-screen flex flex-col ${mode === "wide" ? "lg:max-w-6xl" : ""}`}>
      <main className="flex-1 px-3 sm:px-4 pb-10">{children}</main>
      <footer className="text-center text-xs text-slate-400 py-4">
        المنصة الرقمية لمادة الرياضيات — ولاية الوادي
      </footer>
    </div>
  );
}
