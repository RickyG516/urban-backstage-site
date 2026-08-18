document.addEventListener('DOMContentLoaded', function () {

  /* ---------- scroll reveal ---------- */
  var revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- 3D tilt on cards ---------- */
  var tiltEls = document.querySelectorAll('.tilt');
  var isTouch = window.matchMedia('(hover: none)').matches;
  if (!isTouch) {
    tiltEls.forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        var rx = (py * -8).toFixed(2);
        var ry = (px * 10).toFixed(2);
        el.style.transform = 'perspective(900px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateZ(6px)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
      });
    });
  }

  /* ---------- animated stat counters ---------- */
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = parseFloat(el.getAttribute('data-count'));
        var suffix = el.getAttribute('data-suffix') || '';
        var dur = 1400;
        var start = null;
        function step(ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        cio.unobserve(el);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* ---------- hero ambient light particles (canvas, lightweight, no dependencies) ---------- */
  var particleHost = document.querySelector('.hero-particles');
  if (particleHost && !isTouch) {
    var canvas = document.createElement('canvas');
    particleHost.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var w, h, particles;

    function resize() {
      w = canvas.width = particleHost.offsetWidth;
      h = canvas.height = particleHost.offsetHeight;
    }
    function makeParticles() {
      var count = Math.max(18, Math.floor(w / 60));
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.8 + Math.random() * 2.2,
          vy: 0.08 + Math.random() * 0.22,
          vx: (Math.random() - 0.5) * 0.15,
          a: 0.15 + Math.random() * 0.45,
          flicker: Math.random() * Math.PI * 2
        });
      }
    }
    resize();
    makeParticles();
    window.addEventListener('resize', function () { resize(); makeParticles(); });

    function tick() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(function (p) {
        p.y -= p.vy;
        p.x += p.vx;
        p.flicker += 0.02;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        var alpha = p.a * (0.6 + 0.4 * Math.sin(p.flicker));
        var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        grad.addColorStop(0, 'rgba(230,192,125,' + alpha + ')');
        grad.addColorStop(1, 'rgba(230,192,125,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- grow-divider retrigger on scroll ---------- */
  var growEls = document.querySelectorAll('.grow-divider');
  if ('IntersectionObserver' in window && growEls.length) {
    var gio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); gio.unobserve(entry.target); }
      });
    }, { threshold: 0.3 });
    growEls.forEach(function (el) { gio.observe(el); });
  }

});
