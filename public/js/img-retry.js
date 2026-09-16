(function () {
  'use strict';
  // En celular (redes más lentas/inestables) algunas imágenes fallan la
  // primera vez que se piden. El evento "error" de <img> no burbujea, pero
  // sí se puede escuchar en fase de captura sobre todo el documento — así
  // se cubre cualquier imagen, presente o futura, sin tocar cada plantilla.
  var MAX_RETRIES = 2;
  var RETRY_DELAY_MS = 900;
  var tries = new WeakMap();

  function onImgError(e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    if (img.getAttribute('data-no-retry') !== null) return;
    var src = img.getAttribute('data-retry-src') || img.src;
    if (!src) return;
    var n = tries.get(img) || 0;
    if (n >= MAX_RETRIES) return;
    tries.set(img, n + 1);
    var cleanSrc = src.split('?__r=')[0];
    img.setAttribute('data-retry-src', cleanSrc);
    // Si un onerror en la propia imagen ya la cambió a un placeholder
    // mientras esperábamos, no lo pisemos con la URL rota de nuevo.
    var srcAtSchedule = img.src;
    setTimeout(function () {
      if (img.getAttribute('data-no-retry') !== null) return;
      if (img.src !== srcAtSchedule) return;
      img.src = cleanSrc + '?__r=' + Date.now();
    }, RETRY_DELAY_MS * (n + 1));
  }

  document.addEventListener('error', onImgError, true);
})();
