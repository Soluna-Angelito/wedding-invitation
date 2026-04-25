// scripts/screenshot.mjs — quick visual verification helper.
// Captures:
//   1. full-page.png        — entire page
//   2. letter-section.png   — the letter (second) section, including its wave
//   3. calendar-section.png — the calendar (third) section
//   4. wave-boundary.png    — tight crop of the letter→calendar seam

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

await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(800);

await page.screenshot({
  path: resolve(outDir, 'full-page.png'),
  fullPage: true,
});

const letter = page.locator('#letter');
await letter.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await letter.screenshot({ path: resolve(outDir, 'letter-section.png') });

const calendar = page.locator('#calendar');
await calendar.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await calendar.screenshot({ path: resolve(outDir, 'calendar-section.png') });

await page.evaluate(() => {
  const cal = document.getElementById('calendar');
  const r = cal.getBoundingClientRect();
  window.scrollBy({ top: r.top - 120, behavior: 'instant' });
});
await page.waitForTimeout(300);

await page.screenshot({
  path: resolve(outDir, 'wave-boundary.png'),
  clip: { x: 0, y: 0, width: 420, height: 260 },
});

const info = await page.evaluate(() => {
  const cal = document.getElementById('calendar');
  const let_ = document.getElementById('letter');
  const wave = document.querySelector('#letter .letter__wave');
  const waveRect = wave ? wave.getBoundingClientRect() : null;
  const letterRect = let_.getBoundingClientRect();
  const calRect = cal.getBoundingClientRect();
  return {
    letterBg: getComputedStyle(let_).backgroundColor,
    calendarBg: getComputedStyle(cal).backgroundColor,
    letterPadding: getComputedStyle(let_).padding,
    calendarPadding: getComputedStyle(cal).padding,
    waveTransform: wave ? getComputedStyle(wave).transform : 'NO .letter__wave',
    wavePosition: wave ? getComputedStyle(wave).position : null,
    waveBottom: wave ? getComputedStyle(wave).bottom : null,
    waveHeight: waveRect ? Math.round(waveRect.height) : null,
    letterBottom: Math.round(letterRect.bottom + window.scrollY),
    waveBottomAbs: waveRect ? Math.round(waveRect.bottom + window.scrollY) : null,
    calendarTop: Math.round(calRect.top + window.scrollY),
    orphanCalendarWave: !!document.querySelector('#calendar .calendar__wave'),
  };
});

console.log(JSON.stringify(info, null, 2));

await browser.close();
