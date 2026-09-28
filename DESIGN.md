---
name: Nessik
description: Catálogo WhatsApp-first con una vitrina pública cálida y un panel operativo preciso
colors:
  catalog-green: "#146356"
  catalog-green-deep: "#0D3A31"
  catalog-gold: "#C89B3C"
  catalog-warm-ground: "#FAF9F6"
  catalog-ink: "#1A2420"
  catalog-muted: "#5C6B64"
  catalog-border: "#E5E1D6"
  surface-white: "#FFFFFF"
  petrol-action: "#2C2C2E"
  petrol-operate: "#454548"
  admin-neutral-ground: "#F7F7F8"
  admin-ink: "#15181D"
  admin-muted: "#61666E"
  offer-terra: "#B5461C"
  whatsapp-green: "#25D366"
typography:
  display:
    fontFamily: "Space Grotesk, Inter, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "-0.01em"
  editorial:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  operate-title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.025em"
rounded:
  focus: "4px"
  badge: "6px"
  sm: "8px"
  md: "12px"
  card: "14px"
  lg: "18px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.petrol-action}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
    padding: "8px 18px"
  tab-default:
    backgroundColor: "rgba(255,255,255,.76)"
    textColor: "#46525B"
    rounded: "{rounded.md}"
    padding: "8px 15px"
    height: "36px"
  tab-active:
    backgroundColor: "{colors.petrol-action}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
    padding: "8px 15px"
    height: "36px"
  filter-chip-active:
    backgroundColor: "{colors.petrol-operate}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.sm}"
    padding: "0 11px"
    height: "30px"
  admin-product-card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.admin-ink}"
    rounded: "{rounded.card}"
    padding: "0"
  whatsapp-cta:
    backgroundColor: "{colors.whatsapp-green}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.card}"
    padding: "13px 20px"
---

# Design System: Nessik

## Overview

**Creative North Star: "El Mercado Renovado, con Trastienda de Precisión"**

Nessik tiene dos temperaturas coordinadas. La vitrina pública conserva el mercado cuidado: fondos cálidos, verde profundo, dorado comedido, tipografía de exhibición y detalles que hacen tangible la compra. El panel administrativo es la trastienda precisa: Inter conduce la operación sobre un campo gris neutro y grafito, con un único acento — grafito neutro, sin tinte azul — para acción y selección. Sin luz ambiental, sin degradados decorativos: la superficie y la tipografía hacen el trabajo, al estilo de un dashboard empresarial serio.

La unidad no depende de hacer todas las pantallas iguales. Ambas familias comparten superficies blancas, esquinas amables, controles compactos, foco visible y movimiento breve con desaceleración suave. En Productos, la imagen abre cada tarjeta, el estado se lee en capas pequeñas y el inspector acompaña la edición sin sacar al dueño del catálogo.

Las apariencias del catálogo público comparten datos y comportamiento, pero no una composición genérica. Cada `data-style` define proporción de fotografía, densidad de cuadrícula, jerarquía tipográfica, forma de tarjeta y profundidad coherentes con su mundo: editorial, lujo, industrial, suave, natural, artesanal o expresivo.

**Key Characteristics:**
- Vitrina pública cálida y comercial; administración neutra, minimalista y operativa
- Grafito neutro como único acento para acciones, selección, foco y navegación del panel — deliberadamente sin azul
- Sin luz ambiental ni degradados decorativos en el panel — bordes finos y sombras muy sutiles en su lugar
- Tarjetas redondeadas, fotográficas y con elevación teñida por la temperatura de cada superficie
- Inter lidera la operación; Space Grotesk y Playfair se reservan para exhibición pública
- Densidad compacta con adaptación móvil que conserva contexto y controles accesibles

## Colors

La paleta comparte tinta profunda y superficies blancas, pero cambia de temperatura según la tarea: mercado cálido al vender, gris neutro y minimalista al administrar.

