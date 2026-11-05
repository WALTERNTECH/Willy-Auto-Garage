/* =========================================================
   Willy Auto Perfection Centre — motion
   Everything here is decoration. The page reads the same without it, and
   none of it runs for visitors who ask their device for reduced motion.
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- 1. Scroll progress ---------- */
  var bar = $('#progressBar');
  if (bar) {
    var ticking = false;
    var paint = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(window.scrollY / max, 1) : 0) + ')';
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    }, { passive: true });
    paint();
  }

  /* ---------- 2. Stats count up the first time they are seen ---------- */
  var counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
    var format = function (value, decimals) {
      return decimals
        ? value.toFixed(decimals)
        : Math.round(value).toLocaleString('en-US');
    };

    counters.forEach(function (el) {
      el.textContent = format(0, parseInt(el.getAttribute('data-decimals'), 10) || 0);
    });

    var countIO = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);

        var el = entry.target;
        var target = parseFloat(el.getAttribute('data-count'));
        var decimals = parseInt(el.getAttribute('data-decimals'), 10) || 0;
        var duration = 1600;
        var t0 = null;

        var step = function (now) {
          if (t0 === null) t0 = now;
          var t = Math.min((now - t0) / duration, 1);
          el.textContent = format(target * easeOut(t), decimals);
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });

    counters.forEach(function (el) { countIO.observe(el); });
  }

  /* ---------- 3. The process line draws across when the steps arrive ---------- */
  var steps = $('.steps');
  if (steps && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries, obs) {
      if (!entries[0].isIntersecting) return;
      steps.classList.add('is-in');
      obs.disconnect();
    }, { threshold: 0.35 }).observe(steps);
  }

  if (!finePointer) return;   // the rest follows a mouse, so phones skip it

  /* ---------- 4. A soft light that follows the pointer across each card ---------- */
  $$('.service, .feature, .step, .review').forEach(function (card) {
    card.classList.add('spot');
    var frame = 0;
    card.addEventListener('pointermove', function (e) {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        frame = 0;
      });
    });
  });

  /* ---------- 5. The background light leans gently toward the pointer ---------- */
  var stage = $('.stage');
  var aurora = $('.aurora');
  if (stage && aurora) {
    var target = { x: 0, y: 0 };
    var now = { x: 0, y: 0 };
    var running = false;

    var loop = function () {
      now.x += (target.x - now.x) * 0.06;
      now.y += (target.y - now.y) * 0.06;
      aurora.style.transform = 'translate3d(' + now.x.toFixed(2) + 'px,' + now.y.toFixed(2) + 'px,0)';
      if (Math.abs(target.x - now.x) > 0.1 || Math.abs(target.y - now.y) > 0.1) {
        requestAnimationFrame(loop);
      } else {
        running = false;
      }
    };
    var kick = function () { if (!running) { running = true; requestAnimationFrame(loop); } };

    stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 40;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 26;
      kick();
    });
    stage.addEventListener('pointerleave', function () { target.x = 0; target.y = 0; kick(); });
  }
})();
