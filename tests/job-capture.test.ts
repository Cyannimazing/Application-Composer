import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCapture } from "../src/lib/contracts";
import * as platforms from "../src/lib/platforms";

const listing = () => ({ id: "listing-1758461", url: "https://www.onlinejobs.ph/jobseekers/job/website-designer-builder-1758461", title: "Website Designer & Developer", context: "Build a website using Next.js and Supabase. Include SUNSHINE and explain a relevant CMS project.", fields: [], capturedAt: new Date().toISOString(), tabId: 4, jobListing: true });

test("job-only captures retain their explicit source type during validation", () => {
  assert.equal(validateCapture(listing()).jobListing, true);
});

test("job details become copyable platform templates without pretending they are live form fields", () => {
  assert.equal(typeof platforms.prepareBrowserCapture, "function");
  const result = platforms.prepareBrowserCapture(validateCapture(listing()), []);
  assert.equal(result.manual, true);
  assert.equal(result.jobListing, true);
  assert.equal(result.platform, "onlinejobs");
  assert.equal(result.url, listing().url);
  assert.equal(result.context, listing().context);
  assert.ok(result.fields.some(field => field.label === "Application message"));
  assert.equal(result.fields.some(field => /CMS project/.test(field.label)), false);
});

test("a captured application keeps the matching job description and its real questions", () => {
  const source = platforms.prepareBrowserCapture(validateCapture(listing()), []);
  const form = validateCapture({ ...listing(), id: "actual-form", jobListing: false, url: "https://www.onlinejobs.ph/jobseekers/apply/1758461", title: "Apply", context: "Why are you a good fit?", fields: [{ id: "message", label: "Message", type: "textarea", value: "", required: true, maxLength: 4000, options: [] }] });
  const result = platforms.prepareBrowserCapture(form, [source]);
  assert.match(result.context, /Include SUNSHINE/);
  assert.match(result.context, /Why are you a good fit/);
  assert.equal(result.manual, false);
  assert.equal(result.fields[0].id, "message");
  assert.equal(result.url, form.url);
  const unrelated = platforms.prepareBrowserCapture({ ...form, url: "https://www.onlinejobs.ph/jobseekers/apply/9999" }, [source]);
  assert.doesNotMatch(unrelated.context, /SUNSHINE/);
});

test("Upwork and other sites can capture job details without application inputs", () => {
  for (const [url, platform] of [["https://www.upwork.com/jobs/Website-Developer_~0123456789", "upwork"], ["https://careers.example.com/jobs/frontend", "other"]] as const) {
    const source = platforms.prepareBrowserCapture(validateCapture({ ...listing(), url }), []);
    assert.equal(source.platform, platform);
    assert.ok(source.fields.length > 0);
    assert.equal(source.manual, true);
  }
  const upwork = platforms.prepareBrowserCapture(validateCapture({ ...listing(), url: "https://www.upwork.com/jobs/Website-Developer_~0123456789" }), []);
  const chosen = platforms.prepareBrowserCapture(validateCapture({ ...listing(), url: "https://careers.example.com/jobs/frontend", platform: "upwork" }), []);
  assert.equal(chosen.platform, "upwork", "Respect the user's platform selector on other websites");
  assert.ok(chosen.fields.some(field => field.label === "Cover letter"));
  const form = validateCapture({ ...listing(), jobListing: false, url: "https://www.upwork.com/nx/proposals/job/~0123456789/apply/", context: "Write a cover letter", fields: [{ id: "cover", label: "Cover letter", type: "textarea", value: "", maxLength: 4000, options: [] }] });
  assert.match(platforms.prepareBrowserCapture(form, [upwork]).context, /SUNSHINE/);
});
