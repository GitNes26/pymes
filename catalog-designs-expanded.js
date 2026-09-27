'use strict';

// Apariencias sectoriales. Comparten los mismos contratos de tokens que las
// apariencias base; `world` decide la composición y `for` prioriza giros.
function buildExpandedCatalogDesigns(fonts) {
  const d = (id, name, desc, emoji, world, font, colors, forGiros) => ({
    id, name, desc, emoji, world, for: forGiros,
    tokens: {
      bg: colors[0], card: colors[1], text: colors[2], textSec: colors[3],
      accent: colors[4], accentLight: colors[5], accentGlow: colors[6],
      border: colors[7], radius: colors[8], shadow: colors[9], font: fonts[font]
    }
  });

  return [
    // Alimentos y bebidas
    d('taqueria-nocturna', 'Taquería Nocturna', 'Alto contraste, ritmo callejero y antojo inmediato', '🌮', 'industrial', 'industrial', ['#17130f','#241d17','#fff4df','#c7b59f','#e94f1d','#ff764d','#f4c430','rgba(244,196,48,.22)',6,'0 12px 34px rgba(0,0,0,.35)'], ['taqueria','foodtruck','hamburgueseria']),
    d('parrilla', 'Parrilla de Autor', 'Carbón, cobre y fotografía amplia para cortes y asados', '🔥', 'artisan', 'artesanal', ['#211612','#2d1d17','#fff3e6','#c9aa92','#b94720','#d66d43','#d39b52','rgba(211,155,82,.2)',8,'0 14px 40px rgba(20,8,4,.35)'], ['carniceria','restaurante','rosticeria']),
    d('cafe-editorial', 'Café Editorial', 'Sobrio, tipográfico y cálido como una revista independiente', '☕', 'editorial', 'literaria', ['#f2eee6','#fffdf8','#29231e','#74695e','#6f4b36','#98705a','#c7a778','rgba(41,35,30,.12)',2,'0 8px 24px rgba(60,42,28,.08)'], ['cafeteria','libreria','panaderia']),
    d('pan-artesanal', 'Horno Artesanal', 'Harina, terracota y oficio para pan recién hecho', '🥐', 'artisan', 'artesanal', ['#fbf1df','#fffaf0','#3d2a1d','#8c7560','#a5542b','#c87a48','#d5aa62','rgba(165,84,43,.16)',14,'0 10px 30px rgba(84,50,24,.1)'], ['panaderia','pasteleria','cocinaeconomica']),
    d('marisqueria', 'Costa Fresca', 'Azules profundos y coral para producto del mar', '🦐', 'organic', 'geometrica', ['#eef8f8','#ffffff','#10383f','#5b7d82','#087f8c','#39a9b5','#ee7853','rgba(8,127,140,.15)',14,'0 12px 32px rgba(8,91,101,.12)'], ['mariscos','pescaderia','restaurante']),
    d('heladeria-pop', 'Heladería Pop', 'Color, formas suaves y lectura rápida para sabores', '🍦', 'soft', 'redondeada', ['#fff7fb','#ffffff','#422d48','#876f8d','#e85d9e','#f58bbc','#5ed0c0','rgba(232,93,158,.16)',24,'0 12px 32px rgba(232,93,158,.14)'], ['heladeria','dulceria','piniateria']),
    d('cocina-casera', 'Cocina Casera', 'Cálida, directa y confiable para menús del día', '🍲', 'artisan', 'amigable', ['#fbf5e9','#fffdf8','#342d22','#746a5c','#9b4f2f','#c07452','#6f8b4b','rgba(155,79,47,.14)',16,'0 8px 26px rgba(80,55,30,.09)'], ['cocinaeconomica','tortilleria','rosticeria']),
    d('gourmet', 'Gourmet Contemporáneo', 'Mucho aire y detalle fino para propuestas premium', '🍷', 'luxury', 'contemporanea', ['#f8f7f3','#ffffff','#24231f','#77736a','#7e5e34','#a8824c','#2f3a31','rgba(126,94,52,.16)',4,'0 14px 38px rgba(36,35,31,.09)'], ['restaurante','banquetes','vinos']),

    // Comercio, moda y accesorios
    d('mercado-barrio', 'Mercado de Barrio', 'Cercano, práctico y lleno de producto para venta diaria', '🛒', 'vibrant', 'amigable', ['#fff9ed','#ffffff','#243126','#657066','#da4e2a','#ef7658','#2f8a57','rgba(218,78,42,.15)',18,'0 10px 28px rgba(80,55,30,.1)'], ['abarrotes','fruteria','bazar']),
    d('moda-lujo', 'Moda de Autor', 'Retratos grandes, serif refinada y ritmo de pasarela', '👗', 'luxury', 'altaCostura', ['#f6f2ed','#ffffff','#201b18','#786d66','#7b493f','#a56f64','#bf9a68','rgba(123,73,63,.14)',0,'0 16px 44px rgba(32,27,24,.1)'], ['ropa','perfumeria','joyeria']),
    d('streetwear', 'Streetwear', 'Negro, lima y composición gráfica para moda urbana', '🧢', 'industrial', 'industrial', ['#e9ebea','#ffffff','#121416','#53595c','#121416','#34393c','#b8ec3c','rgba(18,20,22,.18)',0,'5px 5px 0 rgba(18,20,22,.2)'], ['ropa','calzado','ropausada']),
    d('infantil', 'Pequeño Mundo', 'Amable, claro y alegre para bebés y niños', '🧸', 'soft', 'redondeada', ['#f9f7ff','#ffffff','#39334d','#817a96','#8071d9','#a69aeb','#f3b94f','rgba(128,113,217,.14)',22,'0 10px 28px rgba(128,113,217,.12)'], ['ropabebe','articulosbebe','jugueteria','guarderia']),
    d('sneakers', 'Sneaker Drop', 'Producto protagonista, contraste fuerte y energía deportiva', '👟', 'vibrant', 'geometrica', ['#f2f3f4','#ffffff','#121416','#5d6267','#e13b2b','#f06b5f','#3454d1','rgba(18,20,22,.15)',10,'0 12px 0 rgba(52,84,209,.16)'], ['calzado','deportes','bicicletas']),
    d('perfumeria', 'Perfumería Etérea', 'Porcelana, lavanda y presentación delicada', '🌸', 'soft', 'luxe', ['#faf7fb','#ffffff','#332c38','#877d8b','#9d78a8','#b89ac0','#d7b7a3','rgba(157,120,168,.14)',22,'0 14px 34px rgba(117,84,126,.11)'], ['perfumeria','cosmeticos','regalos']),
    d('optica', 'Óptica Clara', 'Precisión visual, espacios limpios y azul confiable', '👓', 'editorial', 'geometrica', ['#f4f8fa','#ffffff','#182b34','#60737c','#176b87','#438ca4','#77b7c6','rgba(23,107,135,.14)',8,'0 8px 26px rgba(23,80,100,.08)'], ['optica','dental','medico']),

    // Salud, bienestar y cuidado
    d('clinica', 'Clínica Serena', 'Limpieza, calma y confianza para servicios de salud', '🩺', 'organic', 'geometrica', ['#f3f8f6','#ffffff','#1d3530','#617873','#287d6b','#55a08f','#92c9bb','rgba(40,125,107,.14)',14,'0 8px 26px rgba(34,91,78,.08)'], ['medico','fisioterapia','nutricion','farmacia']),
    d('dental-claro', 'Dental Claro', 'Blanco luminoso y azul preciso para tratamientos', '🦷', 'editorial', 'geometrica', ['#f5fafc','#ffffff','#17333f','#66808a','#1686a7','#4aa8c1','#a5dbe5','rgba(22,134,167,.14)',12,'0 9px 28px rgba(20,98,119,.08)'], ['dental','optica','medico']),
    d('bienestar', 'Bienestar Natural', 'Salvia, lino y tranquilidad para terapias y cuidado', '🧘', 'organic', 'literaria', ['#f5f5ef','#fffefa','#2f3b31','#778177','#6f8267','#91a18a','#c2aa83','rgba(111,130,103,.14)',18,'0 10px 28px rgba(70,84,68,.08)'], ['spa','nutricion','naturista','fisioterapia']),
    d('veterinaria', 'Compañeros', 'Amable y profesional para salud y productos de mascotas', '🐾', 'soft', 'amigable', ['#f3f8f5','#ffffff','#26382f','#718078','#3f8c68','#69a987','#e1a64b','rgba(63,140,104,.14)',20,'0 10px 28px rgba(45,100,75,.1)'], ['veterinaria','mascotas','esteticacanina']),
    d('barberia', 'Barbería Heritage', 'Oscuro, clásico y masculino con detalle cobre', '💈', 'artisan', 'vintage', ['#171717','#24211f','#f4eee7','#aea49b','#b36c3d','#ce8b5d','#e0b36a','rgba(179,108,61,.22)',6,'0 14px 38px rgba(0,0,0,.4)'], ['barberia','tatuajes']),
    d('tinta', 'Tinta Underground', 'Crudo, negro y rojo para estudios de tatuaje', '🖋️', 'industrial', 'brutalista', ['#e9e6df','#f8f6f1','#111111','#5e5a54','#111111','#333333','#bd2f2a','rgba(17,17,17,.2)',0,'6px 6px 0 rgba(17,17,17,.9)'], ['tatuajes','barberia','instrumentos']),
    d('fitness', 'Fitness Performance', 'Oscuro, eléctrico y compacto para rendimiento', '💪', 'industrial', 'industrial', ['#101416','#191f22','#eef7f4','#94a6a1','#1fd080','#55e3a2','#d2f43f','rgba(31,208,128,.2)',8,'0 12px 36px rgba(0,0,0,.35)'], ['gimnasio','deportes','bicicletas']),

    // Hogar, construcción, industria y movilidad
    d('construccion', 'Construcción Pro', 'Robusto, medible y directo para materiales y obra', '🧱', 'industrial', 'industrial', ['#ececea','#ffffff','#1e2224','#5d676b','#30383c','#59656a','#e8b22d','rgba(30,34,36,.18)',4,'4px 4px 0 rgba(30,34,36,.18)'], ['materialesconstruccion','ferreteria','pintura']),
    d('arquitectura', 'Arquitectura Material', 'Retícula sobria y fotografía amplia para acabados', '📐', 'editorial', 'contemporanea', ['#f2f1ed','#ffffff','#272824','#73756e','#6c6e62','#919386','#b08157','rgba(39,40,36,.12)',2,'0 10px 30px rgba(39,40,36,.07)'], ['pisos','vidrios','cortinas','mueblesoficina']),
    d('hogar-escandinavo', 'Hogar Escandinavo', 'Luminoso, ordenado y acogedor para casa', '🏠', 'organic', 'geometrica', ['#f7f5f0','#ffffff','#30352f','#7a8278','#6d7d67','#91a08b','#cbb99e','rgba(109,125,103,.12)',12,'0 8px 24px rgba(48,53,47,.06)'], ['muebles','colchones','hogar','cortinas']),
    d('automotriz', 'Motor Racing', 'Negro, rojo y producto agresivo para movilidad', '🏎️', 'industrial', 'industrial', ['#111315','#1b1f22','#f3f5f6','#9da4a8','#df3028','#f15c55','#f2b134','rgba(223,48,40,.22)',5,'0 14px 38px rgba(0,0,0,.4)'], ['taller','llantera','motos','autolavado']),
    d('refacciones', 'Refacciones Técnicas', 'Denso, ordenado y confiable para catálogos extensos', '⚙️', 'industrial', 'tecnica', ['#edf0f2','#ffffff','#17232b','#596a74','#1f5f7a','#3d7f99','#d89028','rgba(31,95,122,.16)',6,'0 8px 24px rgba(23,55,70,.09)'], ['refaccionaria','serviciotecnico','electricista','plomeria']),
    d('tecnologia', 'Tecnología Precisa', 'Oscuro limpio, cian y producto protagonista', '💻', 'tech', 'tecnica', ['#0c1118','#131c27','#e9f4ff','#91a4b8','#3cc7ed','#75daf5','#8e7cf0','rgba(60,199,237,.2)',10,'0 14px 40px rgba(0,0,0,.36)'], ['electronica','computo','celularesreparacion','serviciotecnico']),

    // Profesionales, creativos, educación, viajes y eventos
    d('corporativo', 'Corporativo Confiable', 'Orden, claridad y jerarquía para servicios profesionales', '💼', 'editorial', 'geometrica', ['#f4f6f8','#ffffff','#172533','#607080','#24577a','#4b7895','#9a7a4b','rgba(36,87,122,.14)',8,'0 8px 26px rgba(23,52,73,.08)'], ['contable','seguros','disenio']),
    d('legal', 'Legal Editorial', 'Serif sobria y azul tinta para experiencia profesional', '⚖️', 'luxury', 'clasica', ['#f6f4ef','#ffffff','#202a35','#69727c','#263f5a','#49637d','#aa8a51','rgba(38,63,90,.15)',4,'0 10px 30px rgba(32,42,53,.08)'], ['abogados','contable','seguros']),
    d('inmobiliario', 'Inmobiliario', 'Fotografía horizontal y lujo sobrio para propiedades', '🏡', 'luxury', 'contemporanea', ['#f4f3ef','#ffffff','#243029','#6c766f','#315b49','#5f806f','#bd9a61','rgba(49,91,73,.14)',8,'0 14px 38px rgba(36,48,41,.1)'], ['inmobiliaria','muebles','pisos']),
    d('fotografia', 'Fotografía de Autor', 'Negro profundo y grandes imágenes sin distracciones', '📷', 'luxury', 'editorial', ['#0f0f10','#18181a','#f5f5f2','#aaa9a5','#e4e1d8','#f4f2eb','#8d8a84','rgba(228,225,216,.16)',0,'0 18px 48px rgba(0,0,0,.5)'], ['fotografia','video','disenio']),
    d('musica', 'Escenario Sonoro', 'Nocturno, eléctrico y expresivo para música', '🎸', 'vibrant', 'vintage', ['#171021','#24172f','#fff2ff','#bea9c9','#d84bd2','#e77ce2','#50c8ff','rgba(216,75,210,.2)',12,'0 16px 42px rgba(0,0,0,.38)'], ['instrumentos','salonfiestas','eventos']),
    d('viajes', 'Bitácora de Viaje', 'Arena, océano y fotografía panorámica para experiencias', '✈️', 'organic', 'literaria', ['#f4f1e9','#fffdf8','#22383a','#697e7f','#147b83','#43a0a6','#d6a85d','rgba(20,123,131,.14)',14,'0 12px 34px rgba(31,77,80,.1)'], ['viajes','fotografia','eventos']),
    d('educacion', 'Aula Moderna', 'Clara, estructurada y amable para cursos y clases', '📚', 'soft', 'geometrica', ['#f4f7fb','#ffffff','#27344a','#6e7b90','#4066c3','#6f8dda','#e4a53d','rgba(64,102,195,.14)',16,'0 9px 28px rgba(48,77,141,.09)'], ['clasesparticulares','academiaidiomas','escuelamanejo','papeleria']),
    d('fiesta', 'Fiesta Total', 'Color intenso y energía para celebraciones', '🎊', 'vibrant', 'redondeada', ['#fff7f1','#ffffff','#3d2343','#8a708e','#f04d6d','#f77d95','#7047d7','rgba(240,77,109,.16)',22,'0 12px 0 rgba(112,71,215,.14)'], ['eventos','salonfiestas','piniateria','banquetes'])
  ];
}

function recommendCatalogDesigns(designs, presets, styleToDesign, worldByStyle, giroId, limit) {
  const giro = String(giroId || 'otros').toLowerCase();
  const preset = presets.find(p => p.id === giro) || presets.find(p => p.id === 'otros') || {};
  const preferredWorld = worldByStyle[preset.estilo] || 'classic';
  const primaryId = styleToDesign[preset.estilo] || 'catalogo';
  return designs.map((design, index) => {
    let score = 0;
    if ((design.for || []).includes(giro)) score += 100;
    if (design.id === primaryId) score += 55;
    if (design.world === preferredWorld) score += 25;
    if (design.id === 'catalogo') score += 8;
    if (['minimalista', 'elegante', 'vibrante'].includes(design.id)) score += 3;
    return { design, score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, Number(limit) || 8))
    .map(x => x.design.id);
}

module.exports = { buildExpandedCatalogDesigns, recommendCatalogDesigns };
