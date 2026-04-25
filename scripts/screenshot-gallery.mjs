// scripts/screenshot-gallery.mjs — quick visual verification helper for
// the new Section 04 (gallery). Captures full-page, the gallery section
// itself, the calendar→gallery wave seam, and the lightbox open state.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../.screenshots');
await mkdir(outDir, { recursive: true });

const url = process.env.URL || 'http://127.0.0.1:8768/index.html';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 420, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(800);

// Force-reveal so the captured frames don't depend on scroll timing.
async function forceReveal(p) {
  await p.evaluate(() => {
    const gal = document.getElementById('gallery');
    if (!gal) { return; }
    gal.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-visible'));
    gal.querySelectorAll('.gallery__top-ornament, .gallery__bottom-ornament')
       .forEach(el => el.classList.add('is-visible'));
  });
}

// Convert lazy-loaded images to eager so they actually fetch off-screen,
// then wait (with a generous timeout) for them all to finish loading.
async function eagerLoadGalleryImages(p) {
  await p.evaluate(() => {
    document.querySelectorAll('#gallery img').forEach(img => {
      img.loading = 'eager';
      img.decoding = 'sync';
      const src = img.getAttribute('src');
      if (src) { img.setAttribute('src', src); }
    });
  });

  // Trigger native scroll-stitching by jumping to the bottom of the page.
  await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await p.waitForTimeout(300);
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await p.waitForTimeout(300);

  // Per-image wait with a 6s ceiling so a stalled image can't hang the run.
  await p.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll('#gallery img'));
    await Promise.all(imgs.map(img => new Promise(res => {
      const t = setTimeout(res, 6000);
      const done = () => { clearTimeout(t); res(); };
      if (img.complete) { done(); return; }
      img.addEventListener('load',  done, { once: true });
      img.addEventListener('error', done, { once: true });
    })));
  });
}

await eagerLoadGalleryImages(page);
await forceReveal(page);
await page.waitForTimeout(800);

await page.screenshot({
  path: resolve(outDir, 'gallery-full-page.png'),
  fullPage: true,
});

// Just the gallery section
const gallery = page.locator('#gallery');
await gallery.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await forceReveal(page);
await page.waitForTimeout(400);
await gallery.screenshot({ path: resolve(outDir, 'gallery-section.png') });

// Calendar→Gallery wave seam (tight crop)
await page.evaluate(() => {
  const cal = document.getElementById('calendar');
  const r = cal.getBoundingClientRect();
  window.scrollBy({ top: r.bottom - 120, behavior: 'instant' });
});
await page.waitForTimeout(300);
await page.screenshot({
  path: resolve(outDir, 'gallery-wave-boundary.png'),
  clip: { x: 0, y: 0, width: 420, height: 320 },
});

// Open the lightbox by clicking the View All button
await page.evaluate(() => {
  const btn = document.getElementById('galleryViewAll');
  if (btn) btn.click();
});
await page.waitForTimeout(700);
await page.screenshot({ path: resolve(outDir, 'gallery-lightbox-open.png') });

// Navigate to second image and re-screenshot
await page.evaluate(() => {
  const next = document.querySelector('.gallery-lightbox__nav--next');
  if (next) next.click();
});
await page.waitForTimeout(700);
await page.screenshot({ path: resolve(outDir, 'gallery-lightbox-second.png') });

// Tablet viewport
const tabletCtx = await browser.newContext({
  viewport: { width: 768, height: 1024 },
  deviceScaleFactor: 2,
});
const tabletPage = await tabletCtx.newPage();
await tabletPage.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await tabletPage.waitForTimeout(800);
await eagerLoadGalleryImages(tabletPage);
await forceReveal(tabletPage);
const tabletGallery = tabletPage.locator('#gallery');
await tabletGallery.scrollIntoViewIfNeeded();
await tabletPage.waitForTimeout(500);
await forceReveal(tabletPage);
await tabletPage.waitForTimeout(400);
await tabletGallery.screenshot({ path: resolve(outDir, 'gallery-section-tablet.png') });

// Synthesize a horizontal drag on the filmstrip using Playwright's mouse
// API (which mirrors a real input device — proper hit-testing, pointer
// capture, etc.) and confirm the track transform updates synchronously.
const dragInfo = await (async () => {
  await tabletPage.evaluate(() => {
    const s = document.querySelector('.gallery__filmstrip');
    if (s) s.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await tabletPage.waitForTimeout(250);

  const rect = await tabletPage.evaluate(() => {
    const t = document.querySelector('.gallery__filmstrip-track');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!rect) return { error: 'no track' };

  const readTx = () => tabletPage.evaluate(() => {
    const t = document.querySelector('.gallery__filmstrip-track');
    const tr = t ? t.style.transform || '' : '';
    /* Capture the first numeric argument INSIDE translate3d(...) — naive
       `-?\d+` would match the "3" inside "translate3d(". */
    const m = tr.match(/translate3d\(\s*(-?\d+(?:\.\d+)?)/);
    return { raw: tr, x: m ? parseFloat(m[1]) : 0 };
  });

  await tabletPage.mouse.move(rect.x, rect.y);
  await tabletPage.mouse.down();

  const txAtStart = await readTx();
  const samples = [];
  for (let i = 1; i <= 10; i++) {
    await tabletPage.mouse.move(rect.x - i * 12, rect.y);
    await tabletPage.waitForTimeout(20);
    samples.push(await readTx());
  }
  await tabletPage.mouse.up();

  const xs = samples.map(s => s.x);
  const monotonicallyDecreasing = xs.every((v, i, a) => i === 0 || v <= a[i - 1] + 0.5);
  return {
    txAtStart,
    samples,
    monotonicallyDecreasing,
    totalDelta: xs[xs.length - 1] - txAtStart.x,
  };
})();

const info = await page.evaluate(() => {
  const gal = document.getElementById('gallery');
  const cal = document.getElementById('calendar');
  const wave = document.querySelector('#calendar .calendar__wave');
  const lightbox = document.getElementById('galleryLightbox');
  const tiles = document.querySelectorAll('#gallery img[data-gallery-src]');
  return {
    galleryBg: getComputedStyle(gal).backgroundColor,
    calendarBg: getComputedStyle(cal).backgroundColor,
    waveExists: !!wave,
    waveBottom: wave ? getComputedStyle(wave).bottom : null,
    lightboxExists: !!lightbox,
    lightboxOpen: lightbox && lightbox.classList.contains('is-open'),
    galleryImageCount: tiles.length,
    galleryHeight: Math.round(gal.getBoundingClientRect().height),
    polaroidCount: document.querySelectorAll('.gallery__polaroid').length,
    quoteExists: !!document.querySelector('.gallery__quote'),
    bottomOrnamentExists: !!document.querySelector('.gallery__bottom-ornament'),
    extraMosaicCount:
      document.querySelectorAll('#gallery .gallery__mosaic').length,
    ctaParentClass: (document.querySelector('#galleryViewAll') || {})
      .closest && document.querySelector('#galleryViewAll')
        .closest('.gallery__inner')?.className,
    viewAllLabel:
      document.querySelector('.gallery__view-all-count')?.textContent,
  };
});

console.log(JSON.stringify({ info, dragInfo }, null, 2));

await browser.close();
