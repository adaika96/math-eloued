# 🔐 وثيقة الأمان وحماية البيانات ومنع التسرب (Security & Data Privacy Blueprint)
## منصة الرياضيات لولاية الوادي — ضمان السرية التامة والعزل الصارم للبيانات

---

## 🎯 1. التحدي الأمني وأولويات الحماية

المنصة الأولى كانت موقعاً شخصياً لأستاذ واحد، بينما المنصة الجديدة هي **منصة عامة ورسمية لولاية كاملة** تجمع مئات الأساتذة و 5 مفتشين وآلاف الأولياء والتلاميذ.

أي خطأ أمني أو تسريب قد يمس بـ:
1. **المذكرات والوثائق البيداغوجية:** وثائق عمل مهنية يجب ألا يطلع عليها الأولياء أو تلاميذهم إطلاقاً.
2. **المراسلات والملاحظات بين المفتش والأستاذ:** توجيهات إدارية وبيداغوجية سرية وخاصة بالتقويم المهني.
3. **بيانات وسلوك وتنبيهات التلاميذ واستدعاءات الأولياء:** بيانات حساسة تخص العائلات والتلاميذ يُمنع ظهورها لباقي الأولياء.
4. **تداخل محتوى الأساتذة:** يجب ألا يتمكن أستاذ (أ) من حذف أو تعديل دروس أستاذ (ب) سواء بقصد أو بغير قصد.

---

## 🧱 2. طبقات الحماية المتعددة (Defense-in-Depth)

```
[ الطبقة 1: واجهة المستخدم UI / Routing ]
  ├── مسارات خاصة للأستاذ والمفتش محمية بـ Middleware و جلسات مشفرة
  └── الأولياء يصلون فقط لمسارات المعاينة العامة (/t/teacher-slug)

[ الطبقة 2: خادم Next.js API & Server Actions ]
  ├── التحقق من صحة JWT Token لكل طلب
  ├── التحقق من هوية الأستاذ وصلاحيات المفتش على المقاطعة
  └── فحص وفلترة المدخلات (Zod Validation) وحظر ملفات البرمجيات الخبيثة

[ الطبقة 3: جدار حماية قاعدة البيانات Postgres RLS (الحماية الجوهرية) ]
  ├── Row Level Security مفعل إجبارياً على جميع الجداول
  ├── سياسات صارمة: لا يمكن لأي كود استعلام جلب صف لا يملك إذن قراءته
  └── عزل بيانات المذكرات برمجياً على مستوى محرك قاعدة البيانات

[ الطبقة 4: مخازن الملفات السحابية المشفرة Supabase Storage ]
  ├── مخزن عام (Public CDN): لصور السبورة وسلاسل التمارين فقط
  └── مخزن فائق السرية (Private Storage): للمذكرات والمراسلات لا يفتح إلا بـ Signed URLs مؤقتة
```

---

## 🛡️ 3. سياسات أمان قاعدة البيانات (Row Level Security - RLS Rules)

### أ) جدول المذكرات التربوية (`pedagogical_notes`)
```sql
-- تفعيل الحماية الصارمة
ALTER TABLE public.pedagogical_notes ENABLE ROW LEVEL SECURITY;

-- 1. القراءة: يقرؤها صاحبها (الأستاذ نفسه) أو مفتش مقاطعته فقط
CREATE POLICY "notes_select_policy" ON public.pedagogical_notes
FOR SELECT USING (
  auth.uid() = teacher_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
      AND profiles.role = 'inspector' 
      AND profiles.district_id = pedagogical_notes.district_id
  )
);

-- 2. الإضافة والتعديل: الأستاذ صاحب الحساب فقط
CREATE POLICY "notes_insert_policy" ON public.pedagogical_notes
FOR INSERT WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "notes_update_policy" ON public.pedagogical_notes
FOR UPDATE USING (
  auth.uid() = teacher_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
      AND profiles.role = 'inspector' 
      AND profiles.district_id = pedagogical_notes.district_id
  )
);

-- 3. الحذف: الأستاذ صاحب المذكرة فقط
CREATE POLICY "notes_delete_policy" ON public.pedagogical_notes
FOR DELETE USING (auth.uid() = teacher_id);

-- ❌ المستخدم العام (Anon / الولي / التلميذ) ليس له أي صلاحية إطلاقاً (Select = False تلقائياً)
```

---

### ب) جدول الدروس وصور السبورة (`lessons` & `lesson_images`)
```sql
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- 1. القراءة العامة: يمكن للجميع قراءة الدروس المنشورة فقط
CREATE POLICY "lessons_public_read" ON public.lessons
FOR SELECT USING (is_published = true);

-- 2. القراءة للأستاذ: يمكن للأستاذ رؤية جميع دروسه (منشورة أو مسودة)
CREATE POLICY "lessons_teacher_read" ON public.lessons
FOR SELECT USING (auth.uid() = teacher_id);

-- 3. الكتابة والتعديل والحذف: الأستاذ صاحب الدرس فقط
CREATE POLICY "lessons_teacher_all" ON public.lessons
FOR ALL TO authenticated
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);
```

---

