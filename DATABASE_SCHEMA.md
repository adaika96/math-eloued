# 🗄️ معمارية قاعدة البيانات والتخزين السحابي (Database & Storage Architecture)
### المنصة الرقمية الموحدة لمادة الرياضيات — ولاية الوادي (Supabase / PostgreSQL)

تعتمد المنصة على قاعدة بيانات **PostgreSQL سحابية مستضافة على Supabase** مدعومة بنظام حماية مشدد عبر **Row Level Security (RLS)** لضمان العزل التام لبيانات كل أستاذ وكل مقاطعة تفتيشية.

---

## ✅ المعمارية الفعلية (محدثة — أكتوبر 2026)

> المرجع الدقيق هو ملفات SQL نفسها: `supabase/wilaya_schema.sql` ثم `supabase/migrations/*.sql` بالترتيب. الأقسام التفصيلية أدناه وثيقة التصميم الأولى، وبعض أعمدتها تختلف عن التنفيذ.

### الجداول المستعملة فعلياً
| الجدول | المحتوى | من يقرأ / يكتب |
| :--- | :--- | :--- |
| `districts` | المقاطعات الخمس | الجميع يقرأ |
| `middle_schools` | المتوسطات المعتمدة لكل مقاطعة | الجميع يقرأ • المشرف يكتب |
| `profiles` | الحسابات: الدور، المقاطعة، الكود، الرابط، المستويات، بطاقة الاستقبال `reception` | العامة للجميع • الشخص يعدل ملفه (دون الدور/المقاطعة/التوثيق) • المفتش يقرأ مقاطعته • المشرف كل شيء |
| `profile_contacts` | رقم الهاتف (منفصل عن الملف العام) | صاحبه • مفتش مقاطعته • المشرف |
| `teacher_public_data` | `data` JSON: `lessons`، `honors`، `announcements`، `summons` | الأستاذ صاحبه يكتب • القراءة المباشرة للأستاذ ومفتش مقاطعته والمشرف • **الأولياء عبر الدالة `get_teacher_public_data`** التي تحجب الحل النموذجي قبل موعد نشره |
| `teacher_private_data` | `data` JSON: `evaluations`، `penalties`، `studentRoster`، `inspectionSessions`، `anonymousMessages` | الأستاذ صاحبه فقط (الرسائل المجهولة تُضاف عبر `post_anonymous_message`) |
| `pedagogical_notes` | وثائق الملف البيداغوجي (`doc_type`: مذكرة، توزيع سنوي، دفتر النصوص، تشخيصي، أخرى) + حالة المراجعة وتوجيه المفتش | الأستاذ صاحبها + مفتش مقاطعته + المشرف |
| `teacher_timetables` | جدول التوقيت الأسبوعي `slots` + صورة اختيارية | الأستاذ + مفتش مقاطعته |
| `inspector_circulars` | المناشير والندوات (`event_date`، `event_place`، الاستهداف، المرفق) | المفتش يكتب لمقاطعته • الأساتذة المستهدفون يقرؤون |
| `circular_reads` | كشف الاطلاع على المناشير | الأستاذ يسجل قراءته • المفتش يرى مقاطعته |
| `forum_topics` / `forum_replies` / `forum_votes` | الملتقى وبنك الوضعيات والتصويت | أعضاء المنصة الموثقون فقط (لا يراه الأولياء) |

> الجداول `lessons` و`lesson_images` و`announcements` و`honors` من المخطط الأول **غير مستعملة**؛ محتوى الأستاذ محفوظ في `teacher_public_data`.

### مخازن الملفات
| المخزن | الوصول | مسار الملف |
| :--- | :--- | :--- |
| `public-lesson-media` | عام (صور السبورة وملفات الدروس) | `<teacher_id>/lessons/<level>/<lesson_id>/...` |
| `private-pedagogical-notes` | خاص: الأستاذ + مفتش مقاطعته (روابط موقعة 15 دقيقة) | `<teacher_id>/...` |
| `private-inspector-docs` | خاص: أساتذة المقاطعة ومفتشها | `<district_id>/...` |
| `forum-files` | خاص: أعضاء الملتقى | `<user_id>/...` |

