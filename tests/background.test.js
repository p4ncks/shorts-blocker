// Runs src/background.js against a small fake of the Chrome APIs it uses.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "src");

function fakeChrome(storedSettings) {
  const listeners = { installed: [], startup: [], changed: [] };
  const storage = storedSettings === undefined ? {} : { settings: storedSettings };
  const state = { rules: [] };

  const chrome = {
    runtime: {
      onInstalled: { addListener: (listener) => listeners.installed.push(listener) },
      onStartup: { addListener: (listener) => listeners.startup.push(listener) },
    },
    storage: {
      onChanged: { addListener: (listener) => listeners.changed.push(listener) },
      sync: {
        async get(key) {
          return key in storage ? { [key]: storage[key] } : {};
        },
        async set(values) {
          Object.assign(storage, values);
        },
      },
    },
    declarativeNetRequest: {
      async updateDynamicRules({ removeRuleIds, addRules }) {
        state.rules = state.rules.filter((rule) => !removeRuleIds.includes(rule.id)).concat(addRules);
      },
    },
  };

  // What Chrome does when the popup saves new settings.
  async function changeSettings(settings) {
    storage.settings = settings;
    for (const listener of listeners.changed) {
      listener({ settings: { newValue: settings } }, "sync");
    }
  }

  return { chrome, listeners, storage, state, changeSettings };
}

function startWorker(fake) {
  const context = {
    chrome: fake.chrome,
    console,
    importScripts: (file) => vm.runInContext(fs.readFileSync(path.join(SRC, file), "utf8"), context),
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(SRC, "background.js"), "utf8"), context);
  return context;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

test("first install saves the defaults and adds the redirect rule", async () => {
  const fake = fakeChrome(undefined);
  startWorker(fake);
  await fake.listeners.installed[0]();
  await settle();
  assert.deepEqual({ ...fake.storage.settings }, { enabled: true, mode: "redirect" });
  assert.equal(fake.state.rules.length, 1);
  assert.ok(fake.state.rules[0].action.redirect.regexSubstitution);
});

test("an update keeps the user's choices", async () => {
  const fake = fakeChrome({ enabled: false, mode: "block" });
  startWorker(fake);
  await fake.listeners.installed[0]();
  await settle();
  assert.deepEqual({ ...fake.storage.settings }, { enabled: false, mode: "block" });
  assert.deepEqual(fake.state.rules, []);
});

test("the rule follows each settings change, ending on the last one", async () => {
  const fake = fakeChrome({ enabled: true, mode: "redirect" });
  startWorker(fake);

  await fake.changeSettings({ enabled: true, mode: "block" });
  await settle();
  assert.deepEqual({ ...fake.state.rules[0].action.redirect }, { extensionPath: "/src/blocked.html" });

  await fake.changeSettings({ enabled: false, mode: "block" });
  await fake.changeSettings({ enabled: true, mode: "redirect" });
  await fake.changeSettings({ enabled: false, mode: "redirect" });
  await settle();
  assert.deepEqual(fake.state.rules, []);
});

test("browser startup re-applies the rule", async () => {
  const fake = fakeChrome({ enabled: true, mode: "block" });
  startWorker(fake);
  await fake.listeners.startup[0]();
  assert.equal(fake.state.rules.length, 1);
});
