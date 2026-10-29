import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const helper = await readFile("extension/form-tools.js", "utf8");
const title = "Part-Time Digital Project Manager - Website Redesign & API Integrations";
const description = "Approximately 5 paid hours per week. Please include how you structure the engagement and handle a missed deadline. State your hourly rate, timezone and availability.";
async function snapshot(html) {
  const page = await browser.newPage();
  await page.setContent(html);
  await page.addScriptTag({ content: helper });
  const capture = await page.evaluate(() => window.ApplicationComposer.capture("upwork-view"));
  await page.close();
  return capture;
}
try {
  const proposal = await snapshot('<title>Submit a proposal - Upwork</title><main><h1>Submit a proposal</h1><section><h2>Proposal settings</h2><p>PRIVATE-PROPOSAL-CONNECTS</p></section><section><h2>Job details</h2><h3>' + title + '</h3><div data-test="Description">' + description + '</div><aside>$20.00 - $35.00 Hourly</aside></section><section><h2>Terms</h2><label for="cover">Cover letter</label><textarea id="cover">PRIVATE-EXISTING-DRAFT</textarea></section></main>');
  assert.equal(proposal.title, title, "Use the actual job title instead of Submit a proposal");
  assert.match(proposal.context, /5 paid hours/);
  assert.match(proposal.context, /20\.00 - \$35\.00/);
  assert.doesNotMatch(proposal.context, /PRIVATE-PROPOSAL|PRIVATE-EXISTING/);
  assert.equal(proposal.fields.length, 1);
  for (const hidden of [true, false]) {
    const slider = await snapshot('<title>Search Freelance Jobs</title><main ' + (hidden ? 'aria-hidden="true"' : '') + '><h1>Search jobs</h1><div data-test="description">WRONG-SEARCH-RESULT</div></main><aside role="dialog" aria-modal="true"><h2>' + title + '</h2><div data-test="Description">' + description + '</div></aside>');
    assert.equal(slider.title, title);
    assert.match(slider.context, /missed deadline/);
    assert.doesNotMatch(slider.context, /WRONG-SEARCH-RESULT/);
  }
  const contents = await snapshot('<main hidden>HIDDEN-RESULTS</main><div role="dialog" style="display:contents"><h2>' + title + '</h2><div data-test="Description" style="display:contents">' + description + '</div></div>');
  assert.match(contents.context, /5 paid hours/);
  assert.doesNotMatch(contents.context, /HIDDEN-RESULTS/);
  const linked = await snapshot('<main><h1>Submit a proposal</h1><section><h2>Job details</h2><a href="https://www.upwork.com/jobs/~012345">' + title + '</a><p>' + description + '</p></section></main>');
  assert.equal(linked.title, title);
  for (const panel of [
    '<aside role="dialog"><h2>' + title + '</h2><section><h3>Job details</h3><p>' + description + '</p></section></aside>',
    '<aside class="air3-slider"><header><h2>' + title + '</h2></header><div class="air3-slider-content"><section><h3>Job details</h3><p>' + description + '</p></section></div></aside>'
  ]) {
    const active = await snapshot('<main><a href="/jobs/wrong">Underlying unrelated job</a><p>WRONG-SEARCH-RESULT</p></main>' + panel);
    assert.equal(active.title, title);
    assert.doesNotMatch(active.context, /WRONG-SEARCH-RESULT/);
  }
  const cookies = await snapshot('<main><h1>' + title + '</h1><div data-test="description">' + description + '</div></main><aside role="dialog"><h2>Cookie preferences</h2><p>PRIVATE-COOKIE-PREFERENCES</p></aside>');
  assert.equal(cookies.title, title);
  assert.match(cookies.context, /missed deadline/);
  assert.doesNotMatch(cookies.context, /PRIVATE-COOKIE/);
  console.log("PASS: Upwork proposal/job-detail sections, uppercase description markers, active slide-outs, hidden search roots, display:contents, true job titles, and no existing answer leakage.");
} finally { await browser.close(); }
