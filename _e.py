def rd(p): return open(p, encoding='utf8', newline='').read()
def wr(p, s): open(p, 'w', encoding='utf8', newline='').write(s)

# ---------------- 1) quitar límites de texto en Modelos ----------------
c = rd('views/config.ejs')
c = c.replace('id="ex-mod-title" class="config-input" maxlength="80"', 'id="ex-mod-title" class="config-input" maxlength="300"', 1)
c = c.replace('id="ex-mod-text" class="config-input" maxlength="400"', 'id="ex-mod-text" class="config-input" maxlength="1000"', 1)
c = c.replace('maxlength="60" class="config-input modelo-cap"', 'maxlength="200" class="config-input modelo-cap"', 1)
wr('views/config.ejs', c)

s = rd('server.js')
crlf = '\r\n' in s
def R(old, new, count=1):
    global s
    o = old.replace('\n', '\r\n' if crlf else '\n'); n = new.replace('\n', '\r\n' if crlf else '\n')
    assert o in s, old[:90]
    s = s.replace(o, n, count)
R("      title: str(x.modelos && x.modelos.title, 80),\n      text: str(x.modelos && x.modelos.text, 400),\n      images: (Array.isArray(x.modelos && x.modelos.images) ? x.modelos.images : []).slice(0, 12)\n        .map(i => ({ src: safeImgUrl(i && i.src), cap: str(i && i.cap, 60) })).filter(i => i.src)",
  "      title: str(x.modelos && x.modelos.title, 300),\n      text: str(x.modelos && x.modelos.text, 1000),\n      images: (Array.isArray(x.modelos && x.modelos.images) ? x.modelos.images : []).slice(0, 12)\n        .map(i => ({ src: safeImgUrl(i && i.src), cap: str(i && i.cap, 200) })).filter(i => i.src)")
wr('server.js', s)

# ---------------- 2) transferencia en modal grande ----------------
cj = rd('views/partials/cart-js.ejs')
crlf2 = '\r\n' in cj
def RC(old, new, count=1):
    global cj
    o = old.replace('\n', '\r\n' if crlf2 else '\n'); n = new.replace('\n', '\r\n' if crlf2 else '\n')
    assert o in cj, old[:90]
    cj = cj.replace(o, n, count)

old_block = """          ${(TRANSFER && g.store.slug === SLUG) ? `
          <div style="margin:0 12px 10px;padding:10px 12px;background:#f0fdf4;border:1px dashed #86efac;border-radius:12px;">
            <div style="font-size:12px;font-weight:800;color:#166534;margin-bottom:4px;">💵 Transferencia bancaria</div>
            ${TRANSFER.bank ? `<div style="font-size:12px;color:#166534;">${esc(TRANSFER.bank)}</div>` : ''}
            ${TRANSFER.account ? `<div style="display:flex;align-items:center;gap:6px;margin-top:2px;"><span style="font-size:13px;font-weight:700;color:#14532d;letter-spacing:.02em;">${esc(TRANSFER.account)}</span><button type="button" onclick="copiarCuentaTransferencia(this,${jattr(TRANSFER.account)})" aria-label="Copiar cuenta" style="border:none;background:#dcfce7;color:#166534;border-radius:7px;padding:2px 7px;font-size:10px;font-weight:800;cursor:pointer;">Copiar</button></div>` : ''}
            ${TRANSFER.holder ? `<div style="font-size:11px;color:#4d7c5f;margin-top:2px;">A nombre de ${esc(TRANSFER.holder)}</div>` : ''}
            <div style="font-size:11px;color:#4d7c5f;margin-top:6px;">Haz tu transferencia por el total y pulsa el botón de abajo para mandar tu comprobante por WhatsApp.</div>
          </div>` : ''}
          <div style="padding:10px 12px;display:flex;flex-direction:column;gap:8px;">
            ${(IS_ADMIN && g.store.slug === SLUG) ? `<button type="button" onclick="payCashAdmin(${jattr(g.store.slug)})" style="width:100%;background:#15803d;color:#fff;border:none;border-radius:12px;padding:11px;font-weight:700;font-size:14px;cursor:pointer;">💵 Registrar en efectivo · ${money(cashTotalOf(g))} <small style="font-weight:600;opacity:.85">(sin comisión)</small></button>` : ''}
            ${(MP_CARD && g.store.slug === SLUG) ? `<button type="button" onclick="payCardInApp(${jattr(g.store.slug)})" style="width:100%;background:#009ee3;color:#fff;border:none;border-radius:12px;padding:11px;font-weight:700;font-size:14px;cursor:pointer;">💳 Pagar con tarjeta</button>` : ''}
            ${(TRANSFER && g.store.slug === SLUG) ? `<button type="button" onclick="sendStoreOrder(${jattr(g.store.slug)}, false, 'transferencia')" style="width:100%;background:#166534;color:#fff;border:none;border-radius:12px;padding:11px;font-weight:700;font-size:14px;cursor:pointer;">🏦 Ya transferí · enviar comprobante</button>` : ''}
            ${(g.store.slug === SLUG && (MP_CARD || TRANSFER || IS_ADMIN)) ? '' : `<p style="margin:0;padding:10px 12px;border-radius:12px;background:#fef3c7;color:#92400e;font-size:12.5px;font-weight:600;text-align:center;">${g.store.slug === SLUG ? 'Esta tienda aún no tiene formas de pago activadas.' : 'Abre esta tienda para pagar tu pedido.'}</p>${g.store.slug === SLUG ? '' : `<a href="/${esc(g.store.slug)}" style="display:block;text-align:center;background:#1e293b;color:#fff;border-radius:12px;padding:11px;font-weight:700;font-size:14px;text-decoration:none;">Ir a la tienda</a>`}`}
          </div>"""

