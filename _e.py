def rd(p): return open(p, encoding='utf8', newline='').read()
def wr(p, s): open(p, 'w', encoding='utf8', newline='').write(s)
def rep(s, old, new, count=1):
    if old not in s:
        old = old.replace('\n', '\r\n'); new = new.replace('\n', '\r\n')
    assert old in s, old[:90]
    return s.replace(old, new, count)

s = rd('views/productos.ejs')
old = "        var faltanStock = [], faltanPrecio = [];"
new = """        var sinValores = ed.model.attrs.filter(function (a) { return !(a.values && a.values.length); });
        if (sinValores.length) {
          e.preventDefault();
          e.stopPropagation();
          if (window.mostrarToast) window.mostrarToast('⚠ El atributo "' + (sinValores[0].name || 'sin nombre') + '" no tiene valores. Agrega al menos uno (escribe y pulsa +) o quítalo.', 'error');
          goStep(3);
          return;
        }
        var faltanStock = [], faltanPrecio = [];"""
s = rep(s, old, new)
wr('views/productos.ejs', s)

s = rd('server.js')
old = """  } else {
    if (req.body.price === '' || req.body.price === undefined || req.body.price === null || isNaN(parseFloat(req.body.price))) {
      return renderError('El precio es obligatorio (usa un número, ej: 25.50).');"""
new = """  } else {
    if (req.body.tipo === 'variantes') {
      return renderError('Elegiste "Con variantes" pero no hay ningún atributo con valores. En el paso Variantes agrega un atributo y al menos un valor (escribe y pulsa +), o cambia a "Producto único".');
    }
    if (req.body.price === '' || req.body.price === undefined || req.body.price === null || isNaN(parseFloat(req.body.price))) {
      return renderError('El precio es obligatorio (usa un número, ej: 25.50).');"""
n = s.count(old.replace('\n', '\r\n')) + s.count(old)
assert n == 2, n
if old in s: s = s.replace(old, new)
else: s = s.replace(old.replace('\n', '\r\n'), new.replace('\n', '\r\n'))
wr('server.js', s)
print('ok')
