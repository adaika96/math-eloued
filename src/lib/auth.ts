import { cookies } from "next/headers";

const DEFAULT_PASSWORD = "adaika2026";
const COOKIE_NAME = "math_admin_session";

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
}

export async function verifyAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME)?.value;
  if (!session) return false;
  // Simple HMAC or hash check
  const expected = Buffer.from(getAdminPassword()).toString("base64");
  return session === expected;
}

export async function setAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = Buffer.from(getAdminPassword()).toString("base64");
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
