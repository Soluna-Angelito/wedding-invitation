// assets/js/gallery.js
(function (global) {
  'use strict';

  var app = global.WeddingInvitation = global.WeddingInvitation || {};

  function getConfig() {
    return (global.WeddingConfig && global.WeddingConfig.gallery) || {};
  }

  function getPhotos() {
    return global.WeddingPhotos || null;
  }

  function prefersReducedMotion() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }


  /* ══════════════════════════════════════════════════════════════════
     Data-Driven Render
     ──────────────────────────────────────────────────────────────────
     Reads `window.WeddingPhotos` (assets/data/photos.js) and fills the
     featured frame, mosaic grids, polaroid filmstrip, and "view all"
     count from a single source of truth. Filenames map to captions
     through the registry, so the same description is reused for the
     gallery caption, the lightbox description, and the image alt text.
     ══════════════════════════════════════════════════════════════════ */

  function makeGalleryImg(photos, file, opts) {
    opts = opts || {};
    var caption = photos.captionFor(file);
    var src = photos.pathFor(file);

    var img = document.createElement('img');
    img.src = src;
    img.setAttribute('data-gallery-src', src);
    img.setAttribute('data-gallery-caption', caption);
    img.setAttribute('alt', opts.alt != null ? opts.alt : caption);
    img.setAttribute('loading', opts.eager ? 'eager' : 'lazy');
    img.setAttribute('decoding', 'async');
    return img;
  }

  function renderFeatured(galleryEl, photos) {
    var slot = galleryEl.querySelector('[data-gallery-slot="featured"]');
    if (!slot || !photos.layout || !photos.layout.featured) {
      return;
    }

    var file = photos.layout.featured;
    var caption = photos.captionFor(file);

    var frame = slot.querySelector('.gallery__featured-frame');
    if (frame) {
      frame.innerHTML = '';
      frame.appendChild(makeGalleryImg(photos, file));
    }

    var cap = slot.querySelector('.gallery__featured-caption');
    if (cap) {
      cap.textContent = caption ? '— ' + caption + ' —' : '';
    }
  }

  function renderMosaics(galleryEl, photos) {
    var slot = galleryEl.querySelector('[data-gallery-slot="mosaics"]');
    if (!slot || !photos.layout || !Array.isArray(photos.layout.mosaics)) {
      return;
    }

    slot.innerHTML = '';

    photos.layout.mosaics.forEach(function (group) {
      if (!group || !Array.isArray(group.photos) || group.photos.length === 0) {
        return;
      }

      var mosaic = document.createElement('div');
      mosaic.className = 'gallery__mosaic gallery__mosaic--' + (group.layout || 'duo');
      mosaic.setAttribute('data-reveal', 'fade-up');

      group.photos.forEach(function (file, idx) {
        var fig = document.createElement('figure');
        fig.className = 'gallery__tile';

        switch (group.layout) {
          case 'mixed':
            if (idx === 0) {
              fig.classList.add('gallery__tile--span-row');
            } else {
              fig.classList.add('gallery__tile--landscape');
            }
            break;
          case 'trio':
            fig.classList.add('gallery__tile--square');
            break;
          case 'duo':
          default:
            fig.classList.add('gallery__tile--portrait');
            break;
        }

        fig.appendChild(makeGalleryImg(photos, file));
        mosaic.appendChild(fig);
      });

      slot.appendChild(mosaic);
    });
  }

  /* Stable, deterministic pseudo-random tilt/tape angle per photo
     position so adding a photo doesn't shuffle the others' angles. */
  function pseudoRandomAngle(seed, max) {
    var v = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    var frac = v - Math.floor(v);
    return (frac * 2 - 1) * max;
  }

  function resolveFilmstripFiles(photos) {
    var sel = photos.layout && photos.layout.filmstrip;
    if (Array.isArray(sel)) {
      return sel.slice();
    }
    if (sel && typeof sel === 'object' && Array.isArray(sel.exclude)) {
      var excl = sel.exclude;
      return photos.allFiles().filter(function (f) { return excl.indexOf(f) === -1; });
    }
    /* default → 'auto' */
    return photos.allFiles();
  }

  function renderFilmstrip(galleryEl, photos, config) {
    var track = galleryEl.querySelector('[data-gallery-slot="filmstrip"]');
    if (!track) {
      return;
    }

    var files = resolveFilmstripFiles(photos);
    track.innerHTML = '';

    var maxTilt = config.filmstripTiltMaxDeg != null ? config.filmstripTiltMaxDeg : 2.6;
    var maxTape = config.filmstripTapeMaxDeg != null ? config.filmstripTapeMaxDeg : 5;

    files.forEach(function (file, i) {
      var caption = photos.captionFor(file);

      var fig = document.createElement('figure');
      fig.className = 'gallery__polaroid';
      fig.setAttribute('role', 'listitem');
      fig.style.setProperty('--polaroid-tilt', pseudoRandomAngle(i + 1, maxTilt).toFixed(2) + 'deg');
      fig.style.setProperty('--tape-rotate', pseudoRandomAngle(i + 11, maxTape).toFixed(2) + 'deg');

      var photoBox = document.createElement('div');
      photoBox.className = 'gallery__polaroid-photo';
      photoBox.appendChild(makeGalleryImg(photos, file));
      fig.appendChild(photoBox);

      var cap = document.createElement('figcaption');
      cap.className = 'gallery__polaroid-caption';
      cap.textContent = caption;
      fig.appendChild(cap);

      track.appendChild(fig);
    });
  }

  function renderHero(photos) {
    if (!photos.layout || !photos.layout.hero) {
      return;
    }
    var heroImg = document.querySelector('[data-gallery-slot="hero"]');
    if (!heroImg) {
      return;
    }
    /* Only override the alt text — the src is left alone here because it
       must be set in the initial HTML for the LCP/preload behaviour to
       work correctly. The data file's hero entry is still authoritative
       for documentation. */
    var caption = photos.captionFor(photos.layout.hero);
    if (caption) {
      heroImg.setAttribute('alt', caption);
    }
  }

  function updateViewAllCount(galleryEl) {
    var slot = galleryEl.querySelector('[data-gallery-slot="count"]');
    if (!slot) {
      return;
    }
    /* Count unique photos across the whole gallery so duplicates between
       the mosaic and filmstrip don't inflate the badge. */
    var imgs = galleryEl.querySelectorAll('img[data-gallery-src]');
    var seen = Object.create(null);
    var count = 0;
    for (var i = 0; i < imgs.length; i++) {
      var src = imgs[i].getAttribute('data-gallery-src');
      if (src && !seen[src]) {
        seen[src] = 1;
        count += 1;
      }
    }
    slot.textContent = '(' + count + ')';
  }

  function renderGallery(galleryEl, config) {
    var photos = getPhotos();
    if (!photos) {
      return false;
    }
    renderHero(photos);
    renderFeatured(galleryEl, photos);
    renderMosaics(galleryEl, photos);
    renderFilmstrip(galleryEl, photos, config);
    updateViewAllCount(galleryEl);
    return true;
  }


  /* ══════════════════════════════════════════════════════════════════
     Scroll-Reveal Animations (IntersectionObserver)
     ══════════════════════════════════════════════════════════════════ */

  function setupReveals(galleryEl, config) {
    var rootMargin = config.rootMargin || '0px 0px -10% 0px';
    var threshold  = (config.threshold != null) ? config.threshold : 0.12;

    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) {
          continue;
        }
        entries[i].target.classList.add('is-visible');
        observer.unobserve(entries[i].target);
      }
    }, { rootMargin: rootMargin, threshold: threshold });

    var reveals = galleryEl.querySelectorAll('[data-reveal]');
    for (var i = 0; i < reveals.length; i++) {
      observer.observe(reveals[i]);
    }

    return observer;
  }


  /* ══════════════════════════════════════════════════════════════════
     Featured Photo — gentle ken-burns parallax tied to scroll position.
     ══════════════════════════════════════════════════════════════════ */

  function setupFeaturedParallax(galleryEl, strength) {
    var featured = galleryEl.querySelector('.gallery__featured');
    var img = featured && featured.querySelector('.gallery__featured-frame img');
    if (!img || !strength) {
      return null;
    }

    if (!('translate' in img.style)) {
      return null;
    }

    var ticking = false;
    var lastY = 0;

    function onScroll() {
      if (ticking) {
        return;
      }
      ticking = true;

      global.requestAnimationFrame(function () {
        ticking = false;

        var rect = featured.getBoundingClientRect();
        var vh = global.innerHeight || document.documentElement.clientHeight;

        if (rect.bottom < 0 || rect.top > vh) {
          return;
        }

        var center = rect.top + rect.height * 0.5;
        var progress = (center - vh * 0.5) / vh;
        var offset = progress * strength * -1;

        if (Math.abs(offset - lastY) < 0.25) {
          return;
        }
        lastY = offset;
        img.style.translate = '0 ' + offset.toFixed(2) + 'px';
      });
    }

    global.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return function cleanup() {
      global.removeEventListener('scroll', onScroll);
      img.style.translate = '';
    };
  }


  /* ══════════════════════════════════════════════════════════════════
     Polaroid Filmstrip — pointer-drag with windowed-fling momentum
     and auto-marquee.

     Why "windowed fling"?  The previous implementation tracked velocity
     with an exponential moving average that mixed in older samples,
     so a quick flick at release produced a damped, late-feeling glide.
     We now snapshot the user's finger position over the last
     `filmstripFlingWindowMs` (default 80 ms) and compute the *true*
     release velocity from those samples — the same technique used in
     iOS / Android scrollers, sometimes called inertial fling response.
     The strip therefore continues moving in step with the gesture as
     soon as the user lifts off, with no perceptible delay.
     ══════════════════════════════════════════════════════════════════ */

  function setupFilmstrip(galleryEl, config) {
    var strip = galleryEl.querySelector('.gallery__filmstrip');
    var track = strip && strip.querySelector('.gallery__filmstrip-track');
    if (!track || track.children.length === 0) {
      return null;
    }

    var pos = 0;            /* Current x offset (negative = scrolled right). */
    var velocity = 0;       /* Pixels per ~16ms frame.                       */
    var dragging = false;
    var pointerId = null;
    var lastClientX = 0;
    var lastClientY = 0;
    var startClientX = 0;
    var startClientY = 0;
    var moved = false;
    var rafId = null;
    var paused = false;
    var pauseTimerId = null;

    /* Recent move samples used to compute the user's actual flick
       velocity at the moment of release. */
    var samples = [];

    var DRAG_THRESHOLD = 4;

    var FLING_WINDOW_MS = (config.filmstripFlingWindowMs != null)
      ? config.filmstripFlingWindowMs
      : 80;
    var FRICTION = (config.filmstripFriction != null)
      ? config.filmstripFriction
      : 0.945;
    var RESUME_DELAY_MS = (config.filmstripResumeDelayMs != null)
      ? config.filmstripResumeDelayMs
      : 700;

    var autoSpeed = (config.filmstripAutoScrollSpeed != null)
      ? config.filmstripAutoScrollSpeed
      : 0.35;
    var autoEnabled = autoSpeed !== 0 && !prefersReducedMotion();

    function getMaxScroll() {
      return Math.max(0, track.scrollWidth - strip.clientWidth);
    }

    function applyTransform() {
      track.style.transform = 'translate3d(' + pos.toFixed(2) + 'px, 0, 0)';
    }

    function clamp(x) {
      var max = getMaxScroll();
      if (x > 0) { return 0; }
      if (x < -max) { return -max; }
      return x;
    }

    /* Render loop — auto-marquee drift + post-release inertial momentum.
       Drag updates apply directly inside `onPointerMove` for zero-frame
       latency; tick() handles only continuous motion. */
    function tick() {
      if (!dragging) {
        var changed = false;

        if (autoEnabled && !paused) {
          var max = getMaxScroll();
          if (max > 0) {
            pos -= autoSpeed;
            if (pos <= -max) {
              pos = -max;
              autoSpeed = -Math.abs(autoSpeed);
            } else if (pos >= 0) {
              pos = 0;
              autoSpeed = Math.abs(autoSpeed);
            }
            changed = true;
          }
        }

        if (Math.abs(velocity) > 0.05) {
          var next = pos + velocity;
          var clamped = clamp(next);
          /* Bleed off velocity instantly when we hit an edge so the
             strip doesn't keep "pushing" against the wall. */
          if (clamped !== next) {
            velocity = 0;
          } else {
            velocity *= FRICTION;
          }
          pos = clamped;
          changed = true;
        } else if (velocity !== 0) {
          velocity = 0;
        }

        if (changed) {
          applyTransform();
        }
      }
      rafId = global.requestAnimationFrame(tick);
    }

    function pushSample(x, ts) {
      samples.push({ x: x, ts: ts });
      /* Keep the buffer small — anything older than ~2× window is dead weight. */
      var cutoff = ts - FLING_WINDOW_MS * 2;
      while (samples.length > 2 && samples[0].ts < cutoff) {
        samples.shift();
      }
    }

    function computeReleaseVelocity() {
      if (samples.length < 2) {
        return 0;
      }
      var now = performance.now();
      /* Find the first sample within the fling window. */
      var startIdx = 0;
      for (var i = samples.length - 1; i >= 0; i--) {
        if (now - samples[i].ts > FLING_WINDOW_MS) {
          startIdx = i + 1;
          break;
        }
      }
      if (startIdx >= samples.length - 1) {
        startIdx = Math.max(0, samples.length - 2);
      }
      var first = samples[startIdx];
      var last  = samples[samples.length - 1];
      var dt = last.ts - first.ts;
      if (dt <= 4) {
        return 0;
      }
      /* px / ms  →  px per ~60fps frame. */
      return ((last.x - first.x) / dt) * 16;
    }

    function onPointerDown(e) {
      if (e.button != null && e.button !== 0 && e.pointerType === 'mouse') {
        return;
      }
      dragging = true;
      paused = true;
      velocity = 0;
      moved = false;
      pointerId = e.pointerId;
      startClientX = e.clientX;
      startClientY = e.clientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      samples.length = 0;
      pushSample(e.clientX, performance.now());
      try { track.setPointerCapture(e.pointerId); } catch (_) {}
    }

    function onPointerMove(e) {
      if (!dragging || (pointerId != null && e.pointerId !== pointerId)) {
        return;
      }

      var dx = e.clientX - lastClientX;
      var dy = e.clientY - lastClientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;

      if (!moved) {
        var totalX = e.clientX - startClientX;
        var totalY = e.clientY - startClientY;
        if (Math.abs(totalX) < DRAG_THRESHOLD && Math.abs(totalY) < DRAG_THRESHOLD) {
          return;
        }
        if (Math.abs(totalY) > Math.abs(totalX) * 1.4) {
          dragging = false;
          pointerId = null;
          try { track.releasePointerCapture(e.pointerId); } catch (_) {}
          return;
        }
        moved = true;
        track.classList.add('is-grabbing');
      }

      pushSample(e.clientX, performance.now());

      pos = clamp(pos + dx);
      applyTransform();

      if (e.cancelable) { e.preventDefault(); }
    }

    function endDrag(e) {
      if (!dragging || (e && pointerId != null && e.pointerId !== pointerId)) {
        return;
      }
      dragging = false;
      pointerId = null;
      moved = false;
      track.classList.remove('is-grabbing');

      try { if (e) { track.releasePointerCapture(e.pointerId); } } catch (_) {}

      /* True release velocity from the windowed sample buffer — this is
         what eliminates the "starts too late" feel of the previous EMA
         approach. Inertia continues seamlessly from the user's gesture. */
      velocity = computeReleaseVelocity();
      samples.length = 0;

      if (pauseTimerId) {
        global.clearTimeout(pauseTimerId);
      }
      pauseTimerId = global.setTimeout(function () {
        paused = false;
      }, RESUME_DELAY_MS);
    }

    /* Wheel events: support trackpad horizontal scroll natively, and
       translate shift-wheel into horizontal. We don't hijack regular
       vertical wheel — that belongs to the page. */
    function onWheel(e) {
      var dx = e.deltaX;
      if (Math.abs(dx) < 1 && e.shiftKey) {
        dx = e.deltaY;
      }
      if (Math.abs(dx) < 1) { return; }

      pos = clamp(pos - dx);
      paused = true;
      velocity = 0;
      applyTransform();

      e.preventDefault();

      if (pauseTimerId) { global.clearTimeout(pauseTimerId); }
      pauseTimerId = global.setTimeout(function () {
        paused = false;
      }, RESUME_DELAY_MS);
    }

    function onResize() {
      pos = clamp(pos);
      applyTransform();
    }

    var visibilityObs = new IntersectionObserver(function (entries) {
      paused = !entries[0].isIntersecting || dragging;
    }, { threshold: 0 });
    visibilityObs.observe(strip);

    track.addEventListener('pointerdown',   onPointerDown);
    track.addEventListener('pointermove',   onPointerMove);
    track.addEventListener('pointerup',     endDrag);
    track.addEventListener('pointercancel', endDrag);
    strip.addEventListener('wheel', onWheel, { passive: false });
    global.addEventListener('resize', onResize, { passive: true });

    if (global.matchMedia && global.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      strip.addEventListener('mouseenter', function () { paused = true; });
      strip.addEventListener('mouseleave', function () {
        if (!dragging) { paused = false; }
      });
    }

    rafId = global.requestAnimationFrame(tick);

    return function destroy() {
      if (rafId) { global.cancelAnimationFrame(rafId); }
      if (pauseTimerId) { global.clearTimeout(pauseTimerId); }
      visibilityObs.disconnect();
      track.removeEventListener('pointerdown',   onPointerDown);
      track.removeEventListener('pointermove',   onPointerMove);
      track.removeEventListener('pointerup',     endDrag);
      track.removeEventListener('pointercancel', endDrag);
      strip.removeEventListener('wheel', onWheel);
      global.removeEventListener('resize', onResize);
      track.style.transform = '';
    };
  }


  /* ══════════════════════════════════════════════════════════════════
     Lightbox — full-screen photo viewer
     Features: open/close, prev/next, keyboard, swipe, image preload,
     focus trap, body scroll lock, smooth fade-scale transitions.
     De-duplicates by source so a photo present in both the mosaic and
     the filmstrip only appears once in the lightbox sequence.
     ══════════════════════════════════════════════════════════════════ */

  function createLightbox(galleryEl) {
    var lb        = document.getElementById('galleryLightbox');
    if (!lb) { return null; }

    var stage     = lb.querySelector('.gallery-lightbox__stage');
    var imgEl     = lb.querySelector('.gallery-lightbox__image');
    var loaderEl  = lb.querySelector('.gallery-lightbox__loader');
    var counterEl = lb.querySelector('.gallery-lightbox__counter-current');
    var totalEl   = lb.querySelector('.gallery-lightbox__counter-total');
    var captionEl = lb.querySelector('.gallery-lightbox__caption');
    var closeBtn  = lb.querySelector('.gallery-lightbox__close');
    var prevBtn   = lb.querySelector('.gallery-lightbox__nav--prev');
    var nextBtn   = lb.querySelector('.gallery-lightbox__nav--next');

    /* Collect image sources, de-duplicated by URL. Each <img> still gets
       a stable `data-gallery-index` so clicking any instance opens at
       the correct lightbox slot. */
    var sources = [];
    var indexByKey = Object.create(null);
    var imgEls = galleryEl.querySelectorAll('img[data-gallery-src]');
    for (var i = 0; i < imgEls.length; i++) {
      var src = imgEls[i].getAttribute('data-gallery-src') || imgEls[i].src;
      var idx;
      if (Object.prototype.hasOwnProperty.call(indexByKey, src)) {
        idx = indexByKey[src];
      } else {
        idx = sources.length;
        sources.push({
          src: src,
          caption: imgEls[i].getAttribute('data-gallery-caption') || ''
        });
        indexByKey[src] = idx;
      }
      imgEls[i].setAttribute('data-gallery-index', String(idx));
    }

    if (totalEl) {
      totalEl.textContent = String(sources.length);
    }

    var index = 0;
    var isOpen = false;
    var lastFocused = null;
    var preloadCache = new Map();
    /* Tracks whether we pushed a history entry when opening the lightbox
       so we know whether to pop it back when closing programmatically. */
    var historyPushed = false;

    function onKey(e) {
      if (!isOpen) { return; }
      if (e.key === 'Escape')      { close();    e.preventDefault(); }
      else if (e.key === 'ArrowLeft')  { go(-1);  e.preventDefault(); }
      else if (e.key === 'ArrowRight') { go(+1);  e.preventDefault(); }
    }

    var touchStartX = 0;
    var touchStartY = 0;
    var touchTracking = false;
    var swipeThreshold = 50;

    /* Animate the current image off-screen in the swipe direction,
       then load the next photo. Replaces the previous behaviour where
       the image snapped back to the center on release before loading
       — which made the navigation look like the frame "jumped back". */
    function flyOutAndAdvance(navDir) {
      var stageWidth = (stage && stage.clientWidth) || global.innerWidth || 800;
      var exitX = -navDir * stageWidth * 0.55;

      imgEl.classList.remove('is-swiping');
      /* Inline transition overrides the long 0.55s default so the exit
         is brisk; it's cleared as soon as `show()` reasserts control. */
      imgEl.style.transition =
        'transform 0.22s cubic-bezier(0.45, 0.05, 0.55, 0.95),' +
        ' opacity 0.18s ease-out';
      imgEl.style.transform = 'translateX(' + exitX.toFixed(1) + 'px) scale(0.94)';
      imgEl.style.opacity = '0';

      global.setTimeout(function () {
        imgEl.style.transition = '';
        imgEl.style.transform = '';
        imgEl.style.opacity = '';
        go(navDir);
      }, 200);
    }

    function snapBackToCenter() {
      imgEl.classList.remove('is-swiping');
      imgEl.style.transform = '';
      imgEl.style.opacity = '';
    }

    function onTouchStart(e) {
      if (e.touches.length !== 1) { return; }
      touchTracking = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      imgEl.classList.add('is-swiping');
    }

    function onTouchMove(e) {
      if (!touchTracking || e.touches.length !== 1) { return; }
      var dx = e.touches[0].clientX - touchStartX;
      var dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dy) > Math.abs(dx) * 1.5) {
        return;
      }
      e.preventDefault();
      imgEl.style.transform = 'translateX(' + dx.toFixed(1) + 'px) scale(1)';
      imgEl.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 600));
    }

    function onTouchEnd(e) {
      if (!touchTracking) { return; }
      var endX = (e.changedTouches && e.changedTouches[0])
        ? e.changedTouches[0].clientX
        : touchStartX;
      var dx = endX - touchStartX;
      touchTracking = false;

      if (Math.abs(dx) > swipeThreshold && sources.length > 1) {
        flyOutAndAdvance(dx < 0 ? +1 : -1);
      } else {
        snapBackToCenter();
      }
    }

    var pointerDown = false;
    var pointerStartX = 0;

    function onPointerDownStage(e) {
      if (e.pointerType === 'touch') { return; }
      if (e.target !== imgEl) { return; }
      pointerDown = true;
      pointerStartX = e.clientX;
    }
    function onPointerUpStage(e) {
      if (!pointerDown) { return; }
      pointerDown = false;
      var dx = e.clientX - pointerStartX;
      if (Math.abs(dx) > swipeThreshold && sources.length > 1) {
        flyOutAndAdvance(dx < 0 ? +1 : -1);
      }
    }

    function onBackdropClick(e) {
      if (e.target === lb) {
        close();
      }
    }

    function preload(idx) {
      if (idx < 0 || idx >= sources.length) { return; }
      var src = sources[idx].src;
      if (preloadCache.has(src)) { return; }
      var preImg = new Image();
      preImg.src = src;
      preloadCache.set(src, preImg);
    }

    function show(idx) {
      if (sources.length === 0) { return; }
      idx = ((idx % sources.length) + sources.length) % sources.length;
      index = idx;

      var data = sources[idx];

      if (counterEl) { counterEl.textContent = String(idx + 1); }
      if (captionEl) { captionEl.textContent = data.caption || ''; }
      updateNav();

      lb.classList.add('is-loading');
      imgEl.classList.remove('is-loaded');

      var loaderImage = preloadCache.get(data.src) || new Image();
      preloadCache.set(data.src, loaderImage);

      var ready = function () {
        if (sources[index].src !== data.src) {
          return;
        }
        imgEl.src = data.src;
        imgEl.alt = data.caption || '';
        global.requestAnimationFrame(function () {
          imgEl.classList.add('is-loaded');
          lb.classList.remove('is-loading');
        });
      };

      if (loaderImage.complete && loaderImage.naturalWidth > 0) {
        ready();
      } else {
        loaderImage.onload  = ready;
        loaderImage.onerror = function () {
          lb.classList.remove('is-loading');
        };
        loaderImage.src = data.src;
      }

      preload(idx + 1);
      preload(idx - 1);
    }

    function updateNav() {
      if (sources.length <= 1) {
        if (prevBtn) { prevBtn.setAttribute('disabled', 'disabled'); }
        if (nextBtn) { nextBtn.setAttribute('disabled', 'disabled'); }
        return;
      }
      if (prevBtn) { prevBtn.removeAttribute('disabled'); }
      if (nextBtn) { nextBtn.removeAttribute('disabled'); }
    }

    function go(delta) {
      show(index + delta);
    }

    /* Browser back-button (and Android system back gesture) handler.
       Without this, pressing back while the lightbox is open closes the
       whole page. We push a transient history entry on open and treat
       any `popstate` while open as "user wants to close the modal". */
    function onPopState() {
      if (isOpen) {
        /* History entry was already popped by the navigation that
           triggered popstate, so we must not pop again in close(). */
        historyPushed = false;
        close();
      }
    }

    function open(idx) {
      if (isOpen) { show(idx); return; }
      isOpen = true;
      lastFocused = document.activeElement;

      lb.classList.add('is-open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.classList.add('gallery-lightbox-open');

      show(idx || 0);

      /* Push a history entry so the device's back button (and the
         browser's back arrow) closes the lightbox instead of leaving
         the page. The state object lets us recognise our own entry. */
      if (global.history && typeof global.history.pushState === 'function') {
        try {
          global.history.pushState({ weddingLightbox: true }, '');
          historyPushed = true;
        } catch (_) {
          historyPushed = false;
        }
      }

      global.setTimeout(function () {
        if (closeBtn && typeof closeBtn.focus === 'function') {
          closeBtn.focus({ preventScroll: true });
        }
      }, 80);

      document.addEventListener('keydown', onKey);
      stage.addEventListener('touchstart', onTouchStart, { passive: true });
      stage.addEventListener('touchmove',  onTouchMove,  { passive: false });
      stage.addEventListener('touchend',   onTouchEnd,   { passive: true });
      stage.addEventListener('pointerdown', onPointerDownStage);
      stage.addEventListener('pointerup',   onPointerUpStage);
      lb.addEventListener('click', onBackdropClick);
      global.addEventListener('popstate', onPopState);
    }

    function close() {
      if (!isOpen) { return; }
      isOpen = false;

      lb.classList.remove('is-open', 'is-loading');
      lb.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('gallery-lightbox-open');
      imgEl.classList.remove('is-loaded');
      /* Clear any inline styles left over from a swipe-in-progress so
         the next open() starts in a clean state. */
      imgEl.style.transition = '';
      imgEl.style.transform = '';
      imgEl.style.opacity = '';

      document.removeEventListener('keydown', onKey);
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove',  onTouchMove);
      stage.removeEventListener('touchend',   onTouchEnd);
      stage.removeEventListener('pointerdown', onPointerDownStage);
      stage.removeEventListener('pointerup',   onPointerUpStage);
      lb.removeEventListener('click', onBackdropClick);
      global.removeEventListener('popstate', onPopState);

      /* Pop our pushed entry so closing via the X button / Esc / backdrop
         click doesn't leave a stale entry in the browser history. When
         close() was invoked *because of* popstate, `historyPushed` is
         already false and we skip this. */
      if (historyPushed && global.history && typeof global.history.back === 'function') {
        historyPushed = false;
        try { global.history.back(); } catch (_) {}
      }

      if (lastFocused && typeof lastFocused.focus === 'function') {
        try { lastFocused.focus({ preventScroll: true }); } catch (_) {}
      }
    }

    if (closeBtn) { closeBtn.addEventListener('click', close); }
    if (prevBtn)  { prevBtn.addEventListener('click', function () { go(-1); }); }
    if (nextBtn)  { nextBtn.addEventListener('click', function () { go(+1); }); }

    function onTileClick(e) {
      var tile = e.currentTarget;
      var img = tile.matches && tile.matches('img[data-gallery-index]')
        ? tile
        : tile.querySelector && tile.querySelector('img[data-gallery-index]');
      if (!img) { return; }
      var idx = parseInt(img.getAttribute('data-gallery-index'), 10);
      if (!isNaN(idx)) {
        open(idx);
        e.preventDefault();
      }
    }

    var clickables = galleryEl.querySelectorAll(
      '.gallery__featured-frame, .gallery__tile, .gallery__polaroid-photo'
    );
    for (var c = 0; c < clickables.length; c++) {
      clickables[c].addEventListener('click', onTileClick);
      clickables[c].setAttribute('role', 'button');
      clickables[c].setAttribute('tabindex', '0');
    }

    function onTileKey(e) {
      if (e.key !== 'Enter' && e.key !== ' ') { return; }
      onTileClick(e);
    }

    for (var k = 0; k < clickables.length; k++) {
      clickables[k].addEventListener('keydown', onTileKey);
    }

    var viewAll = document.getElementById('galleryViewAll');
    if (viewAll) {
      viewAll.addEventListener('click', function () { open(0); });
    }

    return {
      open: open,
      close: close,
      destroy: function () {
        close();
        for (var c = 0; c < clickables.length; c++) {
          clickables[c].removeEventListener('click', onTileClick);
          clickables[c].removeEventListener('keydown', onTileKey);
        }
      }
    };
  }


  /* ══════════════════════════════════════════════════════════════════
     Static Fallback (reduced motion / no-JS graceful degradation)
     ══════════════════════════════════════════════════════════════════ */

  function showStatic(galleryEl) {
    galleryEl.classList.remove('gallery--animated');

    var elements = galleryEl.querySelectorAll('[data-reveal]');
    for (var i = 0; i < elements.length; i++) {
      elements[i].classList.add('is-visible');
      elements[i].style.opacity = '1';
      elements[i].style.transform = 'none';
    }

    var ornaments = galleryEl.querySelectorAll(
      '.gallery__top-ornament, .gallery__bottom-ornament'
    );
    for (var j = 0; j < ornaments.length; j++) {
      ornaments[j].classList.add('is-visible');
    }
  }


  /* ══════════════════════════════════════════════════════════════════
     Main Initialization
     ══════════════════════════════════════════════════════════════════ */

  function init() {
    var galleryEl = document.getElementById('gallery');
    if (!galleryEl) {
      return null;
    }

    var config = getConfig();

    /* Render photos from the data file FIRST so the lightbox, reveals
       and reduced-motion fallback all see real DOM. */
    renderGallery(galleryEl, config);

    var lightbox = createLightbox(galleryEl);

    if (prefersReducedMotion()) {
      showStatic(galleryEl);
      return {
        lightbox: lightbox,
        destroy: function () {
          if (lightbox) { lightbox.destroy(); }
        }
      };
    }

    galleryEl.classList.add('gallery--animated');

    var observer       = setupReveals(galleryEl, config);
    var destroyParall  = setupFeaturedParallax(galleryEl, config.parallaxStrength != null ? config.parallaxStrength : 18);
    var destroyStrip   = setupFilmstrip(galleryEl, config);

    var mq = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)');

    function onMotionChange(e) {
      if (!e.matches) { return; }
      showStatic(galleryEl);
      if (destroyParall) { destroyParall(); destroyParall = null; }
      if (destroyStrip)  { destroyStrip();  destroyStrip = null; }
    }

    if (mq) {
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onMotionChange);
      } else if (typeof mq.addListener === 'function') {
        mq.addListener(onMotionChange);
      }
    }

    return {
      lightbox: lightbox,
      destroy: function () {
        if (observer)      { observer.disconnect(); }
        if (destroyParall) { destroyParall(); }
        if (destroyStrip)  { destroyStrip(); }
        if (lightbox)      { lightbox.destroy(); }
        if (mq) {
          if (typeof mq.removeEventListener === 'function') {
            mq.removeEventListener('change', onMotionChange);
          } else if (typeof mq.removeListener === 'function') {
            mq.removeListener(onMotionChange);
          }
        }
      }
    };
  }


  /* ── Public API ──────────────────────────────────────────────────── */

  app.initGallery = init;

  document.addEventListener('DOMContentLoaded', function () {
    app.galleryController = init();
  });

})(window);
