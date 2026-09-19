(function () {
  function initRipple() {
    document.addEventListener('pointerdown', function (e) {
      var el = e.target.closest('.m-ripple, .m-btn, .m-btn-icon, .m-chip, .m-nav-item, .m-card.m-hover, .m-list-item, .btn-accent, .cat-chip');
      if (!el) return;
      var rect = el.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height) * 2.2;
      var ink = document.createElement('span');
      ink.className = 'm-ripple-ink';
      ink.style.width = ink.style.height = size + 'px';
      ink.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ink.style.top = (e.clientY - rect.top - size / 2) + 'px';
      el.appendChild(ink);
      setTimeout(function () { ink.remove(); }, 650);
    });
  }

  // "1234.5" -> "1,234.5" (separador de miles solo en la parte entera,
  // para no tocar los decimales ni romper números negativos).
  function fmtThousands(n, decimals) {
    var s = n.toFixed(decimals);
    var neg = s.charAt(0) === '-';
    if (neg) s = s.slice(1);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + parts.join('.');
  }

  // Contadores animados: <span data-count="123.45" data-prefix="$" data-decimals="2">
  function animateCounts() {
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var dur = el.getAttribute('data-dur') ? parseInt(el.getAttribute('data-dur'), 10) : 900;
      var start = null;
      function frame(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var ease = 1 - Math.pow(1 - p, 3);
        var val = target * ease;
        el.textContent = prefix + fmtThousands(val, decimals) + suffix;
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = prefix + fmtThousands(target, decimals) + suffix;
      }
      requestAnimationFrame(frame);
    });
  }

  // Barras de progreso animadas (horizontal y vertical)
  function animateBars() {
    document.querySelectorAll('[data-bar]').forEach(function (el) {
      var w = el.getAttribute('data-bar');
      requestAnimationFrame(function () { el.style.width = w + '%'; });
    });
    document.querySelectorAll('[data-bar-v]').forEach(function (el) {
      var h = el.getAttribute('data-bar-v');
      var val = h.indexOf('%') > -1 ? h : h + 'px';
      requestAnimationFrame(function () { el.style.height = val; });
    });
  }

  // Tarjetas que aparecen en cascada
  function cascadeIn() {
    var items = document.querySelectorAll('.m-stagger');
    items.forEach(function (el, i) {
      el.style.animationDelay = (i * 45) + 'ms';
      el.classList.add('m-rise');
    });
  }

  // Revelar al hacer scroll (IntersectionObserver)
  function revealOnScroll() {
    var els = document.querySelectorAll('.m-reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('m-rise'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('m-rise');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  // Click: sonrisa táctil en elementos activos (estado de capa)
  function stateLayers() {
    document.addEventListener('pointerdown', function (e) {
      var el = e.target.closest('[data-active-layer]');
      if (!el) return;
      el.classList.add('m-active-layer');
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.classList.remove('m-active-layer'); }, 180);
    });
  }

  // Switches Material: estado de presión en el thumb
  function switches() {
    document.querySelectorAll('.m-switch').forEach(function (sw) {
      sw.addEventListener('pointerdown', function () {
        var t = sw.querySelector('.thumb'); if (t) t.style.transform = 'scale(.78)';
      });
      sw.addEventListener('pointerup', function () { setTimeout(function () {
        var t = sw.querySelector('.thumb'); if (t) t.style.transform = '';
      }, 100); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  function init() {
    initRipple();
    animateCounts();
    animateBars();
    cascadeIn();
    revealOnScroll();
    stateLayers();
    switches();
  }

  // Refrescar animaciones tras un reemplazo de contenido (AJAX / SPA-lite)
  window.mRefresh = function () {
    animateCounts();
    animateBars();
    cascadeIn();
    switches();
    if (typeof window.onPanelSwap === 'function') window.onPanelSwap();
  };
})();
