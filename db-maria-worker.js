'use strict';
// Worker de MySQL/MariaDB para db-maria-sync.js (driver mysql2).
// Ejecuta las consultas de forma asíncrona y devuelve el resultado al hilo
// principal por MessagePort + Atomics, lo que permite que el hilo principal
// siga usando la API síncrona de siempre (prepare/exec/pragma).
const { parentPort, workerData } = require('worker_threads');
const mysql = require('mysql2/promise');

const outPort = workerData.port; // puerto transferido desde el hilo principal
const WAKE = workerData.wake;     // SharedArrayBuffer para despertar al principal

function reply(msg) {
  try { outPort.postMessage(msg); } catch (e) { /* puerto cerrado */ }
  if (WAKE) {
    Atomics.store(WAKE, 0, 1);
    Atomics.notify(WAKE, 0);
  }
}

// Un error suelto (p. ej. una conexión inactiva que MySQL cerró) no debe matar
// el hilo: si muere, el hilo principal se queda sin base de datos.
process.on('uncaughtException', (e) => { console.error('[db-worker] uncaughtException:', (e && e.stack) || e); });
process.on('unhandledRejection', (e) => { console.error('[db-worker] unhandledRejection:', (e && e.stack) || e); });

const pool = mysql.createPool({
  host: workerData.cfg.host,
  port: workerData.cfg.port,
  user: workerData.cfg.user,
  password: workerData.cfg.password,
  database: workerData.cfg.database,
  connectionLimit: 1,
  waitForConnections: true,
  queueLimit: 0,
  charset: 'utf8mb4',
  decimalNumbers: true,
  supportBigNumbers: true,
  bigNumberStrings: false,
  dateStrings: true,
});

// Modo SQL permisivo (como SQLite): sin ONLY_FULL_GROUP_BY ni modo estricto.
// Nota: el evento 'connection' entrega la conexión cruda (API callback).
pool.on('connection', (c) => {
  c.query("SET SESSION sql_mode = ''", () => {});
});

async function tableExists(table) {
  const safe = String(table).replace(/'/g, "''");
  const [r] = await pool.query(
    'SELECT COUNT(*) AS c FROM information_schema.tables ' +
      "WHERE table_schema = DATABASE() AND table_name = '" + safe + "'"
  );
  return r[0].c > 0;
}

const CREATE_ANY = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"'\w]+)/i;

async function execStatements(stmts) {
  for (let raw of stmts) {
    const s = String(raw).trim();
    if (!s) continue;
    const m = CREATE_ANY.exec(s);
    if (m) {
      const name = m[1].replace(/[`"']/g, '');
      if (await tableExists(name)) continue; // el esquema ya existe (migración previa)
    }
    if (/^\s*CREATE\s+TABLE/i.test(s)) {
      const conn = await pool.getConnection();
      try {
        await conn.query("SET SESSION sql_mode = ''");
        await conn.query(s);
      } finally {
        conn.release();
      }
    } else {
      await pool.query(s);
    }
  }
}

async function runOp(op, msg) {
  if (op === 'ping') return { ok: true };
  if (op === 'query') {
    const [rows] = await pool.query(msg.sql, msg.params || []);
    return { ok: true, rows };
  }
  if (op === 'exec') {
    await execStatements(msg.stmts || []);
    return { ok: true };
  }
  if (op === 'cols') {
    const [rows] = await pool.query(
      `SELECT column_name AS name, data_type AS type, is_nullable AS isnull,
              column_default AS dflt, column_key AS ck
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ?
       ORDER BY ordinal_position`,
      [msg.table]
    );
    return {
      ok: true,
      cols: rows.map((r, i) => ({
        cid: i,
        name: r.name,
        type: r.type,
        notnull: r.isnull === 'NO' ? 1 : 0,
        dflt_value: r.dflt,
        pk: r.ck === 'PRI' ? 1 : 0
      }))
    };
  }
  return { ok: false, error: 'operación desconocida: ' + op };
}

parentPort.on('message', async (msg) => {
  try {
    const out = await runOp(msg.op, msg);
    reply({ id: msg.id, ...out });
  } catch (e) {
    reply({ id: msg.id, ok: false, error: e && e.message ? e.message : String(e) });
  }
});

// Prueba de conexión al arrancar: si MariaDB está caído, falla rápido y claro.
(async () => {
  try {
    await pool.query('SELECT 1');
    reply({ id: 'ready', ok: true });
  } catch (e) {
    reply({ id: 'ready', ok: false, error: e && e.message ? e.message : String(e) });
  }
})();
