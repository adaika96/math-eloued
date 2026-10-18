import { del, get } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { LessonsData } from "./types";
import type { TeacherContext } from "./auth";
import { BUCKETS } from "./supabase";

const LOCAL_DATA_FILE = path.join(process.cwd(), "data", "lessons.json");
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export function getBlobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

// مزامنة تامة ومتبادلة بين قائمة تلاميذ القسم (studentRoster) وسجلات التقويم (evaluations)
export function synchronizeStudents(data: LessonsData): LessonsData {
  if (!data.studentRoster) data.studentRoster = [];
  if (!data.evaluations) data.evaluations = [];

  // 1. كل تلميذ في studentRoster ينعكس تلقائياً في evaluations
  for (const r of data.studentRoster) {
    const rName = (r.studentName || "").trim();
    if (!rName) continue;
    const rCls = (r.className || "").replace(/\s+/g, "");
    const exists = data.evaluations.some(
      (e) =>
        (e.studentName || "").trim().toLowerCase() === rName.toLowerCase() &&
        (e.className || "").replace(/\s+/g, "") === rCls
    );
    if (!exists) {
      data.evaluations.push({
        id: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        studentName: rName,
        className: r.className,
        groupName: r.groupName || "فوج 1",
        notebookScore: 5,
        notebookComplete: true,
        homeworkScore: 5,
        homeworkDone: true,
        toolsScore: 5,
        hasTools: true,
        activityScore: 5,
        totalScore: 20,
        rating: "excellent",
        ratingColor: "emerald",
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // 2. كل تلميذ في evaluations ينعكس تلقائياً في studentRoster
  for (const e of data.evaluations) {
    const eName = (e.studentName || "").trim();
    if (!eName) continue;
    const eCls = (e.className || "").replace(/\s+/g, "");
    const exists = data.studentRoster.some(
      (r) =>
        (r.studentName || "").trim().toLowerCase() === eName.toLowerCase() &&
        (r.className || "").replace(/\s+/g, "") === eCls
    );
    if (!exists) {
      data.studentRoster.push({
        id: `rst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        studentName: eName,
        className: e.className,
        groupName: e.groupName || "فوج 1",
      });
    }
  }

  return data;
}

// ==========================================================
// فضاء كل أستاذ في Supabase (teacher_public_data / teacher_private_data)
// ==========================================================

// ما يراه الأولياء والتلاميذ
const PUBLIC_KEYS = ["lessons", "honors", "announcements", "summons"] as const;
// ما يبقى خاصاً بالأستاذ وحده
const PRIVATE_KEYS = ["evaluations", "penalties", "inspectionSessions", "studentRoster", "anonymousMessages"] as const;

export function normalizeData(json: any): LessonsData {
  return {
    lessons: Array.isArray(json?.lessons) ? json.lessons : [],
    summons: Array.isArray(json?.summons) ? json.summons : [],
    honors: Array.isArray(json?.honors) ? json.honors : [],
    penalties: Array.isArray(json?.penalties) ? json.penalties : [],
    evaluations: Array.isArray(json?.evaluations) ? json.evaluations : [],
    inspectionSessions: Array.isArray(json?.inspectionSessions) ? json.inspectionSessions : [],
    studentRoster: Array.isArray(json?.studentRoster) ? json.studentRoster : [],
    announcements: Array.isArray(json?.announcements) ? json.announcements : [],
    anonymousMessages: Array.isArray(json?.anonymousMessages) ? json.anonymousMessages : [],
  };
}

function pick(data: LessonsData, keys: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = (data as any)[k] ?? [];
  return out;
}

async function readRow(ctx: TeacherContext, table: "teacher_public_data" | "teacher_private_data") {
  const { data, error } = await ctx.supabase
    .from(table)
    .select("data")
    .eq("teacher_id", ctx.teacherId)
    .maybeSingle();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ? (data.data as Record<string, unknown>) : null;
}

// ----------------- ترحيل بيانات الموقع القديم (lessons-db.json) لمرة واحدة -----------------
// يُستورد فقط لحساب الأستاذ صاحب البريد LEGACY_OWNER_EMAIL عند أول دخول وفضاؤه فارغ
const LEGACY_PUBLIC_DB_URL = "https://zcvevxcbfufx3f96.public.blob.vercel-storage.com/lessons-db.json";

async function loadLegacyData(): Promise<LessonsData | null> {
  const privateToken = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
  try {
    if (privateToken) {
      const result = await get("lessons-db.json", { access: "private", token: privateToken, useCache: false });
      if (result && result.statusCode === 200) return normalizeData(await new Response(result.stream).json());
    }
    if (getBlobToken()) {
      const res = await fetch(`${LEGACY_PUBLIC_DB_URL}?_t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) return normalizeData(await res.json());
    }
  } catch (e) {
    console.warn("Legacy blob import failed:", e);
  }
  try {
    return normalizeData(JSON.parse(await fs.readFile(LOCAL_DATA_FILE, "utf-8")));
  } catch {
    return null;
  }
}

function isLegacyOwner(ctx: TeacherContext) {
  const owner = process.env.LEGACY_OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(owner && ctx.email && ctx.email.toLowerCase() === owner);
}

// القراءة العامة عبر دالة قاعدة البيانات التي تحجب الحل النموذجي قبل موعد نشره
export async function readPublicTeacherData(supabase: TeacherContext["supabase"], teacherId: string): Promise<LessonsData> {
  const { data, error } = await supabase.rpc("get_teacher_public_data", { p_teacher_id: teacherId });
  if (error) throw new Error(`get_teacher_public_data: ${error.message}`);
  return normalizeData(data ?? {});
}

// ----------------- قراءة بيانات الأستاذ -----------------
export async function getLessonsData(ctx: TeacherContext): Promise<LessonsData> {
  if (ctx.mode === "public") {
    return readPublicTeacherData(ctx.supabase, ctx.teacherId);
  }
  const publicData = await readRow(ctx, "teacher_public_data");

  const privateData = await readRow(ctx, "teacher_private_data");
  if (!publicData && !privateData && isLegacyOwner(ctx)) {
    const legacy = await loadLegacyData();
    if (legacy) {
      synchronizeStudents(legacy);
      await writeRows(ctx, legacy);
      return legacy;
    }
  }
  return synchronizeStudents(normalizeData({ ...(publicData ?? {}), ...(privateData ?? {}) }));
}

async function writeRows(ctx: TeacherContext, data: LessonsData) {
  const now = new Date().toISOString();
  const [pub, priv] = await Promise.all([
    ctx.supabase
      .from("teacher_public_data")
      .upsert({ teacher_id: ctx.teacherId, data: pick(data, PUBLIC_KEYS), updated_at: now }),
    ctx.supabase
      .from("teacher_private_data")
      .upsert({ teacher_id: ctx.teacherId, data: pick(data, PRIVATE_KEYS), updated_at: now }),
  ]);
  if (pub.error) throw new Error(`teacher_public_data: ${pub.error.message}`);
  if (priv.error) throw new Error(`teacher_private_data: ${priv.error.message}`);
}

// ----------------- حفظ بيانات الأستاذ -----------------
async function executeSave(ctx: TeacherContext, data: LessonsData): Promise<void> {
  // دمج وقائي صارم لمنع فقدان الدروس أو التلاميذ عند حدوث أي خطأ في الكاش
  try {
    const existing = await getLessonsData(ctx);
    if ((!data.lessons || data.lessons.length === 0) && existing.lessons && existing.lessons.length > 0) {
      data.lessons = existing.lessons;
    }
    if ((!data.studentRoster || data.studentRoster.length === 0) && existing.studentRoster && existing.studentRoster.length > 0) {
      data.studentRoster = existing.studentRoster;
    }
    if ((!data.evaluations || data.evaluations.length === 0) && existing.evaluations && existing.evaluations.length > 0) {
      data.evaluations = existing.evaluations;
    }
    if ((!data.inspectionSessions || data.inspectionSessions.length === 0) && existing.inspectionSessions && existing.inspectionSessions.length > 0) {
      data.inspectionSessions = existing.inspectionSessions;
    }
    if (data.announcements === undefined && existing.announcements) {
      data.announcements = existing.announcements;
    }
    if (data.anonymousMessages === undefined && existing.anonymousMessages) {
      data.anonymousMessages = existing.anonymousMessages;
    }
  } catch (mergeErr) {
    console.warn("Could not merge existing data before save:", mergeErr);
  }

  synchronizeStudents(data);
  await writeRows(ctx, data);
}

// طابور كتابة لكل أستاذ لمنع تداخل الحفظ المتزامن
const writeQueues = new Map<string, Promise<unknown>>();

export function saveLessonsData(ctx: TeacherContext, data: LessonsData): Promise<void> {
  if (ctx.mode !== "owner") {
    return Promise.reject(new Error("غير مصرح بتعديل بيانات أستاذ آخر"));
  }
  const prev = writeQueues.get(ctx.teacherId) ?? Promise.resolve();
  const next = prev.then(() => executeSave(ctx, data));
  writeQueues.set(ctx.teacherId, next.catch(() => {}));
  return next;
}

// ----------------- رفع صورة / ملف إلى مخزن Supabase العام -----------------
export async function uploadImageFile(
  ctx: TeacherContext,
  file: File | Blob,
  fileName: string,
  lessonId: string,
  level: number
): Promise<{ url: string; downloadUrl: string }> {
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueName = `${Date.now()}-${randomBytes(12).toString("hex")}-${safeName}`;
  // المجلد الأول = معرّف الأستاذ (تفرضه سياسة التخزين)
  const objectPath = `${ctx.teacherId}/lessons/${level}/${lessonId}/${uniqueName}`;
  const bucket = ctx.supabase.storage.from(BUCKETS.PUBLIC_LESSONS);

  const { error } = await bucket.upload(objectPath, file, {
    contentType: (file as File).type || undefined,
    upsert: false,
  });
  if (error) throw new Error(`فشل رفع الملف: ${error.message}`);

  return {
    url: bucket.getPublicUrl(objectPath).data.publicUrl,
    downloadUrl: bucket.getPublicUrl(objectPath, { download: safeName }).data.publicUrl,
  };
}

// ----------------- حذف صورة -----------------
const SUPABASE_PUBLIC_MARKER = `/storage/v1/object/public/${BUCKETS.PUBLIC_LESSONS}/`;

export async function deleteImageFile(ctx: TeacherContext, url: string): Promise<void> {
  // روابط الصور مخزنة في بيانات يكتبها الأستاذ نفسه، فلا نثق بها: الحذف محصور في ملفاته فقط
  const markerIndex = url.indexOf(SUPABASE_PUBLIC_MARKER);
  if (markerIndex !== -1) {
    const objectPath = decodeURIComponent(url.slice(markerIndex + SUPABASE_PUBLIC_MARKER.length).split("?")[0]);
    if (!objectPath.startsWith(`${ctx.teacherId}/`) || objectPath.split("/").includes("..")) {
      console.warn("Refusing to delete storage object outside the teacher's folder:", objectPath);
      return;
    }
    const { error } = await ctx.supabase.storage.from(BUCKETS.PUBLIC_LESSONS).remove([objectPath]);
    if (error) console.error("Error deleting storage object:", error);
    return;
  }

  // ملفات الموقع القديم تخص صاحبه وحده (تُحذف بمفتاح الخادم، لذا لا يُسمح بها لغيره)
  if (!isLegacyOwner(ctx)) return;

  // صور قديمة على Vercel Blob (الموقع الأصلي)
  const token = getBlobToken();
  if (token && url.includes(".blob.vercel-storage.com/")) {
    try {
      await del(url, { token });
    } catch (e) {
      console.error("Error deleting blob:", e);
    }
    return;
  }

  // صور محلية قديمة: يجب أن يبقى المسار داخل مجلد الرفع
  if (url.startsWith("/uploads/")) {
    const fullPath = path.resolve(LOCAL_UPLOADS_DIR, url.slice("/uploads/".length));
    if (!fullPath.startsWith(LOCAL_UPLOADS_DIR + path.sep)) {
      console.warn("Refusing to delete file outside uploads dir:", url);
      return;
    }
    try {
      await fs.unlink(fullPath);
    } catch (e) {
      console.error("Error deleting local file:", e);
    }
  }
}
