# Prompts canónicos para las apariencias del catálogo

> Estas apariencias se diseñaron mediante tokens y reglas de interfaz, no mediante 61 prompts literales independientes. Este documento convierte esas decisiones en prompts reproducibles. Usa el **Prompt maestro** y reemplaza `[DIRECCIÓN DE APARIENCIA]` por cualquiera de las 61 direcciones del catálogo.

## Prompt maestro

```text
[SISTEMA DE DISEÑO Y CATÁLOGO DIGITAL WHATSAPP — ESPECIFICACIÓN COMPLETA]

Aplica la DIRECCIÓN VISUAL indicada abajo para diseñar la interfaz completa de un catálogo digital enfocado en ventas por WhatsApp.

DIRECCIÓN VISUAL
[DIRECCIÓN DE APARIENCIA]

CONTEXTO REAL DEL NEGOCIO
- Nombre: [NOMBRE DEL NEGOCIO]
- Giro: [GIRO]
- Productos o servicios principales: [PRODUCTOS/SERVICIOS]
- Personalidad de marca: [PERSONALIDAD]
- Fotografías disponibles: [TIPO Y CALIDAD DE FOTOGRAFÍAS]
- Zona de venta: [CIUDAD/ZONA]
- Horario, entregas y pagos: [DATOS REALES]

OBJETIVO DEL PRODUCTO
La persona dueña del negocio administra productos, precios, existencias y pedidos. El cliente explora el catálogo, combina filtros, agrega productos al carrito y termina el pedido por WhatsApp. La interfaz debe sentirse diseñada específicamente para el giro, vender con claridad y funcionar con fotografías reales de calidad variable.

======================================================================
1. REGLAS CORE Y TOKENS DE DISEÑO — OBLIGATORIO
======================================================================

- No resuelvas el diseño solo con color. Define densidad, ritmo vertical, proporción fotográfica, número de columnas, elevación, profundidad y jerarquía tipográfica específicos para este giro.
- Mantén una identidad coherente de principio a fin: hero, filtros, tarjetas, carrito, formularios y footer pertenecen al mismo mundo visual.
- Sistema de espaciado de base 8 px: 4, 8, 12, 16, 24, 32, 48 y 64 px.
- Breakpoints:
  * Mobile Small, menos de 360 px: 1 columna.
  * Mobile Standard, 360–767 px: 2 columnas.
  * Tablet, 768–1024 px: 2 o 3 columnas según la dirección.
  * Desktop, más de 1024 px: 3 o 4 columnas según la dirección.
- Accesibilidad WCAG AA:
  * Contraste mínimo de 4.5:1 para texto normal y secundario.
  * Objetivos táctiles mínimos de 44 × 44 px.
  * Foco visible, navegación completa por teclado y soporte para prefers-reduced-motion.
  * Etiquetas, nombres accesibles y estados anunciables para controles dinámicos.
- Define una proporción fotográfica principal: 1:1, 4:3, 3:2, 4:5 o 16:10. Reserva el espacio desde el primer render con aspect-ratio para impedir CLS.
- Elige object-fit: cover cuando la fotografía sea atmosférica/editorial y contain cuando el objeto completo deba conservarse. No recortes información crítica del producto.
- Usa skeletons con exactamente las mismas dimensiones que el contenido final. Logo, hero, filtros, botones e imágenes no deben brincar durante la carga.
- Diseña estados hover, active, focus, disabled, loading, error, vacío y éxito.
- No uses vidrio, gradientes, sombras duras, pills o esquinas redondeadas como decoración automática. Solo aparecen cuando la dirección visual los justifica.
- No uses texto lorem ipsum ni productos genéricos. Crea contenido demostrativo creíble para el giro y marca como ilustrativo cualquier dato no proporcionado.

======================================================================
2. ESTRUCTURA DE LA INTERFAZ Y COMPONENTES
======================================================================

A. CABECERA Y HERO
1. Header sticky con marca/logo, buscador rápido, botón “Cómo comprar”, instalación PWA/App, estado “Abierto/Disponible”, acceso a WhatsApp, carrito con badge y acceso al panel cuando corresponda.
2. Banner de campaña opcional con promoción temporal, fecha de cierre y cuenta regresiva.
3. Hero principal con versión con banner y versión sin banner: logo, título del negocio, propuesta de valor, descripción, estado operativo, datos de contacto y CTA principal hacia productos o WhatsApp.

B. NAVEGACIÓN Y FILTROS
4. Filtros combinables:
   * Desktop: panel superior de ancho completo; los productos comienzan debajo y nunca comparten una cuadrícula lateral con los filtros.
   * Móvil: botón accesible que abre drawer lateral o bottom sheet.
   * Búsqueda predictiva por nombre y agrupador.
   * Categoría y agrupador como filtros independientes y combinables.
   * Precio mínimo/máximo o slider.
   * Atributos como talla, color, material, presentación o duración.
   * Contadores que se recalculan según la combinación activa.
   * Ordenamiento por relevancia, precio, novedades y más vendidos.
   * Acción “Limpiar filtros” y estado sin resultados con “Restablecer filtros”.

C. PRODUCTOS Y COMPONENTES ATÓMICOS
5. Grid con título, cantidad total, texto “Mostrando X productos”, ordenamiento y comportamiento responsive definido.
6. Tarjeta de producto:
   * Imagen con ratio reservado, múltiples fotografías, indicadores de galería y fallback real.
   * Badges de oferta, nuevo, top, agotado, pocas piezas y por pedido.
   * Etiquetas y atributos clave.
   * Título de máximo dos líneas, descripción breve, precio actual, precio anterior, descuento y abonos.
   * Estado: disponible, pocas piezas, agotado o disponible por pedido sin reglas de inventario.
   * Acciones “Agregar”, “Ver detalles” y “Compartir”.
7. Feedback y recuperación:
   * Skeleton loaders estables.
   * Error de imagen con reintento sin limpiar formularios ni perder el estado.
   * Estado vacío y sin resultados.
   * Botón “Cargar más” o paginación incremental sin saltar el scroll.
8. Carruseles opcionales de Ofertas, Recién llegados y Más vendidos, cada uno con controles accesibles y scroll snap móvil.

D. FLUJO DE CONVERSIÓN Y CARRITO WHATSAPP
9. Carrito flotante/FAB persistente cuando hay productos, con contador y sin cubrir filtros ni acciones.
10. Drawer o modal de carrito:
    * Miniatura, nombre, variante, precio, cantidad +/−, eliminar y subtotal por línea.
    * Subtotal, costo de envío o “A calcular por WhatsApp”.
    * Nombre del cliente, teléfono, dirección/zona, método de entrega, método de pago y notas.
    * Validación sin borrar los datos si ocurre un error.
    * CTA “Enviar pedido por WhatsApp”.
11. Mensaje de WhatsApp estructurado:
    * Saludo y nombre del negocio.
    * Lista de productos con cantidad, variante, precio unitario y subtotal.
    * Subtotal, envío y total.
    * Cliente, entrega, pago y notas.
    * Enlace al catálogo o identificador del pedido cuando exista.

E. FICHA DE PRODUCTO
12. Página o Quick View con galería ampliable, miniaturas, nombre, precio, descuento, variantes explícitas, stock en tiempo real, descripción, especificaciones, agregar, compartir y productos relacionados.

F. CONFIANZA, CONTENIDO Y MARKETING
13. “Conócenos”: historia breve, propuesta, fotografías reales y datos del negocio.
14. Lookbook/modelos o galería editorial cuando el giro lo permita, con visor ampliado.
15. Servicios, paquetes o citas: duración, qué incluye, precio, disponibilidad y CTA “Agendar”.
16. Opiniones/reseñas con nombre, calificación y texto creíble.
17. “Cómo comprar” en pasos 1–2–3.
18. Zonas de cobertura, métodos de envío, tiempos, costos y métodos de pago.
19. Galería del local/equipo y enlaces sociales.
20. Preguntas frecuentes en accordion accesible.
21. Formulario de contacto: nombre, teléfono, asunto y mensaje; validación inline, error recuperable y envío a chat.
22. Footer: marca, contacto, domicilio, horario, redes, enlaces, aviso de privacidad, datos comerciales y atribución.

======================================================================
3. RESPONSIVE, MOVIMIENTO Y RENDIMIENTO
======================================================================

- Entrega composición desktop y mobile; tablet no debe ser una versión accidental.
- En móvil prioriza producto, precio y agregar. Reduce decoración antes de reducir legibilidad.
- Los filtros usan drawer/bottom sheet y el carrito conserva contexto y botón de cierre visible.
- La interacción distintiva debe pertenecer al mundo visual: agregar al carrito, transición de galería, apertura de filtros o actualización de resultados.
- Usa movimiento breve con desaceleración suave desde un estado visible. No animes propiedades que produzcan layout thrashing.
- Reserva dimensiones, usa carga diferida para contenido bajo el primer viewport y evita bloquear la interacción por fuentes o imágenes.

======================================================================
4. FORMATO DEL ENTREGABLE
======================================================================

Entrega exactamente:
1. Resumen de la dirección visual aplicada y por qué encaja con el giro.
2. Tokens: retícula, contenedor, breakpoints, ratio de imagen, tipografía Display/Body, escala tipográfica, paleta HEX con roles, espaciado, radios, bordes, sombras y movimiento.
3. Especificación Desktop: columnas, filtros, hero, tarjetas, carruseles, secciones y carrito.
4. Especificación Tablet y Mobile: columnas, prioridades, drawer de filtros, carrito/bottom sheet y adaptación de contenido.
5. Inventario de componentes y sus estados.
6. Estructura exacta del mensaje de WhatsApp con un ejemplo completo.
7. Una interacción Micro-UI distintiva con duración, easing y fallback reduced-motion.
8. Estados loading, vacío, error, agotado y por pedido.
9. Lista de contenido y fotografías reales que necesita proporcionar el negocio.
10. Criterios de aceptación verificables para contraste, teclado, touch targets, CLS y responsive.

Incluye todos los apartados aunque algunos se marquen como opcionales. Si falta información comercial, usa placeholders claramente identificados y no inventes afirmaciones.
```

