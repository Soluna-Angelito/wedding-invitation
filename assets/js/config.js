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
        wedding: 0.3,
        date: 0.54,
        korean: 0.78,
        venue: 0.97,
        nameRow: 1.45,
        groom: 1.45,
        ampersand: 1.45,
        bride: 1.45,
        arrow: 3.0
      },
      nameRowAnim: {
        charDuration: 1.75,
        charEase: 'power4.inOut',
        charYRange: 100,
        staggerEach: 0.1,
        staggerFrom: 'start'
      },
      postIntro: {
        start: 5.0,
        duration: 2.0,
        hideTitleGroup: true,
        titleYOffset: -24
      },
      overlay: {
        before: { y0: 0.8, y35: 0.8, y60: 0.8, y100: 0.8 },
        after: { y0: 0.0, y35: 0.0, y60: 0.10, y100: 0.8 }
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
    }
  };

  // Allow user override by defining window.WeddingConfig before this file.
  global.WeddingConfig = mergeConfig(defaultConfig, global.WeddingConfig);
})(window);
