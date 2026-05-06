// assets/js/snapshot.js
//
// Section 07 · Pulitzer (오늘은 내가 퓰리처)
// ────────────────────────────────────────────────────────────────────────
// Responsibilities:
//   1. Hydrate every user-facing string (eyebrow / title / subtitle /
//      CTA label) from `WeddingConfig.snapshot` so a single config edit
//      re-flows the section.
//   2. Wire the `사진 보내러 가기` button to open an inline upload
//      modal at the end of <body>. The modal walks the guest through:
//        a. typing their name (single small input)
//        b. picking up to `maxPhotos` photos (≤ `maxBytesPerPhoto` each)
//           via gallery picker, camera capture, or native drag-and-drop
//        c. inspecting + deleting any item from the queue before sending
//        d. sending the batch sequentially to the Apps Script `/exec`
//           endpoint via `fetch(... method:'POST', body: FormData)` —
//           one file per request, mirroring the existing
//           `uploadGuestPhoto()` payload shape.
//   3. Apply the existing IntersectionObserver-driven `.is-visible`
//      reveals + a static fallback for `prefers-reduced-motion` users.
//
// All upload limits + the Apps Script `/exec` URL come from
// `WeddingConfig.snapshot`. The matching server-side `doPost(e)` is in
// `Google Apps Script/code.gs`.

