"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Megaphone, MessagesSquare, Trash2, UserX } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";
import { fmtDateTime } from "./AuditLogTab";

type Topic = { id: string; title: string; body: string; author_id: string; author_name: string; created_at: string };
type Reply = { id: string; topic_id: string; body: string; author_id: string; author_name: string; created_at: string };
type Announcement = { teacher_id: string; teacher_name: string; slug: string | null; title: string; content: string; category: string; created_at: string | null };

const LIMIT = 30;
const card = "bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3";

// مراقبة المحتوى: حذف مشاركات الملتقى، ومراجعة إعلانات الأساتذة العامة (قراءة + تعليق الحساب)
export function ModerationTab({ profiles, onSuspend }: { profiles: UserProfile[]; onSuspend: (teacherId: string) => void }) {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verified = new Map(profiles.map((p) => [p.id, p.is_verified]));

  const loadForum = useCallback(async () => {
    const [t, r] = await Promise.all([
      supabase.from("forum_topics").select("id, title, body, author_id, author_name, created_at").order("created_at", { ascending: false }).limit(LIMIT),
      supabase.from("forum_replies").select("id, topic_id, body, author_id, author_name, created_at").order("created_at", { ascending: false }).limit(LIMIT),
    ]);
    setError(t.error?.message || r.error?.message || null);
    setTopics((t.data as Topic[]) || []);
    setReplies((r.data as Reply[]) || []);
  }, []);

  useEffect(() => {
    loadForum();
    supabase.rpc("admin_recent_announcements", { p_limit: 50 }).then(({ data, error }) => {
      if (error) setError(error.message);
      setAnnouncements((data as Announcement[]) || []);
    });
  }, [loadForum]);

  const remove = async (table: "forum_topics" | "forum_replies", id: string, label: string) => {
    if (!confirm(`حذف ${label} نهائياً من الملتقى؟`)) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) setError(error.message);
    else loadForum();
  };

  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
      {error && <p className="lg:col-span-2 text-xs font-bold text-red-600">{error}</p>}

      <section className={card}>
        <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
          <MessagesSquare className="w-4 h-4 text-indigo-600" /> آخر مشاركات الملتقى
        </h3>
        {!topics ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
        ) : topics.length + replies.length === 0 ? (
          <p className="text-xs text-slate-400">لا توجد مشاركات بعد</p>
        ) : (
          <ul className="space-y-2">
            {[
              ...topics.map((t) => ({ kind: "topic" as const, id: t.id, topicId: t.id, title: t.title, body: t.body, author: t.author_name, at: t.created_at })),
              ...replies.map((r) => ({ kind: "reply" as const, id: r.id, topicId: r.topic_id, title: "رد", body: r.body, author: r.author_name, at: r.created_at })),
            ]
              .sort((a, b) => b.at.localeCompare(a.at))
              .slice(0, LIMIT)
              .map((p) => (
                <li key={`${p.kind}-${p.id}`} className="rounded-xl border border-slate-100 p-3 text-xs space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/forum/${p.topicId}`} target="_blank" className="font-bold text-slate-800 hover:text-indigo-700 min-w-0">
                      {p.kind === "topic" ? p.title : "↳ رد على موضوع"}
                    </Link>
                    <button
                      onClick={() => remove(p.kind === "topic" ? "forum_topics" : "forum_replies", p.id, p.kind === "topic" ? "هذا الموضوع وكل ردوده" : "هذا الرد")}
                      className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                      aria-label="حذف"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-slate-600 line-clamp-2 whitespace-pre-wrap">{p.body}</p>
                  <p className="text-[10px] text-slate-400">
                    {p.author || "—"} • {fmtDateTime(p.at)}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-indigo-600" /> إعلانات الأساتذة للأولياء
        </h3>
        <p className="text-[11px] text-slate-500">للمراجعة فقط؛ المحتوى يعدّله صاحبه. عند المخالفة يمكن تعليق الحساب فتُحجب صفحته العامة.</p>
        {!announcements ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
        ) : announcements.length === 0 ? (
          <p className="text-xs text-slate-400">لا توجد إعلانات</p>
        ) : (
          <ul className="space-y-2">
            {announcements.map((a, i) => (
              <li key={`${a.teacher_id}-${i}`} className="rounded-xl border border-slate-100 p-3 text-xs space-y-1">
                <p className="font-bold text-slate-800">{a.title}</p>
                <p className="text-slate-600 line-clamp-2 whitespace-pre-wrap">{a.content}</p>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                  <span className="font-bold text-slate-600">{a.teacher_name}</span>
                  {a.created_at && <span>{fmtDateTime(a.created_at)}</span>}
                  {a.slug && (
                    <Link href={`/t/${a.slug}`} target="_blank" className="mr-auto inline-flex items-center gap-1 text-indigo-600 font-bold">
                      <ExternalLink className="w-3 h-3" /> فتح صفحة الأستاذ
                    </Link>
                  )}
                  {verified.get(a.teacher_id) !== false ? (
                    <button onClick={() => onSuspend(a.teacher_id)} className="inline-flex items-center gap-1 text-red-600 font-bold">
                      <UserX className="w-3 h-3" /> تعليق الحساب
                    </button>
                  ) : (
                    <span className="text-rose-600 font-bold">الحساب معلق</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
