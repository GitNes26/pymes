# Prompts canónicos PRO para las apariencias del catálogo · v2

> Versión 2 del sistema de apariencias. La v1 definía **qué** componentes debe tener un catálogo y lo diferenciaba por paleta, columnas y proporción de foto. Esta v2 define **cómo debe sentirse**: ADN de marca, dirección de arte fotográfica, pareja tipográfica concreta, sistema de color con rampas tonales, coreografía de movimiento, materia y textura, un momento firma memorable y una barra de calidad que la IA debe autoevaluar antes de entregar.
>
> Uso: pega el **Prompt maestro PRO**, reemplaza `[DIRECCIÓN DE APARIENCIA]` con la ficha completa de una de las 61 direcciones (sección 3) y llena el contexto real del negocio.

---

## 1 · Prompt maestro PRO

```text
[DIRECCIÓN DE ARTE + SISTEMA DE DISEÑO — CATÁLOGO DIGITAL WHATSAPP · NIVEL ESTUDIO]

Actúa como un equipo de estudio completo en una sola voz: director de arte, diseñador de marca, diseñador de interfaz senior, diseñador de movimiento y front-end de producción. Tu estándar de referencia no es "una plantilla bonita": es el nivel de un sitio premiado (Awwwards / FWA / Site of the Day) que además vende, carga rápido y es accesible. Si el resultado podría confundirse con otra apariencia del catálogo cambiando solo los colores, está mal.

FICHA DE DIRECCIÓN
[DIRECCIÓN DE APARIENCIA]

CONTEXTO REAL DEL NEGOCIO
- Nombre: [NOMBRE DEL NEGOCIO]
- Giro: [GIRO]
- Productos o servicios principales: [PRODUCTOS/SERVICIOS]
- Cliente ideal (quién compra, desde qué dispositivo, en qué momento del día): [CLIENTE]
- Personalidad de marca en 3 adjetivos + 1 anti-adjetivo (lo que NUNCA debe parecer): [PERSONALIDAD]
- Fotografías disponibles: [TIPO Y CALIDAD DE FOTOGRAFÍAS]
- Logo y colores existentes (si hay): [MARCA ACTUAL]
- Zona de venta: [CIUDAD/ZONA]
- Horario, entregas y pagos: [DATOS REALES]

OBJETIVO DEL PRODUCTO
La persona dueña administra productos, precios, existencias y pedidos. El cliente explora, combina filtros, agrega al carrito y termina el pedido por WhatsApp. La interfaz debe (1) provocar deseo en los primeros 3 segundos, (2) dejar clarísimo qué se vende, cuánto cuesta y cómo pedirlo, y (3) sentirse hecha a mano para este giro, incluso con fotos reales de calidad variable.

======================================================================
0. ANTES DE DISEÑAR — CONCEPTO (OBLIGATORIO)
======================================================================

Antes de cualquier token, escribe:
- CONCEPTO en una frase-metáfora ("una vitrina de joyería a medianoche", "la pizarra de un mercado a las 7 a.m."). Toda decisión posterior debe poder justificarse con esta frase.
- TRES REFERENCIAS del mundo físico o editorial (no otros sitios web de catálogo): un objeto, un lugar y una publicación/marca. Explica qué tomas de cada una.
- TENSIÓN DE DISEÑO: dos fuerzas en equilibrio (p. ej. "lujo ↔ cercanía", "técnico ↔ amable"). Indica dónde gana cada una.
- MOMENTO FIRMA: la única cosa que el cliente recordará y le contará a alguien (una transición, un gesto, una composición). Debe ser útil, no decorativa.
- ANTI-REFERENCIAS: 3 cosas que este diseño NO será.

======================================================================
1. ADN VISUAL — TOKENS CON INTENCIÓN
======================================================================

1.1 TIPOGRAFÍA (el 60 % de la personalidad)
- Elige una pareja concreta de Google Fonts (Display + Texto) y, si aporta, una tercera utilitaria (mono o condensada) SOLO para datos (precio, SKU, horarios).
- Escala modular definida (ratio 1.200, 1.250, 1.333 o 1.414) con tamaños fluidos en clamp() para 360 → 1440 px.
- Define por nivel: tamaño, peso, interlineado, tracking y caso. Display grande con tracking negativo (-0.01 a -0.04em); etiquetas en mayúsculas con tracking positivo (+0.06 a +0.14em).
- Números: font-variant-numeric: tabular-nums en precios, cantidades y contadores; "lining" en tablas.
- Máximo 2 pesos por familia en la interfaz. Longitud de línea 45–75 caracteres. text-wrap: balance en títulos, pretty en párrafos.
- El precio es un elemento tipográfico de marca: define su tratamiento exacto (tamaño relativo, peso, signo de moneda, centavos en superíndice o no, precio anterior tachado con color de rol).

1.2 COLOR (sistema, no paleta)
- Define en OKLCH (y su HEX equivalente) una rampa tonal de 11 pasos (50–950) para: neutro con temperatura de la marca (nunca gris puro), primario y un acento. Más roles semánticos: éxito, aviso, error, info, oferta.
- Asigna ROLES, no colores: fondo, superficie, superficie elevada, borde sutil, borde fuerte, texto primario, secundario, terciario, acción, acción-hover, acción-presionada, foco, precio, oferta, agotado, overlay.
- Regla 60-30-10 explícita (qué ocupa cada proporción).
- Un color "firma" que solo aparezca en 1–3 lugares de toda la pantalla (CTA de WhatsApp, badge de oferta, momento firma). Su escasez lo hace valioso.
- Modo oscuro diseñado, no invertido: si la dirección es clara, define su versión nocturna con rampas propias; si es oscura, define cómo se ven las fotos sobre ella (halo, marco o viñeta).
- Verifica contraste AA de cada par texto/fondo que declares y repórtalo.

1.3 FORMA, MATERIA Y PROFUNDIDAD
- Radios: una escala (0 / 2 / 6 / 12 / 20 / pill) y qué componente usa cuál. Radios anidados: radio exterior = radio interior + padding.
- Bordes: grosor, color por rol y cuándo se usa borde vs. sombra vs. cambio de superficie.
- Elevación: 4 niveles de sombra construidos en capas (2–3 sombras apiladas con opacidad baja y color tintado de la marca, nunca negro puro).
- Materia: define la textura del mundo (grano de papel, ruido fotográfico al 2–4 %, lino, concreto, metal cepillado, nada). Se implementa con SVG/CSS ligero, nunca con imágenes pesadas, y nunca por encima del texto.
- Iconografía: un solo set (p. ej. Lucide, Phosphor o Tabler), grosor de trazo acorde a la tipografía, tamaño 20/24 px, y cuándo va relleno vs. contorno.

1.4 RETÍCULA Y RITMO
- Contenedor máximo, márgenes laterales fluidos y retícula de 4 (móvil) / 8 (tablet) / 12 (desktop) columnas.
- Espaciado base 4/8: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Ritmo vertical: define el "respiro" entre secciones (compresión/expansión) como una partitura: qué secciones son densas y cuáles son pausas.
- Al menos UNA ruptura intencional de la retícula por página (imagen que sangra, título que invade la columna vecina, número gigante de fondo) justificada por el concepto.
- Breakpoints: <360 (1 col), 360–767 (2 col), 768–1024 (2–3 col), 1025–1439 (3–4 col), ≥1440 (contenedor fijo con márgenes generosos, sin estirar tarjetas).

1.5 DIRECCIÓN DE ARTE FOTOGRÁFICA
- Proporción principal (1:1, 4:5, 4:3, 3:2, 16:10) y proporción del hero, reservadas con aspect-ratio (CLS = 0).
- Tratamiento para unificar fotos reales dispares: fondo de tarjeta que "abraza" la foto (color muestreado o neutro de marca), object-fit cover/contain según el objeto, filtro sutil opcional (contraste/saturación ±5 %, nunca Instagram), viñeta o marco si la dirección lo pide.
- Guía para la persona dueña: luz, fondo, ángulo, distancia, número de fotos por producto y qué evitar. En lenguaje simple.
- Fallback sin foto diseñado con la identidad (monograma, patrón de marca o ilustración lineal), nunca un ícono gris genérico.

======================================================================
2. MOVIMIENTO — COREOGRAFÍA, NO EFECTOS
======================================================================

- Define 3 curvas nombradas y úsalas siempre:
  * entrar: cubic-bezier(0.16, 1, 0.3, 1) (desaceleración expresiva)
  * salir: cubic-bezier(0.7, 0, 0.84, 0) (aceleración breve)
  * estándar: cubic-bezier(0.2, 0, 0, 1)
  Ajusta la personalidad (más elástica para giros juguetones con spring suave; más seca para técnicos/legales).
- Escala de duraciones: 120 ms (micro: hover, press), 200 ms (componentes: toggles, badges), 320 ms (paneles: drawer, modal), 480–700 ms (escenas: hero, transición de página). Salidas ≈ 70 % de la entrada.
- Solo transform, opacity, clip-path y filter en superficies pequeñas. Nunca animar width/height/top/left.
- Coreografía de carga del primer viewport (máx. 900 ms en total): orden exacto de aparición (logo → título → CTA → primera fila de productos) con stagger de 40–70 ms. El contenido es legible desde el primer frame (animar desde opacity 0.001 + translateY 8–16 px, nunca desde invisible total por más de 100 ms).
- Scroll: revelado de secciones con IntersectionObserver una sola vez; opcional scroll-driven animations (animation-timeline: view()) con fallback. Nada de parallax que maree en móvil.
- Transiciones compartidas: tarjeta → ficha de producto con View Transitions API (la imagen viaja y crece), con fallback de crossfade.
- Feedback táctil: botones con press (scale 0.97, 120 ms), estados con cambio de superficie además de color.
- Agregar al carrito = momento de recompensa: la miniatura vuela al carrito o el badge hace un conteo con rebote, + confirmación accesible (aria-live). Debe durar <600 ms y no bloquear.
- prefers-reduced-motion: sustituye desplazamientos por fundidos ≤150 ms; el momento firma debe tener su versión quieta igual de clara.
- Rendimiento: 60 fps en un Android de gama media; will-change solo durante la animación.

======================================================================
3. ESTRUCTURA DE LA INTERFAZ (conserva todo lo de la v1, elevado)
======================================================================

A. CABECERA Y HERO
1. Header sticky que se compacta al hacer scroll (altura 72 → 56 px, logo escala, fondo gana opacidad/blur solo si la dirección lo justifica). Marca, buscador, "Cómo comprar", instalar app, estado Abierto/Cerrado con punto vivo, WhatsApp, carrito con badge, acceso al panel.
2. Banner de campaña con cuenta regresiva tabular que no provoca saltos de layout.
3. Hero con composición propia de la dirección (no el bloque centrado genérico): define versión con foto/banner y versión solo tipográfica igual de bella. Titular con máximo 8 palabras y una propuesta de valor concreta. CTA primario + secundario.

B. NAVEGACIÓN Y FILTROS
4. Chips de categoría con scroll horizontal y snap en móvil, indicador activo animado (se desliza, no salta). En laptop y desktop, sidebar sticky de filtros a la izquierda y productos a la derecha; en móvil, bottom sheet con asa de arrastre. Filtros combinables, contadores recalculados, slider de precio, atributos, ordenamiento, "Limpiar filtros" y estado sin resultados con sugerencias.
5. Los resultados se actualizan con transición de lista (salen/entran con stagger ≤30 ms por tarjeta, máx. 12 animadas) sin perder la posición de scroll.

C. PRODUCTOS
6. Tarjeta con anatomía explícita (medidas en px de cada zona). Imagen con ratio reservado, segunda foto al hover en desktop y swipe en móvil con indicadores; badges con jerarquía (solo 1 visible dominante); título 2 líneas; precio como pieza tipográfica; stock; acción rápida "Agregar" que no obliga a abrir la ficha cuando no hay variantes.
7. Skeletons con shimmer sutil en la dirección de lectura, del mismo tamaño que el contenido real; imágenes con blur-up o color dominante mientras cargan.
8. Carruseles (Ofertas, Nuevos, Más vendidos) con scroll-snap, flechas accesibles y peek de la siguiente tarjeta.
9. Grid editorial: cada 8–12 productos se permite un módulo de ruptura (tarjeta destacada doble, cita, banner de categoría) si la dirección lo pide.

D. CARRITO Y WHATSAPP
10. FAB/barra de carrito persistente que aparece con animación de entrada cuando hay productos; no tapa acciones.
11. Drawer/bottom sheet de carrito: miniaturas, variantes, +/−, eliminar con "deshacer" 5 s, subtotal animado con números que cuentan, envío o "A calcular", formulario del cliente con validación inline que nunca borra datos, CTA "Enviar pedido por WhatsApp" con el color firma.
12. Mensaje de WhatsApp estructurado (saludo, lista, subtotales, total, cliente, entrega, pago, notas, enlace/ID).
13. Pantalla/estado de éxito después de enviar: agradecimiento con la voz de la marca y siguiente paso.

E. FICHA DE PRODUCTO
14. Galería con zoom (pinch en móvil), miniaturas, variantes como selectores visuales (swatches de color reales, tallas con estado agotado tachado), stock en vivo, descripción, especificaciones en tabla, compartir, relacionados. Llegada con transición compartida desde la tarjeta.

F. CONFIANZA Y CONTENIDO
15. Conócenos, lookbook/galería editorial, servicios/citas, reseñas, Cómo comprar 1-2-3, zonas y pagos, local/equipo, FAQ en acordeón accesible, contacto, footer completo con aviso de privacidad y términos.
16. Cada sección tiene una composición propia coherente con el concepto; prohibido apilar 10 secciones con el mismo layout "título centrado + 3 tarjetas".

G. MICROCOPY Y VOZ
17. Define la voz (tuteo/usted, cercanía, humor sí/no) y escribe: CTA principal, estado vacío, sin resultados, error de imagen, agotado, por pedido, carrito vacío, éxito de pedido y 404. Nada de textos genéricos ("No hay resultados").

======================================================================
4. BARRA DE CALIDAD — AUTOCRÍTICA OBLIGATORIA ANTES DE ENTREGAR
======================================================================

Evalúa tu propuesta del 1 al 5 en cada criterio. Si algo sale <4, corrígelo y vuelve a evaluar. Entrega la tabla final.
1. Distinción: ¿se reconoce la apariencia en escala de grises y sin logo?
2. Coherencia: ¿header, tarjeta, carrito, formularios y footer pertenecen al mismo mundo?
3. Jerarquía: en 3 segundos, ¿se entiende qué venden, cuánto cuesta y cómo pedir?
4. Tipografía: ¿la pareja y la escala tienen carácter y el precio es memorable?
5. Color: ¿el color firma es escaso y valioso? ¿todo pasa AA?
6. Movimiento: ¿cada animación comunica algo? ¿existe el momento firma y su versión reduced-motion?
7. Fotografía real: ¿se ve bien con fotos de celular mal iluminadas?
8. Móvil primero: ¿con el pulgar se puede filtrar, agregar y pedir sin frustración?
9. Rendimiento: LCP < 2.5 s en 4G, CLS < 0.05, INP < 200 ms.
10. Accesibilidad: teclado completo, foco visible con estilo de marca, objetivos ≥44 px, lectores de pantalla.

ANTIPATRONES PROHIBIDOS
- Gradientes morado-azul genéricos, glassmorphism sin motivo, sombras negras duras, todo redondeado a 16 px, emojis como iconos, stock photos, "Lorem ipsum", texto gris claro sobre blanco, más de 3 familias tipográficas, animaciones de 1 s en botones, carruseles automáticos, pop-ups al entrar, sticky elements que tapan el contenido en móvil.

======================================================================
5. FORMATO DEL ENTREGABLE
======================================================================

Entrega exactamente:
1. Concepto (frase-metáfora, referencias, tensión, momento firma, anti-referencias).
2. Tokens como variables CSS listas para pegar (:root y modo oscuro): tipografía, escala fluida, rampas de color OKLCH+HEX con roles, espaciado, radios, bordes, sombras en capas, curvas y duraciones.
3. Especificación Desktop con anatomía en px de hero, tarjeta, filtros, carrito y ficha.
4. Especificación Tablet y Mobile con prioridades y gestos.
5. Inventario de componentes × estados (default, hover, active, focus, disabled, loading, error, vacío, éxito).
6. Coreografía de movimiento: tabla con elemento, disparador, propiedades, duración, curva, stagger y fallback reduced-motion. Incluye el momento firma en detalle y en código CSS/JS.
7. Mensaje de WhatsApp con ejemplo completo.
8. Microcopy completo con la voz de la marca.
9. Guía de fotografía para la persona dueña (simple, en viñetas).
10. Tabla de autocrítica con calificaciones finales y criterios de aceptación verificables.

Si falta información comercial, usa placeholders claramente marcados y no inventes afirmaciones (premios, años, reseñas reales).
```

