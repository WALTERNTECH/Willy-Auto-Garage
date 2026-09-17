/* =========================================================
   Staff photo uploader
   Resizes a photo to the right size for its slot and commits it
   straight into the site repository, so the homepage slider and the
   before/after panes fill in without anyone touching code.
   No server involved.
   ========================================================= */
(function () {
  'use strict';

  var PHOTOS = window.WILLY_PHOTOS || {};
  var PASSCODE_KEY = 'willy.staff.passcode';
  var JPEG_QUALITY = 0.82;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var services = window.WILLY_SERVICES || [];

  /* ---------- what can be uploaded ---------- */
  // Homepage slider: wide photos of the workshop.
  var HERO = { w: 1600, h: 900, ratio: 'wide', dir: 'hero' };
  // Service panes: 4:3 so every before/after pair lines up.
  var SERVICE = { w: 1200, h: 900, ratio: 'std', dir: 'services' };

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

  /* ---------- passcode, remembered on this device ---------- */
  function getPasscode() {
    try { return localStorage.getItem(PASSCODE_KEY) || ''; } catch (e) { return ''; }
  }
  function setPasscode(value) {
    try {
      if (value) localStorage.setItem(PASSCODE_KEY, value);
      else localStorage.removeItem(PASSCODE_KEY);
      return true;
    } catch (e) { return false; }
  }

  function paintLockState() {
    var unlocked = !!getPasscode();
    var badge = $('#lockState');
    badge.textContent = unlocked ? 'Unlocked' : 'Locked';
    badge.className = 'panel__badge ' + (unlocked ? 'is-ok' : 'is-warn');
    $('#lockBtn').hidden = !unlocked;
    $('#passcodeRow').hidden = unlocked;
    $('#lockedNote').hidden = unlocked;
    document.querySelectorAll('.js-pick').forEach(function (btn) { btn.disabled = !unlocked; });
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

  /* ---------- the upload service ---------- */
  function describeError(status, message) {
    if (status === 401) return 'That passcode is not right.';
    if (status === 413) return 'That photo is too large even after resizing. Try another one.';
    if (status === 503) return 'The photo service is waking up. Try again in a moment.';
    return message || ('The upload failed (' + status + ').');
  }

  async function callUploader(payload) {
    var res;
    try {
      res = await fetch(PHOTOS.uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      throw new Error('No connection. Check the phone is online and try again.');
    }
    var body = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(describeError(res.status, body.error));
    return body;
  }

  function verifyPasscode(passcode) {
    return callUploader({ passcode: passcode, action: 'verify' });
  }

  function uploadPhoto(path, base64, passcode) {
    return callUploader({ passcode: passcode, path: path, data: base64 });
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
          '<img alt="" src="' + PHOTOS.url(slot.path) + '" ' +
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
    $('#publishBtn').hidden = false;
    $('#reviewDialog').showModal();
  }

  function closeReview() { $('#reviewDialog').close(); }

  async function publishPending() {
    if (!pending) return;
    var passcode = getPasscode();
    if (!passcode) return;

    var el = pending.el;
    var slot = pending.slot;
    var blob = pending.blob;

    closeReview();
    el.classList.add('is-busy');
    status(el, 'Uploading…');

    try {
      var base64 = toBase64(await blob.arrayBuffer());
      var result = await uploadPhoto(slot.path, base64, passcode);

      // Bust the cache so the new photo shows here straight away.
      var img = el.querySelector('img');
      img.classList.remove('is-missing');
      img.src = (result.url || PHOTOS.url(slot.path)) + '?v=' + Date.now();
      el.classList.add('has-photo');
      updateCounts();
      status(el, 'Live on the website.', 'ok');
    } catch (err) {
      status(el, err.message, 'error');
    } finally {
      el.classList.remove('is-busy');
    }
  }

  /* ---------- wiring ---------- */
  function init() {
    render();
    paintLockState();

    var unlockBtn = $('#unlockBtn');
    unlockBtn.addEventListener('click', async function () {
      var value = $('#passcodeInput').value.trim();
      if (!value) { $('#passcodeInput').focus(); return; }

      unlockBtn.disabled = true;
      $('#lockNote').textContent = 'Checking…';
      try {
        await verifyPasscode(value);            // never store a passcode that does not work
      } catch (err) {
        $('#lockNote').textContent = err.message;
        unlockBtn.disabled = false;
        return;
      }
      unlockBtn.disabled = false;

      if (!setPasscode(value)) {
        $('#lockNote').textContent = 'This browser will not let the page remember anything. Try a normal (non-private) window.';
        return;
      }
      $('#passcodeInput').value = '';
      $('#lockNote').textContent = 'Unlocked. Pick a photo for any slot below.';
      paintLockState();
    });

    $('#passcodeInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); unlockBtn.click(); }
    });

    $('#lockBtn').addEventListener('click', function () {
      setPasscode('');
      $('#lockNote').textContent = 'Locked again on this device.';
      paintLockState();
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
    $('#cancelBtn').addEventListener('click', closeReview);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
