export type ForumCategory = "situations" | "difficulties" | "assessments" | "diagnostic" | "tools" | "classroom" | "other";

export const FORUM_CATEGORIES: Record<ForumCategory, { label: string; icon: string }> = {
  situations: { label: "وضعيات انطلاقية وإدماجية", icon: "🧩" },
  difficulties: { label: "صعوبات التعلم", icon: "🧠" },
  assessments: { label: "فروض واختبارات", icon: "📝" },
  diagnostic: { label: "تقويمات تشخيصية", icon: "📊" },
  tools: { label: "الأدوات الهندسية والوسائل", icon: "📐" },
  classroom: { label: "التسيير الصفي", icon: "🏫" },
  other: { label: "عام", icon: "💬" },
};

export interface ForumTopic {
  id: string;
  author_id: string;
  author_name: string;
  author_role: "teacher" | "inspector" | "admin";
  kind: "question" | "resource";
  category: ForumCategory;
  level: number | null;
  title: string;
  body: string;
  attachment_path: string | null;
  attachment_name: string | null;
  votes: number;
  replies_count: number;
  has_official: boolean;
  is_pinned: boolean;
  created_at: string;
}

export interface ForumReply {
  id: string;
  topic_id: string;
  author_id: string;
  author_name: string;
  author_role: "teacher" | "inspector" | "admin";
  body: string;
  is_official: boolean;
  votes: number;
  created_at: string;
}

// شارات التفاعل حسب النقاط (خطة المنصة: أستاذ مبادر، مساهم متميز، خبير الميدان)
export function badgeFor(points: number, role?: string) {
  if (role === "inspector") return { label: "مفتش التربية الوطنية 🛡️", className: "bg-amber-100 text-amber-900 border-amber-300" };
  if (points >= 100) return { label: "خبير الميدان 🏆", className: "bg-purple-50 text-purple-800 border-purple-200" };
  if (points >= 30) return { label: "مساهم متميز ⭐", className: "bg-sky-50 text-sky-800 border-sky-200" };
  if (points > 0) return { label: "أستاذ مبادر 🌱", className: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  return null;
}

export function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} سا`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return new Date(iso).toLocaleDateString("ar-DZ", { day: "numeric", month: "short", year: "numeric" });
}