---

## 2 · Cómo escribir una ficha de dirección

Cada dirección se entrega a la IA con esta estructura. Las 61 fichas de la sección 3 ya vienen en este formato compacto:

```text
[NOMBRE (`id`)]
Concepto: frase-metáfora.
Tipografía: Display + Texto (+ utilitaria).
Color: fondo · texto · primario · firma (HEX).
Composición: proporción de foto, columnas, hero, tarjeta.
Materia: textura y profundidad.
Movimiento: personalidad + momento firma.
Evitar: lo que la haría genérica.
```

---

## 3 · Las 61 direcciones (fichas PRO)

### 1–25 · Apariencias originales

1. **Clásico (`catalogo`)**
Concepto: el mostrador de una tienda de barrio con 40 años de prestigio. · Tipografía: Fraunces (opsz alto) + Inter. · Color: marfil #F7F3EA · tinta #1C2433 · azul tinta #22407A · firma latón #B08A3E. · Composición: 4:3, 4 columnas, hero dividido 7/5 con titular serif grande, tarjetas con borde de 1 px que se eleva al hover. · Materia: grano de papel 2 %. · Movimiento: sobrio; momento firma = el precio se "sella" con un leve escalado al agregar. · Evitar: parecer plantilla de e-commerce.

2. **Vitrina Elegante (`joyeria`)**
Concepto: vitrina de alta joyería a medianoche, cada pieza bajo su propio foco. · Tipografía: Cormorant Garamond (300/500) + Jost. · Color: negro cálido #121010 · marfil #EFE7D8 · oro #C9A45C · firma champagne #E8D3A2. · Composición: 4:5, 3 columnas con márgenes enormes, nombre y precio centrados, marco dorado de 1 px con esquinas en L. · Materia: viñeta radial sobre cada foto como luz de vitrina. · Movimiento: lento y preciso (480 ms); momento firma = al hover un haz de luz recorre la joya (gradiente diagonal en máscara). · Evitar: dorado brillante tipo casino.

