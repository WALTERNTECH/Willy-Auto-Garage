/* =========================================================
   Staff photo uploader
   Resizes a photo to 1200x900 and commits it straight into the
   site repository, so the before/after panes fill in without
   anyone touching code. No server involved.
   ========================================================= */
(function () {
  'use strict';

  var REPO_OWNER = 'WALTERNTECH';
  var REPO_NAME = 'Willy-Auto-Garage';
  var BRANCH = 'main';
  var DIR = 'assets/img/services';
  var TOKEN_KEY = 'willy.staff.github-token';

  var TARGET_W = 1200;
  var TARGET_H = 900;
  var JPEG_QUALITY = 0.82;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var services = window.WILLY_SERVICES || [];

  /* ---------- token, kept on this device only ---------- */
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(value) {
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
      return true;
    } catch (e) { return false; }
  }

  function paintTokenState() {
    var badge = $('#tokenState');
    var hasToken = !!getToken();
    badge.textContent = hasToken ? 'Connected' : 'Not connected';
    badge.className = 'panel__badge ' + (hasToken ? 'is-ok' : 'is-warn');
    $('#forgetToken').hidden = !hasToken;
    $('#tokenInput').placeholder = hasToken ? '•••••••••••• saved on this device' : 'github_pat_…';
  }

  /* ---------- image handling ---------- */
  function fileName(slug, state) { return slug + '-' + state + '.jpg'; }
  function filePath(slug, state) { return DIR + '/' + fileName(slug, state); }

  // Centre-crop to 4:3 and scale to 1200x900 so every pane matches.
  async function normalise(file) {
    var bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      bitmap = await createImageBitmap(file);   // older browsers ignore the option
    }
    var canvas = document.createElement('canvas');
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, TARGET_W, TARGET_H);
    ctx.imageSmoothingQuality = 'high';

    var scale = Math.max(TARGET_W / bitmap.width, TARGET_H / bitmap.height);
    var w = bitmap.width * scale;
    var h = bitmap.height * scale;
    ctx.drawImage(bitmap, (TARGET_W - w) / 2, (TARGET_H - h) / 2, w, h);
    if (bitmap.close) bitmap.close();

    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        blob ? resolve(blob) : reject(new Error('Could not read that image.'));
      }, 'image/jpeg', JPEG_QUALITY);
    });
  }

  function toBase64(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    var chunk = 0x8000;
    var binary = '';
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  /* ---------- GitHub ---------- */
  function apiUrl(path) {
    return 'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + path;
  }

  function ghHeaders(token) {
    return {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  function describeError(status, body) {
    if (status === 401) return 'That token was rejected. Paste a fresh one.';
    if (status === 403) return 'The token is not allowed to write to this repository. It needs Contents: Read and write.';
    if (status === 404) return 'Repository not found for this token. Check it has access to ' + REPO_OWNER + '/' + REPO_NAME + '.';
    if (status === 409 || status === 422) return 'The file changed while uploading. Try once more.';
    if (status === 413) return 'That photo is too large even after resizing. Try another one.';
    return 'GitHub returned ' + status + (body && body.message ? ' — ' + body.message : '') + '.';
  }

  async function commitFile(path, base64, message, token) {
    var headers = ghHeaders(token);

    // An existing file needs its blob sha to be replaced.
    var sha;
    var existing = await fetch(apiUrl(path) + '?ref=' + BRANCH, { headers: headers, cache: 'no-store' });
    if (existing.ok) {
      sha = (await existing.json()).sha;
    } else if (existing.status !== 404) {
      throw new Error(describeError(existing.status, await existing.json().catch(function () { return null; })));
    }

    var payload = { message: message, content: base64, branch: BRANCH };
    if (sha) payload.sha = sha;

    var res = await fetch(apiUrl(path), {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(describeError(res.status, await res.json().catch(function () { return null; })));
    }
    return res.json();
  }

  /* ---------- building the grid ---------- */
  function icon(id, cls) {
    return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true"><use href="#' + id + '"></use></svg>';
  }

  function slotMarkup(service, state) {
    var label = state === 'before' ? 'Before' : 'After';
    var name = fileName(service.slug, state);
    var id = service.slug + '-' + state;
    return '' +
      '<div class="slot" data-slug="' + service.slug + '" data-state="' + state + '" id="slot-' + id + '">' +
        '<div class="slot__label"><span class="slot__dot"></span>' + label + '</div>' +
        '<div class="slot__frame">' +
          '<img alt="" src="' + filePath(service.slug, state) + '" ' +
               'onerror="this.onerror=null;this.classList.add(\'is-missing\')">' +
          '<span class="slot__empty">' + icon('i-image') + 'No photo yet</span>' +
        '</div>' +
        '<div class="slot__file">' + name + '</div>' +
        '<div class="slot__actions">' +
          '<input type="file" accept="image/*" id="file-' + id + '">' +
          '<button type="button" class="btn btn--outline btn--sm js-pick" data-for="file-' + id + '">' +
            'Choose photo' +
          '</button>' +
        '</div>' +
        '<div class="slot__status" role="status"></div>' +
      '</div>';
  }

  function render() {
    var host = $('#slots');
    host.innerHTML = services.map(function (service) {
      return '' +
        '<section class="svc">' +
          '<div class="svc__head">' +
            '<h3>' + service.name + '</h3>' +
            '<span class="svc__count" data-count-for="' + service.slug + '"></span>' +
          '</div>' +
          '<div class="svc__panes">' +
            slotMarkup(service, 'before') +
            slotMarkup(service, 'after') +
          '</div>' +
        '</section>';
    }).join('');

    // Mark slots that already have a photo once each image settles.
    host.querySelectorAll('.slot').forEach(function (slot) {
      var img = slot.querySelector('img');
      var done = function () {
        if (!img.classList.contains('is-missing') && img.naturalWidth > 0) slot.classList.add('has-photo');
        updateCounts();
      };
      if (img.complete) done();
      else { img.addEventListener('load', done); img.addEventListener('error', done); }
    });
  }

  function updateCounts() {
    services.forEach(function (service) {
      var filled = document.querySelectorAll('.slot[data-slug="' + service.slug + '"].has-photo').length;
      var el = document.querySelector('[data-count-for="' + service.slug + '"]');
      if (el) el.textContent = filled + ' of 2';
    });
  }

  function status(slot, message, kind) {
    var el = slot.querySelector('.slot__status');
    el.textContent = message || '';
    el.className = 'slot__status' + (kind ? ' is-' + kind : '');
  }

  /* ---------- review dialog ---------- */
  var pending = null;   // { slot, blob, url, service, state }

  function openReview(slot, blob, service, state) {
    if (pending && pending.url) URL.revokeObjectURL(pending.url);
    var url = URL.createObjectURL(blob);
    pending = { slot: slot, blob: blob, url: url, service: service, state: state };

    $('#reviewImage').src = url;
    $('#reviewTitle').textContent = service.name + ' — ' + (state === 'before' ? 'before' : 'after');
    $('#reviewMeta').textContent =
      'Saved as ' + fileName(service.slug, state) + ' · ' + TARGET_W + '×' + TARGET_H +
      ' · ' + Math.round(blob.size / 1024) + ' KB';
    $('#publishBtn').hidden = !getToken();
    $('#publishHint').hidden = !!getToken();
    $('#reviewDialog').showModal();
  }

  function closeReview() {
    $('#reviewDialog').close();
  }

  function downloadPending() {
    if (!pending) return;
    var a = document.createElement('a');
    a.href = pending.url;
    a.download = fileName(pending.service.slug, pending.state);
    document.body.appendChild(a);
    a.click();
    a.remove();
    status(pending.slot, 'Downloaded. Upload it to ' + DIR + ' on GitHub.', 'ok');
    closeReview();
  }

  async function publishPending() {
    if (!pending) return;
    var token = getToken();
    if (!token) return;

    var slot = pending.slot;
    var service = pending.service;
    var state = pending.state;
    var blob = pending.blob;
    var path = filePath(service.slug, state);

    closeReview();
    slot.classList.add('is-busy');
    status(slot, 'Uploading…');

    try {
      var base64 = toBase64(await blob.arrayBuffer());
      await commitFile(path, base64, 'Add ' + state + ' photo for ' + service.name, token);

      // Bust the cache so the new photo shows straight away.
      var img = slot.querySelector('img');
      img.classList.remove('is-missing');
      img.src = path + '?v=' + Date.now();
      slot.classList.add('has-photo');
      updateCounts();
      status(slot, 'Published. It appears on the website after the next deploy.', 'ok');
    } catch (err) {
      status(slot, err.message, 'error');
    } finally {
      slot.classList.remove('is-busy');
    }
  }

  /* ---------- wiring ---------- */
  function init() {
    render();
    paintTokenState();

    $('#saveToken').addEventListener('click', function () {
      var value = $('#tokenInput').value.trim();
      if (!value) { $('#tokenInput').focus(); return; }
      if (!setToken(value)) {
        $('#tokenNote').textContent = 'This browser will not let the page save anything. Try a normal (non-private) window.';
        return;
      }
      $('#tokenInput').value = '';
      $('#tokenNote').textContent = 'Saved on this device. You can upload photos now.';
      paintTokenState();
    });

    $('#forgetToken').addEventListener('click', function () {
      setToken('');
      $('#tokenNote').textContent = 'Removed from this device.';
      paintTokenState();
    });

    // One delegated listener covers all 22 slots.
    document.addEventListener('click', function (e) {
      var pick = e.target.closest('.js-pick');
      if (pick) {
        var input = document.getElementById(pick.getAttribute('data-for'));
        if (input) input.click();
      }
    });

    document.addEventListener('change', async function (e) {
      var input = e.target;
      if (input.type !== 'file' || !input.files || !input.files[0]) return;

      var slot = input.closest('.slot');
      var service = services.find(function (s) { return s.slug === slot.dataset.slug; });
      var file = input.files[0];
      input.value = '';                                   // allow re-picking the same file

      if (!/^image\//.test(file.type)) {
        status(slot, 'That file is not an image.', 'error');
        return;
      }

      status(slot, 'Preparing photo…');
      try {
        var blob = await normalise(file);
        status(slot, '');
        openReview(slot, blob, service, slot.dataset.state);
      } catch (err) {
        status(slot, err.message, 'error');
      }
    });

    $('#publishBtn').addEventListener('click', publishPending);
    $('#downloadBtn').addEventListener('click', downloadPending);
    $('#cancelBtn').addEventListener('click', closeReview);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