### Primary
- **Verde Mercado:** acción principal, selección y precio en el catálogo público.
- **Grafito Nessik:** acción, navegación, foco y selección en el panel administrativo — un neutro puro, sin tinte azul, para que el panel se sienta serio y no "tech genérico".

### Secondary
- **Dorado de Puesto:** precios especiales, estados premium y acentos comerciales medidos en la vitrina pública.
- **Verde WhatsApp:** se usa exclusivamente para acciones que abren o envían un pedido por WhatsApp.

### Tertiary
- **Terracota de Oferta:** descuento y liquidación; evita el rojo genérico en la vitrina.

### Neutral
- **Suelo Mercado:** base cálida de catálogo y detalle de producto.
- **Suelo Neutro:** base gris clara y sin matiz exclusiva del panel administrativo.
- **Tinta Mercado:** texto principal con matiz verde en superficies públicas.
- **Tinta Admin:** grafito casi negro, sin tinte azul, en el panel.
- **Gris Operativo:** metadata, placeholders y controles secundarios.
- **Borde Cálido:** división de tarjetas públicas sin gris industrial.
- **Blanco de Superficie:** tarjetas, campos y superficies elevadas en ambos mundos; no es el fondo de página.

### Named Rules
**The Two Temperatures Rule.** La vitrina pública usa una base cálida; el panel administrativo usa gris neutro sin matiz. Comparten marca, pero no intercambian sus fondos.

**The Petrol Does the Work Rule.** En administración, el grafito neutro (sin azul) es el único acento — señala la acción, la selección y el foco. No hay halos ni luces ambientales compitiendo por atención: el color se reserva para lo que el usuario debe notar.

**The Flat Corporate Rule.** El panel evita degradados decorativos, sombras pronunciadas y elevaciones grandes al hover. Un borde fino y una sombra casi imperceptible bastan para separar superficies; la jerarquía viene de tipografía y espaciado, no de efectos.

**The WhatsApp Green Rule.** El verde WhatsApp aparece solo en acciones que terminan en WhatsApp, nunca como éxito genérico, filtro o decoración.

## Typography

**Display Font:** Space Grotesk (con Inter y system-ui como fallback)
**Editorial Font:** Playfair Display (con Georgia como fallback)
**Body / Operate Font:** Inter (con system-ui como fallback)

**Character:** La vitrina combina exhibición geométrica con momentos editoriales en el detalle; el panel elimina esa ceremonia y usa una jerarquía Inter compacta, legible y directa. El contraste de familias describe el cambio de vender a operar.

### Hierarchy
- **Display** (600–700, escala responsiva, tracking negativo leve): nombres, precios y títulos de exhibición del catálogo público.
- **Editorial Headline** (700, alrededor de 2rem, 1.15): título y precio protagonistas en el detalle público del producto.
- **Operate Heading** (800–900, 18–20px, tracking apretado): encabezados de página administrativa.
- **Operate Title** (800, 13px, 1.25): nombre del producto dentro de la tarjeta administrativa.
- **Body** (400–600, 13–14px, 1.6): descripciones, ayuda y texto funcional.
- **Label** (700, 9–10px, tracking corto): etiquetas de campos, badges y metadata de alta densidad.

### Named Rules
**The Operate in Inter Rule.** Productos usa Inter en títulos, campos, estados y acciones; las familias de exhibición no entran en el flujo CRUD.

**The Public Display Restraint Rule.** Space Grotesk y Playfair enfatizan nombres, precios y títulos públicos; nunca sustituyen a Inter en labels, filtros o texto de ayuda.

## Layout

El catálogo público mantiene una cuadrícula mobile-first que crece hasta cuatro columnas y deja respirar el contenido comercial dentro de contenedores centrados. El detalle público utiliza dos columnas con galería sticky y colapsa a una columna bajo 900px.

