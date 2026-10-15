import { NextRequest, NextResponse } from "next/server";
import { getLessonsData, saveLessonsData } from "@/lib/storage";
import { verifyAdminSession } from "@/lib/auth";
import { Penalty } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// جلب قائمة الخصومات والعقوبات (خاص بالأستاذ فقط - محمي تماماً من الطلاب والأولياء)
export async function GET(req: NextRequest) {
  const isAuth = await verifyAdminSession();
  if (!isAuth) {
    return NextResponse.json(
      { penalties: [] },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }

  const { searchParams } = new URL(req.url);
  const className = searchParams.get("class");

  const data = await getLessonsData();
  let penalties = data.penalties || [];

  if (className && className !== "all") {
    const cleanClass = className.replace(/\s+/g, "").trim();
    penalties = penalties.filter(
      (p) => (p.className || "").replace(/\s+/g, "").trim() === cleanClass
    );
  }

  // ترتيب من الأحدث إلى الأقدم
  penalties.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json(
    { penalties },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

// إضافة خصم أو عقوبة لتلميذ أو مجموعة تلاميذ (للأستاذ فقط)
export async function POST(req: NextRequest) {
  const isAuth = await verifyAdminSession();
  if (!isAuth) {
    return NextResponse.json({ error: "غير مصرح لك - يرجى تسجيل الدخول" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { studentNames, studentName, className, deduction, reason, date, notes } = body;

    const rawNames = studentNames || studentName || "";
    const names: string[] = Array.isArray(rawNames)
      ? rawNames.map((s) => String(s).trim()).filter(Boolean)
      : String(rawNames)
          .split(/[\n,،]+/)
          .map((s) => s.trim())
          .filter(Boolean);

    if (names.length === 0) {
      return NextResponse.json({ error: "يرجى كتابة اسم التلميذ أو أسماء التلاميذ" }, { status: 400 });
    }

    if (!className?.trim()) {
      return NextResponse.json({ error: "يرجى تحديد القسم" }, { status: 400 });
    }

    if (!deduction?.trim()) {
      return NextResponse.json({ error: "يرجى تحديد مقدار الخصم أو نوع العقوبة" }, { status: 400 });
    }

    if (!reason?.trim()) {
      return NextResponse.json({ error: "يرجى كتابة سبب العقوبة" }, { status: 400 });
    }

    const data = await getLessonsData();
    data.penalties = data.penalties || [];

    const now = new Date();
    const defaultDate = date?.trim() || now.toLocaleDateString("ar-DZ", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const createdPenalties: Penalty[] = [];

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const newPenalty: Penalty = {
        id: `penalty_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${i}`,
        studentName: name,
        className: String(className).trim(),
        deduction: String(deduction).trim(),
        reason: String(reason).trim(),
        date: defaultDate,
        notes: notes && String(notes).trim().length > 0 ? String(notes).trim() : undefined,
        createdAt: new Date(Date.now() + i).toISOString(),
      };
      createdPenalties.push(newPenalty);
      data.penalties.unshift(newPenalty);
    }

    await saveLessonsData(data);

    return NextResponse.json({
      success: true,
      penalties: createdPenalties,
      penalty: createdPenalties[0],
      count: createdPenalties.length,
    });
  } catch (err: any) {
    console.error("POST /api/penalties error:", err);
    return NextResponse.json({ error: err?.message || "فشل تسجيل الخصم أو العقوبة" }, { status: 500 });
  }
}

// تعديل عقوبة / خصم مسجل (للأستاذ فقط)
export async function PUT(req: NextRequest) {
  const isAuth = await verifyAdminSession();
  if (!isAuth) {
    return NextResponse.json({ error: "غير مصرح لك - يرجى تسجيل الدخول" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, studentName, className, deduction, reason, date, notes } = body;

    if (!id) {
      return NextResponse.json({ error: "معرّف السجل مطلوب" }, { status: 400 });
    }

    const data = await getLessonsData();
    data.penalties = data.penalties || [];
    const item = data.penalties.find((p) => p.id === id);

    if (!item) {
      return NextResponse.json({ error: "السجل غير موجود" }, { status: 404 });
    }

    if (studentName !== undefined) item.studentName = String(studentName).trim();
    if (className !== undefined) item.className = String(className).trim();
    if (deduction !== undefined) item.deduction = String(deduction).trim();
    if (reason !== undefined) item.reason = String(reason).trim();
    if (date !== undefined) item.date = String(date).trim() || undefined;
    if (notes !== undefined) item.notes = String(notes).trim() || undefined;

    await saveLessonsData(data);
    return NextResponse.json({ success: true, penalty: item });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "فشل التعديل" }, { status: 500 });
  }
}

// حذف سجل عقوبة (للأستاذ فقط)
export async function DELETE(req: NextRequest) {
  const isAuth = await verifyAdminSession();
  if (!isAuth) {
    return NextResponse.json({ error: "غير مصرح لك - يرجى تسجيل الدخول" }, { status: 401 });
  }

  const searchParams = new URL(req.url).searchParams;
  if (searchParams.get("all") === "true") {
    try {
      const data = await getLessonsData();
      data.penalties = [];
      await saveLessonsData(data);
      return NextResponse.json({ success: true, message: "تم مسح كافة سجلات الخصومات بنجاح" });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || "فشل مسح الخصومات" }, { status: 500 });
    }
  }

  let id = searchParams.get("id");
  if (!id) {
    try {
      const body = await req.json();
      id = body?.id;
    } catch {}
  }

  if (!id) {
    return NextResponse.json({ error: "معرّف السجل مطلوب" }, { status: 400 });
  }

  try {
    const data = await getLessonsData();
    data.penalties = data.penalties || [];
    const index = data.penalties.findIndex((p) => p.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "السجل غير موجود" }, { status: 404 });
    }

    data.penalties.splice(index, 1);
    await saveLessonsData(data);

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "فشل الحذف" }, { status: 500 });
  }
}
