import { NextRequest, NextResponse } from "next/server";
import { getLessonsData, saveLessonsData, uploadImageFile } from "@/lib/storage";
import { verifyAdminSession } from "@/lib/auth";
import { LessonImage } from "@/lib/types";

export async function POST(req: NextRequest) {
  const isAuth = await verifyAdminSession();
  if (!isAuth) {
    return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const lessonId = formData.get("lessonId") as string;
    const singleFile = formData.get("file") as File | null;
    const multipleFiles = formData.getAll("files") as File[];
    const allFiles = multipleFiles.length > 0 ? multipleFiles : (singleFile ? [singleFile] : []);

    if (!lessonId || allFiles.length === 0) {
      return NextResponse.json({ error: "بيانات ناقصة: لم يتم إرسال أي ملف" }, { status: 400 });
    }

    const data = await getLessonsData();
    const lesson = data.lessons.find((l) => l.id === lessonId);
    if (!lesson) {
      return NextResponse.json({ error: "الدرس غير موجود" }, { status: 404 });
    }

    const isHomework = formData.get("isHomework") === "true" || formData.get("type") === "homework";

    const newImages: LessonImage[] = [];

    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];
      const isPdf =
        file.type === "application/pdf" ||
        (file.name && file.name.toLowerCase().endsWith(".pdf"));

      const fallbackFileName = isPdf
        ? (isHomework ? `homework-solution-${i + 1}.pdf` : `lesson-file-${i + 1}.pdf`)
        : (isHomework ? `homework-solution-${i + 1}.jpg` : `lesson-image-${i + 1}.jpg`);

      const { url, downloadUrl } = await uploadImageFile(
        file,
        file.name || fallbackFileName,
        lessonId,
        lesson.level
      );

      const defaultName = isHomework
        ? (lesson.type === "worksheets"
            ? (isPdf ? "ملف حل السلسلة (PDF)" : `حل السلسلة ${i + 1}`)
            : (isPdf ? "ملف حل الواجب (PDF)" : `حل الواجب المنزلي ${i + 1}`))
        : (lesson.type === "worksheets"
            ? (isPdf ? "ملف السلسلة (PDF)" : `صورة السلسلة ${i + 1}`)
            : lesson.type === "summaries"
            ? (isPdf ? "ملف الملخص (PDF)" : `صورة الملخص ${i + 1}`)
            : (isPdf ? "ملف الدرس (PDF)" : `صورة الدرس ${i + 1}`));

      newImages.push({
        id: `img_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        url,
        downloadUrl,
        name: file.name || defaultName,
        createdAt: new Date().toISOString(),
        fileType: isPdf ? "pdf" : "image",
      });
    }

    if (isHomework) {
      if (!Array.isArray(lesson.homeworkImages)) lesson.homeworkImages = [];
      lesson.homeworkImages.push(...newImages);
    } else {
      if (!Array.isArray(lesson.images)) lesson.images = [];
      lesson.images.push(...newImages);
    }

    await saveLessonsData(data);

    return NextResponse.json({
      images: newImages,
      image: newImages[0],
      lesson,
      isHomework,
      count: newImages.length,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message || "فشل رفع الملفات" }, { status: 500 });
  }
}
