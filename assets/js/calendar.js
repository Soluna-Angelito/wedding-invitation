// assets/js/calendar.js
(function (global) {
  'use strict';

  var app = global.WeddingInvitation = global.WeddingInvitation || {};

  function getConfig() {
    return (global.WeddingConfig && global.WeddingConfig.calendar) || {};
  }

  function prefersReducedMotion() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }


  /* ══════════════════════════════════════════════════════════════════
     Number Roller — odometer-style slide-up transition
     Each `.calendar__countdown-num` is a fixed-height window that clips
     a vertical stack (`.num-roller`) of `.num-roller__cell` elements.
     When the value changes:
       1. A new cell is appended below the current cell.
       2. The roller slides up by one cell height (translateY(-50%)
          since exactly two cells are present, totaling 200% height).
       3. After the transition, the old (top) cell is removed and the
          roller transform is reset — leaving only the new cell.
     This avoids any layout reflow during the slide.
     ══════════════════════════════════════════════════════════════════ */

  function setNumber(windowEl, value, animate) {
    if (!windowEl) {
      return;
    }

    var roller = windowEl.querySelector('.num-roller');
    if (!roller) {
      windowEl.textContent = String(value);
      return;
    }

    var strVal = String(value);
    var cells  = roller.querySelectorAll('.num-roller__cell');

    /* If a previous transition is still in flight, finalize it instantly.
       Snap to the latest value and leave a single cell. */
    if (cells.length > 1) {
      while (roller.firstChild !== roller.lastChild) {
        roller.removeChild(roller.firstChild);
      }
      var only = roller.firstChild;
      only.textContent = strVal;
      roller.style.transition = 'none';
      roller.classList.remove('is-sliding');
      // Force reflow before re-enabling transitions.
      void roller.offsetHeight;
      roller.style.transition = '';
      return;
    }

    var currentCell = cells[0];
    if (!currentCell) {
      currentCell = document.createElement('span');
      currentCell.className = 'num-roller__cell';
      currentCell.textContent = strVal;
      roller.appendChild(currentCell);
      return;
    }

    if (currentCell.textContent === strVal) {
      return;
    }

    if (!animate) {
      currentCell.textContent = strVal;
      return;
    }

    /* Append the new value below the current cell, then slide. */
    var newCell = document.createElement('span');
    newCell.className = 'num-roller__cell';
    newCell.textContent = strVal;
    roller.appendChild(newCell);

    /* Force reflow so the new cell is laid out before the transition starts. */
    void roller.offsetHeight;

    roller.classList.add('is-sliding');

    var cleanup = function () {
      roller.removeEventListener('transitionend', onEnd);
      global.clearTimeout(fallbackId);

      /* Snap back without animation, dropping the old (top) cell. */
      roller.style.transition = 'none';
      roller.classList.remove('is-sliding');
      if (currentCell && currentCell.parentNode === roller) {
        roller.removeChild(currentCell);
      }
      void roller.offsetHeight;
      roller.style.transition = '';
    };

    var onEnd = function (e) {
      if (e.target !== roller) {
        return;
      }
      cleanup();
    };

    roller.addEventListener('transitionend', onEnd);
    /* Fallback in case transitionend doesn't fire (e.g. tab backgrounded). */
    var fallbackId = global.setTimeout(cleanup, 900);
  }


  /* ══════════════════════════════════════════════════════════════════
     Countdown Timer
     ══════════════════════════════════════════════════════════════════ */

  function createCountdown(config) {
    var weddingDateStr = config.weddingDate || '2026-07-12T12:00:00+09:00';
    var weddingTime = new Date(weddingDateStr).getTime();

    if (isNaN(weddingTime)) {
      return null;
    }

    var intervalId = null;
    var firstUpdate = true;

    var daysEl   = document.getElementById('countdownDays');
    var hoursEl  = document.getElementById('countdownHours');
    var minsEl   = document.getElementById('countdownMins');
    var secsEl   = document.getElementById('countdownSecs');
    var labelEl  = document.getElementById('countdownLabel');
    var wrapEl   = document.getElementById('calendarCountdown');

    if (!daysEl || !hoursEl || !minsEl || !secsEl) {
      return null;
    }

    var reducedMotion = prefersReducedMotion();

    function padTwo(n) {
      return n < 10 ? '0' + n : String(n);
    }

    function isSameDay(t1, t2) {
      var d1 = new Date(t1);
      var d2 = new Date(t2);
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
    }

    function update() {
      var now  = Date.now();
      var diff = weddingTime - now;
      var animate = !firstUpdate && !reducedMotion;

      if (diff <= 0) {
        if (isSameDay(weddingTime, now)) {
          if (labelEl) { labelEl.textContent = '오늘 결혼합니다'; }
          if (wrapEl)  { wrapEl.classList.add('calendar__countdown--dday'); }
          setNumber(daysEl,  0,    animate);
          setNumber(hoursEl, '00', animate);
          setNumber(minsEl,  '00', animate);
          setNumber(secsEl,  '00', animate);
        } else {
          var pastDays = Math.floor((now - weddingTime) / 86400000);
          if (labelEl) { labelEl.textContent = '결혼한 지 ' + pastDays + '일'; }
          if (wrapEl)  { wrapEl.classList.add('calendar__countdown--past'); }
        }

        if (intervalId) {
          global.clearInterval(intervalId);
          intervalId = null;
        }
        firstUpdate = false;
        return;
      }

      var totalSec = Math.floor(diff / 1000);
      var days     = Math.floor(totalSec / 86400);
      var hours    = Math.floor((totalSec % 86400) / 3600);
      var minutes  = Math.floor((totalSec % 3600) / 60);
      var seconds  = totalSec % 60;

      setNumber(daysEl,  days,           animate);
      setNumber(hoursEl, padTwo(hours),  animate);
      setNumber(minsEl,  padTwo(minutes), animate);
      setNumber(secsEl,  padTwo(seconds), animate);

      firstUpdate = false;
    }

    update();
    intervalId = global.setInterval(update, config.countdownUpdateMs || 1000);

    return {
      destroy: function () {
        if (intervalId) {
          global.clearInterval(intervalId);
          intervalId = null;
        }
      }
    };
  }


  /* ══════════════════════════════════════════════════════════════════
     Scroll-Reveal Animations (IntersectionObserver)
     ══════════════════════════════════════════════════════════════════ */

  function setupReveals(calendarEl, config) {
    var rootMargin = config.rootMargin || '0px 0px -12% 0px';
    var threshold  = (config.threshold != null) ? config.threshold : 0.15;

    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) {
          continue;
        }
        entries[i].target.classList.add('is-visible');
        observer.unobserve(entries[i].target);
      }
    }, { rootMargin: rootMargin, threshold: threshold });

    var reveals = calendarEl.querySelectorAll('[data-reveal]');
    for (var i = 0; i < reveals.length; i++) {
      observer.observe(reveals[i]);
    }

    return observer;
  }


  /* ══════════════════════════════════════════════════════════════════
     Static Fallback (reduced motion / no-JS graceful degradation)
     ══════════════════════════════════════════════════════════════════ */

  function showStatic(calendarEl) {
    calendarEl.classList.remove('calendar--animated');

    var elements = calendarEl.querySelectorAll(
      '[data-reveal], .calendar__grid thead tr, .calendar__grid tbody tr'
    );
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
    var calendarEl = document.getElementById('calendar');
    if (!calendarEl) {
      return null;
    }

    var config    = getConfig();
    var countdown = createCountdown(config);

    if (prefersReducedMotion()) {
      showStatic(calendarEl);
      return {
        countdown: countdown,
        destroy: function () {
          if (countdown) { countdown.destroy(); }
        }
      };
    }

    calendarEl.classList.add('calendar--animated');
    var observer = setupReveals(calendarEl, config);

    /* Listen for runtime reduced-motion changes */
    var mq = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)');

    function onMotionChange(e) {
      if (!e.matches) { return; }
      showStatic(calendarEl);
    }

    if (mq) {
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onMotionChange);
      } else if (typeof mq.addListener === 'function') {
        mq.addListener(onMotionChange);
      }
    }

    return {
      countdown: countdown,
      destroy: function () {
        if (observer)  { observer.disconnect(); }
        if (countdown) { countdown.destroy();   }
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

  app.initCalendar = init;

  document.addEventListener('DOMContentLoaded', function () {
    app.calendarController = init();
  });

})(window);