Las apariencias se implementan desde una sola plantilla y una capa temática final. Cada una de las 61 declara un perfil compositivo explícito y único: proporción de fotografía, columnas, alineación del hero, tipo de tarjeta, densidad, alineación de contenido, ajuste de imagen, movimiento y tratamiento de ofertas. En escritorio, todas conservan el orden operativo de filtros arriba y productos abajo; nunca comparten una cuadrícula lateral. Los selectores y la vista previa del teléfono representan esas decisiones antes de guardar. En móvil, los filtros se abren como drawer y las composiciones escalonadas vuelven a una cuadrícula regular para conservar lectura y objetivos táctiles.

La biblioteca puede ser amplia porque la decisión permanece corta: cada giro muestra primero ocho recomendaciones ordenadas y deja el resto detrás de búsqueda y “Ver todos”. Los temas sectoriales declaran sus giros afines y una familia compositiva; la recomendación pondera afinidad directa, estilo del preset y compatibilidad de familia.

Productos utiliza un workspace asimétrico. Hasta 1179px, catálogo e inspector fluyen verticalmente. Desde 1180px, el contenido se divide en catálogo flexible e inspector fijo de 350px, con 18px entre ambos; el inspector queda sticky a 16px del viewport, limita su altura a `calc(100vh - 32px)` y desplaza internamente su contenido. La rejilla administrativa comienza en dos columnas, pasa a tres desde 1360px y usa 12px de separación.

Por debajo de 768px, las tabs permanecen en una sola fila con scroll horizontal, la rejilla se vuelve una lista de una columna y cada producto adopta una tarjeta horizontal: imagen de 104px a la izquierda, información a la derecha y acciones en una franja inferior. El inspector vuelve al flujo, con 18px de separación, y el FAB reaparece como atajo a creación.

Los selects buscables respetan el ancho resuelto del control y de su contenedor: wrapper, disparador y panel usan `max-width: 100%`, `min-width: 0` y `box-sizing: border-box`; el panel se ancla a la anchura del disparador. Abrir opciones nunca ensancha la página ni crea overflow horizontal, incluso dentro de flex, grid o el inspector.

### Named Rules
**The Inspector Stays in Context Rule.** En escritorio ancho, crear o editar sucede junto al catálogo visible; el inspector no se convierte en una página separada ni desplaza la cuadrícula.

**The Horizontal Mobile Card Rule.** En móvil, la tarjeta administrativa cambia de composición en lugar de encoger la tarjeta vertical: imagen de 104px, texto flexible y acciones separadas.

**The Control Owns Its Dropdown Rule.** Un select buscable limita su panel al ancho del control y del contenedor; el contenido largo se ajusta dentro, nunca expande la página.

**The Theme Changes Composition Rule.** Una apariencia pública debe cambiar al menos proporción de imagen, densidad y jerarquía además del color; todas conservan una sola plantilla funcional y una cuadrícula móvil estable.

**The Filters Before Products Rule.** En escritorio, el panel de filtros ocupa una fila superior y la cuadrícula de productos comienza debajo; ninguna apariencia coloca ambos bloques lado a lado.

## Elevation & Depth

La vitrina pública sigue usando capas suaves con matiz verde-tierra: es un espacio comercial y puede permitirse algo de teatralidad. El panel administrativo, en cambio, es deliberadamente plano — un borde fino de 1px hace la mayor parte del trabajo de separar superficies, y la sombra es casi imperceptible incluso al hover. Nada sube más de 1-2px ni gana un halo de color al interactuar; el cambio de estado se lee en el borde, no en el movimiento.

La profundidad interactiva sigue siendo estructural en Productos: cuando una tarjeta contiene foco o abre su menú contextual, la tarjeta completa sube a `z-index: 30`. El menú puede desbordar la silueta y seguir visible sobre las tarjetas posteriores de la cuadrícula.

