import { NextRequest, NextResponse } from "next/server";
import { getLessonsData, saveLessonsData } from "@/lib/storage";
import { verifyAdminSession } from "@/lib/auth";
import { ParentSummons } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// جلب قائمة استدعاءات الأولياء (عام للأولياء والتلاميذ)
export async function GET(_req: NextRequest) {
  const data = await getLessonsData();
  const summons = data.summons || [];

  // ترتيب الاستدعاءات: الحالات المستعجلة أولاً، ثم الأحدث
  summons.sort((a, b) => {
    if (a.isUrgent && !b.isUrgent) return -1;
    if (!a.isUrgent && b.isUrgent) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return NextResponse.json(
    { summons },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

// إضافة استدعاء ولي أمر جديد (للأستاذ فقط)
export async function POST(req: NextRequest) {
  const isAuth = await verifyAdminSession();
  if (!isAuth) {
    return NextResponse.json({ error: "غير مصرح لك - يرجى تسجيل الدخول" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { studentName, studentNames, className, notes, isUrgent } = body;
    const rawNames = studentNames || studentName || "";
    const names: string[] = Array.isArray(rawNames)
      ? rawNames.map((s) => String(s).trim()).filter(Boolean)
      : String(rawNames)
          .split(/[\n,،]+/)
          .map((s) => s.trim())
          .filter(Boolean);

    if (names.length === 0 || !className?.trim()) {
      return NextResponse.json({ error: "اسم التلميذ والقسم مطلوبان" }, { status: 400 });
    }

    const data = await getLessonsData();
    data.summons = data.summons || [];

    const created: ParentSummons[] = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const newSummons: ParentSummons = {
        id: `summons_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${i}`,
        studentName: name,
        className: String(className).trim(),
        notes: notes ? String(notes).trim() : undefined,
        isUrgent: Boolean(isUrgent),
        createdAt: new Date(Date.now() + i).toISOString(),
      };
      created.push(newSummons);
      data.summons.unshift(newSummons);
    }

    await saveLessonsData(data);

    return NextResponse.json({ success: true, summons: created[0], allSummons: created });
  } catch (err: any) {
    console.error("POST /api/summons error:", err);
    return NextResponse.json({ error: err?.message || "فشل تسجيل الاستدعاء" }, { status: 500 });
  }
}

// تعديل استدعاء (للأستاذ فقط)
export async function PUT(req: NextRequest) {
  const isAuth = await verifyAdminSession();
  if (!isAuth) {
    return NextResponse.json({ error: "غير مصرح لك - يرجى تسجيل الدخول" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, studentName, className, notes, isUrgent } = body;

    if (!id) {
      return NextResponse.json({ error: "معرّف الاستدعاء مطلوب" }, { status: 400 });
    }

    const data = await getLessonsData();
    data.summons = data.summons || [];
    const item = data.summons.find((s) => s.id === id);

    if (!item) {
      return NextResponse.json({ error: "الاستدعاء غير موجود" }, { status: 404 });
    }

    if (studentName !== undefined) item.studentName = String(studentName).trim();
    if (className !== undefined) item.className = String(className).trim();
    if (notes !== undefined) item.notes = notes ? String(notes).trim() : undefined;
    if (isUrgent !== undefined) item.isUrgent = Boolean(isUrgent);

    await saveLessonsData(data);
    return NextResponse.json({ success: true, summons: item });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "فشل التعديل" }, { status: 500 });
  }
}

// حذف استدعاء (للأستاذ فقط)
export async function DELETE(req: NextRequest) {
  const isAuth = await verifyAdminSession();
  if (!isAuth) {
    return NextResponse.json({ error: "غير مصرح لك - يرجى تسجيل الدخول" }, { status: 401 });
  }

  let id = new URL(req.url).searchParams.get("id");
  if (!id) {
    try {
      const body = await req.json();
      id = body?.id;
    } catch {}
  }

  if (!id) {
    return NextResponse.json({ error: "معرّف الاستدعاء مطلوب" }, { status: 400 });
  }

  try {
    const data = await getLessonsData();
    data.summons = data.summons || [];
    const index = data.summons.findIndex((s) => s.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "الاستدعاء غير موجود" }, { status: 404 });
    }

    data.summons.splice(index, 1);
    await saveLessonsData(data);

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "فشل الحذف" }, { status: 500 });
  }
}
