import { NextRequest, NextResponse } from "next/server";
import { getAdminPassword, setAdminSession, clearAdminSession, verifyAdminSession } from "@/lib/auth";

export async function GET() {
  const isAuth = await verifyAdminSession();
  return NextResponse.json({ authenticated: isAuth });
}

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password || password !== getAdminPassword()) {
      return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
    }
    await setAdminSession();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
}

export async function DELETE() {
  await clearAdminSession();
  return NextResponse.json({ success: true });
}