3. **Pastel Suave (`postres`)**
Concepto: la charola de una pastelería francesa por la mañana. · Tipografía: Gloock + Nunito. · Color: crema #FFF6EE · cacao #4A2C22 · rosa #F2B5C4 · firma frambuesa #D9476B. · Composición: 1:1, 3–4 columnas, tarjetas con radio 20 y base tipo "plato" (sombra elíptica suave bajo la foto). · Materia: ninguna, superficies de azúcar glas. · Movimiento: spring suave; momento firma = al agregar, la tarjeta hace un pequeño "bote" como un pastel apoyado. · Evitar: infantil o cursi.

4. **Editorial B/N (`ropa`)**
Concepto: la revista de moda impresa en papel mate. · Tipografía: Playfair Display (italic) + Neue Montreal/Inter Tight. · Color: blanco #FAFAF8 · negro #0B0B0B · gris #6B6B6B · firma rojo editorial #C8102E. · Composición: 4:5, 3 columnas con una tarjeta doble cada 7, hero a la izquierda con número de "edición" gigante, esquinas rectas. · Materia: nada. · Movimiento: cortes secos tipo página; momento firma = transición tarjeta→ficha como pasar página (clip-path horizontal). · Evitar: sombras y redondeos.

5. **Botánico Romántico (`floreria`)**
Concepto: un herbario victoriano abierto sobre la mesa. · Tipografía: Cormorant + Karla. · Color: blanco lino #F8F6F1 · salvia #7C9A82 · rosa empolvado #E7C1C0 · firma verde hoja #3F6B4E. · Composición: 4:5, 3 columnas, marcos con esquinas finas de línea vegetal SVG. · Materia: papel algodón. · Movimiento: ondulante (ease entrar suave); momento firma = una rama de línea se dibuja (stroke-dashoffset) al llegar a cada sección. · Evitar: flores clipart.

