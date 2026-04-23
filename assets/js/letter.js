(function (global) {
  'use strict';

  var app = global.WeddingInvitation = global.WeddingInvitation || {};

  function getConfig() {
    return (global.WeddingConfig && global.WeddingConfig.letter) || {};
  }

  function prefersReducedMotion() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ── Character wrapping (matches hero-animations.js pattern) ─────── */

  function wrapChars(el) {
    if (!el) {
      return { line: null, chars: [] };
    }

    if (el.dataset.charsWrapped === '1') {
      return {
        line: el.querySelector('.chars-line'),
        chars: Array.from(el.querySelectorAll('.char-wrap > span'))
      };
    }

    var text = el.textContent || '';
    el.innerHTML = '';
    el.dataset.charsWrapped = '1';

    var line = document.createElement('span');
    line.className = 'chars-line';

    var chars = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var outer = document.createElement('span');
      outer.className = 'char-wrap';

      var inner = document.createElement('span');
      inner.textContent = ch === ' ' ? '\u00A0' : ch;

      outer.appendChild(inner);
      line.appendChild(outer);
      chars.push(inner);
    }

    el.appendChild(line);
    return { line: line, chars: chars };
  }

  /* ── Reveal: title characters via GSAP ───────────────────────────── */

  function revealChars(el, config) {
    var staggerSec = ((config.charStaggerMs != null ? config.charStaggerMs : 55) / 1000);
    var wrapped = wrapChars(el);

    if (!wrapped.chars.length) {
      el.style.opacity = '1';
      return;
    }

    if (!global.gsap) {
      for (var i = 0; i < wrapped.chars.length; i++) {
        wrapped.chars[i].style.opacity = '1';
        wrapped.chars[i].style.transform = 'none';
      }
      return;
    }

    global.gsap.set(wrapped.chars, {
      opacity: 0,
      y: 28,
      rotateX: 50,
      transformPerspective: 500,
      transformOrigin: '50% 100%',
      force3D: true
    });

    global.gsap.to(wrapped.chars, {
      opacity: 1,
      y: 0,
      rotateX: 0,
      duration: 0.85,
      stagger: { each: staggerSec, from: 'center' },
      ease: 'power3.out'
    });
  }

  /* ── Reveal: staggered children ──────────────────────────────────── */

  function revealStagger(parentEl, config) {
    var items = parentEl.querySelectorAll('[data-reveal-item]');
    if (!items.length) {
      return;
    }

    var delayMs;
    if (parentEl.classList.contains('letter__message')) {
      delayMs = config.messageStaggerMs != null ? config.messageStaggerMs : 160;
    } else if (parentEl.classList.contains('letter__family')) {
      delayMs = config.familyStaggerMs != null ? config.familyStaggerMs : 180;
    } else {
      delayMs = 160;
    }

    for (var i = 0; i < items.length; i++) {
      (function (item, delay) {
        global.setTimeout(function () {
          item.classList.add('is-visible');
        }, delay);
      })(items[i], i * delayMs);
    }
  }

  /* ── Photo parallax ──────────────────────────────────────────────── */

  function setupParallax(letterEl, strength) {
    var img = letterEl.querySelector('.letter__photo-inner img');
    if (!img) {
      return null;
    }

    var ticking = false;

    function onScroll() {
      if (ticking) {
        return;
      }
      ticking = true;

      global.requestAnimationFrame(function () {
        ticking = false;

        var photo = img.closest('.letter__photo');
        if (!photo) {
          return;
        }

        var rect = photo.getBoundingClientRect();
        var vh = global.innerHeight || document.documentElement.clientHeight;

        if (rect.bottom < 0 || rect.top > vh) {
          return;
        }

        var center = rect.top + rect.height * 0.5;
        var progress = (center - vh * 0.5) / vh;
        var offset = progress * strength * -1;

        img.style.transform = 'translateY(' + offset.toFixed(2) + 'px) scale(1.06)';
      });
    }

    global.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return function cleanup() {
      global.removeEventListener('scroll', onScroll);
      img.style.transform = '';
    };
  }


  /* ── Static fallback (reduced motion / no-JS graceful degradation) ─ */

  function showStatic(letterEl) {
    letterEl.classList.remove('letter--animated');

    var elements = letterEl.querySelectorAll('[data-reveal], [data-reveal-item]');
    for (var i = 0; i < elements.length; i++) {
      elements[i].classList.add('is-visible');
      elements[i].style.opacity = '1';
      elements[i].style.transform = 'none';
    }

    var ornaments = letterEl.querySelectorAll('.letter__ornament');
    for (var j = 0; j < ornaments.length; j++) {
      ornaments[j].classList.add('is-drawn');
    }

    var borderFrame = letterEl.querySelector('.letter__border-frame');
    if (borderFrame) {
      borderFrame.classList.add('is-visible');
    }

    var chars = letterEl.querySelectorAll('.char-wrap > span');
    for (var k = 0; k < chars.length; k++) {
      chars[k].style.opacity = '1';
      chars[k].style.transform = 'none';
    }
  }

  /* ── Main initialization ─────────────────────────────────────────── */

  function init() {
    var letterEl = document.getElementById('letter');
    if (!letterEl) {
      return null;
    }

    if (prefersReducedMotion()) {
      showStatic(letterEl);
      return null;
    }

    var config = getConfig();

    letterEl.classList.add('letter--animated');

    var titleEl = document.getElementById('letterTitle');
    if (titleEl) {
      wrapChars(titleEl);
    }

    var rootMargin = config.rootMargin || '0px 0px -12% 0px';
    var threshold = (config.threshold != null) ? config.threshold : 0.12;

    /* Main reveal observer */
    var revealObserver = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) {
          continue;
        }

        var el = entries[i].target;

        switch (el.dataset.reveal) {
          case 'fade-up':
            el.classList.add('is-visible');
            break;
          case 'chars':
            revealChars(el, config);
            break;
          case 'divider':
            el.classList.add('is-visible');
            break;
          case 'stagger':
            revealStagger(el, config);
            break;
          case 'photo':
            el.classList.add('is-visible');
            break;
          default:
            el.classList.add('is-visible');
        }

        revealObserver.unobserve(el);
      }
    }, { rootMargin: rootMargin, threshold: threshold });

    /* Ornament + border observer (triggers slightly earlier for a seamless feel) */
    var ornamentObserver = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) {
          continue;
        }
        entries[i].target.classList.add(
          entries[i].target.classList.contains('letter__border-frame') ? 'is-visible' : 'is-drawn'
        );
        ornamentObserver.unobserve(entries[i].target);
      }
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.05 });

    /* Observe all [data-reveal] elements */
    var reveals = letterEl.querySelectorAll('[data-reveal]');
    for (var i = 0; i < reveals.length; i++) {
      revealObserver.observe(reveals[i]);
    }

    /* Observe ornaments */
    var ornaments = letterEl.querySelectorAll('.letter__ornament');
    for (var j = 0; j < ornaments.length; j++) {
      ornamentObserver.observe(ornaments[j]);
    }

    /* Observe border frame */
    var borderFrame = letterEl.querySelector('.letter__border-frame');
    if (borderFrame) {
      ornamentObserver.observe(borderFrame);
    }

    /* Photo parallax */
    var parallaxStrength = (config.photoParallaxStrength != null)
      ? config.photoParallaxStrength
      : 24;
    var destroyParallax = null;

    if (parallaxStrength > 0) {
      destroyParallax = setupParallax(letterEl, parallaxStrength);
    }

    /* Listen for runtime reduced-motion changes */
    var mq = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)');

    function onMotionChange(e) {
      if (!e.matches) {
        return;
      }
      showStatic(letterEl);
      if (destroyParallax) {
        destroyParallax();
        destroyParallax = null;
      }
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
        revealObserver.disconnect();
        ornamentObserver.disconnect();
        if (destroyParallax) {
          destroyParallax();
        }
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

  app.initLetter = init;

  document.addEventListener('DOMContentLoaded', function () {
    app.letterController = init();
  });
})(window);
