"use client";

import { useState } from "react";
import {
  Megaphone,
  AlertTriangle,
  BookOpen,
  Bell,
  Pin,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Calendar,
} from "lucide-react";
import { Announcement, AnnouncementCategory } from "@/lib/types";

const CATEGORY_STYLES: Record<
  AnnouncementCategory,
  {
    badge: string;
    badgeBg: string;
    border: string;
    bg: string;
    icon: any;
    iconColor: string;
  }
> = {
  absence: {
    badge: "تنبيه غياب ⚠️",
    badgeBg: "bg-red-100 text-red-800 border-red-200",
    border: "border-red-300",
    bg: "bg-gradient-to-r from-red-50 via-rose-50 to-amber-50",
    icon: AlertTriangle,
    iconColor: "text-red-600",
  },
  urgent: {
    badge: "عاجل وهام 🚨",
    badgeBg: "bg-rose-100 text-rose-800 border-rose-200",
    border: "border-rose-400",
    bg: "bg-gradient-to-r from-rose-50 via-red-50 to-orange-50",
    icon: AlertTriangle,
    iconColor: "text-rose-600",
  },
  lesson: {
    badge: "دروس وواجبات 📚",
    badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-200",
    border: "border-emerald-200",
    bg: "bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50",
    icon: BookOpen,
    iconColor: "text-emerald-600",
  },
  update: {
    badge: "تحديث الموقع 🔔",
    badgeBg: "bg-sky-100 text-sky-800 border-sky-200",
    border: "border-sky-200",
    bg: "bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50",
    icon: Bell,
    iconColor: "text-sky-600",
  },
  general: {
    badge: "إعلان وتنبيه 📢",
    badgeBg: "bg-slate-100 text-slate-800 border-slate-200",
    border: "border-slate-200",
    bg: "bg-gradient-to-r from-slate-50 via-gray-50 to-zinc-50",
    icon: Megaphone,
    iconColor: "text-slate-700",
  },
};

export default function HomeAnnouncements({
  announcements = [],
}: {
  announcements: Announcement[];
}) {
  const [expanded, setExpanded] = useState(false);

  const activeItems = announcements.filter((a) => a.active !== false);
  if (activeItems.length === 0) return null;

  // إظهار الإعلان الأهم (أو المثبت) في الواجهة، والبقية قابلة للتوسيع
  const mainItem = activeItems[0];
  const otherItems = activeItems.slice(1);

  const mainStyle = CATEGORY_STYLES[mainItem.category] || CATEGORY_STYLES.general;
  const MainIcon = mainStyle.icon;

  return (
    <div className="space-y-2">
      {/* الإعلان الرئيسي الأول */}
      <div
        className={`rounded-2xl p-4 border-2 shadow-xs transition ${mainStyle.border} ${mainStyle.bg}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl bg-white shadow-2xs flex items-center justify-center shrink-0 ${mainStyle.iconColor}`}
          >
            <MainIcon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border shadow-2xs ${mainStyle.badgeBg}`}
              >
                {mainStyle.badge}
              </span>

              {mainItem.pinned && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                  <Pin className="w-2.5 h-2.5 fill-amber-700 text-amber-700" /> مثبت
                </span>
              )}

              {mainItem.date && (
                <span className="text-[10px] font-bold text-slate-500 mr-auto flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {mainItem.date}
                </span>
              )}
            </div>

            <h3 className="text-sm font-black text-slate-900 mt-2 leading-snug">
              {mainItem.title}
            </h3>

            <p className="text-xs text-slate-700 mt-1.5 leading-relaxed font-medium whitespace-pre-line">
              {mainItem.content}
            </p>
          </div>
        </div>
      </div>

      {/* باقي الإعلانات إن وجدت */}
      {otherItems.length > 0 && (
        <div className="space-y-2">
          {expanded && (
            <div className="space-y-2 pt-1 fade-in">
              {otherItems.map((item) => {
                const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.general;
                const Icon = style.icon;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl p-3.5 border shadow-2xs ${style.border} ${style.bg}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-lg bg-white shadow-2xs flex items-center justify-center shrink-0 ${style.iconColor}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${style.badgeBg}`}
                          >
                            {style.badge}
                          </span>
                          {item.pinned && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                              <Pin className="w-2.5 h-2.5 fill-amber-700 text-amber-700" /> مثبت
                            </span>
                          )}
                          {item.date && (
                            <span className="text-[10px] text-slate-500 mr-auto">
                              {item.date}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-black text-slate-900 mt-1">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-slate-700 mt-1 leading-relaxed whitespace-pre-line">
                          {item.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition active:scale-[0.99]"
          >
            <span>
              {expanded
                ? "إخفاء باقي الإعلانات"
                : `عرض إعلانات أخرى سابقة (${otherItems.length})`}
            </span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
