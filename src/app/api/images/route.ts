import { NextRequest, NextResponse } from "next/server";
import { getLessonsData, saveLessonsData, deleteImageFile } from "@/lib/storage";
import { requireTeacher } from "@/lib/auth";

export async function DELETE(req: NextRequest) {
  const ctx = await requireTeacher();
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const lessonId = searchParams.get("lessonId");
  const imageId = searchParams.get("imageId");
  const isHomework = searchParams.get("isHomework") === "true";

  if (!lessonId || !imageId) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const data = await getLessonsData(ctx);
  const lesson = data.lessons.find((l) => l.id === lessonId);
  if (!lesson) {
    return NextResponse.json({ error: "الدرس غير موجود" }, { status: 404 });
  }

  const targetList = isHomework
    ? (lesson.homeworkImages || (lesson.homeworkImages = []))
    : lesson.images;

  const imgIndex = targetList.findIndex((img) => img.id === imageId);
  if (imgIndex === -1) {
    return NextResponse.json({ error: "الصورة غير موجودة" }, { status: 404 });
  }

  const [removed] = targetList.splice(imgIndex, 1);
  await deleteImageFile(ctx, removed.url);

  await saveLessonsData(ctx, data);
  return NextResponse.json({ success: true, lesson });
}

// إعادة ترتيب صور الدرس
export async function PUT(req: NextRequest) {
  const ctx = await requireTeacher();
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { lessonId, imageIds, isHomework } = body;

    if (!lessonId || !Array.isArray(imageIds)) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const data = await getLessonsData(ctx);
    const lesson = data.lessons.find((l) => l.id === lessonId);
    if (!lesson) {
      return NextResponse.json({ error: "الدرس غير موجود" }, { status: 404 });
    }

    const targetList = isHomework
      ? (lesson.homeworkImages || (lesson.homeworkImages = []))
      : lesson.images;

    const imgMap = new Map(targetList.map((img) => [img.id, img]));
    const reordered: typeof targetList = [];
    for (const id of imageIds) {
      const img = imgMap.get(id);
      if (img) reordered.push(img);
    }
    for (const img of targetList) {
      if (!imageIds.includes(img.id)) reordered.push(img);
    }

    if (isHomework) {
      lesson.homeworkImages = reordered;
    } else {
      lesson.images = reordered;
    }
    await saveLessonsData(ctx, data);

    return NextResponse.json({ success: true, lesson });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "فشل الترتيب" }, { status: 500 });
  }
}
