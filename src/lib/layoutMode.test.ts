import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutFor } from "./layoutMode";

test("layoutFor: full-width platform pages", () => {
  for (const p of ["/", "/super-admin", "/inspector", "/t/khaled", "/t/schools", "/forum", "/forum/x", "/login", "/register"]) {
    assert.equal(layoutFor(p), "full", p);
  }
});

test("layoutFor: desktop-wide teacher and parent pages", () => {
  for (const p of ["/admin", "/year/1", "/lesson/abc", "/my-children"]) {
    assert.equal(layoutFor(p), "wide", p);
  }
});

test("layoutFor: everything else keeps the phone column, prefixes match whole segments", () => {
  for (const p of ["/administrator", "/honor", "/pedagogy", "/settings", "/eval", "/forumx", "/teacher"]) {
    assert.equal(layoutFor(p), "phone", p);
  }
});
