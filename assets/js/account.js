// assets/js/account.js
//
// Section 06 · 마음 전하실 곳 (Account / Gift)
// ────────────────────────────────────────────────────────────────────────
// Responsibilities:
//   1. Hydrate the editorial header copy (eyebrow / title / intro
//      lines / optional secondary line / optional closing) from
//      `WeddingConfig.account` so every user-facing string lives in
//      one place — config.js. Empty `soft` / `closing` values render
//      nothing, keeping the section quiet by default.
//   2. Render each side's member rows from
//      `WeddingConfig.account.{groom,bride}.members`. Rows are pure
//      typography (role · name → bank → account number) plus the
//      action buttons (복사 + optional 송금 deep-link). The previously
//      coloured bank chip was removed — the registry's brand colour
//      and initials fields are no longer rendered.
//   3. Set the single editorial label across each card head from
//      `WeddingConfig.account.{side}.headLabel` (e.g.
//      "마음 전하실 곳 : 신랑측"). The colon is split into a styled
//      separator span so it can be drawn lighter than the surrounding
//      copy without losing screen-reader semantics.
//   4. Wire the two collapsible cards (accordion) — toggling the
//      `.is-open` class drives the smooth grid-template-rows
//      0fr → 1fr height transition declared in account.css. ARIA
//      `aria-expanded` is kept in sync for screen readers.
//   5. Wire the per-row `복사` buttons — Clipboard API with an
//      `execCommand('copy')` fallback, surfaced via the existing
//      `#locationToast` element so the page only ever needs one
//      toast surface.
//   6. IntersectionObserver-driven `.is-visible` reveals + a static
//      fallback for `prefers-reduced-motion` users.
//
// Notes:
//   • This file mirrors the structure of `letter.js` / `location.js`
//     (IIFE, `app.initAccount`, DOMContentLoaded init) so tooling +
//     mental model stay consistent across the codebase.
//   • Templates are built with `document.createElement` — no innerHTML
//     parsing of user-keyed strings. This keeps the section safe from
//     accidentally embedding HTML in a member's name or bank label.

