(function () {
  'use strict';
  // Máscaras de teléfono y dinero. Delegado en el documento (como
  // searchable-select.js/img-retry.js) para que funcione con campos que
  // ya existen Y con los que aparecen después (SPA-lite, filas de
  // variantes/compra generadas por JS) sin tener que enganchar cada uno.

  function caretDigitsBefore(str, pos) {
    var n = 0;
    for (var i = 0; i < pos && i < str.length; i++) if (/\d/.test(str[i])) n++;
    return n;
  }
  function posAfterNDigits(str, n) {
    if (n <= 0) return 0;
    var seen = 0;
    for (var i = 0; i < str.length; i++) {
      if (/\d/.test(str[i])) { seen++; if (seen === n) return i + 1; }
    }
    return str.length;
  }

  // "8719998877" -> "871 999 8877"
  function formatPhone(raw) {
    var d = raw.replace(/\D/g, '').slice(0, 10);
    var p1 = d.slice(0, 3), p2 = d.slice(3, 6), p3 = d.slice(6, 10);
    return [p1, p2, p3].filter(Boolean).join(' ');
  }
  function maskPhoneInput(el) {
    var before = el.value;
    var caret = el.selectionStart == null ? before.length : el.selectionStart;
    var digitsBefore = caretDigitsBefore(before, caret);
    var after = formatPhone(before);
    if (after === before) return;
    el.value = after;
    var newPos = posAfterNDigits(after, digitsBefore);
    try { el.setSelectionRange(newPos, newPos); } catch (e) {}
  }

  // "12345.6" -> "12,345.6" (separador de miles en vivo; hasta 2 decimales)
  function formatMoney(raw) {
    var s = raw.replace(/[^\d.]/g, '');
    var firstDot = s.indexOf('.');
    if (firstDot !== -1) s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    var parts = s.split('.');
    var intPart = parts[0].replace(/^0+(?=\d)/, '');
    var decPart = parts.length > 1 ? parts[1].slice(0, 2) : null;
    var withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decPart !== null ? withCommas + '.' + decPart : (raw.indexOf('.') !== -1 && parts.length === 1 ? withCommas : withCommas);
  }
  function maskMoneyInput(el) {
    var before = el.value;
    var caret = el.selectionStart == null ? before.length : el.selectionStart;
    var digitsBefore = caretDigitsBefore(before, caret);
    var after = formatMoney(before);
    if (after === before) return;
    el.value = after;
    var newPos = posAfterNDigits(after, digitsBefore);
    try { el.setSelectionRange(newPos, newPos); } catch (e) {}
  }

  // El servidor/los cálculos en JS esperan un número limpio: "1,234.56" no
  // sirve para parseFloat/Number tal cual. Cualquier campo enmascarado debe
  // pasar por aquí antes de guardarse, sumarse o enviarse.
  window.unmaskMoney = function (v) { return String(v == null ? '' : v).replace(/,/g, ''); };
  window.unmaskPhone = function (v) { return String(v == null ? '' : v).replace(/\D/g, ''); };

  function onInput(e) {
    var el = e.target;
    if (!el || !el.matches) return;
    if (el.matches('[data-mask="phone"]')) maskPhoneInput(el);
    else if (el.matches('[data-mask="money"]')) maskMoneyInput(el);
  }
  document.addEventListener('input', onInput, true);

  // Un valor precargado por el servidor (editar un cliente/producto ya
  // guardado) llega "limpio" (sin espacios ni comas) porque el HTML lo
  // escribe tal cual — se formatea aquí una vez para que se vea igual que
  // mientras se escribe, y para que el pattern (que exige el formato
  // enmascarado) no rechace el valor si el campo no se vuelve a tocar.
  function maskAll(root) {
    (root || document).querySelectorAll('[data-mask="phone"]').forEach(function (el) { if (el.value) maskPhoneInput(el); });
    (root || document).querySelectorAll('[data-mask="money"]').forEach(function (el) { if (el.value) maskMoneyInput(el); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { maskAll(); });
  else maskAll();
  // Vistas SPA-lite (panel-ajax.ejs) y formularios que llenan campos por JS
  // después de cargar (p.ej. al abrir "Editar") pueden dejar valores sin
  // formatear — se vuelve a pasar cuando cambia el DOM o el valor se setea
  // por script en vez de por tecleo.
  window.applyMasks = maskAll;

  // Al enviar cualquier <form>, los campos enmascarados van limpios (sin
  // comas/espacios) para que el servidor reciba un número/teléfono normal.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    form.querySelectorAll('[data-mask="money"]').forEach(function (el) { el.value = window.unmaskMoney(el.value); });
    form.querySelectorAll('[data-mask="phone"]').forEach(function (el) { el.value = window.unmaskPhone(el.value); });
  }, true);
})();
