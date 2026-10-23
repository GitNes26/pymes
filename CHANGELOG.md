# Changelog

Formato: una sección por fecha, lo más reciente arriba. Prefijos: Fix, Feat, Estilo, BD, Docs.

## 2026-10-23

- **Fix:** el botón "Aplicar" del editor de imágenes se quedaba cargando sin fin con fotos de otro dominio (servicio de imágenes o enlaces externos): el navegador bloquea exportar un canvas con imágenes sin CORS y el error dejaba el botón deshabilitado. Ahora esas fotos se cargan por `/:slug/admin/img-proxy`, cualquier error libera el botón con un mensaje claro y la subida tiene límite de 45 s (`views/partials/img-editor.ejs`).
- **Fix:** en Productos, el editor de imágenes se abría detrás del modal de crear/editar producto (el modal usa `z-index:180` y el editor tenía 130), así que no se podía editar la foto. El editor ahora va en `z-index:1000` (`views/productos.ejs`).

## 2026-10-21

- **Estilo:** rediseño profesional de la presentación del catálogo público en sus 61 apariencias, con una capa final nueva `public/css/catalog-pro.css` que solo usa los tokens de cada apariencia:
  - Portada con descripción, estado de hoy ("Abierto ahora · Cierra a las 8:00 pm" / "Cerrado · Abre mañana…") y botones "Ver productos" y "Escríbenos" (WhatsApp). Las tiendas sin banner ni logo ahora tienen portada con su nombre.
  - La barra superior ya no deja una franja vacía bajo la portada: aparece al bajar, con logo, nombre, botón de WhatsApp e "Instalar app" como ícono.
  - Franja de confianza bajo la portada (WhatsApp, pago con tarjeta/transferencia, envíos, ubicación) solo con datos reales de la tienda.
  - Tarjetas de producto más limpias: una sola insignia de descuento, precio al fondo y alineado, disponibilidad discreta, "Agregar" + compartir (se quitó "Ver": toda la tarjeta abre el producto) y botón "Agotado" deshabilitado cuando no hay existencias.
  - Celular: buscador y categorías deslizables arriba de los productos; tarjetas más compactas (sin descripción) y portada que nunca se corta.
  - Pie de página: teléfono con formato (+52 871 …), enlaces a WhatsApp, llamada y mapa, y año automático.
- **Fix:** el "Abierto/Cerrado" de la portada usaba la hora del servidor (UTC) y marcaba mal el horario; ahora usa la hora de La Laguna (America/Monterrey).
- **Fix:** se ocultan los avisos duplicados "Precio rebajado -X%" en tarjetas y ficha de producto (ya lo dice la insignia de descuento).
- **Estilo:** en la apariencia "Natural Fresco" (vivero) los nombres y precios usan la tipografía de texto; la decorativa se deja para títulos.

## 2026-10-20

- **Fix:** el buscador y la paginación de la tabla de productos (`/:slug/admin/productos`) no ocultaban filas. La regla `body.products-admin-page .product-card { display:grid/block !important }` de `public/css/admin-workspace.css` tenía más especificidad que `.product-card.hidden`. Se agregó `body.products-admin-page .product-card.hidden { display:none !important; }`.
- **Docs:** se agregan `AGENTS.md`, `CLAUDE.md`, `README.md`, `CHANGELOG.md` y la carpeta `docs/`.
