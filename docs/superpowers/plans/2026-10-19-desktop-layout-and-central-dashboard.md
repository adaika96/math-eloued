# Desktop Layout and Central Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the central dashboard, teacher workspace and parent pages a desktop layout (top bar + tabs) without changing phones, and add wilaya circulars, an action log, moderation and database-side stats to `/super-admin`.

**Architecture:** One new idempotent migration adds the data pieces (nullable circular district, `admin_audit_log` filled by triggers, two admin-only SQL functions, one storage policy). UI work is additive `lg:` Tailwind classes plus a route classifier in `AppShell`; `/super-admin` is split into one file per tab.

**Tech Stack:** Next.js 16.3.8 App Router, React, Tailwind v4, Supabase (Postgres + RLS + Storage), lucide-react, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-19-desktop-layout-and-central-dashboard-design.md`

## Global Constraints

- Desktop breakpoint is Tailwind `lg` (1024px). Below it every page looks and behaves as today; the only allowed phone change is the `/super-admin` tab strip scrolling horizontally.
- Desktop styling uses only `lg:`/`xl:` prefixed classes; existing DOM order is not changed.
- Arabic, `dir="rtl"`; desktop look copies `/inspector` (64px gradient top bar, white tab strip with underline on the active tab).
- Migration file: `supabase/migrations/20261019000001_central_dashboard.sql`, idempotent, applied after 0001–0011. Do not touch the live Supabase.
- No new npm dependencies. Read `node_modules/next/dist/docs/` before using a Next API you have not used in this repo.
- Admin tools never read or write `teacher_private_data`, and never edit `teacher_public_data`.
- Don't push. Commit after each task on `feat/wilaya-multitenant-platform`. Never commit `image.png`.

## Review Focus

- A teacher whose `teacher_public_data.data->'lessons'` is missing or not an array must not break `admin_wilaya_stats()` (count 0). → Task 1 test `stats_tolerates_bad_lessons`.
- A teacher editing their own bio/name must not write audit rows; only changes by someone else count. → Task 1 test `owner_edit_not_logged`.
- A teacher in district 3 must be able to open a wilaya circular's attachment (`wilaya/…`) but not district 2's files. → Task 1 test `wilaya_attachment_readable`.
- A teacher, inspector or anonymous caller calling the admin functions must get an error, not data. → Task 1 test `admin_functions_reject_non_admin`.
- At 375px the 7-tab `/super-admin` strip must not widen the page (`document.documentElement.scrollWidth === innerWidth`). → Task 4 Step "phone check".

## Preconditions

- Local Supabase stack running from the scratchpad project (`npx supabase start` in the session's `scratchpad/sb`, project `math-eloued-test`) with migrations 0001–0011 applied and the test accounts `teacher1`, `teacher2`, `inspector1`, `admin1` (`@test.local`) created by the earlier regression script. If Docker is unresponsive, stop and tell the user; do not restart Docker Desktop (other projects use it).
- Dev server: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key> npx next dev -p 3127`.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261019000001_central_dashboard.sql` (create) | all DB changes |
| `supabase/tests/central_dashboard.test.sql` (create) | SQL assertions, runs in a rolled-back transaction |
| `src/lib/layoutMode.ts` + `.test.ts` (create) | `layoutFor(pathname)` route classifier |
| `src/components/AppShell.tsx` (modify) | use `layoutFor` |
| `src/app/api/admin/users/route.ts` (modify) | write audit rows for create/delete |
| `src/app/super-admin/page.tsx` (modify) | shell: top bar, tabs, accounts tab |
| `src/app/super-admin/OverviewTab.tsx` (create) | KPIs, district table, side panels |
| `src/app/super-admin/InspectorsTab.tsx` (create) | create form + inspectors by district |
| `src/app/super-admin/WilayaCircularTab.tsx` (create) | wilaya circulars |
| `src/app/super-admin/ModerationTab.tsx` (create) | forum + announcements feed |
| `src/app/super-admin/AuditLogTab.tsx` (create) | log viewer |
| `src/app/super-admin/WilayaStats.tsx` (delete) | replaced by OverviewTab |
| `src/lib/auditLabels.ts` + `.test.ts` (create) | action → Arabic label |
| `src/app/pedagogy/CircularsInbox.tsx`, `src/app/inspector/CircularsTab.tsx` (modify) | "منشور ولائي" badge |
| `src/app/admin/page.tsx` (modify) | desktop top bar + two-column tabs |
| `src/app/t/[slug]/page.tsx`, `src/app/year/[level]/YearLessons.tsx`, `src/app/lesson/[id]/LessonView.tsx` (modify) | parent desktop layouts |
| `src/app/my-children/page.tsx` (modify) | one column per child |
| `package.json` (modify) | add new test files to `test` script |

---

### Task 0: Phone baselines

**Files:** none committed (screenshots in the session scratchpad `baseline/`).

- [ ] **Step 1:** With the dev server on the local stack, set the browser viewport to 375×812 and screenshot, logged in as the right account: `/super-admin` (admin1), `/admin` every tab (teacher1), `/t/<teacher1 slug>`, `/year/1?teacher=<id>`, one `/lesson/<id>?teacher=<id>`, `/my-children` with teacher1 saved. Seed teacher1 with 4 lessons, 2 announcements, 1 summons, 1 honor first (same REST pattern as `scratchpad/embargo_test.sh`).
- [ ] **Step 2:** Save them as `baseline/<route>.png`. These are the "before" images every later task compares against.

### Task 1: Migration and SQL tests

**Files:**
- Create: `supabase/migrations/20261019000001_central_dashboard.sql`
- Test: `supabase/tests/central_dashboard.test.sql`

**Interfaces — Produces:**
- `inspector_circulars.district_id` nullable; `NULL` = wilaya-wide.
- Table `public.admin_audit_log(id uuid pk default gen_random_uuid(), actor_id uuid references profiles on delete set null, action text not null, target_type text not null, target_id text, details jsonb not null default '{}', created_at timestamptz not null default now())`, index on `created_at desc`.
- Actions written: `role_changed`, `district_changed`, `account_suspended`, `account_reactivated`, `school_added`, `school_updated`, `school_deleted`, `wilaya_circular_published`, `wilaya_circular_deleted`, and (from Task 3) `inspector_created`, `user_deleted`. `details` holds `{"from":…, "to":…}` or the row's name/title.
- `public.admin_wilaya_stats() returns table(district_id int, district_name text, inspector_name text, teachers int, inspectors int, active_teachers int, lessons int, notes_submitted int, notes_reviewed int, circulars int, suspended int, new_this_week int)` — one row per district, ordered by `district_id`. Raises `'admin only'` unless `is_admin()`.
- `public.admin_recent_announcements(p_limit int default 50) returns table(teacher_id uuid, teacher_name text, slug text, title text, content text, category text, created_at timestamptz)` — newest first, only `active` not false. Raises `'admin only'` unless `is_admin()`.

- [ ] **Step 1: Write the failing test** `supabase/tests/central_dashboard.test.sql`: `BEGIN;` … `ROLLBACK;`. Create 4 users by inserting into `auth.users` (the existing signup trigger creates profiles), set roles/districts as postgres, then impersonate with `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', json_build_object('sub', <id>, 'role','authenticated')::text, true);`. Each check is a `DO` block that `RAISE EXCEPTION '<name> failed'` on a wrong result:
  - `wilaya_circular_visible`: admin inserts a circular with `district_id NULL`; a district-3 teacher selects it (count 1); a district-2 inspector selects it (count 1).
  - `inspector_cannot_publish_wilaya`: district-1 inspector inserting `district_id NULL` raises (RLS).
  - `wilaya_attachment_readable`: as postgres insert `storage.objects` rows `private-inspector-docs/wilaya/a.pdf` and `private-inspector-docs/2/b.pdf`; district-3 teacher sees exactly 1 (`wilaya/a.pdf`).
  - `role_change_logged`: admin updates teacher2 `role='inspector', district_id=2` → `admin_audit_log` has one `role_changed` row with `actor_id = admin`, `details->>'to' = 'inspector'`, and one `district_changed`.
  - `suspend_logged`: admin sets teacher1 `is_verified=false` → one `account_suspended` row.
  - `owner_edit_not_logged`: teacher1 updates own `bio` → log count unchanged.
  - `school_delete_logged`: admin inserts then deletes a `middle_schools` row → `school_added` and `school_deleted` rows.
  - `log_admin_only`: teacher and inspector `SELECT count(*) FROM admin_audit_log` = 0; teacher `INSERT` into it raises.
  - `stats_counts`: seed teacher1 `teacher_public_data` with 3 lessons; `admin_wilaya_stats()` row for teacher1's district has `lessons = 3`, `teachers ≥ 1`, 5 rows total.
  - `stats_tolerates_bad_lessons`: teacher2 public data `{"lessons": {}}` → function still returns, that district's `lessons` unaffected.
  - `admin_functions_reject_non_admin`: as teacher and as `anon`, both functions raise.
  - `recent_announcements`: teacher1 public data has one active and one `"active": false` announcement → function returns exactly the active one.