كل المخازن محدودة بـ 10MB للملف وبالأنواع: JPG / PNG / WebP / PDF.

### ترتيب الترحيلات
| الملف | المحتوى |
| :--- | :--- |
| `20261017000001_security_fixes.sql` | منع اختيار الدور عند التسجيل، حارس الأعمدة الحساسة، الدوال المساعدة، عزل المذكرات والمخازن |
| `20261017000002_teacher_workspaces.sql` | فضاء كل أستاذ العام والخاص + الرسائل المجهولة |
| `20261017000003_registration_fixes.sql` | المستويات المختارة، ومعالجة تكرار الرابط والكود |
| `20261017000004_pedagogical_file.sql` | أنواع الوثائق، جدول التوقيت، كشف الاطلاع، حماية حالة المراجعة |
| `20261017000005_inspector_tools.sql` | موعد ومكان الندوات |
| `20261017000006_parent_features.sql` | بطاقة الاستقبال وإخفاء الهاتف عن الزوار |
| `20261017000007_admin_tools.sql` | إدارة المتوسطات من المشرف |
| `20261017000008_storage_limits.sql` | حدود حجم ونوع الملفات |
| `20261017000009_forum.sql` | الملتقى والنقاط والشارات ومخزن مرفقاته |
| `20261017000010_solution_embargo.sql` | حجب الحل النموذجي على مستوى القاعدة + منع سرد ملفات المخزن العام |
| `20261017000011_private_contacts.sql` | نقل رقم الهاتف إلى `profile_contacts` (لا يراه باقي الأساتذة) |

---

## 📊 1. مخطط العلاقات الكيانية (Entity Relationship Overview)

```
                       ┌─────────────────────────┐
                       │     auth.users (سحابي)  │
                       └────────────┬────────────┘
                                    │ (1:1 عبر trigger)
                                    ▼
                       ┌─────────────────────────┐
                       │        profiles         │
                       │  (دور المستخدم والمقاطعة)│
                       └────────────┬────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       │ (1:N)                      │ (1:N)                      │ (1:N)
       ▼                            ▼                            ▼
┌──────────────┐             ┌──────────────┐             ┌─────────────────────┐
│   lessons    │             │ announcements│             │  pedagogical_notes  │
│  (الدروس)    │             │   (الإعلانات)│             │ (المذكرات البيداغوجية)│
└──────┬───────┘             └──────────────┘             └─────────────────────┘
       │ (1:N)
       ▼
┌──────────────┐
│ lesson_images│
│ (صور السبورة)│
└──────────────┘

                       ┌─────────────────────────┐
                       │        districts        │
                       │  (المقاطعات الخمس 1 إلى 5)│
                       └────────────┬────────────┘
                                    │ (1:N)
                                    ▼
                       ┌─────────────────────────┐
                       │      middle_schools     │
                       │    (متوسطات المقاطعة)   │
                       └─────────────────────────┘
```

---

## 📑 2. تفصيل الجداول وحقولها (Table Schemas)

### 1️⃣ جدول المقاطعات التفتيشية (`districts`)
يحتوي على المقاطعات الخمس المعتمدة بولاية الوادي:
```sql
CREATE TABLE IF NOT EXISTS districts (
  id SERIAL PRIMARY KEY,
  number INT UNIQUE NOT NULL, -- 1 إلى 5
  name TEXT NOT NULL,         -- اسم المقاطعة الرسمي
  description TEXT,           -- البلديات والدوائر التابعة لها
  inspector_name TEXT,        -- اسم المفتش المسؤول
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2️⃣ جدول المتوسطات (`middle_schools`)
قائمة المتوسطات في الولاية مربوطة بمقاطعتها التفتيشية:
```sql
CREATE TABLE IF NOT EXISTS middle_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id INT REFERENCES districts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,         -- اسم المتوسطة (مثال: متوسطة المجاهد باهي علي)
  commune TEXT NOT NULL,      -- البلدية (الوادي، قمار، الدبيلة...)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3️⃣ جدول الملفات الشخصية (`profiles`)