(function (global) {
  'use strict';

  var app = global.WeddingInvitation = global.WeddingInvitation || {};

  /* ── Config + small helpers ───────────────────────────────────────── */

  function getConfig() {
    return (global.WeddingConfig && global.WeddingConfig.snapshot) || {};
  }

  function prefersReducedMotion() {
    return global.matchMedia &&
           global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function setText(node, text) {
    if (node && text != null) { node.textContent = text; }
  }

  function setAllText(nodes, text) {
    if (!nodes || text == null) { return; }
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = text;
    }
  }

  function setHTML(node, lines) {
    if (!node || !Array.isArray(lines)) { return; }
    node.innerHTML = '';
    for (var i = 0; i < lines.length; i++) {
      if (i > 0) { node.appendChild(document.createElement('br')); }
      node.appendChild(document.createTextNode(lines[i]));
    }
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) { return '0 B'; }
    var units = ['B', 'KB', 'MB', 'GB'];
    var v = bytes, i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
    var digits = (i === 0) ? 0 : (v >= 100 ? 0 : (v >= 10 ? 1 : 2));
    return v.toFixed(digits) + ' ' + units[i];
  }

  function formatMb(bytes) {
    var mb = (bytes || 0) / 1024 / 1024;
    return mb.toFixed(mb >= 100 ? 0 : 1) + ' MB';
  }

  function uid() {
    try {
      if (global.crypto && typeof global.crypto.randomUUID === 'function') {
        return global.crypto.randomUUID();
      }
    } catch (_) { /* ignore */ }
    return 'pq-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
  }

  var URL_PLACEHOLDER_FRAGMENTS = [
    'REPLACE_WITH_DEPLOYMENT_ID',
    'REPLACE_ME',
    'YOUR_DEPLOYMENT_ID'
  ];
  function isPlaceholderUrl(url) {
    if (!url) { return true; }
    var u = String(url);
    for (var i = 0; i < URL_PLACEHOLDER_FRAGMENTS.length; i++) {
      if (u.indexOf(URL_PLACEHOLDER_FRAGMENTS[i]) !== -1) { return true; }
    }
    return false;
  }


  /* ══════════════════════════════════════════════════════════════════
     Section header hydration — config → DOM
     ══════════════════════════════════════════════════════════════════ */

  function populateHeader(snapshotEl, config) {
    setText(snapshotEl.querySelector('[data-snapshot-slot="eyebrow"]'), config.eyebrow);
    setText(snapshotEl.querySelector('[data-snapshot-slot="title"]'),   config.title);

    var subtitleHost = snapshotEl.querySelector('[data-snapshot-slot="subtitle"]');
    if (subtitleHost && Array.isArray(config.subtitle) && config.subtitle.length) {
      setHTML(subtitleHost, config.subtitle);
    }

    var ctaLabel = snapshotEl.querySelector('[data-snapshot-slot="cta-label"]');
    if (ctaLabel && config.cta && config.cta.label) {
      setText(ctaLabel, config.cta.label);
    }
  }


  /* ══════════════════════════════════════════════════════════════════
     Scroll-Reveal Animations + Static Fallback (unchanged)
     ══════════════════════════════════════════════════════════════════ */

  function setupReveals(snapshotEl, config) {
    var rootMargin = (config && config.rootMargin) || '0px 0px -10% 0px';
    var threshold  = (config && config.threshold != null) ? config.threshold : 0.14;

    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) { continue; }
        entries[i].target.classList.add('is-visible');
        observer.unobserve(entries[i].target);
      }
    }, { rootMargin: rootMargin, threshold: threshold });

    var ornamentObserver = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) { continue; }
        entries[i].target.classList.add('is-drawn');
        ornamentObserver.unobserve(entries[i].target);
      }
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.05 });

    var reveals = snapshotEl.querySelectorAll('[data-reveal]');
    for (var i = 0; i < reveals.length; i++) { observer.observe(reveals[i]); }

    var ornaments = snapshotEl.querySelectorAll('.snapshot__ornament');
    for (var j = 0; j < ornaments.length; j++) { ornamentObserver.observe(ornaments[j]); }

    return {
      destroy: function () {
        observer.disconnect();
        ornamentObserver.disconnect();
      }
    };
  }

  function showStatic(snapshotEl) {
    snapshotEl.classList.remove('snapshot--animated');

    var elements = snapshotEl.querySelectorAll('[data-reveal]');
    for (var i = 0; i < elements.length; i++) {
      elements[i].classList.add('is-visible');
      elements[i].style.opacity = '1';
      elements[i].style.transform = 'none';
    }

    var ornaments = snapshotEl.querySelectorAll('.snapshot__ornament');
    for (var j = 0; j < ornaments.length; j++) {
      ornaments[j].classList.add('is-drawn');
    }
  }


  /* ══════════════════════════════════════════════════════════════════
     Pulitzer Modal Controller
     ══════════════════════════════════════════════════════════════════ */

  function createModalController(config) {
    var modal       = document.getElementById('pulitzerModal');
    var openBtn     = document.getElementById('snapshotOpenBtn');
    if (!modal || !openBtn) { return null; }

    /* Refs */
    var els = {
      modal:           modal,
      openBtn:         openBtn,
      dialog:          modal.querySelector('.pulitzer-modal__dialog'),
      closeNodes:      modal.querySelectorAll('[data-pulitzer-close]'),
      title:           document.getElementById('pulitzerModalTitle'),

      guestName:       document.getElementById('pulitzerGuestName'),
      drop:            document.getElementById('pulitzerDrop'),
      filePickGallery: document.getElementById('pulitzerFileGallery'),
      filePickCamera:  document.getElementById('pulitzerFileCamera'),

      queue:           document.getElementById('pulitzerQueue'),
      queueList:       document.getElementById('pulitzerQueueList'),
      queueClear:      document.getElementById('pulitzerQueueClear'),
      queueCount:      modal.querySelectorAll('[data-pulitzer-queue-count]'),
      queueTotal:      document.getElementById('pulitzerQueueTotal'),

      maxPhotosLabels: modal.querySelectorAll('[data-pulitzer-max-photos]'),
      maxMbLabels:     modal.querySelectorAll('[data-pulitzer-max-mb]'),

      status:          document.getElementById('pulitzerStatus'),
      sendBtn:         document.getElementById('pulitzerSendBtn'),
      sendBtnLabel:    document.getElementById('pulitzerSendBtnLabel'),
      footer:          modal.querySelector('.pulitzer-modal__footer')
    };

    /* Settings (config + safe defaults) */
    var maxPhotos        = Number(config.maxPhotos) > 0 ? Number(config.maxPhotos) : 40;
    var maxBytesPerPhoto = Number(config.maxBytesPerPhoto) > 0
      ? Number(config.maxBytesPerPhoto)
      : 15 * 1024 * 1024;
    var maxMbPerPhoto    = Math.round(maxBytesPerPhoto / 1024 / 1024);
    var allowedMime      = Array.isArray(config.allowedMimeTypes) && config.allowedMimeTypes.length
      ? config.allowedMimeTypes
      : ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
         'image/heic', 'image/heif', 'image/tiff', 'image/tif'];
    var allowedExt       = Array.isArray(config.allowedExtensions) && config.allowedExtensions.length
      ? config.allowedExtensions
      : ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'tif', 'tiff'];

    /* Apps Script /exec URL */
    var endpoint = config.webAppBaseUrl || '';
    var uploadKey = config.uploadKey || '';
    var endpointReady = !!endpoint && !isPlaceholderUrl(endpoint);

    /* State (single source of truth; render() repaints from it) */
    var state = {
      queue:       [],   // { id, file, status: queued|uploading|done|error, error, result, previewUrl }
      isUploading: false,
      lastFocus:   null
    };

    /* ── Inject runtime labels ────────────────────────────────────── */
    setAllText(els.maxPhotosLabels, String(maxPhotos));
    setAllText(els.maxMbLabels,     String(maxMbPerPhoto));

    if (config.title)        { setText(els.title, config.title); }

    if (!endpointReady) {
      setStatus('업로드 링크가 아직 준비 중입니다. 잠시 후 다시 시도해 주세요.', 'error');
      els.sendBtn.disabled = true;
    }

    /* ── Helpers ──────────────────────────────────────────────────── */

    function getExtension(name) {
      var m = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,10})$/);
      return m ? m[1] : '';
    }

    function setStatus(message, kind) {
      if (!els.status) { return; }
      els.status.textContent = message || '';
      els.status.classList.remove('is-error', 'is-info', 'is-success');
      if (kind === 'error')   { els.status.classList.add('is-error'); }
      if (kind === 'info')    { els.status.classList.add('is-info'); }
      if (kind === 'success') { els.status.classList.add('is-success'); }
    }

    function validateFile(file) {
      if (!file || !file.size || file.size <= 0) {
        return { ok: false, reason: 'empty' };
      }
      if (file.size > maxBytesPerPhoto) {
        return { ok: false, reason: 'size' };
      }
      var mime = String(file.type || '').toLowerCase();
      var ext  = getExtension(file.name);
      var mimeOk = mime && allowedMime.indexOf(mime) !== -1;
      var extOk  = ext  && allowedExt.indexOf(ext) !== -1;
      if (!mimeOk && !extOk) {
        return { ok: false, reason: 'type' };
      }
      return { ok: true };
    }


    /* ══════════════════════════════════════════════════════════════
       Modal open/close + focus management
       ══════════════════════════════════════════════════════════════ */

    function open() {
      if (!endpointReady) {
        setStatus('업로드 링크가 아직 준비 중입니다. 잠시 후 다시 시도해 주세요.', 'error');
      }
      state.lastFocus = document.activeElement;
      els.modal.classList.add('is-open');
      els.modal.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('pulitzer-scroll-lock');
      document.body.classList.add('pulitzer-scroll-lock');
      document.addEventListener('keydown', onKeydown);

      // Defer focus so the dialog's transform/opacity transitions before we steal focus.
      setTimeout(function () {
        if (els.guestName) {
          try { els.guestName.focus({ preventScroll: true }); }
          catch (_) { els.guestName.focus(); }
        }
      }, 80);
    }

    function close() {
      if (state.isUploading) {
        setStatus('전송이 끝나면 닫을 수 있어요.', 'info');
        return;
      }
      els.modal.classList.remove('is-open');
      els.modal.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('pulitzer-scroll-lock');
      document.body.classList.remove('pulitzer-scroll-lock');
      document.removeEventListener('keydown', onKeydown);

      if (state.lastFocus && typeof state.lastFocus.focus === 'function') {
        try { state.lastFocus.focus({ preventScroll: true }); }
        catch (_) { state.lastFocus.focus(); }
      }
      state.lastFocus = null;
    }

    function onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    }


    /* ══════════════════════════════════════════════════════════════
       Queue manipulation
       ══════════════════════════════════════════════════════════════ */

    function addFiles(fileList) {
      if (!fileList || !fileList.length) { return; }
      if (state.isUploading) {
        setStatus('전송 중에는 새 사진을 추가할 수 없어요.', 'info');
        return;
      }

      var added       = 0;
      var rejectSize  = 0;
      var rejectType  = 0;
      var rejectQuota = 0;

      for (var i = 0; i < fileList.length; i++) {
        var file = fileList[i];
        if (!file) { continue; }

        if (state.queue.length >= maxPhotos) {
          rejectQuota += (fileList.length - i);
          break;
        }

        var v = validateFile(file);
        if (!v.ok) {
          if (v.reason === 'size') { rejectSize++; }
          else if (v.reason === 'type') { rejectType++; }
          continue;
        }

        var entry = {
          id:         uid(),
          file:       file,
          status:     'queued',
          error:      '',
          result:     null,
          previewUrl: null
        };

        var mime = String(file.type || '').toLowerCase();
        if (mime && mime.indexOf('image/') === 0 &&
            mime !== 'image/heic' && mime !== 'image/heif' &&
            mime !== 'image/tiff' && mime !== 'image/tif') {
          try { entry.previewUrl = URL.createObjectURL(file); }
          catch (_) { entry.previewUrl = null; }
        }

        state.queue.push(entry);
        added++;
      }

      var msgs = [];
      if (rejectSize)  { msgs.push(maxMbPerPhoto + 'MB가 넘는 사진 ' + rejectSize + '장은 제외했어요'); }
      if (rejectType)  { msgs.push('지원하지 않는 형식 ' + rejectType + '장은 제외했어요'); }
      if (rejectQuota) { msgs.push('최대 ' + maxPhotos + '장까지만 보낼 수 있어 ' + rejectQuota + '장은 제외했어요'); }

      if (msgs.length) {
        setStatus(msgs.join(' · ') + '.', 'error');
      } else if (added > 0) {
        setStatus(added + '장을 추가했어요.', '');
      }

      render();
    }

    function removeFromQueue(id) {
      if (state.isUploading) { return; }
      for (var i = 0; i < state.queue.length; i++) {
        if (state.queue[i].id === id) {
          if (state.queue[i].previewUrl) {
            try { URL.revokeObjectURL(state.queue[i].previewUrl); } catch (_) {}
          }
          state.queue.splice(i, 1);
          break;
        }
      }
      render();
    }

    function clearQueue() {
      for (var i = 0; i < state.queue.length; i++) {
        if (state.queue[i].previewUrl) {
          try { URL.revokeObjectURL(state.queue[i].previewUrl); } catch (_) {}
        }
      }
      state.queue.length = 0;
      render();
    }


    /* ══════════════════════════════════════════════════════════════
       Rendering — repaints the queue + send button from `state.queue`
       ══════════════════════════════════════════════════════════════ */

    function render() {
      var hasItems   = state.queue.length > 0;
      var doneCount  = countByStatus('done');
      var errorCount = countByStatus('error');

      els.queue.hidden = !hasItems;
      setAllText(els.queueCount, String(state.queue.length));

      els.queueClear.disabled = state.isUploading || !hasItems;

      els.queueList.innerHTML = '';
      var totalBytes = 0;
      for (var i = 0; i < state.queue.length; i++) {
        var entry = state.queue[i];
        totalBytes += entry.file.size || 0;
        els.queueList.appendChild(buildQueueRow(entry));
      }
      els.queueTotal.textContent = '총 ' + formatMb(totalBytes);

      var sendable = hasSendableItems();
      els.sendBtn.disabled = !endpointReady || state.isUploading || !sendable;

      if (state.isUploading) {
        els.sendBtnLabel.textContent = '전송 중…';
      } else if (errorCount > 0 && doneCount > 0) {
        els.sendBtnLabel.textContent = '실패한 사진 다시 보내기';
      } else if (doneCount > 0 && doneCount === state.queue.length) {
        els.sendBtnLabel.textContent = '사진 더 보내기';
      } else {
        els.sendBtnLabel.textContent = '사진 보내기 (' + countByStatus('queued') + '장)';
      }
    }

    function countByStatus(status) {
      var c = 0;
      for (var i = 0; i < state.queue.length; i++) {
        if (state.queue[i].status === status) { c++; }
      }
      return c;
    }
    function hasSendableItems() {
      for (var i = 0; i < state.queue.length; i++) {
        var s = state.queue[i].status;
        if (s === 'queued' || s === 'error') { return true; }
      }
      return false;
    }

    function buildQueueRow(entry) {
      var li = document.createElement('li');
      li.className = 'pq-item';
      li.setAttribute('data-id', entry.id);
      if (entry.status === 'uploading') { li.classList.add('is-uploading'); }
      if (entry.status === 'done')      { li.classList.add('is-done'); }
      if (entry.status === 'error')     { li.classList.add('is-error'); }

      // Thumbnail
      var thumb = document.createElement('span');
      thumb.className = 'pq-item__thumb';
      if (entry.previewUrl) {
        var img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = entry.previewUrl;
        thumb.appendChild(img);
      } else {
        thumb.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<rect x="3" y="5" width="18" height="14" rx="2" />' +
          '<circle cx="12" cy="13" r="3.4" />' +
          '<path d="M16 9.5h1.4" />' +
          '</svg>';
      }
      li.appendChild(thumb);

      // Body — name + meta + status
      var body = document.createElement('div');
      body.className = 'pq-item__body';

      var name = document.createElement('p');
      name.className = 'pq-item__name';
      name.title = entry.file.name || '';
      name.textContent = entry.file.name || '사진';
      body.appendChild(name);

      var meta = document.createElement('p');
      meta.className = 'pq-item__meta';

      var bytes = document.createElement('span');
      bytes.textContent = formatBytes(entry.file.size);
      meta.appendChild(bytes);

      var status = document.createElement('span');
      status.className = 'pq-item__status';
      status.textContent = statusLabel(entry.status);
      meta.appendChild(status);

      body.appendChild(meta);
      li.appendChild(body);

      // Actions — delete button (always available pre-send + post-error)
      var actions = document.createElement('div');
      actions.className = 'pq-item__actions';

      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'pq-item__btn';
      rm.setAttribute('aria-label', (entry.file.name || '사진') + ' 빼기');
      if (state.isUploading || entry.status === 'uploading' || entry.status === 'done') {
        rm.disabled = true;
      }
      rm.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
        '<path d="M18 6 L6 18 M6 6 L18 18" />' +
        '</svg>';
      rm.addEventListener('click', function () { removeFromQueue(entry.id); });
      actions.appendChild(rm);

      li.appendChild(actions);

      // Progress bar (only painted when uploading/done/error per CSS)
      var progressWrap = document.createElement('div');
      progressWrap.className = 'pq-item__progress';
      var progressBar = document.createElement('div');
      progressBar.className = 'pq-item__progress-bar';
      progressWrap.appendChild(progressBar);
      li.appendChild(progressWrap);

      // Per-row error message
      if (entry.status === 'error' && entry.error) {
        var em = document.createElement('p');
        em.className = 'pq-item__error';
        em.textContent = entry.error;
        li.appendChild(em);
      }

      return li;
    }

    function statusLabel(status) {
      switch (status) {
        case 'queued':    return '대기';
        case 'uploading': return '전송 중';
        case 'done':      return '완료';
        case 'error':     return '실패';
        default:          return '대기';
      }
    }


    /* ══════════════════════════════════════════════════════════════
       Submit — sequential per-file POST to the Apps Script /exec
       ══════════════════════════════════════════════════════════════ */

    function onSubmit() {
      if (!endpointReady) { return; }
      if (state.isUploading) { return; }
      if (!hasSendableItems()) { return; }

      // Reset retried items + set isUploading.
      var pending = [];
      for (var i = 0; i < state.queue.length; i++) {
        var q = state.queue[i];
        if (q.status === 'queued' || q.status === 'error') {
          q.status = 'queued';
          q.error  = '';
          pending.push(q);
        }
      }

      state.isUploading = true;
      setStatus('원본 사진을 한 장씩 보내고 있어요. 화면을 닫지 말아 주세요.', 'info');
      render();
      uploadSequential(pending, 0);
    }

    function uploadSequential(items, index) {
      if (index >= items.length) {
        state.isUploading = false;
        finishRound();
        return;
      }

      var entry = items[index];
      entry.status = 'uploading';
      setStatus('(' + (index + 1) + '/' + items.length + ') ' + (entry.file.name || '사진') + ' 전송 중…', 'info');
      render();

      uploadOne(entry).then(function (result) {
        entry.status = 'done';
        entry.result = result || null;
        render();
        uploadSequential(items, index + 1);
      }).catch(function (err) {
        entry.status = 'error';
        entry.error  = (err && err.message) ? err.message : String(err || '알 수 없는 오류');
        render();
        // Continue with the next file regardless — partial success is
        // strictly better than aborting the whole batch.
        uploadSequential(items, index + 1);
      });
    }

    function readFileAsDataURL(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload  = function () { resolve(String(reader.result || '')); };
        reader.onerror = function () { reject(new Error('사진을 읽지 못했어요. 다시 선택해 주세요.')); };
        reader.onabort = function () { reject(new Error('사진 읽기가 중단됐어요. 다시 시도해 주세요.')); };
        try { reader.readAsDataURL(file); }
        catch (err) { reject(err); }
      });
    }

    function uploadOne(entry) {
      if (!endpoint || !endpointReady) {
        return Promise.reject(new Error('업로드 링크가 준비되지 않았어요.'));
      }

      // Apps Script doPost(e) does NOT natively parse multipart/form-data
      // file uploads, and `Content-Type: application/json` would trigger a
      // CORS preflight that Apps Script never answers. Therefore each
      // photo travels as a base64 data-URL inside a JSON body, sent with
      // `Content-Type: text/plain;charset=UTF-8` — a "simple" CORS
      // request the browser allows without a preflight. The server
      // re-hydrates the file via `Utilities.newBlob()` and feeds it to
      // the existing `uploadGuestPhoto()` RPC.
      return readFileAsDataURL(entry.file).then(function (dataUrl) {
        var body = JSON.stringify({
          key:            uploadKey,
          guestName:      (els.guestName.value || '').trim(),
          clientFileName: entry.file.name || '',
          clientFileSize: String(entry.file.size || ''),
          clientFileType: entry.file.type || '',
          clientTime:     new Date().toISOString(),
          userAgent:      navigator.userAgent || '',
          photoDataUrl:   dataUrl
        });

        var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
        var timeoutMs = 5 * 60 * 1000; // 5min hard ceiling per file
        var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;

        return fetch(endpoint, {
          method:   'POST',
          mode:     'cors',
          redirect: 'follow',
          headers:  { 'Content-Type': 'text/plain;charset=UTF-8' },
          body:     body,
          signal:   ctrl ? ctrl.signal : undefined
        }).then(function (res) {
          if (timer) { clearTimeout(timer); }
          return res.text();
        }).then(function (text) {
          var payload;
          try { payload = JSON.parse(text); }
          catch (_) {
            throw new Error('서버 응답을 해석할 수 없어요. 잠시 후 다시 시도해 주세요.');
          }
          if (!payload || payload.ok !== true) {
            var msg = (payload && payload.error) || '전송에 실패했어요. 잠시 후 다시 시도해 주세요.';
            throw new Error(msg);
          }
          return payload;
        }).catch(function (err) {
          if (timer) { clearTimeout(timer); }
          if (err && err.name === 'AbortError') {
            throw new Error('전송 시간이 너무 오래 걸려 중단했어요. 다시 시도해 주세요.');
          }
          throw (err instanceof Error ? err : new Error(String(err)));
        });
      });
    }

    function finishRound() {
      var doneCount  = countByStatus('done');
      var errorCount = countByStatus('error');

      if (doneCount === 0) {
        setStatus('모든 사진의 전송에 실패했어요. 잠시 후 다시 시도해 주세요.', 'error');
      } else if (errorCount > 0) {
        setStatus(doneCount + '장 전송 완료, ' + errorCount + '장은 실패했어요. ✕ 버튼으로 빼고 다시 보내거나 ↻로 재시도하세요.', 'info');
      } else {
        var name = (els.guestName.value || '').trim();
        var head = name ? (name + '님,') : '';
        setStatus((head + ' 보내주신 ' + doneCount + '장의 순간을 두 사람의 앨범에 담았어요. 감사합니다.').trim(), 'success');
      }
      render();
    }


    /* ══════════════════════════════════════════════════════════════
       Event wiring
       ══════════════════════════════════════════════════════════════ */

    els.openBtn.addEventListener('click', function (e) {
      e.preventDefault();
      open();
    });

    for (var c = 0; c < els.closeNodes.length; c++) {
      els.closeNodes[c].addEventListener('click', function (e) {
        e.preventDefault();
        close();
      });
    }

    els.filePickGallery.addEventListener('change', onFileInputChange);
    els.filePickCamera.addEventListener('change',  onFileInputChange);

    function onFileInputChange(e) {
      var input = e.target;
      var files = input && input.files ? input.files : null;
      if (files && files.length) { addFiles(files); }
      try { input.value = ''; } catch (_) {}
    }

    /* Native drag-and-drop on the dropzone. */
    els.drop.addEventListener('dragover', function (e) {
      e.preventDefault();
      els.drop.classList.add('is-dragover');
    });
    els.drop.addEventListener('dragleave', function () {
      els.drop.classList.remove('is-dragover');
    });
    els.drop.addEventListener('drop', function (e) {
      e.preventDefault();
      els.drop.classList.remove('is-dragover');
      var dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) { addFiles(dt.files); }
    });
    els.drop.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        els.filePickGallery.click();
      }
    });

    /* When dropping on the modal but missing the dropzone, swallow the
       browser navigation; legitimate drops still bubble normally. */
    els.modal.addEventListener('dragover', function (e) { e.preventDefault(); });
    els.modal.addEventListener('drop', function (e) {
      var path = e.composedPath ? e.composedPath() : [];
      var insideDrop = false;
      for (var i = 0; i < path.length; i++) {
        if (path[i] === els.drop) { insideDrop = true; break; }
      }
      if (!insideDrop) { e.preventDefault(); }
    });

    els.queueClear.addEventListener('click', function () {
      if (state.isUploading) { return; }
      clearQueue();
      setStatus('', '');
    });

    els.sendBtn.addEventListener('click', onSubmit);

    /* Disable closing while uploading also via the beforeunload guard. */
    global.addEventListener('beforeunload', function (e) {
      if (state.isUploading) {
        e.preventDefault();
        e.returnValue = '사진 전송이 끝날 때까지 잠시만 기다려 주세요.';
        return e.returnValue;
      }
    });

    render();

    return {
      open: open,
      close: close,
      destroy: function () {
        clearQueue();
      }
    };
  }


  /* ══════════════════════════════════════════════════════════════════
     Main Initialization
     ══════════════════════════════════════════════════════════════════ */

  function init() {
    var snapshotEl = document.getElementById('snapshot');
    if (!snapshotEl) { return null; }

    var config = getConfig();

    populateHeader(snapshotEl, config);
    var modalCtl = createModalController(config);

    if (prefersReducedMotion()) {
      showStatic(snapshotEl);
      return {
        modal: modalCtl,
        destroy: function () { if (modalCtl) { modalCtl.destroy(); } }
      };
    }

    snapshotEl.classList.add('snapshot--animated');
    var reveals = setupReveals(snapshotEl, config);

    var mq = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)');
    function onMotionChange(e) {
      if (!e.matches) { return; }
      showStatic(snapshotEl);
    }
    if (mq) {
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onMotionChange);
      } else if (typeof mq.addListener === 'function') {
        mq.addListener(onMotionChange);
      }
    }

    return {
      modal: modalCtl,
      destroy: function () {
        if (reveals) { reveals.destroy(); }
        if (modalCtl) { modalCtl.destroy(); }
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

  app.initSnapshot = init;

  document.addEventListener('DOMContentLoaded', function () {
    app.snapshotController = init();
  });

})(window);
