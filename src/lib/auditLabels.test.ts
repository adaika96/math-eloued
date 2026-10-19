import { test } from "node:test";
import assert from "node:assert/strict";
import { auditLabel, AUDIT_ACTIONS } from "./auditLabels";

test("auditLabel: role change names both roles", () => {
  assert.equal(auditLabel({ action: "role_changed", details: { from: "teacher", to: "inspector" } }), "تغيير الدور: أستاذ ← مفتش");
});

test("auditLabel: simple actions and ones naming their target", () => {
  assert.equal(auditLabel({ action: "account_suspended", details: {} }), "تعليق حساب");
  assert.equal(auditLabel({ action: "school_deleted", details: { name: "متوسطة X" } }), "حذف متوسطة: متوسطة X");
  assert.equal(auditLabel({ action: "district_changed", details: { from: 1, to: 4 } }), "نقل إلى المقاطعة 4");
  assert.equal(auditLabel({ action: "wilaya_circular_published", details: { title: "ندوة" } }), "نشر منشور ولائي: ندوة");
  assert.equal(auditLabel({ action: "forum_topic_deleted", details: { title: "سؤال" } }), "حذف موضوع من الملتقى: سؤال");
  assert.equal(auditLabel({ action: "forum_reply_deleted", details: {} }), "حذف رد من الملتقى");
});

test("auditLabel: unknown action falls back to its key, missing details do not throw", () => {
  assert.equal(auditLabel({ action: "foo", details: {} }), "foo");
  assert.equal(auditLabel({ action: "school_added", details: null as unknown as Record<string, unknown> }), "إضافة متوسطة");
});

test("AUDIT_ACTIONS covers every action the database and API write", () => {
  for (const a of [
    "role_changed", "district_changed", "account_suspended", "account_reactivated", "school_added", "school_updated",
    "school_deleted", "wilaya_circular_published", "wilaya_circular_deleted", "inspector_created", "user_deleted",
    "forum_topic_deleted", "forum_reply_deleted",
  ]) {
    assert.ok(AUDIT_ACTIONS.includes(a), a);
  }
});
