/* ============================================================
   SEARCHABLE SELECT — convierte cualquier <select> en un combo
   con buscador, sin tocar el HTML de cada página.
   - El <select> original se queda en el DOM (oculto visualmente)
     para que los formularios sigan funcionando igual.
   - Se sincroniza en ambas direcciones: si algún script hace
     select.value = "x" (sin disparar 'change'), la etiqueta
     visible se actualiza igual.
   - Detecta <select> agregados después (constructor de bloques,
     variantes de producto, etc.) vía MutationObserver.
   - Para no habilitarlo en un <select> puntual: class="no-search-select".
   ============================================================ */
(function () {
  'use strict';
  // DESACTIVADO: los <select> se usan normales (nativos), sin buscador ni lista flotante.
  // Para volver a activar el combo con buscador, borra este return.
  return;
  if (window.__searchableSelectLoaded) return;
  window.__searchableSelectLoaded = true;

  var STYLE = '\
.ss-wrap{position:relative;display:inline-block;max-width:100%;min-width:0;box-sizing:border-box;vertical-align:top;}\
.ss-wrap.ss-block{display:block;width:100%;}\
.ss-native{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important;opacity:0!important;pointer-events:none!important;}\
.ss-btn{display:flex;width:100%;max-width:100%;min-width:0;box-sizing:border-box;align-items:center;justify-content:space-between;gap:6px;margin:0;appearance:none;-webkit-appearance:none;text-transform:none;cursor:pointer;user-select:none;background:var(--md-surface-container-low,#fff);}\
.m-field .ss-btn{width:100%;min-height:38px;padding:.65rem .75rem;border:1.5px solid var(--md-outline);border-radius:var(--md-radius-sm);background:var(--md-surface-container-low);font-size:.85rem;font-family:var(--md-font-family);font-weight:400;line-height:1.5;color:var(--md-on-surface);outline:none;box-shadow:none;transition:border-color var(--md-motion),background var(--md-motion),box-shadow var(--md-motion);}\
.m-field .ss-btn:hover{border-color:var(--md-outline);background:var(--md-surface-container-low);}\
.m-field .ss-btn:focus-visible,.m-field .ss-wrap.ss-open .ss-btn{border-color:var(--md-primary);background:var(--md-surface);outline:none;box-shadow:0 0 0 3px color-mix(in srgb, var(--md-primary) 15%, transparent);}\
.ss-btn.ss-disabled{cursor:not-allowed;opacity:.55;}\
.ss-btn-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;text-align:left;}\
.ss-btn-label.ss-placeholder{opacity:.55;}\
.ss-caret{flex-shrink:0;width:14px;height:14px;transition:transform .18s cubic-bezier(.22,1,.36,1);opacity:.55;}\
.ss-wrap.ss-open .ss-caret{transform:rotate(180deg);}\
.ss-panel{position:fixed;box-sizing:border-box;z-index:2000;background:var(--md-surface,#fff);border:1px solid var(--md-outline-soft,#e2e8f0);border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.14);overflow:hidden;opacity:0;transform:translateY(-4px) scale(.98);transform-origin:top center;pointer-events:none;transition:opacity .15s ease,transform .15s cubic-bezier(.22,1,.36,1);}\
.ss-panel.ss-panel-open{opacity:1;transform:none;pointer-events:auto;}\
.ss-panel.ss-drop-up{transform-origin:bottom center;transform:translateY(4px) scale(.98);}\
.ss-panel.ss-drop-up.ss-panel-open{transform:none;}\
.ss-search-wrap{padding:6px;border-bottom:1px solid var(--md-outline-soft,#eef1f6);position:relative;background:var(--md-surface,#fff);}\
.ss-search{width:100%;min-width:0;padding:.5rem .7rem .5rem 2rem;border:1px solid var(--md-outline,#e2e8f0);border-radius:var(--md-radius-sm,8px);font-size:.85rem;font-family:var(--md-font-family,Inter,system-ui,sans-serif);line-height:1.25;outline:none;box-sizing:border-box;background:var(--md-surface-container-low,#f8fafc);color:var(--md-on-surface,#0f172a);transition:border-color var(--md-motion,.2s ease),background var(--md-motion,.2s ease);}\
.ss-search::placeholder{color:var(--md-outline,#64748b);opacity:.6;}\
.ss-search:focus{border-color:var(--md-primary,#2c2c2e);background:var(--md-surface,#fff);box-shadow:none;}\
.ss-search-ico{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:13px;height:13px;color:var(--md-on-surface-variant,#64748b);opacity:.65;pointer-events:none;}\
.ss-list{max-height:240px;overflow-y:auto;padding:4px;}\
.ss-opt{min-width:0;padding:7px 10px;border-radius:7px;font-size:13px;cursor:pointer;color:var(--md-on-surface,#1e293b);display:flex;align-items:center;justify-content:space-between;gap:8px;overflow-wrap:anywhere;}\
.ss-opt:hover,.ss-opt.ss-hi{background:#f0f0f1;color:#2c2c2e;}\
.ss-opt.ss-selected{font-weight:700;color:#2c2c2e;}\
.ss-opt.ss-selected::after{content:"✓";font-size:11px;flex-shrink:0;}\
.ss-opt.ss-disabled{opacity:.4;cursor:not-allowed;}\
.ss-group-lbl{padding:6px 10px 3px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;}\
.ss-empty{padding:14px 10px;text-align:center;font-size:12px;color:#94a3b8;}\
.ss-opt.ss-add-new{color:var(--md-primary,#2c2c2e);font-weight:700;border-bottom:1px solid var(--md-outline-soft,#eef1f6);margin-bottom:2px;padding-bottom:9px;}\
.ss-opt.ss-add-new:hover,.ss-opt.ss-add-new.ss-hi{background:var(--md-primary-container,#eaeaeb);color:var(--md-on-primary-container,#2c2c2e);}\
body.dark .ss-opt.ss-add-new{border-color:#30363d;}\
body.dark .ss-panel,body.dark .ss-btn{background:#0d1117;border-color:#30363d;}\
body.dark .m-field .ss-btn{background:#0d1117;border-color:#30363d;color:#e6edf3;}\
body.dark .m-field .ss-btn:focus-visible,body.dark .m-field .ss-wrap.ss-open .ss-btn{background:#161b22;border-color:#d4d4d4;}\
body.dark .ss-search{background:#161b22;border-color:#30363d;color:#e6edf3;}\
body.dark .ss-opt{color:#e6edf3;}\
body.dark .ss-opt:hover,body.dark .ss-opt.ss-hi{background:#2a2a2d;color:#d4d4d4;}\
';

  function injectStyle() {
    var tag = document.createElement('style');
    tag.setAttribute('data-searchable-select', '');
    tag.textContent = STYLE;
    document.head.appendChild(tag);
  }

  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function svgCaret() {
    return '<svg class="ss-caret" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l5 5 5-5"/></svg>';
  }
  function svgSearch() {
    return '<svg class="ss-search-ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="9" r="6"/><path d="M17 17l-3.5-3.5"/></svg>';
  }

  function readItems(select) {
    var items = [];
    Array.prototype.forEach.call(select.children, function (child) {
      if (child.tagName === 'OPTGROUP') {
        items.push({ group: child.label || '' });
        Array.prototype.forEach.call(child.children, function (opt) {
          if (opt.tagName === 'OPTION') items.push({ opt: opt });
        });
      } else if (child.tagName === 'OPTION') {
        items.push({ opt: child });
      }
    });
    return items;
  }

  function enhance(select) {
    if (!select || select.dataset.ssEnhanced) return;
    if (select.multiple || select.classList.contains('no-search-select')) return;
    select.dataset.ssEnhanced = '1';

    // Muchos <select> de esta app no traen su propio ancho: lo heredan de una
    // regla CSS como ".m-field select{width:100%}" que apunta a la etiqueta
    // <select>. Como el botón nuevo no es un <select>, esa regla no lo alcanza.
    // Se decide el ancho explícitamente antes de tocar el DOM: si no hay una
    // clase/estilo de ancho propio y el padre no es un contenedor flex (donde
    // el tamaño lo decide flexbox), se hereda el ancho resuelto por el <select>
    // original para que el layout no cambie.
    var parentDisplay = select.parentNode ? getComputedStyle(select.parentNode).display : '';
    var isFlexChild = parentDisplay === 'flex' || parentDisplay === 'inline-flex';
    var selCls = select.className || '';
    var selStyle = select.getAttribute('style') || '';
    // "w-full" (o width:100% inline) pide ancho fluido a propósito — se trata
    // distinto de un ancho FIJO propio (w-52, width:180px…): ese sí se deja
    // tal cual en el botón; el fluido necesita que el wrapper también sea
    // block+100%, porque de otro modo un <div> inline-block se encoge a su
    // contenido sin importar el width:100% que traiga el botón por dentro.
    var wantsFullWidth = /\bw-full\b/.test(selCls) || /(?:^|;)\s*width\s*:\s*100%/.test(selStyle);
    var hasFixedWidth = !wantsFullWidth && (/\bw-(?:\d|auto|px|screen|min|max|fit)\b/.test(selCls) ||
      /(?:^|;)\s*width\s*:/.test(selStyle));
    var selectWidthPx = null;
    if (!isFlexChild && !hasFixedWidth && !wantsFullWidth) {
      var w = getComputedStyle(select).width;
      if (w && w !== 'auto') selectWidthPx = w;
    }

    var wrap = document.createElement('div');
    wrap.className = 'ss-wrap' + (!isFlexChild && !hasFixedWidth ? ' ss-block' : '');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ss-btn ' + (select.className || '');
    if (select.getAttribute('style')) btn.setAttribute('style', select.getAttribute('style'));
    if (selectWidthPx) { wrap.style.width = selectWidthPx; btn.style.width = '100%'; btn.style.boxSizing = 'border-box'; }
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    var btnLabel = document.createElement('span');
    btnLabel.className = 'ss-btn-label';
    btn.appendChild(btnLabel);
    btn.insertAdjacentHTML('beforeend', svgCaret());

    var panel = document.createElement('div');
    panel.className = 'ss-panel';
    panel.setAttribute('role', 'listbox');
    var searchWrap = document.createElement('div');
    searchWrap.className = 'ss-search-wrap';
    searchWrap.insertAdjacentHTML('beforeend', svgSearch());
    var search = document.createElement('input');
    search.type = 'text';
    search.className = 'ss-search';
    search.placeholder = 'Buscar…';
    search.autocomplete = 'off';
    search.spellcheck = false;
    searchWrap.appendChild(search);
    var list = document.createElement('div');
    list.className = 'ss-list';
    panel.appendChild(searchWrap);
    panel.appendChild(list);

    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('ss-native');
    wrap.appendChild(btn);
    // El panel se ancla directo a <body> (no dentro de .ss-wrap): así ningún
    // overflow/transform de un ancestro (tarjetas con hover, tablas con
    // scroll horizontal, hojas de modal…) lo recorta o lo desplaza. Su
    // posición se calcula en cada apertura con las mismas coordenadas de
    // viewport que ya usa el autocomplete de proveedores.
    document.body.appendChild(panel);
    wrap._ssPanel = panel;

    var hiIndex = -1;

    function optionRows() {
      return Array.prototype.slice.call(list.querySelectorAll('.ss-opt'));
    }

    function syncLabel() {
      var opt = select.options[select.selectedIndex];
      if (opt) {
        btnLabel.textContent = opt.textContent.trim() || ' ';
        btnLabel.classList.toggle('ss-placeholder', !opt.value && (opt.textContent || '').trim() !== opt.value);
      } else {
        btnLabel.textContent = '';
      }
      btn.classList.toggle('ss-disabled', !!select.disabled);
      btn.disabled = !!select.disabled;
    }

    var allowCustom = select.dataset.allowCustom === '1';

    function buildList(filterText) {
      list.innerHTML = '';
      var q = norm(filterText || '');
      var items = readItems(select);
      var any = false;
      var exactMatch = false;
      var pendingGroupLbl = null;
      items.forEach(function (it) {
        if (it.group !== undefined) { pendingGroupLbl = it.group; return; }
        var opt = it.opt;
        var text = opt.textContent || '';
        if (q && norm(text).indexOf(q) === -1) return;
        if (q && norm(text) === q) exactMatch = true;
        if (pendingGroupLbl !== null) {
          var g = document.createElement('div');
          g.className = 'ss-group-lbl';
          g.textContent = pendingGroupLbl;
          list.appendChild(g);
          pendingGroupLbl = null;
        }
        any = true;
        var row = document.createElement('div');
        row.className = 'ss-opt' + (opt.disabled ? ' ss-disabled' : '') + (opt.value === select.value && !opt.disabled ? ' ss-selected' : '');
        row.setAttribute('role', 'option');
        row.textContent = text;
        row._opt = opt;
        if (!opt.disabled) {
          row.addEventListener('click', function () { choose(opt); });
        }
        list.appendChild(row);
      });
      var query = (filterText || '').trim();
      if (allowCustom && query && !exactMatch) {
        var addRow = document.createElement('div');
        addRow.className = 'ss-opt ss-add-new';
        addRow.setAttribute('role', 'option');
        addRow.textContent = '+ Usar «' + query + '»';
        addRow._custom = query;
        addRow.addEventListener('click', function () { chooseCustom(query); });
        list.insertBefore(addRow, list.firstChild);
        any = true;
      }
      if (!any) {
        var empty = document.createElement('div');
        empty.className = 'ss-empty';
        empty.textContent = 'Sin resultados';
        list.appendChild(empty);
      }
      hiIndex = -1;
      if (allowCustom && query) setHi(0, true);
      else highlightSelected();
    }

    function chooseCustom(text) {
      var existing = null;
      Array.prototype.forEach.call(select.options, function (o) {
        if (!existing && norm(o.textContent) === norm(text)) existing = o;
      });
      var opt = existing;
      if (!opt) {
        opt = document.createElement('option');
        opt.value = text;
        opt.textContent = text;
        select.appendChild(opt);
      }
      choose(opt);
    }

    function highlightSelected() {
      var rows = optionRows();
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].classList.contains('ss-selected')) { setHi(i, true); return; }
      }
    }

    function setHi(i, skipScroll) {
      var rows = optionRows();
      rows.forEach(function (r) { r.classList.remove('ss-hi'); });
      if (i < 0 || i >= rows.length) { hiIndex = -1; return; }
      hiIndex = i;
      rows[i].classList.add('ss-hi');
      if (!skipScroll) rows[i].scrollIntoView({ block: 'nearest' });
    }

    function choose(opt) {
      var changed = select.value !== opt.value;
      nativeValueSetter.call(select, opt.value);
      syncLabel();
      close();
      if (changed) {
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      btn.focus();
    }

    // Igual que acPlace() en proveedores: getBoundingClientRect() es relativo
    // al layout viewport, pero en móvil (sobre todo iOS Safari) el teclado
    // encoge el visual viewport sin mover el layout viewport — sin compensar
    // ese desfase (offsetLeft/offsetTop de visualViewport) el panel se abre
    // "movido" respecto a su botón.
    function place() {
      var r = btn.getBoundingClientRect();
      var vv = window.visualViewport;
      var offX = (vv && vv.offsetLeft) || 0;
      var offY = (vv && vv.offsetTop) || 0;
      var vw = (vv && vv.width) || window.innerWidth;
      var vh = (vv && vv.height) || window.innerHeight;
      var w = Math.min(Math.max(r.width, 200), vw - 16);
      var left = Math.max(8, Math.min(r.left - offX, vw - w - 8));
      var btnTop = r.top - offY, btnBottom = r.bottom - offY;
      // Con el teclado abierto vh se encoge mucho: si el panel (con su alto
      // deseado) no cabía ni abajo ni arriba del botón, este cálculo caía en
      // un tercer caso que solo dependía de vh — así que CUALQUIER combo
      // abierto terminaba en el mismo punto de la pantalla en vez de junto a
      // su propio botón. Ahora el alto se ajusta al espacio real disponible
      // del lado que más tenga (abajo o arriba de ESE botón), siempre
      // anclado a él así el teclado deje poco aire.
      var desired = panel.offsetHeight || 300, margin = 8, gap = 4;
      var spaceBelow = vh - btnBottom - margin - gap;
      var spaceAbove = btnTop - margin - gap;
      var top, H, dropUp;
      if (spaceBelow >= 90 && spaceBelow >= spaceAbove) {
        H = Math.min(desired, spaceBelow);
        top = btnBottom + gap;
        dropUp = false;
      } else {
        H = Math.min(desired, Math.max(90, spaceAbove));
        top = Math.max(margin, btnTop - H - gap);
        dropUp = true;
      }
      panel.style.maxHeight = H + 'px';
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
      panel.style.width = w + 'px';
      panel.classList.toggle('ss-drop-up', dropUp);
    }
    function onReposition() { if (wrap.classList.contains('ss-open')) place(); }
    // Este combo autoenfoca su buscador al abrir, así que en móvil el
    // teclado se abre casi siempre — y el visual viewport va disparando
    // 'resize'/'scroll' en varios pasos mientras anima esa apertura.
    // Reposicionar en cada paso (sin esperar a que se asiente) se ve como
    // el panel "brincando"; se espera un respiro breve antes de recalcular
    // para que solo se mueva una vez, ya con el teclado asentado.
    var vvTimer = null;
    function onRepositionVv() {
      clearTimeout(vvTimer);
      vvTimer = setTimeout(onReposition, 80);
    }

    function open() {
      if (select.disabled) return;
      document.querySelectorAll('.ss-wrap.ss-open').forEach(function (w) { if (w !== wrap) w.classList.remove('ss-open'); });
      document.querySelectorAll('.ss-panel.ss-panel-open').forEach(function (p) { if (p !== panel) p.classList.remove('ss-panel-open'); });
      wrap.classList.add('ss-open');
      btn.setAttribute('aria-expanded', 'true');
      search.value = '';
      buildList('');
      place();
      panel.classList.add('ss-panel-open');
      window.addEventListener('scroll', onReposition, true);
      window.addEventListener('resize', onReposition);
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', onRepositionVv);
        window.visualViewport.addEventListener('scroll', onRepositionVv);
      }
      setTimeout(function () { place(); search.focus(); }, 0);
    }
    function close() {
      wrap.classList.remove('ss-open');
      panel.classList.remove('ss-panel-open', 'ss-drop-up');
      btn.setAttribute('aria-expanded', 'false');
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', onRepositionVv);
        window.visualViewport.removeEventListener('scroll', onRepositionVv);
      }
    }
    function toggle() { wrap.classList.contains('ss-open') ? close() : open(); }

    btn.addEventListener('click', toggle);
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    search.addEventListener('input', function () { buildList(search.value); });
    search.addEventListener('keydown', function (e) {
      var rows;
      if (e.key === 'ArrowDown') { e.preventDefault(); rows = optionRows(); setHi(Math.min(rows.length - 1, hiIndex + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); rows = optionRows(); setHi(Math.max(0, hiIndex - 1)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        rows = optionRows();
        var row = rows[hiIndex] || rows[0];
        if (row && row._opt) choose(row._opt);
        else if (row && row._custom) chooseCustom(row._custom);
      } else if (e.key === 'Escape') { e.preventDefault(); close(); btn.focus(); }
      else if (e.key === 'Tab') { close(); }
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target) && !panel.contains(e.target)) close();
    });

    // Intercepta cambios de .value / .selectedIndex hechos por otro código
    // (p.ej. al precargar un formulario de edición) para que la etiqueta
    // visible nunca se desincronice del <select> real.
    var nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    var nativeIndexSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex').set;
    Object.defineProperty(select, 'value', {
      configurable: true,
      get: function () { return Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').get.call(select); },
      set: function (v) { nativeValueSetter.call(select, v); syncLabel(); }
    });
    Object.defineProperty(select, 'selectedIndex', {
      configurable: true,
      get: function () { return Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex').get.call(select); },
      set: function (v) { nativeIndexSetter.call(select, v); syncLabel(); }
    });
    select.addEventListener('change', syncLabel);

    // Si el propio <select> recibe opciones nuevas dinámicamente (categorías,
    // atributos, etc.), se reconstruye la lista y la etiqueta.
    var mo = new MutationObserver(function () { syncLabel(); if (wrap.classList.contains('ss-open')) buildList(search.value); });
    mo.observe(select, { childList: true, subtree: true, characterData: true });

    syncLabel();
  }

  function enhanceAll(root) {
    (root || document).querySelectorAll('select').forEach(enhance);
  }

  function init() {
    injectStyle();
    enhanceAll(document);
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes && m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.tagName === 'SELECT') enhance(node);
          else if (node.querySelectorAll) enhanceAll(node);
        });
        // Vistas tipo SPA (panel-ajax.ejs) reemplazan el innerHTML de <main>
        // completo: el .ss-wrap muere con ese HTML, pero su panel vive
        // aparte en <body> y se quedaría huérfano (fugas + paneles fantasma)
        // si no se limpia aquí también.
        m.removedNodes && m.removedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          var wraps = [];
          if (node.classList && node.classList.contains('ss-wrap')) wraps.push(node);
          if (node.querySelectorAll) wraps = wraps.concat(Array.prototype.slice.call(node.querySelectorAll('.ss-wrap')));
          wraps.forEach(function (w) { if (w._ssPanel && w._ssPanel.parentNode) w._ssPanel.parentNode.removeChild(w._ssPanel); });
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