new_block = """          <div style="padding:10px 12px;display:flex;flex-direction:column;gap:8px;">
            ${(IS_ADMIN && g.store.slug === SLUG) ? `<button type="button" onclick="payCashAdmin(${jattr(g.store.slug)})" style="width:100%;background:#15803d;color:#fff;border:none;border-radius:12px;padding:11px;font-weight:700;font-size:14px;cursor:pointer;">💵 Registrar en efectivo · ${money(cashTotalOf(g))} <small style="font-weight:600;opacity:.85">(sin comisión)</small></button>` : ''}
            ${(MP_CARD && g.store.slug === SLUG) ? `<button type="button" onclick="payCardInApp(${jattr(g.store.slug)})" style="width:100%;background:#009ee3;color:#fff;border:none;border-radius:12px;padding:11px;font-weight:700;font-size:14px;cursor:pointer;">💳 Pagar con tarjeta</button>` : ''}
            ${(TRANSFER && g.store.slug === SLUG) ? `<button type="button" onclick="payTransfer(${jattr(g.store.slug)})" style="width:100%;background:#166534;color:#fff;border:none;border-radius:12px;padding:11px;font-weight:700;font-size:14px;cursor:pointer;">🏦 Comprar por transferencia</button>` : ''}
            ${(g.store.slug === SLUG && (MP_CARD || TRANSFER || IS_ADMIN)) ? '' : `<p style="margin:0;padding:10px 12px;border-radius:12px;background:#fef3c7;color:#92400e;font-size:12.5px;font-weight:600;text-align:center;">${g.store.slug === SLUG ? 'Esta tienda aún no tiene formas de pago activadas.' : 'Abre esta tienda para pagar tu pedido.'}</p>${g.store.slug === SLUG ? '' : `<a href="/${esc(g.store.slug)}" style="display:block;text-align:center;background:#1e293b;color:#fff;border-radius:12px;padding:11px;font-weight:700;font-size:14px;text-decoration:none;">Ir a la tienda</a>`}`}
          </div>"""
RC(old_block, new_block)

