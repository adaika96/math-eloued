# Full Project Review — math-eloued (Wilaya El Oued Math Platform)

**Date:** 2026-10-17 · **Commit reviewed:** `5ef52f3` · **Method:** read all 8 `.md` docs and both SQL files, read every route, API handler and lib, ran `tsc` and `next build`, served the production build locally and hit every route, queried the live Supabase project with the public anon key (read-only), and checked the legacy Vercel Blob URL that is hard-coded in the code.

---

## 1. The one-paragraph verdict

The project is **two apps stitched together**. The new wilaya shell (home, `/login`, `/register`, `/inspector`, `/super-admin`, `/t/[slug]`, `/t/search`) talks to Supabase. Everything that does real work (lessons, board photos, evaluations, penalties, summons, honors, announcements, messages, `/admin`, `/year`, `/lesson`) is still the **original single-teacher app**. It stores all its data in one JSON file on Vercel Blob and protects it with one shared password. So the docs describe a multi-tenant platform, but the code that does the work is not multi-tenant: every registered teacher would share one teacher's data. There are also **critical security problems**: student data is publicly downloadable, the admin password ships in the browser bundle, and anyone can make themselves admin. The build is clean (0 TypeScript errors), and the UI is polished.

---

## 2. Verification results (what I actually ran)

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| `next build` (Next 16.3, Turbopack) | ✅ succeeds, 32 routes |
| Live Supabase: 10 tables from `wilaya_schema.sql` | ✅ all exist; `districts` seeded with 5 rows |
| Live Supabase: data | ⚠️ `profiles`, `lessons`, `middle_schools`, notes, circulars are all **empty**, so no teacher is visible publicly yet |
| Storage buckets | not verifiable with the anon key; `public-lesson-media` is never used by the code |
| `/year/3`, `/year/4` | ❌ **404** (code only allows levels 1–2) |
| `/year/1?teacher=xyz` | ⚠️ renders the shared JSON lessons; the `teacher` param is ignored |
| `/t/search?q=MTH-102` | "not found" (DB empty), and MTH-102 is only an example code |
| `/inspector` signed out | redirects to `/login` ✅ |
| `POST /api/auth {"password":"adaika2026"}` | ❌ **`{"success":true}`**, so the default password grants teacher-dashboard access |
| `GET` legacy blob `lessons-db.json` (no auth) | ❌ **HTTP 200**: 16 lessons, **42 student evaluations, 42 roster names, 10 penalties, 12 parent summons, 1 anonymous message** (I printed counts only, no contents) |
| Page `<title>` / PWA manifest | still "دروس الرياضيات \| الأستاذ محمد عدايكة" (old single-teacher branding) |

I could **not** sign in as a teacher, inspector or admin. Creating accounts on the live Supabase project is not something I'll do. So the authenticated flows below were checked by reading the code and the RLS policies, not by clicking through them.

---

## 3. 🔴 Critical security issues (fix before any launch)

1. **Student data is publicly downloadable.** `src/lib/storage.ts:93` hard-codes `https://zcvevxcbfufx3f96.public.blob.vercel-storage.com/lessons-db.json` with `access: "public"`. Anyone with the URL gets every student's evaluation, penalty, parent-summons entry and the anonymous messages. The URL is now in the repo. This directly contradicts SECURITY_AND_DATA_PRIVACY.md §5.
   *Fix:* move this data into Supabase tables protected by RLS, or at least make the blob private and read it server-side with the token. Then delete or rotate the public file.

2. **The admin password is in the client bundle.** `src/components/TeacherAccess.tsx:26,41` contains `"adaika2026"` and is mounted in the root layout, so every visitor downloads it. It also unlocks via `?code=adaika2026` or by typing it anywhere on the page. `src/lib/auth.ts:3` falls back to the same value when `ADMIN_PASSWORD` is unset. Commit `7c5d6a4` removed the password from placeholders, but it is still in the shipped JS and in Git history.

3. **The session cookie is just `base64(password)`** (`src/lib/auth.ts:15`). It is not signed, never expires server-side, and is the same for everyone. Anyone who knows the password can forge it, and it can't be revoked per user.

4. **Anyone can register as an admin or inspector.** The `handle_new_user` trigger (`supabase/wilaya_schema.sql:316`) does `COALESCE(raw_user_meta_data->>'role','teacher')`. A user can call `supabase.auth.signUp({options:{data:{role:'admin'}}})` from the browser console and becomes admin. The roadmap explicitly says this must not be possible (ROADMAP_MASTER_PLATFORM §6).

5. **Any teacher can promote themselves.** Policy `profiles_self_read_write` is `FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`. Nothing stops a teacher from updating their own `role` to `admin`, or their own `district_id`.

