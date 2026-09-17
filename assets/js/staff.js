/* =========================================================
   Staff photo uploader
   Resizes a photo to the right size for its slot and commits it
   straight into the site repository, so the homepage slider and the
   before/after panes fill in without anyone touching code.
   No server involved.
   ========================================================= */
(function () {
  'use strict';

  var REPO_OWNER = 'WALTERNTECH';
  var REPO_NAME = 'Willy-Auto-Garage';
  var BRANCH = 'main';
  var TOKEN_KEY = 'willy.staff.github-token';
  var JPEG_QUALITY = 0.82;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var services = window.WILLY_SERVICES || [];

  /* ---------- what can be uploaded ---------- */
  // Homepage slider: wide photos of the workshop.
  var HERO = { w: 1600, h: 900, ratio: 'wide', dir: 'assets/img/hero' };
  // Service panes: 4:3 so every before/after pair lines up.
  var SERVICE = { w: 1200, h: 900, ratio: 'std', dir: 'assets/img/services' };

  function heroGroup() {
    var slots = [1, 2, 3].map(function (n) {
      return {
        key: 'slide-' + n,
        label: 'Slide ' + n,
        file: 'slide-' + n + '.jpg',
        path: HERO.dir + '/slide-' + n + '.jpg',
        title: 'Homepage slider — slide ' + n,
        w: HERO.w, h: HERO.h, ratio: HERO.ratio
      };
    });
    return {
      id: 'homepage-slider',
      title: 'Homepage slider',
      note: 'The photos that slide across the top of the homepage. Landscape shots work best. Two is plenty — a third is optional.',
      slots: slots
    };
  }

  function serviceGroup(service) {
    var slots = ['before', 'after'].map(function (state) {
      return {
        key: service.slug + '-' + state,
        label: state === 'before' ? 'Before' : 'After',
        file: service.slug + '-' + state + '.jpg',
        path: SERVICE.dir + '/' + service.slug + '-' + state + '.jpg',
        title: service.name + ' — ' + state,
        w: SERVICE.w, h: SERVICE.h, ratio: SERVICE.ratio
      };
    });
    return { id: service.slug, title: service.name, slots: slots };
  }

  var groups = [heroGroup()].concat(services.map(serviceGroup));

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
  // Centre-crop to the slot's shape, then scale down, so every photo in a
  // row is the same size however it was taken.
  async function normalise(file, targetW, targetH) {
    var bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      bitmap = await createImageBitmap(file);   // older browsers ignore the option
    }
    var canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.imageSmoothingQuality = 'high';

    var scale = Math.max(targetW / bitmap.width, targetH / bitmap.height);
    var w = bitmap.width * scale;
    var h = bitmap.height * scale;
    ctx.drawImage(bitmap, (targetW - w) / 2, (targetH - h) / 2, w, h);
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
  var slotIndex = {};   // key -> slot config

  function icon(id) {
    return '<svg aria-hidden="true"><use href="#' + id + '"></use></svg>';
  }

  function slotMarkup(slot) {
    slotIndex[slot.key] = slot;
    return '' +
      '<div class="slot slot--' + slot.ratio + '" data-key="' + slot.key + '" id="slot-' + slot.key + '">' +
        '<div class="slot__label"><span class="slot__dot"></span>' + slot.label + '</div>' +
        '<div class="slot__frame">' +
          '<img alt="" src="' + slot.path + '" ' +
               'onerror="this.onerror=null;this.classList.add(\'is-missing\')">' +
          '<span class="slot__empty">' + icon('i-image') + 'No photo yet</span>' +
        '</div>' +
        '<div class="slot__file">' + slot.file + '</div>' +
        '<div class="slot__actions">' +
          '<input type="file" accept="image/*" id="file-' + slot.key + '">' +
          '<button type="button" class="btn btn--outline btn--sm js-pick" data-for="file-' + slot.key + '">' +
            'Choose photo' +
          '</button>' +
        '</div>' +
        '<div class="slot__status" role="status"></div>' +
      '</div>';
  }

  function render() {
    $('#slots').innerHTML = groups.map(function (group) {
      return '' +
        '<section class="svc' + (group.id === 'homepage-slider' ? ' svc--hero' : '') + '">' +
          '<div class="svc__head">' +
            '<h3>' + group.title + '</h3>' +
            '<span class="svc__count" data-count-for="' + group.id + '"></span>' +
          '</div>' +
          (group.note ? '<p class="svc__note">' + group.note + '</p>' : '') +
          '<div class="svc__panes">' + group.slots.map(slotMarkup).join('') + '</div>' +
        '</section>';
    }).join('');

    // Mark slots that already have a photo once each image settles.
    document.querySelectorAll('.slot').forEach(function (slot) {
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
    groups.forEach(function (group) {
      var filled = group.slots.filter(function (slot) {
        var el = document.getElementById('slot-' + slot.key);
        return el && el.classList.contains('has-photo');
      }).length;
      var el = document.querySelector('[data-count-for="' + group.id + '"]');
      if (el) el.textContent = filled + ' of ' + group.slots.length;
    });
  }

  function status(slotEl, message, kind) {
    var el = slotEl.querySelector('.slot__status');
    el.textContent = message || '';
    el.className = 'slot__status' + (kind ? ' is-' + kind : '');
  }

  /* ---------- review dialog ---------- */
  var pending = null;   // { el, slot, blob, url }

  function openReview(el, slot, blob) {
    if (pending && pending.url) URL.revokeObjectURL(pending.url);
    var url = URL.createObjectURL(blob);
    pending = { el: el, slot: slot, blob: blob, url: url };

    var preview = $('#reviewImage');
    preview.src = url;
    preview.style.aspectRatio = slot.w + '/' + slot.h;
    $('#reviewTitle').textContent = slot.title;
    $('#reviewMeta').textContent =
      'Saved as ' + slot.file + ' · ' + slot.w + '×' + slot.h + ' · ' + Math.round(blob.size / 1024) + ' KB';
    $('#publishBtn').hidden = !getToken();
    $('#publishHint').hidden = !!getToken();
    $('#reviewDialog').showModal();
  }

  function closeReview() { $('#reviewDialog').close(); }

  function downloadPending() {
    if (!pending) return;
    var a = document.createElement('a');
    a.href = pending.url;
    a.download = pending.slot.file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    status(pending.el, 'Downloaded. Upload it to ' + pending.slot.path.replace(/\/[^/]+$/, '') + ' on GitHub.', 'ok');
    closeReview();
  }

  async function publishPending() {
    if (!pending) return;
    var token = getToken();
    if (!token) return;

    var el = pending.el;
    var slot = pending.slot;
    var blob = pending.blob;

    closeReview();
    el.classList.add('is-busy');
    status(el, 'Uploading…');

    try {
      var base64 = toBase64(await blob.arrayBuffer());
      await commitFile(slot.path, base64, 'Add photo: ' + slot.title, token);

      // Bust the cache so the new photo shows straight away.
      var img = el.querySelector('img');
      img.classList.remove('is-missing');
      img.src = slot.path + '?v=' + Date.now();
      el.classList.add('has-photo');
      updateCounts();
      status(el, 'Published. It appears on the website after the next deploy.', 'ok');
    } catch (err) {
      status(el, err.message, 'error');
    } finally {
      el.classList.remove('is-busy');
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

    // One delegated listener covers every slot.
    document.addEventListener('click', function (e) {
      var pick = e.target.closest('.js-pick');
      if (!pick) return;
      var input = document.getElementById(pick.getAttribute('data-for'));
      if (input) input.click();
    });

    document.addEventListener('change', async function (e) {
      var input = e.target;
      if (input.type !== 'file' || !input.files || !input.files[0]) return;

      var el = input.closest('.slot');
      var slot = slotIndex[el.dataset.key];
      var file = input.files[0];
      input.value = '';                                   // allow re-picking the same file

      if (!/^image\//.test(file.type)) {
        status(el, 'That file is not an image.', 'error');
        return;
      }

      status(el, 'Preparing photo…');
      try {
        var blob = await normalise(file, slot.w, slot.h);
        status(el, '');
        openReview(el, slot, blob);
      } catch (err) {
        status(el, err.message, 'error');
      }
    });

    $('#publishBtn').addEventListener('click', publishPending);
    $('#downloadBtn').addEventListener('click', downloadPending);
    $('#cancelBtn').addEventListener('click', closeReview);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
