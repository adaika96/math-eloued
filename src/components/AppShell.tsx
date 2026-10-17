"use client";

import { usePathname } from "next/navigation";

// صفحات المنصة الولائية بعرض كامل؛ فضاءات الأستاذ والتلميذ بعرض الهاتف
const FULL_WIDTH_PREFIXES = ["/inspector", "/super-admin", "/login", "/register", "/t/", "/forum"];

function isFullWidth(pathname: string) {
  return pathname === "/" || FULL_WIDTH_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";

  if (isFullWidth(pathname)) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="mx-auto max-w-xl min-h-screen flex flex-col">
      <main className="flex-1 px-3 sm:px-4 pb-10">{children}</main>
      <footer className="text-center text-xs text-slate-400 py-4">
        المنصة الرقمية لمادة الرياضيات — ولاية الوادي
      </footer>
    </div>
  );
}
