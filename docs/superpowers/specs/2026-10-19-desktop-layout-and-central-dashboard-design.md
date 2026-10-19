# Desktop layout and central dashboard — design

Date: 2026-10-19 · Branch: `feat/wilaya-multitenant-platform`

## Why

The platform was built phone-first. On a computer most pages sit in a 576px column (`AppShell` wraps them in `max-w-xl`) with ~60% of the screen empty, and `/super-admin` and the teacher workspace `/admin` have no desktop layout at all. Admins, inspectors and teachers preparing lessons work on computers, so those screens should use the width. Parents mostly use phones, but should still get a proper page on a laptop.

At the same time the central (super-admin) dashboard is missing tools the wilaya needs: a circular to every district, a record of what admins did, moderation, and stats that don't download every teacher's data into the browser.

## Goals

1. On screens **≥ 1024px** (Tailwind `lg:`), give these pages a desktop layout in the style the user chose (**option B: top bar + horizontal tabs**, like today's `/inspector`):
   - `/super-admin` (central dashboard)
   - `/admin` (teacher workspace)
   - `/t/[slug]` (teacher page as parents see it), `/year/[level]` and `/lesson/[id]`
   - `/my-children`
2. Add to the central dashboard: an **overview** tab, a **wilaya-wide circular**, **content moderation**, an **action log**, and **stats computed in the database**.

## Non-goals

- Other pages keep the phone column on desktop for now: `/pedagogy`, `/settings`, `/eval`, `/assessment`, `/honor`, `/parents`, `/announcement`, `/penalties`, `/messages`, `/forum`, home, `/login`, `/register`. (Login/register stay a centred card by design.)
- No splitting of the 6,163-line `src/app/admin/page.tsx` into files beyond what the layout needs.
- No parent accounts, no grades for parents, no new roles.
- No dark mode.

## Anti-goals (a failure even if it "works")

- **Any visible change on phones** except the one listed below. Below 1024px every page must look and behave exactly as today.
- Admin seeing or editing teachers' private data (evaluations, penalties, roster, anonymous messages) through the new tools.
- Admin actions that leave no trace in the log.

## Constraints

- Next.js 16.3.8 App Router, Tailwind v4, Supabase with RLS. Read `node_modules/next/dist/docs/` before touching Next APIs (per AGENTS.md).
- Arabic, `dir="rtl"`. In the side-by-side layouts the "first" column sits on the right.
- Mobile preservation rule: desktop styling is added **only with `lg:` prefixed classes** (or wrappers whose non-`lg` classes are neutral). DOM order of existing content is not changed, so phone order stays the same.
- Database changes ship as a new idempotent migration `supabase/migrations/20261019000001_central_dashboard.sql`, applied after 0001–0011. Live Supabase is not touched; the user applies it.
- No new npm dependencies.

## Design decided with the user (mockups approved 2026-10-19)

### Shared shell
- `AppShell` gets a list of **desktop-wide** routes (`/admin`, `/year`, `/lesson`, `/my-children`) whose wrapper becomes `max-w-xl lg:max-w-6xl`. All other phone-column routes are unchanged. Full-width routes (`/super-admin`, `/t/`) are unchanged in `AppShell` and widen inside the page.
- Top bar pattern (desktop): a 64px gradient bar with identity on the right and action links on the left; below it a white tab strip with an underline on the active tab (copy the look of `/inspector`'s header and tabs).

### 1. Central dashboard `/super-admin`
Tabs: **نظرة عامة** (overview, default) · **الحسابات** · **المفتشون والمقاطعات** · **المتوسطات** · **منشور ولائي** (new) · **مراقبة المحتوى** (new) · **سجل العمليات** (new).

- **Overview:** 5 KPI cards (teachers, active this week, published lessons, notes waiting for inspectors, suspended accounts); a table of the 5 districts (inspector name or "بدون مفتش", teachers, active, notes reviewed/submitted bar, circulars); side column with *new registrations this week* and the *latest 5 log entries*.
- **Accounts:** today's search, filters and user list. On desktop the list becomes a table (name, code, role, district, school, status, actions). Existing actions unchanged.
- **Inspectors & districts:** `CreateInspectorForm` plus inspectors grouped by district.
- **Schools:** existing `SchoolsManager`.
- **Phone:** today's coloured header and stacked cards stay. The tab strip becomes 7 tabs, so on phones it scrolls horizontally (`overflow-x-auto`) instead of today's 3-column grid. **This is the one allowed phone change.** The current "stats" tab content moves into Overview.

### 2. Teacher workspace `/admin`
- Desktop top bar: teacher name, code, school; buttons: preview my page, pedagogical file (with unread count, existing `PedagogyAlerts` logic), forum, settings. Today's quick-link cards are hidden on `lg` (their links move into the bar).
- The 7 existing tabs in one row.
- In each tab that is "form then list" (lessons, announcements, summons, honors, penalties): two columns on desktop — form column ~40% `lg:sticky lg:top-4`, list ~60%. The lessons list shows 2 cards per row.
- Evaluation tab: student cards in a 3-column (`xl`: 4) grid.

### 3. Teacher page for parents `/t/[slug]`, `/year/[level]`, `/lesson/[id]`
- `/t/[slug]` desktop: top bar with teacher name, school, district, "save to my children" and "message the teacher"; tab strip with the teacher's levels and links to honors / summons / announcements; main area with notebook-type chips and lesson cards **3 per row**; side column (~240px) with active announcements, reception card, QR.
- `/year/[level]`: lesson cards 3 per row on desktop.
- `/lesson/[id]`: images in a wide grid with the existing viewer; homework and solution in a side column.

### 4. `/my-children`
- Desktop: one column per child side by side (`lg:grid-cols-2 xl:grid-cols-3`), plus a dashed "add a teacher" card linking to `/t/search`. Phone: stacked as today.

## New central-dashboard features (data)

All in migration `20261019000001_central_dashboard.sql`.

1. **Wilaya-wide circular**
   - `ALTER TABLE inspector_circulars ALTER COLUMN district_id DROP NOT NULL`; `district_id IS NULL` means "all districts".
   - Only admins may insert/update/delete rows with `district_id IS NULL` (the existing `circulars_inspector_all` already allows admins everything; inspectors stay limited to their district).
   - Teacher read policy becomes `(district_id IS NULL OR district_id = my_district())` with the existing target filters. Inspectors may also read rows with `district_id IS NULL`.
   - Read receipts work unchanged (`circular_reads`). The teacher inbox and `PedagogyAlerts` already rely on RLS only, so wilaya circulars appear there without code changes; show a "منشور ولائي" badge when `district_id` is null.
   - Attachments go in `private-inspector-docs` under the folder `wilaya/…`. Admins can already upload and delete there; the read policy gains `OR (storage.foldername(name))[1] = 'wilaya'` for authenticated teachers and inspectors.
   - UI: the tab reuses the inspector's `CircularsTab` form/list pattern (title, content, importance, optional attachment, event date) with read counts per district.
2. **Action log** — table `admin_audit_log (id, actor_id, action, target_type, target_id, details jsonb, created_at)`.
   - Admin-only `SELECT`; no client `INSERT`/`UPDATE`/`DELETE`.
   - Filled by `SECURITY DEFINER` triggers with `actor_id = auth.uid()`: profile role / district / `is_verified` changes made by someone other than the profile owner; `middle_schools` insert/update/delete; circular insert/delete by an admin.
   - The two service-role API routes (`POST`/`DELETE /api/admin/users`) insert their own row through the admin client with the calling admin as actor, because `auth.uid()` is empty under the service role.
   - UI: newest first, filter by action type, 50 per page.
3. **Moderation**
   - Lists the latest forum topics and replies across the wilaya, with delete. Existing policies already let admins delete both (`forum_topics_delete`, `forum_replies_delete`); admins already pass `is_forum_member()` for reading.
   - Lists the latest **public** announcements from all teachers (read-only, via a new admin function below), each with "open teacher page" and the existing suspend action. Admin never edits a teacher's JSON data (avoids clobbering teacher saves).
4. **Stats in the database** — `admin_wilaya_stats()` `SECURITY DEFINER`, returns one row per district (teachers, inspectors, inspector name, active teachers in last 7 days by workspace `updated_at`, lessons count via `jsonb_array_length`, notes submitted / reviewed, circulars) plus totals; raises unless `is_admin()`. Replaces the browser-side loop in `WilayaStats.tsx`. A sibling `admin_recent_announcements(limit)` returns the moderation feed (teacher id, name, title, content, category, created_at) from `teacher_public_data`, admin only.

## Verification expected

- `npm test` stays green; new pure helpers get a small test.
- The migration is applied twice on a fresh local stack (idempotent) and checked with SQL/REST: teacher sees a wilaya circular; inspector can't create one; teacher can't read the log or call the admin functions; role change and school delete each write one log row.
- Every redesigned page: screenshot at 375px before and after (must match), and at 1440px (matches the mockup).
- `next build` passes.

## Calls I made (not discussed — please check)

- "Active" teacher = the later `updated_at` of their public or private workspace row falls in the last 7 days.
- Breakpoint is `lg` = 1024px; landscape tablets get the desktop layout.
- The mockup's "waiting for verification" panel became **new registrations this week**, because `is_verified = false` means *suspended* in this app, not *pending*.
- The old "stats" tab is folded into Overview.
- Moderation of teachers' announcements is read-only plus suspend, not edit/delete.
- Pages not listed in Goals keep the phone column on desktop for this round.

## Left to the builder

Exact spacing, colours within the existing palette, icons (lucide-react), empty states, and loading states — follow the mockups and the `/inspector` page.
