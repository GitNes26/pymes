const express = require('express');
const path = require('path');

// Carga variables de entorno desde .env ANTES de require('./db')
try {
  const fsEnv = require('fs');
  const envPath = path.join(__dirname, '.env');
  if (fsEnv.existsSync(envPath)) {
    fsEnv.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  }
} catch (e) {}

const db = require('./db');
const { reportPeriod, buildReport, csvCell } = require('./lib/reportes');
const { MASCARA_SIZES, SHAPE_DEFS, getShapeClip, MASCARA_CSS, EDITOR_ONLY_CSS } = require('./lib/mascara');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(require('@ffmpeg-installer/ffmpeg').path);
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const QRCode = require('qrcode');
const { TPL_THEMES, TPL_META, TPL_CASOS } = require('./templates-data');
const app = express();

// Express 4 no captura rechazos de handlers async: cualquier error de BD en uno
// de ellos se convierte en 500 (next(err)) en lugar de tumbar el proceso.
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Red de seguridad: un error fuera de una ruta Express (un setInterval, una
// promesa sin .catch, etc.) no debe tirar el servidor completo para todas las
// tiendas. Se registra y el proceso sigue vivo.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason && (reason.stack || reason.message) || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err && (err.stack || err.message) || err);
});

const MASTER_KEY = process.env.MASTER_KEY || crypto.randomBytes(12).toString('hex');
// Sin esquema (p. ej. "cadi.nessik.net") el enlace no abre: se completa con https:// y se quita la "/" final
const BASE_URL = (() => { let u = String(process.env.BASE_URL || '').trim().replace(/\/+$/, ''); if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u; return u; })();
// Si no hay BASE_URL, se aprende el dominio real de las visitas para armar enlaces COMPLETOS (compartir, copiar, QR)
let _detectedOrigin = '';
const siteOrigin = () => BASE_URL || _detectedOrigin;

// Sesión persistente: mientras el dueño/empleado siga usando el panel, cada
// request renueva tanto la cookie como la fila en `sessions` por otros 30 días
// (ver touchSession) — así solo se cierra sesión si él lo pide o si de plano
// deja de entrar por 30 días seguidos.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// En producción (Dokploy/Traefik u otro proxy) la TLS se termina ANTES de
// llegar al contenedor: Express recibe todo por HTTP plano. Sin "trust proxy"
// req.protocol siempre da 'http' aunque el visitante entre por https, lo que
// generaba enlaces para compartir, QR y og:image en http (rotos o inseguros).
// Con esto, Express confía en el header X-Forwarded-Proto que pone el proxy.
app.set('trust proxy', 1);
app.use((req, res, next) => { if (!BASE_URL && req.get('host')) _detectedOrigin = req.protocol + '://' + req.get('host'); next(); });

// Si BASE_URL apunta a https, cualquier visita que llegue por http se manda
// a la versión https (evita contenido mixto y enlaces "http" que ya no cargan
// si el dominio solo sirve https). /health se excluye: el healthcheck del
// Dockerfile lo consulta en http plano dentro de la propia red del contenedor.
const FORCE_HTTPS = /^https:\/\//i.test(BASE_URL);
app.use((req, res, next) => {
  if (FORCE_HTTPS && !req.secure && req.path !== '/health') {
    return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
  }
  next();
});

app.get('/health', (req, res) => res.send('ok'));

// ================= PLANES (configurables desde el panel maestro) =================
function getPlan(biz) {
  const p = db.prepare('SELECT * FROM plans WHERE key = ?').get((biz && biz.plan) || 'demo');
  // Plan único vigente: demo (ilimitado).
  return p || { key: 'demo', name: 'Demo', price: 0, days: 0, max_products: -1, ads: 1, design: 0 };
}
// Fondo avanzado de la página: hex simple o JSON {type,bg,bg2,bgAngle,bgImage,bgPattern,bgPatternC}
function pageBgCss(v) {
  if (!v) return '';
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return 'body{background:' + v + '!important}';
  let o = null;
  if (typeof v === 'string') { try { o = JSON.parse(v); } catch (e) {} }
  if (!o || typeof o !== 'object' || !o.type) return '';
  const h1 = /^#[0-9a-fA-F]{6}$/.test(o.bg || '') ? o.bg : '';
  const h2 = /^#[0-9a-fA-F]{6}$/.test(o.bg2 || '') ? o.bg2 : '';
  const ang = Number(o.bgAngle) || 135;
  let css = '';
  if (o.type === 'linear') css = (o.bg || o.bg2) ? 'linear-gradient(' + ang + 'deg,' + (h1 || '#ffffff') + ',' + (h2 || '#e2e8f0') + ')' : '';
  else if (o.type === 'radial') css = (o.bg || o.bg2) ? 'radial-gradient(circle at 50% 40%,' + (h1 || '#ffffff') + ',' + (h2 || '#e2e8f0') + ')' : '';
  else if (o.type === 'conic') css = (o.bg || o.bg2) ? 'conic-gradient(from 0deg at 50% 50%,' + (h1 || '#ffffff') + ',' + (h2 || '#e2e8f0') + ')' : '';
  else if (o.type === 'image') css = o.bgImage ? 'url(\'' + o.bgImage + '\') center/cover no-repeat' : (o.bg || '');
  else if (o.type === 'pattern') {
    const pat = o.bgPattern || 'rayas';
    const pc = /^#[0-9a-fA-F]{6}$/.test(o.bgPatternC || '') ? o.bgPatternC : (h2 || '#e2e8f0');
    if (pat === 'puntos') css = (o.bg || 'transparent') + ' radial-gradient(' + pc + ' 5px,transparent 6px) 0 0/26px 26px';
    else if (pat === 'cuadros') css = (o.bg || 'transparent') + ' repeating-conic-gradient(' + pc + ' 0% 25%,transparent 0% 50%) 0 0/32px 32px';
    else if (pat === 'horizontales') css = (o.bg || 'transparent') + ' repeating-linear-gradient(0deg,' + pc + ' 0 6px,transparent 6px 14px)';
    else css = (o.bg || 'transparent') + ' repeating-linear-gradient(45deg,' + pc + ' 0 8px,transparent 8px 18px)';
  } else css = o.bg || '';
  return css ? 'body{background:' + css + '!important}' : '';
}
function sanitizePageBg(v, hasOwn, prev) {
  if (!v) return hasOwn ? '' : prev;
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  try { const o = JSON.parse(v); if (o && typeof o === 'object' && typeof o.type === 'string' && typeof o.bg === 'string') return v; } catch (e) {}
  return hasOwn ? '' : prev;
}
// Limpia la configuración de navegación (NAV_STYLE) preservando todos los campos que usa el renderizador
function cleanNav(n) {
  n = n || {};
  const hex = (v) => (/^#[0-9a-fA-F]{6}$/.test(v || '') ? v : '');
  const num = (v, min, max, dflt) => { const x = parseInt(v, 10); return isNaN(x) ? dflt : Math.max(min, Math.min(max, x)); };
  const str = (v, len) => String(v == null ? '' : v).slice(0, len || 30);
  const pick = (v, list, dflt) => (list.indexOf(v) > -1 ? v : dflt);
  const BG_TYPES = ['solid', 'linear', 'radial', 'conic', 'image', 'pattern'];
  const PATTERNS = ['rayas', 'horizontales', 'puntos', 'cuadros'];
  const SI_NO = ['si', 'no'];
  return {
    estilo: pick(n.estilo, ['pildoras', 'tabs', 'subrayado'], 'subrayado'),
    align: pick(n.align, ['left', 'center'], 'left'),
    direction: pick(n.direction, ['horizontal', 'vertical'], 'horizontal'),
    posicion: pick(n.posicion, ['arriba', 'abajo'], 'arriba'),
    bgType: pick(n.bgType, BG_TYPES, 'solid'),
    bg: hex(n.bg),
    bg2: hex(n.bg2),
    bgAngle: num(n.bgAngle, 0, 360, 135),
    bgImage: str(n.bgImage, 500),
    bgPattern: pick(n.bgPattern, PATTERNS, 'rayas'),
    bgPatternC: hex(n.bgPatternC),
    color: hex(n.color),
    text: hex(n.text),
    activeBg: hex(n.activeBg),
    activeText: hex(n.activeText),
    borderC: hex(n.borderC),
    actBorderC: hex(n.actBorderC),
    hovBg: hex(n.hovBg),
    hovText: hex(n.hovText),
    stickyBg: hex(n.stickyBg),
    radius: str(n.radius),
    shadow: str(n.shadow),
    stickyShadow: str(n.stickyShadow),
    hovUnder: str(n.hovUnder),
    hovScale: str(n.hovScale),
    uppercase: pick(n.uppercase, SI_NO, 'no'),
    stickyOn: pick(n.stickyOn, SI_NO, 'no'),
    stickyPos: pick(n.stickyPos, ['top', 'bottom'], 'top'),
    stickyOff: num(n.stickyOff, 0, 2000, 0),
    icons: pick(n.icons, SI_NO, 'si'),
    iconPos: pick(n.iconPos, ['left', 'top'], 'left'),
    mobile: pick(n.mobile, SI_NO, 'si'),
    breakpoint: num(n.breakpoint, 480, 1200, 768),
    actBorder: pick(n.actBorder, SI_NO, 'no'),
    actBorderW: num(n.actBorderW, 0, 10, 2),
    actBorderPos: pick(n.actBorderPos, ['bottom', 'top'], 'bottom'),
    gap: num(n.gap, 0, 40, 8),
    pad: num(n.pad, 0, 40, 10),
    size: num(n.size, 8, 40, 14),
    borderW: num(n.borderW, 0, 10, 0),
    opacity: num(n.opacity, 0, 100, 100)
  };
}
const PLAN_MAX = (biz) => {
  const p = getPlan(biz);
  return p.max_products === -1 ? Infinity : (p.max_products || 0);
};
// El plan decide si la tienda DEBE mostrar publicidad cruzada (los que la tienen en su plan, la ven)
function adsOn(biz) {
  return getPlan(biz).ads === 1;
}
// El plan decide si el dueño puede personalizar el diseño de su catálogo (siempre: ya no depende del plan)
function designAllowed(biz) {
  return true;
}
// Patrones visuales del catálogo público: mismo contenido, distinto acomodo
// Cada estilo es una paleta + tipografía sobre el mismo layout base (catalog.ejs → templates/constructor.ejs).
// Fuentes de Google reutilizadas entre varios estilos para no disparar el número de peticiones de fuentes.
const CAT_FONTS = {
  clasica: { heading: "'Playfair Display', serif", body: "'Inter', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&display=swap' },
  pasteleria: { heading: "'Playfair Display', serif", body: "'Quicksand', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Quicksand:wght@400;500;600;700&display=swap' },
  romantica: { heading: "'Cormorant Garamond', serif", body: "'Nunito Sans', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Nunito+Sans:wght@400;600;700;800&display=swap' },
  editorial: { heading: "'Cormorant Garamond', serif", body: "'Jost', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Jost:wght@300;400;500;600;700&display=swap' },
  industrial: { heading: "'Archivo', sans-serif", body: "'Barlow Condensed', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@500;600;700;800&display=swap' },
  artesanal: { heading: "'Fraunces', serif", body: "'Karla', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Karla:wght@400;500;600;700;800&display=swap' },
  luxe: { heading: "'Italiana', serif", body: "'Outfit', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Italiana&family=Outfit:wght@300;400;500;600;700&display=swap' },
  organica: { heading: "'Amatic SC', cursive", body: "'Nunito', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Amatic+SC:wght@400;700&family=Nunito:wght@400;600;700;800;900&display=swap' },
  glam: { heading: "'Marcellus', serif", body: "'Jost', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Marcellus&family=Jost:wght@300;400;500;600;700&display=swap' },
  altaCostura: { heading: "'Bodoni Moda', serif", body: "'Montserrat', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600;0,6..96,700;1,6..96,400&family=Montserrat:wght@300;400;500;600;700&display=swap' },
  tecnica: { heading: "'Space Grotesk', sans-serif", body: "'Inter', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap' },
  redondeada: { heading: "'Poppins', sans-serif", body: "'Poppins', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap' },
  literaria: { heading: "'Libre Baskerville', serif", body: "'Work Sans', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Work+Sans:wght@400;500;600;700&display=swap' },
  geometrica: { heading: "'Jost', sans-serif", body: "'Jost', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700&display=swap' },
  vintage: { heading: "'Abril Fatface', serif", body: "'Lato', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Lato:wght@400;700;900&display=swap' },
  contemporanea: { heading: "'Crimson Pro', serif", body: "'Manrope', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Manrope:wght@400;500;600;700;800&display=swap' },
  amigable: { heading: "'Nunito', sans-serif", body: "'Nunito', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap' },
  brutalista: { heading: "'Archivo Black', sans-serif", body: "'Inter', sans-serif", href: 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&display=swap' }
};
const CAT_DESIGNS = [
  { id: 'catalogo', name: 'Clásico', desc: 'Elegante y versátil, con serif refinada — va bien con casi cualquier negocio', emoji: '🛍️',
    tokens: { bg: '#f8f6f2', card: '#ffffff', text: '#1e1b1a', textSec: '#6b6562', accent: '#1a3c5e', accentLight: '#4a7a9c', accentGlow: '#c9a86c', border: 'rgba(26,60,94,.08)', radius: 18, shadow: '0 8px 32px rgba(0,0,0,.06)', font: CAT_FONTS.clasica } },
  { id: 'joyeria', name: 'Vitrina Elegante', desc: 'Fondo oscuro y dorado: aire de boutique de lujo', emoji: '💎',
    tokens: { bg: '#12100e', card: '#1c1916', text: '#f3ede1', textSec: '#aaa89e', accent: '#d8b876', accentLight: '#e8cd96', accentGlow: '#8a7147', border: 'rgba(216,184,118,.15)', radius: 4, shadow: '0 10px 40px rgba(0,0,0,.45)', font: CAT_FONTS.altaCostura } },
  { id: 'postres', name: 'Pastel Suave', desc: 'Tonos crema y rosa, curvas amplias y tipografía delicada', emoji: '🧁',
    tokens: { bg: '#fdf6f0', card: '#fffaf5', text: '#3d2c1e', textSec: '#8a7365', accent: '#c17b8a', accentLight: '#dba3ae', accentGlow: '#8b5e3c', border: 'rgba(193,123,138,.12)', radius: 22, shadow: '0 8px 30px rgba(193,123,138,.10)', font: CAT_FONTS.pasteleria } },
  { id: 'ropa', name: 'Editorial B/N', desc: 'Blanco y negro editorial, esquinas rectas, aire de revista de moda', emoji: '🖤',
    tokens: { bg: '#f7f6f4', card: '#ffffff', text: '#1a1815', textSec: '#8a857c', accent: '#1a1815', accentLight: '#3a3530', accentGlow: '#b08d57', border: 'rgba(26,24,21,.12)', radius: 0, shadow: '0 8px 28px rgba(0,0,0,.05)', font: CAT_FONTS.editorial } },
  { id: 'floreria', name: 'Botánico Romántico', desc: 'Verdes naturales y rosa empolvado, con textos cursivos', emoji: '🌿',
    tokens: { bg: '#f6f7f3', card: '#ffffff', text: '#2c3a2a', textSec: '#7c8a77', accent: '#5a7052', accentLight: '#87a17e', accentGlow: '#c98a9c', border: 'rgba(90,112,82,.12)', radius: 20, shadow: '0 8px 30px rgba(90,112,82,.08)', font: CAT_FONTS.romantica } },
  { id: 'ferreteria', name: 'Industrial', desc: 'Grises de acero, amarillo de advertencia y sombras marcadas', emoji: '⚙️',
    tokens: { bg: '#eef0f2', card: '#ffffff', text: '#1b1f23', textSec: '#5f6b76', accent: '#1b1f23', accentLight: '#3a4249', accentGlow: '#f0b429', border: 'rgba(27,31,35,.14)', radius: 6, shadow: '4px 4px 0 rgba(27,31,35,.12)', font: CAT_FONTS.industrial } },
  { id: 'muebles', name: 'Cálido Artesanal', desc: 'Nogal cálido y crema, con aire de taller hecho a mano', emoji: '🪵',
    tokens: { bg: '#f7f2ea', card: '#fffdfa', text: '#33291f', textSec: '#8b7e6f', accent: '#8b5e3c', accentLight: '#ab7d5c', accentGlow: '#c9a86c', border: 'rgba(139,94,60,.12)', radius: 14, shadow: '0 10px 32px rgba(90,60,30,.08)', font: CAT_FONTS.artesanal } },
  { id: 'cosmeticos', name: 'Minimalista Rosa', desc: 'Porcelana y rosa dorado, curvas amplias y mucho aire', emoji: '🤍',
    tokens: { bg: '#fbf7f5', card: '#ffffff', text: '#2e2624', textSec: '#a0948e', accent: '#c9927e', accentLight: '#dcae9c', accentGlow: '#e8cdb8', border: 'rgba(201,146,126,.14)', radius: 24, shadow: '0 10px 30px rgba(201,146,126,.10)', font: CAT_FONTS.luxe } },
  { id: 'vivero', name: 'Natural Fresco', desc: 'Verdes vivos y terracota, con un toque juguetón', emoji: '🌱',
    tokens: { bg: '#f4f7ef', card: '#ffffff', text: '#2c3b2d', textSec: '#7e8b77', accent: '#3e7c4f', accentLight: '#5fa072', accentGlow: '#c96f44', border: 'rgba(62,124,79,.14)', radius: 24, shadow: '0 10px 30px rgba(62,124,79,.10)', font: CAT_FONTS.organica } },
  { id: 'belleza', name: 'Glam Dorado', desc: 'Rosa dorado y tipografía elegante, aire de salón de belleza', emoji: '💫',
    tokens: { bg: '#fbf5f2', card: '#ffffff', text: '#3a2e2a', textSec: '#8a7a76', accent: '#c4899b', accentLight: '#d8a8b6', accentGlow: '#3a2e2a', border: 'rgba(196,137,155,.16)', radius: 20, shadow: '0 10px 34px rgba(196,137,155,.12)', font: CAT_FONTS.glam } },
  { id: 'eventos', name: 'Nocturno Elegante', desc: 'Fondo oscuro con dorado champán, para un efecto de gala', emoji: '🌙',
    tokens: { bg: '#1f1120', card: '#2a1830', text: '#faf6f0', textSec: '#c7b3c9', accent: '#d8b876', accentLight: '#e8cd96', accentGlow: '#b08d57', border: 'rgba(216,184,118,.2)', radius: 0, shadow: '0 12px 40px rgba(0,0,0,.5)', font: CAT_FONTS.altaCostura } },
  { id: 'minimalista', name: 'Minimalista', desc: 'Blanco y negro puro, esquinas rectas, sin adornos', emoji: '◻️',
    tokens: { bg: '#fafafa', card: '#ffffff', text: '#18181b', textSec: '#71717a', accent: '#18181b', accentLight: '#3f3f46', accentGlow: '#a1a1aa', border: 'rgba(0,0,0,.08)', radius: 4, shadow: '0 4px 20px rgba(0,0,0,.05)', font: CAT_FONTS.tecnica } },
  { id: 'pastel', name: 'Pastel Dreams', desc: 'Lavanda y menta suaves, todo redondeado y ligero', emoji: '🍬',
    tokens: { bg: '#f7f5fc', card: '#ffffff', text: '#3a3352', textSec: '#8b84a3', accent: '#a78bda', accentLight: '#c3aeea', accentGlow: '#8ed6c0', border: 'rgba(167,139,218,.14)', radius: 24, shadow: '0 10px 30px rgba(167,139,218,.12)', font: CAT_FONTS.redondeada } },
  { id: 'monocromo', name: 'Monocromo', desc: 'Blanco y negro contrastado, sombras duras, muy directo', emoji: '⬛',
    tokens: { bg: '#ffffff', card: '#f4f4f5', text: '#0a0a0a', textSec: '#71717a', accent: '#0a0a0a', accentLight: '#27272a', accentGlow: '#a1a1aa', border: 'rgba(0,0,0,.1)', radius: 0, shadow: '6px 6px 0 rgba(0,0,0,.9)', font: CAT_FONTS.brutalista } },
  { id: 'bohemio', name: 'Bohemio', desc: 'Terracota y mostaza cálidos, con aire artesanal y libre', emoji: '🧿',
    tokens: { bg: '#faf3ea', card: '#fffaf3', text: '#3d2b1f', textSec: '#9c8770', accent: '#c1652f', accentLight: '#d98a52', accentGlow: '#c9a227', border: 'rgba(193,101,47,.14)', radius: 16, shadow: '0 10px 30px rgba(193,101,47,.10)', font: CAT_FONTS.artesanal } },
  { id: 'oceanico', name: 'Oceánico', desc: 'Verde azulado profundo con arena, fresco y sereno', emoji: '🌊',
    tokens: { bg: '#f2f7f7', card: '#ffffff', text: '#123638', textSec: '#5f8285', accent: '#0e7c86', accentLight: '#3ba0a9', accentGlow: '#e8c07d', border: 'rgba(14,124,134,.14)', radius: 12, shadow: '0 10px 30px rgba(14,124,134,.10)', font: CAT_FONTS.literaria } },
  { id: 'nordico', name: 'Nórdico', desc: 'Madera clara, salvia y blanco, limpio y acogedor', emoji: '🤍',
    tokens: { bg: '#f7f6f2', card: '#ffffff', text: '#2e332c', textSec: '#8a9186', accent: '#6b7a5e', accentLight: '#8fa07f', accentGlow: '#d8cdb8', border: 'rgba(107,122,94,.12)', radius: 10, shadow: '0 6px 24px rgba(0,0,0,.05)', font: CAT_FONTS.geometrica } },
  { id: 'vibrante', name: 'Vibrante', desc: 'Coral y morado intensos, curvas amplias y mucha energía', emoji: '🎉',
    tokens: { bg: '#fef7f5', card: '#ffffff', text: '#2b1b2e', textSec: '#8c7a90', accent: '#ff5d73', accentLight: '#ff8a99', accentGlow: '#7c3aed', border: 'rgba(255,93,115,.14)', radius: 22, shadow: '0 12px 34px rgba(255,93,115,.16)', font: CAT_FONTS.redondeada } },
  { id: 'retro', name: 'Retro Vintage', desc: 'Mostaza y naranja quemado, con sombras a la antigua', emoji: '📻',
    tokens: { bg: '#f6ecd9', card: '#fffdf6', text: '#3a2a1a', textSec: '#8c765a', accent: '#c1621f', accentLight: '#dc8548', accentGlow: '#2f6b5e', border: 'rgba(193,98,31,.16)', radius: 8, shadow: '5px 5px 0 rgba(58,42,26,.14)', font: CAT_FONTS.vintage } },
  { id: 'futurista', name: 'Futurista', desc: 'Azul noche con cian neón, sombras que brillan', emoji: '🔮',
    tokens: { bg: '#0b0f1a', card: '#121a2b', text: '#e6f6ff', textSec: '#8fa3bf', accent: '#22d3ee', accentLight: '#67e8f9', accentGlow: '#a78bfa', border: 'rgba(34,211,238,.2)', radius: 12, shadow: '0 0 32px rgba(34,211,238,.15)', font: CAT_FONTS.tecnica } },
  { id: 'rustico', name: 'Rústico', desc: 'Terracota y oliva, con textura de campo', emoji: '🌾',
    tokens: { bg: '#f5f0e6', card: '#fffcf5', text: '#382f22', textSec: '#8b8168', accent: '#a0522d', accentLight: '#bf7248', accentGlow: '#6b7a45', border: 'rgba(160,82,45,.14)', radius: 8, shadow: '0 8px 26px rgba(90,60,30,.08)', font: CAT_FONTS.artesanal } },
  { id: 'elegante', name: 'Elegante Blanco', desc: 'Blanco puro con acentos dorados finos, muy sobrio', emoji: '🕊️',
    tokens: { bg: '#fdfdfc', card: '#ffffff', text: '#242220', textSec: '#8f897f', accent: '#a88a4a', accentLight: '#c7a968', accentGlow: '#2a2824', border: 'rgba(168,138,74,.14)', radius: 16, shadow: '0 10px 34px rgba(0,0,0,.06)', font: CAT_FONTS.clasica } },
  { id: 'urbano', name: 'Urbano', desc: 'Concreto y negro con un toque de verde neón', emoji: '🏙️',
    tokens: { bg: '#eceeed', card: '#ffffff', text: '#16181a', textSec: '#5c6266', accent: '#16181a', accentLight: '#33383c', accentGlow: '#c6f24a', border: 'rgba(0,0,0,.12)', radius: 6, shadow: '4px 4px 0 rgba(0,0,0,.15)', font: CAT_FONTS.industrial } },
  { id: 'tropical', name: 'Tropical', desc: 'Naranja coral y verde jungla, cálido y alegre', emoji: '🌴',
    tokens: { bg: '#fffaf0', card: '#ffffff', text: '#20361f', textSec: '#6f8a68', accent: '#ea580c', accentLight: '#f2905a', accentGlow: '#16a34a', border: 'rgba(234,88,12,.14)', radius: 24, shadow: '0 10px 30px rgba(234,88,12,.12)', font: CAT_FONTS.amigable } },
  { id: 'acuarela', name: 'Acuarela', desc: 'Azul suave y lavanda, como pintado a mano', emoji: '🎨',
    tokens: { bg: '#f5f7fb', card: '#ffffff', text: '#2a3040', textSec: '#818ba0', accent: '#5b7fbd', accentLight: '#8aa6d4', accentGlow: '#c9a4d4', border: 'rgba(91,127,189,.12)', radius: 18, shadow: '0 10px 30px rgba(91,127,189,.10)', font: CAT_FONTS.contemporanea } }
];
// Secciones extra del catálogo (columna businesses.extras, JSON). Se sanea todo
// lo que llega del formulario: largos acotados, solo métodos de pago conocidos
// y estrellas 1–5. Devuelve '' si no quedó nada, para no guardar un "{}" vacío.
const PAGOS_OK = ['efectivo', 'transferencia', 'tarjeta', 'contra_entrega', 'abonos', 'mercado_pago'];
// Solo rutas de nuestras subidas o URLs http(s) sin caracteres que rompan el atributo.
function safeImgUrl(v) {
  const u = String(v == null ? '' : v).trim().slice(0, 500);
  return /^(\/uploads\/[\w.\-]+|https?:\/\/[^\s"'<>]+)$/.test(u) ? u : '';
}
function sanitizeExtras(raw) {
  let x;
  try { x = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {}); } catch (e) { return ''; }
  if (!x || typeof x !== 'object') return '';
  const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const out = {
    about: { title: str(x.about && x.about.title, 80), text: str(x.about && x.about.text, 2000), image: safeImgUrl(x.about && x.about.image) },
    envios: str(x.envios, 1500),
    pagos: (Array.isArray(x.pagos) ? x.pagos : []).filter((p, i, a) => PAGOS_OK.includes(p) && a.indexOf(p) === i),
    pagos_nota: str(x.pagos_nota, 300),
    testimonios: (Array.isArray(x.testimonios) ? x.testimonios : []).slice(0, 8).map(t => ({
      name: str(t && t.name, 60),
      text: str(t && t.text, 400),
      stars: Math.min(5, Math.max(1, parseInt(t && t.stars, 10) || 5))
    })).filter(t => t.name && t.text),
    globalTags: parseCustomTags(x.globalTags),
    modelos: {
      title: str(x.modelos && x.modelos.title, 80),
      text: str(x.modelos && x.modelos.text, 400),
      images: (Array.isArray(x.modelos && x.modelos.images) ? x.modelos.images : []).slice(0, 6)
        .map(i => ({ src: safeImgUrl(i && i.src), cap: str(i && i.cap, 60) })).filter(i => i.src)
    },
    showNew: !!x.showNew,
    showTop: !!x.showTop,
    showHow: !!x.showHow
  };
  const vacio = !out.about.text && !out.envios && !out.pagos.length && !out.pagos_nota && !out.testimonios.length && !out.modelos.images.length && !out.globalTags.length && !out.showNew && !out.showTop && !out.showHow;
  return vacio ? '' : JSON.stringify(out);
}
// Ids de los productos que más se han vendido (suma de unidades en pedidos cobrados y no
// cancelados; los pedidos guardan las líneas como texto "• 2 x Nombre (var) = $x").
function bestSellerIds(bizId, products, limit) {
  const counts = {};
  // Solo cuentan los pedidos ya COBRADOS: un pedido por WhatsApp no garantiza que se haya vendido
  db.prepare("SELECT items FROM orders WHERE business_id = ? AND status != 'cancelado' AND paid = 1").all(bizId).forEach(o => {
    String(o.items || '').split(/[\n|]/).forEach(line => {
      const m = line.match(/(\d+)\s*x\s+(.+?)\s*=\s*[^]*?$/);
      if (!m) return;
      const nm = m[2].trim().replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
      counts[nm] = (counts[nm] || 0) + (parseInt(m[1], 10) || 1);
    });
  });
  const key = p => String(p.name || '').trim().toLowerCase();
  return products.filter(p => p && !p.isAd && counts[key(p)]).sort((a, b) => counts[key(b)] - counts[key(a)]).slice(0, limit).map(p => p.id);
}
function catDesignOf(biz) {
  return CAT_DESIGNS.find(d => d.id === (biz && biz.catalog_design)) || CAT_DESIGNS[0];
}
// Tienda bloqueada por suspensión o plan vencido
function storeBlock(biz) {
  if (!biz) return { blocked: true, reason: 'suspended' };
  if (biz.suspended) return { blocked: true, reason: 'suspended' };
  const today = new Date().toISOString().slice(0, 10);
  if (biz.plan_ends_at && biz.plan_ends_at !== '' && biz.plan_ends_at < today) {
    return { blocked: true, reason: 'expired' };
  }
  return { blocked: false };
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Serializa JSON de forma segura para incrustarlo en <script> (evita XSS con "</script>")
// Fecha legible en español: "3 de marzo del 2026, 9:00 am" · corto: "3 mar" · 'fecha': "3 de marzo del 2026"
app.locals.fmtFecha = function (ts, modo) {
  if (!ts) return '';
  const m = String(ts).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?/);
  if (!m) return String(ts).slice(0, 16);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const mesesL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dia = parseInt(m[3], 10);
  const idx = parseInt(m[2], 10) - 1;
  const mes = (meses[idx] || m[2]);
  if (modo === true || modo === 'corto') return dia + ' ' + mes;
  const fecha = dia + ' de ' + (mesesL[idx] || m[2]) + ' del ' + m[1];
  if (modo === 'fecha') return fecha;
  if (!m[4]) return fecha;
  const h = parseInt(m[4], 10);
  const mm = m[5];
  const horaLarga = ((h % 12) || 12) + ':' + mm + ' ' + (h < 12 ? 'am' : 'pm');
  return fecha + ', ' + horaLarga;
};

app.locals.safeJson = function (v) {
  return JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
};
app.use(express.urlencoded({ extended: true, limit: '60mb' }));
app.use(express.json({ limit: '60mb' }));
// El service worker debe llegar SIEMPRE fresco: si el navegador lo cachea, nunca
// detecta que hay una versión nueva y la app se queda pegada en la vieja para
// siempre (aunque subamos cambios al servidor). Va antes del static general.
app.get('/sw.js', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});
// Imágenes de /uploads a la medida: /uploads/foto.jpg?w=480 devuelve una versión webp más ligera (se guarda en
// public/uploads/_cache). Las tarjetas del catálogo piden 480/800 px con srcset en vez de bajar la foto original.
const _IMG_W = [240, 360, 480, 640, 800, 1200];
app.get('/uploads/:file', (req, res, next) => {
  const w = parseInt(req.query.w, 10);
  const file = req.params.file;
  if (!w || !/\.(jpe?g|png|webp)$/i.test(file) || file.startsWith('.')) return next();
  const width = _IMG_W.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a));
  const root = path.join(__dirname, 'public', 'uploads');
  const src = path.join(root, file);
  if (!src.startsWith(root) || !fs.existsSync(src)) return next();
  const cacheDir = path.join(root, '_cache');
  const out = path.join(cacheDir, file.replace(/\.[^.]+$/, '') + '-' + width + '.webp');
  const send = () => { res.set('Cache-Control', 'public, max-age=2592000, immutable').type('image/webp'); res.sendFile(out); };
  try {
    if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) return send();
    fs.mkdirSync(cacheDir, { recursive: true });
    sharp(src).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out).then(send).catch(() => next());
  } catch (e) { next(); }
});
app.use(require('compression')());
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  setHeaders: function (res, fp) { if (/\.(html|webmanifest)$/.test(fp) || /[\/]sw\.js$/.test(fp)) res.setHeader('Cache-Control', 'no-cache'); }
}));
// === RATE LIMITER ===
var _rateLimit = {};
function rateLimit(maxPerMin) {
  return function(req, res, next) {
    var ip = req.ip || req.connection.remoteAddress || "unknown";
    var now = Date.now();
    var key = ip + ":" + req.path;
    if (!_rateLimit[key]) _rateLimit[key] = [];
    _rateLimit[key] = _rateLimit[key].filter(function(t) { return now - t < 60000; });
    if (_rateLimit[key].length >= maxPerMin) {
      return res.status(429).json({ error: "Demasiadas peticiones. Intenta en 1 minuto." });
    }
    _rateLimit[key].push(now);
    next();
  };
}
setInterval(function() {
  var now = Date.now();
  for (var k in _rateLimit) {
    _rateLimit[k] = _rateLimit[k].filter(function(t) { return now - t < 60000; });
    if (!_rateLimit[k].length) delete _rateLimit[k];
  }
}, 300000);


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public', 'uploads');
    require('fs').mkdir(dir, { recursive: true }, err => cb(err, dir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const safeExt = allowed.includes(ext) ? ext : '.png';
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + safeExt);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const okMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype);
    cb(null, allowed.includes(ext) && okMime);
  }
});
function receiveImageUpload(req, res, next) {
  upload.single('foto')(req, res, err => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'La imagen supera 5 MB. Elige una foto más pequeña.' });
    console.error('[upload imagen]', err);
    if (err.code === 'EACCES' || err.code === 'EPERM') return res.status(500).json({ error: 'El almacenamiento de fotos no tiene permiso de escritura.' });
    if (err.code === 'ENOSPC') return res.status(507).json({ error: 'El almacenamiento de fotos está lleno.' });
    if (err.code === 'EDQUOT') return res.status(507).json({ error: 'Se agotó la cuota de almacenamiento de fotos.' });
    if (err.code === 'EROFS') return res.status(500).json({ error: 'El almacenamiento de fotos está montado en modo de solo lectura.' });
    if (err.code === 'ENOENT') return res.status(500).json({ error: 'No existe el directorio donde se guardan las fotos.' });
    const code = typeof err.code === 'string' && /^[A-Z0-9_]{2,40}$/.test(err.code) ? err.code : 'DESCONOCIDO';
    return res.status(500).json({ error: 'No se pudo guardar la imagen (código ' + code + ').' });
  });
}
// Comprime cualquier foto que suban (producto, logo, banner, categoría…) para
// que no pesen varios MB cada una — antes solo se comprimía del lado del
// cliente en el formulario de productos; el resto de subidas (logo, banner,
// imágenes del constructor) llegaban tal cual las tomó la cámara del celular.
// Se reescribe el mismo archivo ya guardado por multer con un tamaño y
// calidad razonables; si algo falla (archivo raro, sharp no lo puede leer)
// se deja el original tal cual en vez de tronar la subida.
// Recorta franjas vacías pegadas a un borde (p. ej. la banqueta blanca debajo de la foto de una lona): una franja
// uniforme cuyo tono contrasta de golpe con el contenido de al lado. No toca fotos con cielo, degradados ni márgenes
// blancos parejos (ahí no hay salto brusco), ni recorta más del 45% por lado.
async function trimBlankBands(inBuf) {
  const W = 200;
  const { data, info } = await sharp(inBuf, { failOn: 'none' }).rotate().resize({ width: W, withoutEnlargement: true }).flatten({ background: '#ffffff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  if (w < 20 || h < 20) return inBuf;
  const lineStats = (n, len, get) => { const out = []; for (let i = 0; i < n; i++) { let sum = 0, sq = 0; for (let j = 0; j < len; j++) { const v = get(i, j); sum += v; sq += v * v; } const m = sum / len; out.push({ m, sd: Math.sqrt(Math.max(0, sq / len - m * m)) }); } return out; };
  const rows = lineStats(h, w, (y, x) => data[y * w + x]);
  const cols = lineStats(w, h, (x, y) => data[y * w + x]);
  // stats ordenadas del borde hacia adentro → cuántas líneas cortar
  const cut = (st) => {
    const n = st.length, max = Math.floor(n * 0.45);
    let k = 0;
    while (k < max && st[k].sd < 3) k++;
    if (k < Math.max(2, Math.round(n * 0.015))) return 0;
    const b = st.slice(0, Math.min(k, 4)).reduce((a, x) => a + x.m, 0) / Math.min(k, 4);
    const c = st.slice(k, k + 4).reduce((a, x) => a + x.m, 0) / Math.min(4, n - k);
    if (Math.abs(b - c) < 14 || (b < 205 && b > 45)) return 0; // solo franjas claras (blanco, gris muy claro) u oscuras (negro)
    let j = 0;
    while (j < k && Math.abs(st[j].m - b) < 8) j++;
    return j;
  };
  const bottom = cut(rows.slice().reverse()), top = cut(rows), right = cut(cols.slice().reverse()), left = cut(cols);
  if (!bottom && !top && !right && !left) return inBuf;
  const meta = await sharp(inBuf, { failOn: 'none' }).rotate().toBuffer({ resolveWithObject: true });
  const sx = meta.info.width / w, sy = meta.info.height / h;
  const L = Math.round(left * sx), T = Math.round(top * sy);
  const CW = meta.info.width - L - Math.round(right * sx), CH = meta.info.height - T - Math.round(bottom * sy);
  if (CW < 40 || CH < 40) return inBuf;
  return sharp(meta.data).extract({ left: L, top: T, width: CW, height: CH }).toBuffer();
}
async function compressUploadedImage(filePath, opts) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.gif') return; // se respeta tal cual para no perder la animación
  try {
    // Se lee a un buffer en vez de pasarle la ruta a sharp directo: en
    // Windows, escribir sobre un archivo que sharp todavía tiene abierto
    // para lectura falla (EBUSY/UNKNOWN) — con el buffer no queda ningún
    // handle sobre filePath mientras se procesa.
    const before = fs.statSync(filePath).size;
    let inBuf = fs.readFileSync(filePath);
    if (opts && opts.trim && ext !== '.svg') { try { inBuf = await trimBlankBands(inBuf); } catch (e) { console.error('trimBlankBands:', e.message); } }
    const img = sharp(inBuf, { failOn: 'none' }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
    let buf;
    if (ext === '.png') buf = await img.png({ compressionLevel: 9, palette: true }).toBuffer();
    else if (ext === '.webp') buf = await img.webp({ quality: 80 }).toBuffer();
    else buf = await img.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    if (buf.length < before || (opts && opts.trim)) fs.writeFileSync(filePath, buf);
  } catch (e) {
    console.error('compressUploadedImage:', e.message);
  }
}

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.xlsx', '.xls', '.csv'];
    cb(null, allowed.includes(ext));
  }
});

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.mp4', '.webm', '.mov', '.m4v', '.ogg'];
    const safeExt = allowed.includes(ext) ? ext : '.mp4';
    cb(null, 'vid-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + safeExt);
  }
});
const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.mp4', '.webm', '.mov', '.m4v', '.ogg'];
    const okMime = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/ogg'].includes(file.mimetype);
    cb(null, allowed.includes(ext) && okMime);
  }
});
// Igual que compressUploadedImage pero para video: los que suben desde el
// celular llegan pesadísimos (a veces 50-100 MB) sin ningún tratamiento.
// Reescala a máximo 1280px de ancho (sin agrandar los que ya son chicos) y
// reencoda con un CRF razonable — mp4/mov/m4v a H.264+AAC, webm a VP9+Opus
// (su propio códec nativo; mezclar H.264 dentro de un contenedor .webm no
// es válido). .ogg se deja tal cual: es un formato raro hoy en día y no
// vale la pena la complejidad extra. Escribe a un archivo temporal (ffmpeg
// no puede leer y escribir el mismo archivo a la vez) y solo lo reemplaza
// si de verdad quedó más chico.
async function compressUploadedVideo(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.ogg') return;
  const before = fs.statSync(filePath).size;
  const tmpPath = filePath + '.compressing' + ext;
  try {
    await new Promise((resolve, reject) => {
      const cmd = ffmpeg(filePath)
        .videoFilters("scale='min(1280,iw)':-2")
        .outputOptions(['-movflags +faststart'])
        .on('end', resolve)
        .on('error', reject);
      if (ext === '.webm') cmd.videoCodec('libvpx-vp9').audioCodec('libopus').outputOptions(['-crf 34', '-b:v 0', '-deadline good']);
      else cmd.videoCodec('libx264').audioCodec('aac').outputOptions(['-crf 28', '-preset veryfast']).audioBitrate('96k');
      cmd.save(tmpPath);
    });
    const after = fs.statSync(tmpPath).size;
    if (after > 0 && after < before) {
      fs.unlinkSync(filePath);
      fs.renameSync(tmpPath, filePath);
    } else {
      fs.unlinkSync(tmpPath);
    }
  } catch (e) {
    console.error('compressUploadedVideo:', e.message);
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e2) {}
  }
}

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.txt', '.csv', '.json'];
    const safeExt = allowed.includes(ext) ? ext : '.bin';
    cb(null, 'file-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + safeExt);
  }
});
const uploadFile = multer({
  storage: fileStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.txt', '.csv', '.json'];
    cb(null, allowed.includes(ext));
  }
});

app.use((req, res, next) => {
  const raw = req.headers.cookie || '';
  const out = {};
  raw.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  req.cookies = out;
  next();
});

// ================= CSRF (doble-envío de cookie + token oculto) =================
app.use((req, res, next) => {
  if (!req.cookies.csrf) {
    req.cookies.csrf = crypto.randomBytes(24).toString('hex');
    res.cookie('csrf', req.cookies.csrf, { httpOnly: false, sameSite: 'lax', path: '/', secure: req.secure });
  }
  res.locals.csrf = req.cookies.csrf;
  next();
});
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const p = req.path;
  if (p === '/registrar' || p === '/maestro' || p === '/maestro/cerrar') return next();
  if (p.endsWith('/admin') || p.endsWith('/resetear-pin')) return next(); // logins / reseteo público
  if (!/^\/[^/]+\/admin(\/|$)/.test(p) && !/^\/maestro\//.test(p)) return next();
  // Multipart: el body aún no está parseado aquí; se valida en la ruta tras multer (ver verifyBodyCsrf)
  if (req.is('multipart/form-data')) return next();
  const t = (req.body && req.body._csrf) || req.get('x-csrf-token') || '';
  if (!t || t !== req.cookies.csrf) {
    return res.status(403).send('Solicitud rechazada: token de seguridad inválido. Recarga la página e intenta de nuevo.');
  }
  next();
});

// Valida CSRF en peticiones multipart, una vez que multer ya parseó el body
function verifyBodyCsrf(req, res, next) {
  const t = (req.body && req.body._csrf) || req.get('x-csrf-token') || '';
  if (!t || t !== req.cookies.csrf) {
    return res.status(403).send('Solicitud rechazada: token de seguridad inválido. Recarga la página e intenta de nuevo.');
  }
  next();
}

// ================= BACKUP AUTOMÁTICO DIARIO =================
// Nota: desde la migración a MySQL 8, este backup vuelca la base real por SQL
// (no hay un archivo .db local que copiar). Se guarda en backups/ dentro del
// contenedor — si el despliegue en Dokploy no monta ese directorio como volumen
// persistente, los backups no sobreviven un redeploy; considera moverlos a un
// bucket remoto (S3, etc.) o confirmar que Dokploy ya respalda la base por su cuenta.
const fs = require('fs');
const backupsDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
async function hacerBackup() {
  const mysql = require('mysql2/promise');
  const cfg = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
    user: process.env.DB_USER || process.env.MYSQLUSER || 'catamanager',
    password: process.env.DB_PASS || process.env.MYSQLPASSWORD || 'catamanager_local_2026',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'catamanager',
  };
  let conn;
  try {
    conn = await mysql.createConnection(cfg);
    const [tables] = await conn.query(
      'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name',
      [cfg.database]
    );
    let sql = `-- Backup automático de ${cfg.database} · ${new Date().toISOString()}\nSET FOREIGN_KEY_CHECKS=0;\n\n`;
    for (const { name } of tables) {
      const [[createRow]] = await conn.query('SHOW CREATE TABLE `' + name + '`');
      sql += 'DROP TABLE IF EXISTS `' + name + '`;\n' + createRow['Create Table'] + ';\n\n';
      const [rows] = await conn.query('SELECT * FROM `' + name + '`');
      if (rows.length) {
        const cols = Object.keys(rows[0]);
        const colList = cols.map(c => '`' + c + '`').join(', ');
        const values = rows.map(r => '(' + cols.map(c => conn.escape(r[c])).join(', ') + ')').join(',\n');
        sql += 'INSERT INTO `' + name + '` (' + colList + ') VALUES\n' + values + ';\n\n';
      }
    }
    sql += 'SET FOREIGN_KEY_CHECKS=1;\n';
    const date = new Date().toISOString().slice(0, 10);
    const dest = path.join(backupsDir, `data-${date}.sql`);
    fs.writeFileSync(dest, sql);
    console.log(`Backup creado: ${dest} (${tables.length} tablas, ${(sql.length / 1024 / 1024).toFixed(1)} MB)`);
  } catch (e) {
    console.error('Error al crear backup:', e.message);
  } finally {
    if (conn) { try { await conn.end(); } catch (e) {} }
  }
}
setTimeout(() => { hacerBackup().catch(e => console.error('Error al crear backup:', e.message)); }, 1000 * 60 * 5); // 5 min tras iniciar
setInterval(() => { hacerBackup().catch(e => console.error('Error al crear backup:', e.message)); }, 1000 * 60 * 60 * 24); // luego cada 24h

// ================= RATE LIMIT DE LOGIN (anti fuerza bruta) =================
const loginAttempts = new Map();
function loginRateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { fails: 0, until: 0 };
  if (now < rec.until) {
    const mins = Math.ceil((rec.until - now) / 60000);
    const biz = getBusiness(req.params.slug);
    return res.render('login', { biz, error: `Demasiados intentos. Intenta en ${mins} min.`, ok: null, pal: biz ? getPalette(biz, getEffectiveEstilo(biz)) : null });
  }
  req._rl = { rec, ip, now };
  res.on('finish', () => {
    if (res.statusCode === 302) { loginAttempts.delete(req._rl.ip); return; } // login exitoso
    if (res.statusCode === 200) { // fallo (re-render del login)
      const r = loginAttempts.get(req._rl.ip) || { fails: 0, until: 0 };
      r.fails = (r.fails || 0) + 1;
      if (r.fails >= 5) { r.fails = 0; r.until = Date.now() + 5 * 60000; }
      loginAttempts.set(req._rl.ip, r);
    }
  });
  next();
}

app.post('/:slug/admin/upload', requireAuth, receiveImageUpload, verifyBodyCsrf, async (req, res) => {
  if (!req.file) return res.status(415).json({ error: 'Formato de imagen no compatible. Usa JPG, PNG, GIF o WebP.' });
  await compressUploadedImage(req.file.path, { trim: req.query.trim === '1' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// Subida de video desde el constructor (owner)
app.post('/:slug/admin/uploadvideo', requireAuth, uploadVideo.single('video'), verifyBodyCsrf, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Video no válido' });
  await compressUploadedVideo(req.file.path);
  res.json({ url: '/uploads/' + req.file.filename });
});

// Subida de video desde el maestro
app.post('/maestro/:id/uploadvideo', maestroAuth, uploadVideo.single('video'), verifyBodyCsrf, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Video no válido' });
  await compressUploadedVideo(req.file.path);
  res.json({ url: '/uploads/' + req.file.filename });
});

// Subida de logo/banner desde el editor de diseño del maestro
app.post('/maestro/:id/upload', maestroAuth, receiveImageUpload, verifyBodyCsrf, async (req, res) => {
  if (!req.file) return res.status(415).json({ error: 'Formato de imagen no compatible. Usa JPG, PNG, GIF o WebP.' });
  await compressUploadedImage(req.file.path, { trim: req.query.trim === '1' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// Subida de audio/archivos desde el constructor (owner)
app.post('/:slug/admin/uploadfile', requireAuth, uploadFile.single('archivo'), verifyBodyCsrf, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo no válido' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// Subida de audio/archivos desde el maestro
app.post('/maestro/:id/uploadfile', maestroAuth, uploadFile.single('archivo'), verifyBodyCsrf, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo no válido' });
  res.json({ url: '/uploads/' + req.file.filename });
});

const TEMPLATES = ['fotografia'];

const DEFAULT_THEME = {
  id: 'constructor', nombre: 'Constructor', emoji: '🧩',
  dark: false, caso: 'tienda',
  accent: '#2563eb', accent2: '#1d4ed8', bg: '#ffffff', text: '#1e293b',
  muted: '#94a3b8', card: '#f8fafc', border: '#e2e8f0',
  font: 'inter', radius: '12px', style: 'moderno',
  fontLink: 'Inter:wght@400;500;600;700;800',
  bodyFont: "'Inter', sans-serif",
  headFont: "'Inter', sans-serif",
  css: '', dept: null, figuras: [], departments: []
};
function getTemplateTheme(tpl) {
  return TPL_THEMES[tpl] || DEFAULT_THEME;
}

// Colores con degradado (c1 = inicio, c2 = fin)
const COLORS = [
  { id: 'azul', nombre: 'Azul', c1: '#2563eb', c2: '#0ea5e9' },
  { id: 'esmeralda', nombre: 'Esmeralda', c1: '#059669', c2: '#10b981' },
  { id: 'violeta', nombre: 'Violeta', c1: '#7c3aed', c2: '#a855f7' },
  { id: 'rosa', nombre: 'Rosa', c1: '#e11d48', c2: '#f43f5e' },
  { id: 'ambar', nombre: 'Ámbar', c1: '#d97706', c2: '#f59e0b' },
  { id: 'atardecer', nombre: 'Atardecer', c1: '#f59e0b', c2: '#ef4444' },
  { id: 'mar', nombre: 'Mar', c1: '#0ea5e9', c2: '#22d3ee' },
  { id: 'tropical', nombre: 'Tropical', c1: '#10b981', c2: '#14b8a6' },
  { id: 'neon', nombre: 'Neón', c1: '#22d3ee', c2: '#a855f7' },
  { id: 'dulce', nombre: 'Dulce', c1: '#ec4899', c2: '#8b5cf6' },
  { id: 'oro', nombre: 'Oro', c1: '#d4af37', c2: '#b45309' },
  { id: 'noche', nombre: 'Noche', c1: '#6366f1', c2: '#3b82f6' },
  { id: 'fuego', nombre: 'Fuego', c1: '#ef4444', c2: '#f97316' },
  { id: 'bosque', nombre: 'Bosque', c1: '#15803d', c2: '#65a30d' },
  { id: 'vino', nombre: 'Vino', c1: '#9f1239', c2: '#7c3aed' }
];

function getColor(id) {
  return COLORS.find(c => c.id === id) || COLORS[0];
}

const ESTILOS = [
  {
    id: 'moderno', nombre: 'Moderno', emoji: '🎯',
    font: "'Inter', sans-serif", fontLink: 'Inter:wght@400;500;600;700;800;900',
    bg: '#f1f5f9', text: '#0f172a', muted: '#64748b',
    card: '#ffffff', border: '#e2e8f0', radius: '16px',
    accent: '#2563eb', accent2: '#0ea5e9',
    header: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    headerText: '#ffffff', dark: false
  },
  {
    id: 'elegancia', nombre: 'Elegancia', emoji: '💎',
    font: "'Playfair Display', 'Georgia', serif", fontLink: 'Playfair+Display:wght@500;600;700;800&family=Inter:wght@400;500',
    bg: '#0b0b0d', text: '#f5f0e8', muted: '#9b9386',
    card: '#15151a', border: '#26262e', radius: '14px',
    accent: '#d4af37', accent2: '#a16207',
    header: 'linear-gradient(160deg, #101014, #1c1c24)',
    headerText: '#f5f0e8', dark: true
  },
  {
    id: 'cafe', nombre: 'Café', emoji: '☕',
    font: "'Poppins', sans-serif", fontLink: 'Poppins:wght@400;500;600;700;800',
    bg: '#f7f1e5', text: '#3d2c1c', muted: '#8a7358',
    card: '#fffdf8', border: '#eadfc8', radius: '20px',
    accent: '#a16207', accent2: '#b45309',
    header: 'linear-gradient(135deg, #4a3222, #6b4a30)',
    headerText: '#fdf6e9', dark: false
  },
  {
    id: 'viaje', nombre: 'Aventura / Viajes', emoji: '✈️',
    font: "'Quicksand', sans-serif", fontLink: 'Quicksand:wght@400;500;600;700',
    bg: '#eef6f6', text: '#0e2b33', muted: '#5c7a80',
    card: '#ffffff', border: '#cfe5e5', radius: '18px',
    accent: '#0891b2', accent2: '#0d9488',
    header: 'linear-gradient(135deg, #065f73, #0d9488)',
    headerText: '#ffffff', dark: false
  },
  {
    id: 'fresco', nombre: 'Fresco', emoji: '🎨',
    font: "'Poppins', sans-serif", fontLink: 'Poppins:wght@400;500;600;700;800',
    bg: '#fdf2f8', text: '#4a044e', muted: '#a21caf',
    card: '#ffffff', border: '#f0abfc', radius: '22px',
    accent: '#c026d3', accent2: '#7c3aed',
    header: 'linear-gradient(120deg, #d946ef, #7c3aed)',
    headerText: '#ffffff', dark: false
  },
  {
    id: 'lujo', nombre: 'Lujo', emoji: '🖤',
    font: "'Cormorant Garamond', 'Georgia', serif", fontLink: 'Cormorant+Garamond:wght@500;600;700&family=Inter:wght@300;400',
    bg: '#050505', text: '#e8e6e1', muted: '#6f6d68',
    card: '#101010', border: '#1f1f1f', radius: '10px',
    accent: '#c9a24b', accent2: '#8a6d3b',
    header: 'radial-gradient(ellipse at top, #1a1a1a, #050505)',
    headerText: '#e8e6e1', dark: true
  },
  {
    id: 'boho', nombre: 'Boho / Natural', emoji: '🌿',
    font: "'Lora', 'Georgia', serif", fontLink: 'Lora:wght@400;500;600;700&family=Inter:wght@400;500',
    bg: '#f5f0e8', text: '#3f3a33', muted: '#8a8070',
    card: '#fbf7ef', border: '#e5dac4', radius: '12px',
    accent: '#7f5539', accent2: '#a47551',
    header: 'linear-gradient(160deg, #7f5539, #a47551)',
    headerText: '#fbf7ef', dark: false
  },
  {
    id: 'tech', nombre: 'Tech / Gaming', emoji: '⚡',
    font: "'Space Grotesk', sans-serif", fontLink: 'Space+Grotesk:wght@400;500;600;700',
    bg: '#0a0f1e', text: '#e2e8f0', muted: '#64748b',
    card: '#111a30', border: '#1e2a47', radius: '16px',
    accent: '#22d3ee', accent2: '#a855f7',
    header: 'linear-gradient(135deg, #0a0f1e, #1e2a47)',
    headerText: '#e2e8f0', dark: true
  },
  {
    id: 'playa', nombre: 'Playa / Verano', emoji: '🏖️',
    font: "'Poppins', sans-serif", fontLink: 'Poppins:wght@400;500;600;700',
    bg: '#f0f9ff', text: '#0c4a6e', muted: '#38bdf8',
    card: '#ffffff', border: '#bae6fd', radius: '20px',
    accent: '#0ea5e9', accent2: '#22d3ee',
    header: 'linear-gradient(135deg, #0ea5e9, #22d3ee)',
    headerText: '#ffffff', dark: false
  },
  {
    id: 'dulce', nombre: 'Dulce / Pastel', emoji: '🍬',
    font: "'Poppins', sans-serif", fontLink: 'Poppins:wght@400;500;600;700;800',
    bg: '#fdf4ff', text: '#701a75', muted: '#c026d3',
    card: '#ffffff', border: '#f5d0fe', radius: '24px',
    accent: '#d946ef', accent2: '#ec4899',
    header: 'linear-gradient(120deg, #d946ef, #ec4899)',
    headerText: '#ffffff', dark: false
  },
  {
    id: 'retro', nombre: 'Retro', emoji: '📻',
    font: "'Caveat', cursive", fontLink: 'Caveat:wght@500;600;700&family=Inter:wght@400;500',
    bg: '#fdf6e3', text: '#57493a', muted: '#a08c6e',
    card: '#fffdf5', border: '#eadfc0', radius: '14px',
    accent: '#e8590c', accent2: '#f59f00',
    header: 'linear-gradient(135deg, #e8590c, #f59f00)',
    headerText: '#ffffff', dark: false
  },
  {
    id: 'nocturno', nombre: 'Nocturno', emoji: '🌙',
    font: "'Montserrat', sans-serif", fontLink: 'Montserrat:wght@400;500;600;700;800',
    bg: '#0f172a', text: '#e2e8f0', muted: '#64748b',
    card: '#1e293b', border: '#334155', radius: '16px',
    accent: '#6366f1', accent2: '#818cf8',
    header: 'linear-gradient(135deg, #1e293b, #0f172a)',
    headerText: '#e2e8f0', dark: true
  },
  {
    id: 'tropical', nombre: 'Tropical', emoji: '🌴',
    font: "'Quicksand', sans-serif", fontLink: 'Quicksand:wght@400;500;600;700',
    bg: '#ecfdf5', text: '#064e3b', muted: '#34d399',
    card: '#ffffff', border: '#a7f3d0', radius: '20px',
    accent: '#10b981', accent2: '#14b8a6',
    header: 'linear-gradient(135deg, #059669, #14b8a6)',
    headerText: '#ffffff', dark: false
  },
  {
    id: 'vintage', nombre: 'Vintage / Joyería', emoji: '💍',
    font: "'Cinzel', 'Georgia', serif", fontLink: 'Cinzel:wght@500;600;700&family=Inter:wght@300;400',
    bg: '#faf6ee', text: '#29221a', muted: '#8a7a63',
    card: '#fffdf8', border: '#e8ddc8', radius: '10px',
    accent: '#b45309', accent2: '#d4af37',
    header: 'linear-gradient(135deg, #3d2c1c, #7c5c3a)',
    headerText: '#f5efe0', dark: false
  }
];

function getEstilo(id) {
  return ESTILOS.find(e => e.id === id) || ESTILOS[0];
}

// Fuentes disponibles para el selector "Fuente" del panel de diseño
const FONTS = [
  { id: 'inter', nombre: 'Inter', css: "'Inter', sans-serif", link: 'Inter:wght@400;500;600;700;800' },
  { id: 'poppins', nombre: 'Poppins', css: "'Poppins', sans-serif", link: 'Poppins:wght@400;500;600;700;800' },
  { id: 'quicksand', nombre: 'Quicksand', css: "'Quicksand', sans-serif", link: 'Quicksand:wght@400;500;600;700' },
  { id: 'montserrat', nombre: 'Montserrat', css: "'Montserrat', sans-serif", link: 'Montserrat:wght@400;500;600;700;800' },
  { id: 'playfair', nombre: 'Playfair Display', css: "'Playfair Display', 'Georgia', serif", link: 'Playfair+Display:wght@500;600;700&family=Inter:wght@400;500' },
  { id: 'lora', nombre: 'Lora', css: "'Lora', 'Georgia', serif", link: 'Lora:wght@400;500;600;700&family=Inter:wght@400;500' },
  { id: 'spacegrotesk', nombre: 'Space Grotesk', css: "'Space Grotesk', sans-serif", link: 'Space+Grotesk:wght@400;500;600;700' },
  { id: 'caveat', nombre: 'Caveat', css: "'Caveat', cursive", link: 'Caveat:wght@500;600;700&family=Inter:wght@400;500' },
  { id: 'cinzel', nombre: 'Cinzel', css: "'Cinzel', 'Georgia', serif", link: 'Cinzel:wght@500;600;700&family=Inter:wght@300;400' },
  { id: 'cormorant', nombre: 'Cormorant Garamond', css: "'Cormorant Garamond', 'Georgia', serif", link: 'Cormorant+Garamond:wght@500;600;700&family=Inter:wght@300;400' }
];

// Estilo visual efectivo = preset elegido + ajustes finos del negocio (si hay)
function getEffectiveEstilo(biz) {
  const base = getEstilo(biz.estilo);
  const pick = (v, d) => (v && v.trim() ? v : d);
  const font = pick(biz.font, base.font);
  return {
    ...base,
    bg: pick(biz.bg, base.bg),
    card: pick(biz.card, base.card),
    text: pick(biz.text, base.text),
    muted: pick(biz.muted, base.muted),
    border: pick(biz.border, base.border),
    radius: pick(biz.radius, base.radius),
    header: pick(biz.header, base.header),
    headerText: pick(biz.header_text, base.headerText),
    headerSet: !!(biz.header && biz.header.trim()),
    font,
    fontLink: (FONTS.find(f => f.css === font) || {}).link || base.fontLink
  };
}

// Paleta efectiva del catálogo según el modo de color configurado
function getPalette(biz, estilo) {
  const mode = biz.color_mode || 'degradado';
  const e = estilo || getEstilo(biz.estilo);
  let accent = e.accent, accent2 = e.accent2;
  // Override directo de "Color de botones" (ajuste fino): gana sobre todo lo demás
  if (biz.accent && biz.accent.trim()) { accent = biz.accent.trim(); accent2 = (biz.accent2 && biz.accent2.trim()) ? biz.accent2.trim() : accent; }
  else if (mode === 'solido') { accent = biz.color_hex || e.accent; accent2 = accent; }
  else if (mode === 'degradado') { accent = biz.color_hex || e.accent; accent2 = biz.color_hex2 || accent; }
  return { accent, accent2, mode };
}

// Colores de acento que usa cada plantilla (para reemplazarlos por la paleta del negocio)
const TPL_ACCENTS = {
  portada: { a: '#4f46e5', b: '#4338ca', chip: '#1a1a1a' },
  clasica: { a: '#4f46e5', b: '#4338ca', chip: '#1a1a1a' },
  juvenil: { a: '#4f46e5', b: '#4338ca', chip: '#1a1a1a' },
  barrio: { a: '#4f46e5', b: '#4338ca', chip: '#1a1a1a' },
  galeria: { a: '#4f46e5', b: '#4338ca', chip: '#1a1a1a' },
  premium: { a: '#4f46e5', b: '#4338ca', chip: '#1a1a1a' },
  revista: { a: '#4f46e5', b: '#4338ca', chip: '#1a1a1a' },
  minimal: { a: '#1a1a1a', b: '#1a1a1a', chip: null },
  ofertas: { a: '#ef4444', b: '#dc2626', chip: '#1a1a1a' },
  restaurante: { a: '#ea580c', b: '#c2410c', chip: '#1a1a1a' }
};

// Íconos de pestaña y de pantalla de inicio: el logo de la tienda (si lo tiene) en vez del de la plataforma
function brandIconLinks(biz) {
  if (biz) {
    const v = brandVersion(biz);
    return '<link rel="icon" type="image/png" href="/' + biz.slug + '/icon/192.png?v=' + v + '">' +
      '<link rel="apple-touch-icon" href="/' + biz.slug + '/icon/180.png?v=' + v + '">';
  }
  return '<link rel="icon" type="image/png" href="/icons/icon-192.png"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">';
}
function paintCatalog(html, biz, pal, estilo) {
  const t = TPL_ACCENTS[biz.template] || TPL_ACCENTS.portada;
  const e = estilo || getEstilo('moderno');
  const rep = (from, to) => { if (from && to && from.toLowerCase() !== to.toLowerCase()) html = html.replace(new RegExp(from.replace('#', '\\#'), 'gi'), to); };
  rep(t.a, pal.accent);
  rep(t.b, pal.accent2);
  rep(t.chip, pal.accent);
  // Acentos utilitarios de Tailwind para que la paleta se refleje también en textos
  // + superficies del estilo visual (fondo, tarjetas, chips, buscador, texto)
  const hdr = String(e.header || '').replace(/var\(--accent2\)/g, pal.accent2).replace(/var\(--accent\)/g, pal.accent);
  const styleOverride =
    '<style>' +
    // Acentos de texto utilitarios para que la paleta se refleje en toda la tienda
    '.text-indigo-500,.text-indigo-600,.text-indigo-700,.text-indigo-400,.text-indigo-300{color:' + pal.accent + '!important}' +
    '.text-red-500,.text-red-600,.text-red-400{color:' + pal.accent + '!important}' +
    '.text-orange-600,.text-orange-400{color:' + pal.accent + '!important}' +
    '.chip-active{background:' + pal.accent + '!important;border-color:' + pal.accent + '!important;color:#fff!important}' +
    '.btn-primary,.btn-primary:hover,.btn-primary:active,.btn-order,.btn-order:hover,.btn-order:active,.btn-add,.btn-add:hover,.btn-add:active{background:' + pal.accent + '!important}' +
    '.badge-offer{background:' + pal.accent + '!important}' +
    '.search-input:focus{border-color:' + pal.accent + '!important;box-shadow:0 0 0 4px ' + pal.accent + '26!important}' +
    'body{font-family:' + (e.font || "'Inter', sans-serif") + ' !important;background:' + e.bg + '!important;color:' + e.text + '!important}' +
    pageBgCss(biz.page_bg) +
    '.product-card,.glass-card{background:' + e.card + '!important;border-color:' + e.border + '!important;border-radius:' + e.radius + '!important}' +
    '.chip-idle{background:' + e.card + '!important;border-color:' + e.border + '!important;color:' + e.text + '!important}' +
    '.search-input{background:' + e.card + '!important;border-color:' + e.border + '!important}' +
    '.footer-muted{color:' + e.muted + '!important}' +
    // Cabecera (arriba): fondo del estilo, título en el color de la cabecera
    '.header-gradient{background:' + hdr + '!important}' +
    '.cat-title{color:' + e.headerText + '!important}' +
    '.header-gradient .hero-content{color:' + e.headerText + '!important}' +
    '.header-gradient .btn-primary,.header-gradient .btn-wa,.header-gradient .btn-order,.header-gradient .btn-add{color:#fff!important}' +
    (e.headerSet ? '.header-gradient.hero-banner::after,.header-gradient.hero-restaurant::after{background:' + hdr + '!important}' : '') +
    // ===== Sistema de diseño moderno (consistente entre plantillas) =====
    '.product-card,.glass-card,.menu-item,.offer-card,.product-row,.product-hero{border-radius:16px!important;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)!important;transition:transform .2s ease,box-shadow .2s ease!important}' +
    '.product-card:hover,.glass-card:hover,.menu-item:hover,.offer-card:hover,.product-row:hover{transform:translateY(-4px)!important;box-shadow:0 14px 34px rgba(0,0,0,.12)!important}' +
    '.product-card,.glass-card,.offer-card,.product-hero{display:flex!important;flex-direction:column!important}' +
    '.product-card h3,.glass-card h3,.offer-card h3,.product-hero h3{font-weight:700!important;line-height:1.3!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.6em}' +
    '.btn-primary,.btn-add,.btn-order,.btn-wa{border-radius:11px!important;font-weight:600!important}' +
    '.badge-offer{border-radius:999px!important;padding:.22rem .6rem!important;font-weight:800!important}' +
    '.line-through{color:#9ca3af!important;font-size:.75em!important;font-weight:500!important}' +
    '.header-gradient{box-shadow:0 1px 0 rgba(0,0,0,.04)!important}' +
    // ===== Reglas de UX: toque mínimo, foco accesible, jerarquía, micro-interacciones =====
    '.btn-primary,.btn-add,.btn-order,.btn-wa{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:40px!important}' +
    '@media(max-width:640px){.btn-primary,.btn-add,.btn-order,.btn-wa{min-height:44px!important}}' +
    'button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid ' + pal.accent + '!important;outline-offset:2px!important}' +
    '.product-card h3,.glass-card h3,.offer-card h3,.product-hero h3{font-size:15px!important}' +
    'a,button,img{transition:opacity .15s ease,transform .15s ease,background-color .15s ease,box-shadow .15s ease,color .15s ease!important}' +
    'button:active{transform:scale(.97)!important}' +
    '.cat-chip,.search-input{border-radius:10px!important}' +
    // ===== Móvil: badges y botones que no se pisen ni se salgan =====
    '@media(max-width:640px){' +
      '.badge-offer{font-size:.55rem!important;padding:.12rem .45rem!important;line-height:1.25!important;max-width:calc(50% - 8px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.product-card .absolute.top-2.left-2,.product-card .absolute.top-3.left-2,.offer-card .absolute.top-2.left-2,.product-ad-badge{font-size:.55rem!important;padding:.12rem .45rem!important;line-height:1.25!important;max-width:calc(50% - 8px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.product-card .badge-offer{top:.4rem!important;right:.4rem!important}' +
    '}' +
    MASCARA_CSS.replace(/\n\s*/g,'').replace(/<\/?style>/g,'') +
    '</style>';
  // Metadatos PWA + viewport nativo (instalable como app)
  html = html.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=5.0" />');
  const bizName = String(biz.name || 'Catálogo').replace(/"/g, '&quot;');
  const pwaHead =
    '<meta name="theme-color" content="' + pal.accent + '">' +
    '<meta name="mobile-web-app-capable" content="yes">' +
    '<meta name="apple-mobile-web-app-capable" content="yes">' +
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">' +
    '<meta name="apple-mobile-web-app-title" content="' + bizName + '">' +
    '<link rel="manifest" href="/' + biz.slug + '/manifest.webmanifest">' +
    brandIconLinks(biz);
  if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, pwaHead + '</head>');
  else html += pwaHead;

  // Carga la fuente del estilo si no está ya en el HTML
  if (e.fontLink) {
    const fontLink = '<link href="https://fonts.googleapis.com/css2?family=' + e.fontLink + '&display=swap" rel="stylesheet">';
    if (!html.includes(fontLink)) {
      if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, fontLink + '</head>');
      else html += fontLink;
    }
  }
  const pwaTail =
    '<script src="/pwa.js?v=20260919"></script>' +
    '<style>' +
    'html{-webkit-tap-highlight-color:transparent}' +
    'body{overscroll-behavior-y:none;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}' +
    'html.is-standalone{padding-top:env(safe-area-inset-top)}' +
    'html.is-standalone body{padding-bottom:env(safe-area-inset-bottom)}' +
    'a,button,img{-webkit-touch-callout:none}' +
    '</style>';
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, styleOverride + pwaTail + '</body>');
  else html += styleOverride + pwaTail;

  // Secciones: ocultar las desactivadas, reordenar las de nivel superior, modo de categorías y densidad
  const sec = sectionsOf(biz);
  const secHide = (!sec.hero ? '[data-sec="hero"]{display:none!important}' : '') +
                  (sec.categorias === false ? '[data-sec="categorias"]{display:none!important}' : '');
  const densityCss = sec.density === 'compacta' ? '.prod-grid{gap:.5rem!important}'
    : sec.density === 'espaciosa' ? '.prod-grid{gap:2rem!important}'
    : '';
  const CARDS = '.product-card,.glass-card,.menu-item,.offer-card,.product-row';
  const shadowCss = sec.shadow === 'none' ? CARDS + '{box-shadow:none!important}'
    : sec.shadow === 'suave' ? CARDS + '{box-shadow:0 1px 3px rgba(0,0,0,.06)!important}'
    : sec.shadow === 'fuerte' ? CARDS + '{box-shadow:0 12px 32px rgba(0,0,0,.16)!important}'
    : '';
  const hoverCss = sec.hover === 'none' ? CARDS + ':hover{transform:none!important;box-shadow:inherit!important}' + CARDS + ' img{transition:none!important}'
    : sec.hover === 'scale' ? CARDS + ':hover{transform:scale(1.02)!important}'
    : sec.hover === 'zoom' ? CARDS + ' img{transition:transform .35s ease!important}' + CARDS + ':hover img{transform:scale(1.08)!important}'
    : sec.hover === 'glow' ? CARDS + '{transition:box-shadow .25s ease!important}' + CARDS + ':hover{box-shadow:0 0 0 3px ' + pal.accent + '40,0 12px 32px rgba(0,0,0,.12)!important}'
    : CARDS + '{transition:transform .2s ease,box-shadow .2s ease!important}' + CARDS + ':hover{transform:translateY(-4px)!important;box-shadow:0 12px 32px rgba(0,0,0,.12)!important}';
  const catTopCss = sec.catmode === 'top'
    ? '.catalog-sidebar{width:100%!important;margin-bottom:1rem!important}' +
      '.catalog-sidebar>div{position:static!important;max-height:none!important;overflow:visible!important}' +
      '.catalog-sidebar .catalog-cats{flex-direction:row!important;overflow-x:auto!important}' +
      '.catalog-sidebar [id="variant-filters"]{display:none!important}' +
      '.catalog-sidebar .relative.mb-4{max-width:32rem}'
    : '';
  const heroCompactCss = sec.hero_mode === 'compacto'
    ? '.hero-banner,.hero-restaurant{padding:1.25rem 1rem!important;min-height:0!important}' +
      '.hero-banner>img,.hero-restaurant>img{display:none!important}' +
      '.hero-content h1,.hero-banner h1,.hero-restaurant h1{font-size:1.5rem!important}' +
      '.hero-content p{display:none!important}' +
      '.hero-content .btn-wa{padding:.45rem 1rem!important;font-size:.78rem!important}'
    : '';
  const catTopJs = sec.catmode === 'top'
    ? ';try{var a=document.querySelector(".catalog-sidebar");var m=document.querySelector("main[data-sec=contenido]");if(a&&m&&a.parentNode!==m){m.insertBefore(a,m.firstChild);}}catch(e){}'
    : '';
  const secInj =
    ((secHide || densityCss || catTopCss || heroCompactCss || shadowCss || hoverCss) ? '<style>' + secHide + densityCss + catTopCss + heroCompactCss + shadowCss + hoverCss + '</style>' : '') +
    '<script>window.__SEC_ORDEN__=' + JSON.stringify(sec.orden) + ';' +
    '(function(){try{var o=window.__SEC_ORDEN__||[];var b=document.body;var map={};' +
    '[].slice.call(b.children).forEach(function(n){var s=n.getAttribute&&n.getAttribute("data-sec");if(s){map[s]=n;}});' +
    'o.forEach(function(id){if(map[id])b.appendChild(map[id]);});}catch(e){}})' +
    catTopJs + '</script>';
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, secInj + '</body>');
  else html += secInj;
  return html;
}

// Acabado ligero para las plantillas del constructor: no re-pinta componentes (la plantilla
// ya trae su CSS). Solo añade viewport nativo, PWA y asegura la fuente del tema.
function paintTheme(html, biz, pal, theme) {
  html = html.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=5.0" />');
  const bizName = String(biz.name || 'Catálogo').replace(/"/g, '&quot;');
  const pwaHead =
    '<meta name="theme-color" content="' + (theme.accent || pal.accent) + '">' +
    '<meta name="mobile-web-app-capable" content="yes">' +
    '<meta name="apple-mobile-web-app-capable" content="yes">' +
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">' +
    '<meta name="apple-mobile-web-app-title" content="' + bizName + '">' +
    '<link rel="manifest" href="/' + biz.slug + '/manifest.webmanifest">' +
    brandIconLinks(biz) +
    '<style>' + pageBgCss(biz.page_bg) + '</style>';
  if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, pwaHead + '</head>');
  else html += pwaHead;
  const pwaTail =
    '<script src="/pwa.js?v=20260919"></script>' +
    '<style>html{-webkit-tap-highlight-color:transparent}body{overscroll-behavior-y:none;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}html.is-standalone{padding-top:env(safe-area-inset-top)}html.is-standalone body{padding-bottom:env(safe-area-inset-bottom)}a,button,img{-webkit-touch-callout:none}</style>';
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, pwaTail + '</body>');
  else html += pwaTail;
  return html;
}

// Acabado del catálogo: si la tienda usa una plantilla del constructor, respeta su tema;
// si no, aplica el pintado clásico por paleta.
function finishCatalog(html, biz, pal, estilo) {
  try {
    const theme = getTemplateTheme(biz.template);
    if (theme) return paintTheme(html, biz, pal, theme);
    return paintCatalog(html, biz, pal, estilo);
  } catch (e) {
    console.error('finishCatalog error:', e.stack || e);
    return '<html><body>Error: ' + e.message + '</body></html>';
  }
}

const GIROS = [
  'abarrotes', 'frutas y verduras', 'carniceria', 'papeleria', 'ferreteria',
  'electronica', 'ropa', 'calzado', 'farmacia', 'belleza', 'restaurante',
  'taqueria', 'cafeteria', 'panaderia', 'tortilleria', 'floreria', 'mascotas',
  'deportes', 'jugueteria', 'electrodomesticos', 'muebles', 'viajes', 'fotografia'
];

// Catálogo de giros: los predefinidos + los que los usuarios han registrado (aparecen como autocompletado)
function getGiros() {
  const extra = db.prepare('SELECT name FROM giros WHERE name NOT IN (' + GIROS.map(() => '?').join(',') + ') ORDER BY used DESC, name').all(...GIROS).map(r => r.name);
  return GIROS.concat(extra);
}

// Presets por giro: al registrarse, la tienda recibe plantilla y estilo acordes a su negocio.
const GIRO_TEMPLATE = {
  cafeteria: 'restaurante', restaurante: 'restaurante', taqueria: 'restaurante', panaderia: 'restaurante', tortilleria: 'restaurante',
  ropa: 'galeria', calzado: 'galeria', belleza: 'galeria', floreria: 'galeria', mascotas: 'galeria',
  electronica: 'premium', electrodomesticos: 'premium', muebles: 'premium', deportes: 'premium', viajes: 'viaje', fotografia: 'fotografia',
  abarrotes: 'minimal', 'frutas y verduras': 'minimal', carniceria: 'minimal', farmacia: 'minimal',
  papeleria: 'clasica', ferreteria: 'clasica', jugueteria: 'juvenil'
};
const GIRO_STYLE = {
  cafeteria: 'cafe', restaurante: 'cafe', taqueria: 'cafe', panaderia: 'cafe', tortilleria: 'cafe',
  ropa: 'moderno', calzado: 'moderno', belleza: 'dulce', floreria: 'boho', mascotas: 'moderno',
  electronica: 'tech', electrodomesticos: 'tech', deportes: 'fresco', viajes: 'viaje', fotografia: 'lujo',
  muebles: 'elegancia', jugueteria: 'dulce', farmacia: 'moderno',
  abarrotes: 'moderno', 'frutas y verduras': 'boho', carniceria: 'moderno',
  papeleria: 'moderno', ferreteria: 'moderno'
};

// Contenido de ejemplo por giro (para que la tienda nueva no se vea vacía)
const GIRO_DEMO = {
  cafeteria: {
    cats: ['Bebidas calientes', 'Bebidas frías', 'Postres'],
    prods: [
      ['Café americano', 45, 1], ['Capuchino', 60, 1], ['Latte vainilla', 65, 1], ['Mocha', 68, 1],
      ['Frappé caramelo', 70, 2], ['Limonada de fresa', 55, 2],
      ['Brownie de chocolate', 55, 3], ['Cheesecake', 75, 3]
    ]
  },
  restaurante: {
    cats: ['Entradas', 'Platos fuertes', 'Bebidas'],
    prods: [
      ['Guacamole', 65, 1], ['Nachos', 85, 1],
      ['Enchiladas verdes', 120, 2], ['Tacos de pastor', 95, 2], ['Pozole', 110, 2],
      ['Agua de horchata', 30, 3], ['Limonada', 25, 3]
    ]
  },
  viajes: {
    cats: ['Tours', 'Experiencias', 'Paquetes'],
    prods: [
      ['Tour histórico', 450, 1], ['Tour de playa', 550, 1],
      ['Clase de cocina local', 700, 2], ['Aventura en tirolesa', 800, 2],
      ['Paquete fin de semana', 2500, 3], ['Paquete luna de miel', 6000, 3]
    ]
  },
  ropa: {
    cats: ['Hombre', 'Mujer', 'Accesorios'],
    prods: [
      ['Camisa casual', 350, 1], ['Jeans slim', 550, 1],
      ['Vestido floral', 450, 2], ['Blusa', 300, 2],
      ['Reloj', 800, 3], ['Bolso', 600, 3]
    ]
  },
  ferreteria: {
    cats: ['Herramientas', 'Pintura', 'Plomería'],
    prods: [
      ['Martillo 16oz', 189, 1], ['Desarmador set', 249, 1],
      ['Pintura vinílica 19L', 899, 2], ['Brocha 3"', 69, 2],
      ['Tubo PVC 6m', 149, 3], ['Llave de paso', 119, 3]
    ]
  }
};
const GIRO_DEMO_DEFAULT = {
  cats: ['Productos', 'Novedades', 'Destacados'],
  prods: [
    ['Producto ejemplo 1', 199, 1], ['Producto ejemplo 2', 149, 1],
    ['Producto ejemplo 3', 299, 2], ['Producto ejemplo 4', 99, 2],
    ['Producto ejemplo 5', 249, 3], ['Producto ejemplo 6', 349, 3]
  ]
};

// Catálogo de ejemplo para la vista previa (usa el contenido editado, o el del giro, o el genérico)
function demoCatalog(biz, demoOverride) {
  let d = null;
  try { d = JSON.parse(demoOverride || biz.demo || ''); } catch (e) {}
  if (d && Array.isArray(d.products) && d.products.length) {
    const catIdx = {};
    let c = 1;
    const products = d.products.map((p, i) => {
      const cat = (p.cat || 'General').toString();
      if (!catIdx[cat]) { catIdx[cat] = c++; }
      return { id: i + 1, category_id: catIdx[cat], name: p.name, price: parseFloat(p.price) || 0, old_price: null, category_name: cat, description: '', image: 'https://picsum.photos/seed/demo-' + biz.id + '-' + i + '/500', galeria: '[]', variants: '', featured: i === 0 ? 1 : 0, promo_badge: '', tags: '' };
    });
    const categories = Object.keys(catIdx).map((name) => ({ id: catIdx[name], name, sort: catIdx[name] }));
    return { categories, products, name: d.name || biz.name, description: d.description || biz.description };
  }
  const gd = GIRO_DEMO[biz.giro] || GIRO_DEMO_DEFAULT;
  const categories = gd.cats.map((name, i) => ({ id: i + 1, name, sort: i + 1 }));
  const products = gd.prods.map((p, i) => ({ id: i + 1, category_id: p[2], name: p[0], price: p[1], old_price: null, category_name: gd.cats[p[2] - 1], description: '', image: 'https://picsum.photos/seed/demo-' + biz.id + '-' + i + '/500', galeria: '[]', variants: '', featured: i === 0 ? 1 : 0, promo_badge: '', tags: '' }));
  return { categories, products, name: biz.name, description: biz.description };
}

// ================= PRESETS DE DISEÑO POR GIRO (Modo fácil) =================
const PAG_BASE = [
  { slug: 'sobre-nosotros', title: 'Sobre nosotros', type: 'sobre', icon: '🏠' },
  { slug: 'galeria', title: 'Galería', type: 'galeria', icon: '📷' },
  { slug: 'contacto', title: 'Contacto', type: 'contacto', icon: '📞' }
];
const PAG_MENU = [
  { slug: 'menu', title: 'Menú', type: 'menu', icon: '🍽️' },
  { slug: 'sobre-nosotros', title: 'Sobre nosotros', type: 'sobre', icon: '🏠' },
  { slug: 'contacto', title: 'Contacto', type: 'contacto', icon: '📞' }
];
const PAG_BLOG = [
  { slug: 'blog', title: 'Novedades', type: 'blog', icon: '📰' },
  { slug: 'galeria', title: 'Galería', type: 'galeria', icon: '📷' },
  { slug: 'contacto', title: 'Contacto', type: 'contacto', icon: '📞' }
];
const PAG_SERVICIOS = [
  { slug: 'servicios', title: 'Servicios', type: 'servicios', icon: '🧾' },
  { slug: 'galeria', title: 'Galería', type: 'galeria', icon: '📷' },
  { slug: 'contacto', title: 'Contacto', type: 'contacto', icon: '📞' }
];

const GIRO_PRESETS = [
  { id: 'restaurante', nombre: 'Restaurante', emoji: '🍽️', descripcion: 'Comida y platillos', template: 'restaurante', estilo: 'cafe', color: 'ambar', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_MENU },
  { id: 'taqueria', nombre: 'Taquería', emoji: '🌮', descripcion: 'Tacos y antojitos', template: 'restaurante', estilo: 'cafe', color: 'fuego', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_MENU },
  { id: 'cafeteria', nombre: 'Cafetería', emoji: '☕', descripcion: 'Café y postres', template: 'restaurante', estilo: 'cafe', color: 'ambar', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_MENU },
  { id: 'panaderia', nombre: 'Panadería', emoji: '🥐', descripcion: 'Pan y repostería', template: 'ofertas', estilo: 'cafe', color: 'oro', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'pizzeria', nombre: 'Pizzería', emoji: '🍕', descripcion: 'Pizzas y combos', template: 'restaurante', estilo: 'cafe', color: 'fuego', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_MENU },
  { id: 'hamburgueseria', nombre: 'Hamburguesería', emoji: '🍔', descripcion: 'Hamburguesas y combos', template: 'restaurante', estilo: 'cafe', color: 'fuego', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_MENU },
  { id: 'pescaderia', nombre: 'Pescadería / Mariscos', emoji: '🐟', descripcion: 'Pescados y mariscos frescos', template: 'minimal', estilo: 'fresco', color: 'mar', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'rosticeria', nombre: 'Rosticería', emoji: '🍗', descripcion: 'Pollo rostizado y guisados', template: 'ofertas', estilo: 'cafe', color: 'ambar', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_MENU },
  { id: 'heladeria', nombre: 'Heladería / Nevería', emoji: '🍦', descripcion: 'Helados y postres fríos', template: 'galeria', estilo: 'dulce', color: 'dulce', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'juguera', nombre: 'Jugos y licuados', emoji: '🥤', descripcion: 'Jugos, licuados y smoothies', template: 'minimal', estilo: 'fresco', color: 'tropical', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'dulceria', nombre: 'Dulcería', emoji: '🍬', descripcion: 'Dulces típicos y golosinas', template: 'galeria', estilo: 'dulce', color: 'dulce', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'cocinaeconomica', nombre: 'Cocina económica', emoji: '🍲', descripcion: 'Comida corrida y platillos caseros', template: 'minimal', estilo: 'moderno', color: 'ambar', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_MENU },
  { id: 'mariscos', nombre: 'Marisquería', emoji: '🦐', descripcion: 'Cocteles y platillos de mar', template: 'restaurante', estilo: 'fresco', color: 'mar', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_MENU },
  { id: 'pasteleria', nombre: 'Pastelería / Repostería', emoji: '🎂', descripcion: 'Pasteles y postres para ocasiones especiales', template: 'galeria', estilo: 'dulce', color: 'dulce', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'cerveceria', nombre: 'Cervecería / Six', emoji: '🍺', descripcion: 'Cervezas y bebidas para llevar', template: 'minimal', estilo: 'moderno', color: 'ambar', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'foodtruck', nombre: 'Food truck', emoji: '🚚', descripcion: 'Comida rápida sobre ruedas', template: 'ofertas', estilo: 'moderno', color: 'fuego', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_MENU },
  { id: 'banquetes', nombre: 'Banquetes y catering', emoji: '🍱', descripcion: 'Servicio de comida para eventos', template: 'premium', estilo: 'elegancia', color: 'vino', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'abarrotes', nombre: 'Abarrotes', emoji: '🛒', descripcion: 'Tiendita de la esquina', template: 'minimal', estilo: 'moderno', color: 'esmeralda', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'fruteria', nombre: 'Frutas y verduras', emoji: '🍎', descripcion: 'Fresco y natural', template: 'ofertas', estilo: 'boho', color: 'bosque', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'carniceria', nombre: 'Carnicería', emoji: '🥩', descripcion: 'Cortes y carnes', template: 'clasica', estilo: 'moderno', color: 'fuego', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'tortilleria', nombre: 'Tortillería', emoji: '🌽', descripcion: 'Tortillas y masa', template: 'minimal', estilo: 'moderno', color: 'ambar', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'hogar', nombre: 'Hogar y limpieza', emoji: '🧺', descripcion: 'Productos para casa', template: 'ofertas', estilo: 'moderno', color: 'mar', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'naturista', nombre: 'Tienda naturista', emoji: '🌿', descripcion: 'Suplementos y productos naturales', template: 'minimal', estilo: 'boho', color: 'bosque', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'colchones', nombre: 'Tienda de colchones', emoji: '🛏️', descripcion: 'Colchones y bases', template: 'premium', estilo: 'elegancia', color: 'noche', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'cortinas', nombre: 'Cortinas y decoración', emoji: '🪟', descripcion: 'Cortinas, persianas y textiles para casa', template: 'premium', estilo: 'elegancia', color: 'oro', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'piniateria', nombre: 'Piñatería y fiestas', emoji: '🎉', descripcion: 'Piñatas y artículos de fiesta', template: 'galeria', estilo: 'dulce', color: 'dulce', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'regalos', nombre: 'Tienda de regalos', emoji: '🎁', descripcion: 'Regalos y detalles para toda ocasión', template: 'galeria', estilo: 'dulce', color: 'rosa', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'bazar', nombre: 'Bazar / Tienda departamental', emoji: '🏬', descripcion: 'De todo un poco para el hogar', template: 'clasica', estilo: 'moderno', color: 'azul', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'ropa', nombre: 'Ropa / Boutique', emoji: '👗', descripcion: 'Moda y tendencias', template: 'galeria', estilo: 'moderno', color: 'rosa', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'calzado', nombre: 'Calzado', emoji: '👟', descripcion: 'Zapatos y tenis', template: 'galeria', estilo: 'moderno', color: 'violeta', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'ropabebe', nombre: 'Ropa de bebé y maternidad', emoji: '🍼', descripcion: 'Ropa y artículos para bebés', template: 'galeria', estilo: 'dulce', color: 'dulce', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'ropausada', nombre: 'Ropa de segunda / bazar de ropa', emoji: '👚', descripcion: 'Ropa seminueva a buen precio', template: 'minimal', estilo: 'boho', color: 'esmeralda', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'perfumeria', nombre: 'Perfumería', emoji: '🌸', descripcion: 'Perfumes y esencias', template: 'premium', estilo: 'lujo', color: 'violeta', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'joyeria', nombre: 'Joyería', emoji: '💍', descripcion: 'Joyas y relojes', template: 'premium', estilo: 'vintage', color: 'oro', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'optica', nombre: 'Óptica', emoji: '👓', descripcion: 'Lentes y exámenes', template: 'minimal', estilo: 'moderno', color: 'azul', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'belleza', nombre: 'Belleza / Salón', emoji: '💅', descripcion: 'Estética y cuidado', template: 'galeria', estilo: 'dulce', color: 'dulce', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'barberia', nombre: 'Barbería', emoji: '💈', descripcion: 'Cortes y afeitado', template: 'barrio', estilo: 'retro', color: 'noche', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'spa', nombre: 'Spa y masajes', emoji: '🧖', descripcion: 'Relajación, masajes y tratamientos', template: 'premium', estilo: 'lujo', color: 'violeta', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'unias', nombre: 'Estética de uñas', emoji: '💅', descripcion: 'Manicure, pedicure y uñas acrílicas', template: 'galeria', estilo: 'dulce', color: 'rosa', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'tatuajes', nombre: 'Tatuajes y perforaciones', emoji: '🖋️', descripcion: 'Tatuajes, piercings y diseño', template: 'barrio', estilo: 'retro', color: 'noche', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'farmacia', nombre: 'Farmacia', emoji: '💊', descripcion: 'Salud y medicinas', template: 'minimal', estilo: 'moderno', color: 'mar', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'dental', nombre: 'Consultorio dental', emoji: '🦷', descripcion: 'Consultas y tratamientos dentales', template: 'minimal', estilo: 'fresco', color: 'mar', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'medico', nombre: 'Consultorio médico', emoji: '🩺', descripcion: 'Consultas médicas generales y especialidades', template: 'minimal', estilo: 'fresco', color: 'mar', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'veterinaria', nombre: 'Veterinaria', emoji: '🐾', descripcion: 'Consultas y salud para mascotas', template: 'clasica', estilo: 'fresco', color: 'esmeralda', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'fisioterapia', nombre: 'Fisioterapia y rehabilitación', emoji: '🦵', descripcion: 'Terapias y rehabilitación física', template: 'minimal', estilo: 'fresco', color: 'mar', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'nutricion', nombre: 'Nutrición', emoji: '🥗', descripcion: 'Consultas y planes de alimentación', template: 'minimal', estilo: 'fresco', color: 'bosque', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'mascotas', nombre: 'Mascotas', emoji: '🐾', descripcion: 'Alimento y accesorios', template: 'clasica', estilo: 'fresco', color: 'esmeralda', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'esteticacanina', nombre: 'Estética canina', emoji: '🐶', descripcion: 'Baño, corte y spa para mascotas', template: 'galeria', estilo: 'fresco', color: 'esmeralda', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'jugueteria', nombre: 'Juguetería', emoji: '🧸', descripcion: 'Juguetes y diversión', template: 'juvenil', estilo: 'dulce', color: 'dulce', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'guarderia', nombre: 'Guardería / Estancia infantil', emoji: '🧒', descripcion: 'Cuidado y actividades para niños', template: 'galeria', estilo: 'dulce', color: 'ambar', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'articulosbebe', nombre: 'Artículos para bebé', emoji: '🍼', descripcion: 'Carriolas, cunas y accesorios', template: 'galeria', estilo: 'dulce', color: 'dulce', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'deportes', nombre: 'Deportes', emoji: '⚽', descripcion: 'Equipamiento y ropa', template: 'premium', estilo: 'fresco', color: 'esmeralda', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'gimnasio', nombre: 'Gimnasio', emoji: '💪', descripcion: 'Fitness y membresías', template: 'premium', estilo: 'fresco', color: 'esmeralda', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'bicicletas', nombre: 'Bicicletas', emoji: '🚲', descripcion: 'Venta, renta y refacciones', template: 'clasica', estilo: 'fresco', color: 'esmeralda', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'instrumentos', nombre: 'Instrumentos musicales', emoji: '🎸', descripcion: 'Venta y renta de instrumentos', template: 'premium', estilo: 'vintage', color: 'vino', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'salonfiestas', nombre: 'Salón de fiestas', emoji: '🎊', descripcion: 'Renta de salón para eventos', template: 'premium', estilo: 'elegancia', color: 'vino', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'ferreteria', nombre: 'Ferretería', emoji: '🔧', descripcion: 'Herramientas y material', template: 'clasica', estilo: 'moderno', color: 'azul', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'materialesconstruccion', nombre: 'Materiales de construcción', emoji: '🧱', descripcion: 'Cemento, block y materiales', template: 'clasica', estilo: 'moderno', color: 'azul', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'pintura', nombre: 'Tienda de pinturas', emoji: '🎨', descripcion: 'Pinturas y recubrimientos', template: 'clasica', estilo: 'moderno', color: 'azul', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'vidrios', nombre: 'Vidrios y aluminio', emoji: '🪟', descripcion: 'Ventanas, cancelería y vidrio templado', template: 'clasica', estilo: 'tech', color: 'azul', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'pisos', nombre: 'Pisos y azulejos', emoji: '🧱', descripcion: 'Pisos, azulejos y recubrimientos', template: 'premium', estilo: 'elegancia', color: 'oro', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'electrodomesticos', nombre: 'Electrodomésticos', emoji: '🧊', descripcion: 'Línea blanca', template: 'premium', estilo: 'tech', color: 'noche', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'muebles', nombre: 'Muebles', emoji: '🛋️', descripcion: 'Hogar y decoración', template: 'premium', estilo: 'elegancia', color: 'oro', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'mueblesoficina', nombre: 'Muebles de oficina', emoji: '🪑', descripcion: 'Escritorios, sillas y mobiliario de oficina', template: 'premium', estilo: 'moderno', color: 'azul', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'jardineria', nombre: 'Jardinería y vivero', emoji: '🌳', descripcion: 'Plantas, vivero y servicio de jardín', template: 'minimal', estilo: 'boho', color: 'bosque', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'fumigacion', nombre: 'Fumigación y control de plagas', emoji: '🐜', descripcion: 'Servicio de control de plagas', template: 'minimal', estilo: 'tech', color: 'esmeralda', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'cerrajeria', nombre: 'Cerrajería', emoji: '🔑', descripcion: 'Llaves, cerraduras y apertura', template: 'clasica', estilo: 'tech', color: 'noche', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'electricista', nombre: 'Electricista', emoji: '💡', descripcion: 'Instalaciones y reparaciones eléctricas', template: 'minimal', estilo: 'tech', color: 'ambar', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'plomeria', nombre: 'Plomería', emoji: '🚿', descripcion: 'Instalación y reparación de tuberías', template: 'minimal', estilo: 'tech', color: 'mar', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'mudanzas', nombre: 'Mudanzas y fletes', emoji: '🚛', descripcion: 'Servicio de mudanzas y transporte de carga', template: 'minimal', estilo: 'moderno', color: 'azul', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'taller', nombre: 'Taller / Mecánica', emoji: '🔩', descripcion: 'Reparaciones y refacciones', template: 'clasica', estilo: 'tech', color: 'noche', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'refaccionaria', nombre: 'Refaccionaria automotriz', emoji: '🚗', descripcion: 'Refacciones y autopartes', template: 'clasica', estilo: 'tech', color: 'fuego', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'llantera', nombre: 'Llantera', emoji: '🛞', descripcion: 'Llantas y balanceo', template: 'clasica', estilo: 'tech', color: 'noche', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'motos', nombre: 'Motos y refacciones', emoji: '🏍️', descripcion: 'Venta y refacciones de motocicletas', template: 'clasica', estilo: 'tech', color: 'fuego', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'autolavado', nombre: 'Autolavado y detallado', emoji: '🧽', descripcion: 'Lavado, encerado y detallado automotriz', template: 'minimal', estilo: 'tech', color: 'mar', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'imprenta', nombre: 'Imprenta y copias', emoji: '🖨️', descripcion: 'Impresiones, copias y papelería comercial', template: 'clasica', estilo: 'moderno', color: 'azul', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'disenio', nombre: 'Diseño gráfico y publicidad', emoji: '🎨', descripcion: 'Diseño, branding y material publicitario', template: 'portada', estilo: 'tech', color: 'violeta', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'letreros', nombre: 'Letreros y rótulos', emoji: '🪧', descripcion: 'Letreros, lonas y señalización', template: 'clasica', estilo: 'tech', color: 'azul', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'fotografia', nombre: 'Fotografía', emoji: '📷', descripcion: 'Sesiones y portafolio', template: 'fotografia', estilo: 'lujo', color: 'noche', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'video', nombre: 'Video y producción', emoji: '🎬', descripcion: 'Producción de video y edición', template: 'portada', estilo: 'nocturno', color: 'violeta', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'contable', nombre: 'Asesoría contable y fiscal', emoji: '📊', descripcion: 'Contabilidad, impuestos y nómina', template: 'minimal', estilo: 'moderno', color: 'azul', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'seguros', nombre: 'Agencia de seguros', emoji: '🛡️', descripcion: 'Seguros de auto, vida y gastos médicos', template: 'minimal', estilo: 'moderno', color: 'azul', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'inmobiliaria', nombre: 'Bienes raíces / Inmobiliaria', emoji: '🏠', descripcion: 'Venta y renta de propiedades', template: 'premium', estilo: 'elegancia', color: 'oro', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'abogados', nombre: 'Despacho de abogados', emoji: '⚖️', descripcion: 'Asesoría y trámites legales', template: 'premium', estilo: 'elegancia', color: 'noche', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'clasesparticulares', nombre: 'Clases particulares y tutorías', emoji: '📚', descripcion: 'Tutorías y regularización académica', template: 'minimal', estilo: 'moderno', color: 'azul', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'academiaidiomas', nombre: 'Academia de idiomas', emoji: '🗣️', descripcion: 'Clases de inglés y otros idiomas', template: 'minimal', estilo: 'fresco', color: 'mar', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'escuelamanejo', nombre: 'Escuela de manejo', emoji: '🚦', descripcion: 'Clases de manejo y trámites de licencia', template: 'minimal', estilo: 'moderno', color: 'azul', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'papeleria', nombre: 'Papelería', emoji: '✏️', descripcion: 'Útiles y oficina', template: 'clasica', estilo: 'moderno', color: 'azul', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'libreria', nombre: 'Librería', emoji: '📚', descripcion: 'Libros y lectura', template: 'revista', estilo: 'vintage', color: 'ambar', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BLOG },
  { id: 'electronica', nombre: 'Electrónica', emoji: '📱', descripcion: 'Gadgets y tecnología', template: 'premium', estilo: 'tech', color: 'neon', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'celularesreparacion', nombre: 'Reparación de celulares', emoji: '📲', descripcion: 'Reparación y accesorios para celular', template: 'clasica', estilo: 'tech', color: 'neon', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'computo', nombre: 'Cómputo y reparación', emoji: '💻', descripcion: 'Venta y reparación de computadoras', template: 'clasica', estilo: 'tech', color: 'noche', color_mode: 'solido', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'serviciotecnico', nombre: 'Servicio técnico de electrodomésticos', emoji: '🛠️', descripcion: 'Reparación de electrodomésticos', template: 'minimal', estilo: 'tech', color: 'azul', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'viajes', nombre: 'Viajes', emoji: '✈️', descripcion: 'Agencia y tours', template: 'viaje', estilo: 'viaje', color: 'mar', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'eventos', nombre: 'Eventos', emoji: '🎉', descripcion: 'Fiestas y banquetes', template: 'portada', estilo: 'lujo', color: 'vino', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'vinos', nombre: 'Vinos / Licores', emoji: '🍷', descripcion: 'Bodega y catas', template: 'premium', estilo: 'elegancia', color: 'vino', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'lavanderia', nombre: 'Lavandería y tintorería', emoji: '🧺', descripcion: 'Lavado, planchado y tintorería', template: 'minimal', estilo: 'fresco', color: 'mar', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_SERVICIOS },
  { id: 'floreria', nombre: 'Florería', emoji: '💐', descripcion: 'Flores y arreglos', template: 'galeria', estilo: 'boho', color: 'rosa', color_mode: 'degradado', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'grande', nombre: 'Grande y simple', emoji: '🔍', descripcion: 'Letra grande y fácil de usar', template: 'minimal', estilo: 'moderno', color: 'azul', color_mode: 'solido', grid_cols: 2, font: '', radius: '', paginas_sugeridas: PAG_BASE },
  { id: 'otros', nombre: 'Otro negocio', emoji: '🏪', descripcion: 'Sin giro específico', template: 'clasica', estilo: 'moderno', color: 'azul', color_mode: 'degradado', grid_cols: 3, font: '', radius: '', paginas_sugeridas: PAG_BASE },
];

const GIRO_CATEGORIAS = {
  restaurante: ['Entradas', 'Platos fuertes', 'Bebidas'],
  taqueria: ['Tacos', 'Antojitos', 'Bebidas'],
  cafeteria: ['Bebidas calientes', 'Bebidas frías', 'Postres'],
  panaderia: ['Pan dulce', 'Pan salado', 'Pasteles'],
  pizzeria: ['Pizzas', 'Entradas', 'Bebidas'],
  hamburgueseria: ['Hamburguesas', 'Complementos', 'Bebidas'],
  pescaderia: ['Pescados', 'Mariscos', 'Preparados'],
  rosticeria: ['Pollo', 'Guisados', 'Complementos'],
  heladeria: ['Helados', 'Paletas', 'Postres'],
  juguera: ['Jugos', 'Licuados', 'Smoothies'],
  dulceria: ['Dulces mexicanos', 'Chocolates', 'Fiestas'],
  cocinaeconomica: ['Comida corrida', 'Platillos', 'Bebidas'],
  mariscos: ['Cocteles', 'Platillos', 'Bebidas'],
  pasteleria: ['Pasteles', 'Postres individuales', 'Personalizados'],
  cerveceria: ['Cervezas', 'Bebidas preparadas', 'Botanas'],
  foodtruck: ['Especialidades', 'Combos', 'Bebidas'],
  banquetes: ['Menús', 'Paquetes', 'Servicio'],
  abarrotes: ['Despensa', 'Bebidas', 'Limpieza'],
  fruteria: ['Frutas', 'Verduras', 'Orgánicos'],
  carniceria: ['Res', 'Cerdo', 'Pollo'],
  tortilleria: ['Tortillas', 'Masa', 'Otros'],
  hogar: ['Cocina', 'Limpieza', 'Decoración'],
  naturista: ['Suplementos', 'Tés y hierbas', 'Cuidado natural'],
  colchones: ['Colchones', 'Bases', 'Almohadas'],
  cortinas: ['Cortinas', 'Persianas', 'Accesorios'],
  piniateria: ['Piñatas', 'Decoración', 'Dulces'],
  regalos: ['Para ella', 'Para él', 'Personalizados'],
  bazar: ['Hogar', 'Ropa', 'Varios'],
  ropa: ['Hombre', 'Mujer', 'Accesorios'],
  calzado: ['Tenis', 'Casual', 'Accesorios'],
  ropabebe: ['Recién nacido', 'Bebé', 'Maternidad'],
  ropausada: ['Dama', 'Caballero', 'Niños'],
  perfumeria: ['Para ella', 'Para él', 'Esencias'],
  joyeria: ['Anillos', 'Collares', 'Relojes'],
  optica: ['Armazones', 'Lentes de sol', 'Contacto'],
  belleza: ['Cabello', 'Uñas', 'Faciales'],
  barberia: ['Cortes', 'Barba', 'Combos'],
  spa: ['Masajes', 'Faciales', 'Paquetes'],
  unias: ['Manicure', 'Pedicure', 'Acrílicas'],
  tatuajes: ['Tatuajes', 'Piercings', 'Diseños'],
  farmacia: ['Medicamentos', 'Cuidado personal', 'Vitaminas'],
  dental: ['Consultas', 'Limpiezas', 'Tratamientos'],
  medico: ['Consultas', 'Estudios', 'Paquetes'],
  veterinaria: ['Consultas', 'Vacunas', 'Cirugías'],
  fisioterapia: ['Terapias', 'Evaluaciones', 'Paquetes'],
  nutricion: ['Consultas', 'Planes', 'Seguimiento'],
  mascotas: ['Alimento', 'Accesorios', 'Higiene'],
  esteticacanina: ['Baño', 'Corte', 'Paquetes'],
  jugueteria: ['Bebés', 'Niños', 'Juegos de mesa'],
  guarderia: ['Horarios', 'Actividades', 'Paquetes'],
  articulosbebe: ['Carriolas', 'Cunas', 'Accesorios'],
  deportes: ['Ropa deportiva', 'Calzado', 'Equipo'],
  gimnasio: ['Membresías', 'Suplementos', 'Ropa'],
  bicicletas: ['Bicicletas', 'Refacciones', 'Accesorios'],
  instrumentos: ['Cuerdas', 'Viento', 'Percusiones'],
  salonfiestas: ['Paquetes', 'Horarios', 'Extras'],
  ferreteria: ['Herramientas', 'Pintura', 'Plomería'],
  materialesconstruccion: ['Cemento y block', 'Varilla', 'Acabados'],
  pintura: ['Interiores', 'Exteriores', 'Accesorios'],
  vidrios: ['Ventanas', 'Cancelería', 'Espejos'],
  pisos: ['Pisos', 'Azulejos', 'Accesorios'],
  electrodomesticos: ['Cocina', 'Lavado', 'Climatización'],
  muebles: ['Sala', 'Recámara', 'Comedor'],
  mueblesoficina: ['Escritorios', 'Sillas', 'Archiveros'],
  jardineria: ['Plantas', 'Macetas', 'Servicio'],
  fumigacion: ['Residencial', 'Comercial', 'Paquetes'],
  cerrajeria: ['Cerraduras', 'Copiado de llaves', 'Emergencias'],
  electricista: ['Instalaciones', 'Reparaciones', 'Mantenimiento'],
  plomeria: ['Instalaciones', 'Reparaciones', 'Emergencias'],
  mudanzas: ['Locales', 'Foráneas', 'Empaque'],
  taller: ['Refacciones', 'Servicios', 'Llantas'],
  refaccionaria: ['Motor', 'Frenos', 'Accesorios'],
  llantera: ['Llantas', 'Rines', 'Servicios'],
  motos: ['Motos', 'Refacciones', 'Accesorios'],
  autolavado: ['Lavado', 'Encerado', 'Detallado'],
  imprenta: ['Impresiones', 'Copias', 'Diseño'],
  disenio: ['Branding', 'Impresos', 'Digital'],
  letreros: ['Letreros', 'Lonas', 'Señalización'],
  fotografia: ['Sesiones', 'Paquetes', 'Impresiones'],
  video: ['Producción', 'Edición', 'Paquetes'],
  contable: ['Contabilidad', 'Impuestos', 'Nómina'],
  seguros: ['Auto', 'Vida', 'Gastos médicos'],
  inmobiliaria: ['En venta', 'En renta', 'Terrenos'],
  abogados: ['Civil', 'Laboral', 'Trámites'],
  clasesparticulares: ['Primaria', 'Secundaria', 'Preparatoria'],
  academiaidiomas: ['Inglés', 'Otros idiomas', 'Certificaciones'],
  escuelamanejo: ['Clases', 'Paquetes', 'Trámites'],
  papeleria: ['Escolar', 'Oficina', 'Arte'],
  libreria: ['Novelas', 'Infantil', 'Escolar'],
  electronica: ['Celulares', 'Audio', 'Accesorios'],
  celularesreparacion: ['Reparaciones', 'Accesorios', 'Desbloqueo'],
  computo: ['Equipos', 'Refacciones', 'Servicio técnico'],
  serviciotecnico: ['Refrigeración', 'Lavado', 'Cocina'],
  viajes: ['Tours', 'Experiencias', 'Paquetes'],
  eventos: ['Banquetes', 'Decoración', 'Renta de mobiliario'],
  vinos: ['Vinos tintos', 'Vinos blancos', 'Licores'],
  lavanderia: ['Lavado', 'Planchado', 'Tintorería'],
  floreria: ['Ramos', 'Arreglos', 'Plantas'],
  grande: ['Productos', 'Novedades', 'Destacados'],
  otros: ['Productos', 'Novedades', 'Destacados'],
};

const GIRO_ATTRS = {
  restaurante: { 'Tamaño': ['Chico', 'Mediano', 'Grande'] },
  taqueria: { 'Cantidad': ['3 piezas', '5 piezas', '10 piezas'] },
  cafeteria: { 'Tamaño': ['Chico', 'Mediano', 'Grande'] },
  panaderia: { 'Presentación': ['Pieza', 'Media docena', 'Docena'] },
  pizzeria: { 'Tamaño': ['Individual', 'Mediana', 'Grande', 'Familiar'] },
  hamburgueseria: { 'Tamaño': ['Sencilla', 'Doble', 'Triple'] },
  pescaderia: { 'Presentación': ['Kilo', 'Medio kilo', 'Porción'] },
  rosticeria: { 'Presentación': ['Cuarto', 'Medio', 'Entero'] },
  heladeria: { 'Tamaño': ['Chico', 'Mediano', 'Grande'] },
  juguera: { 'Tamaño': ['Chico', 'Mediano', 'Grande'] },
  mariscos: { 'Tamaño': ['Chico', 'Grande'] },
  pasteleria: { 'Tamaño': ['6 personas', '12 personas', '20 personas'] },
  cerveceria: { 'Presentación': ['Lata', 'Botella', 'Six', 'Caja'] },
  carniceria: { 'Presentación': ['Kilo', 'Medio kilo'] },
  tortilleria: { 'Presentación': ['Kilo', 'Medio kilo'] },
  naturista: { 'Presentación': ['Frasco', 'Bolsa', 'Caja'] },
  colchones: { 'Tamaño': ['Individual', 'Matrimonial', 'Queen', 'King'] },
  cortinas: { 'Medida': ['A la medida'] },
  ropa: { 'Talla': ['CH', 'M', 'G', 'XG'], 'Color': ['Negro', 'Blanco', 'Azul', 'Rojo'] },
  calzado: { 'Talla': ['22', '23', '24', '25', '26', '27', '28'], 'Color': ['Negro', 'Blanco', 'Café'] },
  ropabebe: { 'Talla': ['RN', '0-3m', '3-6m', '6-12m', '12-18m'] },
  ropausada: { 'Talla': ['CH', 'M', 'G', 'XG'] },
  joyeria: { 'Material': ['Oro', 'Plata', 'Acero'] },
  optica: { 'Graduación': ['Sin graduación', 'Con graduación'] },
  belleza: { 'Duración': ['30 min', '1 hora', '1.5 horas'] },
  barberia: { 'Duración': ['30 min', '45 min', '1 hora'] },
  spa: { 'Duración': ['30 min', '1 hora', '1.5 horas'] },
  unias: { 'Duración': ['30 min', '45 min', '1 hora'] },
  farmacia: { 'Presentación': ['Caja', 'Frasco', 'Tableta suelta'] },
  mascotas: { 'Tamaño': ['Chico', 'Mediano', 'Grande'] },
  esteticacanina: { 'Tamaño': ['Chico', 'Mediano', 'Grande'] },
  jugueteria: { 'Edad recomendada': ['0-2 años', '3-5 años', '6-8 años', '9+ años'] },
  deportes: { 'Talla': ['CH', 'M', 'G', 'XG'] },
  gimnasio: { 'Duración': ['Mensual', 'Trimestral', 'Anual'] },
  ferreteria: { 'Presentación': ['Pieza', 'Caja', 'Metro'] },
  pintura: { 'Presentación': ['Litro', 'Galón', 'Cubeta'] },
  electrodomesticos: { 'Color': ['Negro', 'Blanco', 'Plata'] },
  llantera: { 'Medida': ['A consultar'] },
  electronica: { 'Color': ['Negro', 'Blanco', 'Plata'] },
  vinos: { 'Presentación': ['750ml', '1L', 'Caja'] },
  floreria: { 'Tamaño': ['Sencillo', 'Mediano', 'Grande'] },
};

// Profundidad global por giro: conserva los presets específicos anteriores y los
// amplía con categorías y atributos sectoriales. El módulo valida que los 100
// giros tengan al menos 7 categorías, 3 atributos y 4 valores por atributo.
const { expandGiroCatalogs } = require('./giro-catalogs');
const GIRO_CATALOGS_EXPANDED = expandGiroCatalogs(
  GIRO_CATEGORIAS,
  GIRO_ATTRS,
  GIRO_PRESETS.map(p => p.id)
);
Object.assign(GIRO_CATEGORIAS, GIRO_CATALOGS_EXPANDED.categories);
Object.assign(GIRO_ATTRS, GIRO_CATALOGS_EXPANDED.attrs);

// Estilos alternativos que se ofrecen en el paso 2 del cuestionario para personalizar
// más allá del preset por defecto del giro (referencian ids válidos de ESTILOS/COLORS).
const VIBE_OPTIONS = [
  { estilo: 'moderno', color: 'azul', nombre: 'Moderno y limpio' },
  { estilo: 'cafe', color: 'ambar', nombre: 'Cálido y cercano' },
  { estilo: 'elegancia', color: 'oro', nombre: 'Elegante y premium' },
  { estilo: 'dulce', color: 'dulce', nombre: 'Divertido y colorido' },
  { estilo: 'fresco', color: 'esmeralda', nombre: 'Fresco y natural' },
  { estilo: 'tech', color: 'neon', nombre: 'Tech y audaz' }
];
// Recomienda un diseño real de CAT_DESIGNS (el mismo catálogo de 25 estilos
// que se elige en Configuración) según el "estilo" del giro elegido en el
// asistente de bienvenida — para que la vibra sugerida ya sea uno de los
// diseños que de verdad existen, no una paleta aparte que nunca se aplicaba.
const GIRO_ESTILO_TO_DESIGN = {
  cafe: 'muebles', fresco: 'vivero', dulce: 'postres', moderno: 'minimalista',
  elegancia: 'elegante', boho: 'bohemio', lujo: 'joyeria', vintage: 'retro',
  retro: 'rustico', tech: 'futurista', nocturno: 'eventos', viaje: 'tropical'
};

// ================= DIVISAS (ISO 4217) =================
const CURRENCIES = [
  { code: 'MXN', symbol: '$', name: 'Peso mexicano' },
  { code: 'USD', symbol: 'US$', name: 'Dólar estadounidense' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'ARS', symbol: 'AR$', name: 'Peso argentino' },
  { code: 'BOB', symbol: 'Bs', name: 'Boliviano' },
  { code: 'BRL', symbol: 'R$', name: 'Real brasileño' },
  { code: 'CAD', symbol: 'CA$', name: 'Dólar canadiense' },
  { code: 'CLP', symbol: 'CLP$', name: 'Peso chileno' },
  { code: 'CNY', symbol: 'CN¥', name: 'Yuan chino' },
  { code: 'COP', symbol: 'COL$', name: 'Peso colombiano' },
  { code: 'CRC', symbol: '₡', name: 'Colón costarricense' },
  { code: 'CUP', symbol: '₱', name: 'Peso cubano' },
  { code: 'DOP', symbol: 'RD$', name: 'Peso dominicano' },
  { code: 'GBP', symbol: '£', name: 'Libra esterlina' },
  { code: 'GTQ', symbol: 'Q', name: 'Quetzal guatemalteco' },
  { code: 'HNL', symbol: 'L', name: 'Lempira hondureño' },
  { code: 'INR', symbol: '₹', name: 'Rupia india' },
  { code: 'JPY', symbol: '¥', name: 'Yen japonés' },
  { code: 'KRW', symbol: '₩', name: 'Won surcoreano' },
  { code: 'NIO', symbol: 'C$', name: 'Córdoba nicaragüense' },
  { code: 'PAB', symbol: 'B/.', name: 'Balboa panameño' },
  { code: 'PEN', symbol: 'S/', name: 'Sol peruano' },
  { code: 'PYG', symbol: '₲', name: 'Guaraní paraguayo' },
  { code: 'RUB', symbol: '₽', name: 'Rublo ruso' },
  { code: 'SVC', symbol: '₡', name: 'Colón salvadoreño' },
  { code: 'UYU', symbol: '$U', name: 'Peso uruguayo' },
  { code: 'VES', symbol: 'Bs.S', name: 'Bolívar venezolano' },
  { code: 'CHF', symbol: 'CHF', name: 'Franco suizo' },
  { code: 'AUD', symbol: 'A$', name: 'Dólar australiano' }
];
const CURRENCY_MAP = {};
CURRENCIES.forEach(c => { CURRENCY_MAP[c.code] = c; });

// Formatea un monto con el símbolo de la moneda de la tienda.
function moneyFor(biz) {
  const cur = CURRENCY_MAP[biz.currency] || CURRENCY_MAP.MXN;
  return (n) => cur.symbol + (Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
}
function currencyInfo(code) {
  return CURRENCY_MAP[code] || CURRENCY_MAP.MXN;
}

// Secciones del catálogo: qué se muestra, en qué orden, modo de categorías, densidad, sombra y animación
const DEFAULT_SECTIONS = { hero_mode: 'destacado', catmode: 'left', density: 'normal', shadow: 'media', hover: 'lift', orden: ['hero', 'contenido'] };
function sectionsOf(biz) {
  const def = { hero_mode: 'destacado', hero: true, categorias: true, catmode: 'left', density: 'normal', shadow: 'media', hover: 'lift', orden: ['hero', 'contenido'], showHeader: true, showFooter: true, campaign: null };
  try {
    const s = JSON.parse(biz.sections || '');
    const hero_mode = ['destacado', 'compacto', 'oculto'].includes(s.hero_mode) ? s.hero_mode : 'destacado';
    const campaign = (s.campaign && typeof s.campaign === 'object' && String(s.campaign.text || '').trim())
      ? { text: String(s.campaign.text).trim().slice(0, 120), ends: /^\d{4}-\d{2}-\d{2}$/.test(String(s.campaign.ends || '')) ? String(s.campaign.ends) : '' }
      : null;
    return {
      hero_mode,
      hero: hero_mode !== 'oculto' && s.hero !== false,
      categorias: s.categorias !== false,
      catmode: s.catmode === 'top' ? 'top' : 'left',
      density: ['compacta', 'normal', 'espaciosa'].includes(s.density) ? s.density : 'normal',
      shadow: ['none', 'suave', 'media', 'fuerte'].includes(s.shadow) ? s.shadow : 'media',
      hover: ['none', 'scale', 'lift', 'zoom', 'glow'].includes(s.hover) ? s.hover : 'lift',
      orden: Array.isArray(s.orden) ? s.orden : ['hero', 'contenido'],
      showHeader: s.showHeader !== false,
      showFooter: s.showFooter !== false,
      campaign
    };
  } catch (e) {
    return def;
  }
}

const GIROS_COMPLEMENTARIOS = {
  abarrotes: ['frutas y verduras', 'carniceria', 'panaderia', 'tortilleria'],
  'frutas y verduras': ['abarrotes', 'carniceria', 'restaurante'],
  carniceria: ['abarrotes', 'frutas y verduras', 'restaurante'],
  papeleria: ['abarrotes', 'electronica'],
  ferreteria: ['abarrotes', 'electronica', 'mascotas'],
  electronica: ['papeleria', 'ferreteria', 'abarrotes'],
  ropa: ['calzado', 'belleza'],
  calzado: ['ropa', 'belleza'],
  farmacia: ['abarrotes'],
  belleza: ['ropa', 'calzado'],
  restaurante: ['abarrotes', 'frutas y verduras', 'carniceria'],
  taqueria: ['abarrotes', 'frutas y verduras'],
  panaderia: ['abarrotes'],
  tortilleria: ['abarrotes', 'carniceria'],
  floreria: ['abarrotes'],
  mascotas: ['abarrotes', 'ferreteria'],
  deportes: ['jugueteria'],
  jugueteria: ['deportes'],
  electrodomesticos: ['electronica', 'ferreteria'],
  muebles: ['electronica', 'ropa']
};

function getGiroComplementario(giro) {
  return GIROS_COMPLEMENTARIOS[giro] || [];
}

function pickSponsored(biz, limit) {
  // Publicidad cruzada: solo entran tiendas que el administrador marcó como "anuncio"
  const complementarios = getGiroComplementario(biz.giro);
  const stores = db.prepare(
    `SELECT id, slug, name, giro, color_hex, logo, whatsapp, wa_message FROM businesses
     WHERE id != ? AND active = 1 AND ads_enabled = 1 AND giro != ''
       AND suspended = 0 AND (plan_ends_at = '' OR plan_ends_at >= date('now'))`
  ).all(biz.id);

  // Mezcla aleatoria pero con prioridad a giros complementarios
  const shuffled = stores
    .map(s => ({ s, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map(x => x.s);

  const puntuados = shuffled.map(s => {
    let score = 0;
    if (complementarios.includes(s.giro)) score = 3;
    else if (s.giro === biz.giro) score = 1;
    else score = 2;
    return { s, score };
  }).sort((a, b) => b.score - a.score);

  const resultado = [];
  const usadas = new Set();
  for (const { s } of puntuados) {
    const prod = db.prepare(
      `SELECT id, name, price, old_price, image FROM products
       WHERE business_id = ? AND active = 1 ORDER BY RANDOM() LIMIT 1`
    ).get(s.id);
    if (prod && !usadas.has(s.id)) {
      usadas.add(s.id);
      resultado.push({ ...prod, store: s });
    }
    if (resultado.length >= limit) break;
  }
  return resultado;
}

function getBusiness(slug) {
  const b = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slug);
  // El pago en línea es obligatorio: está activo en cuanto la tienda tiene su cuenta de Mercado Pago conectada
  if (b) b.mp_enabled = b.mp_access_token ? 1 : 0;
  return b;
}

// Si la promo tiene fecha de vencimiento y ya pasó, la promo deja de mostrarse.
function withPromo(p) {
  if (p && p.old_price) {
    const today = new Date().toISOString().slice(0, 10);
    if (p.promo_ends_at && p.promo_ends_at !== '' && p.promo_ends_at < today) {
      p.old_price = null;
      p.promo_ends_at = '';
    } else if (p.promo_ends_at && p.promo_ends_at !== '') {
      p.promo_days = Math.max(0, Math.ceil((new Date(p.promo_ends_at + 'T23:59:59') - Date.now()) / 86400000));
    }
  }
  // Etiqueta de promoción para mostrar en la tienda
  const t = (p.promo_type || '').trim();
  const pct = (p.old_price && p.old_price > p.price) ? Math.round((1 - p.price / p.old_price) * 100) : 0;
  p.promo_badge = '';
  p.promo_desc = '';
  if (t === 'porcentaje' && Number(p.promo_value) > 0) {
    p.promo_badge = '-' + Math.round(Number(p.promo_value)) + '%';
    p.promo_desc = Math.round(Number(p.promo_value)) + '% de descuento';
  } else if (t === '2x1') {
    p.promo_badge = '2x1';
    p.promo_desc = '2x1 · Lleva 2, paga 1';
  } else if (t === '3x2') {
    p.promo_badge = '3x2';
    p.promo_desc = '3x2 · Lleva 3, paga 2';
  } else if (t === 'regalo') {
    p.promo_badge = '🎁 Regalo';
    p.promo_desc = (p.promo_gift ? 'Lleva de regalo: ' + p.promo_gift : 'Lleva un regalo sorpresa');
  } else if (pct > 0) {
    p.promo_badge = '🔥 Rebajado';
    p.promo_desc = 'Precio rebajado -' + pct + '%';
  }
  return p;
}

function getCatalog(businessId) {
  const categories = db.prepare(
    'SELECT * FROM categories WHERE business_id = ? ORDER BY sort ASC'
  ).all(businessId);
  const catCounts = {};
  db.prepare('SELECT category_id, COUNT(*) AS c FROM products WHERE business_id = ? AND active = 1 GROUP BY category_id').all(businessId).forEach(r => { catCounts[r.category_id] = r.c; });
  categories.forEach(c => { c.count = catCounts[c.id] || 0; });
  const products = db.prepare(
    `SELECT p.*, c.name AS category_name FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.business_id = ? AND p.active = 1
     ORDER BY p.featured DESC, p.sort ASC, p.created_at DESC`
  ).all(businessId).map(withPromo).map(p => {
    p.imgs = productImgs(p);
    if (variantCoverImage(p)) p.image = p.imgs[0]; // la tarjeta muestra la foto de la primera variante
    p.hideStock = p.show_stock === 0 || p.show_stock === '0';
    p.customTags = parseCustomTags(p.custom_tags);
    p.specsList = parseSpecs(p.specs);
    p.shortDesc = (p.description || '').replace(/\s+/g, ' ').trim().slice(0, 110);
    // Para que el cliente sepa si se va a acabar: con variantes el stock
    // vive por combinación (p.stock siempre null a propósito), así que se
    // suma aquí para mostrar "quedan X" tanto en la tarjeta como en la
    // ficha del producto.
    const vm = parseVariantList(p.variants);
    p.displayStock = p.made_to_order ? null : (vm.attrs && vm.attrs.length)
      ? Object.values(vm.stock || {}).reduce((s, v) => s + (parseInt(v, 10) || 0), 0)
      : p.stock;
    return p;
  });
  const pages = db.prepare(
    'SELECT id, slug, title, icon, sort FROM pages WHERE business_id = ? AND active = 1 ORDER BY sort ASC, id ASC'
  ).all(businessId);
  return { categories, products, pages };
}

// Pila de componentes que arma la página. Si la tienda no tiene bloques guardados,
// se genera una pila por defecto según la plantilla para no romper nada existente.
function parseComponents(biz) {
  try { const a = JSON.parse((biz && biz.blocks) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function defaultComponents(biz) {
  const t = (biz && biz.template) || 'clasica';
  const full = { id: 'c-' + t + '-productos', type: 'productos', title: '', count: 0, category_id: 0, layout: 'grid', cols: Number((biz && biz.grid_cols) || 3), mostrarFiltros: 'no' };
  if (t === 'galeria') full.layout = 'galeria';
  if (t === 'minimal' || t === 'restaurante') full.layout = 'lista';
  const blocks = [full];
  return [{ id: 'pg-inicio', title: 'Inicio', icon: '🏠', blocks }];
}
function getComponents(biz) {
  const c = parseComponents(biz);
  return c.length ? c : defaultComponents(biz);
}

function waLink(biz, text) {
  const num = biz.whatsapp.startsWith('52') ? biz.whatsapp : '52' + biz.whatsapp;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

// Arma el mensaje del pedido. Si la tienda configuró uno personalizado, usa sus
// comodines {tienda}, {productos} y {total}; si no, el mensaje por defecto.
function buildOrderMessage(storeName, lines, total, template, sym, installmentInfo) {
  const lista = lines.join('\n');
  const cur = sym || '$';
  const totalStr = cur + total.toFixed(2);
  const custom = (template && String(template).trim()) ? String(template).trim() : '';
  let msg;
  if (custom) {
    msg = custom
      .replace(/\{tienda\}/g, storeName)
      .replace(/\{productos\}/g, lista)
      .replace(/\{total\}/g, totalStr);
  } else {
    msg = `Hola ${storeName}! 👋 Quiero pedir:\n\n${lista}\n\nTotal: ${totalStr}\n\n¿Me confirmas disponibilidad y envío?`;
  }
  if (installmentInfo && installmentInfo.isInstallment) {
    const instCount = installmentInfo.count || 6;
    const instUnit = (total / instCount).toFixed(2);
    const freqLabel = {semanal:'semana', quincenal:'quincenas', mensual:'mes'}[installmentInfo.frequency] || 'semana';
    msg += `\n\nPedido a abonos:`;
    msg += `\nTotal: ${totalStr}`;
    msg += `\nAbonos: ${instCount} x ${cur}${instUnit} / ${freqLabel}`;
    if (installmentInfo.minDown > 0) {
      msg += `\nEnganche mínimo: ${cur}${installmentInfo.minDown.toFixed(2)}`;
    }
  }
  return msg;
}

function track(businessId, type, detail) {
  db.prepare('INSERT INTO tracking (business_id, type, detail) VALUES (?, ?, ?)').run(businessId, type, detail || '');
}

function getStats(businessId) {
  const today = db.prepare("SELECT COUNT(*) AS c FROM tracking WHERE business_id = ? AND type = 'visit' AND date(created_at) = date('now')").get(businessId).c;
  const week = db.prepare("SELECT COUNT(*) AS c FROM tracking WHERE business_id = ? AND type = 'visit' AND created_at >= datetime('now', '-7 days')").get(businessId).c;
  const prevWeek = db.prepare("SELECT COUNT(*) AS c FROM tracking WHERE business_id = ? AND type = 'visit' AND created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')").get(businessId).c;
  const total = db.prepare("SELECT COUNT(*) AS c FROM tracking WHERE business_id = ? AND type = 'visit'").get(businessId).c;
  const waClicks = db.prepare("SELECT COUNT(*) AS c FROM tracking WHERE business_id = ? AND type = 'wa'").get(businessId).c;
  const orders = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE business_id = ?").get(businessId).c;
  const paid = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE business_id = ? AND paid = 1 AND status != 'cancelado'").get(businessId).c;

  // ==== Ingresos = dinero REALMENTE cobrado (no lo pedido) ====
  // Un pedido a plazos ingresa según sus abonos (cada abono en la fecha en que se cobró).
  // Un pedido sin abonos (contado) ingresa completo el día que se marca cobrado (paid_at).
  // Los pedidos pendientes o cancelados nunca cuentan como ingreso.
  const ordRows = db.prepare("SELECT id, total, status, paid, created_at, paid_at, items FROM orders WHERE business_id = ?").all(businessId);
  const abonoRows = db.prepare("SELECT order_id, amount, created_at FROM abonos WHERE business_id = ?").all(businessId);
  const abonoPorPedido = {};
  abonoRows.forEach(a => { abonoPorPedido[a.order_id] = (abonoPorPedido[a.order_id] || 0) + (a.amount || 0); });
  const recvPedido = o => {
    if (o.status === 'cancelado') return 0;
    if (abonoPorPedido[o.id]) return abonoPorPedido[o.id];
    return o.paid ? (o.total || 0) : 0;
  };
  const revenue = ordRows.reduce((s, o) => s + recvPedido(o), 0);
  const isoAgo = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 19).replace('T', ' ');
  const isoNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
  function recvEntre(desdeISO, hastaISO) {
    const lo = desdeISO || '0000-01-01 00:00:00';
    const hi = hastaISO || '9999-12-31 23:59:59';
    let s = 0;
    ordRows.forEach(o => {
      if (o.status === 'cancelado' || !o.paid) return;
      if (abonoPorPedido[o.id]) return; // ese pedido cuenta por sus abonos (abajo)
      const fecha = (o.paid_at && o.paid_at !== '') ? o.paid_at : (o.created_at || '');
      if (fecha >= lo && fecha < hi) s += o.total || 0;
    });
    abonoRows.forEach(a => { if (a.created_at >= lo && a.created_at < hi) s += a.amount || 0; });
    return s;
  }
  const revenueWeek = recvEntre(isoAgo(7), isoNow());
  const prevRevenue = recvEntre(isoAgo(14), isoAgo(7));
  const topProducts = db.prepare(
    `SELECT detail AS name, COUNT(*) AS c FROM tracking
     WHERE business_id = ? AND type = 'view'
     GROUP BY detail ORDER BY c DESC LIMIT 5`
  ).all(businessId);
  const topWaProducts = db.prepare(
    `SELECT detail AS name, COUNT(*) AS c FROM tracking
     WHERE business_id = ? AND type = 'wa_product'
     GROUP BY detail ORDER BY c DESC LIMIT 5`
  ).all(businessId);
  const daily = db.prepare(
    `SELECT date(created_at) AS d, COUNT(*) AS c FROM tracking
     WHERE business_id = ? AND type = 'visit' AND created_at >= datetime('now', '-7 days')
     GROUP BY date(created_at) ORDER BY d`
  ).all(businessId);
  const ordersDaily = db.prepare(
    `SELECT date(created_at) AS d, COUNT(*) AS c, SUM(total) AS s FROM orders
     WHERE business_id = ? AND created_at >= datetime('now', '-7 days')
     GROUP BY date(created_at) ORDER BY d`
  ).all(businessId);
  const conv = total > 0 ? ((orders / total) * 100).toFixed(1) : 0;
  const clickRate = total > 0 ? ((waClicks / total) * 100).toFixed(1) : 0;
  const pct = (cur, prev) => prev > 0 ? Math.round(((cur - prev) / prev) * 100) : (cur > 0 ? 100 : 0);
  const avgOrder = orders > 0 ? (revenue / orders) : 0;
  // Productos más vendidos (contando apariciones en los pedidos)
  const topSellers = {};
  db.prepare('SELECT items FROM orders WHERE business_id = ?').all(businessId).forEach(o => {
    String(o.items || '').split(/[\n|]/).forEach(line => {
      const m = line.match(/x\s+(.+?)\s*=\s*[^]*?$/);
      if (m) { const nm = m[1].trim(); if (nm) topSellers[nm] = (topSellers[nm] || 0) + 1; }
    });
  });
  const topSellersArr = Object.keys(topSellers).map(n => ({ name: n, c: topSellers[n] })).sort((a, b) => b.c - a.c).slice(0, 6);

  // ==== Ganancia estimada = ingresos − costo de lo vendido ====
  // El costo por producto es OPCIONAL (ver Productos → Más detalles), así que
  // esto es una estimación: solo descuenta costo de los productos que sí lo
  // tienen capturado — hasCostData avisa a la vista si vale la pena mostrarlo
  // (si nadie ha capturado costos, "ganancia = ingresos" sería engañoso).
  const costMap = {};
  db.prepare('SELECT name, cost FROM products WHERE business_id = ?').all(businessId).forEach(p => {
    if (p.cost > 0) costMap[String(p.name || '').trim().toLowerCase()] = p.cost;
  });
  const hasCostData = Object.keys(costMap).length > 0;
  let costTotal = 0;
  if (hasCostData) {
    ordRows.forEach(o => {
      if (!recvPedido(o)) return;
      String(o.items || '').split(/[\n|]/).forEach(line => {
        const m = line.match(/(\d+)\s*x\s+(.+?)\s*=\s*[^]*?$/);
        if (!m) return;
        const qty = parseInt(m[1]) || 0;
        const nm = m[2].trim().replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
        if (costMap[nm]) costTotal += costMap[nm] * qty;
      });
    });
  }
  // Lo pagado a proveedores también es un gasto real y se descuenta de la
  // ganancia — sin importar si el pedido ya se marcó "recibido", porque el
  // dinero ya salió de la tienda al hacer el pedido de compra.
  const supplierSpend = db.prepare('SELECT COALESCE(SUM(total), 0) AS s FROM purchase_orders WHERE business_id = ?').get(businessId).s;
  const profit = revenue - costTotal - supplierSpend;

  return {
    today, week, prevWeek, total, waClicks, orders, paid, revenue, revenueWeek, prevRevenue, avgOrder,
    weekDelta: pct(week, prevWeek), revenueDelta: pct(revenueWeek, prevRevenue),
    topProducts, topWaProducts, topSellers: topSellersArr, daily, ordersDaily, conv, clickRate,
    hasCostData, costTotal, supplierSpend, profit
  };
}

// Manifest PWA de la landing (para instalar el sitio de Catálogo Fácil, no una tienda en particular)
app.get('/manifest.webmanifest', (req, res) => {
  res.set('Content-Type', 'application/manifest+json');
  res.set('Cache-Control', 'no-store');
  res.json({
    name: 'Catálogo Fácil · Tu tienda en línea con WhatsApp',
    short_name: 'Cat. Fácil',
    description: 'Crea y administra tu catálogo en línea con pedidos por WhatsApp',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f6f2',
    theme_color: '#11100e',
    lang: 'es',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  });
});

// ================= LANDING =================
app.get('/', (req, res) => {
  // Si ya hay una sesión activa (dueño, empleado o maestro — no cerró
  // sesión la última vez), abrir la app directo en su panel en vez de
  // mandarlo siempre al landing genérico.
  const sess = findSession(req.cookies && req.cookies.sid);
  if (sess) {
    if (sess.kind === 'maestro') {
      touchSession(res, sess.token);
      return res.redirect('/maestro/panel');
    }
    if (sess.biz_id) {
      const sessBiz = db.prepare('SELECT slug FROM businesses WHERE id = ? AND active = 1').get(sess.biz_id);
      if (sessBiz) {
        touchSession(res, sess.token);
        return res.redirect('/' + sessBiz.slug + '/admin/panel');
      }
    }
  }
  const stores = db.prepare(`
    SELECT b.*,
      COUNT(t.id) AS visits_count,
      (
        SELECT p.image FROM products p
        WHERE p.business_id = b.id AND p.active = 1 AND p.image IS NOT NULL AND p.image <> ''
        ORDER BY p.id DESC LIMIT 1
      ) AS cover_image,
      (
        SELECT p.name FROM products p
        WHERE p.business_id = b.id AND p.active = 1
        ORDER BY p.id DESC LIMIT 1
      ) AS featured_product,
      (
        SELECT p.price FROM products p
        WHERE p.business_id = b.id AND p.active = 1
        ORDER BY p.id DESC LIMIT 1
      ) AS featured_price
    FROM businesses b
    LEFT JOIN tracking t
      ON t.business_id = b.id
      AND t.type = 'visit'
    WHERE b.active = 1 AND b.listed = 1
    GROUP BY b.id
    ORDER BY visits_count DESC, b.created_at DESC
    LIMIT 6
  `).all();
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.render('landing', { stores, TEMPLATES, COLORS });
});

// ================= REGISTRO DE TIENDA =================
app.get('/registrar', (req, res) => {
  res.render('register', { TEMPLATES, COLORS, GIROS: getGiros(), ESTILOS, error: null, ok: null, form: null });
});

app.post('/registrar', rateLimit(10), (req, res) => {
  const { name, slug, whatsapp, description, pin, template, color, giro, estilo } = req.body;
  const cleanSlug = (slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  // Conserva lo que ya escribió el usuario para no borrar el formulario al fallar
  const form = {
    name: String(name || '').trim(),
    slug: cleanSlug,
    whatsapp: String(whatsapp || '').trim(),
    description: String(description || '').trim(),
    giro: String(giro || '').trim(),
    pin: String(pin || '').trim()
  };
  if (!name || !cleanSlug || !whatsapp) {
    return res.render('register', { TEMPLATES, COLORS, GIROS: getGiros(), ESTILOS, error: 'Nombre, enlace y WhatsApp son obligatorios.', ok: null, form });
  }
  if (getBusiness(cleanSlug)) {
    return res.render('register', { TEMPLATES, COLORS, GIROS: getGiros(), ESTILOS, error: 'Ese enlace ya existe. Elige otro.', ok: null, form });
  }
  if (String(whatsapp).replace(/[^0-9]/g, '').length !== 10) {
    return res.render('register', { TEMPLATES, COLORS, GIROS: getGiros(), ESTILOS, error: 'El WhatsApp de ventas debe tener exactamente 10 dígitos.', ok: null, form });
  }
  const cleanPin = (pin || '').trim();
  if (cleanPin.length < 6 || !/^\d+$/.test(cleanPin)) {
    return res.render('register', { TEMPLATES, COLORS, GIROS: getGiros(), ESTILOS, error: 'El PIN debe tener al menos 6 dígitos numéricos.', ok: null, form });
  }
  const hashedPin = hashPin(cleanPin);
  const colorObj = getColor(color);
  // El giro se escribe libre: si no está en el catálogo, se guarda para que otros lo usen después
  const giroOk = (giro || '').trim().toLowerCase();
  if (giroOk && !GIROS.includes(giroOk)) {
    db.prepare('INSERT OR IGNORE INTO giros (name, used) VALUES (?, 1)').run(giroOk);
    db.prepare('UPDATE giros SET used = used + 1 WHERE name = ?').run(giroOk);
  }
  const tpl = 'constructor';
  const estSel = ESTILOS.some(e => e.id === estilo) ? estilo : (GIRO_STYLE[giroOk] || 'moderno');
  const r = db.prepare(
    `INSERT INTO businesses (slug, name, whatsapp, description, pin, template, color, color_hex, color_hex2, giro, estilo, color_mode, plan, ads_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'estilo', 'demo', 1)`
  ).run(
    cleanSlug,
    name.trim(),
    whatsapp.trim().replace(/[^0-9]/g, ''),
    description || '',
    hashPin(cleanPin),
    tpl,
    colorObj.id,
    colorObj.c1,
    colorObj.c2,
    giroOk,
    estSel
  );
  // Sesión abierta de inmediato: acaba de escribir su propio PIN, no tiene sentido
  // pedírselo otra vez en la siguiente pantalla. Directo al cuestionario de bienvenida.
  const token = createSession(r.lastInsertRowid, 'owner');
  res.cookie('sid', token, { maxAge: SESSION_TTL_MS, httpOnly: true, sameSite: 'lax', path: '/', secure: req.secure });
  res.redirect('/' + cleanSlug + '/admin/bienvenida');
});

// ================= CUESTIONARIO DE BIENVENIDA =================
// Se muestra una sola vez, justo después del primer login del dueño en una tienda nueva
// (ver el gate en POST /:slug/admin). Personaliza diseño y precarga categorías/atributos
// reales en la base de datos para que Productos no arranque vacío.
app.get('/:slug/admin/bienvenida', requireAuth, (req, res) => {
  if (req.role !== 'owner') return res.redirect('/' + req.params.slug + '/admin/panel');
  if (req.biz.onboarding_done) return res.redirect('/' + req.params.slug + '/admin/panel');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.render('bienvenida', { biz: req.biz, GIRO_PRESETS, VIBE_OPTIONS, COLORS, GIRO_CATEGORIAS, CAT_DESIGNS, GIRO_ESTILO_TO_DESIGN, error: null });
});

app.post('/:slug/admin/bienvenida', requireAuth, (req, res) => {
  if (req.role !== 'owner') return res.redirect('/' + req.params.slug + '/admin/panel');
  const biz = req.biz;
  if (req.body.skip) {
    db.prepare('UPDATE businesses SET onboarding_done = 1 WHERE id = ?').run(biz.id);
    return res.redirect('/' + req.params.slug + '/admin/panel');
  }
  const preset = GIRO_PRESETS.find(p => p.id === req.body.giro_preset) || GIRO_PRESETS.find(p => p.id === 'otros');
  // El diseño real del catálogo (el mismo que se elige en Configuración → 25
  // estilos con paleta/tipografía propias) — antes el paso 2 elegía una
  // "vibra" que solo tocaba campos (estilo/color) que el catálogo público
  // nunca lee; catalog_design es el campo que de verdad pinta constructor.ejs.
  const chosenDesign = CAT_DESIGNS.find(d => d.id === req.body.catalog_design);
  const designId = chosenDesign ? chosenDesign.id : (GIRO_ESTILO_TO_DESIGN[preset.estilo] || CAT_DESIGNS[0].id);
  const vibe = VIBE_OPTIONS.find(v => v.estilo === req.body.estilo && v.color === req.body.color);
  const estiloId = vibe ? vibe.estilo : preset.estilo;
  const colorObj = getColor(vibe ? vibe.color : preset.color);
  // giro (texto libre, minúsculas): ya no se pide en /registrar — se llena aquí
  // con el preset elegido para que sigan funcionando las recomendaciones de
  // negocios complementarios y las demos por giro (GIRO_DEMO), que buscan por
  // este campo.
  db.prepare(
    `UPDATE businesses SET template = ?, estilo = ?, color = ?, color_hex = ?, color_hex2 = ?, color_mode = ?, grid_cols = ?, giro_preset = ?, giro = ?, catalog_design = ?, onboarding_done = 1 WHERE id = ?`
  ).run(
    preset.template, estiloId, colorObj.id, colorObj.c1, colorObj.c2, preset.color_mode, preset.grid_cols,
    preset.id, preset.id, designId, biz.id
  );
  db.crearPaginasSugeridas(biz.id, preset.paginas_sugeridas);
  // El paso 3 del asistente deja quitar/agregar categorías sugeridas antes de
  // crear la tienda — si el dueño editó la lista llega como JSON en
  // categorias_final; si no llega (JS deshabilitado, o vacía) se usa la
  // lista completa del giro como respaldo, igual que antes.
  let categoriasFinal = null;
  try {
    const parsed = JSON.parse(req.body.categorias_final || '[]');
    if (Array.isArray(parsed) && parsed.length) {
      categoriasFinal = parsed.map(c => String(c || '').trim().slice(0, 60)).filter(Boolean).slice(0, 30);
    }
  } catch (e) { /* JSON inválido: se usa el respaldo por giro */ }
  db.crearCategoriasSugeridas(biz.id, categoriasFinal && categoriasFinal.length ? categoriasFinal : (GIRO_CATEGORIAS[preset.id] || GIRO_CATEGORIAS.otros));
  db.crearAtributosSugeridos(biz.id, GIRO_ATTRS[preset.id] || {});
  res.redirect('/' + req.params.slug + '/admin/panel?bienvenida=1');
});

// ================= PANEL MAESTRO =================
app.get('/maestro', (req, res) => {
  const s = findSession(req.cookies && req.cookies.sid);
  if (s && s.kind === 'maestro') return res.redirect('/maestro/panel');
  res.render('maestro', { error: null, list: null });
});

app.post('/maestro', (req, res) => {
  if (req.body.master === MASTER_KEY || verifyPin(req.body.master, MASTER_KEY)) {
    const token = createSession(null, 'maestro');
    res.cookie('sid', token, { maxAge: SESSION_TTL_MS, httpOnly: true, sameSite: 'lax', path: '/', secure: req.secure });
    return res.redirect('/maestro/panel');
  }
  res.render('maestro', { error: 'Código maestro incorrecto.', list: null });
});

function maestroAuth(req, res, next) {
  const s = findSession(req.cookies && req.cookies.sid);
  if (!(s && s.kind === 'maestro')) return res.redirect('/maestro');
  touchSession(res, s.token);
  next();
}

app.get('/maestro/panel', maestroAuth, (req, res) => {
  const stores = db.prepare(
    `SELECT b.*,
       (SELECT COUNT(*) FROM products p WHERE p.business_id = b.id) AS products_count,
       (SELECT COUNT(*) FROM orders o WHERE o.business_id = b.id) AS orders_count,
       (SELECT COUNT(*) FROM tracking t WHERE t.business_id = b.id AND t.type = 'visit') AS visits_count,
       p2.name AS plan_name, p2.max_products AS plan_max, p2.price AS plan_price, p2.ads AS plan_ads
     FROM businesses b
     LEFT JOIN plans p2 ON p2.key = b.plan
     ORDER BY b.created_at DESC`
  ).all().map(s => {
    const today = new Date().toISOString().slice(0, 10);
    s.expired = s.plan_ends_at && s.plan_ends_at !== '' && s.plan_ends_at < today ? 1 : 0;
    s.plan_name = s.plan_name || s.plan || 'free';
    s.plan_price = s.plan_price === null || s.plan_price === undefined ? 0 : s.plan_price;
    return s;
  });
  const plans = db.prepare('SELECT * FROM plans ORDER BY active DESC, id ASC').all();
  const planUsage = {};
  stores.forEach(s => { planUsage[s.plan] = (planUsage[s.plan] || 0) + 1; });
  res.render('maestro', { error: null, list: stores, plans, planUsage, GIROS: getGiros() });
});

app.post('/maestro/:id/toggle', maestroAuth, (req, res) => {
  db.prepare('UPDATE businesses SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?').run(req.params.id);
  res.redirect('/maestro/panel?ok=' + encodeURIComponent('Tienda activada/desactivada'));
});

app.post('/maestro/:id/reset-pin', maestroAuth, (req, res) => {
  const newPin = req.body.new_pin || '123456';
  if (String(newPin).length < 6) {
    return res.redirect('/maestro/panel?error=' + encodeURIComponent('PIN debe tener al menos 6 dígitos'));
  }
  db.prepare('UPDATE businesses SET pin = ? WHERE id = ?').run(hashPin(String(newPin)), req.params.id);
  db.prepare('DELETE FROM sessions WHERE biz_id = ?').run(req.params.id);
  res.redirect('/maestro/panel?ok=' + encodeURIComponent('PIN reseteado. Sesiones cerradas.'));
});

app.post('/maestro/:id/plan', maestroAuth, (req, res) => {
  const plan = db.prepare('SELECT key FROM plans WHERE key = ? AND active = 1').get(req.body.plan);
  if (plan) {
    db.prepare('UPDATE businesses SET plan = ? WHERE id = ?').run(plan.key, req.params.id);
    res.redirect('/maestro/panel?ok=' + encodeURIComponent('Plan actualizado'));
  } else {
    res.redirect('/maestro/panel');
  }
});

// Precio y fecha de vencimiento del plan de una tienda
app.post('/maestro/:id/vencimiento', maestroAuth, (req, res) => {
  const price = parseFloat(req.body.plan_price);
  const ends = /^\d{4}-\d{2}-\d{2}$/.test((req.body.plan_ends_at || '').trim()) ? req.body.plan_ends_at.trim() : '';
  db.prepare('UPDATE businesses SET plan_price = ?, plan_ends_at = ? WHERE id = ?').run(isNaN(price) ? 0 : price, ends, req.params.id);
  res.redirect('/maestro/panel?ok=' + encodeURIComponent('Precio y vencimiento guardados'));
});

app.post('/maestro/:id/suspender', maestroAuth, (req, res) => {
  db.prepare('UPDATE businesses SET suspended = 1 WHERE id = ?').run(req.params.id);
  res.redirect('/maestro/panel?ok=' + encodeURIComponent('Tienda suspendida'));
});

app.post('/maestro/:id/reactivar', maestroAuth, (req, res) => {
  db.prepare('UPDATE businesses SET suspended = 0 WHERE id = ?').run(req.params.id);
  res.redirect('/maestro/panel?ok=' + encodeURIComponent('Tienda reactivada'));
});

// Anuncio: esta tienda se muestra como publicidad en otros catálogos
app.post('/maestro/:id/ads', maestroAuth, (req, res) => {
  db.prepare('UPDATE businesses SET ads_enabled = CASE WHEN ads_enabled = 1 THEN 0 ELSE 1 END WHERE id = ?').run(req.params.id);
  res.redirect('/maestro/panel?ok=' + encodeURIComponent('Publicidad actualizada'));
});

// ================= CREACIÓN DE PLANES (maestro) =================
app.post('/maestro/plan', maestroAuth, (req, res) => {
  const { name, price, days, max_products } = req.body;
  const cleanName = (name || '').trim();
  if (!cleanName) return res.redirect('/maestro/panel');
  const key = 'p' + Date.now();
  db.prepare(
    'INSERT INTO plans (key, name, price, days, max_products, ads, active) VALUES (?, ?, ?, ?, ?, ?, 1)'
  ).run(
    key,
    cleanName,
    Math.max(0, parseFloat(price) || 0),
    Math.max(0, parseInt(days) || 0),
    parseInt(max_products) === -1 ? -1 : Math.max(0, parseInt(max_products) || 0),
    req.body.ads === 'on' ? 1 : 0
  );
  res.redirect('/maestro/panel?ok=' + encodeURIComponent('Plan creado'));
});

app.post('/maestro/plan/:id/eliminar', maestroAuth, (req, res) => {
  const p = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  if (p && p.key !== 'free' && p.key !== 'pro') {
    const used = db.prepare('SELECT COUNT(*) AS c FROM businesses WHERE plan = ?').get(p.key).c;
    if (used === 0) {
      db.prepare('DELETE FROM plans WHERE id = ?').run(req.params.id);
    }
  }
  res.redirect('/maestro/panel?ok=' + encodeURIComponent('Plan eliminado'));
});

app.post('/maestro/cerrar', (req, res) => {
  deleteSession(req.cookies && req.cookies.sid);
  res.clearCookie('sid', { path: '/' });
  res.redirect('/maestro');
});

// ================= CATÁLOGO PÚBLICO =================
app.get('/:slug', (req, res, next) => {
  const biz = getBusiness(req.params.slug);
  if (!biz || !biz.active) return res.status(404).render('404', { message: 'Tienda no encontrada o desactivada' });
  const block = storeBlock(biz);
  if (block.blocked) {
    return res.status(403).render('store-off', { biz, reason: block.reason });
  }
  const { categories, products, pages } = getCatalog(biz.id);
  track(biz.id, 'visit', '');

  let productsFinal = products;
  if (adsOn(biz) && products.length > 0) {
    const sponsored = pickSponsored(biz, 6);
    if (sponsored.length) {
      productsFinal = [];
      let idx = 0;
      let spIdx = 0;
      products.forEach((p) => {
        productsFinal.push(p);
        idx++;
        if (idx % 5 === 0 && spIdx < sponsored.length) {
          productsFinal.push({ isAd: true, ad: sponsored[spIdx] });
          spIdx++;
        }
      });
      while (spIdx < sponsored.length) {
        productsFinal.push({ isAd: true, ad: sponsored[spIdx] });
        spIdx++;
      }
    }
  }

  const estilo = getEffectiveEstilo(biz);
  const pal = getPalette(biz, estilo);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.locals.money = moneyFor(biz);
  res.locals.currencySymbol = currencyInfo(biz.currency).symbol;
  res.locals.currencyCode = biz.currency;
  // Si quien visita el catálogo es el dueño o un empleado de ESTA tienda, le mostramos el botón para volver al panel
  const sess = findSession(req.cookies && req.cookies.sid);
  const adminLink = sess && (sess.kind === 'owner' || sess.kind === 'employee') && sess.biz_id === biz.id ? '/' + biz.slug + '/admin' : null;
  const sponsoredAds = adsOn(biz) ? pickSponsored(biz, 6) : [];
  const catDesign = catDesignOf(biz).id;
  const catDesignTokens = catDesignOf(biz).tokens;
  const ogUrl = absoluteStoreUrl(req, biz);
  const brandV = brandVersion(biz);
  const ogImage = (biz.logo || biz.banner) ? absoluteStoreUrl(req, biz) + '/share.jpg?v=' + brandV : '';
  let bestIds = [];
  try { if (JSON.parse(biz.extras || '{}').showTop) bestIds = bestSellerIds(biz.id, productsFinal, 8); } catch (e) {}
  app.render('catalog', { biz, brandV, categories, products: productsFinal, bestIds, estilo, catDesign, catDesignTokens, theme: getTemplateTheme(biz.template), components: getComponents(biz), pages, seoUrl: BASE_URL ? BASE_URL + '/' + biz.slug : '', money: moneyFor(biz), currencySymbol: currencyInfo(biz.currency).symbol, currencyCode: biz.currency, mascaraCss: MASCARA_CSS, mascaraConfig: { MASCARA_SIZES, SHAPE_DEFS, getShapeClip }, adsEnabled: adsOn(biz), sponsoredAds, adminLink, ogUrl, ogImage }, (err, html) => {
    if (err) return next(err);
    res.send(finishCatalog(html, biz, pal, estilo));
  });
});

// URL absoluta de la tienda (para OpenGraph, QR y compartir)
function absoluteStoreUrl(req, biz) {
  return (BASE_URL ? BASE_URL : req.protocol + '://' + req.get('host')) + '/' + biz.slug;
}
// Convierte la ruta de imagen del producto en absoluta para las etiquetas og:image
function absoluteImgUrl(req, src) {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  return (BASE_URL ? BASE_URL : req.protocol + '://' + req.get('host')) + (src.startsWith('/') ? src : '/' + src);
}

// Página de un producto individual (para compartir y verlo solo)
app.get('/:slug/p/:id', (req, res, next) => {
  const biz = getBusiness(req.params.slug);
  if (!biz || !biz.active) return res.status(404).render('404', { message: 'Tienda no encontrada o desactivada' });
  const block = storeBlock(biz);
  if (block.blocked) return res.status(403).render('store-off', { biz, reason: block.reason });
  const p = db.prepare(
    `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ? AND p.business_id = ? AND p.active = 1`
  ).get(parseInt(req.params.id) || 0, biz.id);
  if (!p) {
    const page = db.prepare('SELECT * FROM pages WHERE business_id = ? AND slug = ? AND active = 1').get(biz.id, String(req.params.id));
    if (page) {
      const { categories, products, pages } = getCatalog(biz.id);
      const bizOv = { ...biz, blocks: page.blocks || '[]', name: biz.name + ' · ' + page.title };
      const estilo = getEffectiveEstilo(biz);
      const pal = getPalette(biz, estilo);
      track(biz.id, 'view', 'Página: ' + page.title);
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      console.log('=== ROUTE HIT: Rendering catalog for:', bizOv.slug);
      console.log('bizOv.blocks:', bizOv.blocks ? 'present' : 'empty');
      app.render('catalog', { biz: bizOv, categories, products, estilo, catDesign: catDesignOf(biz).id, catDesignTokens: catDesignOf(biz).tokens, theme: getTemplateTheme(biz.template), components: getComponents(bizOv), pages, seoUrl: BASE_URL ? BASE_URL + '/' + biz.slug : '', money: moneyFor(biz), currencySymbol: currencyInfo(biz.currency).symbol, currencyCode: biz.currency, mascaraCss: MASCARA_CSS, mascaraConfig: { MASCARA_SIZES, SHAPE_DEFS, getShapeClip } }, (err, html) => {
        if (err) return next(err);
        try {
          res.send(finishCatalog(html, bizOv, pal, estilo));
        } catch (e) { next(e); }
      });
      return;
    }
    return res.redirect('/' + biz.slug);
  }
  p.imgs = productImgs(p);
  withPromo(p);
  const pvm0 = parseVariantList(p.variants);
  p.hideStock = p.show_stock === 0 || p.show_stock === '0';
  p.customTags = parseCustomTags(p.custom_tags);
  p.specsList = parseSpecs(p.specs);
  p.displayStock = p.made_to_order ? null : (pvm0.attrs && pvm0.attrs.length)
    ? Object.values(pvm0.stock || {}).reduce((s, v) => s + (parseInt(v, 10) || 0), 0)
    : p.stock;
  track(biz.id, 'view', p.name);
  const estilo = getEffectiveEstilo(biz);
  const pal = getPalette(biz, estilo);
  const { products } = getCatalog(biz.id);
  const related = products.filter(x => x.id !== p.id).slice(0, 8);
  const ads = adsOn(biz) ? pickSponsored(biz, 4) : [];
  const ogUrl = absoluteStoreUrl(req, biz) + '/p/' + p.id;
  const ogImage = absoluteImgUrl(req, p.imgs[0] || '');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  app.render('producto', { biz, product: p, categories: [{ id: p.category_id || 0, name: p.category_name || 'General' }], related, ads, estilo, catDesign: catDesignOf(biz).id, catDesignTokens: catDesignOf(biz).tokens, money: moneyFor(biz), currencySymbol: currencyInfo(biz.currency).symbol, currencyCode: biz.currency, ogUrl, ogImage }, (err, html) => {
    if (err) return next(err);
    // La ficha usa los mismos tokens de apariencia que el catálogo (sin repintado por estilo)
    res.send(html);
  });
});

// ===== Identidad de cada tienda al compartir el enlace y al instalar la app =====
// Tarjeta 1200x630 para la vista previa (WhatsApp, Facebook…): banner de fondo + logo completo al centro, o el logo
// sobre el color de la apariencia. Íconos de pestaña / pantalla de inicio: el logo de la tienda, no el de la plataforma.
const _brandCache = new Map();
function brandVersion(biz) {
  return crypto.createHash('md5').update(String(biz.logo || '') + '|' + String(biz.banner || '') + '|' + String((catDesignOf(biz).tokens || {}).accent || '')).digest('hex').slice(0, 8);
}
function brandCacheSet(key, buf) {
  if (_brandCache.size > 200) _brandCache.delete(_brandCache.keys().next().value);
  _brandCache.set(key, buf);
}
async function brandShareCard(biz) {
  const W = 1200, H = 630;
  const logoB = await pedidoLoadImage(biz.logo);
  const banB = await pedidoLoadImage(biz.banner);
  if (!logoB && !banB) return null;
  let base;
  if (banB) {
    try { base = await sharp(banB, { density: 200 }).resize(W, H, { fit: 'cover' }).modulate({ brightness: logoB ? 0.62 : 0.95 }).png().toBuffer(); } catch (e) { base = null; }
  }
  if (!base) base = await sharp({ create: { width: W, height: H, channels: 3, background: (catDesignOf(biz).tokens || {}).accent || '#1a3c5e' } }).png().toBuffer();
  const layers = [];
  if (logoB) {
    try {
      const logo = await sharp(logoB, { density: 300 }).resize(700, 330, { fit: 'inside' }).png().toBuffer();
      const lm = await sharp(logo).metadata();
      const cw = lm.width + 64, ch = lm.height + 64;
      const card = await sharp({ create: { width: cw, height: ch, channels: 4, background: '#ffffff' } }).composite([{ input: logo, left: 32, top: 32 }]).png().toBuffer();
      const mask = Buffer.from('<svg width="' + cw + '" height="' + ch + '"><rect width="' + cw + '" height="' + ch + '" rx="34" ry="34"/></svg>');
      const rounded = await sharp(card).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
      layers.push({ input: rounded, left: Math.round((W - cw) / 2), top: Math.round((H - ch) / 2) });
    } catch (e) { /* logo ilegible: queda solo el fondo */ }
  }
  return sharp(base).composite(layers).jpeg({ quality: 86 }).toBuffer();
}
async function brandIcon(biz, size) {
  const logoB = biz.logo ? await pedidoLoadImage(biz.logo) : null;
  if (!logoB) {
    const banB = biz.banner ? await pedidoLoadImage(biz.banner) : null;
    if (!banB) return null;
    return sharp(banB).resize(size, size, { fit: 'cover', position: 'centre' }).png().toBuffer();
  }
  const pad = Math.round(size * 0.12), inner = size - pad * 2;
  const logo = await sharp(logoB, { density: 300 }).resize(inner, inner, { fit: 'inside' }).png().toBuffer();
  const lm = await sharp(logo).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
    .composite([{ input: logo, left: Math.round((size - lm.width) / 2), top: Math.round((size - lm.height) / 2) }]).png().toBuffer();
}
app.get('/:slug/share.jpg', ah(async (req, res) => {
  const biz = getBusiness(req.params.slug);
  if (!biz || !biz.active) return res.status(404).end();
  const key = 'share:' + biz.slug + ':' + brandVersion(biz);
  let buf = _brandCache.get(key);
  if (!buf) {
    buf = await brandShareCard(biz);
    if (!buf) return res.status(404).end();
    brandCacheSet(key, buf);
  }
  res.set('Cache-Control', 'public, max-age=86400').type('jpeg').send(buf);
}));
app.get('/:slug/icon/:size.png', ah(async (req, res) => {
  const size = [180, 192, 512].includes(parseInt(req.params.size, 10)) ? parseInt(req.params.size, 10) : 192;
  const biz = getBusiness(req.params.slug);
  const fallback = size === 180 ? '/icons/apple-touch-icon.png' : '/icons/icon-' + size + '.png';
  if (!biz || !biz.active) return res.redirect(fallback);
  const key = 'icon:' + size + ':' + biz.slug + ':' + brandVersion(biz);
  let buf = _brandCache.get(key);
  let real = true;
  if (!buf) {
    try { buf = (biz.logo || biz.banner) ? await brandIcon(biz, size) : null; } catch (e) { buf = null; }
    if (!buf) {
      // Sin imagen (o no se pudo leer): inicial del negocio con su color, nunca el ícono de la plataforma
      real = false;
      const ini = (String(biz.name || 'C').trim().charAt(0) || 'C').toUpperCase().replace(/[<>&"]/g, '');
      const ac = (catDesignOf(biz).tokens || {}).accent || '#17232d';
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '"><rect width="100%" height="100%" fill="' + ac + '"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="' + Math.round(size * 0.55) + '" fill="#ffffff">' + ini + '</text></svg>';
      try { buf = await sharp(Buffer.from(svg)).png().toBuffer(); } catch (e) { return res.redirect(fallback); }
    } else brandCacheSet(key, buf);
  }
  res.set('Cache-Control', real ? 'public, max-age=86400' : 'no-cache').type('png').send(buf);
}));

// Manifest PWA por tienda (permite instalar el catálogo como app nativa)
app.get('/:slug/manifest.webmanifest', (req, res) => {
  const biz = getBusiness(req.params.slug);
  if (!biz || !biz.active) return res.status(404).end();
  const designTokens = catDesignOf(biz).tokens;
  const name = biz.name || 'Catálogo';
  res.set('Content-Type', 'application/manifest+json');
  res.set('Cache-Control', 'no-store');
  res.json({
    name,
    short_name: name.slice(0, 12),
    description: biz.description || ('Catálogo de ' + name),
    id: '/' + biz.slug,
    id: '/' + biz.slug,
    start_url: '/' + biz.slug,
    scope: '/' + biz.slug,
    display: 'standalone',
    orientation: 'portrait',
    background_color: designTokens.bg || '#ffffff',
    theme_color: designTokens.accent || '#17232d',
    lang: 'es',
    icons: true ? [
      { src: '/' + biz.slug + '/icon/192.png?v=' + brandVersion(biz), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/' + biz.slug + '/icon/512.png?v=' + brandVersion(biz), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/' + biz.slug + '/icon/512.png?v=' + brandVersion(biz), sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ] : [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  });
});

// Manifest dedicado al panel: al instalarlo desde administración abre el
// espacio de trabajo, no la vitrina pública de la tienda.
app.get('/:slug/admin/manifest.webmanifest', (req, res) => {
  const biz = getBusiness(req.params.slug);
  if (!biz || !biz.active) return res.status(404).end();
  const name = biz.name || 'Mi negocio';
  res.set('Content-Type', 'application/manifest+json');
  res.set('Cache-Control', 'no-store');
  res.json({
    name: 'Administrar · ' + name,
    short_name: ('Admin ' + name).slice(0, 12),
    description: 'Panel móvil para administrar ' + name,
    id: '/' + biz.slug + '/admin',
    start_url: '/' + biz.slug + '/admin/panel',
    scope: '/' + biz.slug + '/admin',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait-primary',
    background_color: '#f7f7f8',
    theme_color: '#f7f7f8',
    lang: 'es-MX',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  });
});

// ================= PREVIEW DE DISEÑO (panel admin) =================
// Renderiza el catálogo tal como quedaría con las opciones elegidas en el editor.
// Si la tienda aún no tiene productos, muestra productos de ejemplo para visualizar.
const PREVIEW_CATS = [
  { id: 1, name: 'Herramientas', sort: 1 },
  { id: 2, name: 'Pintura', sort: 2 },
  { id: 3, name: 'Plomería', sort: 3 }
];
const PREVIEW_PRODS = [
  { id: 1, category_id: 1, name: 'Martillo de uña 16oz', price: 189, old_price: 219, image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400', galeria: '["https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800","https://images.unsplash.com/photo-1517816743773-6e0fd518b4a6?w=400"]', description: 'Mango de fibra, cabeza forjada.', variants: '', featured: 1, category_name: 'Herramientas' },
  { id: 2, category_id: 1, name: 'Cinta métrica 5m', price: 129, old_price: null, image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400', galeria: '["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800"]', description: 'Con freno y clip de bolsillo.', variants: '', featured: 0, category_name: 'Herramientas' },
  { id: 3, category_id: 2, name: 'Pintura vinílica blanca 19L', price: 899, old_price: null, image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400', galeria: '[]', description: 'Cubriente, lavable, interior/exterior.', variants: '["Blanca","Marfil"]', featured: 1, category_name: 'Pintura' },
  { id: 4, category_id: 2, name: 'Brocha 3 pulgadas', price: 69, old_price: null, image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400', galeria: '[]', description: 'Cerda sintética, durabilidad alta.', variants: '', featured: 0, category_name: 'Pintura' },
  { id: 5, category_id: 3, name: 'Tubo PVC 1/2 pulgada 6m', price: 149, old_price: null, image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400', galeria: '["https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800"]', description: 'Cédula 40, uso hidráulico.', variants: '', featured: 0, category_name: 'Plomería' },
  { id: 6, category_id: 3, name: 'Llave de paso 1/2', price: 119, old_price: 149, image: 'https://images.unsplash.com/photo-1586864387734-d2ce3a8efa9e?w=400', galeria: '["https://images.unsplash.com/photo-1586864387734-d2ce3a8efa9e?w=800"]', description: 'Latón pulido, rosca estándar.', variants: '', featured: 0, category_name: 'Plomería' }
];

// Renderiza la vista previa del catálogo con las opciones elegidas (usada por el dueño y el maestro)
function previewCatalog(biz, q, res) {
  if (!biz) return res.status(404).send('Tienda no encontrada');
  const bizOv = {
    ...biz,
    template: TEMPLATES.includes(q.template) ? q.template : biz.template,
    color: COLORS.some(c => c.id === q.color) ? q.color : biz.color,
    color_hex: /^#[0-9a-fA-F]{6}$/.test(q.color_hex || '') ? q.color_hex : biz.color_hex,
    color_hex2: /^#[0-9a-fA-F]{6}$/.test(q.color_hex2 || '') ? q.color_hex2 : biz.color_hex2,
    color_mode: ['estilo', 'solido', 'degradado'].includes(q.color_mode) ? q.color_mode : biz.color_mode,
    grid_cols: [2, 3, 4].includes(Number(q.grid_cols)) ? Number(q.grid_cols) : biz.grid_cols,
    accent: /^#[0-9a-fA-F]{6}$/.test(q.accent || '') ? q.accent : biz.accent,
    accent2: /^#[0-9a-fA-F]{6}$/.test(q.accent2 || '') ? q.accent2 : biz.accent2,
    header: Object.prototype.hasOwnProperty.call(q, 'header') ? String(q.header || '').trim() : biz.header,
    header_text: Object.prototype.hasOwnProperty.call(q, 'header_text') ? String(q.header_text || '').trim() : biz.header_text,
    page_bg: /^#[0-9a-fA-F]{6}$/.test(q.page_bg || '') ? q.page_bg : biz.page_bg,
    logo: q.logo_clear ? '' : ((q.logo || '').trim() || biz.logo),
    banner: q.banner_clear ? '' : ((q.banner || '').trim() || biz.banner),
    sections: Object.prototype.hasOwnProperty.call(q, 'sections') ? String(q.sections) : biz.sections,
    blocks: Object.prototype.hasOwnProperty.call(q, 'blocks') ? String(q.blocks) : biz.blocks
  };
  const base = getEstilo(ESTILOS.some(e => e.id === q.estilo) ? q.estilo : biz.estilo);
  const eff = getEffectiveEstilo(biz);
  const font = (q.font && FONTS.some(f => f.css === q.font)) ? q.font : base.font;
  const pick = (v, d) => (v && String(v).trim()) ? v : d;
  const estilo = {
    ...base,
    bg: pick(q.bg, base.bg),
    card: pick(q.card, base.card),
    text: pick(q.text, base.text),
    muted: pick(q.muted, base.muted),
    border: pick(q.border, base.border),
    radius: pick(q.radius, base.radius),
    header: pick(q.header, base.header),
    headerText: pick(q.header_text, base.headerText),
    headerSet: !!(q.header && String(q.header).trim()) || eff.headerSet,
    font,
    fontLink: (FONTS.find(f => f.css === font) || {}).link || base.fontLink
  };
  const pal = getPalette(bizOv, estilo);
  const { categories, products, pages } = getCatalog(biz.id);
  const useDemo = q.demo === '1';
  let cats = categories, prods = products;
  if (useDemo) {
    const dc = demoCatalog(biz, q.demo_content);
    cats = dc.categories; prods = dc.products;
    if (dc.name && dc.name !== biz.name) bizOv.name = dc.name;
    if (dc.description && dc.description !== biz.description) bizOv.description = dc.description;
  } else if (categories.length === 0) {
    cats = PREVIEW_CATS;
    prods = PREVIEW_PRODS;
  }
  prods = prods.map(p => { p.imgs = productImgs(p); return p; });
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  app.render('catalog', { biz: bizOv, categories: cats, products: prods, estilo, catDesign: catDesignOf(biz).id, catDesignTokens: catDesignOf(biz).tokens, theme: getTemplateTheme(bizOv.template), components: q.edit === '1' ? parseComponents(bizOv) : getComponents(bizOv), pages, editMode: q.edit === '1', seoUrl: '', money: moneyFor(biz), currencySymbol: currencyInfo(biz.currency).symbol, currencyCode: biz.currency, mascaraCss: MASCARA_CSS, mascaraConfig: { MASCARA_SIZES, SHAPE_DEFS, getShapeClip } }, (err, html) => {
    if (err) return sendErrorPage(res, err);
    try { res.send(finishCatalog(html, bizOv, pal, estilo)); } catch (e) { sendErrorPage(res, e); }
  });
}

app.get('/:slug/admin/preview', requireAuth, (req, res) => {
  previewCatalog(getBusiness(req.params.slug), req.query, res);
});

// Vista previa de diseño desde el panel maestro
app.get('/maestro/:id/preview', maestroAuth, (req, res) => {
  previewCatalog(db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id), req.query, res);
});

// ================= PEDIDO POR WHATSAPP =================
app.get('/:slug/pedir', (req, res) => {
  const biz = getBusiness(req.params.slug);
  if (!biz) return res.status(404).json({ error: 'Tienda no encontrada' });

  let items = [];
  try { items = JSON.parse(req.query.items || '[]'); } catch (e) { items = []; }
  const customerName = (req.query.nombre || '').toString().trim();
  const customerPhone = (req.query.telefono || '').toString().trim().replace(/[^0-9]/g, '');
  let total = 0;
  let hasInstallment = false;
  let instProduct = null;
  const lines = items.map((it) => {
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ?').get(it.id, biz.id);
    if (!p) return null;
    const qty = Math.max(1, parseInt(it.qty) || 1);
    const sub = p.price * qty;
    total += sub;
    track(biz.id, 'view', p.name);
    track(biz.id, 'wa_product', p.name);
    const variant = it.variant ? ` (${it.variant})` : '';
    if (p.allow_installments) { hasInstallment = true; instProduct = p; }
    return `• ${qty} x ${p.name}${variant} = ${currencyInfo(biz.currency).symbol}${sub.toFixed(2)}`;
  }).filter(Boolean);

  if (lines.length === 0) return res.redirect('/' + req.params.slug);

  const instInfo = hasInstallment ? { isInstallment: true, count: instProduct.installment_count || 6, frequency: instProduct.installment_frequency || 'semanal', minDown: instProduct.installment_min_down || 0 } : null;
  let message = buildOrderMessage(biz.name, lines, total, biz.wa_message, currencyInfo(biz.currency).symbol, instInfo);
  if (customerName) message += `\n\nMi nombre: ${customerName}`;
  if (customerPhone) message += `\nMi teléfono: ${customerPhone}`;
  const okItems = items.filter(it => it && parseInt(it.id) > 0).slice(0, 12);
  if (okItems.length) message += `\n\n📸 Fotos de mi pedido:\n${absoluteStoreUrl(req, biz)}/pedido?ids=${okItems.map(it => parseInt(it.id)).join(',')}&q=${okItems.map(it => Math.max(1, parseInt(it.qty) || 1)).join(',')}`;

  const customerData = customerName ? (customerName + (customerPhone ? ' (' + customerPhone + ')' : '')) : (customerPhone || '');
  db.prepare(
    `INSERT INTO orders (business_id, items, total, customer_name, customer_phone, status, is_installment, installment_count, installment_frequency) VALUES (?, ?, ?, ?, ?, 'nuevo', ?, ?, ?)`
  ).run(biz.id, lines.join(' | '), total, customerData, customerPhone, hasInstallment ? 1 : 0, hasInstallment ? (instProduct.installment_count || 6) : 0, hasInstallment ? (instProduct.installment_frequency || 'semanal') : 'semanal');
  upsertCustomer(biz.id, customerName, customerPhone);
  track(biz.id, 'wa', 'pedido');

  res.redirect(waLink(biz, message));
});


// ================= PEDIDO CON FOTOS =================
// wa.me no permite adjuntar imágenes: lo que sí hace WhatsApp es mostrar una tarjeta con foto
// (Open Graph) del primer enlace del mensaje. Cada pedido incluye un enlace a esta página, cuya
// imagen de vista previa es un collage con los productos pedidos; quien recibe el mensaje ve las
// fotos en el chat y, al abrir el enlace, el detalle con foto, cantidad y precio de cada producto.
const _pedidoImgCache = new Map();
function pedidoItems(biz, q) {
  const ids = String(q.ids || '').split(',').map(x => parseInt(x, 10)).filter(x => x > 0).slice(0, 12);
  const qtys = String(q.q || '').split(',').map(x => Math.max(1, Math.min(999, parseInt(x, 10) || 1)));
  if (!ids.length) return [];
  const rows = db.prepare('SELECT * FROM products WHERE business_id = ? AND active = 1 AND id IN (' + ids.map(() => '?').join(',') + ')').all(biz.id, ...ids);
  return ids.map((id, i) => {
    const p = rows.find(r => r.id === id);
    if (!p) return null;
    p.imgs = productImgs(p);
    return { p, qty: qtys[i] || 1 };
  }).filter(Boolean);
}
async function pedidoLoadImage(src) {
  if (!src) return null;
  try {
    if (/^https?:\/\//i.test(src)) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 5000);
      const r = await fetch(src, { signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) return null;
      const ab = await r.arrayBuffer();
      return ab.byteLength > 8e6 ? null : Buffer.from(ab);
    }
    const root = path.join(__dirname, 'public');
    const abs = path.join(root, src.split('?')[0].replace(/^\/+/, ''));
    if (!abs.startsWith(root)) return null;
    return require('fs').readFileSync(abs);
  } catch (e) { return null; }
}
async function pedidoCollage(items) {
  const W = 1200, H = 630, gap = 24;
  const bufs = (await Promise.all(items.slice(0, 4).map(it => pedidoLoadImage(it.imgSrc || it.p.imgs[0])))).filter(Boolean);
  if (!bufs.length) return null;
  const bg = await sharp(bufs[0], { density: 200 }).resize(W, H, { fit: 'cover' }).blur(30).modulate({ brightness: 0.55 }).png().toBuffer();
  const n = bufs.length;
  const size = Math.min(H - 60, Math.floor((W - gap * (n + 1)) / n));
  const x0 = Math.round((W - (n * size + (n - 1) * gap)) / 2);
  const y = Math.round((H - size) / 2);
  const mask = Buffer.from('<svg width="' + size + '" height="' + size + '"><rect width="' + size + '" height="' + size + '" rx="26" ry="26"/></svg>');
  const layers = [];
  for (let i = 0; i < n; i++) {
    try {
      const tile = await sharp(bufs[i], { density: 200 }).resize(size, size, { fit: 'cover' }).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
      layers.push({ input: tile, left: x0 + i * (size + gap), top: y });
    } catch (e) { /* una foto ilegible no tumba el collage */ }
  }
  if (!layers.length) return null;
  return sharp(bg).composite(layers).jpeg({ quality: 82 }).toBuffer();
}
app.get('/:slug/pedido-img', ah(async (req, res) => {
  const biz = getBusiness(req.params.slug);
  if (!biz || !biz.active) return res.status(404).end();
  const items = pedidoItems(biz, req.query);
  if (!items.length) return res.status(404).end();
  const key = biz.slug + ':' + items.map(it => it.p.id + '-' + (it.p.image || '')).join(',');
  let buf = _pedidoImgCache.get(key);
  if (!buf) {
    buf = await pedidoCollage(items);
    if (!buf) return res.status(404).end();
    if (_pedidoImgCache.size > 150) _pedidoImgCache.delete(_pedidoImgCache.keys().next().value);
    _pedidoImgCache.set(key, buf);
  }
  res.set('Cache-Control', 'public, max-age=86400').type('jpeg').send(buf);
}));
app.get('/:slug/pedido', (req, res, next) => {
  const biz = getBusiness(req.params.slug);
  if (!biz || !biz.active) return res.status(404).render('404', { message: 'Tienda no encontrada o desactivada' });
  const items = pedidoItems(biz, req.query);
  if (!items.length) return res.redirect('/' + biz.slug);
  const qs = 'ids=' + items.map(it => it.p.id).join(',') + '&q=' + items.map(it => it.qty).join(',');
  const total = items.reduce((s, it) => s + it.p.price * it.qty, 0);
  const base = absoluteStoreUrl(req, biz);
  res.set('Cache-Control', 'no-store');
  app.render('pedido-fotos', {
    biz, items, total, ogUrl: base + '/pedido?' + qs, ogImage: base + '/pedido-img?' + qs,
    catDesign: catDesignOf(biz).id, catDesignTokens: catDesignOf(biz).tokens,
    money: moneyFor(biz)
  }, (err, html) => { if (err) return next(err); res.send(html); });
});
// ================= PAGO EN LÍNEA (MERCADO PAGO — CHECKOUT PRO) =================
// Cada tienda usa su propia cuenta/Access Token (guardado en businesses.mp_access_token,
// ver Configuración → Pagos en línea) — nunca una cuenta central compartida.
function mpAbsUrl(req, path) {
  return (BASE_URL ? BASE_URL : req.protocol + '://' + req.get('host')) + path;
}
async function mpFetch(token, path, options) {
  const resp = await fetch('https://api.mercadopago.com' + path, Object.assign({
    headers: Object.assign({ 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, (options && options.headers) || {})
  }, options || {}));
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

// ===== Mercado Pago Marketplace (OAuth): cada negocio conecta SU cuenta con un botón y el dinero
// le llega directo; la plataforma puede cobrar una comisión (MP_FEE_PERCENT, por defecto 0 %). =====
const MP_CLIENT_ID = String(process.env.MP_CLIENT_ID || '').trim();
const MP_CLIENT_SECRET = String(process.env.MP_CLIENT_SECRET || '').trim();
const MP_FEE_PERCENT = Math.max(0, Math.min(30, parseFloat(process.env.MP_FEE_PERCENT) || 0));
function mpFee(total) { return MP_FEE_PERCENT > 0 ? Math.round(total * MP_FEE_PERCENT) / 100 : 0; }
function mpOauthReady() { return !!(MP_CLIENT_ID && MP_CLIENT_SECRET); }
function mpRedirectUri(req) { return mpAbsUrl(req, '/mp/oauth'); }
async function mpTokenRequest(params) {
  const r = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(Object.assign({ client_id: MP_CLIENT_ID, client_secret: MP_CLIENT_SECRET }, params))
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok && !!data.access_token, data };
}
function mpSaveTokens(bizId, d) {
  const exp = d.expires_in ? new Date(Date.now() + Number(d.expires_in) * 1000).toISOString() : '';
  db.prepare("UPDATE businesses SET mp_access_token = ?, mp_refresh_token = ?, mp_public_key = COALESCE(NULLIF(?, ''), mp_public_key), mp_user_id = ?, mp_connected = 1, mp_enabled = 1, mp_token_expires = ? WHERE id = ?")
    .run(String(d.access_token), String(d.refresh_token || ''), String(d.public_key || ''), String(d.user_id || ''), exp, bizId);
}
app.get('/:slug/admin/mp/conectar', requireAuth, can('config'), (req, res) => {
  if (!mpOauthReady()) return res.redirect('/' + req.biz.slug + '/admin/config?error=' + encodeURIComponent('La conexión con Mercado Pago aún no está configurada en el servidor'));
  const state = req.biz.slug + '.' + crypto.randomBytes(16).toString('hex');
  res.cookie('mpstate', state, { httpOnly: true, sameSite: 'lax', maxAge: 15 * 60 * 1000, secure: req.secure });
  res.redirect('https://auth.mercadopago.com.mx/authorization?client_id=' + encodeURIComponent(MP_CLIENT_ID) +
    '&response_type=code&platform_id=mp&state=' + encodeURIComponent(state) + '&redirect_uri=' + encodeURIComponent(mpRedirectUri(req)));
});
app.get('/mp/oauth', ah(async (req, res) => {
  const state = String(req.query.state || '');
  const slug = state.split('.')[0];
  const back = (msg, ok) => res.redirect('/' + slug + '/admin/config?' + (ok ? 'ok=' : 'error=') + encodeURIComponent(msg) + '#config-pagos');
  const biz = slug ? getBusiness(slug) : null;
  if (!biz || !state || state !== (req.cookies && req.cookies.mpstate)) return res.status(400).send('Solicitud no válida. Vuelve a intentarlo desde Configuración.');
  res.clearCookie('mpstate');
  if (req.query.error || !req.query.code) return back('No se conectó la cuenta de Mercado Pago');
  const t = await mpTokenRequest({ grant_type: 'authorization_code', code: String(req.query.code), redirect_uri: mpRedirectUri(req) });
  if (!t.ok) { console.error('MP OAuth falló:', JSON.stringify(t.data).slice(0, 300)); return back('Mercado Pago no aceptó la conexión. Intenta de nuevo'); }
  mpSaveTokens(biz.id, t.data);
  back('Mercado Pago conectado. Ya puedes cobrar en línea', true);
}));
app.post('/:slug/admin/mp/desconectar', requireAuth, can('config'), (req, res) => {
  db.prepare("UPDATE businesses SET mp_access_token = '', mp_refresh_token = '', mp_public_key = '', mp_user_id = '', mp_connected = 0, mp_enabled = 0, mp_token_expires = '' WHERE id = ?").run(req.biz.id);
  res.redirect('/' + req.biz.slug + '/admin/config?ok=' + encodeURIComponent('Mercado Pago desconectado') + '#config-pagos');
});
// Los tokens de OAuth duran ~6 meses: se renuevan solos cuando faltan menos de 30 días
async function mpRefreshTokens() {
  if (!mpOauthReady()) return;
  try {
    const rows = db.prepare("SELECT id, mp_refresh_token, mp_token_expires FROM businesses WHERE mp_connected = 1 AND mp_refresh_token != ''").all();
    for (const b of rows) {
      const exp = b.mp_token_expires ? Date.parse(b.mp_token_expires) : 0;
      if (exp && exp - Date.now() > 30 * 86400000) continue;
      const t = await mpTokenRequest({ grant_type: 'refresh_token', refresh_token: b.mp_refresh_token });
      if (t.ok) mpSaveTokens(b.id, t.data); else console.error('MP: no se pudo renovar el token de la tienda', b.id);
    }
  } catch (e) { console.error('MP refresh:', e.message); }
}
setTimeout(mpRefreshTokens, 30000);
setInterval(mpRefreshTokens, 24 * 3600 * 1000);

app.get('/:slug/pagar-mp', async (req, res) => {
  const biz = getBusiness(req.params.slug);
  if (!biz) return res.status(404).json({ error: 'Tienda no encontrada' });
  if (!biz.mp_enabled || !biz.mp_access_token) return res.status(400).json({ error: 'Esta tienda no tiene pago en línea activado' });

  let items = [];
  try { items = JSON.parse(req.query.items || '[]'); } catch (e) { items = []; }
  const customerName = (req.query.nombre || '').toString().trim();
  const customerPhone = (req.query.telefono || '').toString().trim().replace(/[^0-9]/g, '');
  let total = 0;
  const mpItems = [];
  const lines = items.map((it) => {
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ?').get(it.id, biz.id);
    if (!p) return null;
    const qty = Math.max(1, parseInt(it.qty) || 1);
    const sub = p.price * qty;
    total += sub;
    const variant = it.variant ? ` (${it.variant})` : '';
    mpItems.push({ title: (p.name + variant).slice(0, 250), quantity: qty, unit_price: Number(p.price), currency_id: biz.currency || 'MXN' });
    return `• ${qty} x ${p.name}${variant} = ${currencyInfo(biz.currency).symbol}${sub.toFixed(2)}`;
  }).filter(Boolean);
  if (lines.length === 0) return res.redirect('/' + req.params.slug);

  const customerData = customerName ? (customerName + (customerPhone ? ' (' + customerPhone + ')' : '')) : (customerPhone || '');
  const orderId = db.prepare(
    `INSERT INTO orders (business_id, items, total, customer_name, customer_phone, status) VALUES (?, ?, ?, ?, ?, 'nuevo')`
  ).run(biz.id, lines.join(' | '), total, customerData, customerPhone).lastInsertRowid;
  upsertCustomer(biz.id, customerName, customerPhone);

  const storeUrl = mpAbsUrl(req, '/' + biz.slug);
  const pref = {
    items: mpItems,
    external_reference: String(orderId),
    back_urls: { success: storeUrl + '?pago=exito', failure: storeUrl + '?pago=fallo', pending: storeUrl + '?pago=pendiente' },
    auto_return: 'approved',
    notification_url: mpAbsUrl(req, '/webhooks/mercadopago?slug=' + encodeURIComponent(biz.slug))
  };
  if (biz.mp_connected && mpFee(total) > 0) pref.marketplace_fee = mpFee(total);
  const { ok, data } = await mpFetch(biz.mp_access_token, '/checkout/preferences', { method: 'POST', body: JSON.stringify(pref) });
  if (!ok || !data.init_point) {
    console.error('Error creando preferencia de Mercado Pago:', data);
    return res.redirect('/' + req.params.slug + '?pago=error');
  }
  track(biz.id, 'mp', 'pedido');
  res.redirect(data.init_point);
});

// Precio real de una línea: el del producto, o el de la variante elegida (la etiqueta llega como "A / B")
function pagoUnitPrice(p, variantLabel) {
  withPromo(p);
  let price = Number(p.price) || 0;
  const label = String(variantLabel || '').trim();
  if (label) {
    const vm = parseVariantModel(p.variants);
    const key = label.split(' / ').map(x => x.trim()).join('|');
    if (vm && vm.prices && vm.prices[key] !== undefined && vm.prices[key] !== '' && !isNaN(Number(vm.prices[key]))) price = Number(vm.prices[key]);
  }
  return price;
}
const MP_DETAIL_ES = {
  cc_rejected_insufficient_amount: 'Fondos insuficientes en la tarjeta.',
  cc_rejected_bad_filled_card_number: 'Revisa el número de tarjeta.',
  cc_rejected_bad_filled_date: 'Revisa la fecha de vencimiento.',
  cc_rejected_bad_filled_security_code: 'Revisa el código de seguridad (CVV).',
  cc_rejected_bad_filled_other: 'Revisa los datos de la tarjeta.',
  cc_rejected_call_for_authorize: 'Tu banco necesita que autorices este pago: llámales y vuelve a intentar.',
  cc_rejected_card_disabled: 'La tarjeta está desactivada. Llama a tu banco.',
  cc_rejected_blacklist: 'No pudimos procesar esta tarjeta.',
  cc_rejected_duplicated_payment: 'Ya hiciste un pago igual hace un momento.',
  cc_rejected_high_risk: 'El pago fue rechazado por seguridad. Prueba con otra tarjeta.',
  cc_rejected_max_attempts: 'Llegaste al límite de intentos. Prueba con otra tarjeta.'
};

// Pago con tarjeta DENTRO de la app (Mercado Pago · Card Payment Brick). La tarjeta la tokeniza el navegador con la clave
// pública de la tienda: este servidor solo recibe el token, recalcula el total desde la base y crea el pago con el
// Access Token de esa tienda. Nunca ve ni guarda datos de tarjeta.
app.post('/:slug/pagar-tarjeta', rateLimit(12), async (req, res) => {
  const biz = getBusiness(req.params.slug);
  if (!biz || !biz.active) return res.status(404).json({ ok: false, error: 'Tienda no encontrada' });
  if (!biz.mp_enabled || !biz.mp_access_token || !biz.mp_public_key) return res.status(400).json({ ok: false, error: 'Esta tienda no tiene el pago con tarjeta activado' });
  const body = req.body || {};
  const fd = body.formData || {};
  if (!fd.token || !fd.payment_method_id) return res.status(400).json({ ok: false, error: 'Faltan los datos de la tarjeta' });
  const items = Array.isArray(body.items) ? body.items.slice(0, 40) : [];
  const customerName = String(body.nombre || '').trim().slice(0, 80);
  const customerPhone = String(body.telefono || '').replace(/[^0-9]/g, '').slice(0, 15);
  let total = 0;
  const lines = items.map((it) => {
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ? AND active = 1').get(parseInt(it && it.id) || 0, biz.id);
    if (!p) return null;
    const qty = Math.max(1, Math.min(999, parseInt(it.qty) || 1));
    const unit = pagoUnitPrice(p, it.variant);
    const sub = unit * qty;
    total += sub;
    const variant = it.variant ? ' (' + String(it.variant).slice(0, 80) + ')' : '';
    return `• ${qty} x ${p.name}${variant} = ${currencyInfo(biz.currency).symbol}${sub.toFixed(2)}`;
  }).filter(Boolean);
  total = Math.round(total * 100) / 100;
  if (!lines.length || !(total > 0)) return res.status(400).json({ ok: false, error: 'El carrito está vacío' });
  const clientTotal = Number(fd.transaction_amount);
  if (isFinite(clientTotal) && Math.abs(clientTotal - total) > 0.5) return res.status(409).json({ ok: false, error: 'El total cambió (' + currencyInfo(biz.currency).symbol + total.toFixed(2) + '). Cierra esta ventana, revisa tu carrito y vuelve a intentar.' });

  const customerData = customerName ? (customerName + (customerPhone ? ' (' + customerPhone + ')' : '')) : (customerPhone || '');
  const orderId = db.prepare(
    `INSERT INTO orders (business_id, items, total, customer_name, customer_phone, status) VALUES (?, ?, ?, ?, ?, 'nuevo')`
  ).run(biz.id, lines.join(' | '), total, customerData, customerPhone).lastInsertRowid;
  upsertCustomer(biz.id, customerName, customerPhone);

  const payload = {
    transaction_amount: total,
    token: String(fd.token),
    description: ('Pedido #' + orderId + ' · ' + biz.name).slice(0, 200),
    ...((biz.mp_connected && mpFee(total) > 0) ? { application_fee: mpFee(total) } : {}),
    installments: Math.max(1, parseInt(fd.installments) || 1),
    payment_method_id: String(fd.payment_method_id),
    payer: { email: String((fd.payer && fd.payer.email) || '').trim().slice(0, 120) },
    external_reference: String(orderId),
    notification_url: mpAbsUrl(req, '/webhooks/mercadopago?slug=' + encodeURIComponent(biz.slug))
  };
  if (fd.issuer_id) payload.issuer_id = Number(fd.issuer_id) || String(fd.issuer_id);
  if (fd.payer && fd.payer.identification && fd.payer.identification.number) payload.payer.identification = { type: String(fd.payer.identification.type || ''), number: String(fd.payer.identification.number || '') };
  if (!payload.payer.email) {
    db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
    return res.status(400).json({ ok: false, error: 'Escribe tu correo para recibir el comprobante' });
  }

  let result;
  try {
    result = await mpFetch(biz.mp_access_token, '/v1/payments', { method: 'POST', body: JSON.stringify(payload), headers: { 'X-Idempotency-Key': crypto.randomUUID() } });
  } catch (e) {
    console.error('Error de red con Mercado Pago:', e.message);
    db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
    return res.status(502).json({ ok: false, error: 'No pudimos comunicarnos con Mercado Pago. Intenta de nuevo.' });
  }
  const pay = result.data || {};
  if (!result.ok || !pay.status) {
    console.error('Mercado Pago rechazó crear el pago:', result.status, JSON.stringify(pay).slice(0, 400));
    db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
    return res.status(400).json({ ok: false, error: 'No se pudo procesar el pago. Revisa los datos de la tarjeta.' });
  }
  db.prepare('UPDATE orders SET mp_payment_id = ?, mp_status = ? WHERE id = ?').run(String(pay.id || ''), pay.status, orderId);
  track(biz.id, 'mp', 'pedido');
  if (pay.status === 'approved') {
    db.prepare("UPDATE orders SET paid = 1, paid_at = datetime('now'), status = 'pagado' WHERE id = ?").run(orderId);
    notifyOwnerPaid(biz, orderId);
    return res.json({ ok: true, status: 'approved', orderId, total });
  }
  if (pay.status === 'in_process' || pay.status === 'pending') {
    return res.json({ ok: true, status: pay.status, orderId, total }); // el webhook lo marca pagado cuando se apruebe
  }
  db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
  return res.status(402).json({ ok: false, status: pay.status, error: MP_DETAIL_ES[pay.status_detail] || 'La tarjeta fue rechazada. Prueba con otra tarjeta.' });
});

// Aviso al dueño por WhatsApp cuando un pedido se paga en línea (WhatsApp Business Cloud API de Meta).
// Requiere WA_TOKEN y WA_PHONE_ID en el entorno; opcional WA_TEMPLATE (+ WA_TEMPLATE_LANG) para avisar
// fuera de la ventana de 24 h (plantilla con 4 variables: pedido, cliente, total, productos).
async function notifyOwnerPaid(biz, orderId) {
  try {
    const token = process.env.WA_TOKEN, phoneId = process.env.WA_PHONE_ID;
    const raw = String(biz.whatsapp || '').replace(/[^0-9]/g, '');
    if (!token || !phoneId || !raw) { console.log('[pago] pedido #' + orderId + ' pagado; aviso de WhatsApp no configurado'); return; }
    const to = raw.length === 10 ? '52' + raw : raw;
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!o) return;
    const money = currencyInfo(biz.currency).symbol + Number(o.total || 0).toFixed(2);
    const items = String(o.items || '').replace(/\s*\|\s*/g, '\n');
    const cust = o.customer_name || 'Cliente';
    const tpl = process.env.WA_TEMPLATE;
    const body = tpl
      ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: tpl, language: { code: process.env.WA_TEMPLATE_LANG || 'es_MX' }, components: [{ type: 'body', parameters: [String(orderId), cust, money, items.replace(/\n/g, ', ')].map(t => ({ type: 'text', text: String(t).slice(0, 900) })) }] } }
      : { messaging_product: 'whatsapp', to, type: 'text', text: { body: '✅ Pago recibido — Pedido #' + orderId + '\nCliente: ' + cust + '\nTotal: ' + money + '\n\n' + items } };
    const r = await fetch('https://graph.facebook.com/v20.0/' + phoneId + '/messages', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) console.error('WhatsApp aviso falló:', r.status, (await r.text()).slice(0, 300));
  } catch (e) { console.error('Error avisando por WhatsApp:', e.message); }
}

// Notificación de pago de Mercado Pago — confirma vía su API (nunca se confía
// en el body del webhook a secas: cualquiera podría mandar un POST falso).
app.post('/webhooks/mercadopago', async (req, res) => {
  res.sendStatus(200); // ack inmediato — MP reintenta si tarda o si no responde 2xx
  try {
    const slug = String(req.query.slug || '').trim();
    const biz = slug ? getBusiness(slug) : null;
    if (!biz || !biz.mp_access_token) return;
    const paymentId = (req.body && req.body.data && req.body.data.id) || req.query['data.id'] || req.query.id;
    if (!paymentId) return;
    const { ok, data: payment } = await mpFetch(biz.mp_access_token, '/v1/payments/' + paymentId, { method: 'GET' });
    if (!ok || !payment.external_reference) return;
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND business_id = ?').get(payment.external_reference, biz.id);
    if (!order) return;
    db.prepare('UPDATE orders SET mp_payment_id = ?, mp_status = ? WHERE id = ?').run(String(paymentId), payment.status || '', order.id);
    if (payment.status === 'approved' && !order.paid) {
      db.prepare("UPDATE orders SET paid = 1, paid_at = datetime('now'), status = 'pagado' WHERE id = ?").run(order.id);
      notifyOwnerPaid(biz, order.id);
    }
  } catch (e) {
    console.error('Error procesando webhook de Mercado Pago:', e);
  }
});
// MP a veces también prueba la notification_url con GET al configurarla.
app.get('/webhooks/mercadopago', (req, res) => res.sendStatus(200));

// Pedido multi-tienda (chatbox): registra un pedido por tienda y devuelve sus wa.me
app.post('/api/pedir', (req, res) => {
  const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
  const nombre = String((req.body && req.body.nombre) || '').trim();
  const telefono = String((req.body && req.body.telefono) || '').replace(/[^0-9]/g, '');
  const byStore = {};
  for (const it of items) {
    const slug = String((it && it.store) || '').trim();
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(parseInt(it && it.id) || 0);
    if (!p || !slug) continue;
    const b = db.prepare('SELECT * FROM businesses WHERE slug = ? AND active = 1').get(slug);
    if (!b || b.id !== p.business_id) continue;
    const qty = Math.max(1, parseInt(it.qty) || 1);
    (byStore[slug] = byStore[slug] || []).push({ p, qty, variant: String(it.variant || '') });
  }
  const orders = Object.keys(byStore).map((slug) => {
    const list = byStore[slug];
    const b = getBusiness(slug);
    let total = 0;
    let hasInst = false;
    let instP = null;
    const lines = list.map((x) => {
      const sub = x.p.price * x.qty;
      total += sub;
      if (x.p.allow_installments) { hasInst = true; instP = x.p; }
      track(b.id, 'view', x.p.name);
      track(b.id, 'wa_product', x.p.name);
      return `• ${x.qty} x ${x.p.name}${x.variant ? ` (${x.variant})` : ''} = $${sub.toFixed(2)}`;
    });
    if (lines.length) {
      const customerData = nombre ? (nombre + (telefono ? ' (' + telefono + ')' : '')) : (telefono || '');
      db.prepare(
        `INSERT INTO orders (business_id, items, total, customer_name, customer_phone, status, is_installment, installment_count, installment_frequency) VALUES (?, ?, ?, ?, ?, 'nuevo', ?, ?, ?)`
      ).run(b.id, lines.join(' | '), total, customerData, telefono, hasInst ? 1 : 0, hasInst ? (instP.installment_count || 6) : 0, hasInst ? (instP.installment_frequency || 'semanal') : 'semanal');
      upsertCustomer(b.id, nombre, telefono);
      track(b.id, 'wa', 'pedido');
    }
    const instInfo = hasInst ? { isInstallment: true, count: instP.installment_count || 6, frequency: instP.installment_frequency || 'semanal', minDown: instP.installment_min_down || 0 } : null;
    const message = buildOrderMessage(b.name, lines, total, b.wa_message, currencyInfo(b.currency).symbol, instInfo);
    return { slug, name: b.name, whatsapp: b.whatsapp, url: waLink(b, message) };
  });
  res.json({ orders });
});

// ================= AUTENTICACIÓN DEL DUEÑO =================
// Hash de PIN con scrypt (sal + hash hex)
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPin(pin, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  try {
    const test = crypto.scryptSync(String(pin), salt, 64);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), test);
  } catch (e) { return false; }
}
// Sesión con token aleatorio (se guarda en la tabla sessions)
function createSession(bizId, kind, empId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare('INSERT INTO sessions (token, biz_id, kind, emp_id, expires_at) VALUES (?, ?, ?, ?, ?)').run(token, bizId || null, kind || 'owner', empId || null, expiresAt);
  return token;
}
function findSession(token) {
  if (!token) return null;
  const sess = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (sess && sess.expires_at && new Date(sess.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return sess;
}
// Sesión deslizante: cada request autenticado empuja el vencimiento otros 30
// días hacia adelante, tanto en la tabla `sessions` como en la cookie del
// navegador — así solo se cierra sesión con logout explícito o 30 días de
// inactividad total, nunca "a las 12 horas en punto" sin importar el uso.
function touchSession(res, token) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').run(expiresAt, token);
  res.cookie('sid', token, { maxAge: SESSION_TTL_MS, httpOnly: true, sameSite: 'lax', path: '/', secure: res.req.secure });
}
function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// Permisos disponibles para empleados (granulares por módulo y acción)
const EMPLOYEE_PERMS = [
  { key: 'productos.ver', module: 'Productos', label: 'Ver productos' },
  { key: 'productos.crear', module: 'Productos', label: 'Crear productos' },
  { key: 'productos.editar', module: 'Productos', label: 'Editar productos' },
  { key: 'productos.eliminar', module: 'Productos', label: 'Eliminar productos' },
  { key: 'categorias.gestionar', module: 'Catálogo', label: 'Gestionar categorías (crear/editar/borrar)' },
  { key: 'atributos.gestionar', module: 'Catálogo', label: 'Gestionar atributos (crear/editar/borrar)' },
  { key: 'pedidos.gestionar', module: 'Pedidos', label: 'Gestionar pedidos (entregar/cancelar)' },
  { key: 'clientes', module: 'Clientes', label: 'Ver y gestionar clientes' },
  { key: 'reportes', module: 'Panel', label: 'Ver panel y reportes' },
  { key: 'diseno', module: 'Diseño', label: 'Editar diseño' },
  { key: 'config', module: 'Configuración', label: 'Editar configuración' }
];
const ALL_PERMS = EMPLOYEE_PERMS.map(p => p.key).concat(['empleados']);
function permsOf(sess) {
  if (sess.kind === 'owner') return ALL_PERMS.slice();
  const emp = sess.emp_id ? db.prepare('SELECT * FROM employees WHERE id = ?').get(sess.emp_id) : null;
  if (!emp) return [];
  try { return JSON.parse(emp.perms || '[]'); } catch (e) { return []; }
}

function requireAuth(req, res, next) {
  const biz = getBusiness(req.params.slug);
  if (!biz) return res.status(404).render('404', { message: 'Tienda no encontrada' });
  const block = storeBlock(biz);
  if (block.blocked) {
    return res.status(403).render('store-off', { biz, reason: block.reason });
  }
  const sess = findSession(req.cookies && req.cookies.sid);
  if (sess && sess.biz_id === biz.id && (sess.kind === 'owner' || sess.kind === 'employee')) {
    touchSession(res, sess.token);
    req.biz = biz;
    req.role = sess.kind;
    req.perms = permsOf(sess);
    if (sess.kind === 'employee') {
      req.emp = db.prepare('SELECT * FROM employees WHERE id = ? AND business_id = ?').get(sess.emp_id, biz.id);
      if (!req.emp) return res.redirect('/' + req.params.slug + '/admin');
    }
    res.locals.money = moneyFor(biz);
    res.locals.currencySymbol = currencyInfo(biz.currency).symbol;
    res.locals.currencyCode = biz.currency;
    res.locals.canDesign = designAllowed(biz);
    res.locals.isEmployee = req.role === 'employee';
    res.locals.empName = req.emp ? req.emp.name : '';
    res.locals.perms = req.perms;
    res.locals.lowStockCount = db.prepare("SELECT COUNT(*) AS c FROM products WHERE business_id = ? AND active = 1 AND made_to_order = 0 AND (stock IS NULL OR stock <= 5)").get(biz.id).c;
    return next();
  }
  const next_ = encodeURIComponent(req.originalUrl || ('/' + req.params.slug + '/admin'));
  res.redirect('/' + req.params.slug + '/admin?sesion=1&next=' + next_);
}

// Middleware: exige un permiso concreto (los dueños siempre pasan). Acepta string o array (basta con uno).
function can(perm) {
  const need = Array.isArray(perm) ? perm : [perm];
  return (req, res, next) => {
    if (!req.perms || need.some(p => req.perms.includes(p))) return next();
    // Peticiones AJAX/API/JSON: respuesta JSON; páginas: vista amigable con qué hacer.
    if (req.path.startsWith('/api') || req.get('x-csrf-token') || (req.get('accept') || '').includes('application/json')) {
      return res.status(403).json({ error: 'No tienes permiso para hacer esto.', permiso: need[0] });
    }
    const labels = EMPLOYEE_PERMS.filter(p => req.perms.includes(p.key)).map(p => p.label);
    const home = firstEmployeePage(req.perms);
    return res.status(403).render('403', {
      biz: req.biz,
      empName: req.emp ? req.emp.name : '',
      permsLabels: labels,
      home: home ? '/' + req.biz.slug + '/admin' + home : null
    });
  };
}

// Primera página a la que puede entrar un empleado según sus permisos (null = sin permisos)
function firstEmployeePage(perms) {
  const P = (p) => perms.includes(p);
  if (P('reportes') || P('pedidos.gestionar')) return '/panel';
  if (P('productos.ver')) return '/productos';
  if (P('clientes')) return '/clientes';
  if (P('config')) return '/config';
  if (P('empleados')) return '/empleados';
  if (P('diseno')) return '/diseno';
  return null;
}

app.get('/:slug/admin', (req, res) => {
  const biz = getBusiness(req.params.slug);
  if (!biz) return res.status(404).render('404', { message: 'Tienda no encontrada' });
  const block = storeBlock(biz);
  if (block.blocked) return res.status(403).render('store-off', { biz, reason: block.reason });
  // Ya tiene sesión válida para esta tienda (p.ej. volvió desde el catálogo
  // con el botón "Panel"): mandarlo directo al panel en vez de pedirle el
  // PIN de nuevo — antes esta ruta siempre mostraba el login sin checar la
  // cookie "sid", así que la sesión "se perdía" aunque siguiera activa.
  const sess = findSession(req.cookies && req.cookies.sid);
  if (sess && sess.biz_id === biz.id && (sess.kind === 'owner' || sess.kind === 'employee') && !req.query.salir) {
    touchSession(res, sess.token);
    return res.redirect('/' + req.params.slug + '/admin/panel');
  }
  const pal = getPalette(biz, getEffectiveEstilo(biz));
  let ok = null, error = null;
  if (req.query.salir) ok = 'Sesión cerrada correctamente.';
  else if (req.query.nueva) ok = 'Tienda creada correctamente ✓ — entra con tu PIN para administrarla.';
  else if (req.query.sesion) error = 'Tu sesión expiró. Entra con tu PIN para continuar.';
  res.render('login', { biz, error, ok, pal });
});

app.post('/:slug/admin', loginRateLimit, (req, res) => {
  const biz = getBusiness(req.params.slug);
  if (!biz) return res.status(404).render('404', { message: 'Tienda no encontrada' });
  const block = storeBlock(biz);
  if (block.blocked) return res.status(403).render('store-off', { biz, reason: block.reason });
  const pal = getPalette(biz, getEffectiveEstilo(biz));
  const pin = String(req.body.pin || '');
  // 1) Dueño
  let ok = false;
  if (biz.pin_hash && verifyPin(pin, biz.pin_hash)) {
    ok = true;
    // Migrate: move hash to pin column for consistency
    db.prepare('UPDATE businesses SET pin = ? WHERE id = ?').run(biz.pin_hash, biz.id);
  } else if (biz.pin) {
    ok = verifyPin(pin, biz.pin);
  }
  if (ok) {
    const token = createSession(biz.id, 'owner');
    res.cookie('sid', token, { maxAge: SESSION_TTL_MS, httpOnly: true, sameSite: 'lax', path: '/', secure: req.secure });
    // Volver a la página protegida desde la que vino (solo rutas admin de esta tienda)
    const next_ = String(req.query.next || '');
    if (next_ && next_.startsWith('/' + req.params.slug + '/admin')) return res.redirect(next_);
    // Tienda recién creada y sin nada propio todavía: cuestionario de bienvenida antes del panel.
    // Si ya tiene categorías o productos (tienda real en uso), no se molesta aunque
    // onboarding_done siga en 0 — solo se marca para no volver a checarlo cada login.
    if (!biz.onboarding_done) {
      const hasContent = db.prepare(
        'SELECT (SELECT COUNT(*) FROM products WHERE business_id = ?) + (SELECT COUNT(*) FROM categories WHERE business_id = ?) AS c'
      ).get(biz.id, biz.id).c;
      if (!hasContent) return res.redirect('/' + req.params.slug + '/admin/bienvenida');
      db.prepare('UPDATE businesses SET onboarding_done = 1 WHERE id = ?').run(biz.id);
    }
    return res.redirect('/' + req.params.slug + '/admin/panel');
  }
  // 2) Empleado
  const emps = db.prepare("SELECT * FROM employees WHERE business_id = ?").all(biz.id);
  const emp = emps.find(e => verifyPin(pin, e.pin_hash));
  if (emp) {
    const token = createSession(biz.id, 'employee', emp.id);
    res.cookie('sid', token, { maxAge: SESSION_TTL_MS, httpOnly: true, sameSite: 'lax', path: '/', secure: req.secure });
    let empPerms = [];
    try { empPerms = JSON.parse(emp.perms || '[]'); } catch (e) { empPerms = []; }
    const dest = firstEmployeePage(empPerms);
    if (!dest) {
      return res.render('login', { biz, error: 'Tu cuenta aún no tiene permisos asignados. Pide al dueño que los configure.', ok: null, pal });
    }
    return res.redirect('/' + req.params.slug + '/admin' + dest);
  }
  res.render('login', { biz, error: 'PIN incorrecto. Intenta de nuevo.', ok: null, pal });
});

app.get('/:slug/admin/salir', (req, res) => {
  deleteSession(req.cookies && req.cookies.sid);
  res.clearCookie('sid', { path: '/' });
  // Al salir no se va al login: regresa a la página principal (localhost)
  res.redirect('/');
});

// ================= ERRORES =================
// Página amigable de error (500) en lugar de texto crudo; el detalle real queda en el log.
function sendErrorPage(res, err) {
  console.error('[500]', err && (err.stack || err.message) || err);
  if (res.headersSent) return;
  res.status(500).type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Algo salió mal</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f2ee;font-family:system-ui,-apple-system,sans-serif">
<div style="text-align:center;padding:24px;max-width:420px">
<div style="font-size:44px;margin-bottom:8px">😵</div>
<h1 style="font-size:20px;color:#1a1b18;margin:0 0 8px">Algo salió mal</h1>
<p style="font-size:14px;color:#7a7870;margin:0 0 20px">Hubo un error inesperado al cargar esta página. Intenta recargar; si sigue pasando, avísanos qué estabas haciendo.</p>
<a href="javascript:history.back()" style="display:inline-block;padding:10px 22px;border-radius:10px;background:#1a3c5e;color:#fff;text-decoration:none;font-size:14px;font-weight:600">← Volver</a>
</div></body></html>`);
}

// ================= PANEL =================
function panelData(biz) {
  const categories = db.prepare('SELECT * FROM categories WHERE business_id = ? ORDER BY sort ASC').all(biz.id);
  const allProducts = db.prepare(
    `SELECT p.*, c.name AS category_name FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.business_id = ? ORDER BY p.active DESC, p.sort ASC, p.id DESC`
  ).all(biz.id).map(p => {
    p.stock = p.stock === null || p.stock === undefined ? null : p.stock;
    p.variants = parseVariantList(p.variants);
    p.variantCount = variantCount(p.variants);
    p.cover = variantCoverImage(p) || p.image;
    // Con variantes, el stock del producto (columna suelta) siempre queda en
    // null a propósito — vive repartido por combinación. Sin esto, cualquier
    // producto con variantes se mostraba "Agotado" aunque tuviera stock real.
    p.displayStock = p.made_to_order ? null : p.variantCount > 0
      ? Object.values(p.variants.stock || {}).reduce((s, v) => s + (parseInt(v, 10) || 0), 0)
      : p.stock;
    return withPromo(p);
  });
  const orders = db.prepare(
    `SELECT o.*, (SELECT COUNT(*) FROM abonos WHERE order_id = o.id) AS abono_count FROM orders o WHERE o.business_id = ? ORDER BY o.created_at DESC LIMIT 20`
  ).all(biz.id);
  orders.forEach(o => { if (o.is_installment) o.schedule = installmentSchedule(o); });
  const pending = orders.filter(o => !o.paid).length;
  const stats = getStats(biz.id);
  const planMax = PLAN_MAX(biz);
  const planInfo = getPlan(biz);
  const storeUrl = siteOrigin() ? siteOrigin() + '/' + biz.slug : '/' + biz.slug;
  const shareUrl = siteOrigin() ? siteOrigin() + '/' + biz.slug : '';
  const lowStock = allProducts.filter(p => !p.made_to_order && (p.displayStock === null || p.displayStock <= 5));
  const priceHistory = db.prepare('SELECT * FROM price_history WHERE business_id = ? ORDER BY id DESC LIMIT 30').all(biz.id);
  return { categories, allProducts, orders, pending, stats, planMax, planInfo, storeUrl, shareUrl, attributeTemplates: getAttributeTemplates(biz.id), lowStock, priceHistory, canDesign: designAllowed(biz) };
}

async function qrFor(biz) {
  const url = siteOrigin() ? siteOrigin() + '/' + biz.slug : '/' + biz.slug;
  try {
    return await QRCode.toDataURL(url, { width: 300, margin: 1 });
  } catch (e) {
    return '';
  }
}

// QR de un producto concreto (para la tarjeta compartible de redes)
app.get('/:slug/admin/producto/:id/qr', requireAuth, can('productos.ver'), ah(async (req, res) => {
  const p = db.prepare('SELECT id FROM products WHERE id = ? AND business_id = ?').get(req.params.id, req.biz.id);
  if (!p) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
  const url = (BASE_URL ? BASE_URL : req.protocol + '://' + req.get('host')) + '/' + req.params.slug + '/p/' + p.id;
  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 1 });
    res.json({ ok: true, url, qr: dataUrl });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'No se pudo generar el QR' });
  }
}));

// Proxy de imágenes para el canvas de la tarjeta de redes: descarga la foto
// desde el servidor y la sirve same-origin (evita CORS que "contamina" el canvas).
app.get('/:slug/admin/img-proxy', requireAuth, can('productos.ver'), ah(async (req, res) => {
  const src = String(req.query.u || '');
  if (!src) return res.status(400).json({ ok: false, error: 'Falta la URL' });
  if (/\/admin\//i.test(src) || src.includes('..')) return res.status(400).json({ ok: false, error: 'URL no permitida' });
  const isHttp = /^https?:\/\//i.test(src);
  try {
    if (isHttp) {
      const r = await fetch(src, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NessikCard/1.0)', 'Accept': 'image/*' }
      });
      if (!r.ok) return res.status(404).json({ ok: false, error: 'La imagen no se pudo descargar (' + r.status + ')' });
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 15 * 1024 * 1024) return res.status(413).json({ ok: false, error: 'Imagen demasiado grande' });
      res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
      res.set('Cache-Control', 'private, max-age=300');
      res.send(buf);
    } else {
      // Ruta relativa (foto subida a /uploads): se sirve directo del disco
      const file = path.resolve(__dirname, 'public', src.replace(/^\/+/, ''));
      if (!file.startsWith(path.resolve(__dirname, 'public'))) return res.status(400).json({ ok: false, error: 'Ruta no permitida' });
      res.sendFile(file);
    }
  } catch (e) {
    res.status(502).json({ ok: false, error: 'No se pudo descargar la imagen' });
  }
}));

app.get('/:slug/admin/panel', requireAuth, can(['reportes', 'pedidos.gestionar']), ah(async (req, res) => {
  const biz = req.biz;
  const data = panelData(biz);
  data.qrUrl = await qrFor(biz);
  res.render('panel', { biz, ...data, error: null, bienvenida: req.query.bienvenida === '1' });
}));

function reportData(bizId, period) {
  const orders = db.prepare('SELECT id, items, total, customer_name, status, paid, created_at, paid_at, is_installment, installment_paid FROM orders WHERE business_id = ? ORDER BY created_at DESC').all(bizId);
  const payments = db.prepare('SELECT order_id, amount, created_at FROM abonos WHERE business_id = ?').all(bizId);
  const tracking = db.prepare('SELECT type, created_at FROM tracking WHERE business_id = ? AND type IN (\'visit\', \'wa\') AND created_at >= ? AND created_at < ?').all(bizId, period.from, new Date(Date.parse(period.to + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10));
  return buildReport(period, orders, payments, tracking);
}

app.get('/:slug/admin/reportes', requireAuth, can('reportes'), (req, res) => {
  const period = reportPeriod(req.query);
  const report = period.error ? { orders: [], count: 0, sales: 0, revenue: 0, pending: 0, visits: 0, waClicks: 0, byDay: [] } : reportData(req.biz.id, period);
  res.render('reportes', { biz: req.biz, period, report });
});

app.get('/:slug/admin/reportes.csv', requireAuth, can('reportes'), (req, res) => {
  const period = reportPeriod(req.query);
  if (period.error) return res.status(400).send(period.error);
  const report = reportData(req.biz.id, period);
  const rows = [['Fecha', 'Cliente', 'Productos', 'Total', 'Estado', 'Pagado', 'Abonos', 'Abonado']];
  report.orders.forEach(o => rows.push([o.created_at, o.customer_name, o.items, o.total, o.status, o.paid ? 'SI' : 'NO', o.is_installment ? 'SI' : 'NO', o.installment_paid || 0]));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="reporte-${req.biz.slug}-${period.from}-${period.to}.csv"`);
  res.send('\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n');
});

app.get('/:slug/admin/productos', requireAuth, can('productos.ver'), (req, res) => {
  const biz = req.biz;
  const data = panelData(biz);
  res.render('productos', { biz, ...data, error: null });
});

// ================= CRUD PRODUCTOS =================
function parsePrices(body) {
  // El campo llega con separador de miles (máscara del lado del cliente,
  // ver public/js/masks.js) — parseFloat("1,234.56") daría 1 sin esto.
  const clean = (v) => String(v == null ? '' : v).replace(/,/g, '');
  const price = parseFloat(clean(body.price)) || 0;
  let old_price = null;
  if (body.old_price && clean(body.old_price) !== '') {
    old_price = parseFloat(clean(body.old_price)) || null;
    if (old_price !== null && old_price <= price) old_price = null;
  }
  return { price, old_price };
}

// Normaliza la promoción: tipo + valor + regalo. Devuelve campos listos para guardar.
function parsePromo(body) {
  const types = ['descuento', 'porcentaje', '2x1', '3x2', 'regalo'];
  const promo_type = types.includes(body.promo_type) ? body.promo_type : '';
  const promo_value = promo_type === 'porcentaje' ? Math.min(99, Math.max(1, parseFloat(body.promo_value) || 0)) : 0;
  const promo_gift = promo_type === 'regalo' ? String(body.promo_gift || '').slice(0, 120) : '';
  // 'descuento' se apoya en old_price (no requiere valor extra)
  if (promo_type === 'descuento' && !body.old_price) return { promo_type: '', promo_value: 0, promo_gift: '' };
  return { promo_type, promo_value, promo_gift };
}

// Normaliza los campos de abonos del formulario del producto.
function parseInstallment(body) {
  const freqs = ['semanal', 'quincenal', 'mensual'];
  return {
    allow_installments: body.allow_installments ? 1 : 0,
    installment_count: Math.max(2, Math.min(48, parseInt(body.installment_count) || 6)),
    installment_min_down: Math.max(0, parseFloat(body.installment_min_down) || 0),
    installment_frequency: freqs.includes(body.installment_frequency) ? body.installment_frequency : 'semanal'
  };
}

// Registra el historial de precios/promos solo si cambió algo relevante.
function logPriceHistory(bizId, p) {
  const last = db.prepare('SELECT * FROM price_history WHERE business_id = ? AND product_id = ? ORDER BY id DESC LIMIT 1').get(bizId, p.id);
  const same = last && last.price === (p.price || 0) && (last.old_price || null) === (p.old_price || null) && (last.promo_type || '') === (p.promo_type || '') && (last.promo_gift || '') === (p.promo_gift || '');
  if (same) return;
  db.prepare('INSERT INTO price_history (business_id, product_id, name, price, old_price, promo_type, promo_gift) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(bizId, p.id, p.name, p.price || 0, p.old_price || null, p.promo_type || '', p.promo_gift || '');
}

// Normaliza el modelo de variantes a { attrs: [{name, values[]}], images: {comboKey: url} }
// - Nuevo formato: { attrs: [{name, values}], images: { "Talla|Color": url } }
// - Legado: array de strings o de {name, image} → un solo atributo
function parseVariantModel(v) {
  const empty = { attrs: [], images: {}, stock: {}, prices: {}, costs: {}, skus: {}, barcodes: {} };
  if (!v) return empty;
  let raw = v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return empty;
    if (s[0] === '[' || s[0] === '{') { try { raw = JSON.parse(s); } catch (e) { raw = s; } }
    else raw = s;
  }
  if (raw == null) return empty;

  // Formato nuevo { attrs, images, stock, prices }
  if (!Array.isArray(raw) && raw && Array.isArray(raw.attrs)) {
    const attrs = raw.attrs.map(a => ({
      name: String((a && a.name) || '').trim(),
      values: Array.isArray(a && a.values) ? a.values.map(x => String(x).trim()).filter(Boolean) : []
    })).filter(a => a.values.length); // conserva atributos legacy sin nombre pero con valores
    const images = (raw.images && typeof raw.images === 'object') ? raw.images : {};
    const stock = (raw.stock && typeof raw.stock === 'object') ? raw.stock : {};
    const prices = (raw.prices && typeof raw.prices === 'object') ? raw.prices : {};
    const costs = (raw.costs && typeof raw.costs === 'object') ? raw.costs : {};
    const skus = (raw.skus && typeof raw.skus === 'object') ? raw.skus : {};
    const barcodes = (raw.barcodes && typeof raw.barcodes === 'object') ? raw.barcodes : {};
    return { attrs, images, stock, prices, costs, skus, barcodes };
  }

  // Legado: array de strings o de {name, image}
  if (Array.isArray(raw)) {
    const values = [];
    const images = {};
    raw.forEach(x => {
      if (typeof x === 'string') { const n = x.trim(); if (n && values.indexOf(n) === -1) values.push(n); }
      else if (x && typeof x === 'object') {
        const n = String(x.name || '').trim();
        if (!n) return;
        if (values.indexOf(n) === -1) values.push(n);
        if (x.image) images[n] = String(x.image).trim();
      }
    });
    if (!values.length) return empty;
    return { attrs: [{ name: '', values }], images, stock: {}, prices: {}, costs: {}, skus: {}, barcodes: {} };
  }

  // Legado: string separado por comas
  if (typeof raw === 'string') {
    const values = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (!values.length) return empty;
    return { attrs: [{ name: '', values }], images: {}, stock: {}, prices: {}, costs: {}, skus: {}, barcodes: {} };
  }

  return empty;
}

// Guardado: valida/normaliza y devuelve el JSON canónico
function parseVariants(v) {
  const model = parseVariantModel(v);
  return model.attrs.length ? JSON.stringify(model) : '';
}

// Lectura: modelo canónico { attrs, images }
function parseVariantList(v) {
  return parseVariantModel(v);
}

// Cuántas combinaciones tiene un modelo de variantes
function variantCount(model) {
  const m = model || { attrs: [] };
  if (!m.attrs || !m.attrs.length) return 0;
  return m.attrs.reduce((n, a) => n * ((a.values && a.values.length) || 1), 1);
}

function parseVariantsArray(v) {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

// ============ Catálogo de atributos por tienda (plantillas reutilizables) ============
function parseAttrValues(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
  const s = String(v).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try { const a = JSON.parse(s); if (Array.isArray(a)) return a.map(x => String(x).trim()).filter(Boolean); } catch (e) {}
  }
  return s.split(',').map(x => x.trim()).filter(Boolean);
}

function getAttributeTemplates(bizId) {
  return db.prepare('SELECT * FROM attribute_templates WHERE business_id = ? ORDER BY name COLLATE NOCASE ASC').all(bizId)
    .map(t => ({ id: t.id, name: t.name, values: parseAttrValues(t.vals) }));
}

function upsertAttributeTemplate(bizId, name, values) {
  const nm = String(name || '').trim();
  if (!nm) return { ok: false, error: 'El nombre del atributo es obligatorio.' };
  const vals = parseAttrValues(values);
  if (!vals.length) return { ok: false, error: 'Agrega al menos un valor (ej: Chica, Mediana, Grande).' };
  const existing = db.prepare('SELECT * FROM attribute_templates WHERE business_id = ? AND name = ? COLLATE NOCASE').get(bizId, nm);
  const json = JSON.stringify(vals);
  if (existing) {
    db.prepare('UPDATE attribute_templates SET vals = ? WHERE id = ?').run(json, existing.id);
    return { ok: true, id: existing.id, name: nm, values: vals, updated: true };
  }
  const r = db.prepare('INSERT INTO attribute_templates (business_id, name, vals) VALUES (?, ?, ?)').run(bizId, nm, json);
  return { ok: true, id: r.lastInsertRowid, name: nm, values: vals, updated: false };
}

function parseStock(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseInt(v);
  return isNaN(n) ? null : n;
}

// Costo de compra: opcional, nunca obligatorio (muchos dueños no lo saben o
// no quieren capturarlo aún) — a diferencia de precio/stock, 0 = "no capturado".
function parseCost(v) {
  const n = parseFloat(String(v || '').replace(/,/g, ''));
  return isNaN(n) || n < 0 ? 0 : n;
}

function parsePromoEnd(v) {
  if (!v) return '';
  const s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function parseGaleria(v) {
  if (!v || !String(v).trim()) return '';
  const raw = String(v).trim();
  // Ojo: "parts" debe distinguir "el JSON era válido y la galería viene
  // vacía" (parts = [], legítimo) de "esto no era JSON" (parts = null,
  // ahí sí toca el resguardo de separar por comas). Antes ambos casos
  // caían en el mismo "!parts.length", así que una galería vacía ("[]")
  // se volvía a partir por comas, y el string completo "[]" (sin comas)
  // quedaba como si fuera una URL de foto — se guardaba un elemento
  // fantasma literal "[]" que en el catálogo se veía como una miniatura
  // rota / "sin imagen" de más, aunque solo se hubiera subido 1 foto.
  let parts = null;
  if (raw.startsWith('[')) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) parts = arr.map(s => String(s).trim()).filter(Boolean);
    } catch (e) { parts = null; }
  }
  if (parts === null) parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  return parts.length ? JSON.stringify(parts) : '';
}

// Lista de imágenes de un producto: la principal + las de la galería.
// Filtra cualquier entrada que no parezca ruta/URL real (defensa extra por
// si queda algún dato viejo corrupto de la galería con basura tipo "[]").
// Foto de portada de un producto con atributos: la de su PRIMERA variante (primera combinación en orden).
// Si esa no tiene foto, la primera combinación que sí la tenga. Sin variantes o sin fotos por variante, ''.
function variantCoverImage(p) {
  const vm = parseVariantModel(p && p.variants);
  if (!vm.attrs || !vm.attrs.length || !vm.images) return '';
  const lists = vm.attrs.map(a => (a.values && a.values.length) ? a.values : ['']);
  let combos = [[]];
  for (const arr of lists) {
    const next = [];
    for (const prefix of combos) { for (const v of arr) { next.push(prefix.concat([v])); if (next.length > 400) break; } if (next.length > 400) break; }
    combos = next;
  }
  for (const c of combos) {
    const img = String(vm.images[c.join('|')] || '').trim();
    if (img && (img[0] === '/' || /^https?:\/\//i.test(img))) return img;
  }
  return '';
}
// Etiquetas personalizadas de un producto: hasta 3, texto corto y color propio (JSON en products.custom_tags)
function parseCustomTags(raw) {
  let a;
  try { a = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw; } catch (e) { return []; }
  if (!Array.isArray(a)) return [];
  return a.slice(0, 3).map(x => ({
    t: String((x && x.t) || '').trim().slice(0, 24),
    c: /^#[0-9a-fA-F]{6}$/.test(String((x && x.c) || '')) ? String(x.c) : '#2c2c2e'
  })).filter(x => x.t);
}
function parseSpecs(raw) {
  // products.specs = una característica por línea, "Clave: Valor"
  return String(raw || '').split(/\r?\n/).map(l => {
    const i = l.indexOf(':');
    return i > 0 ? { n: l.slice(0, i).trim().slice(0, 30), v: l.slice(i + 1).trim().slice(0, 60) } : null;
  }).filter(x => x && x.n && x.v).slice(0, 8);
}
function customTagsJson(raw) {
  const a = parseCustomTags(raw);
  return a.length ? JSON.stringify(a) : '';
}
function productImgs(p) {
  const looksLikeImg = s => s.length > 1 && (s[0] === '/' || /^https?:\/\//i.test(s));
  const cover = variantCoverImage(p);
  const raw = [cover, p.image || '', ...parseVariantsArray(p.galeria || '')].map(s => String(s || '').trim()).filter(looksLikeImg);
  const list = raw.filter((s, i) => raw.indexOf(s) === i);
  return list.length ? list : [p.image || '/img/sin-imagen.svg'];
}

function canAddProduct(biz) {
  const max = PLAN_MAX(biz);
  if (max === Infinity) return { ok: true };
  const count = db.prepare('SELECT COUNT(*) AS c FROM products WHERE business_id = ?').get(biz.id).c;
  if (count < max) return { ok: true };
  const plan = getPlan(biz);
  const planName = (plan && plan.name) || 'Gratis';
  return {
    ok: false,
    planBlock: { count, max, plan: planName },
    message: `Tu plan ${planName} permite hasta ${max} producto${max === 1 ? '' : 's'} y ya tienes ${count} registrados. Borra los que ya no vendas o mejora tu plan para registrar más.`
  };
}

app.post('/:slug/admin/producto', requireAuth, can('productos.crear'), (req, res) => {
  const biz = req.biz;
  const check = canAddProduct(biz);
  if (!check.ok) {
    return res.status(400).render('productos', { biz, ...panelData(biz), error: check.message, planBlock: check.planBlock || null });
  }
  const { name, category_id, description, image, stock, variants } = req.body;
  const madeToOrder = req.body.made_to_order ? 1 : 0;
  const { price: bodyPrice, old_price } = parsePrices(req.body);
  const promo = parsePromo(req.body);
  const inst = parseInstallment(req.body);
  const renderError = (message) => res.status(400).render('productos', { biz, ...panelData(biz), error: message, planBlock: null, formdata: req.body });
  if (!name || !String(name).trim()) {
    return renderError('El nombre del producto es obligatorio.');
  }
  // Con variantes, el precio vive por cada combinación (paso 2), no arriba —
  // el precio "general" se calcula solo (el más bajo entre variantes) para
  // que el catálogo y los filtros de precio tengan algo con qué ordenar.
  let variantsJson = parseVariants(variants);
  const variantModel = variantsJson ? JSON.parse(variantsJson) : null;
  if (madeToOrder && variantModel) { variantModel.stock = {}; variantsJson = JSON.stringify(variantModel); }
  let price = bodyPrice;
  if (variantModel) {
    const combosPrices = Object.values(variantModel.prices || {}).map(Number).filter(n => !isNaN(n) && n >= 0);
    price = combosPrices.length ? Math.min(...combosPrices) : bodyPrice;
  } else {
        if (req.body.tipo === 'variantes') {
      return renderError('Elegiste "Con variantes" pero no hay ningún atributo con valores. En el paso Variantes agrega un atributo y al menos un valor (escribe y pulsa +), o cambia a "Producto único".');
    }
    if (price < 0) {
      return renderError('El precio no puede ser negativo.');
    }
    if (req.body.price === '' || req.body.price === undefined || req.body.price === null || isNaN(parseFloat(req.body.price))) {
      return renderError('El precio es obligatorio (usa un número, ej: 25.50).');
    }
  }
  // Stock obligatorio en productos sin atributos (con variantes, el stock se define por cada combinación).
  const stockNum = madeToOrder ? null : parseStock(stock);
  if (!variantsJson && !madeToOrder) {
    if (stockNum === null) {
      return renderError('El stock es obligatorio: escribe cuántas piezas tienes (0 si el producto está agotado).');
    }
    if (stockNum < 0) {
      return renderError('El stock no puede ser negativo.');
    }
  }
  try {
    db.prepare(
      `INSERT INTO products (business_id, category_id, name, price, old_price, description, image, galeria, stock, made_to_order, variants, promo_ends_at, featured, promo_type, promo_value, promo_gift, sku, tags, video, specs, barcode, allow_installments, installment_count, installment_min_down, installment_frequency, cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(biz.id, category_id || null, String(name).trim(), price, old_price, description || '', image || '', parseGaleria(req.body.galeria), stockNum, madeToOrder, variantsJson, parsePromoEnd(req.body.promo_ends_at), req.body.featured ? 1 : 0, promo.promo_type, promo.promo_value, promo.promo_gift, (req.body.sku || '').toString().trim().slice(0, 60), (req.body.tags || '').toString().trim().slice(0, 300), (req.body.video || '').toString().trim().slice(0, 300), (req.body.specs || '').toString().slice(0, 2000), (req.body.barcode || '').toString().trim().slice(0, 60), inst.allow_installments, inst.installment_count, inst.installment_min_down, inst.installment_frequency, parseCost(req.body.cost));
    const created = db.prepare('SELECT * FROM products WHERE business_id = ? ORDER BY id DESC LIMIT 1').get(biz.id);
    if (created && req.body.show_stock_set) db.prepare('UPDATE products SET show_stock = ? WHERE id = ? AND business_id = ?').run(req.body.show_stock ? 1 : 0, created.id, biz.id);
    if (created && req.body.custom_tags !== undefined) db.prepare('UPDATE products SET custom_tags = ? WHERE id = ? AND business_id = ?').run(customTagsJson(req.body.custom_tags), created.id, biz.id);
    if (created) logPriceHistory(biz.id, created);
  } catch (err) {
    return renderError('No se pudo guardar el producto: ' + (err.message || 'error desconocido'));
  }
  res.redirect('/' + req.params.slug + '/admin/productos');
});

// Etiquetas de toda la tienda (globales): se guardan en extras.globalTags y salen en todos los productos
app.post('/:slug/admin/etiquetas-globales', requireAuth, can('config'), (req, res) => {
  const tags = parseCustomTags((req.body || {}).tags);
  let ex = {};
  try { ex = JSON.parse(req.biz.extras || '{}') || {}; } catch (e) { ex = {}; }
  ex.globalTags = tags;
  db.prepare('UPDATE businesses SET extras = ? WHERE id = ?').run(JSON.stringify(ex), req.biz.id);
  res.json({ ok: true, tags });
});
// Etiqueta en bloque: agrega o quita una etiqueta en todos los productos (o los de una categoría)
app.post('/:slug/admin/productos/etiquetas', requireAuth, can('productos.editar'), (req, res) => {
  const b = req.body || {};
  const text = String(b.text || '').trim().slice(0, 24);
  if (!text) return res.status(400).json({ ok: false, error: 'Escribe el texto de la etiqueta' });
  const color = /^#[0-9a-fA-F]{6}$/.test(String(b.color || '')) ? String(b.color) : '#2c2c2e';
  const remove = b.action === 'remove';
  if (b.action === 'edit') {
    const oldText = String(b.old || '').trim().toLowerCase();
    if (!oldText) return res.status(400).json({ ok: false, error: 'Falta la etiqueta a editar' });
    let n = 0;
    db.prepare('SELECT id, custom_tags FROM products WHERE business_id = ?').all(req.biz.id).forEach(r => {
      const tags = parseCustomTags(r.custom_tags);
      const i = tags.findIndex(x => x.t.toLowerCase() === oldText);
      if (i < 0) return;
      const next = tags.slice(); next[i] = { t: text, c: color };
      db.prepare('UPDATE products SET custom_tags = ? WHERE id = ? AND business_id = ?').run(customTagsJson(next), r.id, req.biz.id);
      n++;
    });
    return res.json({ ok: true, changed: n, full: 0, total: n });
  }
  const catId = parseInt(b.category_id, 10) || 0;
  const rows = catId
    ? db.prepare('SELECT id, custom_tags FROM products WHERE business_id = ? AND category_id = ?').all(req.biz.id, catId)
    : db.prepare('SELECT id, custom_tags FROM products WHERE business_id = ?').all(req.biz.id);
  let changed = 0, full = 0;
  rows.forEach(r => {
    const tags = parseCustomTags(r.custom_tags);
    const has = tags.findIndex(x => x.t.toLowerCase() === text.toLowerCase());
    let next = null;
    if (remove) { if (has >= 0) next = tags.filter((x, i) => i !== has); }
    else if (has >= 0) { if (tags[has].c !== color) { next = tags.slice(); next[has] = { t: tags[has].t, c: color }; } }
    else if (tags.length >= 3) full++;
    else next = tags.concat([{ t: text, c: color }]);
    if (next) {
      db.prepare('UPDATE products SET custom_tags = ? WHERE id = ? AND business_id = ?').run(customTagsJson(next), r.id, req.biz.id);
      changed++;
    }
  });
  res.json({ ok: true, changed, full, total: rows.length });
});
app.post('/:slug/admin/producto/:id/eliminar', requireAuth, can('productos.eliminar'), (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ? AND business_id = ?').run(req.params.id, req.biz.id);
  res.redirect('/' + req.params.slug + '/admin/productos');
});

app.post('/:slug/admin/producto/:id/toggle', requireAuth, can('productos.editar'), (req, res) => {
  db.prepare(
    'UPDATE products SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ? AND business_id = ?'
  ).run(req.params.id, req.biz.id);
  res.redirect('/' + req.params.slug + '/admin/productos');
});

app.post('/:slug/admin/producto/:id/featured', requireAuth, can('productos.editar'), (req, res) => {
  db.prepare(
    'UPDATE products SET featured = CASE WHEN featured = 1 THEN 0 ELSE 1 END WHERE id = ? AND business_id = ?'
  ).run(req.params.id, req.biz.id);
  res.redirect('/' + req.params.slug + '/admin/productos');
});

// Reordena manualmente: mueve un producto arriba o abajo intercambiando sort.
app.post('/:slug/admin/producto/:id/mover', requireAuth, can('productos.editar'), (req, res) => {
  const id = parseInt(req.params.id);
  const dir = req.body.dir === 'up' ? -1 : 1;
  const bizId = req.biz.id;
  const list = db.prepare('SELECT id, sort FROM products WHERE business_id = ? ORDER BY active DESC, sort ASC, id DESC').all(bizId);
  const idx = list.findIndex(x => x.id === id);
  if (idx === -1) return res.redirect('/' + req.params.slug + '/admin/productos');
  const target = list[idx + dir];
  if (!target) return res.redirect('/' + req.params.slug + '/admin/productos');
  const a = list[idx], b = target;
  if (a.sort === b.sort) {
    db.prepare('UPDATE products SET sort = ? WHERE id = ?').run(a.sort + (dir === -1 ? -1 : 1), a.id);
    db.prepare('UPDATE products SET sort = ? WHERE id = ?').run(a.sort, b.id);
  } else {
    db.prepare('UPDATE products SET sort = ? WHERE id = ?').run(b.sort, a.id);
    db.prepare('UPDATE products SET sort = ? WHERE id = ?').run(a.sort, b.id);
  }
  res.redirect('/' + req.params.slug + '/admin/productos');
});

app.post('/:slug/admin/producto/:id', requireAuth, can('productos.editar'), (req, res) => {
  const { name, category_id, description, image, stock, variants } = req.body;
  const madeToOrder = req.body.made_to_order ? 1 : 0;
  const { price: bodyPrice, old_price } = parsePrices(req.body);
  const promo = parsePromo(req.body);
  const inst = parseInstallment(req.body);
  const renderError = (message) => res.status(400).render('productos', { biz: req.biz, ...panelData(req.biz), error: message, planBlock: null, formdata: req.body });
  if (!name || !name.trim()) {
    return renderError('El nombre del producto es obligatorio.');
  }
  // Con variantes, el precio vive por cada combinación (paso 2), no arriba —
  // el precio "general" se calcula solo (el más bajo entre variantes) para
  // que el catálogo y los filtros de precio tengan algo con qué ordenar.
  let variantsJson = parseVariants(variants);
  const variantModel = variantsJson ? JSON.parse(variantsJson) : null;
  if (madeToOrder && variantModel) { variantModel.stock = {}; variantsJson = JSON.stringify(variantModel); }
  let price = bodyPrice;
  if (variantModel) {
    const combosPrices = Object.values(variantModel.prices || {}).map(Number).filter(n => !isNaN(n) && n >= 0);
    price = combosPrices.length ? Math.min(...combosPrices) : bodyPrice;
  } else {
    if (req.body.tipo === 'variantes') {
      return renderError('Elegiste "Con variantes" pero no hay ningún atributo con valores. En el paso Variantes agrega un atributo y al menos un valor (escribe y pulsa +), o cambia a "Producto único".');
    }
    if (req.body.price === '' || req.body.price === undefined || req.body.price === null || isNaN(parseFloat(req.body.price))) {
      return renderError('El precio es obligatorio (usa un número, ej: 25.50).');
    }
    if (price < 0) {
      return renderError('El precio no puede ser negativo.');
    }
  }
  // Stock obligatorio en productos sin atributos (con variantes, el stock se define por cada combinación).
  const stockNum = madeToOrder ? null : parseStock(stock);
  if (!variantsJson && !madeToOrder) {
    if (stockNum === null) {
      return renderError('El stock es obligatorio: escribe cuántas piezas tienes (0 si el producto está agotado).');
    }
    if (stockNum < 0) {
      return renderError('El stock no puede ser negativo.');
    }
  }
  try {
    db.prepare(
      `UPDATE products SET name = ?, price = ?, old_price = ?, category_id = ?, description = ?, image = ?, galeria = ?, stock = ?, made_to_order = ?, variants = ?, promo_ends_at = ?, featured = ?, promo_type = ?, promo_value = ?, promo_gift = ?, sku = ?, tags = ?, video = ?, specs = ?, barcode = ?, allow_installments = ?, installment_count = ?, installment_min_down = ?, installment_frequency = ?, cost = ?
       WHERE id = ? AND business_id = ?`
    ).run(name.trim(), price, old_price, category_id || null, description || '', image || '', parseGaleria(req.body.galeria), stockNum, madeToOrder, variantsJson, parsePromoEnd(req.body.promo_ends_at), req.body.featured ? 1 : 0, promo.promo_type, promo.promo_value, promo.promo_gift, (req.body.sku || '').toString().trim().slice(0, 60), (req.body.tags || '').toString().trim().slice(0, 300), (req.body.video || '').toString().trim().slice(0, 300), (req.body.specs || '').toString().slice(0, 2000), (req.body.barcode || '').toString().trim().slice(0, 60), inst.allow_installments, inst.installment_count, inst.installment_min_down, inst.installment_frequency, parseCost(req.body.cost), req.params.id, req.biz.id);
    if (req.body.show_stock_set) db.prepare('UPDATE products SET show_stock = ? WHERE id = ? AND business_id = ?').run(req.body.show_stock ? 1 : 0, req.params.id, req.biz.id);
    if (req.body.custom_tags !== undefined) db.prepare('UPDATE products SET custom_tags = ? WHERE id = ? AND business_id = ?').run(customTagsJson(req.body.custom_tags), req.params.id, req.biz.id);
    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (updated) logPriceHistory(req.biz.id, updated);
  } catch (err) {
    return renderError('No se pudo guardar el producto: ' + (err.message || 'error desconocido'));
  }
  res.redirect('/' + req.params.slug + '/admin/productos');
});

app.post('/:slug/admin/producto/:id/duplicar', requireAuth, can('productos.crear'), (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ?').get(req.params.id, req.biz.id);
  if (p) {
    db.prepare(
      `INSERT INTO products (business_id, category_id, name, price, old_price, description, image, galeria, stock, made_to_order, variants, promo_ends_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      p.business_id, p.category_id, (p.name || '') + ' (copia)', p.price, p.old_price,
      p.description || '', p.image || '', p.galeria || '', p.stock, p.made_to_order ? 1 : 0, p.variants || '', p.promo_ends_at || ''
    );
  }
  res.redirect('/' + req.params.slug + '/admin/productos');
});

// ================= CRUD CATEGORÍAS (JSON, no recarga el formulario) =================
app.post('/:slug/admin/categoria', requireAuth, can('categorias.gestionar'), (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.json({ ok: false, error: 'El nombre de la categoría es obligatorio.' });
  const dup = db.prepare('SELECT * FROM categories WHERE business_id = ? AND name = ? COLLATE NOCASE').get(req.biz.id, name);
  if (dup) return res.json({ ok: false, error: 'Esa categoría ya existe.' });
  const r = db.prepare('INSERT INTO categories (business_id, name) VALUES (?, ?)').run(req.biz.id, name);
  res.json({ ok: true, id: r.lastInsertRowid, name });
});

app.post('/:slug/admin/categoria/:id/eliminar', requireAuth, can('categorias.gestionar'), (req, res) => {
  const id = parseInt(req.params.id);
  const cat = db.prepare('SELECT * FROM categories WHERE id = ? AND business_id = ?').get(id, req.biz.id);
  if (cat) {
    db.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').run(id);
    db.prepare('DELETE FROM categories WHERE id = ? AND business_id = ?').run(id, req.biz.id);
  }
  res.json({ ok: true });
});

app.post('/:slug/admin/categoria/:id', requireAuth, can('categorias.gestionar'), (req, res) => {
  const id = parseInt(req.params.id);
  const name = (req.body.name || '').trim();
  if (!name) return res.json({ ok: false, error: 'El nombre de la categoría es obligatorio.' });
  const dup = db.prepare('SELECT * FROM categories WHERE business_id = ? AND name = ? COLLATE NOCASE AND id != ?').get(req.biz.id, name, id);
  if (dup) return res.json({ ok: false, error: 'Esa categoría ya existe.' });
  const r = db.prepare('UPDATE categories SET name = ? WHERE id = ? AND business_id = ?').run(name, id, req.biz.id);
  res.json({ ok: r.changes > 0, id, name });
});

// ================= CATÁLOGO DE ATRIBUTOS (JSON, no recarga el formulario) =================
app.post('/:slug/admin/atributo/guardar', requireAuth, can('atributos.gestionar'), (req, res) => {
  res.json(upsertAttributeTemplate(req.biz.id, req.body.name, req.body.values));
});

app.post('/:slug/admin/atributo/:id/eliminar', requireAuth, can('atributos.gestionar'), (req, res) => {
  db.prepare('DELETE FROM attribute_templates WHERE id = ? AND business_id = ?').run(parseInt(req.params.id), req.biz.id);
  res.json({ ok: true });
});

app.post('/:slug/admin/atributo/:id', requireAuth, can('atributos.gestionar'), (req, res) => {
  const id = parseInt(req.params.id);
  const existing = db.prepare('SELECT * FROM attribute_templates WHERE id = ? AND business_id = ?').get(id, req.biz.id);
  if (!existing) return res.json({ ok: false, error: 'Atributo no encontrado.' });
  const nm = String(req.body.name || '').trim();
  const vals = parseAttrValues(req.body.values);
  if (!nm) return res.json({ ok: false, error: 'El nombre del atributo es obligatorio.' });
  if (!vals.length) return res.json({ ok: false, error: 'Agrega al menos un valor.' });
  const dup = db.prepare('SELECT * FROM attribute_templates WHERE business_id = ? AND name = ? COLLATE NOCASE AND id != ?').get(req.biz.id, nm, id);
  if (dup) return res.json({ ok: false, error: 'Ya existe un atributo con ese nombre.' });
  db.prepare('UPDATE attribute_templates SET name = ?, vals = ? WHERE id = ?').run(nm, JSON.stringify(vals), id);
  res.json({ ok: true, id, name: nm, values: vals });
});

// ================= PEDIDOS =================
app.post('/:slug/admin/order/:id/pagado', requireAuth, can('pedidos.gestionar'), (req, res) => {
  db.prepare("UPDATE orders SET paid = 1, status = 'pagado', paid_at = datetime('now') WHERE id = ? AND business_id = ?").run(req.params.id, req.biz.id);
  res.redirect('/' + req.params.slug + '/admin/panel');
});

app.post('/:slug/admin/order/:id/entregado', requireAuth, can('pedidos.gestionar'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND business_id = ?').get(req.params.id, req.biz.id);
  if (!order) return res.redirect('/' + req.params.slug + '/admin/panel');
  // Entregar NO es cobrar: si es a plazos y aún tiene saldo, se entrega pero
  // queda por cobrar (paid = 0) hasta que se registren los abonos restantes.
  const restante = (order.total || 0) - (order.installment_paid || 0);
  const liquidado = !order.is_installment || restante <= 0;
  // paid_at = ahora solo si al entregar se cobró todo; si queda saldo por cobrar se entrega sin cobrar.
  db.prepare("UPDATE orders SET paid = ?, status = 'entregado', paid_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END WHERE id = ? AND business_id = ?")
    .run(liquidado ? 1 : 0, liquidado ? 1 : 0, req.params.id, req.biz.id);
  res.redirect('/' + req.params.slug + '/admin/panel');
});

app.post('/:slug/admin/order/:id/cancelado', requireAuth, can('pedidos.gestionar'), (req, res) => {
  // Un pedido cancelado no es ingreso: sale de lo cobrado.
  db.prepare("UPDATE orders SET status = 'cancelado', paid = 0, paid_at = NULL WHERE id = ? AND business_id = ?").run(req.params.id, req.biz.id);
  res.redirect('/' + req.params.slug + '/admin/panel');
});

app.post('/:slug/admin/order/:id/eliminar', requireAuth, can('pedidos.gestionar'), (req, res) => {
  db.prepare('DELETE FROM orders WHERE id = ? AND business_id = ?').run(req.params.id, req.biz.id);
  res.redirect('/' + req.params.slug + '/admin/panel');
});

// ================= ABONOS (pagos parciales) =================
// Calendario de pagos de un pedido a plazos: cuánto y qué día toca cada abono.
// Usa la fecha del pedido como inicio y la frecuencia para espaciar las fechas.
// Estado por abono: cubierto (✓), adelantado (⤴ pagado antes de su fecha),
// vencido (⚠ fecha pasada sin pagar), próximo (★ el siguiente a cobrar).
const FREQ_DAYS = { semanal: 7, quincenal: 15, mensual: 30 };
function installmentSchedule(order) {
  const total = order.total || 0;
  const count = Math.max(1, parseInt(order.installment_count) || 1);
  const days = FREQ_DAYS[order.installment_frequency] || 7;
  let base = new Date(String(order.created_at || '').slice(0, 10) + 'T00:00:00');
  if (isNaN(base.getTime())) base = new Date();
  const perAmount = Math.round((total / count) * 100) / 100;
  const paid = order.installment_paid || 0;
  const abonos = db.prepare('SELECT amount, created_at FROM abonos WHERE order_id = ? ORDER BY created_at ASC, id ASC').all(order.id);
  const now = new Date();
  const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const out = [];
  let cum = 0; // meta acumulada hasta este abono
  let paidSoFar = 0; // abonado acumulado recorriendo los pagos registrados
  let lastDate = null; // fecha del último pago consumido (persiste entre abonos del calendario)
  let aIdx = 0;
  for (let i = 1; i <= count; i++) {
    const amount = i === count ? Math.round((total - perAmount * (count - 1)) * 100) / 100 : perAmount;
    cum += amount;
    const due = new Date(base);
    due.setDate(base.getDate() + (i - 1) * days);
    const dateStr = due.getFullYear() + '-' + String(due.getMonth() + 1).padStart(2, '0') + '-' + String(due.getDate()).padStart(2, '0');
    // Avanzar abonos registrados hasta cubrir la meta de este abono
    while (aIdx < abonos.length && paidSoFar < cum) { paidSoFar += abonos[aIdx].amount; lastDate = abonos[aIdx].created_at; aIdx++; }
    const covered = paidSoFar >= cum;
    const early = covered && lastDate && String(lastDate).slice(0, 10) < dateStr;
    out.push({
      i,
      amount,
      date: dateStr,
      dateShort: dateStr.slice(5),
      covered,
      early,
      partial: !covered && paid > cum - amount,
      overdue: !covered && dateStr < todayStr,
      next: false
    });
  }
  // Marcar como "próximo" el primer abono sin cubrir
  for (const s of out) { if (!s.covered) { s.next = true; break; } }
  return out;
}

app.post('/:slug/admin/order/:id/abono', requireAuth, can('pedidos.gestionar'), (req, res) => {
  const orderId = parseInt(req.params.id);
  const amount = parseFloat(req.body.amount) || 0;
  const note = String(req.body.note || '').trim().slice(0, 200);
  if (amount <= 0) return res.redirect('/' + req.params.slug + '/admin/panel');

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND business_id = ?').get(orderId, req.biz.id);
  // Solo se abonan pedidos a plazos con saldo pendiente (nunca uno ya liquidado).
  if (!order || !order.is_installment || order.paid) return res.redirect('/' + req.params.slug + '/admin/panel');

  const totalDue = order.total;
  const pendiente = Math.max(0, totalDue - (order.installment_paid || 0));
  if (pendiente <= 0) return res.redirect('/' + req.params.slug + '/admin/panel');
  // Nunca registrar de más: se abona a lo mucho lo que falta por liquidar.
  const applied = Math.min(amount, pendiente);
  const newPaid = Math.min(totalDue, (order.installment_paid || 0) + applied);

  db.prepare('INSERT INTO abonos (business_id, order_id, amount, note) VALUES (?, ?, ?, ?)')
    .run(req.biz.id, orderId, applied, note);

  const isFullyPaid = newPaid >= totalDue;
  // Al liquidarse el pedido: si ya estaba ENTREGADO se queda entregado (y pagado);
  // si no, pasa a PAGADO. Si queda saldo, el estado vuelve a 'nuevo' (por cobrar)
  // en vez de quedarse como 'pagado'.
  const nuevoEstado = isFullyPaid
    ? (order.status === 'entregado' ? 'entregado' : 'pagado')
    : (order.status === 'pagado' ? 'nuevo' : order.status);
  // paid_at = ahora solo si el abono liquida el pedido (dinero cobrado).
  db.prepare("UPDATE orders SET installment_paid = ?, paid = ?, status = ?, paid_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END WHERE id = ?")
    .run(newPaid, isFullyPaid ? 1 : 0, nuevoEstado, isFullyPaid ? 1 : 0, orderId);

  track(req.biz.id, 'abono', `${orderId}: $${amount.toFixed(2)}`);
  res.redirect('/' + req.params.slug + '/admin/panel');
});

app.get('/:slug/admin/order/:id/abonos', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM abonos WHERE order_id = ? AND business_id = ? ORDER BY created_at ASC')
    .all(parseInt(req.params.id), req.biz.id);
  res.json({ abonos: rows });
});

app.post('/:slug/admin/order/:id/abono/:abonoId/eliminar', requireAuth, can('pedidos.gestionar'), (req, res) => {
  const orderId = parseInt(req.params.id);
  const abonoId = parseInt(req.params.abonoId);
  const abono = db.prepare('SELECT * FROM abonos WHERE id = ? AND order_id = ? AND business_id = ?').get(abonoId, orderId, req.biz.id);
  if (!abono) return res.redirect('/' + req.params.slug + '/admin/panel');

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND business_id = ?').get(orderId, req.biz.id);
  const newPaid = Math.max(0, (order.installment_paid || 0) - abono.amount);
  const totalDue = order.total;

  db.prepare('DELETE FROM abonos WHERE id = ?').run(abonoId);
  const isFullyPaidAfter = newPaid >= totalDue;
  db.prepare("UPDATE orders SET installment_paid = ?, paid = ?, status = ?, paid_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END WHERE id = ?")
    .run(newPaid, isFullyPaidAfter ? 1 : 0, isFullyPaidAfter ? (order.status === 'entregado' ? 'entregado' : 'pagado') : (order.status === 'pagado' ? 'nuevo' : order.status), isFullyPaidAfter ? 1 : 0, orderId);

  res.redirect('/' + req.params.slug + '/admin/panel');
});

app.get('/:slug/admin/reporte', requireAuth, can('reportes'), (req, res) => {
  const orders = db.prepare(
    `SELECT * FROM orders WHERE business_id = ? ORDER BY created_at DESC`
  ).all(req.biz.id);
  let csv = 'Fecha,Productos,Total,Estado,Pagado,Abonos,Abonado\n';
  for (const o of orders) {
    csv += `"${o.created_at}","${o.items.replace(/"/g, '""')}",${o.total},${o.status},${o.paid ? 'SI' : 'NO'},${o.is_installment ? 'SI' : 'NO'},${o.installment_paid || 0}\n`;
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=pedidos-${req.biz.slug}.csv`);
  res.send('\uFEFF' + csv);
});

// ================= EXPORTAR CATÁLOGO =================
function variantsText(raw) {
  const vm = parseVariantList(raw);
  if (!vm.attrs.length) return '';
  return vm.attrs.map(a => (a.name || 'Opciones') + ': ' + a.values.join(', ')).join(' | ');
}

app.get('/:slug/admin/exportar.xlsx', requireAuth, (req, res) => {
  const biz = req.biz;
  const catName = {};
  db.prepare('SELECT id, name FROM categories WHERE business_id = ?').all(biz.id).forEach(c => { catName[c.id] = c.name; });
  const products = db.prepare('SELECT * FROM products WHERE business_id = ? AND active = 1 ORDER BY sort ASC, id ASC').all(biz.id);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Catálogo');
  ws.columns = [
    { header: 'Nombre', key: 'name', width: 32 },
    { header: 'Precio', key: 'price', width: 12 },
    { header: 'Precio anterior', key: 'old_price', width: 14 },
    { header: 'Categoría', key: 'cat', width: 20 },
    { header: 'Stock', key: 'stock', width: 10 },
    { header: 'Por pedido', key: 'made_to_order', width: 13 },
    { header: 'Atributos', key: 'variants', width: 30 },
    { header: 'Descripción', key: 'desc', width: 40 },
    { header: 'SKU', key: 'sku', width: 14 },
    { header: 'Código de barras', key: 'barcode', width: 16 },
    { header: 'Imagen', key: 'image', width: 45 }
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  products.forEach(p => {
    ws.addRow({
      name: p.name,
      price: p.price,
      old_price: p.old_price || '',
      cat: catName[p.category_id] || '',
      stock: p.stock === null || p.stock === undefined ? '' : p.stock,
      made_to_order: p.made_to_order ? 'Sí' : 'No',
      variants: variantsText(p.variants),
      desc: p.description || '',
      sku: p.sku || '',
      barcode: p.barcode || '',
      image: p.image || ''
    });
  });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=catalogo-${biz.slug}.xlsx`);
  wb.xlsx.write(res).then(() => res.end());
});

app.get('/:slug/admin/catalogo-print', requireAuth, (req, res) => {
  const { products } = getCatalog(req.biz.id);
  res.set('Cache-Control', 'no-store');
  res.render('catalogo-print', { biz: req.biz, products, money: moneyFor(req.biz) });
});

// Póster publicitario imprimible de un producto (foto + precio + QR)
app.get('/:slug/admin/producto/:id/poster', requireAuth, can('productos.ver'), ah(async (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ?').get(req.params.id, req.biz.id);
  if (!p) return res.status(404).render('404', { message: 'Producto no encontrado' });
  p.imgs = productImgs(p);
  withPromo(p);
  const url = (BASE_URL ? BASE_URL : req.protocol + '://' + req.get('host')) + '/' + req.params.slug + '/p/' + p.id;
  let qr = '';
  try { qr = await QRCode.toDataURL(url, { width: 400, margin: 1 }); } catch (e) {}
  res.set('Cache-Control', 'no-store');
  res.render('producto-poster', { biz: req.biz, product: p, qr, url, money: moneyFor(req.biz) });
}));

// ================= CLIENTES (mini-CRM) =================
function upsertCustomer(bizId, name, phone) {
  const nm = String(name || '').trim();
  const ph = String(phone || '').replace(/[^0-9]/g, '');
  if (!ph && !nm) return;
  let existing = null;
  if (ph) existing = db.prepare('SELECT * FROM customers WHERE business_id = ? AND phone = ?').get(bizId, ph);
  if (!existing && nm) existing = db.prepare('SELECT * FROM customers WHERE business_id = ? AND LOWER(name) = LOWER(?)').get(bizId, nm);
  if (existing) {
    if (ph && !existing.phone) db.prepare('UPDATE customers SET phone = ? WHERE id = ?').run(ph, existing.id);
    if (nm && (!existing.name || existing.name === String(existing.phone || ''))) db.prepare('UPDATE customers SET name = ? WHERE id = ?').run(nm, existing.id);
  } else {
    db.prepare('INSERT INTO customers (business_id, name, phone) VALUES (?, ?, ?)').run(bizId, nm || ph, ph);
  }
}

function clientRows(bizId) {
  const allOrders = db.prepare('SELECT * FROM orders WHERE business_id = ? ORDER BY created_at DESC').all(bizId);
  return db.prepare('SELECT * FROM customers WHERE business_id = ? ORDER BY id DESC').all(bizId).map(c => {
    const phone = (c.phone || '').trim();
    const name = (c.name || '').trim().toLowerCase();
    const ords = allOrders.filter(o => {
      if (phone) {
        const op = (o.customer_phone || '').replace(/[^0-9]/g, '');
        if (op && (op.indexOf(phone) !== -1 || phone.indexOf(op) !== -1)) return true;
      }
      const on = (o.customer_name || '').toLowerCase();
      return !!name && !!on && on.indexOf(name) !== -1;
    });
    c.orders = ords;
    c.orderCount = ords.length;
    c.totalSpent = ords.reduce((s, o) => s + (o.total || 0), 0);
    return c;
  });
}

app.get('/:slug/admin/clientes', requireAuth, can('clientes'), (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.render('clientes', { biz: req.biz, customers: clientRows(req.biz.id), error: null, ok: req.query.ok === '1', money: moneyFor(req.biz) });
});

app.post('/:slug/admin/cliente', requireAuth, can('clientes'), (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').replace(/[^0-9]/g, '');
  const notes = String(req.body.notes || '').trim();
  if (!name) return res.redirect('/' + req.params.slug + '/admin/clientes');
  db.prepare('INSERT INTO customers (business_id, name, phone, notes) VALUES (?, ?, ?, ?)').run(req.biz.id, name, phone, notes);
  res.redirect('/' + req.params.slug + '/admin/clientes?ok=1');
});

app.post('/:slug/admin/cliente/:id/eliminar', requireAuth, can('clientes'), (req, res) => {
  db.prepare('DELETE FROM customers WHERE id = ? AND business_id = ?').run(req.params.id, req.biz.id);
  res.redirect('/' + req.params.slug + '/admin/clientes');
});

// Conteo de pedidos nuevos (para la notificación del panel)
app.get('/:slug/admin/api/new-orders', requireAuth, (req, res) => {
  const row = db.prepare('SELECT COALESCE(MAX(id), 0) AS lastId FROM orders WHERE business_id = ?').get(req.biz.id);
  res.json({ lastId: row.lastId });
});

// Conteo de productos con stock bajo/agotado (para el aviso del menú)
app.get('/:slug/admin/api/low-stock', requireAuth, (req, res) => {
  const c = db.prepare('SELECT COUNT(*) AS c FROM products WHERE business_id = ? AND active = 1 AND made_to_order = 0 AND (stock IS NULL OR stock <= 5)').get(req.biz.id).c;
  res.json({ count: c });
});

// ================= CARGA MASIVA (EXCEL) =================
const importSessions = {};

const FIELD_OPTIONS = [
  { value: 'nombre', label: 'Nombre del producto', required: true },
  { value: 'precio', label: 'Precio', required: true },
  { value: 'categoria', label: 'Categoría' },
  { value: 'precio_antes', label: 'Precio antes (promo)' },
  { value: 'stock', label: 'Stock disponible' },
  { value: 'variantes', label: 'Atributos (tallas, colores…)' },
  { value: 'descripcion', label: 'Descripción' },
  { value: 'imagen', label: 'Imagen (URL o ruta)' }
];

const COLUMN_ALIASES = {
  nombre: ['nombre', 'name', 'producto', 'articulo', 'item', 'descripcion del producto', 'descripcion de producto', 'sku', 'referencia', 'product'],
  precio: ['precio', 'price', 'costo', 'precio venta', 'precio de venta', 'costo de venta', 'venta', 'p.venta', 'pv', 'precio publico', 'precio publico iva', 'precio iva', 'precio con iva', 'precio unitario', 'precio lista', 'precio neto', 'precio contado', 'precio credito', 'importe'],
  categoria: ['categoria', 'category', 'linea', 'seccion', 'grupo', 'rubro', 'departamento', 'familia', 'tipo'],
  precio_antes: ['precio_antes', 'precio anterior', 'old price', 'precio regular', 'antes', 'precio tachado', 'precio lista', 'precio list', 'precio anterior iva', 'precio normal', 'precio mayor'],
  stock: ['stock', 'cantidad', 'existencia', 'existencias', 'disponible', 'disponibilidad', 'inventario', 'unidades', 'cant', 'existe', 'stock disponible', 'piezas', 'uds'],
  variantes: ['variantes', 'variante', 'atributos', 'atributo', 'talla', 'tallas', 'color', 'colores', 'color/talla', 'tamano', 'tamanos', 'tamaño', 'medida', 'medidas', 'presentacion', 'presentaciones', 'modelo', 'formato', 'opciones'],
  descripcion: ['descripcion', 'description', 'detalle', 'nota', 'observaciones', 'especificaciones', 'caracteristicas', 'detalles'],
  imagen: ['imagen', 'image', 'foto', 'url', 'link', 'fotografia', 'foto url', 'imagen url', 'foto principal']
};

function normalizeKey(s) {
  return (s || '').toString().trim().toLowerCase().replace(/[áéíóúüñ]/g, (m) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' }[m])).replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

function parseMoney(v) {
  if (v === null || v === undefined || v === '') return NaN;
  let s = v.toString().trim().replace(/[$MX\s]/gi, '');
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '');
  } else {
    s = s.replace(/,/g, '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

function autoMapColumns(headers) {
  const norm = headers.map(normalizeKey);
  const mapping = {};
  Object.keys(COLUMN_ALIASES).forEach((field) => {
    for (let i = 0; i < norm.length; i++) {
      const h = norm[i];
      const aliasHits = COLUMN_ALIASES[field].filter((a) => normalizeKey(a) === h);
      const contains = COLUMN_ALIASES[field].some((a) => {
        const k = normalizeKey(a);
        if (!k) return false;
        if (k.length >= 4 && h.indexOf(k) > -1) return true;   // "precio de venta" dentro de "precio de venta con iva"
        if (h.length >= 4 && k.indexOf(h) > -1) return true;   // "precio" dentro de "precio de venta"
        return false;
      });
      if (aliasHits.length > 0) { mapping[field] = i; break; }
    }
    if (mapping[field] === undefined) {
      for (let i = 0; i < norm.length; i++) {
        const h = norm[i];
        const k = COLUMN_ALIASES[field].map(normalizeKey).filter(Boolean).find((a) => a.length >= 4 && (h.indexOf(a) > -1 || a.indexOf(h) > -1));
        if (k) { mapping[field] = i; break; }
      }
    }
  });
  return mapping;
}

// Lee cualquier Excel/CSV y devuelve { headers, rows, totalRows } detectando la fila de encabezado
// y el separador de CSV (funciona con la lista de precios de cada quien, no solo con la plantilla).
function parseSheet(buffer, filename) {
  let workbook;
  try {
    const ext = (filename || '').toLowerCase();
    const isCsv = ext.endsWith('.csv');
    const opts = { type: 'buffer', raw: false, defval: '' };
    if (isCsv) {
      const firstLines = buffer.toString('utf8').split(/\r?\n/).slice(0, 5).join('\n');
      let sep = ',';
      const counts = {};
      [',', ';', '\t', '|'].forEach(s => { counts[s] = firstLines.split(s).length; });
      const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      if (counts[best] > 1 && counts[best] > counts[','] * 0.8) sep = best === '\t' ? '\t' : best;
      if (sep === ';') { opts.FS = ';'; }
      if (sep === '\t') { opts.FS = '\t'; }
    }
    workbook = XLSX.read(buffer, opts);
  } catch (e) {
    return { error: 'El archivo no se pudo leer. Verifica que sea un Excel o CSV válido.' };
  }

  const sheetName = workbook.SheetNames[0];
  const aoa = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '' });

  // Encontrar la fila de encabezado: la primera con 2+ celdas con contenido
  // (ignora títulos o logos de arriba tipo "LISTA DE PRECIOS - JULIO")
  let headerRow = -1;
  for (let i = 0; i < aoa.length; i++) {
    const cells = aoa[i].map(c => (c === null || c === undefined ? '' : String(c)).trim());
    const nonEmpty = cells.filter(Boolean).length;
    if (nonEmpty >= 2) { headerRow = i; break; }
  }
  if (headerRow === -1) return { error: 'El archivo está vacío o no tiene filas de datos.' };

  const headers = aoa[headerRow].map(c => String(c).trim());
  const colCount = headers.length;

  // Quitar duplicados de encabezado y columnas totalmente vacías
  const seen = {};
  const finalHeaders = [];
  const finalIdx = [];
  headers.forEach((h, j) => {
    if (!h) return;
    const key = h.toLowerCase();
    if (seen[key] !== undefined) {
      finalHeaders.push(h + '_2');
      finalIdx.push(j);
    } else {
      seen[key] = h;
      finalHeaders.push(h);
      finalIdx.push(j);
    }
  });
  // Conservar columnas vacías de en medio solo si alguna fila tiene datos ahí
  const rows = [];
  for (let r = headerRow + 1; r < aoa.length; r++) {
    const cells = aoa[r].map(c => (c === null || c === undefined ? '' : String(c)));
    if (cells.every(c => !String(c).trim())) continue;
    const obj = {};
    finalIdx.forEach((j, k) => { obj[finalHeaders[k]] = (cells[j] || '').toString().trim(); });
    if (Object.keys(obj).length) rows.push(obj);
  }

  return { headers: finalHeaders, rows, totalRows: rows.length };
}

function getImportSession(req, res) {
  const token = req.body.token;
  const session = importSessions[token];
  if (!session) {
    res.render('importar', { biz: req.biz, categories: [], resultado: { ok: 0, errores: ['La sesión de carga expiró. Vuelve a subir el archivo.'] } });
    return null;
  }
  return session;
}

app.get('/:slug/admin/importar', requireAuth, (req, res) => {
  const categories = db.prepare('SELECT * FROM categories WHERE business_id = ? ORDER BY sort ASC').all(req.biz.id);
  res.render('importar', { biz: req.biz, categories, resultado: null });
});

app.get('/:slug/admin/plantilla', requireAuth, ah(async (req, res) => {
  const biz = req.biz;
  const categories = db.prepare('SELECT * FROM categories WHERE business_id = ? ORDER BY sort ASC').all(biz.id);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Productos');

  ws.columns = [
    { header: 'nombre', key: 'nombre', width: 30 },
    { header: 'precio', key: 'precio', width: 12 },
    { header: 'categoria', key: 'categoria', width: 20 },
    { header: 'precio_antes', key: 'precio_antes', width: 12 },
    { header: 'stock', key: 'stock', width: 12 },
    { header: 'atributos', key: 'variantes', width: 22 },
    { header: 'descripcion', key: 'descripcion', width: 40 },
    { header: 'imagen', key: 'imagen', width: 45 }
  ];

  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const ejemplo = ws.addRow({
    nombre: 'Martillo de uña 16oz',
    precio: 189,
    categoria: categories[0] ? categories[0].name : '',
    precio_antes: 220,
    stock: 25,
    variantes: 'Chica, Mediana, Grande',
    descripcion: 'Mango de fibra, cabeza forjada.',
    imagen: 'https://ejemplo.com/martillo.jpg'
  });

  const categoryList = categories.map(c => c.name);
  const formula = '"' + categoryList.join(',') + '"';
  ws.getColumn('C').eachCell((cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorTitle: 'Categoría inválida',
        error: 'Elige una de las categorías de la lista.'
      };
    }
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=plantilla-${biz.slug}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
}));

// Paso 1: subir su propio archivo y mostrar vista previa con mapeo
app.post('/:slug/admin/importar/vista-previa', requireAuth, uploadExcel.single('archivo'), verifyBodyCsrf, (req, res) => {
  const biz = req.biz;
  const categories = db.prepare('SELECT * FROM categories WHERE business_id = ? ORDER BY sort ASC').all(biz.id);

  if (!req.file) {
    return res.render('importar', { biz, categories, resultado: { ok: 0, errores: ['No se recibió ningún archivo. Sube un .xlsx, .xls o .csv.'] } });
  }

  const parsed = parseSheet(req.file.buffer, req.file.originalname);
  if (parsed.error) {
    return res.render('importar', { biz, categories, resultado: { ok: 0, errores: [parsed.error] } });
  }
  const headers = parsed.headers;
  const rows = parsed.rows;

  const token = crypto.randomBytes(8).toString('hex');
  importSessions[token] = { buffer: req.file.buffer, headers, totalRows: rows.length, filename: req.file.originalname };

  const auto = autoMapColumns(headers);
  let saved = {};
  try { saved = JSON.parse(biz.import_map || '{}') || {}; } catch (e) { saved = {}; }

  const mapped = [];
  for (let i = 0; i < headers.length; i++) {
    let field = null;
    const norm = normalizeKey(headers[i]);
    if (saved[norm] && FIELD_OPTIONS.some(f => f.value === saved[norm])) field = saved[norm];
    Object.keys(auto).forEach((k) => { if (auto[k] === i) field = k; });
    mapped.push(field);
  }

  res.render('importar-mapear', { biz, categories, token, headers, mapped, preview: rows.slice(0, 5), totalRows: rows.length, FIELD_OPTIONS, resultado: null });
});

// Paso 2: aplicar mapeo e importar
app.post('/:slug/admin/importar/ejecutar', requireAuth, (req, res) => {
  const biz = req.biz;
  const categories = db.prepare('SELECT * FROM categories WHERE business_id = ? ORDER BY sort ASC').all(biz.id);
  const catByName = {};
  categories.forEach(c => { catByName[c.name.toLowerCase().trim()] = c.id; });

  const session = getImportSession(req, res);
  if (!session) return;

  const { buffer, headers, totalRows } = session;
  const selected = req.body;

  const fieldToCol = {};
  FIELD_OPTIONS.forEach((f) => {
    const idx = parseInt(selected[f.value]);
    if (idx >= 0 && idx < headers.length) fieldToCol[f.value] = idx;
  });

  const errores = [];
  if (fieldToCol.nombre === undefined) errores.push('Selecciona la columna del nombre del producto.');
  if (fieldToCol.precio === undefined) errores.push('Selecciona la columna del precio.');

  const parsed = parseSheet(buffer, session.filename || '');
  if (parsed.error) errores.push(parsed.error);

  if (errores.length > 0) {
    return res.render('importar-mapear', { biz, categories, token: req.body.token, headers, mapped: [], preview: [], totalRows, FIELD_OPTIONS, resultado: { ok: 0, errores } });
  }

  const rows = parsed.rows;
  const insert = db.prepare(
    `INSERT INTO products (business_id, category_id, name, price, old_price, description, image, stock, variants)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const planMax = PLAN_MAX(biz);
  const planLimName = (getPlan(biz) && getPlan(biz).name) || 'Gratis';
  let ok = 0;
  let planBlocked = false;
  rows.forEach((row, i) => {
    const fila = i + 2;
    if (planBlocked) return;
    const get = (field) => fieldToCol[field] !== undefined ? row[headers[fieldToCol[field]]] : '';

    const nombre = (get('nombre') || '').toString().trim();
    const precio = parseMoney(get('precio'));
    const precioAntesRaw = get('precio_antes');
    const precioAntes = precioAntesRaw === '' || precioAntesRaw === undefined ? null : parseMoney(precioAntesRaw);
    const categoria = (get('categoria') || '').toString().trim();
    const descripcion = (get('descripcion') || '').toString().trim();
    const imagen = (get('imagen') || '').toString().trim();
    const stockRaw = (get('stock') || '').toString().trim();
    const stock = stockRaw === '' ? null : parseInt(stockRaw, 10);
    const variantesRaw = (get('variantes') || '').toString();

    if (!nombre) { errores.push(`Fila ${fila}: falta el nombre.`); return; }
    if (isNaN(precio) || precio <= 0) { errores.push(`Fila ${fila} ("${nombre}"): el precio debe ser un número mayor a 0.`); return; }
    if (categoria && !catByName[categoria.toLowerCase()]) { errores.push(`Fila ${fila} ("${nombre}"): la categoría "${categoria}" no existe. Crea la categoría primero o déjala vacía.`); return; }
    if (precioAntes !== null && (isNaN(precioAntes) || precioAntes <= precio)) { errores.push(`Fila ${fila} ("${nombre}"): el precio_antes debe ser mayor al precio.`); return; }
    if (imagen && !/^https?:\/\//.test(imagen) && !imagen.startsWith('/uploads/')) { errores.push(`Fila ${fila} ("${nombre}"): la imagen debe ser una URL (http…) o una ruta /uploads/…`); return; }
    if (stock !== null && (isNaN(stock) || stock < 0)) { errores.push(`Fila ${fila} ("${nombre}"): el stock debe ser un número entero mayor o igual a 0.`); return; }
    if (planMax !== Infinity && ok >= planMax) {
      planBlocked = true;
      errores.push(`Tu plan ${planLimName} permite hasta ${planMax} productos y este archivo supera el espacio disponible (ya se importaron ${ok}). Borra los que ya no vendas o mejora tu plan y vuelve a importar el resto.`);
      return;
    }

    insert.run(
      biz.id,
      categoria ? catByName[categoria.toLowerCase()] : null,
      nombre,
      precio,
      precioAntes || null,
      descripcion,
      imagen,
      stock,
      parseVariants(variantesRaw)
    );
    ok++;
  });

  // Recordar el mapeo para la próxima vez que suba un archivo parecido
  if (ok > 0 || errores.length === 0) {
    const save = {};
    headers.forEach((h, i) => {
      const field = Object.keys(fieldToCol).find(f => fieldToCol[f] === i);
      if (field) save[normalizeKey(h)] = field;
    });
    db.prepare('UPDATE businesses SET import_map = ? WHERE id = ?').run(JSON.stringify(save), biz.id);
  }

  delete importSessions[req.body.token];
  res.render('importar', { biz, categories, resultado: { ok, errores } });
});

// ================= CONFIGURACIÓN =================
// Locals para la página de configuración (todos los formularios de esa página la usan)
function configLocals(biz, opts) {
  let girosList = [];
  try { girosList = JSON.parse(biz.giros || '[]'); } catch (e) { girosList = []; }
  if (!Array.isArray(girosList)) girosList = [];
  if (!girosList.length && biz.giro) girosList = [biz.giro];
  const horario = {};
  try {
    const h = JSON.parse(biz.horario || '[]');
    if (Array.isArray(h)) h.forEach(x => { if (x && x.d) horario[x.d] = { o: x.o || '', c: x.c || '' }; });
  } catch (e) {}
  let blocksList = [];
  try { const b = JSON.parse(biz.blocks || '[]'); if (Array.isArray(b)) blocksList = b; } catch (e) {}
  let faqList = [];
  try { const f = JSON.parse(biz.faq || '[]'); if (Array.isArray(f)) faqList = f; } catch (e) {}
  const address = biz.address || '';
  const cats = db.prepare('SELECT id, name FROM categories WHERE business_id = ? ORDER BY sort ASC, name ASC').all(biz.id);
  const previewProducts = db.prepare('SELECT p.id, p.name, p.price, p.old_price, p.image, p.featured, p.category_id, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.business_id = ? AND p.active = 1 ORDER BY p.featured DESC, p.sort ASC, p.created_at DESC LIMIT 60').all(biz.id);
  const baseEstilo = getEffectiveEstilo(biz);
  const theme = getTemplateTheme(biz.template);
  const diseno = theme
    ? { ...baseEstilo, font: theme.bodyFont, fontLink: theme.fontLink, bg: theme.bg, card: theme.card, text: theme.text, muted: theme.muted, border: theme.border, radius: theme.radius, accent: theme.accent, accent2: theme.accent2, header: '', headerText: theme.text, dark: !!theme.dark }
    : baseEstilo;
  const pal = theme
    ? { accent: theme.accent, accent2: theme.accent2, mode: 'solido' }
    : getPalette(biz, baseEstilo);
  return {
    biz,
    mpOAuth: mpOauthReady(),
    TEMPLATES, COLORS, GIROS: getGiros(), ESTILOS, FONTS, CURRENCIES, GIRO_PRESETS,
    diseno,
    CAT_DESIGNS,
    catDesign: catDesignOf(biz),
    TPL_META,
    TPL_CASOS,
    template: biz.template || '',
    theme: theme,
    girosList,
    horario,
    horarioMsg: biz.horario_msg || '',
    blocksList,
    faqList,
    address,
    defaultStack: getComponents(biz),
    cats,
    previewProducts,
    pal,
    esMaestro: !!(opts && opts.esMaestro),
    canDesign: !!(opts && opts.esMaestro) || designAllowed(biz),
    error: (opts && opts.error) || null,
    ok: (opts && opts.ok) || null
  };
}

// Aplica el guardado de la configuración (datos y/o diseño) a una tienda
function applyConfig(biz, body) {
  const { name, whatsapp, description, template, color, color_hex, color_hex2, color_mode, grid_cols, logo, banner, giro, estilo, bg, card, text, muted, border, radius, font, accent, accent2, header, header_text, page_bg } = body;
  const waMessage = Object.prototype.hasOwnProperty.call(body, 'wa_message') ? (body.wa_message || '').toString().slice(0, 1000) : biz.wa_message;
  const currency = CURRENCY_MAP[body.currency] ? body.currency : biz.currency;
  const sections = (() => {
    try {
      const s = JSON.parse(body.sections || '{}');
      return JSON.stringify({
        hero_mode: ['destacado', 'compacto', 'oculto'].includes(s.hero_mode) ? s.hero_mode : 'destacado',
        categorias: s.categorias !== false,
        catmode: s.catmode === 'top' ? 'top' : 'left',
        density: ['compacta', 'normal', 'espaciosa'].includes(s.density) ? s.density : 'normal',
        shadow: ['none', 'suave', 'media', 'fuerte'].includes(s.shadow) ? s.shadow : 'media',
        hover: ['none', 'scale', 'lift', 'zoom', 'glow'].includes(s.hover) ? s.hover : 'lift',
        orden: (Array.isArray(s.orden) ? s.orden : ['hero', 'contenido']).slice(0, 3),
        nav: cleanNav(s.nav),
        showHeader: s.showHeader !== false,
        showFooter: s.showFooter !== false,
        campaign: (s.campaign && typeof s.campaign === 'object') ? {
          text: String(s.campaign.text || '').slice(0, 120),
          ends: /^\d{4}-\d{2}-\d{2}$/.test(String(s.campaign.ends || '')) ? String(s.campaign.ends) : ''
        } : null
      });
    } catch (e) { return biz.sections || ''; }
  })();
  const demo = (() => {
    if (!Object.prototype.hasOwnProperty.call(body, 'demo')) return biz.demo || '';
    try { const d = JSON.parse(body.demo || '{}'); return JSON.stringify({ name: String(d.name || '').slice(0, 60), description: String(d.description || '').slice(0, 200), products: (Array.isArray(d.products) ? d.products : []).slice(0, 8).map(p => ({ name: String(p.name || '').slice(0, 60), price: parseFloat(p.price) || 0, cat: String(p.cat || '').slice(0, 40) })) }); }
    catch (e) { return ''; }
  })();
  const horario = (() => {
    if (!Object.prototype.hasOwnProperty.call(body, 'horario_set')) return biz.horario || '';
    const arr = [];
    for (let d = 1; d <= 7; d++) {
      const o = String(body['h_open_' + d] || '').trim();
      const c = String(body['h_close_' + d] || '').trim();
      if (o && c && o < c) arr.push({ d, o, c });
    }
    return arr.length ? JSON.stringify(arr) : '';
  })();
  const horarioMsg = Object.prototype.hasOwnProperty.call(body, 'horario_msg')
    ? String(body.horario_msg || '').slice(0, 200)
    : (biz.horario_msg || '');
  const blocks = (() => {
    if (!Object.prototype.hasOwnProperty.call(body, 'blocks')) return biz.blocks || '[]';
    try {
      const arr = JSON.parse(body.blocks || '[]');
      if (!Array.isArray(arr)) return '[]';
      const ALLOWED = ['row', 'banner', 'texto', 'imagen', 'overlay', 'categorias', 'destacados', 'productos', 'ofertas', 'video', 'card', 'mascara', 'info', 'filtros', 'boton', 'titulo', 'separador', 'espacio', 'whatsapp', 'mapa', 'redes', 'galeria', 'carrusel', 'faq', 'testimonios', 'contacto', 'horario', 'stats', 'precios', 'html', 'cupon', 'equipo', 'marcas', 'pasos', 'caracteristicas', 'promo', 'comparativa', 'timeline', 'noticias', 'newsletter', 'countdown', 'llamar', 'audio', 'descarga', 'qr', 'sucursales', 'premios', 'antesdespues', 'reserva', 'valoracion', 'servicios', 'cta', 'ubicacion'];
      const cleanBlock = (b, idx) => {
        const type = ALLOWED.includes(b.type) ? b.type : 'texto';
        const base = { id: String(b.id || ('c' + idx)), type };
        base.title = String(b.title || '').slice(0, 120);
        base.text = String(b.text || '').slice(0, 2000);
        base.image = String(b.image || '').slice(0, 500);
        base.link = String(b.link || '').slice(0, 500);
        base.url = String(b.url || '').slice(0, 500);
        base.count = Math.max(0, parseInt(b.count) || 0);
        base.category_id = Math.max(0, parseInt(b.category_id) || 0);
        base.layout = ['grid', 'lista', 'masonry', 'slider', 'split', 'cards', 'centro', 'izq', 'abajo'].includes(b.layout) ? b.layout : 'grid';
        base.cols = [2, 3, 4].includes(Number(b.cols)) ? Number(b.cols) : 3;
        base.height = ['compacto', 'normal', 'grande', 'full', 'auto'].includes(b.height) ? b.height : '';
        base.size = ['pequeno', 'normal', 'grande', 'muygrande', 'enorme', 'gigante'].includes(b.size) ? b.size : '';
        base.align = ['left', 'center'].includes(b.align) ? b.align : '';
        base.width = ['auto', 'full', 'grande', 'media', 'pequena'].includes(b.width) ? b.width : '';
        base.border = ['none', '1', '2', '4'].includes(String(b.border)) ? String(b.border) : '';
        base.radius = ['0', '8', '16', '24'].includes(String(b.radius)) ? String(b.radius) : '';
        base.color = /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : '';
        base.animation = ['none', 'fade', 'up', 'zoom'].includes(b.animation) ? b.animation : 'none';
        base.grosor = ['1', '3', '6'].includes(String(b.grosor)) ? String(b.grosor) : '1';
        base.bg = /^#[0-9a-fA-F]{6}$/.test(b.bg || '') ? b.bg : '';
        base.bg2 = /^#[0-9a-fA-F]{6}$/.test(b.bg2 || '') ? b.bg2 : '';
        base.bgType = ['solid', 'linear', 'radial', 'conic', 'image', 'pattern'].includes(b.bgType) ? b.bgType : '';
        base.bgAngle = Math.max(0, Math.min(360, parseInt(b.bgAngle) || 135));
        base.bgImage = String(b.bgImage || '').slice(0, 500);
        base.bgPattern = ['rayas', 'horizontales', 'puntos', 'cuadros'].includes(b.bgPattern) ? b.bgPattern : '';
        base.bgPatternC = /^#[0-9a-fA-F]{6}$/.test(b.bgPatternC || '') ? b.bgPatternC : '';
        base.padding = ['none', 'suave', 'normal', 'amplio'].includes(b.padding) ? b.padding : '';
        base.margin = ['0', '5', '10', '15', '20', '30', '40', '50'].includes(String(b.margin)) ? String(b.margin) : '';
        base.shadow = ['none', 'suave', 'media', 'fuerte'].includes(b.shadow) ? b.shadow : '';
        base.hover = ['none', 'scale', 'lift', 'glow'].includes(b.hover) ? b.hover : '';
        base.uppercase = b.uppercase === 'si' ? 'si' : '';
        base.paginacion = ['no', 'vermas', 'paginas'].includes(b.paginacion) ? b.paginacion : '';
        base.filtroBusqueda = b.filtroBusqueda === 'no' ? 'no' : 'si';
        base.filtroCategorias = b.filtroCategorias === 'no' ? 'no' : 'si';
        base.filtroPrecio = b.filtroPrecio === 'no' ? 'no' : 'si';
        base.filtroAtributos = b.filtroAtributos === 'no' ? 'no' : 'si';
        base.filtroAttrs = String(b.filtroAttrs || '').slice(0, 300);
        base.mostrarFiltros = b.mostrarFiltros === 'si' ? 'si' : 'no';
        if (type === 'productos') base.padding = ['suave', 'normal', 'amplio'].includes(b.padding) ? b.padding : 'suave';
        base.alto = Math.max(0, Math.min(600, parseInt(b.alto) || 0));
        base.mensaje = String(b.mensaje || '').slice(0, 500);
        base.facebook = String(b.facebook || '').slice(0, 300);
        base.instagram = String(b.instagram || '').slice(0, 300);
        base.tiktok = String(b.tiktok || '').slice(0, 300);
        base.whatsapp = String(b.whatsapp || '').slice(0, 30);
        base.images = String(b.images || '').slice(0, 4000);
        base.object_position = ['left', 'center', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(b.object_position) ? b.object_position : '';
        base.image_position = ['left', 'center', 'right'].includes(b.image_position) ? b.image_position : '';
        base.overlay = ['none', 'soft', 'strong'].includes(b.overlay) ? b.overlay : '';
        base.captionPos = ['none', 'left', 'center', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(b.captionPos) ? b.captionPos : '';
        base.captionColor = /^#[0-9a-fA-F]{6}$/.test(b.captionColor || '') ? b.captionColor : '';
        base.captionSize = Math.max(8, Math.min(72, parseInt(b.captionSize) || 0));
        base.eyebrow = String(b.eyebrow || '').slice(0, 120);
        base.boton = String(b.boton || '').slice(0, 60);
        base.figura = ['cajas', 'blobs', 'panes', 'taza', 'cortes'].includes(b.figura) ? b.figura : '';
        base.figuraItems = String(b.figuraItems || '').slice(0, 600);
        base.modo = ['cards', 'menu'].includes(b.modo) ? b.modo : '';
        base.items = String(b.items || '').slice(0, 4000);
        base.html = String(b.html || '').slice(0, 20000);
        base.codigo = String(b.codigo || '').slice(0, 60);
        base.precio = String(b.precio || '').slice(0, 60);
        base.telefono = String(b.telefono || '').slice(0, 30);
        base.contenido = String(b.contenido || '').slice(0, 500);
        base.fecha = String(b.fecha || '').slice(0, 40);
        base.puntaje = ['1', '2', '3', '4', '5'].includes(String(b.puntaje)) ? String(b.puntaje) : '5';
        base.imgAntes = String(b.imgAntes || '').slice(0, 500);
        base.imgDespues = String(b.imgDespues || '').slice(0, 500);
        base.colA = String(b.colA || '').slice(0, 80);
        base.colB = String(b.colB || '').slice(0, 80);
        base.btn1 = String(b.btn1 || '').slice(0, 60);
        base.link1 = String(b.link1 || '').slice(0, 500);
        base.btn2 = String(b.btn2 || '').slice(0, 60);
        base.link2 = String(b.link2 || '').slice(0, 500);
        base.placeholder = String(b.placeholder || '').slice(0, 80);
        base.accent = String(b.accent || '').slice(0, 7);
        base.autor = String(b.autor || '').slice(0, 100);
        base.variant = ['solid','outline','ghost','circle','square','roundrect','pill','triangle','diamond','star4','star5','star6','custom'].includes(b.variant) ? b.variant : '';
        base.icono = /^bi-[a-z0-9-]{1,50}$/.test(b.icono || '') ? b.icono : '';
        base.iconoTam = Math.max(10, Math.min(64, parseInt(b.iconoTam) || 18));
        base.iconoColor = /^#[0-9a-fA-F]{6}$/.test(b.iconoColor || '') ? b.iconoColor : '';
        base.iconoPos = ['left','right'].includes(b.iconoPos) ? b.iconoPos : 'right';
        base.descarga = b.descarga === 'si' ? 'si' : '';
        base.dur = ['flash','rapido','normal','lento','muy-lento','relajada','cinematica','epica'].includes(b.dur) ? b.dur : '';
        base.rotation = Math.max(-180, Math.min(180, parseInt(b.rotation) || 0));
        base.offsetX = Math.max(-400, Math.min(400, parseInt(b.offsetX) || 0));
        base.offsetY = Math.max(-400, Math.min(400, parseInt(b.offsetY) || 0));
        if (type === 'row') {
          const colsArr = Array.isArray(b.columns) ? b.columns.slice(0, 12) : [];
          base.gap = Math.max(0, Math.min(40, parseInt(b.gap) || 12));
          base.columns = colsArr.map((col, ci) => ({
            span: Math.max(1, Math.min(12, parseInt(col.span) || 1)),
            blocks: (Array.isArray(col.blocks) ? col.blocks : []).slice(0, 30).map((cb, cbi) => cleanBlock(cb, idx + ':' + ci + ':' + cbi))
          }));
        } else if (type === 'card') {
          base.body = (Array.isArray(b.body) ? b.body : (Array.isArray(b.blocks) ? b.blocks : [])).slice(0, 20).map((cb, cbi) => cleanBlock(cb, idx + ':b:' + cbi));
          base.footer = (Array.isArray(b.footer) ? b.footer : []).slice(0, 20).map((cb, cbi) => cleanBlock(cb, idx + ':f:' + cbi));
        } else if (type === 'mascara') {
          base.variant = ['circle','square','roundrect','pill','triangle','diamond','star4','star5','star6','custom'].includes(b.variant) ? b.variant : 'circle';
          base.size = ['xs','s','m','l','xl','2xl'].includes(b.size) ? b.size : 'm';
          base.points = String(b.points || '').slice(0, 2000);
          base.children = (Array.isArray(b.children) ? b.children : []).slice(0, 10).map((cb, cbi) => cleanBlock(cb, idx + ':c:' + cbi));
        }
        return base;
      };
      const isPages = arr.length === 0 || (arr[0] && typeof arr[0].type === 'undefined' && Array.isArray(arr[0].blocks));
      let pages;
      if (isPages) {
        pages = arr.slice(0, 20).map((pg, pi) => ({
          id: String(pg.id || ('pg' + pi)).slice(0, 40),
          title: String(pg.title || ('Página ' + (pi + 1))).slice(0, 80),
          icon: String(pg.icon || '').slice(0, 12),
          blocks: (Array.isArray(pg.blocks) ? pg.blocks : []).slice(0, 60).map((bb, bi) => cleanBlock(bb, pi + ':' + bi))
        }));
      } else {
        pages = [{ id: 'pg-legacy', title: 'Inicio', icon: '🏠', blocks: arr.slice(0, 60).map((bb, bi) => cleanBlock(bb, '0:' + bi)) }];
      }
      return JSON.stringify(pages);
    } catch (e) { return '[]'; }
  })();
  const girosRaw = Array.isArray(body.giros) ? body.giros : (body.giros ? [body.giros] : []);
  const girosList = girosRaw.filter(g => getGiros().includes(g));
  const primaryGiro = (girosList.length ? girosList[0] : giro) || biz.giro;
  const cleanWaRaw = (whatsapp || '').replace(/[^0-9]/g, '');
  const cleanWa = /^\d{10}$/.test(cleanWaRaw) ? cleanWaRaw : '';
  const cleanHex = /^#[0-9a-fA-F]{6}$/.test(color_hex || '') ? color_hex : biz.color_hex;
  const cleanHex2 = /^#[0-9a-fA-F]{6}$/.test(color_hex2 || '') ? color_hex2 : biz.color_hex2;
  const colorObj = COLORS.find(c => c.id === color);
  const mode = ['estilo', 'solido', 'degradado'].includes(color_mode) ? color_mode : biz.color_mode;
  const cols = [2, 3, 4].includes(Number(grid_cols)) ? Number(grid_cols) : biz.grid_cols;
  const estSel = ESTILOS.some(e => e.id === estilo) ? estilo : biz.estilo;
  const estBase = getEstilo(estSel);
  const pickOrReset = (posted, presetDefault) => {
    const v = (posted || '').toString().trim();
    return v && v.toLowerCase() !== (presetDefault || '').toString().toLowerCase() ? v : '';
  };
  const fontOk = FONTS.some(f => f.css === font);
  const designPosted = Object.prototype.hasOwnProperty.call(body, 'bg');
  const headerFinal = designPosted ? (body.header_user === '1' ? (header || '') : '') : biz.header;
  const redes = JSON.stringify({
    facebook: String(body.redes_facebook || '').trim().slice(0, 300),
    instagram: String(body.redes_instagram || '').trim().slice(0, 300),
    tiktok: String(body.redes_tiktok || '').trim().slice(0, 300)
  });
  const faq = (() => {
    if (!Object.prototype.hasOwnProperty.call(body, 'faq')) return biz.faq || '[]';
    try {
      const arr = JSON.parse(body.faq || '[]');
      if (!Array.isArray(arr)) return '[]';
      const clean = arr.slice(0, 20).map(x => ({
        q: String((x && x.q) || '').trim().slice(0, 200),
        a: String((x && x.a) || '').trim().slice(0, 2000)
      })).filter(x => x.q && x.a);
      return JSON.stringify(clean);
    } catch (e) { return '[]'; }
  })();
  const extras = Object.prototype.hasOwnProperty.call(body, 'extras')
    ? sanitizeExtras(body.extras)
    : (biz.extras || '');
  const address = Object.prototype.hasOwnProperty.call(body, 'address')
    ? String(body.address || '').trim().slice(0, 300)
    : (biz.address || '');
  const catDesign = CAT_DESIGNS.some(d => d.id === body.catalog_design) ? body.catalog_design : (biz.catalog_design || 'catalogo');
  // Pagos en línea: campos de su propio <form> (marcador mp_form, igual que
  // horario_set) — así una vez guardado el access token no se borra solo
  // porque el dueño mandó otro de los formularios de Configuración.
  const mpFormPosted = Object.prototype.hasOwnProperty.call(body, 'mp_form');
  const mpAccessToken = mpFormPosted ? String(body.mp_access_token || '').trim().slice(0, 300) : biz.mp_access_token;
  const mpEnabled = mpAccessToken ? 1 : 0;
  // Transferencia bancaria: mismo patrón (marcador transfer_form en su propio
  // <form>) — el dueño publica su cuenta y el cliente transfiere y manda el
  // comprobante por WhatsApp, sin pasarela de por medio.
  const transferFormPosted = Object.prototype.hasOwnProperty.call(body, 'transfer_form');
  const transferBank = transferFormPosted ? String(body.transfer_bank || '').trim().slice(0, 120) : biz.transfer_bank;
  // CLABE (18 dígitos) o número de tarjeta/cuenta (10-20 dígitos) — se limpian
  // espacios/guiones que el dueño pudo copiar y pegar, y si lo que queda no
  // parece una cuenta real se descarta el cambio (se conserva la que ya
  // tenía) en vez de guardar algo que no sirve para recibir transferencias.
  const transferAccountRaw = String(body.transfer_account || '').trim().replace(/[\s-]/g, '');
  const transferAccount = transferFormPosted
    ? (transferAccountRaw === '' ? '' : (/^\d{10,20}$/.test(transferAccountRaw) ? transferAccountRaw : biz.transfer_account))
    : biz.transfer_account;
  const transferHolder = transferFormPosted ? String(body.transfer_holder || '').trim().slice(0, 120) : biz.transfer_holder;
  const transferEnabled = transferFormPosted ? (body.transfer_enabled === '1' ? 1 : 0) : biz.transfer_enabled;
  db.prepare(
    `UPDATE businesses SET name = ?, whatsapp = ?, description = ?, template = ?, color = ?, color_hex = ?, color_hex2 = ?, color_mode = ?, grid_cols = ?, logo = ?, banner = ?, giro = ?, giros = ?, estilo = ?, bg = ?, card = ?, text = ?, muted = ?, border = ?, radius = ?, font = ?, accent = ?, accent2 = ?, header = ?, header_text = ?, wa_message = ?, currency = ?, sections = ?, demo = ?, horario = ?, horario_msg = ?, blocks = ?, page_bg = ?, redes = ?, faq = ?, extras = ?, address = ?, catalog_design = ?, mp_access_token = ?, mp_enabled = ?, transfer_bank = ?, transfer_account = ?, transfer_holder = ?, transfer_enabled = ? WHERE id = ?`
  ).run(
    name || biz.name,
    cleanWa || biz.whatsapp,
    Object.prototype.hasOwnProperty.call(body, 'description') ? (description || '') : biz.description,
    TEMPLATES.includes(template) ? template : biz.template,
    colorObj ? colorObj.id : biz.color,
    colorObj ? colorObj.c1 : cleanHex,
    colorObj ? colorObj.c2 : cleanHex2,
    mode,
    cols,
    body.logo_clear ? '' : (logo || biz.logo),
    body.banner_clear ? '' : (banner || biz.banner),
    getGiros().includes(primaryGiro) ? primaryGiro : biz.giro,
    JSON.stringify(girosList.length ? girosList : (getGiros().includes(biz.giro) ? [biz.giro] : [])),
    estSel,
    designPosted ? pickOrReset(bg, estBase.bg) : biz.bg,
    designPosted ? pickOrReset(card, estBase.card) : biz.card,
    designPosted ? pickOrReset(text, estBase.text) : biz.text,
    designPosted ? pickOrReset(muted, estBase.muted) : biz.muted,
    designPosted ? pickOrReset(border, estBase.border) : biz.border,
    designPosted ? pickOrReset(radius, estBase.radius) : biz.radius,
    designPosted ? (fontOk ? pickOrReset(font, estBase.font) : '') : biz.font,
    designPosted ? pickOrReset(accent, estBase.accent) : biz.accent,
    designPosted ? pickOrReset(accent2, estBase.accent2) : biz.accent2,
    headerFinal,
    designPosted ? pickOrReset(header_text, estBase.headerText) : biz.header_text,
    waMessage,
    currency,
    sections,
    demo,
    horario,
    horarioMsg,
    blocks,
    sanitizePageBg(page_bg, Object.prototype.hasOwnProperty.call(body, 'page_bg'), biz.page_bg),
    redes,
    faq,
    extras,
    address,
    catDesign,
    mpAccessToken,
    mpEnabled,
    transferBank,
    transferAccount,
    transferHolder,
    transferEnabled,
    biz.id
  );
  // Modo fácil: guarda el preset elegido y crea las páginas sugeridas
  if (Object.prototype.hasOwnProperty.call(body, 'giro_preset')) {
    db.prepare('UPDATE businesses SET giro_preset = ?, onboarding_done = 1 WHERE id = ?').run(String(body.giro_preset || '').slice(0, 60), biz.id);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'paginas_sugeridas')) {
    let pags = [];
    try { pags = JSON.parse(body.paginas_sugeridas || '[]'); } catch (e) { pags = []; }
    db.crearPaginasSugeridas(biz.id, pags);
  }
  if (mpFormPosted) db.prepare('UPDATE businesses SET mp_public_key = ? WHERE id = ?').run(String(body.mp_public_key || '').trim().slice(0, 300), biz.id);
  return getBusiness(biz.slug);
}

app.get('/:slug/admin/config', requireAuth, can('config'), (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.render('config', configLocals(req.biz, {}));
});

app.post('/:slug/admin/config', requireAuth, can('config'), (req, res) => {
  const biz = applyConfig(req.biz, req.body);
  res.render('config', configLocals(biz, { ok: 'Configuración guardada' }));
});

// ================= CONSTRUCTOR DE DISEÑO (apartado propio) =================
app.get('/:slug/admin/diseno', requireAuth, can('diseno'), (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.render('diseno', { ...configLocals(req.biz, {}), active: 'diseno', money: moneyFor(req.biz), currencySymbol: currencyInfo(req.biz.currency).symbol, mascaraConfig: { MASCARA_SIZES, SHAPE_DEFS, getShapeClip: getShapeClip.toString(), MASCARA_CSS: MASCARA_CSS.replace(/\n\s*/g,'') } });
});

// ================= PLANES (el dueño ve y elige su plan) =================
app.get('/:slug/admin/planes', requireAuth, (req, res) => {
  if (req.role !== 'owner') return res.redirect('/' + req.params.slug + '/admin/panel');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const plans = db.prepare('SELECT * FROM plans WHERE active = 1 ORDER BY price ASC').all();
  const current = getPlan(req.biz);
  res.render('planes', { biz: req.biz, plans, current, ok: req.query.ok === '1' });
});

app.post('/:slug/admin/plan', requireAuth, (req, res) => {
  if (req.role !== 'owner') return res.redirect('/' + req.params.slug + '/admin/panel');
  const plan = db.prepare('SELECT * FROM plans WHERE key = ? AND active = 1').get(req.body.plan);
  if (!plan) return res.redirect('/' + req.params.slug + '/admin/planes');
  const ends = plan.days > 0 ? new Date(Date.now() + plan.days * 86400000).toISOString().slice(0, 10) : '';
  db.prepare('UPDATE businesses SET plan = ?, plan_price = ?, plan_ends_at = ? WHERE id = ?').run(plan.key, plan.price, ends, req.biz.id);
  res.redirect('/' + req.params.slug + '/admin/planes?ok=1');
});

// ================= EMPLEADOS =================
function getEmployees(bizId) {
  return db.prepare('SELECT id, name, perms, created_at FROM employees WHERE business_id = ? ORDER BY id').all(bizId)
    .map(e => { try { e.perms = JSON.parse(e.perms || '[]'); } catch (err) { e.perms = []; } return e; });
}
// Devuelve true si ese PIN ya lo usa el dueño u otro empleado
function pinInUse(biz, pin, excludeEmpId) {
  if (!pin) return false;
  if (biz.pin_hash && verifyPin(pin, biz.pin_hash)) return true;
  // Tiendas viejas que aún no migraron pueden tener el PIN real del dueño
  // solo en la columna legacy "pin" (ver el login en POST /:slug/admin) —
  // sin este fallback, un empleado nuevo podía quedarse con el mismo PIN
  // que el dueño porque aquí nunca se revisaba esa columna.
  if (biz.pin && verifyPin(pin, biz.pin)) return true;
  const emps = excludeEmpId
    ? db.prepare("SELECT pin_hash FROM employees WHERE business_id = ? AND id != ?").all(biz.id, excludeEmpId)
    : db.prepare("SELECT pin_hash FROM employees WHERE business_id = ?").all(biz.id);
  return emps.some(e => verifyPin(pin, e.pin_hash));
}
function parsePerms(body) {
  let raw = body.perms;
  if (!raw) return [];
  if (!Array.isArray(raw)) raw = [raw];
  return raw.flatMap(x => String(x).split(',')).map(s => s.trim()).filter(p => EMPLOYEE_PERMS.some(x => x.key === p));
}

app.get('/:slug/admin/empleados', requireAuth, can('empleados'), (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.render('empleados', { biz: req.biz, employees: getEmployees(req.biz.id), EMPLOYEE_PERMS, error: null, ok: req.query.ok === '1', formName: '', formPerms: [], formId: '' });
});

app.post('/:slug/admin/empleado', requireAuth, can('empleados'), (req, res) => {
  const name = String(req.body.name || '').trim();
  const pin = String(req.body.pin || '');
  const perms = parsePerms(req.body);
  const renderErr = (msg) => res.render('empleados', { biz: req.biz, employees: getEmployees(req.biz.id), EMPLOYEE_PERMS, error: msg, ok: false, formName: name, formPerms: perms, formId: '' });
  if (!name || !/^\d{4,12}$/.test(pin)) return renderErr('Escribe el nombre y un PIN de 4 a 12 dígitos.');
  if (pinInUse(req.biz, pin)) return renderErr('Ese PIN ya lo usa el dueño u otro empleado. Elige otro.');
  db.prepare('INSERT INTO employees (business_id, name, pin_hash, perms) VALUES (?, ?, ?, ?)').run(req.biz.id, name, hashPin(pin), JSON.stringify(perms));
  res.redirect('/' + req.params.slug + '/admin/empleados?ok=1');
});

// Editar empleado (nombre y permisos; PIN opcional)
app.post('/:slug/admin/empleado/:id', requireAuth, can('empleados'), (req, res) => {
  const emp = db.prepare('SELECT * FROM employees WHERE id = ? AND business_id = ?').get(req.params.id, req.biz.id);
  if (!emp) return res.redirect('/' + req.params.slug + '/admin/empleados');
  const name = String(req.body.name || '').trim();
  const perms = parsePerms(req.body);
  const renderErr = (msg) => res.render('empleados', { biz: req.biz, employees: getEmployees(req.biz.id), EMPLOYEE_PERMS, error: msg, ok: false, formName: name, formPerms: perms, formId: emp.id });
  if (!name) return renderErr('Escribe el nombre.');
  const pin = String(req.body.pin || '');
  if (pin) {
    if (!/^\d{4,12}$/.test(pin)) return renderErr('El PIN debe tener de 4 a 12 dígitos.');
    if (pinInUse(req.biz, pin, emp.id)) return renderErr('Ese PIN ya lo usa el dueño u otro empleado.');
    db.prepare('UPDATE employees SET name = ?, perms = ?, pin_hash = ? WHERE id = ?').run(name, JSON.stringify(perms), hashPin(pin), emp.id);
  } else {
    db.prepare('UPDATE employees SET name = ?, perms = ? WHERE id = ?').run(name, JSON.stringify(perms), emp.id);
  }
  res.redirect('/' + req.params.slug + '/admin/empleados?ok=1');
});

// Resetear el PIN de un empleado
app.post('/:slug/admin/empleado/:id/reset-pin', requireAuth, can('empleados'), (req, res) => {
  const emp = db.prepare('SELECT * FROM employees WHERE id = ? AND business_id = ?').get(req.params.id, req.biz.id);
  if (!emp) return res.redirect('/' + req.params.slug + '/admin/empleados');
  const pin = String(req.body.pin || '');
  const renderErr = (msg) => res.render('empleados', { biz: req.biz, employees: getEmployees(req.biz.id), EMPLOYEE_PERMS, error: msg, ok: false, formName: '', formPerms: [], formId: emp.id });
  if (!/^\d{4,12}$/.test(pin)) return renderErr('El nuevo PIN debe tener de 4 a 12 dígitos.');
  if (pinInUse(req.biz, pin, emp.id)) return renderErr('Ese PIN ya lo usa el dueño u otro empleado.');
  db.prepare('UPDATE employees SET pin_hash = ? WHERE id = ?').run(hashPin(pin), emp.id);
  res.redirect('/' + req.params.slug + '/admin/empleados?ok=1');
});

app.post('/:slug/admin/empleado/:id/eliminar', requireAuth, can('empleados'), (req, res) => {
  db.prepare('DELETE FROM employees WHERE id = ? AND business_id = ?').run(req.params.id, req.biz.id);
  res.redirect('/' + req.params.slug + '/admin/empleados');
});

// ================= PROVEEDORES Y COMPRAS =================
function combosOf(raw) {
  const model = parseVariantList(raw);
  const lists = model.attrs.map(a => (a.values && a.values.length) ? a.values : ['']);
  if (!lists.length) return [];
  return lists.reduce((acc, arr) => {
    if (!acc.length) return arr.map(v => [v]);
    const out = [];
    acc.forEach(prefix => arr.forEach(v => out.push(prefix.concat([v]))));
    return out;
  }, []).map(vals => vals.join(' / '));
}

function parsePoItems(raw) {
  const norm = (x) => ({ product_id: parseInt(x.product_id) || null, name: String(x.name || '').trim(), variant: String(x.variant || '').trim(), qty: parseInt(x.qty) || 0, cost: parseFloat(x.cost) || 0, price: parseFloat(x.price) || 0 });
  if (Array.isArray(raw)) return raw.map(norm).filter(x => x.name && x.qty > 0);
  const s = String(raw || '').trim();
  if (s.startsWith('[')) {
    try { const arr = JSON.parse(s); if (Array.isArray(arr)) return arr.map(norm).filter(x => x.name && x.qty > 0); } catch (e) {}
  }
  // Texto plano: una línea por producto "cantidad x nombre" o "nombre, cantidad, costo"
  return s.split(/\r?\n/).map(line => {
    const t = line.trim(); if (!t) return null;
    const m1 = t.match(/^(\d+)\s*[x*]\s*(.+)$/);
    if (m1) return { product_id: null, name: m1[2].trim(), variant: '', qty: parseInt(m1[1]), cost: 0 };
    const parts = t.split(/[,;\t]/).map(p => p.trim());
    return { product_id: null, name: parts[0], variant: '', qty: parseInt(parts[1]) || 0, cost: parseFloat(parts[2]) || 0 };
  }).filter(x => x && x.name && x.qty > 0);
}
function poMessage(supName, items, total) {
  const lista = items.map(it => '• ' + it.qty + ' x ' + it.name + (it.variant ? ' (' + it.variant + ')' : '') + (it.cost > 0 ? ' — ' + moneyRaw(it.cost) : '')).join('\n');
  return 'Hola ' + (supName || '') + ', me gustaría pedir:\n\n' + lista + '\n\nTotal estimado: ' + moneyRaw(total) + '\n\n¿Me confirmas disponibilidad y entrega?';
}
function moneyRaw(n) { return '$' + (Number(n || 0).toFixed(2)); }

app.get('/:slug/admin/proveedores', requireAuth, can('config'), (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE business_id = ? ORDER BY name').all(req.biz.id);
  const products = db.prepare('SELECT id, name, sku, stock, price, variants FROM products WHERE business_id = ? AND active = 1 ORDER BY name').all(req.biz.id)
    .map(p => { p.variantOpts = combosOf(p.variants); return p; });
  const pos = db.prepare('SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone, s.email AS supplier_email FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.business_id = ? ORDER BY po.id DESC LIMIT 40').all(req.biz.id)
    .map(po => { po.items = parsePoItems(po.items); po.msg = encodeURIComponent(poMessage(po.supplier_name, po.items, po.total)); po.esubject = encodeURIComponent('Pedido de compra'); po.ebody = encodeURIComponent(poMessage(po.supplier_name, po.items, po.total)); return po; });
  res.render('proveedores', {
    biz: req.biz, suppliers, products, pos,
    ok: req.query.ok === '1',
    error: ({
      nombre: 'Escribe el nombre del proveedor para guardarlo.',
      duplicado: 'Ese proveedor ya está en tu directorio.',
      proveedor: 'Selecciona un proveedor para registrar el pedido.',
      tabla: 'Cada fila necesita producto y cantidad mayor a 0.'
    })[req.query.error] || null,
    msg: req.query.msg || '',
    old: { name: req.query.n || '', phone: req.query.p || '', email: req.query.e || '', notes: req.query.no || '' },
    money: moneyFor(req.biz)
  });
});

app.post('/:slug/admin/proveedor', requireAuth, can('config'), (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const email = String(req.body.email || '').trim();
  const notes = String(req.body.notes || '').trim();
  const back = (code) => res.redirect('/' + req.params.slug + '/admin/proveedores?' + new URLSearchParams({ error: code, n: name, p: phone, e: email, no: notes }).toString());
  if (!name) return back('nombre');
  // Mismo nombre en la misma tienda = doble registro; avisamos en vez de duplicar
  const dup = db.prepare('SELECT id FROM suppliers WHERE business_id = ? AND LOWER(TRIM(name)) = LOWER(?)').get(req.biz.id, name);
  if (dup) return back('duplicado');
  db.prepare('INSERT INTO suppliers (business_id, name, phone, email, notes) VALUES (?, ?, ?, ?, ?)').run(req.biz.id, name, phone, email, notes);
  res.redirect('/' + req.params.slug + '/admin/proveedores?ok=1');
});

app.post('/:slug/admin/proveedor/:id/eliminar', requireAuth, can('config'), (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id = ? AND business_id = ?').run(req.params.id, req.biz.id);
  res.redirect('/' + req.params.slug + '/admin/proveedores');
});

app.post('/:slug/admin/compra', requireAuth, can('config'), (req, res) => {
  const back = (code) => res.redirect('/' + req.params.slug + '/admin/proveedores?error=' + code);
  const supplier_id = parseInt(req.body.supplier_id) || null;
  if (!supplier_id) return back('proveedor');
  const items = parsePoItems(req.body.items);
  // Cada fila registrada debe traer producto y cantidad; sin filas válidas no se crea el pedido
  if (!items.length || items.some(it => !it.name || !(it.qty > 0))) return back('tabla');
  const total = items.reduce((s, it) => s + (it.cost * it.qty), 0);
  db.prepare('INSERT INTO purchase_orders (business_id, supplier_id, items, total) VALUES (?, ?, ?, ?)').run(req.biz.id, supplier_id, JSON.stringify(items), total);
  res.redirect('/' + req.params.slug + '/admin/proveedores?ok=1');
});

// Marcar recibido: suma stock a los productos referenciados y crea automáticamente los libres (nuevos).
app.post('/:slug/admin/compra/:id/recibido', requireAuth, can('config'), (req, res) => {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND business_id = ?').get(req.params.id, req.biz.id);
  let creados = 0, actualizados = 0;
  if (po && !po.received) {
    const items = parsePoItems(po.items);
    items.forEach(it => {
      if (it.product_id) {
        if (it.variant) {
          const p = db.prepare('SELECT variants, made_to_order FROM products WHERE id = ? AND business_id = ?').get(it.product_id, req.biz.id);
          if (p) {
            const model = parseVariantList(p.variants);
            const key = it.variant.split(' / ').join('|');
            model.stock = model.stock || {};
            if (!p.made_to_order) model.stock[key] = (model.stock[key] || 0) + it.qty;
            // El costo capturado al hacer el pedido queda como el costo actual
            // de esa variante — así no hay que volver a escribirlo a mano en
            // Productos cada vez que se compra.
            if (it.cost > 0) { model.costs = model.costs || {}; model.costs[key] = it.cost; }
            db.prepare('UPDATE products SET variants = ? WHERE id = ?').run(JSON.stringify(model), it.product_id);
            actualizados++;
          }
        } else {
          if (it.cost > 0) {
            db.prepare('UPDATE products SET stock = CASE WHEN made_to_order = 1 THEN NULL ELSE COALESCE(stock, 0) + ? END, cost = ? WHERE id = ? AND business_id = ?').run(it.qty, it.cost, it.product_id, req.biz.id);
          } else {
            db.prepare('UPDATE products SET stock = CASE WHEN made_to_order = 1 THEN NULL ELSE COALESCE(stock, 0) + ? END WHERE id = ? AND business_id = ?').run(it.qty, it.product_id, req.biz.id);
          }
          actualizados++;
        }
      } else {
        // Producto libre: se crea automáticamente (rápido). Precio = PVP si se puso, si no = costo.
        const price = it.price > 0 ? it.price : it.cost;
        db.prepare('INSERT INTO products (business_id, name, price, old_price, stock, active, description, cost) VALUES (?, ?, ?, NULL, ?, 1, ?, ?)')
          .run(req.biz.id, String(it.name).slice(0, 160), price, it.qty, 'Creado desde pedido de compra. Ajusta foto/variantes en Productos.', it.cost || 0);
        creados++;
      }
    });
    db.prepare('UPDATE purchase_orders SET received = 1 WHERE id = ?').run(po.id);
  }
  const detalle = [];
  if (actualizados) detalle.push(actualizados + ' producto(s) con stock sumado');
  if (creados) detalle.push(creados + ' producto(s) nuevo(s) creado(s)');
  res.redirect('/' + req.params.slug + '/admin/proveedores?ok=1&msg=' + encodeURIComponent(detalle.join(' · ')));
});

app.post('/:slug/admin/compra/:id/eliminar', requireAuth, can('config'), (req, res) => {
  db.prepare('DELETE FROM purchase_orders WHERE id = ? AND business_id = ?').run(req.params.id, req.biz.id);
  res.redirect('/' + req.params.slug + '/admin/proveedores');
});

// ================= CONFIGURACIÓN DE DISEÑO (panel maestro) =================
app.get('/maestro/:id/config', maestroAuth, (req, res) => {
  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!biz) return res.redirect('/maestro/panel');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.render('config', configLocals(biz, { esMaestro: true }));
});

app.post('/maestro/:id/config', maestroAuth, (req, res) => {
  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!biz) return res.redirect('/maestro/panel');
  const updated = applyConfig(biz, req.body);
  res.render('config', configLocals(updated, { esMaestro: true, ok: 'Configuración guardada' }));
});

app.get('/maestro/:id/diseno', maestroAuth, (req, res) => {
  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!biz) return res.redirect('/maestro/panel');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.render('diseno', { ...configLocals(biz, { esMaestro: true }), money: moneyFor(biz), currencySymbol: currencyInfo(biz.currency).symbol, mascaraConfig: { MASCARA_SIZES, SHAPE_DEFS, getShapeClip: getShapeClip.toString(), MASCARA_CSS: MASCARA_CSS.replace(/\n\s*/g,'') } });
});

// Cambiar PIN (con el actual)
app.post('/:slug/admin/cambiar-pin', requireAuth, (req, res) => {
  const { pin_actual, pin_nuevo, pin_repite } = req.body;
  const biz = req.biz;
  const actualOk = biz.pin_hash && verifyPin(String(pin_actual || ''), biz.pin_hash);
  if (!actualOk) {
    return res.render('config', configLocals(biz, { error: 'El PIN actual no coincide.' }));
  }
  if (!pin_nuevo || !/^\d{6,12}$/.test(String(pin_nuevo)) || pin_nuevo !== pin_repite) {
    return res.render('config', configLocals(biz, { error: 'El PIN nuevo debe tener de 6 a 12 dígitos y coincidir.' }));
  }
  db.prepare('UPDATE businesses SET pin_hash = ?, pin = \'\' WHERE id = ?').run(hashPin(String(pin_nuevo)), biz.id);
  db.prepare('DELETE FROM sessions WHERE biz_id = ? AND token != ?').run(biz.id, req.cookies.sid || '');
  res.render('config', configLocals(getBusiness(biz.slug), { ok: 'PIN actualizado correctamente. Las demás sesiones fueron cerradas.' }));
});

// Resetear PIN (solo con código maestro)
app.post('/:slug/admin/resetear-pin', (req, res) => {
  const biz = getBusiness(req.params.slug);
  if (!biz) return res.status(404).render('404', { message: 'Tienda no encontrada' });
  const { master } = req.body;
  if (master !== MASTER_KEY) {
    return res.render('config', configLocals(biz, { error: 'Código maestro incorrecto. No se puede resetear el PIN.' }));
  }
  db.prepare('UPDATE businesses SET pin_hash = ?, pin = \'\' WHERE id = ?').run(hashPin('123456'), biz.id);
  db.prepare('DELETE FROM sessions WHERE biz_id = ?').run(biz.id);
  res.render('config', configLocals(getBusiness(biz.slug), { ok: 'PIN reseteado a 123456. Todas las sesiones fueron cerradas.' }));
});

// 404 para rutas no encontradas (después de todas las rutas)
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ ok: false, error: 'No encontrado' });
  res.status(404).render('404', { message: 'Página no encontrada' });
});

// Middleware central de errores: captura cualquier error que llegue con next(err)
app.use((err, req, res, next) => {
  if (req.path.startsWith('/api') || (req.xhr || (req.headers && req.headers['x-requested-with']) === 'XMLHttpRequest')) {
    console.error('[500 api]', err && (err.stack || err.message) || err);
    if (!res.headersSent) return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
  sendErrorPage(res, err);
});

const PORT = Number(process.env.PORT) || 3000; // '0' u otro valor no numérico cae al 3000
app.listen(PORT, () => {
  db.prepare("DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at < datetime('now')").run();
  setInterval(() => {
    db.prepare("DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at < datetime('now')").run();
  }, 60 * 60 * 1000);
  console.log(`Catálogo Fácil corriendo en http://localhost:${PORT}`);
  console.log(`Landing:      http://localhost:${PORT}/`);
  console.log(`Registrar:    http://localhost:${PORT}/registrar  (código maestro: ${MASTER_KEY})`);
  console.log(`Demo tienda:  http://localhost:${PORT}/ferreteria-demo`);
  console.log(`Panel demo:   http://localhost:${PORT}/ferreteria-demo/admin  (PIN: 1234)`);
});
