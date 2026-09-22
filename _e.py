import re
def rd(p): return open(p, encoding='utf8', newline='').read()
def wr(p, s): open(p, 'w', encoding='utf8', newline='').write(s)
NLC = chr(10)

# ---------------- db.js ----------------
d = rd('db.js')
anchor = "CREATE TABLE IF NOT EXISTS categories (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  business_id INTEGER NOT NULL,\n  name TEXT NOT NULL,\n  sort INTEGER DEFAULT 0,\n  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE\n);"
new_tbl = """CREATE TABLE IF NOT EXISTS category_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort INTEGER DEFAULT 0,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort INTEGER DEFAULT 0,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);"""
assert anchor in d
d = d.replace(anchor, new_tbl, 1)
a = "addColumnIfMissing('businesses', 'mp_public_key'"
i = d.index(a); j = d.index('\n', i) + 1
d = d[:j] + "addColumnIfMissing('categories', 'group_id', 'INTEGER NULL'); // agrupador de categorías (category_groups.id) — opcional\n" + d[j:]
wr('db.js', d)

# ---------------- server.js ----------------
s = rd('server.js')
crlf = '\r\n' in s
def R(old, new, count=1):
    global s
    o = old.replace('\n', '\r\n' if crlf else '\n'); n = new.replace('\n', '\r\n' if crlf else '\n')
    assert o in s, old[:100]
    s = s.replace(o, n, count)

# getCatalog: LEFT JOIN category_groups para el nombre del agrupador
R("""  const categories = db.prepare(
    'SELECT * FROM categories WHERE business_id = ? ORDER BY sort ASC'
  ).all(businessId);""", """  const categories = db.prepare(
    `SELECT c.*, g.name AS group_name FROM categories c LEFT JOIN category_groups g ON g.id = c.group_id
     WHERE c.business_id = ? ORDER BY c.sort ASC`
  ).all(businessId);""")

# panelData: igual, para que Productos vea el agrupador de cada categoría, y lista de agrupadores
R("""function panelData(biz) {
  const categories = db.prepare('SELECT * FROM categories WHERE business_id = ? ORDER BY sort ASC').all(biz.id);""", """function panelData(biz) {
  const categories = db.prepare(
    `SELECT c.*, g.name AS group_name FROM categories c LEFT JOIN category_groups g ON g.id = c.group_id
     WHERE c.business_id = ? ORDER BY c.sort ASC`
  ).all(biz.id);
  const categoryGroups = db.prepare('SELECT * FROM category_groups WHERE business_id = ? ORDER BY sort ASC, name COLLATE NOCASE ASC').all(biz.id);""")
R("attributeTemplates: getAttributeTemplates(biz.id), lowSt", "categoryGroups, attributeTemplates: getAttributeTemplates(biz.id), lowSt")

# rutas de agrupadores + asignar categoría a uno (junto a las rutas de categoría)
routes = '''app.post('/:slug/admin/categoria-grupo', requireAuth, can('categorias.gestionar'), (req, res) => {
  const name = (req.body.name || '').trim().slice(0, 60);
  if (!name) return res.json({ ok: false, error: 'El nombre del agrupador es obligatorio.' });
  const dup = db.prepare('SELECT * FROM category_groups WHERE business_id = ? AND name = ? COLLATE NOCASE').get(req.biz.id, name);
  if (dup) return res.json({ ok: false, error: 'Ese agrupador ya existe.' });
  const r = db.prepare('INSERT INTO category_groups (business_id, name) VALUES (?, ?)').run(req.biz.id, name);
  res.json({ ok: true, id: r.lastInsertRowid, name });
});
app.post('/:slug/admin/categoria-grupo/:id', requireAuth, can('categorias.gestionar'), (req, res) => {
  const id = parseInt(req.params.id);
  const name = (req.body.name || '').trim().slice(0, 60);
  if (!name) return res.json({ ok: false, error: 'El nombre del agrupador es obligatorio.' });
  const dup = db.prepare('SELECT * FROM category_groups WHERE business_id = ? AND name = ? COLLATE NOCASE AND id != ?').get(req.biz.id, name, id);
  if (dup) return res.json({ ok: false, error: 'Ese agrupador ya existe.' });
  const r = db.prepare('UPDATE category_groups SET name = ? WHERE id = ? AND business_id = ?').run(name, id, req.biz.id);
  res.json({ ok: r.changes > 0, id, name });
});
app.post('/:slug/admin/categoria-grupo/:id/eliminar', requireAuth, can('categorias.gestionar'), (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare('UPDATE categories SET group_id = NULL WHERE group_id = ? AND business_id = ?').run(id, req.biz.id);
  db.prepare('DELETE FROM category_groups WHERE id = ? AND business_id = ?').run(id, req.biz.id);
  res.json({ ok: true });
});
// Mete o saca una categoría de un agrupador (las categorías siguen siendo la unidad real; el agrupador solo las junta al mostrarlas)
app.post('/:slug/admin/categoria/:id/grupo', requireAuth, can('categorias.gestionar'), (req, res) => {
  const id = parseInt(req.params.id);
  const raw = String(req.body.group_id || '').trim();
  let groupId = null;
  if (raw) {
    const g = db.prepare('SELECT id FROM category_groups WHERE id = ? AND business_id = ?').get(parseInt(raw), req.biz.id);
    if (!g) return res.json({ ok: false, error: 'Ese agrupador no existe.' });
    groupId = g.id;
  }
  const r = db.prepare('UPDATE categories SET group_id = ? WHERE id = ? AND business_id = ?').run(groupId, id, req.biz.id);
  res.json({ ok: r.changes > 0, id, group_id: groupId });
});
'''
anchor2 = "app.post('/:slug/admin/categoria/:id', requireAuth, can('categorias.gestionar'), (req, res) => {"
i = s.index(anchor2)
j = s.index("});", i) + len("});") + 1
s = s[:j] + (routes.replace('\n', '\r\n' if crlf else '\n')) + s[j:]
wr('server.js', s)
print('server ok')