# nueva función payTransfer: modal grande con los datos, Aceptar -> WhatsApp
fn = r'''  // Modal grande con los datos para transferir — el recuadro chico dentro del carrito no se leía bien
  function payTransfer(slug) {
    if (!validarDatosCliente()) return;
    const g = storeGroups().find(x => x.store.slug === slug);
    if (!g || !TRANSFER) return;
    const total = g.items.reduce((s, it) => s + it.qty * it.price, 0);
    toggleChat(false);
    const ov = document.createElement('div');
    ov.id = 'transfer-overlay';
    ov.className = 'cp-overlay';
    ov.innerHTML =
      '<div class="cp-panel" role="dialog" aria-modal="true" aria-label="Transferencia bancaria">' +
        '<div class="cp-head"><div><b>🏦 Transferencia bancaria</b><span>' + esc(g.store.name) + ' · Total ' + money(total) + '</span></div><button type="button" class="tr-x" aria-label="Cerrar">✕</button></div>' +
        '<div class="tr-card">' +
          (TRANSFER.bank ? '<div class="tr-row"><span class="tr-lbl">Banco</span><span class="tr-val">' + esc(TRANSFER.bank) + '</span></div>' : '') +
          (TRANSFER.account ? '<div class="tr-row"><span class="tr-lbl">Cuenta / CLABE</span><span class="tr-val tr-acc">' + esc(TRANSFER.account) + '</span></div>' : '') +
          (TRANSFER.holder ? '<div class="tr-row"><span class="tr-lbl">A nombre de</span><span class="tr-val">' + esc(TRANSFER.holder) + '</span></div>' : '') +
          '<div class="tr-row tr-total"><span class="tr-lbl">Total a transferir</span><span class="tr-val">' + money(total) + '</span></div>' +
          (TRANSFER.account ? '<button type="button" class="tr-copy">Copiar cuenta</button>' : '') +
        '</div>' +
        '<p class="tr-note">Haz tu transferencia por el total exacto. Al aceptar, se abre WhatsApp para que nos mandes tu comprobante y confirmemos tu pedido.</p>' +
        '<button type="button" class="tr-ok">Ya transferí, continuar por WhatsApp</button>' +
      '</div>';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { requestAnimationFrame(function () { ov.classList.add('cp-in'); }); });
    const close = function () { ov.classList.remove('cp-in'); setTimeout(function () { ov.remove(); document.body.style.overflow = ''; }, 250); };
    ov.querySelector('.tr-x').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    if (TRANSFER.account) ov.querySelector('.tr-copy').addEventListener('click', function (e) { copiarCuentaTransferencia(e.currentTarget, TRANSFER.account); });
    ov.querySelector('.tr-ok').addEventListener('click', function () { close(); sendStoreOrder(slug, false, 'transferencia'); });
  }
'''
RC("  function payCardInApp(slug) {", fn + "  function payCardInApp(slug) {")

# estilos del modal de transferencia (junto a los del pago con tarjeta)
css = r'''  .tr-x { min-width:44px; min-height:44px; border:0; border-radius:12px; background:none; color:var(--text-secondary, #64748b); font-size:16px; cursor:pointer; }
  .tr-x:hover { background:color-mix(in srgb, var(--text, #0f172a) 6%, transparent); }
  .tr-card { border:1px solid color-mix(in srgb, var(--text, #0f172a) 14%, transparent); border-radius:14px; padding:6px 16px; margin-top:4px; }
  .tr-row { display:flex; justify-content:space-between; align-items:baseline; gap:10px; padding:12px 0; border-bottom:1px solid color-mix(in srgb, var(--text, #0f172a) 10%, transparent); }
  .tr-row:last-of-type { border-bottom:0; }
  .tr-lbl { font-size:12px; color:var(--text-secondary, #64748b); font-weight:700; text-transform:uppercase; letter-spacing:.04em; flex:none; }
  .tr-val { font-size:16px; font-weight:800; text-align:right; overflow-wrap:anywhere; }
  .tr-acc { font-size:19px; letter-spacing:.03em; }
  .tr-total .tr-val { color:var(--accent, #166534); font-size:20px; }
  .tr-copy { width:100%; margin:4px 0 14px; min-height:42px; border-radius:10px; border:1px solid color-mix(in srgb, var(--text, #0f172a) 18%, transparent); background:none; color:inherit; font-weight:800; font-size:13px; cursor:pointer; }
  .tr-note { margin:14px 2px 14px; font-size:12.5px; color:var(--text-secondary, #64748b); line-height:1.45; }
  .tr-ok { width:100%; min-height:50px; border:0; border-radius:min(var(--radius, 16px), 14px); background:#166534; color:#fff; font-weight:800; font-size:15px; cursor:pointer; }
'''
RC("  .cp-load {", css + "  .cp-load {")
wr('views/partials/cart-js.ejs', cj)
print('ok')