6. **Industrial (`ferreteria`)**
Concepto: el tablero de herramientas del taller, todo en su lugar y etiquetado. · Tipografía: Barlow Condensed (700) + Barlow + JetBrains Mono para SKU. · Color: acero #E9EBEE · negro #15171A · gris #4B525C · firma amarillo seguridad #FFC400. · Composición: 4:3, 4 columnas densas, tarjetas con cabecera de etiqueta técnica, esquinas a 45° con clip-path. · Materia: metal cepillado muy sutil. · Movimiento: seco, mecánico (120–200 ms, sin rebote); momento firma = el badge de cantidad gira como contador mecánico. · Evitar: grunge sucio.

7. **Cálido Artesanal (`muebles`)**
Concepto: el taller del carpintero con la luz de la tarde. · Tipografía: Young Serif + Instrument Sans. · Color: lino #F4EEE4 · nogal #5A3B26 · crema #EADFCB · firma cobre #B5653A. · Composición: 3:2, 3 columnas amplias, fichas con medidas visibles, hero con foto de ambiente a sangre. · Materia: veta de madera solo en separadores. · Movimiento: pausado; momento firma = al hover la foto hace un leve zoom de 1.04 como acercarse a tocar la madera. · Evitar: rústico sucio.

8. **Minimalista Rosa (`cosmeticos`)**
Concepto: estante de porcelana en un baño bañado de luz. · Tipografía: DM Serif Display + DM Sans. · Color: porcelana #FBF7F5 · tinta #2A2023 · rosa dorado #D8A7A0 · firma rosa intenso #C45A74. · Composición: 1:1 producto centrado sobre fondo tonal, 4 columnas, texto centrado. · Materia: brillo satinado en fondo de tarjeta (gradiente radial 3 %). · Movimiento: fluido; momento firma = swatches de tono que al elegir tiñen el fondo de la tarjeta. · Evitar: rosa chicle.

9. **Natural Fresco (`vivero`)**
Concepto: invernadero en la mañana, con rocío. · Tipografía: Bricolage Grotesque + Figtree. · Color: blanco verdoso #F3F7F1 · verde bosque #1F4D36 · verde vivo #57A773 · firma terracota #C8643B. · Composición: 4:3, 4 columnas, tarjetas con radio orgánico asimétrico sutil, fichas con cuidados (luz, riego) en iconos. · Materia: nada. · Movimiento: brote (scale 0.96→1 con spring); momento firma = los iconos de cuidado se llenan como nivel de agua. · Evitar: ecológico genérico.

10. **Glam Dorado (`belleza`)**
Concepto: el tocador de una estrella antes de salir a escena. · Tipografía: Bodoni Moda + Manrope. · Color: rosa niebla #F8EDEB · tinta cálida #2B1E1E · champagne #D9BE8C · firma rosa profundo #A8445E. · Composición: 4:5, 3 columnas con escalonado en desktop, servicios como menú editorial. · Materia: destellos microscópicos solo en el hero. · Movimiento: glamoroso; momento firma = el CTA "Agendar" tiene un brillo que cruza una vez al entrar en pantalla. · Evitar: exceso de dorado.

11. **Nocturno Elegante (`eventos`)**
Concepto: la invitación impresa de una gala. · Tipografía: Italiana + Outfit. · Color: ciruela #1E1024 · marfil #F2E9DC · champagne #CBB27C · firma vino #7A1F3D. · Composición: 3:2, 3 columnas, hero teatral centrado con titular gigante, esquinas rectas. · Materia: telón de terciopelo con gradiente profundo. · Movimiento: teatral (700 ms en hero); momento firma = el hero se "abre" como telón (clip-path desde el centro). · Evitar: neón.

12. **Minimalista (`minimalista`)**
Concepto: una galería de arte en blanco. · Tipografía: Inter Tight + Inter. · Color: blanco #FFFFFF · negro #111111 · gris #767676 · firma negro puro en CTA. · Composición: 4:5, 3 columnas, sin bordes ni sombras, solo espacio; precio alineado a la derecha como cédula de museo. · Materia: nada. · Movimiento: casi imperceptible (fade 200 ms); momento firma = el subrayado del enlace se dibuja de izquierda a derecha. · Evitar: sentirse vacío o sin terminar.

13. **Pastel Dreams (`pastel`)**
Concepto: una tienda de dulces en una nube. · Tipografía: Fredoka + Nunito. · Color: lavanda #F1ECFB · tinta #2E2640 · menta #BFEAD9 · firma lila #8B6CD9. · Composición: 1:1, 4 columnas con alturas alternas en desktop, radio 24. · Materia: nubes suaves difuminadas en fondo. · Movimiento: flotante (spring); momento firma = el carrito "respira" cuando tiene productos. · Evitar: bebé.

14. **Monocromo (`monocromo`)**
Concepto: un póster neobrutalista pegado en la calle. · Tipografía: Space Grotesk (700) + Space Mono. · Color: blanco #FFFFFF · negro #000000 · firma amarillo #FFE600. · Composición: 1:1, bordes 2 px, sombras duras desplazadas 4 px, mayúsculas. · Materia: nada. · Movimiento: press físico (la sombra se colapsa al presionar); momento firma = los botones se hunden 4 px. · Evitar: ilegibilidad.

