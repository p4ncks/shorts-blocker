// Service worker: stores the default settings on install and keeps the Shorts redirect rule
// in line with the settings. The content script handles YouTube's in-page navigation.

importScripts("rules.js");

const { withDefaults, buildShortsRules, SHORTS_RULE_ID } = globalThis.ShortsRules;

async function readSettings() {
  const { settings } = await chrome.storage.sync.get("settings");
  return withDefaults(settings);
}

async function applyRule() {
  const settings = await readSettings();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [SHORTS_RULE_ID],
    addRules: buildShortsRules(settings),
  });
}

// Updates run one after another and each reads the latest settings, so quick toggles in the
// popup always end with the rule matching the last choice.
let ruleUpdate = Promise.resolve();
function syncRule() {
  ruleUpdate = ruleUpdate.then(applyRule).catch((error) => {
    console.error("Shorts Blocker: could not update the redirect rule", error);
  });
  return ruleUpdate;
}

// On first install this saves the defaults; on an update it keeps the user's choices.
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.sync.set({ settings: await readSettings() });
  await syncRule();
});

chrome.runtime.onStartup.addListener(syncRule);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.settings) {
    syncRule();
  }
});
