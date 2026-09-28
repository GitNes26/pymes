'use strict';
// Cliente del microservicio de imágenes (imagenes-api, PHP).
// Si IMAGES_API_URL e IMAGES_API_KEY están definidas, las fotos subidas se
// mandan a ese servicio y se guarda en la BD la URL completa que regresa.
// Si no están definidas, todo sigue funcionando como antes (disco local).
const fs = require('fs');
const path = require('path');

const API_URL = String(process.env.IMAGES_API_URL || '').trim().replace(/\/+$/, '');
const API_KEY = String(process.env.IMAGES_API_KEY || '').trim();
const PROJECT = String(process.env.IMAGES_API_PROJECT || 'catamanager').trim();
const MIMES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

function enabled() {
  return !!(API_URL && API_KEY);
}

async function upload(filePath, filename) {
  const buf = await fs.promises.readFile(filePath);
  const name = filename || path.basename(filePath);
  const type = MIMES[path.extname(name).toLowerCase()] || 'application/octet-stream';
  const form = new FormData();
  form.append('project', PROJECT);
  form.append('file', new Blob([buf], { type }), name);
  const r = await fetch(API_URL + '/v1/images', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + API_KEY,
      // Algunos firewalls de hosting bloquean peticiones sin User-Agent de navegador
      'User-Agent': 'Mozilla/5.0 (compatible; CataManager/1.0)',
      Accept: 'application/json'
    },
    body: form,
    signal: AbortSignal.timeout(30000)
  });
  let body = null;
  try { body = await r.json(); } catch (e) { /* respuesta no JSON (p. ej. 403 del hosting) */ }
  if (!r.ok || !body || !body.ok) {
    let msg = (body && body.error && body.error.message) || ('HTTP ' + r.status + ' sin respuesta JSON del servicio de imágenes');
    const det = body && body.error && body.error.details;
    if (det && det.received) {
      // Huella de la llave que mandó la app, para compararla con config.php sin mostrarla completa
      const h = API_KEY.length > 10 ? API_KEY.slice(0, 4) + '…' + API_KEY.slice(-4) : '(muy corta)';
      msg += ' | el servicio recibió ' + det.received + ' | la app tiene ' + h + ' (' + API_KEY.length + ' car.)';
    }
    const err = new Error(msg);
    err.status = r.status;
    err.code = body && body.error && body.error.code;
    throw err;
  }
  return body.data; // { url, filename, path, width, height, size, ... }
}

module.exports = { enabled, upload, API_URL, PROJECT };
if (enabled()) console.log('[images-api] activo:', API_URL, 'proyecto=' + PROJECT);