## Cómo usar las direcciones

Ejemplo:

```text
[DIRECCIÓN DE APARIENCIA] = “Taquería Nocturna: ...”
```

Después pega el Prompt maestro completo. Para una tienda concreta, agrega al final el nombre, giro, productos, fotografías, dirección, horario y medios de pago reales.

## 1–25 · Apariencias originales

1. **Clásico (`catalogo`)** — Vitrina comercial equilibrada, fondo marfil, blanco y azul tinta. Fotografía horizontal 4:3, serif refinada en títulos, cuatro columnas, tarjetas suaves y controles sobrios. Debe servir para cualquier giro sin sentirse genérico.
2. **Vitrina Elegante (`joyeria`)** — Boutique nocturna en negro cálido y oro. Fotografía retrato 4:5, tres columnas, marcos finos, mucho espacio, nombres y precios centrados, serif de alta costura y profundidad oscura.
3. **Pastel Suave (`postres`)** — Repostería delicada en crema, cacao y rosa. Imágenes cuadradas cercanas, tipografía amable con títulos expresivos, tarjetas suaves, detalles de receta y ritmo aireado.
4. **Editorial B/N (`ropa`)** — Revista de moda en blanco y negro. Hero alineado a la izquierda, fotografía retrato 4:5, tres columnas, esquinas rectas, tarjetas planas, títulos en mayúsculas y grandes pausas editoriales.
5. **Botánico Romántico (`floreria`)** — Florería refinada con salvia, blanco y rosa empolvado. Retratos 4:5, serif romántica, marcos vegetales sutiles, tres columnas y composición suave sin máscaras geométricas.
6. **Industrial (`ferreteria`)** — Catálogo robusto de herramientas en acero, negro y amarillo de advertencia. Cuatro columnas densas, imágenes 4:3, bordes firmes, etiquetas técnicas y controles angulares.
7. **Cálido Artesanal (`muebles`)** — Taller de muebles en nogal, lino y crema. Fotografías horizontales 3:2, tres columnas amplias, serif artesanal, tarjetas abiertas y textura visual basada en la madera real.
8. **Minimalista Rosa (`cosmeticos`)** — Porcelana y rosa dorado con mucho aire. Producto centrado en imagen cuadrada, tres o cuatro columnas, tarjetas casi sin borde, texto centrado y acciones discretas.
9. **Natural Fresco (`vivero`)** — Vivero luminoso con verdes vivos y terracota. Fotografía 4:3, formas orgánicas controladas, cuatro columnas, nombres fuertes y tarjetas alegres.
10. **Glam Dorado (`belleza`)** — Salón de belleza en rosa, champagne y tinta cálida. Retratos 4:5, composición escalonada en escritorio, serif glam, tres columnas y servicios con presentación editorial.
11. **Nocturno Elegante (`eventos`)** — Gala nocturna en ciruela y champagne. Hero teatral centrado, imágenes 3:2, tres columnas, esquinas rectas y títulos de gran escala.
12. **Minimalista (`minimalista`)** — Blanco, negro y silencio visual. Retratos 4:5, tres columnas, sin sombras, tarjetas sin borde lateral, controles rectos y jerarquía basada en espacio y tipografía.
13. **Pastel Dreams (`pastel`)** — Lavanda y menta juguetonas. Imágenes cuadradas, tarjetas suaves, cuatro columnas, títulos redondeados y ligeras variaciones de altura solo en escritorio.
14. **Monocromo (`monocromo`)** — Neobrutalismo blanco y negro. Imágenes cuadradas, bordes de 2 px, sombras duras justificadas, controles rectos, mayúsculas y contraste máximo.
15. **Bohemio (`bohemio`)** — Terracota, mostaza y materiales artesanales. Retratos 4:5, tres columnas, serif expresiva, composición ligeramente escalonada y detalles cálidos.
16. **Oceánico (`oceanico`)** — Verde azulado, arena y serenidad costera. Fotografía panorámica 16:10, tres columnas, tarjetas planas con regla inferior y tipografía literaria.
17. **Nórdico (`nordico`)** — Madera clara, salvia y blanco. Imagen 4:3, tres columnas con mucho aire, geometría limpia, sombras mínimas y tono acogedor.
18. **Vibrante (`vibrante`)** — Coral, morado y bloques gráficos. Imágenes cuadradas, cuatro columnas, títulos pesados de gran escala, tarjetas enérgicas y movimiento breve.
19. **Retro Vintage (`retro`)** — Mostaza, naranja quemado y verde antiguo. Imagen 4:3, tipografía vintage, bordes marcados, sombra desplazada legítima y controles físicos.
20. **Futurista (`futurista`)** — Azul noche, cian y violeta. Fotografías 16:10, tres columnas, bordes luminosos delgados, geometría técnica y estados de interacción precisos.
21. **Rústico (`rustico`)** — Campo, terracota y oliva. Imágenes 3:2, tres columnas, serif artesanal, controles compactos y materia visual sobria.
22. **Elegante Blanco (`elegante`)** — Blanco puro y oro fino. Retrato 4:5, tres columnas, marcos delgados, sombras casi nulas, serif clásica y mucho espacio.
23. **Urbano (`urbano`)** — Concreto, negro y lima. Imagen cuadrada, cuatro columnas, mayúsculas compactas, bordes fuertes y composición callejera.
24. **Tropical (`tropical`)** — Coral y jungla. Fotografía horizontal 3:2, cuatro columnas, formas alegres, nombres pesados y ritmo cálido.
25. **Acuarela (`acuarela`)** — Azul, lavanda y superficies suaves. Imagen 5:4, tarjetas con variaciones sutiles de esquinas, tres o cuatro columnas y serif contemporánea.

