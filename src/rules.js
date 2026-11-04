// Builds the declarativeNetRequest rule that stops Shorts pages on full page loads.
// Pure functions, no Chrome APIs: the service worker loads this file with importScripts()
// and uses globalThis.ShortsRules; the Node tests load it with require().

(function () {
  const DEFAULT_SETTINGS = { enabled: true, mode: "redirect" };
  const MODES = ["redirect", "block"];
  const SHORTS_RULE_ID = 1;
  const BLOCKED_PAGE = "/src/blocked.html";

  // Group 1 is the host (www or m), group 2 the video id. The path may end with a slash and
  // a query string. Chrome runs this with RE2, so it only uses syntax RE2 and JavaScript share.
  const SHORTS_URL_REGEX =
    "^https?://((?:www|m)\\.youtube\\.com)/shorts/([A-Za-z0-9_-]+)/?(?:\\?.*)?$";
  const WATCH_URL_SUBSTITUTION = "https://\\1/watch?v=\\2";

  // Stored settings may be missing or partly filled: anything unexpected falls back to the default.
  function withDefaults(stored) {
    const settings = stored || {};
    return {
      enabled: typeof settings.enabled === "boolean" ? settings.enabled : DEFAULT_SETTINGS.enabled,
      mode: MODES.includes(settings.mode) ? settings.mode : DEFAULT_SETTINGS.mode,
    };
  }

  function redirectTarget(mode) {
    if (mode === "block") {
      return { extensionPath: BLOCKED_PAGE };
    }
    return { regexSubstitution: WATCH_URL_SUBSTITUTION };
  }

  // The dynamic rules to install: one rule when enabled, none when disabled.
  function buildShortsRules(stored) {
    const settings = withDefaults(stored);
    if (!settings.enabled) {
      return [];
    }
    return [
      {
        id: SHORTS_RULE_ID,
        priority: 1,
        action: { type: "redirect", redirect: redirectTarget(settings.mode) },
        condition: { regexFilter: SHORTS_URL_REGEX, resourceTypes: ["main_frame"] },
      },
    ];
  }

  const ShortsRules = {
    DEFAULT_SETTINGS,
    SHORTS_RULE_ID,
    SHORTS_URL_REGEX,
    withDefaults,
    buildShortsRules,
  };
  globalThis.ShortsRules = ShortsRules;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = ShortsRules;
  }
})();
