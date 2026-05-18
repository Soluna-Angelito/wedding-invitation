(function (global) {
  'use strict';

  var app = global.WeddingInvitation = global.WeddingInvitation || {};
  var TWO_PI = Math.PI * 2;

  function prefersReducedMotion() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function toFiniteNumber(value, fallback) {
    return (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(from, to, amount) {
    return from + (to - from) * amount;
  }

  function positiveModulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function hash32(value) {
    var x = value >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b);
    x ^= x >>> 16;
    return x >>> 0;
  }

  function randomUnit(seed, salt) {
    return hash32((seed + Math.imul(salt + 1, 0x9e3779b9)) >>> 0) / 4294967296;
  }

  function readConfig() {
    return Object.assign({
      seed: 20260712,
      minCount: 30,
      maxCount: 78,
      mobileCount: 48,
      maxTotalCount: 860,
      sizeMin: 4,
      sizeMax: 12,
      fallSpeedMin: 16,
      fallSpeedMax: 48,
      windBase: 10,
      windRange: 34,
      swayMin: 16,
      swayMax: 68,
      opacityMin: 0.26,
      opacityMax: 0.68,
      canvasOpacity: 0.78,
      fadeMs: 900,
      centerFadeMin: 0.5,
      centerFadeWidth: 0.38,
      edgeBias: 0.58,
      wrapViewportRatio: 1.05,
      maxDevicePixelRatio: 1.5,
      spritePixelRatio: 1.5,
      spriteSizeSteps: 5,
      spriteVariants: 3,
      frameIntervalMs: 0,
      lowPowerFrameMs: 33,
      colors: [
        { fill: '#f8cbd3', highlight: '#fff7f8', shade: '#d9a2aa', vein: 'rgba(143, 87, 91, 0.18)' },
        { fill: '#ffe5e8', highlight: '#ffffff', shade: '#edbdc4', vein: 'rgba(150, 94, 102, 0.14)' },
        { fill: '#f1d4c4', highlight: '#fff6ee', shade: '#cfaa98', vein: 'rgba(129, 91, 72, 0.13)' },
        { fill: '#f7d7df', highlight: '#fff4f8', shade: '#d7a8b8', vein: 'rgba(134, 78, 100, 0.14)' }
      ]
    }, (global.WeddingConfig && global.WeddingConfig.petals) || {});
  }

  app.destroyPetals = function destroyPetals() {
    if (app.petalController && typeof app.petalController.destroy === 'function') {
      app.petalController.destroy();
    }
    app.petalController = null;
  };

  app.initPetals = function initPetals() {
    var contentEl = document.getElementById('invitationContent');
    if (!contentEl || prefersReducedMotion()) {
      return null;
    }

    app.destroyPetals();

    var config = readConfig();
    var canvas = document.createElement('canvas');
    canvas.id = 'petalCanvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.setProperty(
      '--petal-canvas-opacity',
      String(clamp(toFiniteNumber(config.canvasOpacity, 0.78), 0, 1))
    );
    canvas.style.setProperty(
      '--petal-fade-ms',
      Math.max(0, toFiniteNumber(config.fadeMs, 900)) + 'ms'
    );
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      return null;
    }

    var width = 1;
    var height = 1;
    var dpr = 1;
    var contentTopDoc = 0;
    var contentBottomDoc = 0;
    var contentHeight = 1;
    var loopTopDoc = 0;
    var loopHeight = 1;
    var wrapMargin = 1;
    var clipTop = 0;
    var clipBottom = 0;
    var isActive = false;
    var rafId = null;
    var lastDrawTime = 0;
    var scrollTicking = false;
    var sprites = [];
    var field = [];
    var frameIntervalMs = 0;

    function getScrollY() {
      return global.scrollY || global.pageYOffset || document.documentElement.scrollTop || 0;
    }

    function getPalette() {
      return Array.isArray(config.colors) && config.colors.length ? config.colors : readConfig().colors;
    }

    function isLikelyLowPower() {
      var nav = global.navigator || {};
      var cores = toFiniteNumber(nav.hardwareConcurrency, 8);
      var memory = toFiniteNumber(nav.deviceMemory, 8);
      return cores <= 4 || memory <= 4 || (width <= 360 && cores <= 6);
    }

    function getVisibleTargetCount() {
      var mobileCount = Math.max(1, Math.floor(toFiniteNumber(config.mobileCount, 48)));
      var maxCount = Math.max(mobileCount, Math.floor(toFiniteNumber(config.maxCount, 78)));
      var minCount = Math.max(1, Math.floor(toFiniteNumber(config.minCount, 30)));
      var viewportRatio = clamp(width / 390, 0.76, 1.75);
      return clamp(Math.round(mobileCount * viewportRatio), minCount, maxCount);
    }

    function updateContentMetrics() {
      var rect = contentEl.getBoundingClientRect();
      var scrollY = getScrollY();
      var previousLoopHeight = loopHeight;

      contentTopDoc = scrollY + rect.top;
      contentBottomDoc = scrollY + rect.bottom;
      contentHeight = Math.max(1, contentBottomDoc - contentTopDoc);
      wrapMargin = Math.max(height * clamp(toFiniteNumber(config.wrapViewportRatio, 1.05), 0.45, 1.8), 360);
      loopTopDoc = contentTopDoc - wrapMargin;
      loopHeight = Math.max(1, contentHeight + wrapMargin * 2);

      if (field.length && Math.abs(loopHeight - previousLoopHeight) > 8) {
        buildField();
      }
    }

    function updateVisibility() {
      var scrollY = getScrollY();
      var wasActive = isActive;
      clipTop = clamp(contentTopDoc - scrollY, 0, height);
      clipBottom = clamp(contentBottomDoc - scrollY, 0, height);
      isActive = clipBottom > clipTop;
      canvas.classList.toggle('is-active', isActive);

      if (isActive) {
        if (!wasActive && field.length && sprites.length) {
          var now = global.performance && typeof global.performance.now === 'function'
            ? global.performance.now()
            : Date.now();
          drawField(now);
          lastDrawTime = now;
        }
        start();
      } else {
        stop();
        ctx.clearRect(0, 0, width, height);
      }
    }

    function createSprite(palette, length, variant, spriteDpr) {
      var petalWidth = length * lerp(0.46, 0.62, variant / Math.max(1, toFiniteNumber(config.spriteVariants, 3) - 1));
      var canvasWidth = Math.ceil(length * 2.2 + 10);
      var canvasHeight = Math.ceil(length * 2.55 + 12);
      var spriteCanvas = document.createElement('canvas');
      var spriteCtx = spriteCanvas.getContext('2d');

      spriteCanvas.width = Math.max(1, Math.ceil(canvasWidth * spriteDpr));
      spriteCanvas.height = Math.max(1, Math.ceil(canvasHeight * spriteDpr));

      spriteCtx.setTransform(spriteDpr, 0, 0, spriteDpr, 0, 0);
      spriteCtx.translate(canvasWidth / 2, canvasHeight / 2);
      spriteCtx.rotate(lerp(-0.08, 0.08, variant / Math.max(1, toFiniteNumber(config.spriteVariants, 3) - 1)));

      var gradient = spriteCtx.createLinearGradient(-petalWidth, -length, petalWidth, length);
      gradient.addColorStop(0, palette.highlight || '#ffffff');
      gradient.addColorStop(0.38, palette.fill || '#f8cbd3');
      gradient.addColorStop(1, palette.shade || '#d9a2aa');

      spriteCtx.shadowColor = 'rgba(96, 65, 63, 0.09)';
      spriteCtx.shadowBlur = Math.max(1, length * 0.35);
      spriteCtx.shadowOffsetY = Math.max(0.5, length * 0.11);
      spriteCtx.beginPath();
      spriteCtx.moveTo(0, -length * 0.58);
      spriteCtx.bezierCurveTo(petalWidth * 0.88, -length * 0.44, petalWidth * 0.76, length * 0.28, 0, length * 0.6);
      spriteCtx.bezierCurveTo(-petalWidth * 0.74, length * 0.28, -petalWidth * 0.88, -length * 0.38, 0, -length * 0.58);
      spriteCtx.closePath();
      spriteCtx.fillStyle = gradient;
      spriteCtx.fill();

      spriteCtx.shadowColor = 'transparent';
      spriteCtx.globalAlpha = 0.72;
      spriteCtx.beginPath();
      spriteCtx.moveTo(0, -length * 0.34);
      spriteCtx.quadraticCurveTo(-petalWidth * 0.12, -length * 0.02, 0, length * 0.38);
      spriteCtx.strokeStyle = palette.vein || 'rgba(143, 87, 91, 0.16)';
      spriteCtx.lineWidth = Math.max(0.35, length * 0.035);
      spriteCtx.lineCap = 'round';
      spriteCtx.stroke();

      return {
        canvas: spriteCanvas,
        width: canvasWidth,
        height: canvasHeight
      };
    }

    function buildSprites() {
      var palette = getPalette();
      var sizeMin = Math.max(2, toFiniteNumber(config.sizeMin, 4));
      var sizeMax = Math.max(sizeMin + 1, toFiniteNumber(config.sizeMax, 12));
      var sizeSteps = clamp(Math.floor(toFiniteNumber(config.spriteSizeSteps, 5)), 2, 8);
      var variants = clamp(Math.floor(toFiniteNumber(config.spriteVariants, 3)), 1, 5);
      var spriteDpr = clamp(toFiniteNumber(config.spritePixelRatio, 1.5), 1, 2);
      var nextSprites = [];

      for (var p = 0; p < palette.length; p++) {
        for (var s = 0; s < sizeSteps; s++) {
          var t = sizeSteps === 1 ? 0 : s / (sizeSteps - 1);
          var length = lerp(sizeMin, sizeMax, Math.pow(t, 0.85));
          for (var v = 0; v < variants; v++) {
            nextSprites.push(createSprite(palette[p], length, v, spriteDpr));
          }
        }
      }

      sprites = nextSprites;
    }

    function chooseBaseX(seed, widthValue) {
      var edgeBias = clamp(toFiniteNumber(config.edgeBias, 0.58), 0, 0.92);
      var useEdge = randomUnit(seed, 4) < edgeBias;
      var side = randomUnit(seed, 5) < 0.5 ? -1 : 1;

      if (useEdge && widthValue < 560) {
        return side < 0
          ? lerp(-18, widthValue * 0.28, randomUnit(seed, 6))
          : lerp(widthValue * 0.72, widthValue + 18, randomUnit(seed, 7));
      }

      if (useEdge) {
        return side < 0
          ? lerp(-28, widthValue * 0.34, randomUnit(seed, 6))
          : lerp(widthValue * 0.66, widthValue + 28, randomUnit(seed, 7));
      }

      return lerp(widthValue * 0.08, widthValue * 0.92, randomUnit(seed, 8));
    }

    function buildField() {
      var targetVisible = getVisibleTargetCount();
      var maxTotalCount = Math.max(targetVisible, Math.floor(toFiniteNumber(config.maxTotalCount, 860)));
      var totalCount = clamp(Math.ceil(targetVisible * loopHeight / Math.max(1, height)), targetVisible, maxTotalCount);
      var slotHeight = loopHeight / totalCount;
      var seedBase = Math.floor(toFiniteNumber(config.seed, 20260712)) >>> 0;
      var sizeMin = Math.max(2, toFiniteNumber(config.sizeMin, 4));
      var sizeMax = Math.max(sizeMin + 1, toFiniteNumber(config.sizeMax, 12));
      var opacityMin = clamp(toFiniteNumber(config.opacityMin, 0.26), 0, 1);
      var opacityMax = clamp(toFiniteNumber(config.opacityMax, 0.68), opacityMin, 1);
      var nextField = [];

      for (var i = 0; i < totalCount; i++) {
        var seed = hash32((seedBase + Math.imul(i + 1, 0x45d9f3b)) >>> 0);
        var depth = Math.pow(randomUnit(seed, 9), 0.68);
        var spriteIndex = sprites.length ? Math.floor(randomUnit(seed, 10) * sprites.length) % sprites.length : 0;
        var x = chooseBaseX(seed, width);
        var centerDistance = Math.abs((x / Math.max(1, width)) - 0.5);
        var readabilityFade = lerp(
          clamp(toFiniteNumber(config.centerFadeMin, 0.5), 0, 1),
          1,
          clamp(centerDistance / clamp(toFiniteNumber(config.centerFadeWidth, 0.38), 0.05, 0.5), 0, 1)
        );

        nextField.push({
          seed: seed,
          baseLoopY: (i + randomUnit(seed, 11)) * slotHeight,
          x: x,
          length: lerp(sizeMin, sizeMax, depth),
          scaleX: lerp(0.86, 1.16, randomUnit(seed, 12)),
          scaleY: lerp(0.9, 1.14, randomUnit(seed, 13)),
          depth: depth,
          fallSpeed: lerp(
            toFiniteNumber(config.fallSpeedMin, 16),
            toFiniteNumber(config.fallSpeedMax, 48),
            depth
          ) * lerp(0.88, 1.14, randomUnit(seed, 14)),
          sway: lerp(
            toFiniteNumber(config.swayMin, 16),
            toFiniteNumber(config.swayMax, 68),
            depth
          ),
          flutter: lerp(0.7, 1.9, randomUnit(seed, 15)),
          spin: lerp(-0.9, 0.9, randomUnit(seed, 16)),
          rotation: randomUnit(seed, 17) * TWO_PI,
          phase: randomUnit(seed, 18) * TWO_PI,
          windDepth: lerp(0.35, 1.1, depth),
          opacity: lerp(opacityMin, opacityMax, randomUnit(seed, 19)) * readabilityFade,
          spriteIndex: spriteIndex
        });
      }

      field = nextField;
    }

    function resizeCanvas() {
      width = Math.max(1, global.innerWidth || document.documentElement.clientWidth || 1);
      height = Math.max(1, global.innerHeight || document.documentElement.clientHeight || 1);
      dpr = Math.min(
        Math.max(1, toFiniteNumber(config.maxDevicePixelRatio, 1.5)),
        Math.max(1, toFiniteNumber(global.devicePixelRatio, 1))
      );

      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      frameIntervalMs = isLikelyLowPower()
        ? Math.max(0, toFiniteNumber(config.lowPowerFrameMs, 33))
        : Math.max(0, toFiniteNumber(config.frameIntervalMs, 0));

      updateContentMetrics();
      buildSprites();
      buildField();
      updateVisibility();
    }

    function scheduleViewportStateUpdate() {
      if (scrollTicking) {
        return;
      }
      scrollTicking = true;
      global.requestAnimationFrame(function () {
        scrollTicking = false;
        updateContentMetrics();
        updateVisibility();
      });
    }

    function drawField(now) {
      var scrollY = getScrollY();
      var elapsed = now * 0.001;
      var globalWind = (
        Math.sin(elapsed * 0.19) * 0.55 +
        Math.sin(elapsed * 0.077 + 1.7) * 0.45
      ) * toFiniteNumber(config.windRange, 34) + toFiniteNumber(config.windBase, 10);
      var marginX = Math.max(40, toFiniteNumber(config.sizeMax, 12) * 8);

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, clipTop, width, clipBottom - clipTop);
      ctx.clip();

      for (var i = 0; i < field.length; i++) {
        var petal = field[i];
        var docY = loopTopDoc + positiveModulo(
          petal.baseLoopY + elapsed * petal.fallSpeed,
          loopHeight
        );
        var screenY = docY - scrollY;

        if (screenY < clipTop - marginX || screenY > clipBottom + marginX) {
          continue;
        }

        var x = petal.x +
          Math.sin(elapsed * petal.flutter + petal.phase) * petal.sway +
          globalWind * petal.windDepth;

        if (x < -marginX || x > width + marginX) {
          continue;
        }

        var sprite = sprites[petal.spriteIndex];
        if (!sprite) {
          continue;
        }

        var curl = 1 + Math.sin(elapsed * petal.flutter * 1.3 + petal.phase) * 0.16;
        var rotation = petal.rotation + elapsed * petal.spin + Math.sin(elapsed * 0.9 + petal.phase) * 0.42;

        ctx.save();
        ctx.translate(x, screenY);
        ctx.rotate(rotation);
        ctx.scale(petal.scaleX * curl, petal.scaleY);
        ctx.globalAlpha = petal.opacity;
        ctx.drawImage(sprite.canvas, -sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
        ctx.restore();
      }

      ctx.restore();
    }

    function drawFrame(now) {
      if (!isActive) {
        rafId = null;
        return;
      }

      updateVisibility();

      if (!isActive) {
        rafId = null;
        return;
      }

      if (!lastDrawTime || frameIntervalMs === 0 || now - lastDrawTime >= frameIntervalMs) {
        drawField(now);
        lastDrawTime = now;
      }

      rafId = global.requestAnimationFrame(drawFrame);
    }

    function start() {
      if (rafId !== null) {
        return;
      }
      lastDrawTime = 0;
      rafId = global.requestAnimationFrame(drawFrame);
    }

    function stop() {
      if (rafId === null) {
        return;
      }
      global.cancelAnimationFrame(rafId);
      rafId = null;
      lastDrawTime = 0;
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stop();
        return;
      }
      updateContentMetrics();
      updateVisibility();
    }

    function onMotionChange(event) {
      if (event.matches) {
        app.destroyPetals();
      }
    }

    var mediaQuery = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)');

    resizeCanvas();
    global.addEventListener('resize', resizeCanvas, { passive: true });
    global.addEventListener('scroll', scheduleViewportStateUpdate, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', onMotionChange);
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(onMotionChange);
      }
    }

    var controller = {
      destroy: function () {
        stop();
        global.removeEventListener('resize', resizeCanvas);
        global.removeEventListener('scroll', scheduleViewportStateUpdate);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        if (mediaQuery) {
          if (typeof mediaQuery.removeEventListener === 'function') {
            mediaQuery.removeEventListener('change', onMotionChange);
          } else if (typeof mediaQuery.removeListener === 'function') {
            mediaQuery.removeListener(onMotionChange);
          }
        }
        sprites.length = 0;
        field.length = 0;
        canvas.remove();
      }
    };

    app.petalController = controller;
    return controller;
  };
})(window);