(function (global) {
  'use strict';

  var app = global.WeddingInvitation = global.WeddingInvitation || {};

  function getConfig() {
    return (global.WeddingConfig && global.WeddingConfig.account) || {};
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
     SVG factories — used by the row renderer below. Keeping them as
     small functions instead of inlining `innerHTML` makes the row
     templates uniform and lets us tweak stroke widths in one place.
     ══════════════════════════════════════════════════════════════════ */

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function copyIconSVG() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    var rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', '9');
    rect.setAttribute('y', '9');
    rect.setAttribute('width', '11');
    rect.setAttribute('height', '11');
    rect.setAttribute('rx', '2');
    svg.appendChild(rect);

    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
    svg.appendChild(path);

    return svg;
  }

  function checkIconSVG() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    var poly = document.createElementNS(SVG_NS, 'polyline');
    poly.setAttribute('points', '5 13 10 18 20 6');
    svg.appendChild(poly);

    return svg;
  }

  function kakaoBubbleSVG() {
    // Compact "speech bubble" mark — recognisable as Kakao without
    // shipping the official wordmark (which is trademarked).
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute(
      'd',
      'M12 4C6.5 4 2 7.6 2 12c0 2.7 1.7 5 4.4 6.5L5.6 21l3.4-2c1 .2 2 .3 3 .3 5.5 0 10-3.6 10-8s-4.5-7.3-10-7.3z'
    );
    svg.appendChild(path);

    return svg;
  }


  /* ══════════════════════════════════════════════════════════════════
     Header hydration — config → DOM
     Driven from data-account-slot attributes on the section template
     so it stays template-agnostic if those copy lines ever move.
     ══════════════════════════════════════════════════════════════════ */

  function populateHeader(accountEl, config) {
    var intro = (config && config.intro) || {};
    setText(accountEl.querySelector('[data-account-slot="eyebrow"]'), intro.eyebrow);
    setText(accountEl.querySelector('[data-account-slot="title"]'),   intro.title);

    var linesContainer = accountEl.querySelector('[data-account-slot="lines"]');
    if (linesContainer && Array.isArray(intro.lines)) {
      // Clear any HTML-authored fallback copy and re-emit from config.
      linesContainer.innerHTML = '';
      for (var i = 0; i < intro.lines.length; i++) {
        var p = document.createElement('p');
        p.textContent = intro.lines[i];
        linesContainer.appendChild(p);
      }
      // Optional secondary line — only rendered when config provides
      // a non-empty `soft` string. Empty/undefined keeps the section
      // free of the smaller "감사" line.
      if (intro.soft) {
        var softP = document.createElement('p');
        softP.className = 'account__intro-soft';
        softP.textContent = intro.soft;
        linesContainer.appendChild(softP);
      }
    }

    // The closing "감사합니다" element was removed from the HTML
    // template, but defensively hide any straggler if config.closing
    // is empty so legacy templates still render correctly.
    var closingHost = accountEl.querySelector('[data-account-slot="closing"]');
    if (closingHost) {
      if (config.closing) {
        closingHost.textContent = config.closing;
      } else {
        var closingWrap = closingHost.closest('.account__closing');
        if (closingWrap) {
          closingWrap.remove();
        } else {
          closingHost.textContent = '';
        }
      }
    }
  }


  /* ══════════════════════════════════════════════════════════════════
     Per-side card head hydration — sets the single editorial label
     printed across the head (e.g. "마음 전하실 곳 : 신랑측"). The
     ornament mark and chevron are static decoration in the HTML
     template; this function only swaps the typographic line.
     ══════════════════════════════════════════════════════════════════ */

  function populateCardHead(card, sideConfig) {
    if (!card || !sideConfig) { return; }

    var labelEl = card.querySelector('[data-account-card-label]');
    if (!labelEl) { return; }

    // Prefer the new explicit `headLabel`; fall back to combining the
    // legacy `tag` field with the section title for backwards compat.
    var label = sideConfig.headLabel;
    if (!label) {
      var tag = sideConfig.tag || '';
      label = tag ? '마음 전하실 곳 : ' + tag : '';
    }
    if (!label) { return; }

    // Split on the colon so the separator can be styled distinctly
    // (lighter weight, calibrated spacing) without sacrificing the
    // single-line semantic copy in screen readers. The colon sits
    // tight against the prefix ("…곳:"), with breathing room after
    // it ("…곳: 신랑측") — standard Korean editorial typography.
    var parts = label.split(/\s*:\s*/);
    labelEl.textContent = '';
    if (parts.length === 2) {
      labelEl.appendChild(document.createTextNode(parts[0]));
      var sep = document.createElement('span');
      sep.className = 'account__card-label-sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = ':';
      labelEl.appendChild(sep);
      labelEl.appendChild(document.createTextNode(' ' + parts[1]));
    } else {
      labelEl.textContent = label;
    }
  }


  /* ══════════════════════════════════════════════════════════════════
     Member row template — meta block (pure typography, no bank chip)
     + actions (refined ghost copy / 송금 buttons).

     `getBank()` is still used to translate the member's bank code
     into the displayed bank name; the brand colour / initials
     fields on each registry entry are simply ignored now that the
     coloured chip has been removed in favour of an editorial layout
     that avoids the "credit-card" feel beside the photo-book pages
     above and below this section.
     ══════════════════════════════════════════════════════════════════ */

  function getBank(config, code) {
    var banks = (config && config.banks) || {};
    if (banks[code]) { return banks[code]; }
    // Graceful fallback: render an unknown bank as a neutral chip
    // with the literal code as a tiny initials so nothing crashes.
    return {
      name: code || '',
      bg: '#d8cdbb',
      ink: '#2f2824',
      initials: (code || '?').toString().slice(0, 2).toUpperCase()
    };
  }

  function buildMemberRow(member, config) {
    var bank = getBank(config, member.bank);

    var li = document.createElement('li');
    li.className = 'account__item';

    /* ── Meta block ─────────────────────────────────────────────────
       The editorial layout drops the brand-coloured bank chip in
       favour of pure typography:
         · role (small caps muted) · name (larger ink)
         · bank name (muted)
         · account number (tabular figures, larger emphasis)
       This mirrors the letter / location sections' restrained
       photo-book aesthetic and avoids the "credit-card" feel. */
    var meta = document.createElement('div');
    meta.className = 'account__item-meta';

    var nameRow = document.createElement('div');
    nameRow.className = 'account__item-name';
    if (member.role) {
      var roleBadge = document.createElement('span');
      roleBadge.className = 'account__item-role';
      roleBadge.textContent = member.role;
      nameRow.appendChild(roleBadge);
    }
    nameRow.appendChild(document.createTextNode(member.name || ''));
    meta.appendChild(nameRow);

    /* Bank name + account number share a single editorial line, with
       a quiet middot separator between them. Wrapping in a flex
       container lets the line gracefully break on small viewports
       while keeping the two pieces visually paired. */
    var bankLine = document.createElement('div');
    bankLine.className = 'account__item-bank-line';

    var bankText = document.createElement('span');
    bankText.className = 'account__item-bank';
    bankText.textContent = bank.name || '';
    bankLine.appendChild(bankText);

    if (bank.name && member.number) {
      var sepDot = document.createElement('span');
      sepDot.className = 'account__item-bank-line-sep';
      sepDot.setAttribute('aria-hidden', 'true');
      sepDot.textContent = '·';
      bankLine.appendChild(sepDot);
    }

    var numberText = document.createElement('span');
    numberText.className = 'account__item-number';
    numberText.textContent = member.number || '';
    bankLine.appendChild(numberText);

    meta.appendChild(bankLine);

    li.appendChild(meta);

    /* ── Actions ───────────────────────────────────────────────── */
    var actions = document.createElement('div');
    actions.className = 'account__item-actions';

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'account__btn account__btn--copy';
    copyBtn.setAttribute('data-account-copy', member.number || '');
    copyBtn.setAttribute(
      'aria-label',
      (member.name || '') + ' 계좌번호 복사'
    );
    copyBtn.appendChild(copyIconSVG());
    var copyLabel = document.createElement('span');
    copyLabel.textContent = '계좌번호 복사';
    copyBtn.appendChild(copyLabel);
    actions.appendChild(copyBtn);

    if (member.kakaopay) {
      var payLink = document.createElement('a');
      payLink.className = 'account__btn account__btn--kakao';
      payLink.href = member.kakaopay;
      payLink.target = '_blank';
      payLink.rel = 'noopener noreferrer';
      payLink.setAttribute(
        'aria-label',
        (member.name || '') + ' 카카오페이로 송금'
      );
      payLink.appendChild(kakaoBubbleSVG());
      var paySpan = document.createElement('span');
      paySpan.textContent = '송금';
      payLink.appendChild(paySpan);
      actions.appendChild(payLink);
    }

    li.appendChild(actions);
    return li;
  }

  function renderSide(accountEl, sideKey, config) {
    var listEl = accountEl.querySelector(
      '[data-account-list="' + sideKey + '"]'
    );
    if (!listEl) { return; }

    listEl.innerHTML = '';

    var side = config[sideKey];
    if (!side || !Array.isArray(side.members)) { return; }

    for (var i = 0; i < side.members.length; i++) {
      listEl.appendChild(buildMemberRow(side.members[i], config));
    }
  }


  /* ══════════════════════════════════════════════════════════════════
     Accordion — open/close per card with smooth height transition
     driven by CSS (grid-template-rows 0fr → 1fr).
     ══════════════════════════════════════════════════════════════════ */

  function setupAccordion(accountEl) {
    var heads = accountEl.querySelectorAll('[data-account-toggle]');

    for (var i = 0; i < heads.length; i++) {
      (function (head) {
        var card = head.closest('.account__card');
        if (!card) { return; }

        head.addEventListener('click', function () {
          var isOpen = card.classList.toggle('is-open');
          head.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
      })(heads[i]);
    }
  }


  /* ══════════════════════════════════════════════════════════════════
     Clipboard copy — Clipboard API → execCommand fallback → prompt
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


  /* ══════════════════════════════════════════════════════════════════
     Toast — reuses the existing `#locationToast` so the page never
     ships two toast surfaces. The toast text is swapped per call so
     the same pill can announce both 주소가 / 계좌번호가 복사되었습니다.
     ══════════════════════════════════════════════════════════════════ */

  function showToast(message, durationMs) {
    var toast = document.getElementById('locationToast');
    if (!toast) { return; }

    var label = toast.querySelector('.location-toast__text');
    if (label && message) { label.textContent = message; }

    toast.setAttribute('aria-hidden', 'false');
    toast.classList.add('is-visible');

    if (showToast._timerId) { global.clearTimeout(showToast._timerId); }
    showToast._timerId = global.setTimeout(function () {
      toast.classList.remove('is-visible');
      toast.setAttribute('aria-hidden', 'true');
    }, durationMs || 2200);
  }

  function setupCopyButtons(accountEl, config) {
    var toastMs = (config && config.copyToastMs) || 2200;

    accountEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-account-copy]');
      if (!btn || !accountEl.contains(btn)) { return; }

      var raw = btn.getAttribute('data-account-copy') || '';
      // Strip whitespace so the clipboard payload is the canonical
      // digits-and-hyphens form most banking apps expect.
      var payload = raw.replace(/\s+/g, '');

      copyToClipboard(payload).then(function () {
        btn.classList.add('is-copied');
        // Briefly swap the icon to a check mark for stronger feedback.
        var svg = btn.querySelector('svg');
        if (svg) {
          var replacement = checkIconSVG();
          btn.insertBefore(replacement, svg);
          btn.removeChild(svg);
          global.setTimeout(function () {
            // Restore the copy icon a moment after the toast clears.
            try {
              var current = btn.querySelector('svg');
              if (current) {
                btn.insertBefore(copyIconSVG(), current);
                btn.removeChild(current);
              }
            } catch (_) {}
            btn.classList.remove('is-copied');
          }, toastMs);
        } else {
          global.setTimeout(function () {
            btn.classList.remove('is-copied');
          }, toastMs);
        }

        showToast('계좌번호가 복사되었습니다', toastMs);
      }).catch(function () {
        try { global.prompt('아래 계좌번호를 복사하세요', payload); } catch (_) {}
      });
    });
  }


  /* ══════════════════════════════════════════════════════════════════
     Scroll-Reveal Animations + Static Fallback
     ══════════════════════════════════════════════════════════════════ */

  function setupReveals(accountEl, config) {
    var rootMargin = (config && config.rootMargin) || '0px 0px -10% 0px';
    var threshold  = (config && config.threshold != null) ? config.threshold : 0.14;

    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) { continue; }
        var el = entries[i].target;
        el.classList.add('is-visible');
        observer.unobserve(el);
      }
    }, { rootMargin: rootMargin, threshold: threshold });

    var ornamentObserver = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) { continue; }
        entries[i].target.classList.add('is-drawn');
        ornamentObserver.unobserve(entries[i].target);
      }
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.05 });

    var reveals = accountEl.querySelectorAll('[data-reveal]');
    for (var i = 0; i < reveals.length; i++) {
      observer.observe(reveals[i]);
    }

    var ornaments = accountEl.querySelectorAll('.account__ornament');
    for (var j = 0; j < ornaments.length; j++) {
      ornamentObserver.observe(ornaments[j]);
    }

    return {
      destroy: function () {
        observer.disconnect();
        ornamentObserver.disconnect();
      }
    };
  }

  function showStatic(accountEl) {
    accountEl.classList.remove('account--animated');

    var elements = accountEl.querySelectorAll('[data-reveal], [data-reveal-item]');
    for (var i = 0; i < elements.length; i++) {
      elements[i].classList.add('is-visible');
      elements[i].style.opacity = '1';
      elements[i].style.transform = 'none';
    }

    var ornaments = accountEl.querySelectorAll('.account__ornament');
    for (var j = 0; j < ornaments.length; j++) {
      ornaments[j].classList.add('is-drawn');
    }
  }


  /* ══════════════════════════════════════════════════════════════════
     Main Initialization
     ══════════════════════════════════════════════════════════════════ */

  function init() {
    var accountEl = document.getElementById('account');
    if (!accountEl) { return null; }

    var config = getConfig();

    populateHeader(accountEl, config);

    var groomCard = accountEl.querySelector('[data-account-side="groom"]');
    var brideCard = accountEl.querySelector('[data-account-side="bride"]');
    populateCardHead(groomCard, config.groom);
    populateCardHead(brideCard, config.bride);

    renderSide(accountEl, 'groom', config);
    renderSide(accountEl, 'bride', config);

    setupAccordion(accountEl);
    setupCopyButtons(accountEl, config);

    if (prefersReducedMotion()) {
      showStatic(accountEl);
      return { destroy: function () {} };
    }

    accountEl.classList.add('account--animated');
    var reveals = setupReveals(accountEl, config);

    var mq = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)');
    function onMotionChange(e) {
      if (!e.matches) { return; }
      showStatic(accountEl);
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
        if (reveals) { reveals.destroy(); }
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

  app.initAccount = init;

  document.addEventListener('DOMContentLoaded', function () {
    app.accountController = init();
  });

})(window);
