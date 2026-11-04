const test = require("node:test");
const assert = require("node:assert/strict");

const { isShortsUrl, shortsVideoId, toWatchUrl } = require("../src/shorts-url.js");

test("finds the video id on www and m hosts", () => {
  assert.equal(shortsVideoId("https://www.youtube.com/shorts/abc123XYZ_-"), "abc123XYZ_-");
  assert.equal(shortsVideoId("https://m.youtube.com/shorts/a-b_c"), "a-b_c");
});

test("accepts a trailing slash, query strings and fragments", () => {
  assert.equal(shortsVideoId("https://www.youtube.com/shorts/abc123/"), "abc123");
  assert.equal(shortsVideoId("https://www.youtube.com/shorts/abc123?feature=share"), "abc123");
  assert.equal(shortsVideoId("https://www.youtube.com/shorts/abc123/?si=xyz&pp=1"), "abc123");
  assert.equal(shortsVideoId("https://m.youtube.com/shorts/abc123#comments"), "abc123");
});

test("reads relative links as www.youtube.com links", () => {
  assert.equal(shortsVideoId("/shorts/abc123"), "abc123");
  assert.equal(toWatchUrl("/shorts/abc123?feature=share"), "https://www.youtube.com/watch?v=abc123");
});

test("ignores URLs that are not a single Shorts video", () => {
  const notShorts = [
    "https://www.youtube.com/watch?v=abc123",
    "https://www.youtube.com/shorts",
    "https://www.youtube.com/shorts/",
    "https://www.youtube.com/shorts/abc123/extra",
    "https://www.youtube.com/@channel/shorts",
    "https://www.youtube.com/results?search_query=/shorts/abc123",
    "https://www.youtube.com.evil.example/shorts/abc123",
    "https://evil.example/shorts/abc123",
    "https://music.youtube.com/shorts/abc123",
    "not a url at all ::",
    "",
  ];
  for (const url of notShorts) {
    assert.equal(isShortsUrl(url), false, url);
    assert.equal(shortsVideoId(url), null, url);
    assert.equal(toWatchUrl(url), null, url);
  }
});

test("isShortsUrl is true for Shorts videos", () => {
  assert.equal(isShortsUrl("https://www.youtube.com/shorts/abc123"), true);
  assert.equal(isShortsUrl("http://m.youtube.com/shorts/abc123/"), true);
});

test("toWatchUrl keeps the host and drops the Shorts-only parameters", () => {
  assert.equal(
    toWatchUrl("https://www.youtube.com/shorts/abc-123?feature=share&si=xyz"),
    "https://www.youtube.com/watch?v=abc-123",
  );
  assert.equal(toWatchUrl("https://m.youtube.com/shorts/a_b/"), "https://m.youtube.com/watch?v=a_b");
});

test("is also exposed on globalThis for the content script", () => {
  assert.equal(typeof globalThis.ShortsUrl.toWatchUrl, "function");
});
