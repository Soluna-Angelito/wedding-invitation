(function (global) {
  const app = global.WeddingInvitation = global.WeddingInvitation || {};
  const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

  function prefersReducedMotion() {
    if (!global.matchMedia) {
      return false;
    }
    return global.matchMedia(REDUCED_MOTION_QUERY).matches;
  }

  function getNavigationConfig() {
    return (global.WeddingConfig && global.WeddingConfig.navigation) || {};
  }

  function initScrollArrowInteraction(reducedMotion) {
    const arrow = document.getElementById('scrollArrow');
    if (!arrow) {
      return;
    }

    arrow.addEventListener('click', function () {
      const nav = getNavigationConfig();
      const targetId = nav.scrollTargetId || 'invitationContent';
      const target = document.getElementById(targetId);

      if (!target) {
        return;
      }

      const behavior = reducedMotion ? 'auto' : (nav.scrollBehavior || 'smooth');
      const block = nav.scrollBlock || 'start';
      target.scrollIntoView({ behavior: behavior, block: block });
    });
  }

  function initVisualEffects(reducedMotion) {
    if (reducedMotion) {
      if (typeof app.destroyFirefly === 'function') {
        app.destroyFirefly();
      }
      return;
    }

    if (typeof app.initFirefly === 'function') {
      app.initFirefly();
    }
  }

  function initHeroPresentation(reducedMotion) {
    if (reducedMotion) {
      if (typeof app.showStaticHero === 'function') {
        app.showStaticHero();
      }
      return;
    }

    if (typeof app.initHeroAnimations !== 'function' || !global.gsap) {
      if (typeof app.showStaticHero === 'function') {
        app.showStaticHero();
      }
      return;
    }

    document.documentElement.classList.add('enhanced-motion');

    let animationStarted = false;
    const runAnimation = function () {
      if (animationStarted) {
        return;
      }
      animationStarted = true;

      const started = app.initHeroAnimations();
      if (started === false && typeof app.showStaticHero === 'function') {
        app.showStaticHero();
      }
    };

    if (document.fonts && document.fonts.ready) {
      const maxFontWaitMs = 1200;
      const timeoutId = global.setTimeout(runAnimation, maxFontWaitMs);
      document.fonts.ready.then(function () {
        global.clearTimeout(timeoutId);
        runAnimation();
      }).catch(function () {
        global.clearTimeout(timeoutId);
        runAnimation();
      });
      return;
    }

    runAnimation();
  }

  function bindReducedMotionFallback() {
    if (!global.matchMedia) {
      return;
    }

    const mediaQuery = global.matchMedia(REDUCED_MOTION_QUERY);
    const handleReducedMotion = function (event) {
      if (!event.matches) {
        return;
      }

      if (typeof app.destroyFirefly === 'function') {
        app.destroyFirefly();
      }

      if (typeof app.showStaticHero === 'function') {
        app.showStaticHero();
      }
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleReducedMotion);
      return;
    }

    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleReducedMotion);
    }
  }

  function start() {
    const reducedMotion = prefersReducedMotion();
    initScrollArrowInteraction(reducedMotion);
    initVisualEffects(reducedMotion);
    initHeroPresentation(reducedMotion);
    bindReducedMotionFallback();
  }

  document.addEventListener('DOMContentLoaded', start);
})(window);