15. **Bohemio (`bohemio`)**
Concepto: un bazar de textiles tejidos a mano. · Tipografía: Recoleta/Fraunces soft + Work Sans. · Color: arena #F3E6D3 · tinta #3A2618 · terracota #C66A3D · firma mostaza #D9A21B. · Composición: 4:5, 3 columnas escalonadas, bordes con patrón tejido SVG en separadores. · Materia: textura de tela. · Movimiento: cálido; momento firma = patrón que se "teje" en el separador al hacer scroll. · Evitar: hippie cliché.

16. **Oceánico (`oceanico`)**
Concepto: una casa de playa con la ventana abierta. · Tipografía: Newsreader + Public Sans. · Color: arena #F4EFE6 · azul profundo #0E3B4A · verde azulado #2F7F86 · firma coral #E26D5A. · Composición: 16:10, 3 columnas, tarjetas planas con regla inferior. · Materia: ninguna. · Movimiento: ondulante; momento firma = línea de horizonte que ondula suavemente en el hero (SVG). · Evitar: clip art marino.

17. **Nórdico (`nordico`)**
Concepto: una cabaña escandinava con luz de invierno. · Tipografía: Epilogue + Inter. · Color: blanco cálido #F7F5F0 · grafito #2B2E2F · salvia #9BAE9D · firma roble #B98B5E. · Composición: 4:3, 3 columnas con mucho aire, geometría limpia. · Materia: lana muy sutil. · Movimiento: calmado; momento firma = aparece una "etiqueta colgante" con el precio al hover. · Evitar: frialdad clínica.

18. **Vibrante (`vibrante`)**
Concepto: un festival de color en cartel serigrafiado. · Tipografía: Clash Display/Unbounded + Inter. · Color: crema #FFF8EF · morado #3B1C6E · coral #FF6B5B · firma amarillo #FFD23F. · Composición: 1:1, 4 columnas, bloques de color detrás de las fotos, títulos enormes. · Materia: grano de serigrafía. · Movimiento: enérgico pero breve; momento firma = la tarjeta rota ±1.5° al hover como cartel pegado. · Evitar: caos.

19. **Retro Vintage (`retro`)**
Concepto: la tienda de abarrotes de los 70. · Tipografía: Cooper (via "Coustard"/"Bagel Fat One") + Space Grotesk. · Color: crema #F5EBD7 · café #3B2A1D · mostaza #E0A526 · firma naranja quemado #D2572A. · Composición: 4:3, bordes marcados, sombra desplazada, etiquetas de precio como sello. · Materia: papel envejecido. · Movimiento: rebote retro; momento firma = etiqueta de precio que se estampa al agregar. · Evitar: kitsch forzado.

20. **Futurista (`futurista`)**
Concepto: la interfaz de una nave en órbita. · Tipografía: Chakra Petch/Orbitron (solo display) + IBM Plex Sans + IBM Plex Mono. · Color: azul noche #070B1A · texto #E6ECFF · cian #28E0F0 · firma violeta #8A5BFF. · Composición: 16:10, 3 columnas, bordes luminosos de 1 px, esquinas recortadas. · Materia: retícula de puntos. · Movimiento: preciso; momento firma = escaneo de línea que recorre la tarjeta al cargar. · Evitar: ciberpunk ilegible.

21. **Rústico (`rustico`)**
Concepto: la despensa de un rancho. · Tipografía: Alegreya + Alegreya Sans. · Color: crudo #F1E9DA · tierra #3E2C1E · oliva #6B7B3A · firma terracota #B4532A. · Composición: 3:2, 3 columnas, controles compactos, etiquetas como costal. · Materia: papel kraft. · Movimiento: pausado; momento firma = sello de "hecho a mano" que se estampa en productos artesanales. · Evitar: western.

22. **Elegante Blanco (`elegante`)**
Concepto: una boutique en una avenida de lujo a mediodía. · Tipografía: Cormorant Garamond + Montserrat (300). · Color: blanco #FFFFFF · tinta #1A1A1A · gris perla #D9D6D0 · firma oro #B89A5B. · Composición: 4:5, 3 columnas, marcos finos, sombras nulas. · Materia: nada. · Movimiento: lento y seguro; momento firma = línea dorada que se traza bajo el titular. · Evitar: frío.

23. **Urbano (`urbano`)**
Concepto: una pared de concreto con stickers. · Tipografía: Archivo Black + Archivo. · Color: concreto #D6D4CF · negro #111 · firma lima #C6F432. · Composición: 1:1, 4 columnas, mayúsculas compactas, bordes gruesos. · Materia: concreto. · Movimiento: rápido; momento firma = sticker "NUEVO" que se despega al hover. · Evitar: graffiti ilegible.

24. **Tropical (`tropical`)**
Concepto: un puesto de frutas en la playa. · Tipografía: Rubik (800) + Rubik. · Color: crema #FFF6E8 · verde jungla #0F4D3A · coral #FF6F59 · firma mango #FFB627. · Composición: 3:2, 4 columnas, formas redondeadas, hojas como recortes en esquinas. · Materia: nada. · Movimiento: alegre; momento firma = hojas que se mecen levemente en el hero. · Evitar: hawaiano cliché.

25. **Acuarela (`acuarela`)**
Concepto: un cuaderno de acuarelas abierto. · Tipografía: Libre Caslon Display + Mulish. · Color: papel #FAF7F2 · tinta #283044 · azul #7FA7D6 · firma lavanda #9A87C9. · Composición: 5:4, 3–4 columnas, bordes de tarjeta con variación orgánica sutil. · Materia: manchas de acuarela solo en fondos de sección. · Movimiento: difuminado; momento firma = mancha de color que se expande detrás de la tarjeta al hover. · Evitar: infantil.

### 26–61 · Apariencias sectoriales

26. **Taquería Nocturna (`taqueria-nocturna`)** — Concepto: el puesto de tacos a las 11 p.m. con su foco y letrero pintado a mano. · Tipografía: Anton + Barlow + mono para precios. · Color: carbón #141212 · blanco hueso #F4EDE1 · rojo chile #D7263D · firma amarillo maíz #FFC53D. · Composición: 4:3, 4 columnas densas, precios gigantes, hero a la izquierda. · Materia: vapor/humo sutil en hero. · Movimiento: rápido, con chispa; momento firma = el foco del letrero "parpadea" una vez al cargar y el estado "Abierto" late. · Evitar: sombrero y cliché mexicano.

