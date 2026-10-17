"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Loader2, Paperclip, Pin, Send, ThumbsUp, Trash2 } from "lucide-react";
import { LoginRequired } from "@/components/LoginRequired";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { LEVELS } from "@/lib/types";
import { FORUM_CATEGORIES, timeAgo, type ForumReply, type ForumTopic } from "../shared";

export function TopicView({ id }: { id: string }) {
  const router = useRouter();
  const { loading, profile } = useProfile();
  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const isMember = Boolean(profile && profile.is_verified !== false && ["teacher", "inspector", "admin"].includes(profile.role));

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: t }, { data: r }, { data: v }] = await Promise.all([
      supabase.from("forum_topics").select("*").eq("id", id).maybeSingle(),
      supabase.from("forum_replies").select("*").eq("topic_id", id).order("is_official", { ascending: false }).order("votes", { ascending: false }).order("created_at"),
      supabase.from("forum_votes").select("target_type, target_id").eq("voter_id", profile.id),
    ]);
    if (!t) setNotFound(true);
    setTopic((t as ForumTopic) ?? null);
    setReplies((r as ForumReply[]) || []);
    setMyVotes(new Set((v || []).map((x) => `${x.target_type}:${x.target_id}`)));
  }, [id, profile]);

  useEffect(() => {
    if (isMember) load();
  }, [isMember, load]);

  const toggleVote = async (type: "topic" | "reply", targetId: string, authorId: string) => {
    if (!profile || authorId === profile.id) return;
    const key = `${type}:${targetId}`;
    setError("");
    const { error: err } = myVotes.has(key)
      ? await supabase.from("forum_votes").delete().eq("target_type", type).eq("target_id", targetId).eq("voter_id", profile.id)
      : await supabase.from("forum_votes").insert({ target_type: type, target_id: targetId, voter_id: profile.id });
    if (err) setError(err.message);
    await load();
  };

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || body.trim().length < 2) return;
    setBusy(true);
    const { error: err } = await supabase.from("forum_replies").insert({ topic_id: id, author_id: profile.id, body: body.trim() });
    setBusy(false);
    if (err) setError(err.message);
    else {
      setBody("");
      load();
    }
  };

  const togglePin = async () => {
    if (!topic) return;
    const { error: err } = await supabase.from("forum_topics").update({ is_pinned: !topic.is_pinned }).eq("id", topic.id);
    if (err) setError(err.message);
    else load();
  };

  const removeTopic = async () => {
    if (!topic || !confirm("حذف هذا الموضوع وكل إجاباته؟")) return;
    const { error: err } = await supabase.from("forum_topics").delete().eq("id", topic.id);
    if (err) return setError(err.message);
    if (topic.attachment_path) await supabase.storage.from("forum-files").remove([topic.attachment_path]);
    router.push("/forum");
  };

  const removeReply = async (r: ForumReply) => {
    if (!confirm("حذف هذه الإجابة؟")) return;
    const { error: err } = await supabase.from("forum_replies").delete().eq("id", r.id);
    if (err) setError(err.message);
    else load();
  };

  const openAttachment = async () => {
    if (!topic?.attachment_path) return;
    const { data } = await supabase.storage.from("forum-files").createSignedUrl(topic.attachment_path, 900);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (!isMember || !profile) return <LoginRequired next={`/forum/${id}`} title="ملتقى أساتذة الرياضيات" />;
  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-sm text-slate-500">
        الموضوع غير موجود أو حُذف. <Link href="/forum" className="text-indigo-600 font-bold">العودة للملتقى</Link>
      </div>
    );
  }
  if (!topic) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const cat = FORUM_CATEGORIES[topic.category] ?? FORUM_CATEGORIES.other;
  const canModerate = profile.role === "inspector" || profile.role === "admin";
  const topicVoted = myVotes.has(`topic:${topic.id}`);

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-4">
        <Link href="/forum" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium">
          <ArrowRight className="w-4 h-4" /> الملتقى
        </Link>

        <article className={`bg-white rounded-2xl border p-5 space-y-3 ${topic.is_pinned ? "border-amber-300" : "border-slate-100"}`}>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
            <span className={`px-1.5 py-0.5 rounded ${topic.kind === "resource" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>
              {topic.kind === "resource" ? "مورد مشترك" : "سؤال"}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              {cat.icon} {cat.label}
            </span>
            {topic.level && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{LEVELS[topic.level as 1 | 2 | 3 | 4]?.label}</span>}
            {topic.is_pinned && (
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-0.5">
                <Pin className="w-3 h-3" /> مثبت
              </span>
            )}
          </div>
          <h1 className="text-lg font-black text-slate-900">{topic.title}</h1>
          <p className="text-[11px] text-slate-500">
            <strong className="text-slate-700">{topic.author_name}</strong>
            {topic.author_role === "inspector" && " 🛡️ مفتش التربية الوطنية"} • {timeAgo(topic.created_at)}
          </p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{topic.body}</p>
          {topic.attachment_path && (
            <button onClick={openAttachment} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 inline-flex items-center gap-1">
              <Paperclip className="w-3.5 h-3.5" /> {topic.attachment_name || "المرفق"}
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => toggleVote("topic", topic.id, topic.author_id)}
              disabled={topic.author_id === profile.id}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border ${
                topicVoted ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
              } disabled:opacity-50`}
              title={topic.author_id === profile.id ? "لا يمكن التصويت على مشاركتك" : "مفيد"}
            >
              <ThumbsUp className="w-3.5 h-3.5" /> مفيد ({topic.votes})
            </button>
            {canModerate && (
              <button onClick={togglePin} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-200 bg-amber-50 text-amber-800 flex items-center gap-1">
                <Pin className="w-3.5 h-3.5" /> {topic.is_pinned ? "إلغاء التثبيت" : "تثبيت"}
              </button>
            )}
            {(topic.author_id === profile.id || profile.role === "admin") && (
              <button onClick={removeTopic} className="mr-auto px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-600 flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> حذف
              </button>
            )}
          </div>
        </article>

        {error && <p className="text-xs text-red-600 font-bold">{error}</p>}

        <h2 className="text-sm font-black text-slate-800">الإجابات ({replies.length})</h2>
        {replies.map((r) => {
          const voted = myVotes.has(`reply:${r.id}`);
          return (
            <div key={r.id} className={`rounded-2xl border p-4 space-y-2 ${r.is_official ? "bg-amber-50/70 border-amber-300" : "bg-white border-slate-100"}`}>
              {r.is_official && (
                <p className="text-[11px] font-black text-amber-800 flex items-center gap-1">
                  <BadgeCheck className="w-4 h-4" /> توجيه رسمي معتمد — مفتش التربية الوطنية 🛡️
                </p>
              )}
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{r.body}</p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <strong className="text-slate-700">{r.author_name}</strong>
                <span>{timeAgo(r.created_at)}</span>
                <button
                  onClick={() => toggleVote("reply", r.id, r.author_id)}
                  disabled={r.author_id === profile.id}
                  className={`mr-auto px-2 py-1 rounded-lg font-bold flex items-center gap-1 border ${
                    voted ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200"
                  } disabled:opacity-50`}
                >
                  <ThumbsUp className="w-3 h-3" /> {r.votes}
                </button>
                {(r.author_id === profile.id || profile.role === "admin") && (
                  <button onClick={() => removeReply(r)} className="p-1 text-slate-400 hover:text-red-600" aria-label="حذف">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <form onSubmit={reply} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
          <textarea
            className="w-full min-h-24 p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={profile.role === "inspector" ? "إجابتك ستظهر كتوجيه رسمي معتمد..." : "شارك خبرتك أو اقتراحك..."}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button disabled={busy || body.trim().length < 2} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} إرسال الإجابة
          </button>
        </form>
      </div>
    </div>
  );
}
