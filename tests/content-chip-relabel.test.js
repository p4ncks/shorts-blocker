// Regression test: YouTube reuses filter chips and edits their label text in place.
// The real src/content.js runs here against a tiny fake page (no browser, no dependencies),
// and the fake MutationObserver only reports a text edit if it was asked to watch text,
// just like the real one.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ShortsUrl = require("../src/shorts-url.js");
const CONTENT_SCRIPT = fs.readFileSync(path.join(__dirname, "..", "src", "content.js"), "utf8");
const MARKER = "data-shorts-blocked";

// ---- A tiny fake page: only what content.js uses ----

class FakeText {
  constructor(text) {
    this.nodeType = 3;
    this.data = text;
    this.parentElement = null;
  }
  get textContent() {
    return this.data;
  }
  get isConnected() {
    return Boolean(this.parentElement && this.parentElement.isConnected);
  }
}

class FakeClassList {
  constructor() {
    this.names = new Set();
  }
  add(name) {
    this.names.add(name);
  }
  remove(name) {
    this.names.delete(name);
  }
  contains(name) {
    return this.names.has(name);
  }
}

class FakeElement {
  constructor(tag, page) {
    this.nodeType = 1;
    this.localName = tag;
    this.page = page;
    this.parentElement = null;
    this.childNodes = [];
    this.attributes = new Map();
    this.classList = new FakeClassList();
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this;
      this.childNodes.push(node);
    }
    return this;
  }
  get textContent() {
    return this.childNodes.map((node) => node.textContent).join("");
  }
  get isConnected() {
    let node = this;
    while (node.parentElement) node = node.parentElement;
    return node === this.page.documentElement;
  }
  hasAttribute(name) {
    return this.attributes.has(name);
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  toggleAttribute(name, force) {
    if (force) this.attributes.set(name, "");
    else this.attributes.delete(name);
  }
  descendants() {
    const elements = this.childNodes.filter((node) => node instanceof FakeElement);
    return elements.flatMap((element) => [element, ...element.descendants()]);
  }
  // Understands the selectors content.js uses: "tag", "[attr]", 'tag[attr*="text"]', joined by commas.
  querySelectorAll(selectorList) {
    const selectors = selectorList.split(",").map(parseSelector);
    return this.descendants().filter((element) => selectors.some((matches) => matches(element)));
  }
}

function parseSelector(selector) {
  const [, tag, attribute, contains] = selector.trim().match(/^([\w-]*)(?:\[([\w-]+)(?:\*="([^"]*)")?\])?$/);
  return (element) =>
    (!tag || element.localName === tag) &&
    (!attribute || element.hasAttribute(attribute)) &&
    (contains === undefined || String(element.getAttribute(attribute)).includes(contains));
}

function makePage() {
  const page = { observers: new Set(), timers: [], storageListeners: [] };
  const html = new FakeElement("html", page);
  page.documentElement = html;

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe(target, options) {
      this.options = options;
      page.observers.add(this);
    }
    disconnect() {
      page.observers.delete(this);
    }
  }

  page.globals = {
    ShortsUrl,
    Node: { ELEMENT_NODE: 1 },
    MutationObserver: FakeMutationObserver,
    document: {
      documentElement: html,
      querySelectorAll: (selector) => html.querySelectorAll(selector),
    },
    location: { href: "https://www.youtube.com/results?search_query=nature", replace() {} },
    window: { addEventListener() {} },
    setTimeout: (callback) => page.timers.push(callback),
    clearTimeout: () => (page.timers = []),
    chrome: {
      runtime: { getURL: (file) => "chrome-extension://test/" + file },
      storage: {
        sync: { get: async () => ({ settings: { enabled: true, mode: "redirect" } }) },
        onChanged: { addListener: (listener) => page.storageListeners.push(listener) },
      },
    },
  };
  return page;
}

// Edit a label in place, the way YouTube does, and tell the observers that watch text.
function relabel(page, textNode, newLabel) {
  textNode.data = newLabel;
  for (const observer of page.observers) {
    if (observer.options.subtree && observer.options.characterData) {
      observer.callback([{ type: "characterData", target: textNode, addedNodes: [] }]);
    }
  }
}

function runTimers(page) {
  const timers = page.timers;
  page.timers = [];
  timers.forEach((callback) => callback());
}

function turnOff(page) {
  const change = { settings: { newValue: { enabled: false, mode: "redirect" } } };
  page.storageListeners.forEach((listener) => listener(change, "sync"));
}

// Search page with two chips: html > body > chip bar > chip > chip-shape > label text.
function addChip(page, chipBar, label) {
  const text = new FakeText(label);
  const chip = new FakeElement("yt-chip-cloud-chip-renderer", page);
  chip.append(new FakeElement("chip-shape", page).append(new FakeElement("div", page).append(text)));
  chipBar.append(chip);
  return { chip, text };
}

async function startContentScript() {
  const page = makePage();
  const chipBar = new FakeElement("iron-selector", page);
  page.documentElement.append(new FakeElement("body", page).append(chipBar));
  const shortsChip = addChip(page, chipBar, "Shorts");
  const videosChip = addChip(page, chipBar, "Videos");

  vm.runInNewContext(CONTENT_SCRIPT, page.globals);
  await new Promise((resolve) => setImmediate(resolve)); // let the settings be read
  return { page, shortsChip, videosChip };
}

// ---- Tests ----

test("on start, only the chip labeled Shorts is hidden", async () => {
  const { shortsChip, videosChip } = await startContentScript();
  assert.equal(shortsChip.chip.hasAttribute(MARKER), true);
  assert.equal(videosChip.chip.hasAttribute(MARKER), false);
});

test("a reused chip relabeled in place is rechecked, in both directions", async () => {
  const { page, shortsChip, videosChip } = await startContentScript();

  relabel(page, shortsChip.text, "Videos");
  relabel(page, videosChip.text, "Shorts");
  runTimers(page);

  assert.equal(shortsChip.chip.hasAttribute(MARKER), false, "Shorts became Videos: must show again");
  assert.equal(videosChip.chip.hasAttribute(MARKER), true, "Videos became Shorts: must be hidden");
});

test("turning the extension off shows every chip and stops watching", async () => {
  const { page, shortsChip, videosChip } = await startContentScript();

  turnOff(page);
  assert.equal(shortsChip.chip.hasAttribute(MARKER), false);
  assert.equal(page.documentElement.classList.contains("shorts-blocker-on"), false);
  assert.equal(page.observers.size, 0);

  relabel(page, videosChip.text, "Shorts");
  runTimers(page);
  assert.equal(videosChip.chip.hasAttribute(MARKER), false);
});
