const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "src", "hide-shorts.css"), "utf8");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const selectors = withoutComments
  .split("{")
  .slice(0, -1)
  .map((block) => block.split("}").pop())
  .flatMap((list) => list.split(","))
  .map((selector) => selector.trim());

test("every rule only applies while the extension is on", () => {
  assert.ok(selectors.length > 10);
  for (const selector of selectors) {
    assert.match(selector, /^html\.shorts-blocker-on /, selector);
  }
});

// These hold normal videos too: hiding one because it contains a Short hid the whole search page.
test("never hides a whole section, list or tab page", () => {
  const tooBig = /\b(ytd|ytm)-(item-section|section-list|tab|rich-grid|channel-sub-menu)-renderer\b/;
  for (const selector of selectors) {
    const hidden = selector.split(":has(")[0];
    assert.doesNotMatch(hidden, tooBig, selector);
  }
});
