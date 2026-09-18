(function () {
  'use strict';
  // Las imágenes deben cargar siempre. Si una falla (red móvil inestable,
  // servidor ocupado, imagen externa lenta) se reintenta varias veces con
  // espera creciente y SOLO si todos los intentos fallan se muestra el
  // marcador "sin imagen". Los <img> ya no llevan onerror en línea: ese
  // onerror cambiaba el src al marcador en el primer fallo e impedía reintentar.
  var MAX_RETRIES = 4;
  var RETRY_DELAY_MS = 700;
  var FALLBACK = '/img/sin-imagen.svg';
  var tries = new WeakMap();

  function clean(src) { return String(src).replace(/([?&])__r=\d+&?/, '$1').replace(/[?&]$/, ''); }
  function bust(src) { return clean(src) + (src.indexOf('?') > -1 ? '&' : '?') + '__r=' + Date.now(); }

  function giveUp(img) {
    var hide = img.getAttribute('data-hide-on-error') !== null;
    if (hide) { img.style.display = 'none'; return; }
    if (img.getAttribute('data-no-fallback') !== null) return;
    if (img.getAttribute('src') === FALLBACK) return;
    img.setAttribute('data-failed', '1');
    img.removeAttribute('srcset');
    img.src = FALLBACK;
  }

  function retry(img) {
    if (!img || img.tagName !== 'IMG') return;
    if (img.getAttribute('data-failed') !== null) return;
    if (img.getAttribute('src') === FALLBACK) return;
    var base = img.getAttribute('data-retry-src') || img.getAttribute('src');
    if (!base) return;
    var n = tries.get(img) || 0;
    if (n >= MAX_RETRIES) { giveUp(img); return; }
    tries.set(img, n + 1);
    img.setAttribute('data-retry-src', clean(base));
    // Las imágenes lazy que fallaron deben pedirse ya, no esperar al scroll
    if (img.loading === 'lazy') img.loading = 'eager';
    setTimeout(function () {
      // Si entre tanto cambió el src por otra causa (p. ej. variante), no lo pisamos
      if (img.getAttribute('src') === FALLBACK) return;
      img.src = bust(base);
    }, RETRY_DELAY_MS * (n + 1));
  }

  // "error" no burbujea, pero sí se escucha en captura para cualquier imagen
  document.addEventListener('error', function (e) { retry(e.target); }, true);

  // Imágenes que ya fallaron antes de que este script estuviera escuchando,
  // o que quedaron "completas" pero vacías: se reintentan al cargar la página
  // y cuando el usuario vuelve a la pestaña (móvil con red intermitente).
  function sweep() {
    var imgs = document.images;
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (im.complete && im.naturalWidth === 0 && im.getAttribute('src') && im.getAttribute('src') !== FALLBACK && im.getAttribute('data-failed') === null) retry(im);
    }
  }
  window.addEventListener('load', function () { sweep(); setTimeout(sweep, 2500); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) sweep(); });
  window.addEventListener('online', sweep);
})();
