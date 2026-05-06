// assets/js/share.js
//
// Section 07 · Share row (카카오톡 공유 + 링크 복사)
// ────────────────────────────────────────────────────────────────────────
// Powers the two secondary share buttons placed beneath the primary
// `사진 보내러 가기` Pulitzer CTA:
//
//   1. 카카오톡 공유 — uses `Kakao.Share.sendScrap({ requestUrl })` which
//      asks Kakao's edge to scrape the OG metadata from `requestUrl` and
//      render the preview tile. The matching `og:*` tags live inline in
//      `index.html`, and `requestUrl` must point at a domain registered
//      under `[App] > [Product Link] > [Web Domain]` inside the Kakao
//      Developers console (see `Kakao/KAKAO_SHARE_APPLY_GUIDE.md`).
//
//   2. 링크 복사    — copies the same canonical URL to the clipboard
//      using the modern `navigator.clipboard.writeText` API, with an
//      `execCommand('copy')` fallback for older browsers and a
//      last-resort `window.prompt()` so the user can always grab the
//      string. Feedback rides the existing `#locationToast` pill so we
//      don't introduce another floating surface.
//
// Why a dedicated module instead of folding into snapshot.js:
//   · The Kakao SDK is loaded from a CDN and may not be present on
//     networks that block Kakao domains. Isolating this controller
//     means a Kakao-side outage cannot regress the upload flow.
//   · The clipboard logic mirrors location.js but writes a different
//     payload (the share URL, not the venue address) — sharing those
//     two paths via copy/paste keeps each module self-contained.

