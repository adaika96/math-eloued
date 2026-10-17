import { NextRequest, NextResponse } from "next/server";

// محدد معدل بسيط في الذاكرة (لكل نسخة خادم) يحمي نقاط النهاية المفتوحة من الإغراق
// ملاحظة: على Vercel تعمل عدة نسخ، فالحد تقريبي؛ للحماية الصارمة استعمل مخزناً مشتركاً (Upstash/Redis)
const buckets = new Map<string, number[]>();

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function rateLimit(key: string, limit: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
    return NextResponse.json(
      { error: "طلبات كثيرة جداً، يرجى المحاولة بعد قليل" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return null;
}
