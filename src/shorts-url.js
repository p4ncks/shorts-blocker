// Recognizes YouTube Shorts URLs and turns them into normal watch URLs.
// Pure functions, no Chrome APIs: the content script uses them as globalThis.ShortsUrl,
// and the Node tests load them with require().

(function () {
  const YOUTUBE_HOSTS = ["www.youtube.com", "m.youtube.com"];

  // "/shorts/<id>" with an optional trailing slash. Video ids use letters, digits, "-" and "_".
  const SHORTS_PATH = /^\/shorts\/([A-Za-z0-9_-]+)\/?$/;

  // Relative links such as "/shorts/abc" are read as links on www.youtube.com.
  function parseUrl(url) {
    try {
      return new URL(url, "https://www.youtube.com");
    } catch {
      return null;
    }
  }

  function shortsVideoId(url) {
    const parsed = parseUrl(url);
    if (!parsed || !YOUTUBE_HOSTS.includes(parsed.hostname)) {
      return null;
    }
    const match = parsed.pathname.match(SHORTS_PATH);
    return match ? match[1] : null;
  }

  function isShortsUrl(url) {
    return shortsVideoId(url) !== null;
  }

  // Same host, normal player. Every query parameter of a Shorts URL (feature, si, pp...) is
  // Shorts-only, so none are kept. Returns null when the URL is not a Shorts URL.
  function toWatchUrl(url) {
    const id = shortsVideoId(url);
    if (id === null) {
      return null;
    }
    const host = parseUrl(url).host;
    return `https://${host}/watch?v=${id}`;
  }

  const ShortsUrl = { isShortsUrl, shortsVideoId, toWatchUrl };
  globalThis.ShortsUrl = ShortsUrl;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = ShortsUrl;
  }
})();
