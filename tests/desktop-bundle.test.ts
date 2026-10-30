import { test } from "node:test";
import assert from "node:assert/strict";
import { excludedBundlePath } from "../desktop/bundle-policy.mjs";

test("desktop packaging keeps framework output modules while excluding private project output", () => {
  assert.equal(excludedBundlePath("node_modules/next/dist/build/output/log.js"), false);
  assert.equal(excludedBundlePath("output/playwright/private.png"), true);
  assert.equal(excludedBundlePath(".local/profile.json"), true);
  assert.equal(excludedBundlePath(".env.local"), true);
  assert.equal(excludedBundlePath(".ENV.production"), true);
  assert.equal(excludedBundlePath(".git/config"), true);
  assert.equal(excludedBundlePath("node_modules/next/dist/server/next.js"), false);
});
