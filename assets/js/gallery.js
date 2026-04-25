// assets/js/gallery.js
(function (global) {
  'use strict';

  var app = global.WeddingInvitation = global.WeddingInvitation || {};

  function getConfig() {
    return (global.WeddingConfig && global.WeddingConfig.gallery) || {};
  }

  function prefersReducedMotion() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
     Holds together with the existing letter parallax pattern.
     ══════════════════════════════════════════════════════════════════ */

  function setupFeaturedParallax(galleryEl, strength) {
    var featured = galleryEl.querySelector('.gallery__featured');
    var img = featured && featured.querySelector('.gallery__featured-frame img');
    if (!img || !strength) {
      return null;
    }

    /* Confirm the browser supports individual `translate` so the parallax
       won't override the CSS-driven `scale` reveal. If not, skip parallax —
       the static reveal alone still looks elegant. */
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
     Polaroid Filmstrip — pointer-drag with momentum + auto-marquee.
     Matches native scroll wheel behaviour but stays inside the strip.
     ══════════════════════════════════════════════════════════════════ */

  function setupFilmstrip(galleryEl, config) {
    var strip = galleryEl.querySelector('.gallery__filmstrip');
    var track = strip && strip.querySelector('.gallery__filmstrip-track');
    if (!track) {
      return null;
    }

    var pos = 0;            /* Current x offset (negative = scrolled right). */
    var velocity = 0;       /* Pixels per frame at 60fps. */
    var dragging = false;
    var pointerId = null;
    var lastClientX = 0;
    var lastDt = 0;
    var lastMoveTs = 0;
    var rafId = null;
    var paused = false;     /* Pauses auto-marquee while user interacts. */
    var pauseTimerId = null;

    var autoSpeed = (config.filmstripAutoScrollSpeed != null)
      ? config.filmstripAutoScrollSpeed
      : 0.35;
    var autoEnabled = autoSpeed !== 0 && !prefersReducedMotion();

    function getMaxScroll() {
      var trackWidth = track.scrollWidth;
      var stripWidth = strip.clientWidth;
      return Math.max(0, trackWidth - stripWidth);
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

    function tick() {
      if (dragging) {
        rafId = global.requestAnimationFrame(tick);
        return;
      }

      /* Auto-marquee — drift slowly leftwards, bounce at the edge. */
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
        }
      } else if (Math.abs(velocity) > 0.05) {
        /* User-induced momentum (after pointer up). */
        pos = clamp(pos + velocity);
        velocity *= 0.92;
      }

      applyTransform();
      rafId = global.requestAnimationFrame(tick);
    }

    function onPointerDown(e) {
      if (e.button != null && e.button !== 0 && e.pointerType === 'mouse') {
        return;
      }
      dragging = true;
      paused = true;
      velocity = 0;
      pointerId = e.pointerId;
      lastClientX = e.clientX;
      lastMoveTs = performance.now();
      track.classList.add('is-grabbing');
      try { track.setPointerCapture(e.pointerId); } catch (_) {}
    }

    function onPointerMove(e) {
      if (!dragging || (pointerId != null && e.pointerId !== pointerId)) {
        return;
      }
      var dx = e.clientX - lastClientX;
      lastClientX = e.clientX;

      var now = performance.now();
      lastDt = Math.max(1, now - lastMoveTs);
      lastMoveTs = now;

      pos = clamp(pos + dx);
      velocity = dx / Math.max(1, lastDt) * 16;  /* ~60fps target */

      e.preventDefault();
    }

    function endDrag(e) {
      if (!dragging || (e && pointerId != null && e.pointerId !== pointerId)) {
        return;
      }
      dragging = false;
      pointerId = null;
      track.classList.remove('is-grabbing');

      /* Resume auto-marquee after a short idle pause. */
      if (pauseTimerId) {
        global.clearTimeout(pauseTimerId);
      }
      pauseTimerId = global.setTimeout(function () {
        paused = false;
      }, 2200);
    }

    /* Wheel events: translate vertical wheel into horizontal scroll
       only when the user is actually dragging vertically while their
       cursor is over the strip. We avoid hijacking the page's normal
       scroll behaviour. Holding shift converts wheel-y to wheel-x. */

    function onWheel(e) {
      var dx = e.deltaX;
      if (Math.abs(dx) < 1 && e.shiftKey) {
        dx = e.deltaY;
      }
      if (Math.abs(dx) < 1) { return; }

      pos = clamp(pos - dx);
      paused = true;
      velocity = 0;

      e.preventDefault();

      if (pauseTimerId) { global.clearTimeout(pauseTimerId); }
      pauseTimerId = global.setTimeout(function () {
        paused = false;
      }, 2200);
    }

    /* Resize keeps clamp valid. */
    function onResize() {
      pos = clamp(pos);
      applyTransform();
    }

    /* Pause auto-marquee when the strip is off-screen — saves CPU. */
    var visibilityObs = new IntersectionObserver(function (entries) {
      paused = !entries[0].isIntersecting || dragging;
    }, { threshold: 0 });
    visibilityObs.observe(strip);

    track.addEventListener('pointerdown',  onPointerDown);
    track.addEventListener('pointermove',  onPointerMove);
    track.addEventListener('pointerup',    endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('pointerleave', endDrag);
    strip.addEventListener('wheel', onWheel, { passive: false });
    global.addEventListener('resize', onResize, { passive: true });

    /* Pause when hovered with a mouse (pointer fine + hover supported). */
    if (global.matchMedia && global.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      strip.addEventListener('mouseenter', function () { paused = true; });
      strip.addEventListener('mouseleave', function () { paused = false; });
    }

    rafId = global.requestAnimationFrame(tick);

    return function destroy() {
      if (rafId) { global.cancelAnimationFrame(rafId); }
      if (pauseTimerId) { global.clearTimeout(pauseTimerId); }
      visibilityObs.disconnect();
      track.removeEventListener('pointerdown',  onPointerDown);
      track.removeEventListener('pointermove',  onPointerMove);
      track.removeEventListener('pointerup',    endDrag);
      track.removeEventListener('pointercancel', endDrag);
      track.removeEventListener('pointerleave', endDrag);
      strip.removeEventListener('wheel', onWheel);
      global.removeEventListener('resize', onResize);
      track.style.transform = '';
    };
  }


  /* ══════════════════════════════════════════════════════════════════
     Lightbox — full-screen photo viewer
     Features: open/close, prev/next, keyboard, swipe, image preload,
     focus trap, body scroll lock, smooth fade-scale transitions.
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

    /* Collect all image sources from the gallery in DOM order. */
    var sources = [];
    var imgEls = galleryEl.querySelectorAll('img[data-gallery-src]');
    for (var i = 0; i < imgEls.length; i++) {
      sources.push({
        src: imgEls[i].getAttribute('data-gallery-src') || imgEls[i].src,
        caption: imgEls[i].getAttribute('data-gallery-caption') || ''
      });
      imgEls[i].setAttribute('data-gallery-index', String(i));
    }

    if (totalEl) {
      totalEl.textContent = String(sources.length);
    }

    var index = 0;
    var isOpen = false;
    var lastFocused = null;
    var preloadCache = new Map();

    /* ── Keyboard handlers ───────────────────────────────────────── */

    function onKey(e) {
      if (!isOpen) { return; }
      if (e.key === 'Escape')      { close();    e.preventDefault(); }
      else if (e.key === 'ArrowLeft')  { go(-1);  e.preventDefault(); }
      else if (e.key === 'ArrowRight') { go(+1);  e.preventDefault(); }
    }

    /* ── Touch swipe ─────────────────────────────────────────────── */

    var touchStartX = 0;
    var touchStartY = 0;
    var touchTracking = false;
    var swipeThreshold = 50;

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
      imgEl.classList.remove('is-swiping');
      imgEl.style.transform = '';
      imgEl.style.opacity = '';

      if (Math.abs(dx) > swipeThreshold) {
        go(dx < 0 ? +1 : -1);
      }
    }

    /* ── Pointer-drag swipe (for desktop mouse) ──────────────────── */

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
      if (Math.abs(dx) > swipeThreshold) {
        go(dx < 0 ? +1 : -1);
      }
    }

    /* ── Backdrop click closes ───────────────────────────────────── */

    function onBackdropClick(e) {
      if (e.target === lb) {
        close();
      }
    }

    /* ── Image loading ───────────────────────────────────────────── */

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
        /* Force a frame so the transition restarts cleanly. */
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
      /* Wrap-around enabled — never disable. */
      if (prevBtn) { prevBtn.removeAttribute('disabled'); }
      if (nextBtn) { nextBtn.removeAttribute('disabled'); }
    }

    function go(delta) {
      show(index + delta);
    }

    /* ── Open / Close ────────────────────────────────────────────── */

    function open(idx) {
      if (isOpen) { show(idx); return; }
      isOpen = true;
      lastFocused = document.activeElement;

      lb.classList.add('is-open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.classList.add('gallery-lightbox-open');

      show(idx || 0);

      /* Move focus into the dialog after the open transition. */
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
    }

    function close() {
      if (!isOpen) { return; }
      isOpen = false;

      lb.classList.remove('is-open', 'is-loading');
      lb.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('gallery-lightbox-open');
      imgEl.classList.remove('is-loaded');

      document.removeEventListener('keydown', onKey);
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove',  onTouchMove);
      stage.removeEventListener('touchend',   onTouchEnd);
      stage.removeEventListener('pointerdown', onPointerDownStage);
      stage.removeEventListener('pointerup',   onPointerUpStage);
      lb.removeEventListener('click', onBackdropClick);

      /* Restore focus to the launcher. */
      if (lastFocused && typeof lastFocused.focus === 'function') {
        try { lastFocused.focus({ preventScroll: true }); } catch (_) {}
      }
    }

    /* ── Wire up controls ────────────────────────────────────────── */

    if (closeBtn) { closeBtn.addEventListener('click', close); }
    if (prevBtn)  { prevBtn.addEventListener('click', function () { go(-1); }); }
    if (nextBtn)  { nextBtn.addEventListener('click', function () { go(+1); }); }

    /* Click any gallery image to open at its index. */
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

    /* Keyboard activation on tiles (Enter/Space). */
    function onTileKey(e) {
      if (e.key !== 'Enter' && e.key !== ' ') { return; }
      onTileClick(e);
    }

    for (var k = 0; k < clickables.length; k++) {
      clickables[k].addEventListener('keydown', onTileKey);
    }

    /* "View all" CTA opens at index 0. */
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

    /* Lightbox is always wired up (works fine with reduced motion). */
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

    /* Listen for runtime reduced-motion changes. */
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
