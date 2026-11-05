// Content script for Shorts Blocker.
// hide-shorts.css does most of the hiding; this script switches it on with a class on <html>,
// marks the Shorts cards CSS cannot recognize, and leaves Shorts pages that YouTube opens with
// in-page navigation (the background redirect rule only sees full page loads).
// Nothing happens until the saved settings are read, so someone who turned the extension off is
// never redirected. In Node the pure helpers are exported for the tests and nothing starts.

(function () {
  const DEFAULT_SETTINGS = { enabled: true, mode: "redirect" };
  const MODES = ["redirect", "block"];
  const YOUTUBE_HOSTS = ["www.youtube.com", "m.youtube.com"];
  const ON_CLASS = "shorts-blocker-on";
  const MARKER = "data-shorts-blocked";
  const BLOCKED_PAGE = "src/blocked.html";
  const BATCH_DELAY_MS = 200;
  const FILTER_CHIP_TAG = "yt-chip-cloud-chip-renderer"; // one search filter chip, such as "Shorts"

  // Elements that are one video or one menu entry. Never add a section or list here (such as
  // ytd-item-section-renderer): those also hold normal videos, and the whole list would vanish.
  const CARD_TAGS = new Set([
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-reel-item-renderer",
    "yt-lockup-view-model",
    "ytm-shorts-lockup-view-model",
    "ytm-shorts-lockup-view-model-v2",
    "ytd-guide-entry-renderer",
    "ytd-mini-guide-entry-renderer",
    "ytm-video-with-context-renderer",
    "ytm-compact-video-renderer",
    "ytm-rich-item-renderer",
    "ytm-reel-item-renderer",
    "ytm-media-item",
    FILTER_CHIP_TAG,
  ]);
  const CARD_SELECTOR = [...CARD_TAGS].join(", ");
  const SHORTS_LINK_SELECTOR = 'a[href*="/shorts"]';

  // In the extension shorts-url.js runs first and sets globalThis.ShortsUrl; Node loads it here.
  const ShortsUrl = globalThis.ShortsUrl || require("./shorts-url.js");

  // ---- Pure helpers ----

  function normalizeSettings(stored) {
    const settings = stored || {};
    return {
      enabled: typeof settings.enabled === "boolean" ? settings.enabled : DEFAULT_SETTINGS.enabled,
      mode: MODES.includes(settings.mode) ? settings.mode : DEFAULT_SETTINGS.mode,
    };
  }

  // True for the Shorts feed ("/shorts", "/shorts/") and for single Shorts ("/shorts/<id>").
  function isShortsHref(href) {
    let url;
    try {
      url = new URL(href, "https://www.youtube.com");
    } catch {
      return false;
    }
    const onYouTube = YOUTUBE_HOSTS.includes(url.hostname);
    return onYouTube && (url.pathname === "/shorts" || url.pathname.startsWith("/shorts/"));
  }

  // The cards an element belongs to: the element itself if it is a card, then each card above it.
  function cardsAround(element) {
    const cards = [];
    for (let node = element; node; node = node.parentElement) {
      if (CARD_TAGS.has(node.localName)) {
        cards.push(node);
      }
    }
    return cards;
  }

  // Where the page should go instead of pageUrl, or null to stay.
  // settings is null until the stored settings are read: then the answer is always null.
  function replacementUrl(pageUrl, settings, blockedPageUrl) {
    if (!settings || !settings.enabled || !ShortsUrl.isShortsUrl(pageUrl)) {
      return null;
    }
    return settings.mode === "block" ? blockedPageUrl : ShortsUrl.toWatchUrl(pageUrl);
  }

  // ---- Page behaviour ----

  let settings = null;
  let observer = null;
  let batchTimer = null;
  const changedElements = new Set(); // something inside changed: recheck the cards around them
  const addedElements = new Set(); // new subtrees: also check every card inside them

  function containsShortsLink(card) {
    const links = card.querySelectorAll(SHORTS_LINK_SELECTOR);
    return Array.from(links).some((link) => isShortsHref(link.getAttribute("href")));
  }

  // The "Shorts" filter chip has no link and no attribute to match, only its visible label
  // (English, and also the word YouTube uses in Portuguese).
  function isShortsChip(chip) {
    return chip.textContent.trim() === "Shorts";
  }

  function isShortsCard(card) {
    return card.localName === FILTER_CHIP_TAG ? isShortsChip(card) : containsShortsLink(card);
  }

  // YouTube reuses card elements for other videos, so each check can also remove the marker.
  function refreshCard(card) {
    card.toggleAttribute(MARKER, isShortsCard(card));
  }

  function refreshCardsAround(element) {
    cardsAround(element).forEach(refreshCard);
  }

  function refreshCardsIn(element) {
    refreshCardsAround(element);
    element.querySelectorAll(CARD_SELECTOR).forEach(refreshCard);
  }

  function processChanges() {
    batchTimer = null;
    for (const element of changedElements) {
      if (element.isConnected) refreshCardsAround(element);
    }
    for (const element of addedElements) {
      if (element.isConnected) refreshCardsIn(element);
    }
    changedElements.clear();
    addedElements.clear();
  }

  // The first change starts a short timer and everything that changes until it fires is checked
  // together, so a busy page is checked at most every BATCH_DELAY_MS, and never scanned whole.
  // A record's target can be a Text node (a label edited in place). That is fine:
  // cardsAround walks up from it through parentElement like from any element.
  function onMutations(records) {
    for (const record of records) {
      changedElements.add(record.target);
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) addedElements.add(node);
      }
    }
    if (batchTimer === null) {
      batchTimer = setTimeout(processChanges, BATCH_DELAY_MS);
    }
  }

  function startHiding() {
    const root = document.documentElement;
    root.classList.add(ON_CLASS);
    if (observer === null) {
      observer = new MutationObserver(onMutations);
      observer.observe(root, {
        subtree: true,
        childList: true, // cards added or removed
        attributes: true, // a reused card gets a new link
        attributeFilter: ["href"],
        characterData: true, // a reused chip gets a new label, such as Videos becoming Shorts
      });
    }
    refreshCardsIn(root);
  }

  function stopHiding() {
    document.documentElement.classList.remove(ON_CLASS);
    if (observer !== null) {
      observer.disconnect();
      observer = null;
    }
    clearTimeout(batchTimer);
    batchTimer = null;
    changedElements.clear();
    addedElements.clear();
    document.querySelectorAll(`[${MARKER}]`).forEach((card) => card.removeAttribute(MARKER));
  }

  function leaveShortsPage() {
    const target = replacementUrl(location.href, settings, chrome.runtime.getURL(BLOCKED_PAGE));
    if (target) {
      location.replace(target);
    }
  }

  function applySettings(stored) {
    settings = normalizeSettings(stored);
    if (settings.enabled) {
      startHiding();
    } else {
      stopHiding();
    }
    leaveShortsPage();
  }

  function onNavigation() {
    if (settings === null) return;
    leaveShortsPage();
    if (settings.enabled) refreshCardsIn(document.documentElement);
  }

  function start() {
    chrome.storage.sync
      .get("settings")
      .then((data) => applySettings(data.settings))
      .catch((error) => console.error("Shorts Blocker: could not read settings", error));

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes.settings) {
        applySettings(changes.settings.newValue);
      }
    });

    window.addEventListener("yt-navigate-finish", onNavigation);
    window.addEventListener("popstate", onNavigation);
  }

  const helpers = { CARD_TAGS, normalizeSettings, isShortsHref, cardsAround, replacementUrl };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = helpers;
  } else {
    start();
  }
})();
