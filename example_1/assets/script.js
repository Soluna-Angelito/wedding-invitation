// script.js — 상견례 초대장 v2

(function () {
  'use strict';

  const CFG = {
    eventDate: new Date('2026-03-14T12:30:00+09:00'),
    eventYear: 2026,
    eventMonth: 3,
    eventDay: 14,
    address: '서울 종로구 종로5길 7 타워8빌딩 지하 2층',
    venueName: '진진수라 광화문점',
    loaderDuration: 2000,
    dustCount: 50,
    petalCount: 25,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
  };

  /* ==========================================
     Canvas Particle System
     ========================================== */

  class AmbientCanvas {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dusts = [];
      this.petals = [];
      this.running = true;
      this.lastTime = 0;
      this.resize();
      this.init();
      window.addEventListener('resize', () => this.resize());
      if (!CFG.prefersReducedMotion) this.loop(0);
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.canvas.width = this.w * dpr;
      this.canvas.height = this.h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    init() {
      for (let i = 0; i < CFG.dustCount; i++) {
        this.dusts.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          r: 0.8 + Math.random() * 1.8,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.15,
          phase: Math.random() * Math.PI * 2,
          speed: 0.004 + Math.random() * 0.008,
          baseAlpha: 0.08 + Math.random() * 0.2
        });
      }
      for (let i = 0; i < CFG.petalCount; i++) {
        this.petals.push(this.newPetal(true));
      }
    }

    newPetal(randomY) {
      const hues = [
        [212, 165, 165],
        [232, 213, 196],
        [238, 200, 200],
        [221, 184, 146],
        [245, 228, 228]
      ];
      const c = hues[Math.floor(Math.random() * hues.length)];
      return {
        x: Math.random() * this.w,
        y: randomY ? Math.random() * this.h : -20 - Math.random() * 40,
        size: 6 + Math.random() * 10,
        vy: 0.25 + Math.random() * 0.45,
        vx: (Math.random() - 0.5) * 0.4,
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 1.5,
        wobble: Math.random() * Math.PI * 2,
        wobbleV: 0.015 + Math.random() * 0.025,
        wobbleA: 0.4 + Math.random() * 0.8,
        tilt: Math.random() * Math.PI,
        tiltV: 0.008 + Math.random() * 0.016,
        alpha: 0.15 + Math.random() * 0.25,
        r: c[0], g: c[1], b: c[2],
        scale: 0.5 + Math.random() * 0.5
      };
    }

    drawPetal(p) {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      const sx = Math.abs(Math.cos(p.tilt)) * p.scale;
      const sy = p.scale;
      ctx.scale(sx || 0.1, sy);

      ctx.beginPath();
      const s = p.size;
      ctx.moveTo(0, -s * 0.5);
      ctx.bezierCurveTo(s * 0.55, -s * 0.35, s * 0.45, s * 0.35, 0, s * 0.5);
      ctx.bezierCurveTo(-s * 0.45, s * 0.35, -s * 0.55, -s * 0.35, 0, -s * 0.5);
      ctx.closePath();

      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.alpha})`;
      ctx.fill();

      ctx.strokeStyle = `rgba(${p.r},${p.g},${p.b},${p.alpha * 0.4})`;
      ctx.lineWidth = 0.3;
      ctx.stroke();

      ctx.restore();
    }

    loop(ts) {
      if (!this.running) return;
      requestAnimationFrame((t) => this.loop(t));

      const dt = ts - this.lastTime;
      if (dt < 28) return; // ~35fps cap for mobile battery
      this.lastTime = ts;

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);

      // Dust
      for (const d of this.dusts) {
        d.phase += d.speed;
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < -5) d.x = this.w + 5;
        if (d.x > this.w + 5) d.x = -5;
        if (d.y < -5) d.y = this.h + 5;
        if (d.y > this.h + 5) d.y = -5;

        const flicker = 0.45 + 0.55 * Math.sin(d.phase);
        const a = d.baseAlpha * flicker;

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,169,110,${a})`;
        ctx.fill();
      }

      // Petals
      for (let i = this.petals.length - 1; i >= 0; i--) {
        const p = this.petals[i];
        p.wobble += p.wobbleV;
        p.x += p.vx + Math.sin(p.wobble) * p.wobbleA;
        p.y += p.vy;
        p.rot += p.rotV;
        p.tilt += p.tiltV;

        if (p.y > this.h + 30) {
          this.petals[i] = this.newPetal(false);
          continue;
        }
        this.drawPetal(p);
      }
    }

    destroy() {
      this.running = false;
    }
  }

  /* ==========================================
     Loading Screen
     ========================================== */

  const loader = document.getElementById('loader');
  const loadStart = Date.now();

  function hideLoader() {
    const elapsed = Date.now() - loadStart;
    const wait = Math.max(0, CFG.loaderDuration - elapsed);
    setTimeout(() => {
      loader.classList.add('hidden');
      loader.addEventListener('transitionend', () => loader.remove(), { once: true });
      startCoverSequence();
    }, wait);
  }

  if (document.readyState === 'complete') hideLoader();
  else window.addEventListener('load', hideLoader);

  /* ==========================================
     Cover Entrance Sequence
     ========================================== */

  function startCoverSequence() {
    animateOrnament();

    document.querySelectorAll('[data-char-reveal]').forEach((el) => {
      const delay = parseInt(el.dataset.delay || '0', 10);
      splitAndReveal(el, delay);
    });

    document.querySelectorAll('.cover-fade').forEach((el) => {
      const delay = parseInt(el.dataset.delay || '0', 10);
      setTimeout(() => el.classList.add('shown'), delay);
    });
  }

  /* ==========================================
     Character Reveal
     ========================================== */

  function splitAndReveal(element, baseDelay) {
    const text = element.textContent.trim();
    if (!text) return;
    element.textContent = '';
    element.setAttribute('aria-label', text);

    [...text].forEach((char, i) => {
      const span = document.createElement('span');
      span.textContent = char === ' ' ? '\u00A0' : char;
      span.classList.add('char');
      const charDelay = baseDelay + i * 50;
      span.style.setProperty('--char-delay', `${charDelay}ms`);
      element.appendChild(span);
    });
  }

  /* ==========================================
     SVG Ornament Drawing
     ========================================== */

  function animateOrnament() {
    const svg = document.querySelector('.cover-ornament');
    if (!svg) return;

    const branches = svg.querySelectorAll('.ornament-branch');
    const paths = svg.querySelectorAll('.draw-path');
    const leaves = svg.querySelectorAll('.ornament-leaf');
    const buds = svg.querySelectorAll('.ornament-bud');

    paths.forEach((path) => {
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
    });

    setTimeout(() => {
      branches.forEach((b) => (b.style.opacity = '1'));
    }, 300);

    setTimeout(() => {
      paths.forEach((p) => p.classList.add('drawn'));
    }, 400);

    leaves.forEach((leaf, i) => {
      setTimeout(() => {
        leaf.style.opacity = leaf.getAttribute('fill-opacity') || '0.1';
        leaf.style.transition = 'opacity 0.8s ease';
      }, 900 + i * 120);
    });

    buds.forEach((bud, i) => {
      setTimeout(() => {
        bud.style.opacity = '0.5';
        bud.style.transition = 'opacity 0.6s ease';
      }, 1400 + i * 100);
    });
  }

  /* ==========================================
     Calendar
     ========================================== */

  function buildCalendar() {
    const container = document.getElementById('calendar');
    if (!container) return;

    const year = CFG.eventYear;
    const month = CFG.eventMonth - 1;
    const targetDay = CFG.eventDay;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    let html = '<div class="cal-header"><p class="cal-month">MARCH ' + year + '</p></div>';
    html += '<div class="cal-grid">';

    dayNames.forEach((n) => { html += '<span class="cal-day-name">' + n + '</span>'; });
    for (let i = 0; i < firstDay; i++) html += '<span class="cal-day empty"></span>';

    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay();
      let cls = 'cal-day';
      if (d === targetDay) cls += ' event-day';
      if (dow === 0) cls += ' sunday';
      html += '<span class="' + cls + '">' + d + '</span>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  buildCalendar();

  /* ==========================================
     Countdown (with pop animation)
     ========================================== */

  const cdEls = {
    days: document.getElementById('cd-days'),
    hours: document.getElementById('cd-hours'),
    mins: document.getElementById('cd-mins'),
    secs: document.getElementById('cd-secs')
  };
  const prevVals = { days: '', hours: '', mins: '', secs: '' };

  function setCountdownValue(el, val, key) {
    if (!el) return;
    if (prevVals[key] !== val) {
      el.textContent = val;
      el.classList.add('pop');
      setTimeout(() => el.classList.remove('pop'), 300);
      prevVals[key] = val;
    }
  }

  function updateCountdown() {
    let diff = CFG.eventDate - new Date();
    if (diff <= 0) {
      ['days', 'hours', 'mins', 'secs'].forEach((k) => setCountdownValue(cdEls[k], '0', k));
      const label = document.querySelector('.countdown-label-text');
      if (label) label.textContent = '상견례 당일입니다';
      return;
    }

    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5); diff -= h * 36e5;
    const m = Math.floor(diff / 6e4); diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);

    setCountdownValue(cdEls.days, String(d), 'days');
    setCountdownValue(cdEls.hours, String(h).padStart(2, '0'), 'hours');
    setCountdownValue(cdEls.mins, String(m).padStart(2, '0'), 'mins');
    setCountdownValue(cdEls.secs, String(s).padStart(2, '0'), 'secs');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  /* ==========================================
     Toast
     ========================================== */

  let toastTimer = null;

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }

  /* ==========================================
     Copy Helper
     ========================================== */

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
  }

  /* ==========================================
     Location Buttons
     ========================================== */

  document.getElementById('btn-naver-map')?.addEventListener('click', () => {
    window.open('https://map.naver.com/v5/search/' + encodeURIComponent(CFG.address), '_blank', 'noopener');
  });

  document.getElementById('btn-kakao-map')?.addEventListener('click', () => {
    window.open('https://map.kakao.com/?q=' + encodeURIComponent(CFG.address), '_blank', 'noopener');
  });

  document.getElementById('btn-copy-addr')?.addEventListener('click', async () => {
    await copyText(CFG.address);
    showToast('주소가 복사되었습니다');
  });

  /* ==========================================
     Share
     ========================================== */

  document.getElementById('btn-share')?.addEventListener('click', async () => {
    const data = {
      title: '상견례에 초대합니다',
      text: '정성문 · 송나은의 상견례에 초대합니다.\n2026년 3월 15일 일요일 오후 12시 30분\n' + CFG.venueName,
      url: location.href
    };
    if (navigator.share) {
      try { await navigator.share(data); } catch (e) {
        if (e.name !== 'AbortError') {
          await copyText(data.title + '\n' + data.text + '\n' + data.url);
          showToast('초대장 링크가 복사되었습니다');
        }
      }
    } else {
      await copyText(data.title + '\n' + data.text + '\n' + data.url);
      showToast('초대장 링크가 복사되었습니다');
    }
  });

  /* ==========================================
     Page-by-Page Scroll Controller (transform-based)
     ========================================== */

  const mainEl = document.getElementById('main');
  const sections = Array.from(document.querySelectorAll('.section'));
  const totalSections = sections.length;
  let currentSection = 0;
  let isAnimating = false;
  const ANIM_DURATION = 650;
  const SWIPE_THRESHOLD = 30;
  const SNAP_TRANSITION = 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)';

  let touchStartY = 0;
  let touchStartTime = 0;
  let touchMoveY = 0;
  let isTouching = false;

  const revealedSections = new Set();
  const progressBar = document.getElementById('scroll-progress');
  const scrollInd = document.querySelector('.scroll-indicator');
  let indicatorHidden = false;

  function revealSection(index) {
    const section = sections[index];
    if (!section || revealedSections.has(index)) return;
    revealedSections.add(index);
    section.classList.add('in-view');
    const els = section.querySelectorAll('.reveal:not(.visible)');
    els.forEach((el, i) => {
      el.style.transitionDelay = i * 0.14 + 's';
      el.classList.add('visible');
    });
  }

  function updateProgress() {
    if (!progressBar || totalSections <= 1) return;
    const pct = (currentSection / (totalSections - 1)) * 100;
    progressBar.style.width = pct + '%';
  }

  function updateScrollIndicator() {
    if (scrollInd && !indicatorHidden && currentSection > 0) {
      scrollInd.style.opacity = '0';
      scrollInd.style.transition = 'opacity 0.6s ease';
      indicatorHidden = true;
    }
  }

  function sectionOffset(index) {
    return -index * window.innerHeight;
  }

  function applyTransform(px) {
    mainEl.style.transform = 'translateY(' + px + 'px)';
  }

  function goToSection(index, instant) {
    if (index < 0 || index >= totalSections) return;
    if (index === currentSection && !instant) return;
    currentSection = index;
    if (instant) {
      mainEl.style.transition = 'none';
      applyTransform(sectionOffset(index));
      mainEl.offsetHeight;
      mainEl.style.transition = SNAP_TRANSITION;
    } else {
      isAnimating = true;
      mainEl.style.transition = SNAP_TRANSITION;
      applyTransform(sectionOffset(index));
      setTimeout(() => { isAnimating = false; }, ANIM_DURATION);
    }
    updateProgress();
    updateScrollIndicator();
    revealSection(currentSection);
  }

  // Recalculate position on resize (address bar show/hide, orientation change)
  window.addEventListener('resize', () => {
    if (!isTouching) {
      mainEl.style.transition = 'none';
      applyTransform(sectionOffset(currentSection));
      mainEl.offsetHeight;
      mainEl.style.transition = SNAP_TRANSITION;
    }
  });

  // Touch handling — real-time drag with snap
  window.addEventListener('touchstart', (e) => {
    if (isAnimating) return;
    touchStartY = e.touches[0].clientY;
    touchMoveY = touchStartY;
    touchStartTime = Date.now();
    isTouching = true;
    mainEl.style.transition = 'none';
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isTouching) return;
    e.preventDefault();
    touchMoveY = e.touches[0].clientY;

    const dragDelta = touchMoveY - touchStartY;
    const vp = window.innerHeight;
    const baseOffset = -currentSection * vp;

    const clamped = Math.max(-vp, Math.min(vp, dragDelta));
    let offset = baseOffset + clamped;

    // Rubber-band at boundaries
    const minOff = -(totalSections - 1) * vp;
    if (offset > 0) {
      offset = offset * 0.2;
    } else if (offset < minOff) {
      offset = minOff + (offset - minOff) * 0.2;
    }

    applyTransform(offset);
  }, { passive: false });

  function finishTouch() {
    if (!isTouching) return;
    isTouching = false;

    const dy = touchStartY - touchMoveY;
    const dt = Date.now() - touchStartTime;
    const velocity = Math.abs(dy) / Math.max(dt, 1);

    let target = currentSection;
    if (Math.abs(dy) > SWIPE_THRESHOLD || velocity > 0.3) {
      target += dy > 0 ? 1 : -1;
      target = Math.max(0, Math.min(totalSections - 1, target));
    }

    isAnimating = true;
    currentSection = target;
    mainEl.style.transition = SNAP_TRANSITION;
    applyTransform(sectionOffset(target));
    setTimeout(() => { isAnimating = false; }, ANIM_DURATION);

    updateProgress();
    updateScrollIndicator();
    revealSection(currentSection);
  }

  window.addEventListener('touchend', finishTouch, { passive: true });
  window.addEventListener('touchcancel', finishTouch, { passive: true });

  // Mouse wheel handling
  let wheelTimeout = null;
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (isAnimating) return;
    clearTimeout(wheelTimeout);
    wheelTimeout = setTimeout(() => {
      const direction = e.deltaY > 0 ? 1 : -1;
      goToSection(currentSection + direction);
    }, 50);
  }, { passive: false });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (isAnimating) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      goToSection(currentSection + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      goToSection(currentSection - 1);
    }
  });

  // Initialize
  applyTransform(0);
  mainEl.style.transition = SNAP_TRANSITION;
  revealSection(0);
  sections[0]?.classList.add('in-view');

  /* ==========================================
     Ripple Effect
     ========================================== */

  document.querySelectorAll('.ripple-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const ring = document.createElement('span');
      ring.classList.add('ripple-ring');
      ring.style.width = ring.style.height = size + 'px';
      ring.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ring.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(ring);
      ring.addEventListener('animationend', () => ring.remove());
    });
  });

  /* ==========================================
     Init Canvas
     ========================================== */

  const canvas = document.getElementById('bg-canvas');
  if (canvas && !CFG.prefersReducedMotion) {
    new AmbientCanvas(canvas);
  }

})();
