(function (global) {
  const app = global.WeddingInvitation = global.WeddingInvitation || {};

  const DEFAULT_OVERLAY_BEFORE = { y0: 0.78, y35: 0.62, y60: 0.48, y100: 0.42 };
  const DEFAULT_OVERLAY_AFTER = { y0: 0.54, y35: 0.42, y60: 0.30, y100: 0.24 };
  const HERO_TEXT_IDS = ['theWedding', 'nameGroom', 'ampersand', 'nameBride', 'koreanNames', 'weddingDate', 'weddingVenue'];

  function normalizeOverlayStops(stops, fallback) {
    const source = stops || {};
    const base = fallback || {};

    function read(name) {
      const value = source[name];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      return base[name];
    }

    return {
      y0: read('y0'),
      y35: read('y35'),
      y60: read('y60'),
      y100: read('y100')
    };
  }

  function wrapChars(el) {
    if (!el) {
      return { line: null, chars: [] };
    }

    if (el.dataset.charsWrapped === '1') {
      const line = el.querySelector('.chars-line');
      return {
        line: line || el,
        chars: Array.from(el.querySelectorAll('.char-wrap > span'))
      };
    }

    const text = el.textContent || '';
    el.innerHTML = '';
    el.style.opacity = '1';
    el.dataset.charsWrapped = '1';

    const line = document.createElement('span');
    line.className = 'chars-line';

    const chars = [];
    for (const ch of text) {
      const outer = document.createElement('span');
      outer.className = 'char-wrap';

      const inner = document.createElement('span');
      inner.textContent = ch === ' ' ? '\u00A0' : ch;
      outer.appendChild(inner);
      line.appendChild(outer);
      chars.push(inner);
    }

    el.appendChild(line);
    return { line: line, chars: chars };
  }

  function unwrapChars(el) {
    if (!el || el.dataset.charsWrapped !== '1') {
      return;
    }

    const chars = Array.from(el.querySelectorAll('.char-wrap > span'));
    if (!chars.length) {
      el.dataset.charsWrapped = '0';
      return;
    }

    const text = chars.map(function (charEl) {
      return charEl.textContent === '\u00A0' ? ' ' : (charEl.textContent || '');
    }).join('');

    el.textContent = text;
    el.dataset.charsWrapped = '0';
  }

  function animateTextLine(tl, el, startAt, options) {
    const wrapped = wrapChars(el);
    if (!wrapped.chars.length || !wrapped.line) {
      return;
    }

    const chars = wrapped.chars;
    const lineConfig = options || {};
    const charYRange = lineConfig.charYRange ?? 100;
    const charDuration = lineConfig.charDuration ?? 1.75;
    const charEase = lineConfig.charEase || 'power4.inOut';
    const staggerEach = lineConfig.staggerEach ?? 0.01;
    const staggerFrom = lineConfig.staggerFrom || 'center';
    const rotationX = lineConfig.rotationX ?? 70;
    const transformPerspective = lineConfig.transformPerspective ?? 600;
    const transformOrigin = lineConfig.transformOrigin || '50% 50% -50px';

    global.gsap.set(chars, {
      opacity: 0,
      rotationX: rotationX,
      transformPerspective: transformPerspective,
      transformOrigin: transformOrigin,
      force3D: true,
      y: function () {
        return global.gsap.utils.random(-charYRange, charYRange);
      }
    });

    tl.to(chars, {
      y: 0,
      rotationX: 0,
      opacity: 1,
      duration: charDuration,
      stagger: { each: staggerEach, from: staggerFrom },
      ease: charEase
    }, startAt);
  }

  function animateElementsFade(tl, elements, startAt, options) {
    const targets = elements.filter(Boolean);
    if (!targets.length) {
      return;
    }

    const fadeConfig = options || {};

    global.gsap.set(targets, {
      opacity: 0
    });

    tl.to(targets, {
      opacity: 1,
      duration: fadeConfig.duration ?? 1.2,
      ease: fadeConfig.ease || 'power2.out'
    }, startAt);
  }

  app.showStaticHero = function showStaticHero() {
    document.documentElement.classList.remove('enhanced-motion');

    for (let i = 0; i < HERO_TEXT_IDS.length; i++) {
      const el = document.getElementById(HERO_TEXT_IDS[i]);
      if (!el) {
        continue;
      }

      unwrapChars(el);
      el.style.opacity = '1';
      el.style.visibility = 'visible';
    }

    const titleGroup = document.querySelector('.hero__title-group');
    if (titleGroup) {
      titleGroup.style.opacity = '1';
      titleGroup.style.visibility = 'visible';
      titleGroup.style.transform = '';
    }

    const arrow = document.getElementById('scrollArrow');
    if (arrow) {
      arrow.classList.remove('visible');
      arrow.style.opacity = '1';
      arrow.style.transform = 'translateX(-50%)';
    }

    const overlay = document.querySelector('.hero__overlay');
    if (overlay) {
      const animation = (global.WeddingConfig && global.WeddingConfig.animation) || {};
      const overlayConfig = animation.overlay || {};
      const overlayAfter = normalizeOverlayStops(overlayConfig.after, DEFAULT_OVERLAY_AFTER);

      overlay.style.setProperty('--overlay-y0', String(overlayAfter.y0));
      overlay.style.setProperty('--overlay-y35', String(overlayAfter.y35));
      overlay.style.setProperty('--overlay-y60', String(overlayAfter.y60));
      overlay.style.setProperty('--overlay-y100', String(overlayAfter.y100));
      overlay.style.opacity = '1';
    }
  };

  app.initHeroAnimations = function initHeroAnimations() {
    if (!global.gsap) {
      console.error('GSAP is required for hero animations.');
      return false;
    }

    try {
      const animation = (global.WeddingConfig && global.WeddingConfig.animation) || {};
      const starts = animation.starts || {};
      const timeline = global.gsap.timeline();
      const overlayConfig = animation.overlay || {};
      const overlayBefore = normalizeOverlayStops(overlayConfig.before, DEFAULT_OVERLAY_BEFORE);
      const overlayAfter = normalizeOverlayStops(overlayConfig.after, DEFAULT_OVERLAY_AFTER);

      const nameRowAnim = animation.nameRowAnim || {};
      const charAnim = animation.charAnim || {};
      const charPerLine = charAnim.perLine || {};

      // Map a config-shaped block ({ yRange, duration, ease, ... }) to the
      // option keys `animateTextLine` expects (charYRange, charDuration, ...).
      // Per-line overrides win; anything missing falls through to the
      // defaults declared on `charAnim`, and anything still missing falls
      // through to `animateTextLine`'s built-in fallbacks.
      function lineOptionsFor(lineKey) {
        const override = charPerLine[lineKey] || {};
        function pick(name) {
          return override[name] !== undefined ? override[name] : charAnim[name];
        }
        return {
          charYRange:           pick('yRange'),
          charDuration:         pick('duration'),
          charEase:             pick('ease'),
          staggerEach:          pick('staggerEach'),
          staggerFrom:          pick('staggerFrom'),
          rotationX:            pick('rotationX'),
          transformPerspective: pick('transformPerspective'),
          transformOrigin:      pick('transformOrigin')
        };
      }

      animateTextLine(timeline, document.getElementById('theWedding'),   starts.wedding ?? 0.3,  lineOptionsFor('theWedding'));
      animateTextLine(timeline, document.getElementById('weddingDate'),  starts.date    ?? 0.54, lineOptionsFor('weddingDate'));
      animateTextLine(timeline, document.getElementById('koreanNames'),  starts.korean  ?? 0.78, lineOptionsFor('koreanNames'));
      animateTextLine(timeline, document.getElementById('weddingVenue'), starts.venue   ?? 0.97, lineOptionsFor('weddingVenue'));

      const defaultNameStart = 1.45;
      const nameRowStart = starts.nameRow ?? defaultNameStart;
      const groomStart = starts.groom ?? nameRowStart;
      const ampersandStart = starts.ampersand ?? nameRowStart;
      const brideStart = starts.bride ?? nameRowStart;
      const fadeOptions = {
        duration: nameRowAnim.fadeDuration ?? 1.2,
        ease: nameRowAnim.fadeEase || 'power2.out'
      };

      animateElementsFade(timeline, [document.getElementById('nameGroom')], groomStart, fadeOptions);
      animateElementsFade(timeline, [document.getElementById('ampersand')], ampersandStart, fadeOptions);
      animateElementsFade(timeline, [document.getElementById('nameBride')], brideStart, fadeOptions);

      const arrow = document.getElementById('scrollArrow');
      if (arrow) {
        timeline.fromTo(arrow, {
          opacity: 0,
          scale: 0.9
        }, {
          opacity: 1,
          scale: 1,
          duration: 1.0,
          ease: 'power2.inOut',
          onComplete: function () {
            arrow.classList.add('visible');
          }
        }, starts.arrow ?? 3.0);
      }

      const postIntro = animation.postIntro || {};
      const postStart = postIntro.start ?? ((starts.arrow ?? 3.0) + 1.2);
      const postDuration = postIntro.duration ?? 1.3;
      const overlay = document.querySelector('.hero__overlay');

      if (overlay) {
        global.gsap.set(overlay, {
          '--overlay-y0': overlayBefore.y0,
          '--overlay-y35': overlayBefore.y35,
          '--overlay-y60': overlayBefore.y60,
          '--overlay-y100': overlayBefore.y100
        });

        timeline.to(overlay, {
          '--overlay-y0': overlayAfter.y0,
          '--overlay-y35': overlayAfter.y35,
          '--overlay-y60': overlayAfter.y60,
          '--overlay-y100': overlayAfter.y100,
          duration: postDuration,
          ease: 'power2.out'
        }, postStart);

        if (typeof postIntro.overlayOpacity === 'number' && Number.isFinite(postIntro.overlayOpacity)) {
          timeline.to(overlay, {
            opacity: postIntro.overlayOpacity,
            duration: postDuration,
            ease: 'power2.out'
          }, postStart);
        }
      }

      if (postIntro.hideTitleGroup !== false) {
        const titleGroup = document.querySelector('.hero__title-group');
        if (titleGroup) {
          timeline.to(titleGroup, {
            autoAlpha: 0,
            y: postIntro.titleYOffset ?? -24,
            duration: postDuration,
            ease: 'power2.inOut'
          }, postStart + 0.05);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize hero animations.', error);
      app.showStaticHero();
      return false;
    }
  };
})(window);
