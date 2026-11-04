const test = require("node:test");
const assert = require("node:assert/strict");

const { buildShortsRules, withDefaults, SHORTS_RULE_ID, SHORTS_URL_REGEX } = require("../src/rules.js");
const { toWatchUrl } = require("../src/shorts-url.js");

// What Chrome does with the redirect rule: match the regex, then fill in \1 and \2.
function applyRedirect(rule, url) {
  const match = url.match(new RegExp(rule.condition.regexFilter));
  if (!match) {
    return null;
  }
  return rule.action.redirect.regexSubstitution.replace(/\\(\d)/g, (_, group) => match[group]);
}

const redirectRule = buildShortsRules({ enabled: true, mode: "redirect" })[0];

test("redirect mode sends a Shorts page to the normal player on the same host", () => {
  const cases = {
    "https://www.youtube.com/shorts/abc123": "https://www.youtube.com/watch?v=abc123",
    "https://m.youtube.com/shorts/abc123": "https://m.youtube.com/watch?v=abc123",
    "https://www.youtube.com/shorts/a-b_C9": "https://www.youtube.com/watch?v=a-b_C9",
    "https://www.youtube.com/shorts/abc123/": "https://www.youtube.com/watch?v=abc123",
    "https://www.youtube.com/shorts/abc123?feature=share": "https://www.youtube.com/watch?v=abc123",
    "https://m.youtube.com/shorts/abc123/?si=xyz&pp=1": "https://m.youtube.com/watch?v=abc123",
    "http://www.youtube.com/shorts/abc123": "https://www.youtube.com/watch?v=abc123",
  };
  for (const [shortsUrl, watchUrl] of Object.entries(cases)) {
    assert.equal(applyRedirect(redirectRule, shortsUrl), watchUrl, shortsUrl);
  }
});

test("the redirect rule and toWatchUrl agree", () => {
  const urls = [
    "https://www.youtube.com/shorts/abc123?feature=share",
    "https://m.youtube.com/shorts/a-b_c/",
    "https://www.youtube.com/watch?v=abc123",
    "https://www.youtube.com/shorts/abc123/extra",
  ];
  for (const url of urls) {
    assert.equal(applyRedirect(redirectRule, url), toWatchUrl(url), url);
  }
});

test("the rule leaves other pages alone", () => {
  const notShorts = [
    "https://www.youtube.com/watch?v=abc123",
    "https://www.youtube.com/shorts",
    "https://www.youtube.com/shorts/",
    "https://www.youtube.com/shorts/abc123/extra",
    "https://www.youtube.com/@channel/shorts",
    "https://www.youtube.com.evil.example/shorts/abc123",
    "https://music.youtube.com/shorts/abc123",
  ];
  for (const url of notShorts) {
    assert.equal(applyRedirect(redirectRule, url), null, url);
  }
});

test("the rule applies only to full page loads", () => {
  assert.equal(redirectRule.id, SHORTS_RULE_ID);
  assert.equal(redirectRule.action.type, "redirect");
  assert.deepEqual(redirectRule.condition.resourceTypes, ["main_frame"]);
});

test("block mode redirects to the extension's blocked page", () => {
  const [rule] = buildShortsRules({ enabled: true, mode: "block" });
  assert.deepEqual(rule.action.redirect, { extensionPath: "/src/blocked.html" });
  assert.equal(rule.condition.regexFilter, SHORTS_URL_REGEX);
});

test("no rule when the extension is turned off", () => {
  assert.deepEqual(buildShortsRules({ enabled: false, mode: "redirect" }), []);
  assert.deepEqual(buildShortsRules({ enabled: false, mode: "block" }), []);
});

test("missing or broken settings fall back to the defaults", () => {
  assert.deepEqual(withDefaults(undefined), { enabled: true, mode: "redirect" });
  assert.deepEqual(withDefaults({ mode: "block" }), { enabled: true, mode: "block" });
  assert.deepEqual(withDefaults({ enabled: "no", mode: "explode" }), { enabled: true, mode: "redirect" });
  assert.equal(buildShortsRules(undefined).length, 1);
});