### Shadow Vocabulary
- **Mercado bajo** (`0 1px 2px rgba(26,36,32,.05), 0 1px 3px rgba(26,36,32,.07)`): tarjetas públicas en reposo.
- **Mercado alto** (`0 14px 30px rgba(26,36,32,.08), 0 4px 12px rgba(26,36,32,.05)`): tarjeta pública en hover.
- **Admin reposo** (`0 1px 2px rgba(20,24,31,.04)`): tarjetas, cards de métrica y contenedores del panel en reposo.
- **Admin hover** (`0 2px 8px rgba(20,24,31,.06)`): único paso de elevación al hover; sin traslación ni escala.
- **Admin elevado** (`0 8px 24px rgba(20,24,31,.09)`): modales, menús flotantes y el toggle del sidebar.
- **Inspector** (`0 16px 36px rgba(34,62,82,.14), 0 3px 8px rgba(34,62,82,.06)`): panel persistente de alta prioridad en Productos.

### Named Rules
**The Border Before Shadow Rule.** En el panel administrativo, el borde de 1px es la primera herramienta de separación; la sombra es un refuerzo casi invisible, nunca el efecto principal.

**The Temperature-Matched Shadow Rule.** Las sombras toman el matiz del mundo que elevan: verde-tierra en la vitrina y grafito/petróleo neutro en el panel; el negro puro no es el valor por defecto.

**The Open Menu Owns the Stack Rule.** El foco o menú abierto eleva la tarjeta propietaria completa a `z-index: 30`; un menú contextual nunca queda detrás de la siguiente tarjeta.

## Shapes

La forma es amable y compacta. La vitrina pública usa tarjetas de 18px; Productos reduce la tarjeta y la imagen a 14px para aumentar densidad. Controles principales y tabs usan 12px, botones de icono y acciones de menú 8px, badges operativos 6px y campos de filtro pueden ser pills. La foto respeta la silueta superior de la tarjeta y en móvil abre solo la esquina superior izquierda del módulo horizontal.

### Named Rules
**The Radius Follows Density Rule.** 18px pertenece a la exhibición pública; 14px a tarjetas administrativas; 12px a controles; 8px o 6px a acciones y estados compactos. Las pills se reservan para búsqueda y categorías.

## Components

### Buttons
- **Primary:** petróleo, texto blanco, radio de 12px y peso 700; sube 1px al hover, gana sombra y comprime a .97 en active.
- **Outlined:** fondo transparente, borde tenue y texto petróleo; el hover refuerza el borde sin llenar el control.
- **WhatsApp:** verde propio, radio de 14px y sombra verde; solo en el recorrido público hacia WhatsApp.
- **Focus:** contorno petróleo de 2px con offset de 2px, además del tratamiento propio del campo cuando corresponda.

### Chips
- **Tabs de sección:** pills rectangulares independientes de 36px, blancas translúcidas, borde casi imperceptible y sombra propia; no viven dentro de una barra contenedora. La activa usa gradiente petróleo y un contador blanco translúcido.
- **Filtros:** 30px de alto, fondo blanco translúcido y texto gris operativo; la selección usa petróleo sólido y texto blanco.
- **Badges:** 6px en la tarjeta de Productos para concentrar estado; 10px o pill en superficies menos densas.

### Cards / Containers
- **Tarjeta pública:** imagen y comercio dentro de 18px, sombra cálida baja y elevación de 4px al hover; los badges de oferta pueden usar el corte de etiqueta de mercado.
- **Variantes públicas:** editorial y minimalista usan bordes rectos y aire; lujo usa marcos finos y retrato; industrial usa densidad y geometría firme; natural prioriza fotografía amplia; artesanal usa ritmos cálidos; vibrante amplía escala y contraste. Solo monocromo, retro e industrial pueden usar sombra dura porque pertenece a su lenguaje.
- **Tarjeta administrativa:** imagen first de 142px, radio de 14px, título Inter de 13px, estados compactos y fila de acciones al borde inferior. El hover escala la imagen a 1.025 y sube la tarjeta 3px.
- **Menú contextual:** se posiciona fuera del borde inferior derecho; al abrirlo, su tarjeta propietaria toma `z-index: 30` para superar a las tarjetas siguientes.
- **Inspector:** gradiente translúcido de cian a blanco violeta, radio de 15px, sin franja decorativa superior y con campos blancos translúcidos.

