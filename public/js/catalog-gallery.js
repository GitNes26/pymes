(function () {
  'use strict';
  // Fotos extra de un producto (modelos, otros ángulos) en las tarjetas del catálogo:
  // en el celular se desliza con el dedo; los puntos indican cuál se ve. Con mouse, la 2.ª foto aparece al pasar encima.
  function frames(wrap) {
    return [wrap.querySelector('img:not(.prod-img-alt)')].concat([].slice.call(wrap.querySelectorAll('.prod-img-alt')));
  }
  function go(wrap, i) {
    var f = frames(wrap);
    if (f.length < 2) return;
    i = (i + f.length) % f.length;
    wrap.__gi = i;
    f.forEach(function (im, k) { if (im) im.classList.toggle('is-on', k === i && k > 0); });
    var dots = wrap.querySelectorAll('.prod-dots i');
    for (var d = 0; d < dots.length; d++) dots[d].classList.toggle('on', d === i);
  }
  var sx = 0, sy = 0, sw = null;
  document.addEventListener('touchstart', function (e) {
    var wrap = e.target.closest && e.target.closest('.prod-img-wrap');
    if (!wrap || !wrap.querySelector('.prod-img-alt')) { sw = null; return; }
    sw = wrap; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!sw) return;
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy, wrap = sw;
    sw = null;
    if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      go(wrap, (wrap.__gi || 0) + (dx < 0 ? 1 : -1));
      wrap.__swiped = Date.now();
    }
  }, { passive: true });
  // Un deslizamiento no debe abrir el producto ni el zoom
  document.addEventListener('click', function (e) {
    var wrap = e.target.closest && e.target.closest('.prod-img-wrap');
    if (wrap && wrap.__swiped && Date.now() - wrap.__swiped < 450) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  window.catalogGalleryVisible = function (card) {
    var on = card && card.querySelector('.prod-img-alt.is-on');
    if (on) return on;
    var alt1 = card && card.querySelector('.prod-img-alt[data-i="1"]');
    return (alt1 && card.matches(':hover') && parseFloat(getComputedStyle(alt1).opacity) > 0.5) ? alt1 : null;
  };
})();