27. **Parrilla de Autor (`parrilla`)** — Concepto: la brasa en la penumbra. · Tipografía: Fraunces (900) + Inter. · Color: carbón #16110F · crema #EFE3D2 · cuero #7A4B2A · firma cobre brasa #D26A2E. · Composición: 3:2, 3 columnas, fotos con viñeta cálida, término de cocción como selector. · Materia: brasa difusa. · Movimiento: brillo cálido; momento firma = resplandor de brasa bajo la tarjeta al hover. · Evitar: flamas clipart.

28. **Café Editorial (`cafe-editorial`)** — Concepto: una revista indie leída junto a un espresso. · Tipografía: Newsreader + Inter + números estilo antiguo. · Color: papel #F3EDE3 · espresso #2A1D17 · cobre #A8653A · firma crema #E7C99B. · Composición: 4:5, 3 columnas, secciones como páginas numeradas, capitulares. · Materia: grano de papel. · Movimiento: página; momento firma = el número de página cambia al hacer scroll entre secciones. · Evitar: cafetería genérica con granos.

29. **Horno Artesanal (`pan-artesanal`)** — Concepto: la pizarra del horno a las 6 a.m. · Tipografía: Gloock + Instrument Sans. · Color: harina #F7F1E6 · corteza #5B3A22 · trigo #D9B26B · firma terracota #B85C38. · Composición: 3:2, 3 columnas, sección de proceso en línea de tiempo, horarios de horneado. · Materia: harina espolvoreada. · Movimiento: cálido; momento firma = badge "recién horneado" con vapor animado. · Evitar: rústico sucio.

30. **Costa Fresca (`marisqueria`)** — Concepto: la barra de mariscos con hielo y limón. · Tipografía: Bricolage Grotesque + Figtree. · Color: blanco espuma #F4FAFB · azul profundo #0B3A57 · turquesa #1FB5B0 · firma coral #FF7A59. · Composición: 3:2, 3 columnas, "pesca del día" con disponibilidad y zonas destacadas. · Materia: nada. · Movimiento: fresco; momento firma = indicador "fresco hoy" con destello de hielo. · Evitar: anclas y redes.

31. **Heladería Pop (`heladeria-pop`)** — Concepto: la vitrina de sabores con sus cucharitas de colores. · Tipografía: Chewy/Fredoka + Nunito. · Color: crema #FFF7F0 · chocolate #3B2320 · menta #9FE3C6 · firma rosa fresa #FF6FA0. · Composición: 1:1, 4 columnas, cada tarjeta toma un tono del sabor, selector de tamaño y toppings visual. · Materia: nada. · Movimiento: juguetón; momento firma = bola que "cae" en el cono/carrito al agregar. · Evitar: saturación total.

32. **Cocina Casera (`cocina-casera`)** — Concepto: la mesa de la abuela con mantel de cuadros. · Tipografía: Lora + Nunito Sans. · Color: crema #FBF4E9 · barro #7A3E26 · verde cocina #4E7A4B · firma rojo mantel #C23B30. · Composición: 3:2, 3 columnas, "menú del día" destacado con hora límite. · Materia: mantel en separadores. · Movimiento: cercano; momento firma = contador "quedan X porciones". · Evitar: fonda sucia.

33. **Gourmet Contemporáneo (`gourmet`)** — Concepto: la carta de un restaurante con estrella. · Tipografía: Canela/Gloock + Söhne/Inter. · Color: marfil #F6F2EA · tinta #151515 · latón #9C8150 · firma verde oliva #4D5B3A. · Composición: 4:5, 3 columnas con aire extremo, platos como obras. · Materia: nada. · Movimiento: mínimo y preciso; momento firma = revelado del plato con máscara circular. · Evitar: pretencioso ilegible.

34. **Mercado de Barrio (`mercado-barrio`)** — Concepto: los letreros de precio del mercado. · Tipografía: Bebas Neue + Work Sans. · Color: papel #FFFBEF · tinta #1A1A1A · verde #2E8B57 · firma rojo oferta #E53935. · Composición: 1:1, 4 columnas llenas, ofertas grandes con etiqueta fluorescente, categorías rápidas. · Materia: papel de estraza. · Movimiento: práctico; momento firma = etiqueta de oferta que se balancea. · Evitar: desorden.

35. **Moda de Autor (`moda-lujo`)** — Concepto: backstage de pasarela. · Tipografía: Bodoni Moda + Inter Tight. · Color: marfil #F4EFE8 · negro #111 · vino #6B1E2E · firma oro #B79A5C. · Composición: 4:5, 3 columnas, lookbook a sangre dominante. · Materia: nada. · Movimiento: pasarela; momento firma = lookbook con desplazamiento horizontal controlado por scroll. · Evitar: fast fashion.

36. **Streetwear (`streetwear`)** — Concepto: el drop de una marca en la calle. · Tipografía: Druk-like (Anton) + Space Mono. · Color: concreto #D9D9D6 · negro #0A0A0A · firma lima #C8FF00. · Composición: 4 columnas, retrato recortado, tallas visibles, contador del drop. · Materia: ruido. · Movimiento: glitch mínimo; momento firma = cuenta regresiva del drop con dígitos que caen. · Evitar: ilegible.

37. **Pequeño Mundo (`infantil`)** — Concepto: cuarto infantil ordenado y luminoso. · Tipografía: Baloo 2 + Nunito. · Color: crema #FFF9EE · lavanda #B7A6E8 · tinta #2E2A4A · firma amarillo #FFCF4A. · Composición: 1:1, 4 columnas, filtros por edad/talla visuales. · Materia: nada. · Movimiento: rebote suave; momento firma = estrellita que salta al carrito. · Evitar: colores primarios chillones.

38. **Sneaker Drop (`sneakers`)** — Concepto: la pared de tenis de una tienda insignia. · Tipografía: Archivo (900 expandida) + Archivo. · Color: gris #EDEEF0 · negro #0D0D0D · firma rojo #E4002B · azul #1F4BD8. · Composición: 1:1 con tenis grande flotando con sombra, 4 columnas, tallas y stock prioritarios. · Materia: nada. · Movimiento: dinámico; momento firma = el tenis rota 8° y flota al hover. · Evitar: logotipos de marcas.

39. **Perfumería Etérea (`perfumeria`)** — Concepto: niebla de perfume a contraluz. · Tipografía: Cormorant + Jost (300). · Color: porcelana #FAF7F6 · tinta #2B2630 · lavanda #C9B8E3 · firma nude #D9A89A. · Composición: 1:1 centrado, 3 columnas aireadas, notas olfativas (salida/corazón/fondo) como pirámide. · Materia: bruma difusa. · Movimiento: etéreo; momento firma = bruma que se expande desde el frasco al hover. · Evitar: dorado excesivo.

