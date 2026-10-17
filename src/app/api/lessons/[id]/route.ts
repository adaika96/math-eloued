import { NextRequest, NextResponse } from "next/server";
import { getLessonsData } from "@/lib/storage";
import { resolveReader } from "@/lib/auth";
import { hideUnpublishedSolution } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveReader(req);
  if (!ctx) {
    return NextResponse.json({ error: "يرجى تحديد الأستاذ" }, { status: 400 });
  }
  const { id } = await params;
  const data = await getLessonsData(ctx);
  const lesson = data.lessons.find((l) => l.id === id);

  if (!lesson) {
    return NextResponse.json({ error: "الدرس غير موجود" }, { status: 404 });
  }

  return NextResponse.json(
    { lesson: ctx.mode === "public" ? hideUnpublishedSolution(lesson) : lesson },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
