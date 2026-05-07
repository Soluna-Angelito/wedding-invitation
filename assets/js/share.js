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
// SDK loading strategy:
//   The Kakao SDK <script> in index.html is the *primary* loader (warm
//   parallel fetch, with SRI integrity for tamper-resistance). However,
//   some mobile environments (carrier filters, content blockers, iCloud
//   Private Relay, captive Wi-Fi) silently drop kakaocdn.net. To stay
//   functional in those cases this controller:
//     · Reads `window.__kakaoSdkStatus` set by the static <script>'s
//       onload/onerror so it can short-circuit when the SDK is already
//       known to be loaded.
//     · Falls back to dynamically injecting the SDK at click time when
//       `window.Kakao` is missing — without `crossorigin` so a failed
//       CORS preflight on the static path can't poison the dynamic one.
//     · Times the load out so a stuck network surfaces a clean toast
//       instead of a hung button.
//     · Surfaces a specific user-facing message for each failure mode
//       (blocked / timeout / init / send) so triage from the user's
//       phone narrows the cause without remote console access.

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

  function logKakao() {
    if (!global.console || !global.console.log) { return; }
    var args = ['[ShareKakao]'];
    for (var i = 0; i < arguments.length; i++) { args.push(arguments[i]); }
    try { global.console.log.apply(global.console, args); } catch (_) {}
  }

  function warnKakao() {
    if (!global.console || !global.console.warn) { return; }
    var args = ['[ShareKakao]'];
    for (var i = 0; i < arguments.length; i++) { args.push(arguments[i]); }
    try { global.console.warn.apply(global.console, args); } catch (_) {}
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
     Kakao SDK loader — deferred, idempotent, with fallback injection.
     ──────────────────────────────────────────────────────────────────
     Returns a promise resolving to `window.Kakao` (or rejecting with
     a `code`-tagged Error). The first invocation may inject a fresh
     <script> tag if the static one didn't load; subsequent calls
     reuse the same in-flight promise so multiple rapid clicks share
     a single load attempt instead of stacking up requests.
     ══════════════════════════════════════════════════════════════════ */

  // We defer to the static SRI-pinned URL by default so a CDN failure
  // bypasses SRI on the runtime fallback (some mobile networks rewrite
  // bytes in flight; SRI then blocks an otherwise-valid script). The
  // dynamic injection therefore drops `integrity` to maximize reach.
  var DEFAULT_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.1/kakao.min.js';
  var DEFAULT_LOAD_TIMEOUT_MS = 8000;

  var sdkLoadPromise = null;

  function tagError(message, code) {
    var err = new Error(message);
    err.code = code;
    return err;
  }

  // ──────────────────────────────────────────────────────────────────
  // CRITICAL: in Kakao SDK v2.x the modular namespaces (`Share`, `Auth`,
  // `API`, `Channel`, `Navi`, `Picker`, `Cert`) are NOT attached to
  // `window.Kakao` until `Kakao.init(JS_KEY)` has been called. Before
  // init, the base bundle exposes ONLY:
  //   VERSION · init · cleanup · isInitialized · isInAppBrowser
  // ──────────────────────────────────────────────────────────────────
  // "Loaded" therefore means the base bundle is on the page.
  // "Ready"  means we can call `Kakao.Share.sendScrap()` directly,
  //          i.e. init has run and the Share module is attached.
  function isKakaoLoaded() {
    return !!(global.Kakao && typeof global.Kakao.init === 'function');
  }

  function isKakaoReady() {
    return !!(global.Kakao && global.Kakao.Share &&
              typeof global.Kakao.Share.sendScrap === 'function');
  }

  function waitForExistingScript(scriptEl, timeoutMs) {
    return new Promise(function (resolve, reject) {
      // The browser may have already finished loading by the time we
      // wire listeners up. Probe synchronously first.
      if (isKakaoLoaded()) { resolve(global.Kakao); return; }
      if (global.__kakaoSdkStatus === 'error') {
        reject(tagError('Static Kakao SDK script reported error.', 'static-error'));
        return;
      }

      var done = false;
      var settle = function (fn, value) {
        if (done) { return; }
        done = true;
        scriptEl.removeEventListener('load', onLoad);
        scriptEl.removeEventListener('error', onError);
        global.clearTimeout(timer);
        fn(value);
      };
      var onLoad = function () {
        if (isKakaoLoaded()) { settle(resolve, global.Kakao); }
        else { settle(reject, tagError('SDK script loaded but window.Kakao is missing.', 'static-empty')); }
      };
      var onError = function () {
        settle(reject, tagError('Static Kakao SDK script failed to load.', 'static-error'));
      };
      var timer = global.setTimeout(function () {
        settle(reject, tagError('Static Kakao SDK load timed out.', 'static-timeout'));
      }, timeoutMs || DEFAULT_LOAD_TIMEOUT_MS);

      scriptEl.addEventListener('load', onLoad);
      scriptEl.addEventListener('error', onError);
    });
  }

  function injectSdkScript(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      // Deliberately no `integrity` / `crossorigin` here: this path
      // exists because the SRI-pinned static tag failed. Re-applying
      // the same constraints would just reproduce the failure.
      s.async = true;
      s.src = url;
      s.dataset.kakaoSdkFallback = 'true';

      var done = false;
      var settle = function (fn, value) {
        if (done) { return; }
        done = true;
        s.onload = null;
        s.onerror = null;
        global.clearTimeout(timer);
        fn(value);
      };

      s.onload = function () {
        if (isKakaoLoaded()) { settle(resolve, global.Kakao); }
        else { settle(reject, tagError('Fallback SDK script loaded but window.Kakao is missing.', 'fallback-empty')); }
      };
      s.onerror = function () {
        settle(reject, tagError('Fallback Kakao SDK script failed to load.', 'fallback-error'));
      };

      var timer = global.setTimeout(function () {
        settle(reject, tagError('Fallback Kakao SDK load timed out.', 'fallback-timeout'));
      }, timeoutMs || DEFAULT_LOAD_TIMEOUT_MS);

      try {
        document.head.appendChild(s);
      } catch (err) {
        settle(reject, tagError('Could not append fallback SDK script: ' + (err && err.message), 'inject-error'));
      }
    });
  }

  function loadKakaoSdk(config) {
    // Resolve immediately if the base bundle is already on the page.
    // Note: we intentionally check `isKakaoLoaded`, NOT `isKakaoReady`
    // — `Share` is only attached AFTER `Kakao.init()` runs, which is
    // the next step (handled by `ensureKakaoInitialized`).
    if (isKakaoLoaded()) { return Promise.resolve(global.Kakao); }
    if (sdkLoadPromise)  { return sdkLoadPromise; }

    var url       = (config && config.sdkUrl) || DEFAULT_SDK_URL;
    var timeoutMs = (config && config.sdkLoadTimeoutMs) || DEFAULT_LOAD_TIMEOUT_MS;
    var staticEl  = document.getElementById('kakaoSdkScript');

    var primary;
    if (staticEl && global.__kakaoSdkStatus !== 'error') {
      // Honour the static SRI-pinned tag first so SRI verification
      // continues to apply on the happy path.
      primary = waitForExistingScript(staticEl, timeoutMs);
    } else {
      primary = Promise.reject(tagError('Static SDK script unavailable.', 'static-missing'));
    }

    sdkLoadPromise = primary.catch(function (err) {
      warnKakao('Primary SDK load failed, falling back:', err && err.code, err && err.message);
      return injectSdkScript(url, timeoutMs);
    }).then(function (Kakao) {
      logKakao('SDK base bundle loaded (Share attaches on init).');
      return Kakao;
    }).catch(function (err) {
      // Reset so a future click can retry against a freshly built script.
      sdkLoadPromise = null;
      throw err;
    });

    return sdkLoadPromise;
  }


  /* ══════════════════════════════════════════════════════════════════
     Kakao SDK initialization
     ══════════════════════════════════════════════════════════════════ */

  function ensureKakaoInitialized(jsKey) {
    if (!isKakaoLoaded()) {
      throw tagError('Kakao SDK is not loaded.', 'sdk-missing');
    }
    if (!jsKey) {
      throw tagError('Missing Kakao JavaScript key.', 'no-key');
    }
    if (typeof global.Kakao.isInitialized === 'function' &&
        !global.Kakao.isInitialized()) {
      try {
        global.Kakao.init(jsKey);
      } catch (err) {
        throw tagError('Kakao.init failed: ' + (err && err.message), 'init-error');
      }
    }
    // After init the Share namespace MUST be present. If it isn't,
    // we're talking to an unexpected SDK shape (e.g. a future v3 with
    // a different module surface) and should bail with a clear error.
    if (!isKakaoReady()) {
      throw tagError('Kakao.Share unavailable after init.', 'share-missing');
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

  function pickToastForError(err, config) {
    var code = err && err.code;
    // Explicit network/load failures => the SDK genuinely never reached
    // the page. Surface the dedicated "module unavailable" copy so the
    // user understands they need to try a different network/browser.
    if (code === 'static-missing' ||
        code === 'static-error'   || code === 'static-timeout' ||
        code === 'fallback-error' || code === 'fallback-timeout' ||
        code === 'inject-error'   || code === 'sdk-missing'    ||
        code === 'static-empty'   || code === 'fallback-empty' ||
        code === 'share-missing') {
      return config.sdkUnavailableText ||
             '카카오톡 공유 모듈을 불러오지 못했어요.';
    }
    // Configuration or run-time API failures (init failed because the
    // JS key is wrong / domain not registered, sendScrap threw, etc.)
    // get the softer "try-again" copy because retrying may succeed.
    return config.kakaoErrorText ||
           '카카오톡 공유에 실패했어요. 잠시 후 다시 시도해 주세요.';
  }

  function setBusy(btn, busy) {
    if (!btn) { return; }
    if (busy) {
      btn.setAttribute('aria-busy', 'true');
      btn.classList.add('is-loading');
      btn.disabled = true;
    } else {
      btn.removeAttribute('aria-busy');
      btn.classList.remove('is-loading');
      btn.disabled = false;
    }
  }

  function bindKakaoButton(btn, config) {
    if (!btn) { return; }

    var jsKey      = config.kakaoJavascriptKey || '';
    var requestUrl = getRequestUrl(config);

    // Warm the SDK + run init() as soon as we wire the button so the
    // very first click skips both the network load AND the init step.
    // Best-effort: we swallow rejections here and re-attempt on click.
    if (jsKey) {
      loadKakaoSdk(config).then(function () {
        try { ensureKakaoInitialized(jsKey); }
        catch (err) {
          warnKakao('Warm-init failed:', err && err.code, err && err.message);
        }
      }).catch(function (err) {
        warnKakao('Warm-load failed:', err && err.code, err && err.message);
      });
    } else {
      warnKakao('Missing JavaScript key — share button is disarmed.');
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!jsKey) {
        showToast(config.kakaoErrorText ||
                  '카카오톡 공유에 실패했어요. 잠시 후 다시 시도해 주세요.',
                  config.toastMs);
        return;
      }

      setBusy(btn, true);
      loadKakaoSdk(config).then(function (Kakao) {
        ensureKakaoInitialized(jsKey);
        Kakao.Share.sendScrap({
          requestUrl: requestUrl,
          installTalk: true
        });
      }).catch(function (err) {
        warnKakao('Share failed:', err && err.code, err && err.message);
        showToast(pickToastForError(err, config), config.toastMs);
      }).then(function () {
        setBusy(btn, false);
      }, function () {
        setBusy(btn, false);
      });
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
      destroy: function () { /* listeners GC with the DOM nodes */ },
      // Exposed for ad-hoc diagnostics in DevTools / remote debug:
      //   WeddingInvitation.shareController.loadKakaoSdk()
      loadKakaoSdk: function () { return loadKakaoSdk(config); }
    };
  }


  /* ── Public API ──────────────────────────────────────────────────── */

  app.initShare = init;
  // Expose the loader so other modules / DevTools can probe it without
  // relying on private state. Lightweight enough to keep on the global.
  app.loadKakaoSdk = function () { return loadKakaoSdk(getConfig()); };

  document.addEventListener('DOMContentLoaded', function () {
    app.shareController = init();
  });

})(window);