40. **Óptica Clara (`optica`)** — Concepto: el cristal perfectamente limpio. · Tipografía: Manrope + Manrope. · Color: blanco #FFFFFF · tinta #102A43 · azul #2B6CB0 · firma cian cristal #5BC0EB. · Composición: 4:5, 3 columnas, retícula precisa, filtro por forma de rostro. · Materia: reflejo de lente sutil. · Movimiento: nítido; momento firma = efecto lupa al hover sobre el armazón. · Evitar: clínico frío.

41. **Clínica Serena (`clinica`)** — Concepto: una sala de espera con plantas y luz natural. · Tipografía: Source Serif 4 + Source Sans 3. · Color: blanco #FBFCFA · salvia #A7BFA8 · verde profundo #1F4D3F · firma verde vivo #2E9E6E. · Composición: 3:2, 3 columnas, profesionales con credenciales, horarios y reservar. · Materia: nada. · Movimiento: calmado; momento firma = selector de horario que se despliega suave. · Evitar: stock médico.

42. **Dental Claro (`dental-claro`)** — Concepto: la sonrisa limpia de un consultorio moderno. · Tipografía: Plus Jakarta Sans. · Color: blanco #FFFFFF · tinta #0E2A47 · azul #3A86FF · firma aqua #2EC4B6. · Composición: 3 columnas editoriales, antes/después con slider. · Materia: nada. · Movimiento: limpio; momento firma = slider antes/después arrastrable. · Evitar: dientes caricatura.

43. **Bienestar Natural (`bienestar`)** — Concepto: un spa en la montaña. · Tipografía: Fraunces soft + Karla. · Color: lino #F5F0E8 · salvia #8FA58C · arena #D8C3A5 · firma verde #4F6B4A. · Composición: 3:2, 3 columnas, paquetes con duración y respiración visual amplia. · Materia: lino. · Movimiento: respiración (ciclo 4 s en un solo elemento); momento firma = círculo que respira en el hero. · Evitar: esotérico.

44. **Compañeros (`veterinaria`)** — Concepto: la recepción amable de una veterinaria de barrio. · Tipografía: Nunito (800) + Nunito Sans. · Color: crema #FFF8EC · verde #3F7D58 · tinta #243328 · firma mostaza #E8A83A. · Composición: 1:1, 4 columnas, servicios y productos por especie. · Materia: nada. · Movimiento: amable; momento firma = huellitas que llevan al carrito. · Evitar: caricaturas.

45. **Barbería Heritage (`barberia`)** — Concepto: la barbería de 1920 con sillón de cuero. · Tipografía: Rye/Abril Fatface + Barlow. · Color: negro #121212 · crema #EDE3D1 · cuero #6E3B22 · firma cobre #C07A3E. · Composición: 3:2, 3 columnas, servicios con duración y precio en lista de menú. · Materia: cuero. · Movimiento: firme; momento firma = poste de barbero con franjas que giran lento. · Evitar: hipster cliché.

46. **Tinta Underground (`tinta`)** — Concepto: el cuaderno de bocetos de un tatuador. · Tipografía: Pirata One (solo display) + IBM Plex Sans. · Color: crudo #EFE8DC · negro #0E0E0E · firma rojo #B3121B. · Composición: 4 columnas densas, portafolio dominante, reglas de cuidado. · Materia: papel de boceto. · Movimiento: trazo; momento firma = trazos de tinta que se dibujan en títulos. · Evitar: calaveras.

47. **Fitness Performance (`fitness`)** — Concepto: pantalla de marcador en competencia. · Tipografía: Oswald + Inter + mono. · Color: negro #0B0D0C · blanco #F2F4F3 · verde eléctrico #16E07A · firma lima #D6FF3F. · Composición: 4:3, 4 columnas compactas, membresías con comparador. · Materia: nada. · Movimiento: explosivo y corto; momento firma = barra de progreso que se carga al elegir plan. · Evitar: agresividad.

48. **Construcción Pro (`construccion`)** — Concepto: el plano técnico en obra. · Tipografía: Barlow Condensed + Barlow + mono. · Color: cemento #E4E2DD · grafito #232527 · firma amarillo obra #F5B700. · Composición: 4:3, 4 columnas, ficha técnica, unidades y mayoreo. · Materia: retícula de plano azul muy sutil. · Movimiento: mecánico; momento firma = calculadora de cantidad por m². · Evitar: casco clipart.

49. **Arquitectura Material (`arquitectura`)** — Concepto: la muestra de materiales de un estudio. · Tipografía: Neue Haas/Inter Display + Inter. · Color: blanco piedra #F2F0EC · tinta #1B1B1B · piedra #BDB6AB · firma bronce #8C6A43. · Composición: 3 columnas, retícula editorial, acabados como muestras. · Materia: piedra. · Movimiento: sereno; momento firma = muestra de material que se voltea para mostrar ficha. · Evitar: render genérico.

50. **Hogar Escandinavo (`hogar-escandinavo`)** — Concepto: un catálogo de diseño nórdico impreso. · Tipografía: Epilogue + Inter. · Color: blanco #FAF8F4 · tinta #222 · roble #C8A57A · firma salvia #7E9C86. · Composición: 3:2, 3 columnas, ambientes reales con medidas. · Materia: nada. · Movimiento: suave; momento firma = puntos interactivos sobre la foto del ambiente que muestran el producto. · Evitar: frialdad.

51. **Motor Racing (`automotriz`)** — Concepto: el pit stop en carrera. · Tipografía: Saira Condensed (italic 800) + Saira. · Color: negro #0C0C0C · blanco #F5F5F5 · rojo #E10600 · firma amarillo #FFD100. · Composición: 4:3, 4 columnas, hero diagonal, compatibilidad por modelo. · Materia: fibra de carbono sutil. · Movimiento: velocidad (motion blur simulado); momento firma = líneas de velocidad al agregar. · Evitar: flamas.

52. **Refacciones Técnicas (`refacciones`)** — Concepto: el catálogo de partes con número de serie. · Tipografía: IBM Plex Sans Condensed + IBM Plex Mono. · Color: gris #EEF0F2 · tinta #1C232B · azul técnico #1F5FAD · firma ámbar #F2A900. · Composición: 4:3, 4 columnas compactas, buscador dominante por número de parte. · Materia: nada. · Movimiento: preciso; momento firma = búsqueda con resultados instantáneos resaltando coincidencias. · Evitar: desorden.

