# Shorts Blocker

A lightweight Chrome extension (Manifest V3) that removes YouTube Shorts from desktop YouTube.

> "making the best use of the time, because the days are evil."  
> (Ephesians 5:16, ESV)

---

## What It Does

Shorts Blocker removes short-form vertical video distractions from YouTube:

1. **Hides Shorts across YouTube**:
   - The Shorts shelf on the Home feed and Subscriptions.
   - The Shorts links in the primary sidebar and compact mini sidebar.
   - Shorts video items appearing in search results.
   - The dedicated Shorts tab on channel pages.
   - Shorts recommendations in the "up next" column.

2. **Intercepts Shorts URLs** (`/shorts/<id>`):
   - **Redirect mode (default)**: Opens the video directly in YouTube's standard desktop player (`/watch?v=<id>`), preserving playback controls, comments, and description without the vertical Shorts interface.
   - **Block mode**: Stops playback and displays a calm, local extension page with a clean link back to YouTube Home.
   - Handles full page reloads via Chrome Declarative Net Request rules, as well as YouTube in-page Single Page Application (SPA) navigation via content scripts.

3. **Private and offline**:
   - Zero external dependencies.
   - No build step.
   - No network calls or analytics. All settings remain in local browser storage (`chrome.storage.sync`).

---

## Installation

Install Shorts Blocker in Google Chrome using Developer Mode:

1. Clone or download this repository to your local computer.
2. Open Google Chrome and enter `chrome://extensions` into the address bar.
3. Toggle the **Developer mode** switch in the top-right corner to **ON**.
4. Click the **Load unpacked** button in the top-left toolbar.
5. In the file picker, select the `shorts-blocker` project directory containing `manifest.json`.
6. Shorts Blocker is now active. Pin the extension icon to your toolbar for easy access.

---

## Popup Usage

Click the extension icon in your Chrome toolbar to open the settings popup:

- **Enable / Disable toggle**: Turn the blocker on or off. When disabled, standard YouTube layout is restored immediately without needing to restart Chrome.
- **Mode selection**:
  - `Redirect to normal player`: Redirects any `/shorts/<id>` video to `/watch?v=<id>`.
  - `Show blocked page`: Intercepts Shorts URLs and displays a quiet local blocked screen.
- Settings are saved automatically to `chrome.storage.sync` and synchronize across open YouTube tabs in real time.

---

## Running Tests

The test suite runs using Node.js's built-in test runner without requiring any external dependencies or npm packages:

```bash
node --test
```

The automated test suite verifies:
- Manifest V3 structure, permissions, and script definitions.
- URL parsing, host detection, and parameter stripping in `shorts-url.js`.
- Declarative Net Request dynamic rule creation across redirect, block, and disabled modes.
- Background worker settings initialization, migration, and browser startup synchronization.

---

## Limitations

- **Desktop Chrome only**: Built specifically for desktop Google Chrome using Manifest V3 extension APIs.
- **YouTube DOM updates**: YouTube frequently updates its web application layouts and internal class names. When YouTube updates its DOM structure, CSS selectors in `src/hide-shorts.css` and DOM queries in `src/content.js` may require periodic updates.
- **English-only text selectors**: Certain navigation selectors match English labels (such as links labeled "Shorts" or aria-labels). While structural selectors hide shelves across languages, English interface settings provide the most comprehensive coverage.
