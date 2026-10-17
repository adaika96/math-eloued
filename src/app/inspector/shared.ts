import type { InspectorCircular, Lesson, PedagogicalNote, TimetableSlot, UserProfile } from "@/lib/types";

export const DISTRICTS_INFO: Record<number, string> = {
  1: "المقاطعة الأولى — الوادي 1",
  2: "المقاطعة الثانية — الوادي 2",
  3: "المقاطعة الثالثة — قمار",
  4: "المقاطعة الرابعة — الرقيبة",
  5: "المقاطعة الخامسة — الدبيلة والمقرن",
};

export interface TeacherStat {
  profile: UserProfile;
  lessonsCount: number;
  imagesCount: number;
  lastLessonAt: string | null;
  lastActivityAt: string | null;
  notesCount: number;
  pendingNotes: number;
  timetable: { slots: TimetableSlot[]; image_path?: string | null; updated_at?: string } | null;
}

export interface DistrictData {
  teachers: TeacherStat[];
  notes: PedagogicalNote[];
  circulars: InspectorCircular[];
  reads: { circular_id: string; teacher_id: string; read_at: string }[];
  schools: { id: string; name: string; commune: string }[];
}

export function normalizeLessons(value: unknown): Lesson[] {
  return Array.isArray(value) ? (value as Lesson[]) : [];
}

export function formatDate(iso?: string | null, withTime = false) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-DZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

// عدد الأيام منذ آخر نشاط (لتمييز الأساتذة غير المنتظمين في النشر)
export function daysSince(iso?: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