53. **Tecnología Precisa (`tecnologia`)** — Concepto: la caja de un producto tech premium al abrirla. · Tipografía: Geist/Inter + Geist Mono. · Color: azul noche #0A0E1A · texto #EAF0FF · cian #3DDCFF · firma violeta #7B61FF. · Composición: 16:10, 3 columnas, especificaciones comparables. · Materia: reflejo de cristal. · Movimiento: fluido; momento firma = comparador que alinea especificaciones al seleccionar 2 productos. · Evitar: neón gamer.

54. **Corporativo Confiable (`corporativo`)** — Concepto: el reporte anual bien diseñado. · Tipografía: IBM Plex Serif + IBM Plex Sans. · Color: gris frío #F4F6F8 · azul tinta #14213D · gris #5C677D · firma latón #A68A4B. · Composición: 3 columnas editoriales, servicios con jerarquía seria. · Materia: nada. · Movimiento: mínimo; momento firma = cifras que cuentan al entrar en pantalla. · Evitar: stock de apretones de mano.

55. **Legal Editorial (`legal`)** — Concepto: un libro de derecho encuadernado. · Tipografía: Libre Caslon Text + Source Sans 3. · Color: papel #F6F2EA · azul profundo #16233B · gris #5A5F6B · firma oro sobrio #A88B4A. · Composición: 3 columnas, especialidades, credenciales, contacto prioritario. · Materia: papel. · Movimiento: sobrio; momento firma = índice lateral que marca la sección actual. · Evitar: martillo de juez.

56. **Inmobiliario (`inmobiliario`)** — Concepto: el folleto de un desarrollo exclusivo. · Tipografía: Cormorant + Manrope. · Color: marfil #F6F3EC · verde bosque #1E3B2F · tinta #1A1A1A · firma latón #B08D57. · Composición: 16:10/3:2, 3 columnas, precio, m², recámaras y ubicación como datos claros. · Materia: nada. · Movimiento: amplio; momento firma = galería a pantalla completa con transición compartida. · Evitar: letrero de "SE VENDE".

57. **Fotografía de Autor (`fotografia`)** — Concepto: una exposición en cuarto oscuro. · Tipografía: Neue Montreal/Inter Tight + Inter. · Color: negro #0B0B0B · blanco cálido #EFEAE2 · firma rojo seguridad #C0392B. · Composición: 3 columnas de imágenes grandes, bordes mínimos, portafolio y paquetes. · Materia: nada. · Movimiento: revelado; momento firma = fotos que se "revelan" de oscuro a nítido. · Evitar: marcos pesados.

58. **Escenario Sonoro (`musica`)** — Concepto: el backstage de un concierto. · Tipografía: Syne (800) + Inter. · Color: negro violeta #120A1C · texto #F2EAFF · magenta #FF2E88 · firma cian #20E3F5. · Composición: 1:1, 4 columnas expresivas, eventos con fecha como protagonista. · Materia: grano. · Movimiento: ritmo; momento firma = ecualizador que reacciona al hover. · Evitar: epilepsia visual.

59. **Bitácora de Viaje (`viajes`)** — Concepto: el diario de viaje con boletos y sellos. · Tipografía: DM Serif Display + DM Sans. · Color: arena #F5EDE0 · océano #134E6F · tinta #1F2A30 · firma dorado solar #E3A72F. · Composición: 3:2, 3 columnas, destinos con duración e itinerario tipo línea de tiempo. · Materia: papel de pasaporte. · Movimiento: viaje; momento firma = ruta punteada que se dibuja en el itinerario. · Evitar: avión clipart.

60. **Aula Moderna (`educacion`)** — Concepto: un cuaderno nuevo el primer día de clases. · Tipografía: Lexend + Lexend. · Color: blanco azulado #F4F7FF · índigo #2B2D8C · tinta #1A1C3A · firma amarillo #FFC933. · Composición: 4 columnas suaves, cursos con nivel, horario y duración. · Materia: renglones sutiles. · Movimiento: amable; momento firma = barra de progreso del curso. · Evitar: infantil si es para adultos.

61. **Fiesta Total (`fiesta`)** — Concepto: la mesa de dulces lista para la fiesta. · Tipografía: Bagel Fat One + Nunito. · Color: crema #FFF6EC · violeta #5B2A86 · coral #FF6B6B · firma amarillo #FFD23F. · Composición: 4 columnas vibrantes, paquetes con fecha y extras. · Materia: confeti muy discreto en hero. · Movimiento: celebración controlada; momento firma = confeti breve (≤800 ms) al enviar el pedido. · Evitar: saturación.

---

## 4 · Prompt para auditar una apariencia existente (PRO)

```text
Actúa como director de arte y auditor de UX. Audita esta apariencia contra su ficha PRO. Primero evalúa en escala de grises y sin logo: ¿se distingue de las demás? Después revisa: concepto, tipografía (pareja, escala, precio), sistema de color y roles, forma y profundidad, retícula y ritmo, dirección de arte fotográfica con fotos reales, movimiento (coreografía, momento firma, reduced-motion), hero, filtros, tarjeta, carrito, ficha, secciones, microcopy, móvil, carga, estados, accesibilidad y Core Web Vitals.
Devuelve:
1. Calificación 1–5 por criterio de la barra de calidad.
2. Tabla: apartado · problema · impacto en ventas/percepción · cambio concreto (con valores: px, HEX, ms, curva) · prioridad.
3. Las 3 decisiones que más elevarían la belleza percibida con menos esfuerzo.
4. Cualquier sección que conserve la composición genérica de otra apariencia.
```

## 5 · Prompt para generar una nueva apariencia (PRO)

```text
Usa el Prompt maestro PRO como contrato. Crea una apariencia nueva para el giro [GIRO] llamada [NOMBRE].
Antes de elegir colores: escribe el concepto-metáfora, tres referencias físicas/editoriales, la tensión de diseño, el momento firma y las anti-referencias. Luego define composición (proporción fotográfica, columnas, densidad, hero, anatomía de tarjeta, ruptura de retícula), pareja tipográfica concreta, sistema de color con rampas y color firma, materia, y coreografía de movimiento.
No debe duplicar estas familias existentes: editorial, lujo, industrial, tecnología, suave, natural, artesanal, vibrante y brutalista. Si se acerca a una, explica qué la diferencia en escala de grises.
Entrega la ficha en el formato de la sección 2 y asígnala a máximo cuatro giros relacionados.
```