(function (global) {
  'use strict';

  var app = global.WeddingInvitation = global.WeddingInvitation || {};

  /* ── Config + small helpers ───────────────────────────────────────── */

  function getConfig() {
    return (global.WeddingConfig && global.WeddingConfig.share) || {};
  }

  function getRequestUrl(config) {
    if (config.requestUrl) {
      return String(config.requestUrl);
    }
    // Fallback: the page itself, with a clean origin + pathname so we
    // never share `?debug=…` or hash fragments by accident.
    if (global.location) {
      var origin = global.location.origin || '';
      var path   = global.location.pathname || '/';
      return origin + path;
    }
    return '';
  }


  /* ══════════════════════════════════════════════════════════════════
     Toast — reuses the global `#locationToast` rendered at the end of
     <body>. We treat the toast as a shared singleton so consecutive
     clicks (e.g. user taps Copy then Kakao) replace the previous text
     without stacking multiple pills.
     ══════════════════════════════════════════════════════════════════ */

  var toastTimerId = null;

  function showToast(text, durationMs) {
    var toast = document.getElementById('locationToast');
    if (!toast) { return; }
    var label = toast.querySelector('.location-toast__text');
    if (label && text) { label.textContent = text; }
    toast.setAttribute('aria-hidden', 'false');
    toast.classList.add('is-visible');
    if (toastTimerId) { global.clearTimeout(toastTimerId); }
    toastTimerId = global.setTimeout(function () {
      toast.classList.remove('is-visible');
      toast.setAttribute('aria-hidden', 'true');
      toastTimerId = null;
    }, durationMs || 2200);
  }


  /* ══════════════════════════════════════════════════════════════════
     Kakao SDK initialization
     ──────────────────────────────────────────────────────────────────
     `init()` must be called exactly once per page load with the app's
     JavaScript key. The SDK guards against double-init internally, but
     calling `isInitialized()` first keeps the console clean during HMR
     reloads or repeated navigations within the same SPA shell.
     ══════════════════════════════════════════════════════════════════ */

  function ensureKakaoInitialized(jsKey) {
    if (!global.Kakao || !global.Kakao.Share) {
      throw new Error('Kakao SDK is not loaded.');
    }
    if (typeof global.Kakao.isInitialized === 'function' &&
        !global.Kakao.isInitialized()) {
      global.Kakao.init(jsKey);
    }
  }


  /* ══════════════════════════════════════════════════════════════════
     Clipboard — progressive fallback chain
     ──────────────────────────────────────────────────────────────────
     1. `navigator.clipboard.writeText` (secure contexts: https + most
        modern browsers, including iOS 13.4+ and Android Chrome 66+).
     2. `document.execCommand('copy')` against a hidden <textarea>
        (legacy path; works on older WebViews + http origins).
     3. The caller falls back to `window.prompt()` so the user can
        manually copy from the dialog.
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
        if (ok) { resolve(); }
        else    { reject(new Error('execCommand copy failed')); }
      } catch (err) {
        reject(err);
      }
    });
  }


  /* ══════════════════════════════════════════════════════════════════
     Wiring
     ══════════════════════════════════════════════════════════════════ */

  function bindKakaoButton(btn, config) {
    if (!btn) { return; }

    var jsKey      = config.kakaoJavascriptKey || '';
    var requestUrl = getRequestUrl(config);

    btn.addEventListener('click', function (e) {
      e.preventDefault();

      // SDK availability check — gracefully degrade if Kakao's CDN is
      // blocked, the script hasn't loaded yet, or the user is offline.
      if (!global.Kakao || !global.Kakao.Share) {
        showToast(config.sdkUnavailableText ||
                  '카카오톡 공유 모듈을 불러오지 못했어요.',
                  config.toastMs);
        return;
      }
      if (!jsKey) {
        // Misconfiguration; surface to console for the developer but
        // keep the user-facing toast soft.
        global.console && global.console.warn &&
          global.console.warn('[ShareKakao] Missing JavaScript key.');
        showToast(config.kakaoErrorText ||
                  '카카오톡 공유에 실패했어요. 잠시 후 다시 시도해 주세요.',
                  config.toastMs);
        return;
      }

      try {
        ensureKakaoInitialized(jsKey);
        global.Kakao.Share.sendScrap({
          requestUrl: requestUrl,
          installTalk: true
        });
      } catch (err) {
        global.console && global.console.error &&
          global.console.error('[ShareKakao]', err);
        showToast(config.kakaoErrorText ||
                  '카카오톡 공유에 실패했어요. 잠시 후 다시 시도해 주세요.',
                  config.toastMs);
      }
    });
  }

  function bindCopyButton(btn, config) {
    if (!btn) { return; }

    var requestUrl = getRequestUrl(config);
    var copyText   = config.copyToastText || '링크가 복사되었습니다';
    var toastMs    = config.toastMs || 2200;

    btn.addEventListener('click', function (e) {
      e.preventDefault();

      copyToClipboard(requestUrl).then(function () {
        // Visual confirmation: toggle the success class for ~the toast
        // lifetime so the icon flips to a check + the pill breathes.
        btn.classList.add('is-copied');
        showToast(copyText, toastMs);
        global.setTimeout(function () {
          btn.classList.remove('is-copied');
        }, toastMs);
      }).catch(function () {
        // Last-resort fallback — works even on locked-down WebViews
        // where both clipboard APIs are unavailable.
        try {
          global.prompt('아래 링크를 복사하세요', requestUrl);
        } catch (_) {
          showToast('링크 복사에 실패했어요.', toastMs);
        }
      });
    });
  }


  /* ══════════════════════════════════════════════════════════════════
     Main Initialization
     ══════════════════════════════════════════════════════════════════ */

  function init() {
    var kakaoBtn = document.getElementById('shareKakaoBtn');
    var copyBtn  = document.getElementById('shareCopyLinkBtn');
    if (!kakaoBtn && !copyBtn) { return null; }

    var config = getConfig();

    bindKakaoButton(kakaoBtn, config);
    bindCopyButton(copyBtn,  config);

    return {
      destroy: function () { /* listeners GC with the DOM nodes */ }
    };
  }


  /* ── Public API ──────────────────────────────────────────────────── */

  app.initShare = init;

  document.addEventListener('DOMContentLoaded', function () {
    app.shareController = init();
  });

})(window);
