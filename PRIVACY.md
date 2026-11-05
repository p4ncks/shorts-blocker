# Privacy Policy for Shorts Blocker

Last updated: November 5, 2026

Shorts Blocker is built with privacy as a primary principle. The extension operates locally inside your browser and respects your personal space.

## 1. Transient On-Device Processing

To hide Shorts elements and redirect Shorts links, the extension inspects elements on YouTube pages in real time:

- The content script inspects the current YouTube URL, link target destinations, and page elements (such as filter chip labels and video shelf cards) on youtube.com.
- All processing takes place entirely in memory on your local device.
- These details are processed only to decide what to hide or redirect. They are never logged, never stored as browsing history, and never transmitted to the developer or any third party.

## 2. No External Data Collection or Network Requests

Shorts Blocker makes zero network requests of its own and collects no user data:

- It connects to no external servers, APIs, or third-party analytics services.
- It contains no analytics scripts or crash-reporting libraries.
- All code, stylesheets, and icons run entirely offline from within the installed extension bundle.

## 3. Local Settings Storage

When you change settings in the popup (turning the blocker on or off, or switching between Redirect and Block modes):

- Your choices are saved locally using Chrome's built-in `chrome.storage.sync` API.
- Your preferences remain on your device, or in your personal Chrome sync account if you use Chrome sync.
- The extension developer has no access to your settings or your device.

## 4. Permissions Used

Shorts Blocker requests only the minimum permissions necessary to function:

- `storage`: Keeps your enabled state and mode choice on your device.
- `declarativeNetRequest`: Redirects or blocks Shorts URLs locally before the network load occurs.
- Host access to `www.youtube.com` and `m.youtube.com`: Applies local styles to hide Shorts elements, handles in-page navigation, and enables declarativeNetRequest redirects of /shorts/ navigations to the normal watch player or to the local blocked page.

## 5. Contact and Inquiries

Questions: use the support email shown on the Chrome Web Store listing page.
