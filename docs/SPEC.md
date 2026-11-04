# Shorts Blocker: spec

A Chrome extension (Manifest V3) that removes YouTube Shorts from YouTube in Chrome on desktop.
Felipe's idea, 2026-11-04. Code must be easy for a human to read: clear names, small functions,
comments only where intent is not obvious, no build step, no dependencies, plain JavaScript.
Never use the em dash character (U+2014) anywhere.

## What it does
1. **Hides Shorts** everywhere on www.youtube.com and m.youtube.com: the Shorts shelf on Home and
   Subscriptions, the Shorts entry in the sidebar and mini sidebar, Shorts results in search, the
   Shorts tab on channel pages, and Shorts in the "up next" column.
2. **Stops Shorts pages** (`/shorts/<id>`), both on full page loads and on YouTube's in-page
   navigation (YouTube is a single-page app, so clicking a link often doesn't load a new page).
   Two modes, chosen in the popup:
   - `redirect` (default): open the same video in the normal player, `/watch?v=<id>`.
   - `block`: show the extension's own "blocked" page instead.
3. **Popup**: an on/off switch, the mode choice, and a Bible verse at the bottom.
   Verse (Felipe's rule: every project shows one, small but noticeable):
   Ephesians 5:16 (ESV), "making the best use of the time, because the days are evil."

## Settings (shared contract)
`chrome.storage.sync`, key `settings`, value `{ enabled: boolean, mode: "redirect" | "block" }`.
Defaults: `{ enabled: true, mode: "redirect" }`. Every part reads this and reacts to
`chrome.storage.onChanged`.

## Files and owners
| File | What | Owner |
|---|---|---|
| `manifest.json` | MV3 manifest: name "Shorts Blocker", permissions `storage`, `declarativeNetRequest`; host permissions for `*://www.youtube.com/*`, `*://m.youtube.com/*`; background service worker; content scripts (order: `src/shorts-url.js`, `src/content.js`, CSS `src/hide-shorts.css`, `run_at: document_start`); popup; icons; `web_accessible_resources` for `src/blocked.html` | Claude Code #2 |
| `src/shorts-url.js` | Pure functions, no Chrome APIs: `isShortsUrl(url)`, `shortsVideoId(url)`, `toWatchUrl(url)` (keeps the host, drops Shorts-only params). Exposed as `globalThis.ShortsUrl` for the content script and via `module.exports` when `module` exists (for Node tests) | Claude Code #2 |
| `src/background.js` | Service worker: sets defaults on install; keeps one declarativeNetRequest dynamic rule in sync with settings (redirect `/shorts/<id>` main-frame requests to `/watch?v=<id>` with `regexSubstitution`, or to `src/blocked.html`, or no rule when disabled) | Claude Code #2 |
| `tests/*.test.js` | `node --test` tests for `shorts-url.js` and for the rule builder (export the pure rule-building function from a small module, e.g. `src/rules.js`) | Claude Code #2 |
| `src/content.js` | Reads settings; when enabled adds class `shorts-blocker-on` to `<html>` (removes it when disabled); on load, `yt-navigate-finish`, and `popstate`, if the URL is a Shorts URL, applies the mode with `location.replace`. Also hides elements that CSS can't target alone (e.g. a video item whose link starts with `/shorts/`) using a light, throttled MutationObserver. No polling loops | Antigravity |
| `src/hide-shorts.css` | Every rule prefixed with `html.shorts-blocker-on`, so turning the extension off shows everything again. Selectors for desktop and mobile YouTube, each group commented with what it hides | Antigravity |
| `src/blocked.html`, `src/blocked.js`, `src/blocked.css` | The "blocked" page: calm, short message, a button back to YouTube Home, the verse small at the bottom | Antigravity #2 |
| `popup/popup.html`, `popup/popup.css`, `popup/popup.js` | Switch, mode choice (two radio buttons), verse in the footer. Clean and small (about 300px wide), system font, light and dark mode via `prefers-color-scheme` | Antigravity #2 |
| `icons/icon-16.png`, `-32`, `-48`, `-128` + `icons/icon.svg` | Simple original icon (no YouTube logo or red play button; trademark). Generate the PNGs with a script in `scripts/` using only the Mac's built-in tools or Python's standard library | Antigravity #3 |
| `README.md` | What it does, install with "Load unpacked" (chrome://extensions, Developer mode), how to use the popup, how to run the tests, limits (desktop Chrome only; YouTube may change its page and selectors need updates), the verse | Antigravity #3 |

## Rules for everyone
- Touch only your own files. Read this spec first.
- No network calls, no analytics, no data leaves the browser.
- Don't commit. The maestro reviews and commits.
