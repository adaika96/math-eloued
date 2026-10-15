# دروس الرياضيات — 1 و 2 متوسط

موقع بسيط للتلاميذ: يمسح الـ QR ← يختار السنة ← يختار الدرس ← يشاهد صور الدرس ويفتحها أو يحمّلها.

- **التقنية:** Next.js + Tailwind + Supabase (قاعدة بيانات + تخزين الصور)
- **صفحة التلاميذ:** `/`
- **لوحة الأستاذ:** `/admin` (تسجيل دخول بالبريد وكلمة المرور)

## الإعداد (مرة واحدة)

1. أنشئ مشروعاً في [supabase.com](https://supabase.com) (أو استعمل مشروعاً موجوداً).
2. **SQL Editor** ← الصق محتوى `supabase/schema.sql` ← **Run**.
3. **Authentication > Users > Add user** ← أنشئ حساب الأستاذ (بريد + كلمة مرور، فعّل *Auto Confirm*).
4. **Project Settings > API** ← انسخ `Project URL` و `anon public key` إلى ملف `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
5. تشغيل محلي: `npm install` ثم `npm run dev` ← http://localhost:3000

## النشر على Vercel
أضف نفس المتغيرين في **Vercel > Settings > Environment Variables** ثم انشر.