يرتبط مباشرة بجدول مستخدمي Supabase `auth.users` ويحدد الرتبة والصلاحيات:
```sql
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'inspector', 'admin')),
  full_name TEXT NOT NULL,
  phone TEXT,
  district_id INT REFERENCES districts(id) ON DELETE SET NULL,
  middle_school_id UUID REFERENCES middle_schools(id) ON DELETE SET NULL,
  school_custom_name TEXT,     -- في حال كتابة اسم المتوسطة يدوياً
  teacher_code TEXT UNIQUE,    -- كود مميز للأستاذ (مثال: MTH-101)
  slug TEXT UNIQUE,            -- رابط فضاء الأستاذ (مثال: adaika)
  levels_taught INT[] DEFAULT '{1,2}', -- المستويات التي يدرسها [1, 2, 3, 4]
  avatar_url TEXT,
  bio TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4️⃣ جدول الدروس والموارد (`lessons`)
يمثل درساً أو حصة أعمال موجهة أو سلسلة تمارين أو ملخص:
```sql
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level INT NOT NULL CHECK (level IN (1, 2, 3, 4)),
  type TEXT NOT NULL DEFAULT 'lessons' CHECK (type IN ('lessons', 'directed_work', 'worksheets', 'summaries')),
  field TEXT,                  -- الميدان: أنشطة عددية، أنشطة هندسية، تنظيم معطيات
  section TEXT,                -- المقطع المعرفي
  number INT NOT NULL,         -- رقم المورد أو الحصة
  title TEXT NOT NULL,         -- عنوان الدرس
  notes TEXT,                  -- توجيهات الأستاذ للدرس
  homework_notes TEXT,         -- توجيهات الواجب المنزلي
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5️⃣ جدول صور السبورة والواجبات (`lesson_images`)
يخزن روابط وتفاصيل صور ألواح السبورة التابعة لكل درس:
```sql
CREATE TABLE IF NOT EXISTS lesson_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  image_type TEXT NOT NULL DEFAULT 'lesson' CHECK (image_type IN ('lesson', 'homework')),
  url TEXT NOT NULL,
  download_url TEXT,
  name TEXT,
  file_type TEXT DEFAULT 'image' CHECK (file_type IN ('image', 'pdf')),
  sort_order INT DEFAULT 0,    -- لترتيب ألواح السبورة تسلسلياً (1، 2، 3...)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6️⃣ جدول المذكرات البيداغوجية (`pedagogical_notes`)
**سري للغاية** — مخصص للتواصل البيداغوجي المباشر بين الأستاذ ومفتش المقاطعة:
```sql
CREATE TABLE IF NOT EXISTS pedagogical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  district_id INT REFERENCES districts(id),
  level INT NOT NULL CHECK (level IN (1, 2, 3, 4)),
  semester INT NOT NULL CHECK (semester IN (1, 2, 3)),
  lesson_title TEXT NOT NULL,  -- عنوان المذكرة أو النشاط
  file_path TEXT NOT NULL,     -- مسار الملف في الـ Bucket الخاص
  file_name TEXT,
  teacher_notes TEXT,          -- تبريرات واختيارات الأستاذ
  inspector_feedback TEXT,     -- ملاحظات وتوجيهات المفتش
  reviewed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'needs_revision')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7️⃣ جدول مناشير المفتش (`inspector_circulars`)
