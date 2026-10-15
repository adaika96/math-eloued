import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { TeacherAccess } from "@/components/TeacherAccess";
import PWAInstallBanner from "@/components/PWAInstallBanner";

export const metadata: Metadata = {
  title: "دروس الرياضيات | الأستاذ محمد عدايكة",
  description: "دروس الرياضيات للسنة الأولى والثانية متوسط ودفتر التقييم الميداني السريع - متوسطة باهي علي",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "رياضيات عدايكة",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#059669",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body>
        <ServiceWorkerRegister />
        <TeacherAccess />
        <PWAInstallBanner />
        <div className="mx-auto max-w-xl min-h-screen flex flex-col">
          <main className="flex-1 px-3 sm:px-4 pb-10">{children}</main>
          <footer className="text-center text-xs text-slate-400 py-4">
            الأستاذ محمد عدايكة — متوسطة باهي علي
          </footer>
        </div>
      </body>
    </html>
  );
}