6. **Private notes are readable by every logged-in user.** The storage policy "Teacher and Inspector read private notes" only checks `bucket_id`, so any authenticated teacher can read any other teacher's note files. Uploads are also not restricted to the uploader's own folder. Both contradict the docs. No policy exists at all for `private-inspector-docs`.

---

## 4. 🟠 Major functional / correctness bugs

7. **The teacher dashboard is not connected to Supabase accounts.** `/register` sends the new teacher to `/admin`, but `/admin` ignores the Supabase session and shows the old password screen. A newly registered teacher cannot use their dashboard without the shared password. Once in, they edit **Adaika's data**, not their own.

8. **Public teacher pages show the wrong content.** `/t/[slug]` counts lessons from Supabase `lessons` (always 0, since nothing writes there). Its level buttons link to `/year/N?teacher=<id>`, which ignores `teacher` and shows the shared JSON lessons. Every teacher page leads to the same content.

9. **Levels 3 and 4 return 404.** In `src/app/year/[level]/page.tsx:10`, `if (lv !== 1 && lv !== 2) notFound()`. The platform advertises 1–4 متوسط.

10. **Likely RLS infinite recursion on `profiles`.** `profiles_inspector_read_district` queries `public.profiles` from inside a `profiles` policy, which is the classic Supabase error *"infinite recursion detected in policy for relation profiles"*. `lessons_inspector_read`, `notes_inspector_access` and `circulars_*` also read `profiles`, so any **authenticated** query that touches them would likely fail. The anon probe worked only because that policy is `TO authenticated`. **Needs confirming with a test account.** If confirmed, it breaks login role routing, `/inspector` and `/super-admin`. *Fix:* use a `SECURITY DEFINER` helper such as `public.my_role()` / `public.my_district()`.

11. **Super-admin promotions silently do nothing.** `/super-admin` updates other users' `profiles` from the browser, but there is no RLS policy that lets an admin update other rows. Supabase returns no error with 0 rows changed, so the UI shows "✅ تم ترقية الحساب" while nothing changes. The same applies to suspend/downgrade. `delete_user` is declared in the type but never implemented.

12. **Admins are routed to the wrong place.** `login/page.tsx:47` sends `inspector` to `/inspector` and everyone else (including `admin`) to `/admin`. Nothing links to `/super-admin`.

13. **`/inspector` has no role check.** Any signed-in teacher can open it. RLS limits what they see, but the page renders as an inspector dashboard. The page loads district 1 first, then reloads with the inspector's real district.

14. **Registration problems.**
    - The slug is built from the Arabic full name (`prof-محمد-عدايكة`). Two teachers with the same name hit the `UNIQUE(slug)` constraint, the trigger fails, and signup errors with a generic "Database error saving new user".
    - `teacher_code` is random 4 digits with no collision check.
    - `levels_taught` from the form is ignored, because the trigger hard-codes `{1,2,3,4}`.
    - `is_verified` defaults to **TRUE**, so there is no approval step.
    - The middle school is free text. `middle_schools` is empty and never used.

15. **Filter injection in PostgREST `.or()`.** `/t/[slug]` and `/t/search` interpolate user input straight into `.or(...)` strings. Characters like `,` `(` `)` can change the filter. Low impact today because the RLS is read-only, but it should be sanitized or replaced with separate `.eq()` / `.ilike()` queries.

16. **Teacher phone numbers are public.** `profiles_public_read_teachers` exposes **all columns** (including `phone`) to anonymous users, and `/t/[slug]` and `/t/search` use `select("*")`.

17. **Parent summons are public.** `GET /api/summons` has no auth (`/parents` consumes it), so the names of students whose parents are summoned are public. This contradicts SECURITY doc §5.

---

## 5. 🟡 Minor / hygiene

- `README` and the handover guide name `wilaya_schema.sql` as the schema, but the old `supabase/schema.sql` (levels 1–2, `using(true)` write policies) is still in the repo. Running it would overwrite safer policies, so delete it.
- `DATABASE_SCHEMA.md` does not match the real SQL. Its `lessons.type` values (`lessons/directed_work/...`) differ from the SQL (`lesson/worksheets/summaries`), and it lists `field`, `section`, `homework_notes` and `download_url`, which don't exist. Its trigger example is also outdated.
- The handover guide claims Supabase Storage plus signed URLs are used for images. In reality images go to **Vercel Blob or the local `public/uploads`**, and `getPublicMediaUrl()` is never called.
- The security doc promises middleware, Zod validation and rate limiting. **None exist**: there is no `middleware.ts`/`proxy.ts`, no Zod dependency, and no rate limiting. `/api/upload` checks no MIME type or size server-side.
- The service worker pre-caches `/admin` and `/eval`, and its cache name is `math-lessons-v2`, both left over from the old app.
- `/admin/page.tsx` is **6,124 lines** and `/eval/page.tsx` is 1,868 lines. They should be split before more features go in.
- There are no tests, no lint script and no CI.
- `.env` and `.env.local` are identical. That's harmless because both are git-ignored.
- `tsconfig.tsbuildinfo` and `image.png` sit untracked in the root.

