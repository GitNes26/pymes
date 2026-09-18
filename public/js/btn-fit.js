(function () {
  'use strict';
  // Si el texto de un botón no cabe junto a su icono, se muestra solo el icono
  // (el texto sigue en el DOM para lectores de pantalla y como title).
  var SEL = '.prod-btn, .prod-view-btn, .btn-add, .btn-wa, .admin-pill, .filter-fab, [data-fit]';
  var seen = new WeakSet();
  var pending = false;

  function prep(btn) {
    if (seen.has(btn)) return btn.__fit;
    seen.add(btn);
    var icon = null, textNodes = [];
    for (var n = btn.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 1 && !icon && /^(I|SVG)$/i.test(n.tagName)) icon = n;
      else if (n.nodeType === 3 && n.nodeValue.trim()) textNodes.push(n);
    }
    if (!icon || !textNodes.length) { btn.__fit = null; return null; }
    var lbl = document.createElement('span');
    lbl.className = 'fit-lbl';
    textNodes[0].parentNode.insertBefore(lbl, textNodes[0]);
    textNodes.forEach(function (t) { lbl.appendChild(t); });
    if (!btn.getAttribute('title') && !btn.getAttribute('aria-label')) btn.setAttribute('title', lbl.textContent.trim());
    btn.__fit = { icon: icon, lbl: lbl };
    return btn.__fit;
  }

  function fit(btn) {
    var f = prep(btn);
    if (!f) return;
    if (!btn.offsetParent && getComputedStyle(btn).position !== 'fixed') return; // oculto: se mide cuando se muestre
    btn.classList.remove('icon-only');
    var cs = getComputedStyle(btn);
    var avail = btn.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (!btn.clientWidth) return;
    var gap = parseFloat(cs.columnGap) || parseFloat(cs.gap) || 6;
    var need = f.icon.getBoundingClientRect().width + gap + f.lbl.getBoundingClientRect().width;
    if (need > avail + 0.5) btn.classList.add('icon-only');
  }

  function all() { pending = false; document.querySelectorAll(SEL).forEach(fit); }
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(all); } }

  var ro = 'ResizeObserver' in window ? new ResizeObserver(function (es) { es.forEach(function (e) { fit(e.target); }); }) : null;
  function watch() {
    document.querySelectorAll(SEL).forEach(function (b) { if (!b.__ro) { b.__ro = 1; if (ro) ro.observe(b); } });
    schedule();
  }

  function start() {
    watch();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('load', schedule);
    new MutationObserver(function (m) { for (var i = 0; i < m.length; i++) if (m[i].addedNodes.length) { watch(); return; } }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
