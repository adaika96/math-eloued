import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeStats, type DistrictStats } from "./adminStats";

const row = (district_id: number, over: Partial<DistrictStats> = {}): DistrictStats => ({
  district_id, district_name: `d${district_id}`, inspector_name: null, teachers: 0, inspectors: 0, active_teachers: 0,
  lessons: 0, notes_submitted: 0, notes_reviewed: 0, circulars: 0, suspended: 0, new_this_week: 0, ...over,
});

test("summarizeStats: sums districts; waiting notes = submitted − reviewed", () => {
  const s = summarizeStats([
    row(1, { teachers: 10, active_teachers: 6, lessons: 40, notes_submitted: 9, notes_reviewed: 4, suspended: 1, new_this_week: 2 }),
    row(2, { teachers: 5, active_teachers: 1, lessons: 3, notes_submitted: 2, notes_reviewed: 2 }),
  ]);
  assert.deepEqual(s, { teachers: 15, activeTeachers: 7, lessons: 43, notesWaiting: 5, suspended: 1, newThisWeek: 2 });
});

test("summarizeStats: empty input gives zeros", () => {
  assert.deepEqual(summarizeStats([]), { teachers: 0, activeTeachers: 0, lessons: 0, notesWaiting: 0, suspended: 0, newThisWeek: 0 });
});