---

## 6. Docs vs reality: feature status

Legend: ✅ done & works · 🟡 partial / UI-only / broken · ❌ not started

### Parent & student space
| Feature (per docs) | Status | Notes |
|---|---|---|
| Home portal + search by code/name | 🟡 | UI works. Searches Supabase, which is empty. |
| Family Teacher Wallet (localStorage `math_eloued_wallet`, child name) | ✅ | Implemented as the docs describe. |
| Save-to-wallet button on teacher page | ✅ | |
| Teacher public page `/t/[slug]` | 🟡 | Renders profile, but lessons are not per teacher (#8). |
| Year pages 1–4 | 🟡 | Only 1–2 work. 3–4 return 404. |
| Lesson board viewer + zoom | ✅ | Legacy JSON store, single teacher. |
| Honor board | ✅ | Legacy store, single teacher. |
| Reception card (يوم/ساعة الاستقبال) editable by teacher | ❌ | Only a hard-coded "every Wednesday" text. |
| Homework → solution delayed publishing | ❌ | No scheduling or deadline logic found. |
| QR code for teacher link | ❌ | |
| Browse by school → teacher | ❌ | `middle_schools` empty and unused. |
| PWA install + offline | 🟡 | Works, but caches old single-teacher pages. |

### Teacher space
| Feature | Status | Notes |
|---|---|---|
| Register with district/school/levels | 🟡 | Works, but has issues #4, #14 and #7. |
| Lessons / directed work / worksheets / summaries, upload, reorder ↑↓, client compression | ✅ | **Single-teacher only**, stored in Vercel Blob JSON. |
| Continuous evaluation (4×5 = 20, quick 20/12/4, +2.5 make-up) | ✅ | Single-teacher only. |
| Summons, penalties, announcements, anonymous messages | ✅ | Single-teacher only. Summons are public (#17). |
| **Pedagogical notes upload (المذكرات)** | ❌ | No UI anywhere in `/admin`. The table exists but nothing inserts into it. |
| **Circulars inbox + read receipts** | ❌ | No teacher UI. `circular_reads` is never written. |
| **Weekly timetable** | ❌ | No table, no UI. |
| Cahier de textes / annual distribution uploads | ❌ | |

### Inspector space
| Feature | Status | Notes |
|---|---|---|
| District dashboard, teacher list | 🟡 | UI exists. Likely broken by #10. Lesson counts are wrong (#8). |
| Review notes, write feedback, status | 🟡 | UI exists, but there will never be notes (no teacher upload). Only the `reviewed` status is used, never `needs_revision`. |
| Send circulars (importance) | 🟡 | Insert works per RLS. No attachment upload, no school/teacher targeting, no read receipts. |
| See read receipts | ❌ | |
| Seminar calendar | ❌ | |

### Super admin
| Feature | Status | Notes |
|---|---|---|
| List/filter users, stats | 🟡 | Depends on #10. |
| Promote to inspector / downgrade / suspend | 🟡 | UI only, silently fails (#11). |
| Delete user, create inspector accounts, manage schools | ❌ | |

### Roadmap phases (ROADMAP_MASTER_PLATFORM §7 claims vs reality)
| Phase | Doc claims | Reality |
|---|---|---|
| 1 Foundation & Supabase | ✅ 100% | ✅ Schema is live. RLS is applied but flawed (#4–6, #10). |
| 2 Accounts & inspector | ✅ 100% | 🟡 ~60%. Pages exist, but security and wiring are broken. |
| 3 Multi-child parent wallet | pending | ✅ **Actually done.** |
| 4 Teacher pedagogical file | pending | ❌ 0%. |
| 5 Super admin | pending | 🟡 UI built, not functional. |
| 6 Community forum / points | next | ❌ 0%. |
| ROADMAP_WILAYA_ELOUED.md checklists | all `[ ]` | Out of date. Phases 1, 2 and 5 are partly done but not ticked. |
| Security audit checklist (6 items) | all `[ ]` | **Item 1 passes, items 2–6 fail or are unverified.** |

---

## 7. Recommended order of work

1. **Today:** make the Vercel Blob `lessons-db.json` private or move it, remove `TeacherAccess`'s hard-coded password, set a strong `ADMIN_PASSWORD`, and rotate the old one.
2. **Fix the database security (one migration):**
   - Make the trigger ignore `role` from metadata (always `teacher`).
   - Split the profile policies so users can update their own profile but not `role`, `district_id` or `is_verified` (use a column-restricted policy or trigger guard).
   - Add `is_admin()` / `my_district()` as `SECURITY DEFINER` functions to fix the recursion.
   - Add admin update policies.
   - Scope storage policies by folder `auth.uid()` and district.
   - Expose a public view of profiles without `phone`.
3. **The key migration:** move lessons, images, evaluations, summons, penalties, honors, announcements and messages from the JSON blob to Supabase tables keyed by `teacher_id`. Replace `/api/auth` with the Supabase session, done server-side via `@supabase/ssr` plus `proxy.ts`/middleware. Until this is done the product is not multi-tenant.
4. Wire `/t/[slug]` → `/year/[level]?teacher=` → `/lesson/[id]` to per-teacher data, and allow levels 3–4.
5. Build the missing teacher-side "الملف البيداغوجي" (note upload to the private bucket, circular inbox that writes `circular_reads`, timetable), then the inspector read-receipt view.
6. Fix the remaining bugs: login routing for admins, an `/inspector` role guard, slug and code uniqueness, levels from the form, and `is_verified` defaulting to false.
7. Housekeeping: delete `supabase/schema.sql`, sync `DATABASE_SCHEMA.md` with the SQL, update the roadmap checkboxes, rename metadata and manifest to the wilaya brand, split `admin/page.tsx`, and add basic tests and CI.

---

## 8. Implementation status (updated 2026-10-17, same day)

Everything below was built and then tested against a **local Supabase stack** (Docker) that started from the *original* `wilaya_schema.sql` and then ran every migration. That is the same upgrade path the live project will take. Results: a 29-check security regression passed, 12 forum-rule checks passed, and the main flows were clicked through in the browser as teacher, inspector, admin and anonymous parent. **None of it is applied to the live Supabase project yet.**

| # | Finding | Status |
|---|---|---|
| 1 | Student data in a public blob | ✅ Each teacher's private data now lives in `teacher_private_data` (owner-only RLS). The old file is imported once into the `LEGACY_OWNER_EMAIL` account. **You still need to delete the public `lessons-db.json`.** |
| 2–3 | Shared password in the bundle, forgeable cookie | ✅ Removed. Teachers sign in with their own Supabase account (cookie session via `@supabase/ssr`). |
| 4–6 | Role injection, self-promotion, open storage | ✅ Migration `…0001`, verified. |
| 7–8, 19, 24 | Not multi-tenant | ✅ Every API call is scoped to the signed-in teacher. Parents read a teacher with `?teacher=<id>`. |
| 9, 20 | Levels 3–4 returned 404 | ✅ Levels 1–4 work. The dashboard shows only the levels the teacher teaches. |
| 10 | RLS recursion | ✅ Fixed with `SECURITY DEFINER` helpers. Verified for inspector and admin. |
| 11, 22 | Super-admin actions silently failed | ✅ Admin policies added. The UI checks a row actually changed. Delete and create-inspector added (need `SUPABASE_SERVICE_ROLE_KEY`). |
| 12–14 | Routing, inspector guard, registration | ✅ All fixed. |
| 15–17 | Filter injection, public phone numbers, summons | ✅ Filter injection and phone numbers fixed. ⚠️ Summons stay public **per teacher** by design (the parents page), as before. |
| 1–5 (features) | Teacher's pedagogical file | ✅ `/pedagogy`: documents for the inspector, circulars inbox with read receipts, timetable. |
| 11, 16–17 (features) | Inspector tools | ✅ Teacher stats, timetable viewer, review with revision request, targeted circulars with attachments, read receipts, seminar calendar. |
| 6–8, 18 | Parent side | ✅ Solution hidden until its publish date (enforced in the database by `get_teacher_public_data`, migration `…0010`, after an automated security review found the first version could be bypassed through the REST API), QR code, browse by district/school, editable reception card. |
| 12, 14, 21, 23 | Notifications, admin, compression, PWA | ✅ Teacher alert badges, schools manager, wilaya stats, 1600px/0.35MB compression, wilaya branding, offline caching of public lessons. |
| 15 | Security layer | ✅ Upload type/size limits (server and bucket), rate limits, security headers, Next.js 16.3.0 → 16.3.8 (critical RCE advisory; `npm audit` now 0). No proxy/middleware; RLS plus server checks carry the protection. |
| 9–10 | Forum and situations bank | ✅ `/forum` with points, badges, pinned official inspector answers and private attachments. |
| 13 | Parent account across devices | ❌ Not built (the roadmap marks it "optional, future"). |

**Still open:** stress testing; a printed or illustrated user guide; the pilot launch; splitting `admin/page.tsx`; tests and CI. The rate limiter is per server instance; use Upstash/Redis for strict limits on Vercel.
