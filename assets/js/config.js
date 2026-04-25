(function (global) {
  function mergeConfig(base, override) {
    const merged = Object.assign({}, base);

    if (!override || typeof override !== 'object') {
      return merged;
    }

    Object.keys(override).forEach(function (key) {
      const baseValue = base[key];
      const overrideValue = override[key];

      if (
        baseValue &&
        overrideValue &&
        typeof baseValue === 'object' &&
        !Array.isArray(baseValue) &&
        typeof overrideValue === 'object' &&
        !Array.isArray(overrideValue)
      ) {
        merged[key] = mergeConfig(baseValue, overrideValue);
      } else {
        merged[key] = overrideValue;
      }
    });

    return merged;
  }

  const defaultConfig = {
    navigation: {
      scrollTargetId: 'invitationContent',
      scrollBehavior: 'smooth',
      scrollBlock: 'start'
    },
    firefly: {
      maxCount: 50,
      spawnPerFrame: 3,
      sizeMin: 0.5,
      sizeRange: 1.0,
      speedScale: 0.3,
      opacityMin: 0.1,
      opacityMax: 0.7,
      fadeSpeedMin: 0.002,
      fadeSpeedRange: 0.003,
      angleJitterDeg: 2.5,
      maxDevicePixelRatio: 2
    },
    animation: {
      starts: {
        wedding: 0.0,
        date: 0.0,
        korean: 0.0,
        venue: 0.0,
        nameRow: 0.0,
        groom: 0.8,
        ampersand: 0.8,
        bride: 0.8,
        arrow: 3.0
      },
      nameRowAnim: {
        fadeDuration: 1.2,
        fadeEase: 'power2.out'
      },
      // ── Per-character hero text animation ─────────────────────────
      // Controls how letters in `THE WEDDING OF`, the date, the Korean
      // names, and the venue line "fall into place". Tweak here to
      // change the *feel* of the intro without touching JS.
      //
      //   yRange:               px each letter can drift from before
      //                         settling. Lower = subtler / more
      //                         elegant. (was hardcoded 100)
      //   duration:             seconds for each letter's flight.
      //                         Higher = more graceful. (was 1.75)
      //   ease:                 GSAP ease curve. 'power4.inOut' is
      //                         dramatic; 'power2.out' / 'sine.out'
      //                         read as more refined.
      //   staggerEach:          delay (s) between consecutive letters.
      //                         Tiny = letters arrive together;
      //                         ~0.04 = graceful wave.
      //   staggerFrom:          'start' | 'center' | 'end' | 'edges'.
      //   rotationX:            initial 3D tilt (deg). 0 = pure
      //                         vertical drift, no theatrical fall.
      //   transformPerspective: GSAP 3D perspective (px). Larger =
      //                         flatter / more subtle.
      //   transformOrigin:      where the 3D rotation pivots from.
      //
      // `perLine` overrides any subset of the above for a specific
      // hero line (keyed by element id in index.html).
      charAnim: {
        yRange: 10,
        duration: 1.75,
        ease: 'power4.inOut',
        staggerEach: 0.01,
        staggerFrom: 'center',
        rotationX: 20,
        transformPerspective: 600,
        transformOrigin: '50% 50% -50px',
        perLine: {
          theWedding:   {},
          weddingDate:  { duration: 1.5 },
          koreanNames:  {},
          weddingVenue: {}
        }
      },
      postIntro: {
        start: 2.0,
        duration: 4.0,
        hideTitleGroup: true,
        titleYOffset: -24
      },
      overlay: {
        before: { y0: 0.8, y35: 0.8, y60: 0.8, y100: 0.8 },
        after: { y0: 0.0, y35: 0.0, y60: 0.30, y100: 0.8 }
      }
    },
    letter: {
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.12,
      charStaggerMs: 55,
      messageStaggerMs: 160,
      familyStaggerMs: 180,
      photoParallaxStrength: 24
    },
    calendar: {
      weddingDate: '2026-07-12T12:00:00+09:00',
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.15,
      countdownUpdateMs: 1000
    },
    gallery: {
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.12,
      // Pixels per ~16ms frame for the polaroid filmstrip auto-marquee.
      // Set to 0 to disable auto scrolling entirely.
      filmstripAutoScrollSpeed: 0.35,
      // Pixel offset applied to the featured photo as it scrolls through
      // the viewport (gentle ken-burns parallax).
      parallaxStrength: 18,
      // ── Filmstrip drag / fling response ────────────────────────────
      // Window (ms) used to compute release velocity. Smaller = snappier
      // response to a real flick; the default captures the gesture's
      // final ~80ms which corresponds to the user's actual finger speed
      // at lift-off (avoids the "starts too late" feel).
      filmstripFlingWindowMs: 80,
      // Friction applied per ~16ms frame after release. Lower = glides
      // farther (more film-like). Range: 0.85 (sticky) – 0.97 (very long).
      filmstripFriction: 0.945,
      // How long (ms) the auto-marquee stays paused after the last user
      // interaction. Used to be 2200ms which felt sluggish; 700ms feels
      // alive without fighting the user.
      filmstripResumeDelayMs: 700,
      // Maximum tilt (deg) randomly applied to each polaroid so adding
      // photos doesn't require manually tuning style="--polaroid-tilt".
      filmstripTiltMaxDeg: 2.6,
      // Maximum tape-piece rotation (deg).
      filmstripTapeMaxDeg: 5
    }
  };

  // Allow user override by defining window.WeddingConfig before this file.
  global.WeddingConfig = mergeConfig(defaultConfig, global.WeddingConfig);
})(window);
