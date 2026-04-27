// assets/js/location.js
//
// Section 05 · Location (오시는 길)
// ────────────────────────────────────────────────────────────────────────
// Responsibilities:
//   1. Hydrate the editorial header (eyebrow + script title + venue +
//      addresses + tel) from `WeddingConfig.location.venue`.
//   2. Wire the four action chips:
//        · 주소 복사   — clipboard with execCommand → prompt fallback
//        · 카카오맵    — kakao map deep-link
//        · 네이버지도  — naver map deep-link
//        · 티맵        — tmap:// deep-link with install fallback
//   3. IntersectionObserver-driven `.is-visible` reveals + a static
//      fallback for `prefers-reduced-motion`.
//
// Notes on the embedded Kakao RoughMap:
//   The map is rendered inline in index.html via the official Kakao
//   roughmap loader (`roughmapLoader.js`) and an inline synchronous
//   `new daum.roughmap.Lander(...).render()` call. Both must execute
//   during *initial document parsing* because the loader uses
//   `document.write` to inject its dependency chain — that primitive is
//   blocked once DOMContentLoaded fires. Therefore this module
//   intentionally does NOT load the loader nor call `.render()` itself.

(function (global) {
  'use strict';

  var app = global.WeddingInvitation = global.WeddingInvitation || {};

  function getConfig() {
    return (global.WeddingConfig && global.WeddingConfig.location) || {};
  }

  function prefersReducedMotion() {
    return global.matchMedia &&
           global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function setText(node, text) {
    if (node && text != null) {
      node.textContent = text;
    }
  }


  /* ══════════════════════════════════════════════════════════════════
     Header hydration (venue → DOM)
     ══════════════════════════════════════════════════════════════════ */

  function populateVenue(locationEl, config) {
    var venue = (config && config.venue) || {};

    setText(locationEl.querySelector('[data-loc-slot="venue-name"]'), venue.name || '');
    setText(locationEl.querySelector('[data-loc-slot="venue-kor"]'),  venue.nameKor || '크레스트 72');
    setText(locationEl.querySelector('[data-loc-slot="venue-hall"]'), venue.hall || '');
    setText(locationEl.querySelector('[data-loc-slot="addr-road"]'),  venue.addressRoad || '');
    setText(locationEl.querySelector('[data-loc-slot="addr-sub"]'),   venue.landmark || '');

    var telLink    = locationEl.querySelector('[data-loc-slot="tel-link"]');
    var telDisplay = locationEl.querySelector('[data-loc-slot="tel-display"]');
    if (telLink && venue.tel) {
      telLink.setAttribute('href', 'tel:' + String(venue.tel).replace(/[^\d+]/g, ''));
    }
    setText(telDisplay, venue.tel || '');
  }


  /* ══════════════════════════════════════════════════════════════════
     Map-app deep links — Kakao / Naver / Tmap
     ══════════════════════════════════════════════════════════════════ */

  function buildMapUrls(venue) {
    var name = encodeURIComponent(venue.name || '');
    var lat = venue.lat;
    var lng = venue.lng;
    return {
      // `link/to/<name>,<lat>,<lng>` opens directions inside Kakao Map.
      kakaoRoute: 'https://map.kakao.com/link/to/'  + name + ',' + lat + ',' + lng,
      // Naver's web-walking-directions URL with `destination` pinned.
      naverRoute: 'https://map.naver.com/p/directions/-/-/-/-/walk?destination=' +
                  name + ',' + lat + ',' + lng,
      // Tmap: deep-link first, fallback to the install short-URL.
      tmapDeep:    'tmap://route?goalname=' + name + '&goalx=' + lng + '&goaly=' + lat,
      tmapInstall: 'https://surl.tmobiapi.com/3a839f5a'
    };
  }

  function attachExternalLink(btn, href) {
    if (!btn) { return; }
    btn.setAttribute('href', href);
    btn.setAttribute('target', '_blank');
    btn.setAttribute('rel', 'noopener noreferrer');
  }

  function isMobile() {
    return /android|iphone|ipad|ipod|mobile/i.test(global.navigator.userAgent || '');
  }

  function attachTmapButton(btn, urls) {
    if (!btn) { return; }
    btn.setAttribute('href', urls.tmapInstall);
    btn.setAttribute('target', '_blank');
    btn.setAttribute('rel', 'noopener noreferrer');

    btn.addEventListener('click', function (e) {
      if (!isMobile()) { return; }
      e.preventDefault();

      // Try the deep link; if the OS doesn't switch apps within 1.5s
      // we assume Tmap isn't installed and route the user to the
      // store install page instead.
      var fallbackTimer = global.setTimeout(function () {
        global.location.href = urls.tmapInstall;
      }, 1500);
      var cancel = function () { global.clearTimeout(fallbackTimer); };
      global.addEventListener('pagehide', cancel, { once: true });
      global.addEventListener('blur', cancel, { once: true });

      global.location.href = urls.tmapDeep;
    });
  }


  /* ══════════════════════════════════════════════════════════════════
     주소 복사 — clipboard with progressive fallback
     ══════════════════════════════════════════════════════════════════ */

  function copyToClipboard(text) {
    if (!text) {
      return Promise.reject(new Error('empty'));
    }
    if (global.navigator && global.navigator.clipboard &&
        typeof global.navigator.clipboard.writeText === 'function') {
      return global.navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        ta.style.pointerEvents = 'none';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        var ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('execCommand copy failed'));
      } catch (err) {
        reject(err);
      }
    });
  }

  function setupCopyButton(locationEl, config) {
    var btn = locationEl.querySelector('[data-loc-action="copy"]');
    if (!btn) { return null; }

    var toast = document.getElementById('locationToast');
    var toastMs = (config && config.copyToastMs) || 2200;
    var toastTimerId = null;

    function showToast(text) {
      if (!toast) { return; }
      var label = toast.querySelector('.location-toast__text');
      if (label && text) { label.textContent = text; }
      toast.setAttribute('aria-hidden', 'false');
      toast.classList.add('is-visible');
      if (toastTimerId) { global.clearTimeout(toastTimerId); }
      toastTimerId = global.setTimeout(function () {
        toast.classList.remove('is-visible');
        toast.setAttribute('aria-hidden', 'true');
      }, toastMs);
    }

    btn.addEventListener('click', function () {
      var venue = (config && config.venue) || {};
      var addr = venue.addressRoad || '';
      if (venue.name) {
        addr += (addr ? ' / ' : '') + venue.name +
                (venue.hall ? ' ' + venue.hall : '');
      }
      copyToClipboard(addr).then(function () {
        btn.classList.add('is-copied');
        showToast('주소가 복사되었습니다');
        global.setTimeout(function () {
          btn.classList.remove('is-copied');
        }, toastMs);
      }).catch(function () {
        try { global.prompt('아래 주소를 복사하세요', addr); } catch (_) {}
      });
    });

    return btn;
  }


  /* ══════════════════════════════════════════════════════════════════
     Scroll-Reveal Animations + Static Fallback
     ══════════════════════════════════════════════════════════════════ */

  function setupReveals(locationEl, config) {
    var rootMargin = (config && config.rootMargin) || '0px 0px -10% 0px';
    var threshold  = (config && config.threshold != null) ? config.threshold : 0.12;

    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) { continue; }
        entries[i].target.classList.add('is-visible');
        observer.unobserve(entries[i].target);
      }
    }, { rootMargin: rootMargin, threshold: threshold });

    var reveals = locationEl.querySelectorAll('[data-reveal]');
    for (var i = 0; i < reveals.length; i++) {
      observer.observe(reveals[i]);
    }
    return observer;
  }

  function showStatic(locationEl) {
    locationEl.classList.remove('location--animated');
    var elements = locationEl.querySelectorAll('[data-reveal]');
    for (var i = 0; i < elements.length; i++) {
      elements[i].classList.add('is-visible');
      elements[i].style.opacity = '1';
      elements[i].style.transform = 'none';
    }
  }


  /* ══════════════════════════════════════════════════════════════════
     Main Initialization
     ══════════════════════════════════════════════════════════════════ */

  function init() {
    var locationEl = document.getElementById('location');
    if (!locationEl) {
      return null;
    }

    var config = getConfig();
    var venue  = (config && config.venue) || {};

    populateVenue(locationEl, config);

    var urls = buildMapUrls(venue);
    attachExternalLink(locationEl.querySelector('[data-loc-navi="kakao"]'), urls.kakaoRoute);
    attachExternalLink(locationEl.querySelector('[data-loc-navi="naver"]'), urls.naverRoute);
    attachTmapButton(locationEl.querySelector('[data-loc-navi="tmap"]'), urls);

    setupCopyButton(locationEl, config);

    if (prefersReducedMotion()) {
      showStatic(locationEl);
      return { destroy: function () {} };
    }

    locationEl.classList.add('location--animated');
    var observer = setupReveals(locationEl, config);

    var mq = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)');
    function onMotionChange(e) {
      if (!e.matches) { return; }
      showStatic(locationEl);
    }
    if (mq) {
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onMotionChange);
      } else if (typeof mq.addListener === 'function') {
        mq.addListener(onMotionChange);
      }
    }

    return {
      destroy: function () {
        if (observer) { observer.disconnect(); }
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

  app.initLocation = init;

  document.addEventListener('DOMContentLoaded', function () {
    app.locationController = init();
  });

})(window);
