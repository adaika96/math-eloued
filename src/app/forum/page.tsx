"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, FileUp, Loader2, MessageSquare, Pin, Plus, Search, ThumbsUp, Trophy, Upload, Users } from "lucide-react";
import { LoginRequired } from "@/components/LoginRequired";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { safeStorageName, validateUpload, compressIfImage } from "@/lib/compress";
import { LEVELS } from "@/lib/types";
import { FORUM_CATEGORIES, badgeFor, timeAgo, type ForumCategory, type ForumTopic } from "./shared";

type Leader = { author_id: string; author_name: string; author_role: string; points: number; posts: number };

const inputCls = "w-full py-2 px-3 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function ForumPage() {
  const { loading, profile } = useProfile();
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [kind, setKind] = useState<"all" | "question" | "resource">("all");
  const [category, setCategory] = useState<"all" | ForumCategory>("all");
  const [level, setLevel] = useState<"all" | number>("all");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

  const isMember = Boolean(profile && profile.is_verified !== false && ["teacher", "inspector", "admin"].includes(profile.role));

  const load = useCallback(async () => {
    setLoadingTopics(true);
    const [{ data }, { data: lb }] = await Promise.all([
      supabase.from("forum_topics").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(200),
      supabase.rpc("forum_leaderboard", { p_limit: 8 }),
    ]);
    setTopics((data as ForumTopic[]) || []);
    setLeaders((lb as Leader[]) || []);
    setLoadingTopics(false);
  }, []);

  useEffect(() => {
    if (isMember) load();
  }, [isMember, load]);

  const pointsOf = useMemo(() => Object.fromEntries(leaders.map((l) => [l.author_id, Number(l.points)])), [leaders]);

  const filtered = topics.filter((t) => {
    const q = query.trim();
    return (
      (kind === "all" || t.kind === kind) &&
      (category === "all" || t.category === category) &&
      (level === "all" || t.level === level) &&
      (!q || t.title.includes(q) || t.body.includes(q))
    );
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (!isMember || !profile) return <LoginRequired next="/forum" title="ملتقى أساتذة الرياضيات" />;

  const back = profile.role === "inspector" ? "/inspector" : profile.role === "admin" ? "/super-admin" : "/admin";

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <div className="bg-gradient-to-b from-indigo-900 to-indigo-700 text-white px-4 pt-6 pb-10">
        <div className="max-w-5xl mx-auto space-y-3">
          <Link href={back} className="inline-flex items-center gap-1 text-xs text-indigo-200 hover:text-white bg-white/10 px-3 py-1.5 rounded-full">
            <ArrowRight className="w-3.5 h-3.5" /> لوحتي
          </Link>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Users className="w-7 h-7" /> ملتقى أساتذة الرياضيات — ولاية الوادي
          </h1>
          <p className="text-xs text-indigo-100 max-w-2xl">
            اطرح إشكالياتك البيداغوجية، وشارك وضعياتك وسلاسلك المجربة. إجابات المفتشين تظهر كتوجيه رسمي معتمد. فضاء خاص بالأساتذة والمفتشين لا يراه الأولياء.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 pb-16">
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow p-3 space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              {(
                [
                  ["all", "الكل"],
                  ["question", "❓ أسئلة وإشكاليات"],
                  ["resource", "📚 بنك الموارد والوضعيات"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${kind === k ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setShowForm((v) => !v)}
                className="mr-auto px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> مشاركة جديدة
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative">
                <input className={`${inputCls} pr-8`} placeholder="بحث..." value={query} onChange={(e) => setQuery(e.target.value)} />
                <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2" />
              </div>
              <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
                <option value="all">كل المواضيع</option>
                {(Object.keys(FORUM_CATEGORIES) as ForumCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {FORUM_CATEGORIES[c].icon} {FORUM_CATEGORIES[c].label}
                  </option>
                ))}
              </select>
              <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value === "all" ? "all" : Number(e.target.value))}>
                <option value="all">كل المستويات</option>
                {([1, 2, 3, 4] as const).map((l) => (
                  <option key={l} value={l}>
                    {LEVELS[l].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showForm && <NewTopicForm authorId={profile.id} onCreated={() => { setShowForm(false); load(); }} />}

          {loadingTopics ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-xs text-slate-400">
              لا توجد مشاركات بعد. كن أول من يطرح سؤالاً أو يشارك وضعية!
            </div>
          ) : (
            filtered.map((t) => {
              const cat = FORUM_CATEGORIES[t.category] ?? FORUM_CATEGORIES.other;
              const badge = badgeFor(pointsOf[t.author_id] || 0, t.author_role);
              return (
                <Link
                  key={t.id}
                  href={`/forum/${t.id}`}
                  className={`block bg-white rounded-2xl border p-4 hover:border-indigo-300 transition ${t.is_pinned ? "border-amber-300" : "border-slate-100"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 text-slate-500 shrink-0 w-10">
                      <ThumbsUp className="w-4 h-4" />
                      <span className="text-sm font-black text-slate-700">{t.votes}</span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                        {t.is_pinned && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-0.5">
                            <Pin className="w-3 h-3" /> مثبت
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded ${t.kind === "resource" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>
                          {t.kind === "resource" ? "مورد مشترك" : "سؤال"}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {cat.icon} {cat.label}
                        </span>
                        {t.level && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{t.level}م</span>}
                        {t.has_official && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 flex items-center gap-0.5">
                            <BadgeCheck className="w-3 h-3" /> توجيه رسمي
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-800">{t.title}</h3>
                      <p className="text-xs text-slate-500 line-clamp-2">{t.body}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                        <span className="font-bold text-slate-600">{t.author_name}</span>
                        {badge && <span className={`px-1.5 py-0.5 rounded border ${badge.className}`}>{badge.label}</span>}
                        <span>{timeAgo(t.created_at)}</span>
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="w-3 h-3" /> {t.replies_count}
                        </span>
                        {t.attachment_path && <span>📎 مرفق</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <aside className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow p-4 space-y-2">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" /> الأكثر إفادة
            </h3>
            {leaders.length === 0 ? (
              <p className="text-xs text-slate-400">لا توجد مشاركات بعد.</p>
            ) : (
              <ol className="space-y-1.5">
                {leaders.map((l, i) => {
                  const badge = badgeFor(Number(l.points), l.author_role);
                  return (
                    <li key={l.author_id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0">
                        <span className="font-black text-slate-400 ml-1">{i + 1}.</span>
                        <span className="font-bold text-slate-700">{l.author_name}</span>
                        {badge && <span className="block text-[10px] text-slate-500">{badge.label}</span>}
                      </span>
                      <span className="font-black text-indigo-700 shrink-0">{l.points} ن</span>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
              النقاط: 10 لكل صوت تأييد • 5 لكل مورد مشترك • 2 لكل إجابة • 1 لكل سؤال
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function NewTopicForm({ authorId, onCreated }: { authorId: string; onCreated: () => void }) {
  const [kind, setKind] = useState<"question" | "resource">("question");
  const [category, setCategory] = useState<ForumCategory>("situations");
  const [level, setLevel] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    let attachmentPath: string | null = null;
    try {
      if (file) {
        const invalid = validateUpload(file);
        if (invalid) throw new Error(invalid);
        const prepared = await compressIfImage(file);
        attachmentPath = `${authorId}/${safeStorageName(prepared.name)}`;
        const { error: upErr } = await supabase.storage.from("forum-files").upload(attachmentPath, prepared, { contentType: prepared.type });
        if (upErr) throw new Error(upErr.message);
      }
      const { error: insErr } = await supabase.from("forum_topics").insert({
        author_id: authorId,
        kind,
        category,
        level: level ? Number(level) : null,
        title: title.trim(),
        body: body.trim(),
        attachment_path: attachmentPath,
        attachment_name: file?.name ?? null,
      });
      if (insErr) {
        if (attachmentPath) await supabase.storage.from("forum-files").remove([attachmentPath]);
        throw new Error(insErr.message);
      }
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-emerald-200 shadow p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["question", "❓ أطرح سؤالاً / إشكالية"],
            ["resource", "📚 أشارك مورداً (وضعية، سلسلة، مذكرة نموذجية)"],
          ] as const
        ).map(([k, label]) => (
          <button
            type="button"
            key={k}
            onClick={() => setKind(k)}
            className={`p-2 rounded-xl border text-xs font-bold ${kind === k ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-50 border-slate-200 text-slate-600"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as ForumCategory)}>
          {(Object.keys(FORUM_CATEGORIES) as ForumCategory[]).map((c) => (
            <option key={c} value={c}>
              {FORUM_CATEGORIES[c].icon} {FORUM_CATEGORIES[c].label}
            </option>
          ))}
        </select>
        <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">كل المستويات</option>
          {([1, 2, 3, 4] as const).map((l) => (
            <option key={l} value={l}>
              {LEVELS[l].label}
            </option>
          ))}
        </select>
      </div>
      <input className={inputCls} placeholder="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={200} />
      <textarea
        className={`${inputCls} min-h-28`}
        placeholder={kind === "question" ? "اشرح الإشكالية: المستوى، الدرس، ما جربته..." : "قدّم المورد: الهدف، الكفاءة المستهدفة، كيف استعملته في القسم..."}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        minLength={3}
      />
      <label className="flex items-center gap-2 p-2.5 rounded-xl border border-dashed border-slate-300 text-xs text-slate-600 cursor-pointer">
        <Upload className="w-4 h-4 shrink-0" />
        <span className="truncate">{file ? file.name : "إرفاق صورة أو PDF (اختياري)"}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {error && <p className="text-xs text-red-600 font-bold">{error}</p>}
      <button disabled={busy} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} نشر في الملتقى
      </button>
    </form>
  );
}
