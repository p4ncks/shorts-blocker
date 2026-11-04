const test = require("node:test");
const assert = require("node:assert/strict");

const { CARD_TAGS, normalizeSettings, isShortsHref, cardsAround, replacementUrl } = require("../src/content.js");

// A fake element chain, nearest first, as YouTube renders it: cardsAround only reads
// localName and parentElement.
function chain(...tags) {
  let parent = null;
  const elements = tags.reverse().map((tag) => (parent = { localName: tag, parentElement: parent }));
  return elements.reverse();
}

// Ancestor chains of real Shorts links, recorded on YouTube on 2026-11-04 (nearest first).
const DESKTOP_SEARCH_SHORT = chain(
  "a", "ytm-shorts-lockup-view-model", "ytm-shorts-lockup-view-model-v2", "grid-shelf-view-model",
  "ytd-item-section-renderer", "ytd-section-list-renderer", "ytd-two-column-search-results-renderer", "ytd-search",
);
const MOBILE_SEARCH_SHORT = chain(
  "a", "ytm-shorts-lockup-view-model", "grid-shelf-view-model", "lazy-list",
  "ytm-item-section-renderer", "lazy-list", "ytm-section-list-renderer", "ytm-search",
);
const MINI_SIDEBAR_SHORTS = chain("a", "ytd-mini-guide-entry-renderer", "ytd-mini-guide-renderer", "ytd-app");

const tagsOf = (elements) => elements.map((element) => element.localName);

test("a Shorts link in search maps to its own cards, never to the results section", () => {
  const [link] = DESKTOP_SEARCH_SHORT;
  assert.deepEqual(tagsOf(cardsAround(link)), ["ytm-shorts-lockup-view-model", "ytm-shorts-lockup-view-model-v2"]);

  const [mobileLink] = MOBILE_SEARCH_SHORT;
  assert.deepEqual(tagsOf(cardsAround(mobileLink)), ["ytm-shorts-lockup-view-model"]);
});

test("the Shorts entry in the mini sidebar maps to that one entry", () => {
  assert.deepEqual(tagsOf(cardsAround(MINI_SIDEBAR_SHORTS[0])), ["ytd-mini-guide-entry-renderer"]);
});

test("an element that is a card counts itself", () => {
  const [card] = chain("ytd-rich-item-renderer", "ytd-rich-grid-renderer");
  assert.deepEqual(tagsOf(cardsAround(card)), ["ytd-rich-item-renderer"]);
});

test("a link outside any card maps to nothing", () => {
  assert.deepEqual(cardsAround(chain("a", "div", "ytd-item-section-renderer")[0]), []);
});

test("no section, list, shelf or page wrapper is ever a card", () => {
  const tooBig = [
    "ytd-item-section-renderer", "ytm-item-section-renderer", "ytd-section-list-renderer",
    "ytm-section-list-renderer", "ytd-rich-section-renderer", "ytd-rich-grid-renderer",
    "ytd-tab-renderer", "ytm-tab-renderer", "ytd-browse", "ytd-search", "ytm-search",
    "grid-shelf-view-model", "lazy-list", "ytd-guide-section-renderer", "ytd-mini-guide-renderer",
  ];
  for (const tag of tooBig) {
    assert.equal(CARD_TAGS.has(tag), false, tag);
  }
});

test("recognizes Shorts links, relative or absolute", () => {
  for (const href of ["/shorts/abc-1_2", "/shorts/", "/shorts", "/shorts/abc?feature=share",
    "https://www.youtube.com/shorts/abc", "https://m.youtube.com/shorts/abc"]) {
    assert.equal(isShortsHref(href), true, href);
  }
});

test("ignores links that only mention shorts", () => {
  for (const href of ["/watch?v=abc", "/@channel/shorts", "/results?search_query=/shorts/abc",
    "/shortsfan", "https://evil.example/shorts/abc", "", null]) {
    assert.equal(isShortsHref(href), false, String(href));
  }
});

const SHORT = "https://www.youtube.com/shorts/abc123?feature=share";
const BLOCKED = "chrome-extension://id/src/blocked.html";

test("does nothing before the settings are read", () => {
  assert.equal(replacementUrl(SHORT, null, BLOCKED), null);
});

test("does nothing when the extension is off", () => {
  assert.equal(replacementUrl(SHORT, { enabled: false, mode: "redirect" }, BLOCKED), null);
  assert.equal(replacementUrl(SHORT, { enabled: false, mode: "block" }, BLOCKED), null);
});

test("redirect mode opens the Short in the normal player, block mode shows the blocked page", () => {
  assert.equal(replacementUrl(SHORT, { enabled: true, mode: "redirect" }, BLOCKED), "https://www.youtube.com/watch?v=abc123");
  assert.equal(replacementUrl(SHORT, { enabled: true, mode: "block" }, BLOCKED), BLOCKED);
});

test("stays on pages that are not a single Short", () => {
  const on = { enabled: true, mode: "block" };
  assert.equal(replacementUrl("https://www.youtube.com/watch?v=abc123", on, BLOCKED), null);
  assert.equal(replacementUrl("https://www.youtube.com/results?search_query=cats", on, BLOCKED), null);
});

test("missing or broken settings fall back to the defaults", () => {
  assert.deepEqual(normalizeSettings(undefined), { enabled: true, mode: "redirect" });
  assert.deepEqual(normalizeSettings({ enabled: false }), { enabled: false, mode: "redirect" });
  assert.deepEqual(normalizeSettings({ enabled: 1, mode: "nope" }), { enabled: true, mode: "redirect" });
});