## 26–61 · Apariencias sectoriales

26. **Taquería Nocturna (`taqueria-nocturna`)** — Alto contraste, carbón, rojo chile y amarillo maíz. Cuatro columnas densas, fotografías 4:3, hero callejero alineado a la izquierda y precios muy visibles.
27. **Parrilla de Autor (`parrilla`)** — Carbón, cobre y cuero. Imágenes horizontales 3:2 de cortes y fuego, tres columnas, serif artesanal y profundidad oscura.
28. **Café Editorial (`cafe-editorial`)** — Revista independiente en papel, espresso y cobre. Retratos 4:5, tres columnas, tarjetas planas, tipografía literaria y secciones como páginas editoriales.
29. **Horno Artesanal (`pan-artesanal`)** — Harina, terracota y trigo. Fotografías 3:2, tres columnas, sensación de oficio, precios claros y secciones de proceso o ingredientes.
30. **Costa Fresca (`marisqueria`)** — Azul profundo, turquesa y coral. Panorámicas 3:2, tres columnas, producto fresco, disponibilidad y zonas de entrega muy visibles.
31. **Heladería Pop (`heladeria-pop`)** — Rosa, menta y color de sabores. Cuadrícula de cuatro columnas, imágenes cuadradas, tarjetas suaves, variantes de tamaño y toppings fáciles de elegir.
32. **Cocina Casera (`cocina-casera`)** — Crema, barro y verde cocina. Imágenes 3:2, tres columnas, menú del día, disponibilidad inmediata y trato cercano.
33. **Gourmet Contemporáneo (`gourmet`)** — Marfil, tinta y latón. Retrato 4:5, tres columnas, mucho aire, serif contemporánea y presentación premium de menús o paquetes.
34. **Mercado de Barrio (`mercado-barrio`)** — Papel, verde y rojo de mercado. Cuatro columnas llenas de producto, imágenes cuadradas, ofertas grandes, categorías rápidas y lectura práctica.
35. **Moda de Autor (`moda-lujo`)** — Pasarela cálida en marfil, vino y oro. Retrato 4:5, tres columnas, nombres centrados, serif de moda y lookbook dominante.
36. **Streetwear (`streetwear`)** — Concreto, negro y lima. Cuatro columnas, fotografía cuadrada o retrato recortado, tipografía industrial, drops y tallas visibles.
37. **Pequeño Mundo (`infantil`)** — Lavanda, crema y amarillo. Imágenes cuadradas, cuatro columnas, formas suaves, tipografía redondeada y filtros por edad o talla.
38. **Sneaker Drop (`sneakers`)** — Gris, rojo y azul deportivo. Producto grande sobre imagen cuadrada, cuatro columnas, lanzamientos, tallas y stock con alta prioridad.
39. **Perfumería Etérea (`perfumeria`)** — Porcelana, lavanda y nude. Imágenes cuadradas centradas, tres columnas aireadas, notas aromáticas y presentación delicada.
40. **Óptica Clara (`optica`)** — Blanco clínico, azul y cristal. Retrato 4:5, tres columnas, retícula precisa, filtros por tipo y servicios de examen.
41. **Clínica Serena (`clinica`)** — Blanco, salvia y verde profundo. Panorámicas 3:2, tres columnas, confianza, servicios, profesionales, horarios y llamada a reservar.
42. **Dental Claro (`dental-claro`)** — Blanco luminoso y azul limpio. Retícula editorial de tres columnas, tratamientos claros, evidencia real y contacto inmediato.
43. **Bienestar Natural (`bienestar`)** — Lino, salvia y arena. Fotografías horizontales 3:2, tres columnas, pausas amplias, paquetes y duración de terapias.
44. **Compañeros (`veterinaria`)** — Verde amable, crema y mostaza. Imágenes cuadradas, cuatro columnas, servicios y productos para mascotas con tono profesional cercano.
45. **Barbería Heritage (`barberia`)** — Negro, cuero y cobre. Fotografías 3:2, tres columnas, serif vintage, servicios, duración y reserva visibles.
46. **Tinta Underground (`tinta`)** — Crudo, negro y rojo. Cuatro columnas densas, bordes fuertes, portafolio dominante, servicios y reglas de cuidado.
47. **Fitness Performance (`fitness`)** — Negro, verde eléctrico y lima. Cuatro columnas compactas, imágenes 4:3, membresías, suplementos, stock y energía controlada.
48. **Construcción Pro (`construccion`)** — Cemento, grafito y amarillo de obra. Cuatro columnas, imágenes 4:3, fichas técnicas, unidades, mayoreo y disponibilidad.
49. **Arquitectura Material (`arquitectura`)** — Piedra, blanco y bronce. Tres columnas, fotografía retrato o panorámica según producto, retícula editorial y acabados protagonistas.
50. **Hogar Escandinavo (`hogar-escandinavo`)** — Blanco, roble y salvia. Panorámicas 3:2, tres columnas, ambientes reales, medidas y espacios amplios.
51. **Motor Racing (`automotriz`)** — Negro, rojo y amarillo. Cuatro columnas densas, hero agresivo, imágenes 4:3, medidas, compatibilidad y servicios.
52. **Refacciones Técnicas (`refacciones`)** — Gris, azul técnico y ámbar. Cuatro columnas compactas, imágenes 4:3, buscador dominante, marcas, compatibilidades y existencias.
53. **Tecnología Precisa (`tecnologia`)** — Azul noche, cian y violeta. Tres columnas, panorámicas 16:10, especificaciones, variantes y estados tecnológicos discretos.
54. **Corporativo Confiable (`corporativo`)** — Gris frío, azul tinta y latón. Tres columnas editoriales, servicios y paquetes con jerarquía seria, sin decoración gratuita.
55. **Legal Editorial (`legal`)** — Papel, azul profundo y oro sobrio. Tres columnas, serif clásica, servicios, especialidades, credenciales y contacto prioritario.
56. **Inmobiliario (`inmobiliario`)** — Marfil, verde bosque y latón. Tres columnas, fotografía panorámica de propiedades, precio, ubicación, atributos y asesoría.
57. **Fotografía de Autor (`fotografia`)** — Negro profundo y blanco cálido. Tres columnas de imágenes grandes, bordes mínimos, portafolio y paquetes sin distracciones.
58. **Escenario Sonoro (`musica`)** — Negro violeta, magenta y cian. Cuatro columnas expresivas, imágenes cuadradas, eventos, instrumentos o paquetes con energía nocturna.
59. **Bitácora de Viaje (`viajes`)** — Arena, océano y dorado solar. Tres columnas, panorámicas 3:2, destinos, duración, itinerario y disponibilidad.
60. **Aula Moderna (`educacion`)** — Blanco azulado, índigo y amarillo. Cuatro columnas suaves, cursos, niveles, horarios, duración y llamada a inscripción.
61. **Fiesta Total (`fiesta`)** — Coral, violeta y fondos crema. Cuatro columnas vibrantes, paquetes, fechas, extras, galería y contacto rápido.

## Prompt para auditar una apariencia existente

```text
Audita esta apariencia de catálogo contra su dirección visual. Comprueba que las diferencias no dependan solo de la paleta. Evalúa hero, proporción de imágenes, columnas, tarjetas, tipografía, filtros, precios, botones, secciones opcionales, carrito, ficha de producto, móvil, carga, estados vacíos, accesibilidad y movimiento. Devuelve una tabla con: apartado, problema, impacto, cambio concreto y prioridad. Señala cualquier sección que conserve la composición genérica de otra apariencia.
```

## Prompt para generar una nueva apariencia

```text
Usa el Prompt maestro como contrato. Crea una apariencia nueva para el giro [GIRO] llamada [NOMBRE]. Antes de elegir colores, define una composición reconocible: proporción fotográfica, número de columnas, densidad, alineación del hero, carácter tipográfico, forma de tarjeta, profundidad y una interacción distintiva. Evita duplicar cualquiera de estas familias existentes: editorial, lujo, industrial, tecnología, suave, natural, artesanal, vibrante y brutalista. Explica qué necesidad del giro justifica cada decisión y asigna la apariencia a máximo cuatro giros relacionados.
```
