/* =========================================================
   Willy Auto Perfection Centre — site behaviour
   Every form hands off to WhatsApp with the message pre-written,
   so an enquiry never dies in an inbox nobody checks.
   ========================================================= */
(function () {
  'use strict';

  var WHATSAPP_NUMBER = '254710817390';          // international format, no + or spaces
  var EMAIL = 'willyauto@gmail.com';
  var BUSINESS = 'Willy Auto Perfection Centre';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- 1. Header: shadow once scrolled ---------- */
  var header = $('#header');
  var onScroll = function () {
    if (header) header.classList.toggle('is-stuck', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- 2. Mobile menu ---------- */
  var burger = $('#burger');
  var nav = $('#nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) burger.click();
    });
  }

  /* ---------- 3. Highlight the section you are reading ---------- */
  var navLinks = $$('.nav a[href^="#"]');
  var sections = navLinks
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- 4. Reveal on scroll ---------- */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -60px 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- 4b. Photo slider ----------
     Slides whose image is missing remove themselves via onerror, so the
     slider only ever runs on photos that actually loaded. */
  (function slider() {
    var root = $('#slider');
    if (!root) return;

    var track = $('#sliderTrack');
    var dotsHost = $('#sliderDots');
    var prev = $('#sliderPrev');
    var next = $('#sliderNext');
    var empty = $('#sliderEmpty');
    var index = 0;
    var timer = null;
    var slides = [];

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var autoplayMs = parseInt(root.getAttribute('data-autoplay'), 10) || 6500;

    function count() { return slides.length; }

    function goTo(n, userDriven) {
      if (!count()) return;
      index = (n + count()) % count();
      track.style.transform = 'translate3d(' + (-index * 100) + '%,0,0)';
      slides.forEach(function (slide, i) {
        slide.setAttribute('aria-hidden', String(i !== index));
      });
      Array.prototype.forEach.call(dotsHost.children, function (dot, i) {
        dot.setAttribute('aria-selected', String(i === index));
      });
      if (userDriven) restart();
    }

    function start() {
      if (reduceMotion || count() < 2 || timer) return;
      timer = setInterval(function () { goTo(index + 1); }, autoplayMs);
    }
    function stop() { clearInterval(timer); timer = null; }
    function restart() { stop(); start(); }

    // Safe to call more than once — it rebuilds from whatever slides survive.
    function build() {
      stop();
      slides = $$('.slide', track);
      dotsHost.innerHTML = '';

      if (!count()) {                       // no photos uploaded yet
        empty.hidden = false;
        prev.hidden = next.hidden = true;
        return;
      }
      empty.hidden = true;
      if (index >= count()) index = 0;

      var many = count() > 1;
      prev.hidden = next.hidden = !many;
      if (many) {
        slides.forEach(function (_, i) {
          var dot = document.createElement('button');
          dot.type = 'button';
          dot.setAttribute('role', 'tab');
          dot.setAttribute('aria-label', 'Photo ' + (i + 1) + ' of ' + count());
          dot.addEventListener('click', function () { goTo(i, true); });
          dotsHost.appendChild(dot);
        });
      }
      goTo(index);
      start();
    }

    prev.addEventListener('click', function () { goTo(index - 1, true); });
    next.addEventListener('click', function () { goTo(index + 1, true); });
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { goTo(index - 1, true); }
      else if (e.key === 'ArrowRight') { goTo(index + 1, true); }
    });

    // Swipe
    var startX = 0, deltaX = 0, dragging = false;
    root.addEventListener('touchstart', function (e) {
      if (count() < 2) return;
      startX = e.touches[0].clientX; deltaX = 0; dragging = true;
      stop();
      root.classList.add('is-dragging');
    }, { passive: true });
    root.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      deltaX = e.touches[0].clientX - startX;
      var pct = (deltaX / root.clientWidth) * 100;
      track.style.transform = 'translate3d(' + (-index * 100 + pct) + '%,0,0)';
    }, { passive: true });
    root.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false;
      root.classList.remove('is-dragging');
      if (Math.abs(deltaX) > root.clientWidth * 0.15) goTo(index + (deltaX < 0 ? 1 : -1));
      else goTo(index);
      start();
    });

    // Images that 404 drop their own slide, so wait for them to settle first —
    // but never let one that hangs keep the slider from ever starting.
    var imgs = $$('.slide img', track);
    var left = imgs.length;
    var fallback = setTimeout(build, 2500);

    function settle() {
      if (--left > 0) return;
      clearTimeout(fallback);
      build();
    }

    if (!left) { clearTimeout(fallback); build(); return; }
    imgs.forEach(function (img) {
      if (img.complete) setTimeout(settle, 0);
      else {
        img.addEventListener('load', settle);
        img.addEventListener('error', function () {
          settle();
          if (left <= 0) build();          // a late failure re-counts the slides
        });
      }
    });
  })();

  /* ---------- 4c. Map ----------
     Google's embed endpoint cannot take a maps.app.goo.gl short link, so the
     panel stays a clickable card until a coordinate or address is configured.
     Set WILLY_LOCATION.embedQuery and it becomes a live map. */
  (function map() {
    var panel = $('#mapPanel');
    var place = window.WILLY_LOCATION;
    if (!panel || !place || !place.embedQuery) return;

    var frame = document.createElement('iframe');
    frame.title = 'Map to Willy Auto Perfection Centre';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    frame.src = 'https://maps.google.com/maps?q=' + encodeURIComponent(place.embedQuery) +
                '&z=' + (place.zoom || 17) + '&output=embed';

    var wrap = document.createElement('div');
    wrap.className = 'map';
    wrap.appendChild(frame);
    panel.replaceWith(wrap);
  })();

  /* ---------- 5. Toast ---------- */
  var toastEl = $('#toast');
  var toastTimer;
  function toast(message) {
    if (!toastEl) return;
    toastEl.innerHTML =
      '<svg aria-hidden="true"><use href="#i-check-circle"></use></svg><span></span>';
    toastEl.querySelector('span').textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 4200);
  }

  /* ---------- 6. Form helpers ---------- */
  function val(form, name) {
    var el = form.elements[name];
    return el && el.value ? el.value.trim() : '';
  }

  function flagMissing(form, names) {
    var firstBad = null;
    names.forEach(function (name) {
      var el = form.elements[name];
      if (!el) return;
      if (!el.value || !el.value.trim()) { if (!firstBad) firstBad = el; }
    });
    if (firstBad) {
      firstBad.focus();
      if (typeof firstBad.reportValidity === 'function') firstBad.reportValidity();
    }
    return firstBad;
  }

  function prettyDate(value) {
    if (!value) return '';
    var parts = value.split('-');
    if (parts.length !== 3) return value;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function buildMessage(fields) {
    var lines = ['Hello ' + BUSINESS + ', I would like to book my car in.', ''];
    fields.forEach(function (pair) {
      if (pair[1]) lines.push(pair[0] + ': ' + pair[1]);
    });
    lines.push('', 'Sent from the website.');
    return lines.join('\n');
  }

  function openWhatsApp(message) {
    var url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(message);
    var win = window.open(url, '_blank', 'noopener');
    if (!win) window.location.href = url;          // pop-up blocked: go directly
    toast('Opening WhatsApp with your details…');
  }

  /* ---------- 7. Hero quick quote ---------- */
  var quick = $('#quickQuote');
  if (quick) {
    quick.addEventListener('submit', function (e) {
      e.preventDefault();
      if (flagMissing(quick, ['name', 'phone', 'service'])) return;
      openWhatsApp(buildMessage([
        ['Name', val(quick, 'name')],
        ['Phone', val(quick, 'phone')],
        ['Vehicle', val(quick, 'vehicle')],
        ['Service needed', val(quick, 'service')]
      ]));
    });
  }

  /* ---------- 8. Full booking form ---------- */
  var booking = $('#bookingForm');

  function bookingFields() {
    return [
      ['Name', val(booking, 'name')],
      ['Phone', val(booking, 'phone')],
      ['Vehicle', [val(booking, 'vehicle'), val(booking, 'year')].filter(Boolean).join(' ')],
      ['Service needed', val(booking, 'service')],
      ['Preferred date', prettyDate(val(booking, 'date'))],
      ['Preferred time', val(booking, 'time')],
      ['Details', val(booking, 'notes')]
    ];
  }

  if (booking) {
    // Cannot book a date that has already gone
    var dateInput = booking.elements['date'];
    if (dateInput) {
      var today = new Date();
      dateInput.min = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0')
      ].join('-');
    }

    booking.addEventListener('submit', function (e) {
      e.preventDefault();
      if (flagMissing(booking, ['name', 'phone', 'service'])) return;
      openWhatsApp(buildMessage(bookingFields()));
    });

    var emailBtn = $('#emailBooking');
    if (emailBtn) {
      emailBtn.addEventListener('click', function () {
        if (flagMissing(booking, ['name', 'phone', 'service'])) return;
        var subject = 'Booking request — ' + (val(booking, 'service') || 'Service') +
                      (val(booking, 'vehicle') ? ' (' + val(booking, 'vehicle') + ')' : '');
        window.location.href = 'mailto:' + EMAIL +
          '?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(buildMessage(bookingFields()));
        toast('Opening your email app…');
      });
    }
  }

  /* ---------- 9. "Book this service" → prefill and scroll ---------- */
  $$('.js-book').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var wanted = btn.getAttribute('data-service') || '';
      var select = booking && booking.elements['service'];
      if (select) {
        var matched = Array.prototype.some.call(select.options, function (opt) {
          if (opt.text.replace(/\s+/g, ' ').trim().toLowerCase() === wanted.toLowerCase()) {
            select.value = opt.value;
            return true;
          }
          return false;
        });
        if (!matched) {
          // Fall back to a loose match so a renamed option still lands somewhere sensible
          Array.prototype.some.call(select.options, function (opt) {
            if (opt.value && opt.text.toLowerCase().indexOf(wanted.split(' ')[0].toLowerCase()) === 0) {
              select.value = opt.value;
              return true;
            }
            return false;
          });
        }
      }
      var target = document.getElementById('book');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(function () {
        var name = booking && booking.elements['name'];
        if (name && !name.value) name.focus({ preventScroll: true });
      }, 650);
      toast(wanted + ' selected — just add your details.');
    });
  });

  /* ---------- 10. Footer year ---------- */
  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
