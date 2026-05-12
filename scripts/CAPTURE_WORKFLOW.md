# Mobile Capture Workflow

This project now includes reusable scripts for the long mobile capture flow:

- tile capture with Playwright (prevents `fullPage` white-cut issue on very tall pages)
- tile stitching into one final PNG
- optional section split (`hero`, `letter`, `calendar`, `gallery`, `location`, `account`, `snapshot`)

## 1) Start local server

```powershell
python -m http.server 8768
```

Open URL target: `http://127.0.0.1:8768/index.html`

## 2) Capture tiles (Samsung S20 Ultra style viewport)

```powershell
node .\scripts\capture-mobile-tiles.mjs `
  --url http://127.0.0.1:8768/index.html `
  --out-dir .screenshots `
  --name Capture `
  --width 412 `
  --height 915 `
  --dpr 3
```

Generated:

- `.screenshots/Capture_tiles/` (tile images)
- `.screenshots/Capture.tiles.json` (capture metadata)

## 3) Stitch to one image

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stitch-capture.ps1 `
  -MetaPath .\.screenshots\Capture.tiles.json `
  -OutputPath .\.screenshots\Capture-stitched.png
```

## 4) Stitch + section split at once

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stitch-capture.ps1 `
  -MetaPath .\.screenshots\Capture.tiles.json `
  -OutputPath .\.screenshots\Capture-stitched.png `
  -SplitSections `
  -SectionsOutDir .\.screenshots\Capture_sections
```

Generated split files:

- `Capture-01-hero.png`
- `Capture-02-letter.png`
- `Capture-03-calendar.png`
- `Capture-04-gallery.png`
- `Capture-05-location.png`
- `Capture-06-account.png`
- `Capture-07-snapshot.png`

## Notes

- `capture-mobile-tiles.mjs` waits for fonts and performs warmup scrolling so lazy/reveal elements load.
- `stitch-capture.ps1` supports both:
  - the new `Capture.tiles.json` schema
  - the older `tiles-galaxy-...meta.json` schema used earlier in this thread.
- Your original source image is never deleted by these scripts.
