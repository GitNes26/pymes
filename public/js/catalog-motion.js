(function () {
  'use strict';
  var root = document.documentElement;
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('js-motion');

  // Qué se revela al hacer scroll (sin tocar las plantillas)
  var SEL = [
    '.prod-card', '.oferta-card', '.related-card',
    '.ofertas-header', '.sec-head', '.xs-sec', '.contact-section', '.specs-wrap',
    '.ftr-inner > *'
  ].join(',');

  var io = new IntersectionObserver(function (entries) {
    var batch = entries.filter(function (e) { return e.isIntersecting; });
    batch.forEach(function (e, i) {
      var el = e.target;
      io.unobserve(el);
      el.style.setProperty('--d', Math.min(i, 7) * 0.07 + 's');
      requestAnimationFrame(function () { el.classList.add('in'); });
      // Al terminar se libera: el hover y los filtros vuelven a funcionar con normalidad
      setTimeout(function () {
        el.classList.remove('rv', 'rv-l', 'rv-r', 'in');
        el.style.removeProperty('--d');
      }, 1500 + Math.min(i, 7) * 70);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

  function arm(scope) {
    var list = (scope || document).querySelectorAll(SEL);
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.__mo) continue;
      el.__mo = 1;
      el.classList.add('rv');
      if (el.matches('.ftr-inner > *')) el.classList.add(i % 2 ? 'rv-r' : 'rv-l');
      io.observe(el);
    }
  }

  // Fotos con fundido (solo las que aún no cargaron)
  function fadeImgs(scope) {
    var imgs = (scope || document).querySelectorAll('.prod-img-wrap img:not(.prod-img-alt), .oferta-img-wrap img, .related-img');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (im.__mo) continue;
      im.__mo = 1;
      if (im.complete && im.naturalWidth > 0) continue;
      im.classList.add('mo-img');
      (function (x) {
        var done = function () { x.classList.add('ld'); };
        x.addEventListener('load', done, { once: true });
        x.addEventListener('error', function () { setTimeout(done, 3500); }, { once: true });
        setTimeout(done, 5000); // nunca se queda invisible
      })(im);
    }
  }

  function start() {
    fadeImgs(); arm();
    var ff = document.querySelector(".filter-fab");
    if (ff) { ff.classList.add("mo-enter"); ff.addEventListener("animationend", function (ev) { if (ev.animationName === "moFabIn") ff.classList.remove("mo-enter"); }); }
    // Red de seguridad: si algo visible no se reveló, se muestra
    setTimeout(function () {
      var pend = document.querySelectorAll('.rv:not(.in)');
      for (var i = 0; i < pend.length; i++) {
        var r = pend[i].getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0 && r.width > 0) pend[i].classList.add('in');
      }
    }, 2800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  // Contenido que aparece después (paginación, filtros)
  window.addEventListener('load', function () {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].addedNodes && muts[i].addedNodes.length) { arm(); fadeImgs(); return; }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });

  // Carrito: la insignia rebota y el botón lanza un aro al cambiar la cantidad
  window.addEventListener('load', function () {
    function watch() {
      var badge = document.getElementById('chat-fab-badge');
      var fab = document.getElementById('chat-fab');
      if (!badge || !fab) return setTimeout(watch, 600);
      fab.classList.add("mo-enter"); fab.addEventListener("animationend", function (ev) { if (ev.animationName === "moFabIn") fab.classList.remove("mo-enter"); });
      var last = badge.textContent;
      new MutationObserver(function () {
        if (badge.textContent === last) return;
        last = badge.textContent;
        badge.classList.remove('bump'); fab.classList.remove('ping');
        void badge.offsetWidth;
        badge.classList.add('bump'); fab.classList.add('ping');
        setTimeout(function () { badge.classList.remove('bump'); fab.classList.remove('ping'); }, 900);
      }).observe(badge, { childList: true, characterData: true, subtree: true });
    }
    watch();
  });
})();
