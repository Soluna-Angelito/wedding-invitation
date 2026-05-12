#!/usr/bin/env node
/**
 * Capture a long mobile page as viewport tiles to avoid Chromium's
 * fullPage screenshot height limit.
 *
 * Example:
 *   node scripts/capture-mobile-tiles.mjs \
 *     --url http://127.0.0.1:8768/index.html \
 *     --out-dir .screenshots \
 *     --name Capture
 */

import { chromium } from "playwright";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const DEFAULT_SECTIONS = [
  "hero",
  "letter",
  "calendar",
  "gallery",
  "location",
  "account",
  "snapshot",
];

function getArg(name, fallback = undefined) {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) {
    return fallback;
  }
  return process.argv[i + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function intArg(name, fallback) {
  const raw = getArg(name);
  if (raw == null) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function floatArg(name, fallback) {
  const raw = getArg(name);
  if (raw == null) {
    return fallback;
  }
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function csvArg(name, fallbackList) {
  const raw = getArg(name);
  if (!raw) {
    return fallbackList;
  }
  const list = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return list.length ? list : fallbackList;
}

function printHelp() {
  const lines = [
    "Usage: node scripts/capture-mobile-tiles.mjs [options]",
    "",
    "Options:",
    "  --url <url>            target URL (default: http://127.0.0.1:8768/index.html)",
    "  --out-dir <dir>        output directory (default: .screenshots)",
    "  --name <name>          base output name (default: Capture)",
    "  --width <px>           viewport width (default: 412)",
    "  --height <px>          viewport height (default: 915)",
    "  --dpr <n>              device scale factor (default: 3)",
    "  --sections <csv>       section ids (default: hero,letter,calendar,gallery,location,account,snapshot)",
    "  --warmup-max-steps <n> warmup scroll max loop count (default: 100)",
    "  --warmup-step-ratio <f>scroll step ratio of viewport height (default: 0.78)",
    "  --help                 show this help",
  ];
  console.log(lines.join("\n"));
}

if (hasFlag("--help")) {
  printHelp();
  process.exit(0);
}

const targetUrl = getArg("--url", "http://127.0.0.1:8768/index.html");
const outDir = resolve(process.cwd(), getArg("--out-dir", ".screenshots"));
const outputName = getArg("--name", "Capture");

const viewportWidth = intArg("--width", 412);
const viewportHeight = intArg("--height", 915);
const deviceScaleFactor = floatArg("--dpr", 3);
const sectionIds = csvArg("--sections", DEFAULT_SECTIONS);
const warmupMaxSteps = intArg("--warmup-max-steps", 100);
const warmupStepRatio = floatArg("--warmup-step-ratio", 0.78);

const tileDir = join(outDir, `${outputName}_tiles`);
const metaPath = join(outDir, `${outputName}.tiles.json`);

await mkdir(outDir, { recursive: true });
await rm(tileDir, { recursive: true, force: true });
await mkdir(tileDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: viewportWidth, height: viewportHeight },
  deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

async function waitVisibleImages(timeoutMs = 7000) {
  await page.evaluate(async (timeout) => {
    const deadline = Date.now() + timeout;
    const images = Array.from(document.images);
    const tasks = images.map(
      (img) =>
        new Promise((resolve) => {
          const rect = img.getBoundingClientRect();
          const nearViewport =
            rect.bottom > -400 && rect.top < window.innerHeight + 400;

          if (!nearViewport) {
            resolve();
            return;
          }
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }

          const remain = Math.max(0, deadline - Date.now());
          const timer = setTimeout(resolve, remain);
          const done = () => {
            clearTimeout(timer);
            resolve();
          };
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        })
    );
    await Promise.all(tasks);
  }, timeoutMs);
}

try {
  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("load");

  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // ignore font readiness failure
      }
    }
  });

  await page.waitForTimeout(2400);

  // Encourage off-screen lazy assets to load during warmup traversal.
  await page.evaluate(() => {
    document.querySelectorAll("img").forEach((img) => {
      try {
        img.loading = "eager";
        img.decoding = "sync";
        const src = img.getAttribute("src");
        if (src) {
          img.setAttribute("src", src);
        }
      } catch {
        // ignore per-image property assignment issues
      }
    });
  });

  const warmupStep = Math.max(
    220,
    Math.floor(viewportHeight * Math.max(0.1, warmupStepRatio))
  );

  for (let i = 0; i < warmupMaxSteps; i += 1) {
    const pos = await page.evaluate(() => {
      const doc = document.scrollingElement || document.documentElement;
      return {
        y: Math.round(window.scrollY),
        maxY: Math.max(0, Math.round(doc.scrollHeight - window.innerHeight)),
      };
    });

    if (pos.y >= pos.maxY) {
      break;
    }

    const nextY = Math.min(pos.y + warmupStep, pos.maxY);
    await page.evaluate((y) => {
      window.scrollTo({ top: y, behavior: "auto" });
    }, nextY);
    await page.waitForTimeout(650);
    await waitVisibleImages(7000);
    await page.waitForTimeout(250);
  }

  await page.waitForTimeout(1200);

  const metrics = await page.evaluate((ids) => {
    const doc = document.scrollingElement || document.documentElement;
    const sections = ids
      .map((id) => {
        const el = document.getElementById(id);
        if (!el) {
          return null;
        }
        const rect = el.getBoundingClientRect();
        return {
          id,
          topCss: rect.top + window.scrollY,
          heightCss: rect.height,
        };
      })
      .filter(Boolean);

    return {
      viewportWidthCss: window.innerWidth,
      viewportHeightCss: window.innerHeight,
      docHeightCss: doc.scrollHeight,
      maxYCss: Math.max(0, doc.scrollHeight - window.innerHeight),
      sections,
    };
  }, sectionIds);

  const positionsRaw = [];
  for (let y = 0; y <= metrics.maxYCss; y += metrics.viewportHeightCss) {
    positionsRaw.push(Math.round(y));
  }
  positionsRaw.push(Math.round(metrics.maxYCss));

  const positions = Array.from(new Set(positionsRaw)).sort((a, b) => a - b);

  const tiles = [];
  for (let i = 0; i < positions.length; i += 1) {
    const targetY = positions[i];
    await page.evaluate((y) => {
      window.scrollTo({ top: y, behavior: "auto" });
    }, targetY);
    await page.waitForTimeout(360);
    await waitVisibleImages(5000);
    await page.waitForTimeout(140);

    const scrollYCss = await page.evaluate(() => Math.round(window.scrollY));
    const fileName = `tile-${String(i).padStart(4, "0")}.png`;
    const filePath = join(tileDir, fileName);

    await page.screenshot({
      path: filePath,
      fullPage: false,
      animations: "allow",
      scale: "device",
    });

    tiles.push({
      index: i,
      targetYCss,
      scrollYCss,
      fileName,
      filePath,
    });
  }

  const meta = {
    createdAt: new Date().toISOString(),
    sourceUrl: targetUrl,
    outputName,
    viewport: {
      widthCss: viewportWidth,
      heightCss: viewportHeight,
      deviceScaleFactor,
    },
    page: {
      docHeightCss: metrics.docHeightCss,
      maxYCss: metrics.maxYCss,
    },
    sections: metrics.sections,
    tileDir,
    tiles,
  };

  await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        metaPath,
        tileDir,
        tileCount: tiles.length,
        docHeightCss: metrics.docHeightCss,
        expectedStitchedPath: join(outDir, `${outputName}-stitched.png`),
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