- [ ] **Step 2: Run it to make sure it fails**
  Run: `docker exec -i supabase_db_math-eloued-test psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/central_dashboard.test.sql`
  Expected: FAIL — `null value in column "district_id"` or `function admin_wilaya_stats() does not exist`.
- [ ] **Step 3: Write the migration.** Contents, each guarded for re-runs (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`/`DROP TRIGGER IF EXISTS`):
  - `ALTER COLUMN district_id DROP NOT NULL` on `inspector_circulars`.
  - Replace `circulars_inspector_all`: admins all; inspectors only `district_id = my_district()` (so `NULL` is admin-only, as today's check already implies; keep it explicit).
  - Replace `circulars_teacher_read` with `district_id IS NULL OR district_id = my_district()` plus the existing target filters. Add `circulars_inspector_read_wilaya` (`SELECT` for `my_role()='inspector' AND district_id IS NULL`).
  - Replace `"District read inspector docs"` adding `OR (storage.foldername(name))[1] = 'wilaya'`.
  - `admin_audit_log` table, RLS on, one policy `FOR SELECT USING (is_admin())`, `REVOKE INSERT, UPDATE, DELETE` from `anon, authenticated`.
  - `log_admin_action(action, target_type, target_id, details)` `SECURITY DEFINER` helper used by the triggers.
  - Trigger on `profiles AFTER UPDATE`: only when `auth.uid() IS DISTINCT FROM NEW.id`; one row per changed column among `role`, `district_id`, `is_verified`.
  - Trigger on `middle_schools AFTER INSERT OR UPDATE OR DELETE` when `is_admin()`.
  - Trigger on `inspector_circulars AFTER INSERT OR DELETE` when the row's `district_id IS NULL`.
  - The two functions per the Interfaces block. "Active" = `greatest(public.updated_at, private.updated_at) > now() - interval '7 days'`. Lessons via `CASE WHEN jsonb_typeof(data->'lessons')='array' THEN jsonb_array_length(...) ELSE 0 END`. `new_this_week` from `profiles.created_at`. `GRANT EXECUTE` to `authenticated` only; `REVOKE` from `PUBLIC, anon`.
- [ ] **Step 4: Apply twice, then run the test**
  Run: apply the migration file twice with the same `docker exec … psql -v ON_ERROR_STOP=1 <` command, then the test file.
  Expected: both applies succeed; test prints no exception and ends `ROLLBACK`.
- [ ] **Step 5: Re-run the earlier regression scripts** (`scratchpad/regression.sh`, `embargo_test.sh`, `forum_test.sh`). Expected: `35 passed`, `11 passed`, 12 forum lines as before.
- [ ] **Step 6: Commit** — `feat(db): wilaya circulars, admin audit log and admin stats functions`. Update `README.md` migration list (0001→0012) and `DATABASE_SCHEMA.md` (new table + functions) in the same commit.

### Task 2: Route layout classifier

**Files:**
- Create: `src/lib/layoutMode.ts`, `src/lib/layoutMode.test.ts`
- Modify: `src/components/AppShell.tsx`, `package.json` (`test` script lists every `*.test.ts` under `src/lib`)

**Interfaces — Produces:** `export type LayoutMode = "full" | "wide" | "phone"; export function layoutFor(pathname: string): LayoutMode`.

- [ ] **Step 1: Write the failing test** `layoutFor`: `"/"`, `"/super-admin"`, `"/inspector"`, `"/t/khaled"`, `"/forum/x"`, `"/login"` → `"full"`; `"/admin"`, `"/year/1"`, `"/lesson/abc"`, `"/my-children"` → `"wide"`; `"/administrator"` → `"phone"` (prefix must match a whole segment); `"/honor"`, `"/pedagogy"`, `"/settings"` → `"phone"`.
- [ ] **Step 2:** `npm test` → FAIL (module not found).
- [ ] **Step 3:** Implement; move today's `FULL_WIDTH_PREFIXES` logic into it, fixing the segment match. `AppShell`: `"full"` → current `<main>`; `"wide"` → current wrapper with `max-w-xl lg:max-w-6xl`; `"phone"` → unchanged.
- [ ] **Step 4:** `npm test` → PASS. 375px screenshots of `/admin` and `/honor` match baseline.
- [ ] **Step 5: Commit** — `refactor(layout): route layout classifier with desktop-wide routes`.

### Task 3: Audit rows from the service-role routes

**Files:** Modify `src/app/api/admin/users/route.ts`.

**Interfaces — Consumes:** `admin_audit_log` (Task 1). Insert through `getSupabaseAdmin()` with `actor_id` = the verified calling admin's id.

- [ ] **Step 1:** After a successful inspector creation insert `{ action: "inspector_created", target_type: "profile", target_id: newId, details: { full_name, district_id } }`; after a successful delete insert `{ action: "user_deleted", target_type: "profile", target_id: id, details: { full_name } }` (read the name before deleting). A failed log insert is logged with `console.error` and does not fail the request.
- [ ] **Step 2: Verify** with curl as admin1 against the dev server: create then delete a throwaway inspector; `SELECT action FROM admin_audit_log ORDER BY created_at DESC LIMIT 2` → `user_deleted`, `inspector_created`.
- [ ] **Step 3: Commit** — `feat(admin): log inspector creation and user deletion`.

### Task 4: Central dashboard shell, overview, accounts and inspectors

**Files:**
- Modify: `src/app/super-admin/page.tsx`
- Create: `src/app/super-admin/OverviewTab.tsx`, `src/app/super-admin/InspectorsTab.tsx`
- Delete: `src/app/super-admin/WilayaStats.tsx`

**Interfaces:**
- Consumes: `admin_wilaya_stats()`, `admin_audit_log` (Task 1).
- Produces: `type AdminTab = "overview" | "accounts" | "inspectors" | "schools" | "circular" | "moderation" | "log"`; tab components take no props except `OverviewTab({ onOpenLog }: { onOpenLog: () => void })` and `InspectorsTab({ profiles, onChanged }: { profiles: UserProfile[]; onChanged: () => void })`.

- [ ] **Step 1:** Tabs in this order with these labels: نظرة عامة · الحسابات · المفتشون والمقاطعات · المتوسطات · منشور ولائي · مراقبة المحتوى · سجل العمليات. Default `overview`. Phone: keep today's header; the tab strip becomes `flex overflow-x-auto` with `shrink-0` buttons. `lg:`: 64px top bar (crown + "لوحة المشرف العام — ولاية الوادي" right; forum, inspector dashboard, my account, sign out left), the coloured header and its 5 chips hidden, underline tab strip.
- [ ] **Step 2:** `OverviewTab`: 5 KPI cards from summed rows — الأساتذة (`teachers`), نشطون هذا الأسبوع (`active_teachers`), دروس منشورة (`lessons`), مذكرات بانتظار المفتش (`notes_submitted − notes_reviewed`), حسابات معلقة (`suspended`); district table (district, inspector or "— بدون مفتش" in rose, teachers, active, reviewed/submitted bar, circulars); side column: "تسجيلات جديدة هذا الأسبوع" (sum of `new_this_week` + latest 5 teacher profiles by `created_at`) and "آخر العمليات" (latest 5 log rows via `auditLabel`, link calls `onOpenLog`). Phone: cards 2 per row, table becomes stacked district cards, side column below.
- [ ] **Step 3:** Accounts tab: keep search, filters, list and actions; on `lg` render the list as a table (name, code, role, district, school, status, actions). `InspectorsTab`: `CreateInspectorForm` plus inspectors grouped by district 1–5.
- [ ] **Step 4: Verify.** As admin1: overview numbers equal `SELECT * FROM admin_wilaya_stats()` run as admin; promote/suspend still work and show in the overview's latest-actions panel. Phone check: at 375px `document.documentElement.scrollWidth === innerWidth` and the header matches baseline. 1440px matches mockup B.
- [ ] **Step 5: Commit** — `feat(super-admin): desktop top bar, overview from database stats, inspectors tab`.

### Task 5: Audit log tab and labels

**Files:** Create `src/lib/auditLabels.ts`, `src/lib/auditLabels.test.ts`, `src/app/super-admin/AuditLogTab.tsx`.

**Interfaces — Produces:** `export function auditLabel(row: { action: string; details: Record<string, unknown> }): string` (used by Task 4's panel — Task 4 may land first with a raw `action` fallback, then switch to this).

- [ ] **Step 1: Write the failing test:** `role_changed` with `{from:"teacher",to:"inspector"}` → `"تغيير الدور: أستاذ ← مفتش"`; `account_suspended` → `"تعليق حساب"`; `school_deleted` with `{name:"متوسطة X"}` → `"حذف متوسطة: متوسطة X"`; unknown action `"foo"` → `"foo"`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement a lookup table. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `AuditLogTab`: newest first, 50 per page (`range`), filter select by action, columns: time, actor name, label, target name (join `profiles` client-side by id). Empty state "لا توجد عمليات بعد".
- [ ] **Step 6: Commit** — `feat(super-admin): action log tab`.

### Task 6: Wilaya circular tab and badges

**Files:** Create `src/app/super-admin/WilayaCircularTab.tsx`; modify `src/app/pedagogy/CircularsInbox.tsx`, `src/app/inspector/CircularsTab.tsx`.

**Interfaces — Consumes:** nullable `district_id`, `wilaya/` storage folder (Task 1); `BUCKETS.INSPECTOR_DOCS` from `src/lib/supabase.ts`.

- [ ] **Step 1:** Form and list follow `src/app/inspector/CircularsTab.tsx` (title, content, importance, event date, optional attachment); insert with `inspector_id = admin id`, `district_id = null`; upload to `wilaya/<timestamp>-<random>-<name>`; list only rows with `district_id IS NULL`, each with read count from `circular_reads`; delete removes the attachment too.
- [ ] **Step 2:** In the teacher inbox and the inspector list, rows with `district_id === null` show a badge "منشور ولائي".
- [ ] **Step 3: Verify:** admin publishes with a PDF; teacher1 (district 1) and teacher2 (district 2) both see it in `/pedagogy` with the badge and can open the PDF; teacher1 opening it increments the read count in the admin list; inspector1 sees it with the badge but has no delete button for it.
- [ ] **Step 4: Commit** — `feat(super-admin): wilaya-wide circulars`.

### Task 7: Moderation tab

**Files:** Create `src/app/super-admin/ModerationTab.tsx`.

**Interfaces — Consumes:** `admin_recent_announcements()` (Task 1); `forum_topics`, `forum_replies` tables.

- [ ] **Step 1:** Two sections side by side on `lg`, stacked on phone: (a) latest 30 forum topics and 30 replies with author name, link to `/forum/<topic id>`, delete with `confirm()`; (b) teachers' public announcements from the function, each with "فتح صفحة الأستاذ" (`/t/<slug>`) and "تعليق الحساب" reusing the accounts tab's suspend action (lift it to a function in `page.tsx` and pass it in as `onSuspend(teacherId: string)`).
- [ ] **Step 2: Verify:** deleting a reply removes it from `/forum/<id>`; suspending from here hides the teacher's `/t/` page (RPC returns null) and writes `account_suspended`.
- [ ] **Step 3: Commit** — `feat(super-admin): moderation tab`.

### Task 8: Teacher workspace desktop layout

**Files:** Modify `src/app/admin/page.tsx` (header around lines 1058–1195, tab bodies from 1286).

- [ ] **Step 1:** `lg` top bar: name, `teacher_code`, school; buttons preview (`/t/<slug>`), pedagogical file (`/pedagogy`, unread count from the existing `PedagogyAlerts` logic), forum, settings. Hide the quick-link cards with `lg:hidden`.
- [ ] **Step 2:** For lessons, announcements, summons, honors and penalties: wrap form + list in `lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-4 lg:items-start`; form gets `lg:sticky lg:top-4`; lessons list `lg:grid lg:grid-cols-2 lg:gap-2`. Evaluation cards `lg:grid-cols-3 xl:grid-cols-4`.
- [ ] **Step 3: Verify:** 375px screenshots of all 7 tabs match baseline; at 1440px, adding a lesson while scrolled down the list keeps the form visible; no horizontal scroll at 1024px.
- [ ] **Step 4: Commit** — `feat(admin): desktop layout for the teacher workspace`.

### Task 9: Parent pages desktop layout

**Files:** Modify `src/app/t/[slug]/page.tsx`, `src/app/year/[level]/YearLessons.tsx`, `src/app/lesson/[id]/LessonView.tsx`.

- [ ] **Step 1:** `/t/[slug]`: inner `max-w-2xl` → `max-w-2xl lg:max-w-6xl`; `lg` top bar per spec §3; level links become a tab strip on `lg`; main + 240px side column (`lg:grid lg:grid-cols-[minmax(0,1fr)_240px]`) holding announcements, reception card, `TeacherQR`.
- [ ] **Step 2:** `/year/[level]`: lesson cards `lg:grid-cols-3`. `/lesson/[id]`: images `lg:grid-cols-3`, homework/solution in a side column on `lg`.
- [ ] **Step 3: Verify:** 375px matches baseline for the three routes; locked solutions still show the lock at 1440px.
- [ ] **Step 4: Commit** — `feat(parents): desktop layout for teacher, year and lesson pages`.

### Task 10: My children desktop columns

**Files:** Modify `src/app/my-children/page.tsx`.

- [ ] **Step 1:** Wrap the child sections in `lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:items-start`, add a final dashed card (`hidden lg:flex`) "+ أضف أستاذاً من البحث" linking `/t/search`.
- [ ] **Step 2: Verify:** `npm test` passes; 375px matches baseline; 1440px shows 3 columns.
- [ ] **Step 3: Commit** — `feat(parents): side-by-side children on desktop`.

### Task 11: Final check

- [ ] **Step 1:** `npx tsc --noEmit -p .`, `npm test`, `npx next build` → all pass.
- [ ] **Step 2:** Re-run the SQL test and the three regression scripts → all pass.
- [ ] **Step 3:** Update `ROADMAP_MASTER_PLATFORM.md` phase 5 row and `PROJECT_REVIEW.md` §8 with the new admin tools; commit `docs: desktop layout and central dashboard`.
