const fs = require('fs');
const path = require('path');

// Resolve Playwright from standard modules or the runtime cache.
let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  try {
    playwright = require('/Users/p4ncks/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  } catch (err) {
    console.error('Playwright not found: ' + err.message);
    process.exit(1);
  }
}

const { chromium } = playwright;

// Find an available Chromium or Google Chrome binary.
function getExecutablePath() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/Users/p4ncks/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

// Read PNG dimensions directly from the IHDR chunk.
function getPngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('File is not a valid PNG: ' + filePath);
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const storeDir = path.join(repoRoot, 'store');
  const iconsDir = path.join(repoRoot, 'icons');
  const tempProfileDir = path.join('/tmp', 'shorts-blocker-store-profile-' + Date.now());

  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  const executablePath = getExecutablePath();
  console.log('Using browser executable: ' + (executablePath || 'Playwright default'));

  // Launch persistent context with the unpacked extension.
  const context = await chromium.launchPersistentContext(tempProfileDir, {
    executablePath,
    headless: false,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    chromiumSandbox: true,
    args: [
      '--disable-quic',
      '--disable-http2',
      '--disable-features=AsyncDns',
      `--disable-extensions-except=${repoRoot}`,
      `--load-extension=${repoRoot}`
    ]
  });

  // Find the background service worker and extension ID.
  let [background] = context.serviceWorkers();
  if (!background) {
    background = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = background.url().split('/')[2];
  console.log('Loaded unpacked extension with ID: ' + extensionId);

  const searchPath = path.join(storeDir, 'screenshot-1-search.png');
  const popupPath = path.join(storeDir, 'screenshot-2-popup.png');
  const blockedPath = path.join(storeDir, 'screenshot-3-blocked.png');
  const promoPath = path.join(storeDir, 'promo-small.png');

  // Screenshot 1: YouTube search results with extension enabled, Shorts shelves gone.
  console.log('Capturing screenshot-1-search.png (1280x800)...');
  const searchPage = context.pages()[0] || await context.newPage();
  await searchPage.setViewportSize({ width: 1280, height: 800 });
  await searchPage.goto('https://www.youtube.com/results?search_query=nature+documentary', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  // Confirm the extension applied the active class and hid Shorts.
  await searchPage.waitForFunction(() => {
    return document.documentElement.classList.contains('shorts-blocker-on');
  }, { timeout: 5000 });

  // Give video thumbnails a moment to settle.
  await searchPage.waitForTimeout(2500);
  await searchPage.screenshot({ path: searchPath });
  console.log('Saved: ' + searchPath);

  // Screenshot 2: The popup shown over the YouTube page.
  console.log('Capturing screenshot-2-popup.png (1280x800)...');
  // First, capture the authentic popup rendered by the extension.
  const popupPage = await context.newPage();
  await popupPage.setViewportSize({ width: 400, height: 400 });
  await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await popupPage.waitForTimeout(600);
  const popupElement = await popupPage.locator('body');
  const popupBuffer = await popupElement.screenshot();
  const popupBase64 = popupBuffer.toString('base64');
  await popupPage.close();

  // Next, capture the YouTube background page.
  const ytBackgroundBuffer = await searchPage.screenshot();
  const ytBase64 = ytBackgroundBuffer.toString('base64');

  // Composite the popup naturally over the YouTube page in a canvas.
  const compositePage = await context.newPage();
  await compositePage.setViewportSize({ width: 1280, height: 800 });
  await compositePage.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body, html { margin: 0; padding: 0; overflow: hidden; }
        canvas { display: block; }
      </style>
    </head>
    <body>
      <canvas id="stage" width="1280" height="800"></canvas>
      <script>
        window.renderComposite = async function(bgData, popupData) {
          const canvas = document.getElementById('stage');
          const ctx = canvas.getContext('2d');

          // Draw the YouTube search background.
          const bg = new Image();
          await new Promise(res => { bg.onload = res; bg.src = bgData; });
          ctx.drawImage(bg, 0, 0, 1280, 800);

          // Subtle backdrop overlay to emphasize the open popup.
          ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
          ctx.fillRect(0, 0, 1280, 800);

          // Draw the authentic popup dropdown at top right.
          const popup = new Image();
          await new Promise(res => { popup.onload = res; popup.src = popupData; });

          const posX = 1280 - popup.width - 28;
          const posY = 14;
          const cornerRadius = 8;

          // Realistic browser popup drop shadow.
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
          ctx.shadowBlur = 24;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 8;

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(posX, posY, popup.width, popup.height, cornerRadius);
          ctx.fill();
          ctx.restore();

          // Render popup content within rounded bounds.
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(posX, posY, popup.width, popup.height, cornerRadius);
          ctx.clip();
          ctx.drawImage(popup, posX, posY);
          ctx.restore();

          // Crisp container border.
          ctx.save();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(posX, posY, popup.width, popup.height, cornerRadius);
          ctx.stroke();
          ctx.restore();
        };
      </script>
    </body>
    </html>
  `);

  await compositePage.evaluate(async ({ bg, pop }) => {
    await window.renderComposite('data:image/png;base64,' + bg, 'data:image/png;base64,' + pop);
  }, { bg: ytBase64, pop: popupBase64 });

  await compositePage.waitForTimeout(400);
  await compositePage.screenshot({ path: popupPath });
  await compositePage.close();
  console.log('Saved: ' + popupPath);

  // Screenshot 3: The blocked page in block mode.
  console.log('Capturing screenshot-3-blocked.png (1280x800)...');
  const blockedPage = await context.newPage();
  await blockedPage.setViewportSize({ width: 1280, height: 800 });
  await blockedPage.goto(`chrome-extension://${extensionId}/src/blocked.html`);
  await blockedPage.waitForTimeout(600);
  await blockedPage.screenshot({ path: blockedPath });
  await blockedPage.close();
  console.log('Saved: ' + blockedPath);

  // Promo Small: 440x280 PNG using icons/icon.svg and name 'Shorts Blocker'.
  console.log('Capturing promo-small.png (440x280)...');
  const iconSvgPath = path.join(iconsDir, 'icon.svg');
  const iconSvgContent = fs.readFileSync(iconSvgPath, 'utf8');

  const promoPage = await context.newPage();
  await promoPage.setViewportSize({ width: 440, height: 280 });
  await promoPage.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          width: 440px;
          height: 280px;
          overflow: hidden;
          background: radial-gradient(circle at 50% 32%, #1e293b 0%, #0f172a 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          user-select: none;
        }
        .icon-wrapper {
          width: 96px;
          height: 96px;
          margin-bottom: 20px;
          filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.45));
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-wrapper svg {
          width: 100%;
          height: 100%;
          display: block;
        }
        .brand-name {
          color: #f8fafc;
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.02em;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        }
      </style>
    </head>
    <body>
      <div class="icon-wrapper">
        ${iconSvgContent}
      </div>
      <div class="brand-name">Shorts Blocker</div>
    </body>
    </html>
  `);

  await promoPage.waitForTimeout(400);
  await promoPage.screenshot({ path: promoPath });
  await promoPage.close();
  console.log('Saved: ' + promoPath);

  // Close browser context and clean up temporary profile.
  await context.close();
  try {
    fs.rmSync(tempProfileDir, { recursive: true, force: true });
  } catch (err) {
    // Ignore temp folder removal errors.
  }

  // Validate all generated image dimensions.
  const checks = [
    { file: 'screenshot-1-search.png', path: searchPath, expectedW: 1280, expectedH: 800 },
    { file: 'screenshot-2-popup.png', path: popupPath, expectedW: 1280, expectedH: 800 },
    { file: 'screenshot-3-blocked.png', path: blockedPath, expectedW: 1280, expectedH: 800 },
    { file: 'promo-small.png', path: promoPath, expectedW: 440, expectedH: 280 }
  ];

  console.log('\n--- Checking image dimensions ---');
  let allValid = true;
  for (const item of checks) {
    const dims = getPngDimensions(item.path);
    const size = fs.statSync(item.path).size;
    const ok = dims.width === item.expectedW && dims.height === item.expectedH;
    console.log(`${item.file}: ${dims.width}x${dims.height} (${size} bytes) -> ${ok ? 'OK' : 'MISMATCH'}`);
    if (!ok) allValid = false;
  }

  if (!allValid) {
    console.error('Error: One or more image dimensions do not match the required specifications.');
    process.exit(1);
  }

  console.log('All Chrome Web Store store images successfully generated and verified.');
}

main().catch(err => {
  console.error('Failed to generate store images:', err);
  process.exit(1);
});