### Inputs / Fields
- **Search:** pill de al menos 36px, blanco translúcido, placeholder gris legible y sombra mínima.
- **Inspector fields:** borde petróleo al 16%, fondo blanco al 78% y radio de 8px; al foco cambian a petróleo medio y reciben un anillo de 3px al 10%.
- **Labels:** Inter 700, 10px, tracking corto; siempre estáticas encima del campo.

### Searchable Select
- **Geometry:** wrapper, botón y panel no exceden el ancho disponible; el panel mide el 100% del control y puede alinearse a la derecha o abrir hacia arriba sin causar overflow horizontal.
- **Internal search:** usa los tokens Material de superficie, contorno, radio pequeño, Inter y movimiento; al foco refuerza el borde primario sin sombra adicional.
- **States:** caret rota al abrir; opción hover/highlight usa un azul tenue; selección conserva peso 700; disabled reduce opacidad.
- **Dark mode:** panel, botón, búsqueda y opciones cambian mediante las variables y valores oscuros compartidos, conservando el mismo contraste y geometría.

### Navigation
- **Admin sidebar:** navegación compacta con radio de 12px; el estado activo es petróleo con texto blanco y los hovers se desplazan 2px.
- **Productos tabs:** actúan como navegación local independiente y se desplazan horizontalmente en móvil sin envolver.
- **Public header:** puede usar superficie cálida translúcida, blur y marca de exhibición; permanece separado de la gramática fría de Productos.

### Sticky Product Inspector

El inspector es la firma operativa de Productos. A partir de 1180px acompaña la exploración con scroll interno, pasos compactos y tipos de producto seleccionables; en pantallas menores vuelve al documento para conservar una sola dirección de lectura.

## Do's and Don'ts

### Do:
- **Do** mantener cálida la vitrina pública y gris neutra la superficie administrativa.
- **Do** usar petróleo como único acento para acción, selección y foco en el panel.
- **Do** resolver la jerarquía del panel con tipografía, espaciado y un borde fino — no con degradados, glow ni elevación grande.
- **Do** abrir cada tarjeta administrativa con la imagen y mantener estado y acciones como capas secundarias compactas.
- **Do** convertir las tarjetas a composición horizontal de 104px en móvil.
- **Do** mantener el inspector sticky de 350px desde 1180px y devolverlo al flujo en pantallas menores.
- **Do** conservar el verde WhatsApp exclusivamente para acciones que terminan en WhatsApp.
- **Do** respetar `prefers-reduced-motion` y sostener foco visible en toda acción.
- **Do** limitar cada dropdown buscable al ancho de su control y reutilizar tokens Material en su búsqueda interna y dark mode.
- **Do** elevar a `z-index: 30` la tarjeta con foco o menú contextual abierto.
- **Do** diferenciar cada apariencia pública mediante composición, proporción fotográfica y densidad, además de sus tokens de color y tipografía.

### Don't:
- **Don't** aplicar el suelo cálido del catálogo público al panel administrativo, ni viceversa.
- **Don't** reintroducir halos ambientales, glow de color o degradados decorativos en el panel — el acento se reserva para acción y selección.
- **Don't** usar Space Grotesk o Playfair dentro del flujo operativo de Productos.
- **Don't** encerrar las tabs de Productos en una barra visual continua; deben leerse como controles independientes.
- **Don't** reducir la tarjeta vertical hasta volver ilegibles sus estados; cambia su composición en móvil.
- **Don't** usar el verde WhatsApp para éxito, filtros o estados generales.
- **Don't** convertir emojis o glifos de una fuente de iconos presentes en código legado en una regla del sistema; los nuevos patrones durables usan SVG accesible.
- **Don't** permitir que un panel de opciones o una etiqueta larga ensanche el viewport.
- **Don't** recortar ni apilar el menú contextual detrás de tarjetas posteriores de la cuadrícula.
- **Don't** reducir las apariencias del catálogo a cambios de paleta sobre tarjetas idénticas.
