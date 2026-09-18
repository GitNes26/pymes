'use strict';
// db-maria-sync.js — Capa de datos síncrona sobre MySQL/MariaDB (driver mysql2).
// El nombre conserva el origen (la migración inicial fue SQLite -> MariaDB); hoy
// la app corre contra MySQL 8 con este mismo adaptador, que es motor-agnóstico.
//
// Sustituye a better-sqlite3 manteniendo la MISMA API que usa la app
// (db.prepare(sql).get/all/run, db.exec, db.pragma) para que server.js y db.js
// no tengan que reescribirse a async/await. El hilo principal se bloquea
// (Atomics.wait) mientras un worker ejecuta la consulta de forma asíncrona.
//
// Configuración vía variables de entorno (mismas que tools/migrate-maria.js):
//   DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
const { Worker, receiveMessageOnPort, MessageChannel } = require('worker_threads');
const path = require('path');

const CFG = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
  user: process.env.DB_USER || process.env.MYSQLUSER || 'catamanager',
  password: process.env.DB_PASS || process.env.MYSQLPASSWORD || 'catamanager_local_2026',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'catamanager',
};

let worker = null;
let port = null;   // extremo principal del MessageChannel de respuestas
let ready = false;
let dead = false;
let lastError = '';
let seq = 0;
const WAKE = new Int32Array(new SharedArrayBuffer(4));

// ---------------------------------------------------------------------------
// Traducción SQLite -> MariaDB del dialecto que usa la app (runtime + DDL).
// ---------------------------------------------------------------------------
function translate(sql) {
  let s = String(sql);
  s = s.replace(/\bINSERT\s+OR\s+REPLACE\s+INTO\b/gi, 'REPLACE INTO');
  s = s.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT IGNORE INTO');
  s = s.replace(/\bAUTOINCREMENT\b/gi, 'AUTO_INCREMENT');
  s = s.replace(/\bRANDOM\s*\(\)/gi, 'RAND()');
  s = s.replace(/\bdatetime\s*\(\s*'now'\s*,\s*'-?(\d+)\s+days'\s*\)/gi, 'DATE_SUB(UTC_TIMESTAMP(), INTERVAL $1 DAY)');
  s = s.replace(/\bdatetime\s*\(\s*'now'\s*\)/gi, 'UTC_TIMESTAMP()');
  s = s.replace(/\bdate\s*\(\s*'now'\s*\)/gi, 'DATE(UTC_TIMESTAMP())');
  s = s.replace(/\s+COLLATE\s+NOCASE\b/gi, '');
  // MySQL 8 rechaza `TEXT DEFAULT 'literal'` (MariaDB lo tolera). La forma
  // `TEXT DEFAULT ('literal')` (expresión entre paréntesis) es válida en MySQL
  // 8.0.13+ y en MariaDB, así que se envuelven los defaults de columnas largas
  // que no estén ya entre paréntesis (p.ej. DEFAULT (UTC_TIMESTAMP())).
  s = s.replace(
    /(\b(?:TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT|TINYBLOB|BLOB|MEDIUMBLOB|LONGBLOB)\b\s+DEFAULT\s+)((?:'(?:[^']|'')*'|"[^"]*")|[A-Za-z_][\w]*(?:\([^)]*\))?)(?=\s*[,)]|$)/gi,
    '$1($2)'
  );
  // Columna reservada `key` (tablas plans y site_config)
  s = s.replace(/\bSELECT\s+key\b/gi, 'SELECT `key`');
  s = s.replace(/\bWHERE\s+key\s*=/gi, 'WHERE `key` =');
  s = s.replace(/\bWHERE\s+key\s+IN\b/gi, 'WHERE `key` IN');
  s = s.replace(/\(\s*key(?=\s*[,)])/gi, '(`key`');
  return s;
}

// Separa sentencias por ';' respetando comillas y comentarios SQL.
function splitSql(sql) {
  const out = [];
  let cur = '';
  let sq = false, dq = false, bt = false, line = false, block = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const nx = sql[i + 1];
    if (line) { if (ch === '\n') line = false; continue; }
    if (block) { if (ch === '*' && nx === '/') { block = false; i++; } continue; }
    if (!sq && !dq && !bt) {
      if (ch === '-' && nx === '-') { line = true; i++; continue; }
      if (ch === '/' && nx === '*') { block = true; i++; continue; }
    }
    if (sq) { if (ch === "'") { if (nx === "'") { cur += ch; i++; } else sq = false; } }
    else if (dq) { if (ch === '"') dq = false; }
    else if (bt) { if (ch === '`') bt = false; }
    else if (ch === "'") sq = true;
    else if (ch === '"') dq = true;
    else if (ch === '`') bt = true;
    if (ch === ';' && !sq && !dq && !bt && !line && !block) {
      const t = cur.trim();
      if (t) out.push(t);
      cur = '';
      continue;
    }
    cur += ch;
  }
  const t = cur.trim();
  if (t) out.push(t);
  return out;
}