### ج) جدول مناشير ومراسلات المفتش (`inspector_circulars`)
```sql
ALTER TABLE public.inspector_circulars ENABLE ROW LEVEL SECURITY;

-- 1. القراءة: أساتذة المقاطعة المعنية ومفتش المقاطعة فقط
CREATE POLICY "circulars_read" ON public.inspector_circulars
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
      AND (
        (profiles.role = 'teacher' AND profiles.district_id = inspector_circulars.district_id) OR
        (profiles.role = 'inspector' AND profiles.district_id = inspector_circulars.district_id) OR
        (profiles.role = 'admin')
      )
  )
);

-- 2. النشر: المفتش فقط
CREATE POLICY "circulars_insert" ON public.inspector_circulars
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('inspector', 'admin')
      AND profiles.district_id = inspector_circulars.district_id
  )
);
```

---

## 🗄️ 4. تأمين رفع الملفات وتخزين الصور والمستندات (Storage Security)

### 1. تصنيف المخازن (Buckets Isolation):
| اسم المخزن (Bucket) | نوع الوصول | المحتوى | من يمكنه القراءة؟ | من يمكنه الرفع؟ |
|---|---|---|---|---|
| `public-lesson-media` | Public | صور السبورة، ملخصات PDF، واجبات وحلول | الجميع (أولياء، تلاميذ، أساتذة) عبر CDN سريع | الأستاذ صاحب الحساب داخل مجلده فقط |
| `private-pedagogical-notes` | **Strict Private** | مذكرات تربوية، وثائق تخطيط سنوي | الأستاذ المعني ومفتش مقاطعته حصراً عبر Signed URL مؤقت | الأستاذ المعني فقط |
| `private-inspector-docs` | **Strict Private** | مناشير، استدعاءات رسمية، مراسلات المفتش | أساتذة المقاطعة المستهدفون والمفتش فقط | المفتش فقط |

### 2. آلية الروابط الموقعة المؤقتة (Signed URLs):
- عندما يطلب الأستاذ أو المفتش استعراض مذكرة تربوية، لا يتم إرسال رابط مباشر للملف.
- يقوم السيرفر بإنشاء رابط مشفر مؤقت (Time-limited Signed URL) صالح لمدة **15 دقيقة فقط**.
- بعد انتهاء المدة، يصبح الرابط معطلاً تماماً، مما يمنع إعادة توجيه الرابط أو مشاركته خارج المنصة.

---

## 🔍 5. حماية خصوصية بيانات التلاميذ واستدعاءات الأولياء

- **استدعاءات الأولياء وسجل السلوك:**
  - لا تنشر أبداً في صفحات عامة مكشوفة للجميع.
  - تكون محمية برمز خاص أو متاحة فقط عبر رابط مخصص يسلمه الأستاذ للولي أو يستعلم عنه الولي برقم التعريف المدرسي للتلميذ فقط.
- **لوحة الشرف:**
  - تنشر فقط الأسماء مع القسم ومعدل المادة أو عبارة التشجيع بموافقة الأستاذ لتعزيز الجانب التحفيزي.

---

## 📋 6. قائمة الفحص الأمني قبل الإطلاق الميداني (Security Audit Checklist)

- [x] التأكد من أن جميع جداول Supabase عليها `ENABLE ROW LEVEL SECURITY`.
- [x] التأكد من أن `anon key` لا يستطيع قراءة أي سجل في جدول `pedagogical_notes`.
- [x] التأكد من أن مخزن `private-pedagogical-notes` معطل عنه الوصول العام `public = false`.
- [x] اختبار محاولة أستاذ من المقاطعة 1 قراءة مناشير المقاطعة 2 والتأكد من حظرها تلقائياً.
- [x] فحص حجم الملفات المرفوعة وحظر الملفات غير المصرح بها (السماح فقط بـ: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`).
- [x] تفعيل حماية ضد الهجمات المتكررة (Rate Limiting) على مسارات رفع الملفات والرسائل المجهولة (حد تقريبي لكل نسخة خادم؛ تسجيل الدخول تحميه حدود Supabase Auth).

### ✅ ما تم تطبيقه فعلياً (أكتوبر 2026)
- **الأدوار:** التسجيل ينشئ دائماً حساب أستاذ؛ تغيير الدور أو المقاطعة أو التوثيق محصور في المشرف العام (محفز `guard_profile_privileges`).
- **الدوال المساعدة** `is_admin()` و`my_role()` و`my_district()` (SECURITY DEFINER) تمنع التكرار اللانهائي في سياسات `profiles`.
- **التخزين:** كل ملف داخل مجلد صاحبه (`<teacher_id>/...`)، ومناشير المفتش داخل مجلد مقاطعته (`<district_id>/...`)، مع حد 10MB وأنواع محددة.
- **البيانات الخاصة للتلاميذ** (التقويم، العقوبات، الرسائل) في `teacher_private_data` لا يقرؤها إلا الأستاذ صاحبها.
- **رقم هاتف الأستاذ** محجوب عن الزوار (صلاحيات أعمدة).
- **الحل النموذجي للواجب** محجوب عن الأولياء حتى موعد النشر الذي يحدده الأستاذ.
- **ترويسات أمان** (X-Frame-Options، nosniff، HSTS...) في `next.config.ts`.
- **ملاحظة:** لا يوجد Middleware/Proxy؛ الحماية الجوهرية في RLS ونقاط النهاية على الخادم، والصفحات المحمية تتحقق من الجلسة.
