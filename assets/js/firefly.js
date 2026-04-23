(function (global) {
  const app = global.WeddingInvitation = global.WeddingInvitation || {};

  function toFiniteNumber(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    return fallback;
  }

  function toPositiveInteger(value, fallback) {
    const num = toFiniteNumber(value, fallback);
    return Math.max(1, Math.floor(num));
  }

  app.destroyFirefly = function destroyFirefly() {
    if (app.fireflyController && typeof app.fireflyController.destroy === 'function') {
      app.fireflyController.destroy();
    }
    app.fireflyController = null;
  };

  app.initFirefly = function initFirefly() {
    const heroSection = document.getElementById('hero');
    if (!heroSection) {
      return null;
    }

    app.destroyFirefly();

    const config = Object.assign({
      maxCount: 50,
      spawnPerFrame: 3,
      sizeMin: 0.5,
      sizeRange: 1.0,
      speedScale: 1,
      opacityMin: 0.1,
      opacityMax: 1,
      fadeSpeedMin: 0.005,
      fadeSpeedRange: 0.005,
      angleJitterDeg: 2.5,
      maxDevicePixelRatio: 2
    }, (global.WeddingConfig && global.WeddingConfig.firefly) || {});

    // Keep backward compatibility if old config uses speedFactor/speedDivider.
    const legacySpeedScale = (
      typeof config.speedFactor === 'number' &&
      typeof config.speedDivider === 'number' &&
      Number.isFinite(config.speedFactor) &&
      Number.isFinite(config.speedDivider) &&
      config.speedDivider !== 0
    ) ? (config.speedFactor / config.speedDivider) : (1 / 6);

    const speedScale = (
      typeof config.speedScale === 'number' &&
      Number.isFinite(config.speedScale)
    ) ? config.speedScale : legacySpeedScale;

    const maxCount = toPositiveInteger(config.maxCount, 50);
    const spawnPerFrame = toPositiveInteger(config.spawnPerFrame, 3);
    const sizeMin = Math.max(0.1, toFiniteNumber(config.sizeMin, 0.5));
    const sizeRange = Math.max(0.01, toFiniteNumber(config.sizeRange, 1.0));
    const opacityMin = Math.max(0, Math.min(1, toFiniteNumber(config.opacityMin, 0.1)));
    const opacityMax = Math.max(opacityMin, Math.min(1, toFiniteNumber(config.opacityMax, 1)));
    const fadeSpeedMin = Math.max(0.0001, toFiniteNumber(config.fadeSpeedMin, 0.005));
    const fadeSpeedRange = Math.max(0.0001, toFiniteNumber(config.fadeSpeedRange, 0.005));
    const angleJitterDeg = Math.max(0, toFiniteNumber(config.angleJitterDeg, 2.5));
    const maxDevicePixelRatio = Math.max(1, toFiniteNumber(config.maxDevicePixelRatio, 2));

    const canvas = document.createElement('canvas');
    canvas.id = 'fireflyCanvas';
    heroSection.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      return null;
    }

    let width = 1;
    let height = 1;
    let rafId = null;
    const fireflies = [];

    function resizeCanvas() {
      const rect = heroSection.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));

      const devicePixelRatio = Math.min(
        maxDevicePixelRatio,
        Math.max(1, toFiniteNumber(global.devicePixelRatio, 1))
      );

      canvas.width = Math.max(1, Math.floor(width * devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(height * devicePixelRatio));
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }

    class Firefly {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * sizeRange + sizeMin;
        this.angle = Math.random() * 2 * Math.PI;
        this.velocity = (this.size * this.size) * speedScale / 6.0;
        this.opacity = Math.random() * (opacityMax - opacityMin) + opacityMin;
        this.fadeSpeed = fadeSpeedMin + Math.random() * fadeSpeedRange;
        this.fadeDirection = 1;
      }

      move() {
        this.x += this.velocity * Math.cos(this.angle);
        this.y += this.velocity * Math.sin(this.angle);

        const maxJitterRad = (angleJitterDeg * Math.PI) / 180;
        this.angle += Math.random() * (maxJitterRad * 2) - maxJitterRad;

        this.opacity += this.fadeSpeed * this.fadeDirection;
        if (this.opacity >= opacityMax || this.opacity <= 0) {
          this.fadeDirection *= -1;
          this.opacity = Math.min(opacityMax, Math.max(0, this.opacity));
        }

        if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
          this.x = Math.random() * width;
          this.y = Math.random() * height;
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, ' + this.opacity + ')';
        ctx.fill();
      }
    }

    function drawFrame() {
      ctx.clearRect(0, 0, width, height);

      if (fireflies.length < maxCount) {
        const remaining = maxCount - fireflies.length;
        const spawnCount = Math.min(spawnPerFrame, remaining);
        for (let i = 0; i < spawnCount; i++) {
          fireflies.push(new Firefly());
        }
      }

      for (let i = 0; i < fireflies.length; i++) {
        fireflies[i].move();
        fireflies[i].draw();
      }

      rafId = global.requestAnimationFrame(drawFrame);
    }

    function start() {
      if (rafId === null) {
        rafId = global.requestAnimationFrame(drawFrame);
      }
    }

    function stop() {
      if (rafId !== null) {
        global.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    }

    function onResize() {
      resizeCanvas();
    }

    resizeCanvas();
    start();

    global.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    const controller = {
      destroy: function () {
        stop();
        global.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        fireflies.length = 0;
        canvas.remove();
      }
    };

    app.fireflyController = controller;
    return controller;
  };
})(window);