// ---------------------------------------------------------------------------
// Comunicación síncrona con el worker.
// ---------------------------------------------------------------------------
function ensureWorker() {
  if (worker) return;
  const channel = new MessageChannel();
  port = channel.port1;
  port.unref();
  worker = new Worker(path.join(__dirname, 'db-maria-worker.js'), {
    workerData: { cfg: CFG, wake: WAKE, port: channel.port2 },
    transferList: [channel.port2],
  });
  worker.unref();
  // Se deja rastro en los logs: antes un worker caído solo se veía como un 500
  // genérico en todas las páginas sin decir por qué.
  worker.on('error', (e) => { dead = true; lastError = (e && e.message) || 'worker error'; console.error('[db] error del worker de MySQL:', (e && e.stack) || e); });
  worker.on('exit', (code) => { dead = true; console.error('[db] el worker de MySQL terminó (código ' + code + ')'); });

  // Espera el mensaje 'ready' del worker (conexión probada).
  const deadline = Date.now() + 15000;
  while (!ready) {
    if (dead) throw new Error('db-maria: el worker de MariaDB falló. ' + lastError);
    if (Date.now() > deadline) throw new Error('db-maria: sin respuesta de MariaDB al arrancar. ¿Está el servicio encendido?');
    const m = receiveMessageOnPort(port);
    if (m && m.message && m.message.id === 'ready') {
      if (!m.message.ok) throw new Error('db-maria: no se pudo conectar a MariaDB → ' + m.message.error);
      ready = true;
    }
    Atomics.wait(WAKE, 0, 0, 20);
  }
}

// Si el worker murió (conexión perdida, reinicio de MySQL, error no capturado…)
// antes se quedaba muerto hasta reiniciar el contenedor y TODAS las páginas
// daban 500. Ahora se vuelve a levantar, pero como reconectar bloquea el hilo
// principal (Atomics.wait), se limita a un intento cada 20 s: con MySQL caído
// el servidor sigue respondiendo rápido con error en vez de congelarse.
let lastRespawn = 0;
function respawnIfDead() {
  if (!dead || Date.now() - lastRespawn < 20000) return;
  lastRespawn = Date.now();
  console.error('[db] reintentando conexión con MySQL…');
  try { if (worker) worker.terminate(); } catch (e) {}
  worker = null; port = null; ready = false; dead = false; lastError = '';
}

function call(op, payload) {
  respawnIfDead();
  ensureWorker();
  const id = ++seq;
  const deadline = Date.now() + 30000;
  worker.postMessage({ id, op, ...payload });
  for (;;) {
    if (dead) throw new Error('db-maria: el worker de MariaDB se detuvo. ' + lastError);
    if (Date.now() > deadline) throw new Error('db-maria: tiempo de espera agotado en la consulta');
    const m = receiveMessageOnPort(port);
    if (m && m.message && m.message.id === id) {
      const r = m.message;
      if (!r.ok) throw new Error('db-maria: ' + (r.error || 'error desconocido'));
      return r;
    }
    Atomics.wait(WAKE, 0, 0, 10);
  }
}

// ---------------------------------------------------------------------------
// API pública (igual que better-sqlite3).
// ---------------------------------------------------------------------------
const colCache = new Map();

const db = {
  // db.prepare(sql).get/all/run(...params)
  prepare(sql) {
    const text = String(sql).trim();
    // PRAGMA table_info(tabla) → information_schema (lo usa addColumnIfMissing)
    const m = /^PRAGMA\s+table_info\(\s*["'`]?([\w]+)["'`]?\s*\)\s*;?$/i.exec(text);
    if (m) {
      const t = m[1];
      if (!colCache.has(t)) colCache.set(t, call('cols', { table: t }).cols || []);
      const cols = colCache.get(t);
      return {
        get: () => cols[0],
        all: () => cols,
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }
    const sqlT = translate(text);
    return {
      get: (...params) => {
        const r = call('query', { sql: sqlT, params });
        return Array.isArray(r.rows) ? r.rows[0] : undefined;
      },
      all: (...params) => {
        const r = call('query', { sql: sqlT, params });
        return Array.isArray(r.rows) ? r.rows : [];
      },
      run: (...params) => {
        const r = call('query', { sql: sqlT, params });
        const h = r.rows && typeof r.rows === 'object' ? r.rows : {};
        return { changes: h.affectedRows || 0, lastInsertRowid: h.insertId || 0 };
      },
    };
  },

  // db.exec(sql) — acepta varias sentencias separadas por ';'
  exec(sql) {
    const stmts = splitSql(String(sql)).map(translate);
    if (stmts.length) call('exec', { stmts });
    return db;
  },

  // db.pragma(...) — no aplica en MariaDB; solo se conserva user_version
  pragma(source, opts) {
    const s = String(source || '').trim().toLowerCase();
    const mUser = /^user_version(?:\s*=\s*(\d+))?$/.exec(s);
    if (mUser) {
      // El valor 2 ya fue aplicado en el SQLite original (migración pro/colores).
      // Devolver 2 evita re-ejecutar esa migración contra los datos ya migrados.
      return opts && opts.simple ? 2 : [[{ user_version: 2 }]];
    }
    return undefined; // journal_mode, foreign_keys, etc: no-op
  },

  // Para herramientas de línea de comandos: no mantener vivo el proceso.
  _shutdown() {
    if (worker) { try { worker.terminate(); } catch (e) {} }
    worker = null; ready = false; dead = false;
  },
};

process.on('beforeExit', () => { if (worker) { try { worker.terminate(); } catch (e) {} } });

module.exports = db;
module.exports._translate = translate;
module.exports._split = splitSql;
