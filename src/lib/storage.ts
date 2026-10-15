import { put, del, list, get } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";
import { Lesson, LessonsData } from "./types";

const LOCAL_DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_DATA_FILE = path.join(LOCAL_DATA_DIR, "lessons.json");
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export function getBlobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

export function isVercelBlobConfigured(): boolean {
  return Boolean(getBlobToken());
}

// Ensure local folders exist
async function ensureLocalDirs() {
  await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
  await fs.mkdir(LOCAL_UPLOADS_DIR, { recursive: true });
}

// Mutex lock to serialize writes and prevent concurrent race conditions
let writeQueue: Promise<any> = Promise.resolve();

// استخراج الطابع الزمني الرقمي من مسار النسخة db/v-123456.json
function getVersionTs(pathname: string, uploadedAt?: string | Date): number {
  const match = pathname.match(/v-(\d+)\.json/);
  if (match) return Number(match[1]);
  return uploadedAt ? new Date(uploadedAt).getTime() : 0;
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

const FIXED_BLOB_DB_URL = "https://zcvevxcbfufx3f96.public.blob.vercel-storage.com/lessons-db.json";

// ----------------- قراءة بيانات الدروس -----------------
export async function getLessonsData(): Promise<LessonsData> {
  const token = getBlobToken();

  if (token) {
    try {
      // قراءة مباشرة وفورية للملف الثابت lessons-db.json دون استهلاك أي Advanced Requests (list)
      const res = await fetch(`${FIXED_BLOB_DB_URL}?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      if (res.ok) {
        const json = await res.json();
        const rawResult: LessonsData = {
          lessons: Array.isArray(json.lessons) ? json.lessons : [],
          summons: Array.isArray(json.summons) ? json.summons : [],
          honors: Array.isArray(json.honors) ? json.honors : [],
          penalties: Array.isArray(json.penalties) ? json.penalties : [],
          evaluations: Array.isArray(json.evaluations) ? json.evaluations : [],
          inspectionSessions: Array.isArray(json.inspectionSessions) ? json.inspectionSessions : [],
          studentRoster: Array.isArray(json.studentRoster) ? json.studentRoster : [],
          announcements: Array.isArray(json.announcements) ? json.announcements : [],
          anonymousMessages: Array.isArray(json.anonymousMessages) ? json.anonymousMessages : [],
        };
        const result = synchronizeStudents(rawResult);
        // حفظ نسخة محلية احتياطية
        ensureLocalDirs()
          .then(() => fs.writeFile(LOCAL_DATA_FILE, JSON.stringify(result, null, 2), "utf-8"))
          .catch(() => {});
        return result;
      }
    } catch (fetchErr) {
      console.warn("Direct blob fetch failed, falling back to local file:", fetchErr);
    }
  }

  // Local fallback
  try {
    await ensureLocalDirs();
    const data = await fs.readFile(LOCAL_DATA_FILE, "utf-8");
    const json = JSON.parse(data);
    return {
      lessons: Array.isArray(json.lessons) ? json.lessons : [],
      summons: Array.isArray(json.summons) ? json.summons : [],
      honors: Array.isArray(json.honors) ? json.honors : [],
      penalties: Array.isArray(json.penalties) ? json.penalties : [],
      evaluations: Array.isArray(json.evaluations) ? json.evaluations : [],
      inspectionSessions: Array.isArray(json.inspectionSessions) ? json.inspectionSessions : [],
      studentRoster: Array.isArray(json.studentRoster) ? json.studentRoster : [],
      announcements: Array.isArray(json.announcements) ? json.announcements : [],
      anonymousMessages: Array.isArray(json.anonymousMessages) ? json.anonymousMessages : [],
    };
  } catch {
    return {
      lessons: [],
      summons: [],
      honors: [],
      penalties: [],
      evaluations: [],
      inspectionSessions: [],
      studentRoster: [],
      announcements: [],
      anonymousMessages: [],
    };
  }
}

// ----------------- حفظ بيانات الدروس -----------------
async function executeSave(data: LessonsData): Promise<void> {
  // دمج وقائي صارم لمنع فقدان الدروس أو التلاميذ عند حدوث أي خطأ في الكاش
  try {
    const existing = await getLessonsData();
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
  const token = getBlobToken();

  if (token) {
    const payload = JSON.stringify(data, null, 2);

    // تحديث مباشر للملف lessons-db.json دون استهلاك طلبات list أو del متقدمة
    try {
      await put("lessons-db.json", payload, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        token,
      });
    } catch (saveErr) {
      console.error("Vercel Blob put error on lessons-db.json:", saveErr);
    }

    // حفظ نسخة محلية أيضاً للأمان
    ensureLocalDirs()
      .then(() => fs.writeFile(LOCAL_DATA_FILE, payload, "utf-8"))
      .catch(() => {});

    return;
  }

  // Local fallback
  await ensureLocalDirs();
  await fs.writeFile(LOCAL_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function saveLessonsData(data: LessonsData): Promise<void> {
  const next = writeQueue.then(() => executeSave(data));
  writeQueue = next.catch(() => {});
  return next;
}

// ----------------- رفع صورة -----------------
export async function uploadImageFile(
  file: File | Blob,
  fileName: string,
  lessonId: string,
  level: number
): Promise<{ url: string; downloadUrl: string }> {
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueName = `${Date.now()}-${safeName}`;
  const token = getBlobToken();

  if (token) {
    const blobPath = `lessons/${level}/${lessonId}/${uniqueName}`;
    const blob = await put(blobPath, file, {
      access: "public",
      token,
    });
    return {
      url: blob.url,
      downloadUrl: blob.downloadUrl || blob.url,
    };
  }

  // Local fallback
  await ensureLocalDirs();
  const lessonUploadDir = path.join(LOCAL_UPLOADS_DIR, String(level), lessonId);
  await fs.mkdir(lessonUploadDir, { recursive: true });

  const filePath = path.join(lessonUploadDir, uniqueName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  const localUrl = `/uploads/${level}/${lessonId}/${uniqueName}`;
  return {
    url: localUrl,
    downloadUrl: localUrl,
  };
}

// ----------------- حذف صورة -----------------
export async function deleteImageFile(url: string): Promise<void> {
  const token = getBlobToken();

  if (token && url.startsWith("http")) {
    try {
      await del(url, { token });
    } catch (e) {
      console.error("Error deleting blob:", e);
    }
    return;
  }

  // Local fallback
  if (url.startsWith("/uploads/")) {
    try {
      const relPath = url.replace("/uploads/", "");
      const fullPath = path.join(LOCAL_UPLOADS_DIR, relPath);
      await fs.unlink(fullPath);
    } catch (e) {
      console.error("Error deleting local file:", e);
    }
  }
}
