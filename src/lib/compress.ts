"use client";

import imageCompression from "browser-image-compression";

// ضغط صور السبورة والوثائق في متصفح الأستاذ قبل الرفع (حسب دليل المطور):
// أقصى بُعد 1600px يحافظ على وضوح الطباشير والمعادلات، وحجم ~150-350KB لكل صورة
export const BOARD_IMAGE_OPTIONS = {
  maxWidthOrHeight: 1600,
  maxSizeMB: 0.35,
  useWebWorker: true,
  initialQuality: 0.8,
  fileType: "image/jpeg",
} as const;

export function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

export async function compressIfImage(file: File): Promise<File> {
  if (!isImageFile(file) || file.type === "image/gif") return file;
  try {
    const compressed = await imageCompression(file, BOARD_IMAGE_OPTIONS);
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([compressed], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// الأنواع المسموحة للرفع (صور + PDF)
export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function validateUpload(file: File): string | null {
  const isPdfByName = file.name.toLowerCase().endsWith(".pdf");
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type) && !isPdfByName) {
    return "نوع الملف غير مسموح (صور JPG/PNG/WebP أو PDF فقط)";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "حجم الملف يتجاوز 10 ميغابايت";
  return null;
}

export function safeStorageName(name: string) {
  const ext = (name.match(/\.[a-z0-9]+$/i)?.[0] || "").toLowerCase();
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-]/g, "_").slice(0, 40) || "file";
  return `${Date.now()}-${base}${ext}`;
}