المناشير الرسمية ومواعيد الندوات التكوينية التي يبثها المفتش لأساتذة مقاطعته:
```sql
CREATE TABLE IF NOT EXISTS inspector_circulars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspector_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  district_id INT NOT NULL REFERENCES districts(id),
  target_school_id UUID REFERENCES middle_schools(id),
  target_teacher_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  attachment_path TEXT,
  importance TEXT DEFAULT 'normal' CHECK (importance IN ('normal', 'urgent', 'seminar')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 8️⃣ جدول قراءة المناشير (`circular_reads`)
لتوثيق تاريخ ووقت اطلاع كل أستاذ على منشور المفتش:
```sql
CREATE TABLE IF NOT EXISTS circular_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circular_id UUID REFERENCES inspector_circulars(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circular_id, teacher_id)
);
```

### 9️⃣ جدول الإعلانات المدرسية (`announcements`)
```sql
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('absence', 'lesson', 'update', 'general', 'urgent')),
  date TEXT,
  pinned BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 🔟 جدول لوحة الشرف (`honors`)
```sql
CREATE TABLE IF NOT EXISTS honors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  notes TEXT,
  badge TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🪣 3. مخازن التخزين السحابي (Supabase Storage Buckets)

تم تقسيم التخزين السحابي إلى 3 Buckets تضمن أعلى درجات الخصوصية:

| اسم الـ Bucket | نوع الوصول | المحتوى | طريقة الوصول |
| :--- | :--- | :--- | :--- |
| `public-lesson-media` | **عام (Public)** | صور السبورة، الواجبات، سلاسل التمارين | رابط مباشر CDN عبر `getPublicMediaUrl()` |
| `private-pedagogical-notes` | **خاص (Private)** | مذكرات التحضير البيداغوجي للأستاذ | روابط موقّعة مؤقتة (15 دقيقة) عبر `getPrivateNoteSignedUrl()` |
| `private-inspector-docs` | **خاص (Private)** | مراسلات وتوجيهات وتقارير التفتيش | روابط موقّعة مؤقتة |

---

## 🔒 4. سياسات أمان البيانات (Row Level Security - RLS)

تم تفعيل RLS على كافة الجداول وفق القواعد التالية:

1. **الدروس وصور السبورة (`lessons`, `lesson_images`):**
   - **القراءة:** مفتوحة للجميع (Public Read) لتمكين الأولياء والتلاميذ من مراجعة الدروس دون تسجيل.
   - **الإضافة والتعديل والحذف:** حصراً للأستاذ صاحب الدرس (`auth.uid() = teacher_id`).

2. **المذكرات البيداغوجية (`pedagogical_notes`):**
   - **الوصول:** محجوب تماماً عن غير المسجلين.
   - **الأستاذ:** يقرأ ويعدل مذكراته فقط (`auth.uid() = teacher_id`).
   - **المفتش:** يقرأ ويكتب ملاحظاته على مذكرات أساتذة مقاطعته التفتيشية فقط (`district_id`).

3. **المناشير التفتيشية (`inspector_circulars`):**
   - **الإنشاء:** حصرياً لمن يحمل دور `role = 'inspector'` في جدول `profiles`.
   - **القراءة:** متاحة لجميع أساتذة المقاطعة المستهدفة.

---

## ⚡ 5. المشغلات التلقائية (Triggers)

### إنشاء ملف الأستاذ وتوليد الكود تلقائياً عند التسجيل:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  rand_num INT;
BEGIN
  rand_num := floor(random() * 900 + 100)::INT;
  new_code := 'MTH-' || rand_num;

  INSERT INTO public.profiles (id, full_name, role, teacher_code, slug)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'أستاذ رياضيات'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'),
    new_code,
    LOWER(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', 'teacher-' || rand_num), '\s+', '-', 'g'))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 🚀 كيفية تطبيق هذا المخطط على مشروعك الجديد

1. افتح مشروعك في **[supabase.com](https://supabase.com)**.
2. توجه إلى **SQL Editor**.
3. افتح ملف `supabase/wilaya_schema.sql` في محرر الأكواد وانسخ كامل محتواه.
4. الصق الكود في SQL Editor واضغط **Run**.
5. سيتم إنشاء الجداول، المؤشرات، السياسات، والمخازن السحابية في ثوانٍ معدودة.
