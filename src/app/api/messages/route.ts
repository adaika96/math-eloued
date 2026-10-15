import { NextRequest, NextResponse } from "next/server";
import { getLessonsData, saveLessonsData } from "@/lib/storage";
import { verifyAdminSession } from "@/lib/auth";
import { AnonymousMessage, MessageCategory } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// إرسال رسالة مجهولة الهوية (مفتوح للجميع: تلميذ، ولي أمر... دون تسجيل أي هوية)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, category = "other", targetLevel } = body;

    const trimmedContent = (content || "").trim();
    if (!trimmedContent || trimmedContent.length < 3) {
      return NextResponse.json(
        { error: "يرجى كتابة نص الرسالة (3 أحرف على الأقل)" },
        { status: 400 }
      );
    }

    if (trimmedContent.length > 3000) {
      return NextResponse.json(
        { error: "الرسالة طويلة جداً (الحد الأقصى 3000 حرف)" },
        { status: 400 }
      );
    }

    // تنظيف وتأكيد عدم وجود أي هوية مسجلة
    const data = await getLessonsData();
    data.anonymousMessages = data.anonymousMessages || [];

    const newMessage: AnonymousMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category: (category as MessageCategory) || "other",
      targetLevel: targetLevel ? String(targetLevel).trim() : undefined,
      content: trimmedContent,
      createdAt: new Date().toISOString(),
      read: false,
    };

    data.anonymousMessages.unshift(newMessage);
    await saveLessonsData(data);

    return NextResponse.json({
      success: true,
      message: "تم إرسال رسالتك بسرية تامة 🔒! شكراً لصراحتك وملاحظتك القيمة.",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "حدث خطأ أثناء إرسال الرسالة، يرجى المحاولة لاحقاً" },
      { status: 500 }
    );
  }
}

// قراءة الرسائل المجهولة (للأستاذ فقط بعد تسجيل الدخول)
export async function GET(req: NextRequest) {
  const isAuth = await verifyAdminSession();
  if (!isAuth) {
    return NextResponse.json(
      { error: "غير مصرح لك - هذه الرسائل سرية للأستاذ فقط" },
      { status: 401 }
    );
  }

  const data = await getLessonsData();
  const list = (data.anonymousMessages || []).slice();

  // ترتيب من الأحدث إلى الأقدم
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json(
    { messages: list },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

// تحديث حالة القراءة (للأستاذ فقط)
export async function PATCH(req: NextRequest) {
  const isAuth = await verifyAdminSession();
  if (!isAuth) {
    return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, read } = body;

    if (!id) {
      return NextResponse.json({ error: "معرّف الرسالة مطلوب" }, { status: 400 });
    }

    const data = await getLessonsData();
    data.anonymousMessages = data.anonymousMessages || [];

    const msg = data.anonymousMessages.find((m) => m.id === id);
    if (!msg) {
      return NextResponse.json({ error: "الرسالة غير موجودة" }, { status: 404 });
    }

    msg.read = read !== undefined ? Boolean(read) : !msg.read;
    await saveLessonsData(data);

    return NextResponse.json({ success: true, message: msg });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "حدث خطأ" }, { status: 500 });
  }
}

// حذف رسالة (للأستاذ فقط)
export async function DELETE(req: NextRequest) {
  const isAuth = await verifyAdminSession();
  if (!isAuth) {
    return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "معرّف الرسالة مطلوب" }, { status: 400 });
    }

    const data = await getLessonsData();
    data.anonymousMessages = (data.anonymousMessages || []).filter((m) => m.id !== id);

    await saveLessonsData(data);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "حدث خطأ أثناء الحذف" }, { status: 500 });
  }
}
