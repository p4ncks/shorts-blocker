const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
const YOUTUBE = ["*://www.youtube.com/*", "*://m.youtube.com/*"];

test("is a Manifest V3 extension named Shorts Blocker", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "Shorts Blocker");
  assert.deepEqual(manifest.permissions, ["storage", "declarativeNetRequest"]);
  assert.deepEqual(manifest.host_permissions, YOUTUBE);
});

test("loads the worker, content scripts and pages from the paths in the spec", () => {
  const [content] = manifest.content_scripts;
  assert.equal(manifest.background.service_worker, "src/background.js");
  assert.deepEqual(content.matches, YOUTUBE);
  assert.deepEqual(content.js, ["src/shorts-url.js", "src/content.js"]);
  assert.deepEqual(content.css, ["src/hide-shorts.css"]);
  assert.equal(content.run_at, "document_start");
  assert.equal(manifest.action.default_popup, "popup/popup.html");
  assert.deepEqual(manifest.web_accessible_resources, [{ resources: ["src/blocked.html"], matches: YOUTUBE }]);
});

test("uses the four icon sizes", () => {
  for (const size of ["16", "32", "48", "128"]) {
    assert.equal(manifest.icons[size], `icons/icon-${size}.png`);
  }
});
