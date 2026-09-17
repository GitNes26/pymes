from __future__ import annotations

import base64
import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".video-deps"))
import imageio_ffmpeg

W, H, FPS, TARGET = 1920, 1080, 24, 780.0
OUT = ROOT / "artifacts" / "cadi-tutorial-real"
CAP = OUT / "capturas"
SLIDES = OUT / "slides"
AUDIO = OUT / "narracion"
PARTS = OUT / "partes"
for folder in (OUT, CAP, SLIDES, AUDIO, PARTS):
    folder.mkdir(parents=True, exist_ok=True)

FINAL = OUT / "catalogo-facil-tutorial-real-13-minutos.mp4"
POSTER = OUT / "catalogo-facil-tutorial-real-poster.png"
STORYBOARD = OUT / "catalogo-facil-tutorial-real-storyboard.png"
MUSIC = OUT / "musica-original.wav"

SEGMENTS = [
    ("Catálogo Fácil, de principio a fin", "Un recorrido real por el sistema", ["Vistas auténticas", "Paso a paso", "13 minutos"], "14-catalogo-publico.png",
     "Bienvenido a este tutorial completo de Catálogo Fácil. Todo lo que verás corresponde al sistema real, sin pantallas inventadas. Vamos a recorrer el proceso desde el registro de una tienda hasta la publicación del catálogo, la administración de productos y el seguimiento de pedidos. Puedes pausar el video en cualquier momento para repetir un paso. La meta es que al terminar entiendas para qué sirve cada sección y puedas operar tu negocio con seguridad."),
    ("1. Registra tu tienda", "Comienza en cadi.nessik.net", ["Datos del negocio", "Enlace público", "WhatsApp y PIN"], "01-registro.png",
     "En la pantalla de registro escribe el nombre de tu negocio y una descripción clara de lo que vendes. El sistema genera un enlace público que podrás compartir con tus clientes. Después captura el número de WhatsApp donde recibirás los pedidos y crea un PIN de acceso. A la derecha aparece una vista previa para que confirmes cómo se presentará la tienda. Revisa especialmente el nombre, el enlace y el teléfono antes de continuar."),
    ("2. Accede con tu PIN", "El panel es privado; el catálogo es público", ["Elige tu tienda", "Escribe el PIN", "No lo compartas"], "02-acceso.png",
     "Esta es la pantalla de acceso del negocio. El cliente nunca necesita entrar aquí. El dueño o un empleado autorizado escribe el PIN y presiona Entrar a mi panel. El PIN protege precios, inventario, pedidos y datos del negocio, por eso no debes colocarlo en publicaciones ni enviarlo junto con el enlace del catálogo. Si trabajas con varias personas, más adelante podrás crear accesos individuales y decidir qué puede administrar cada empleado."),
    ("3. Conoce el panel", "La operación completa en un solo lugar", ["Resumen del día", "Enlace y código QR", "Alertas de inventario"], "03-panel-resumen.png",
     "Al entrar verás el panel principal. En la barra lateral están Productos, Empleados, Clientes, Proveedores, Configuración y Planes. En la parte superior puedes abrir el catálogo público y copiar su enlace. También aparece un código QR útil para mostradores, tarjetas o publicaciones impresas. Las tarjetas del resumen muestran visitas, ingresos cobrados, pedidos de WhatsApp y conversión. Si hay productos con pocas existencias, el sistema presenta una alerta para que puedas reponerlos a tiempo."),
    ("4. Lee tus métricas", "Entiende qué está funcionando", ["Visitas y conversión", "Productos más vistos", "Historial de precios"], "04-panel-metricas.png",
     "Más abajo aparecen las métricas del negocio. El historial te ayuda a recordar cambios de precio y promociones. El embudo compara visitas, aperturas de WhatsApp y pedidos, de modo que puedes detectar si muchas personas ven el catálogo pero pocas preguntan. También se muestran los productos más vistos, los más pedidos por WhatsApp y los más vendidos. No necesitas revisar esto a cada hora; una revisión semanal suele ser suficiente para decidir qué producto destacar o volver a comprar."),
    ("5. Administra pedidos", "Cada solicitud debe tener un estado correcto", ["Nuevos y por cobrar", "Pagados y entregados", "Abonos y fechas"], "05-pedidos-recientes.png",
     "En Pedidos recientes puedes filtrar por nuevos, por cobrar, con abonos, pagados, entregados o cancelados. Cada tarjeta muestra el total, los artículos y, cuando el cliente proporciona sus datos, su nombre y teléfono. Si manejas pagos parciales, registra cada abono y revisa cuánto falta. Cuando entregues, actualiza el estado. Mantener esta información al día es importante porque las estadísticas y los reportes dependen de ella. Evita dejar ventas terminadas como nuevas o pendientes."),
    ("6. Revisa tus productos", "Busca, filtra y controla el catálogo", ["Categorías", "Visibles u ocultos", "Stock y promociones"], "06-productos.png",
     "La sección Mis productos presenta el catálogo en tarjetas. Arriba puedes filtrar por categoría, visibilidad y alertas de inventario, además de buscar por nombre. Cada tarjeta permite identificar rápidamente el precio, las existencias y las promociones. Un producto oculto permanece guardado en el panel, pero deja de mostrarse al cliente. Esta opción sirve mientras corriges una fotografía o esperas mercancía. Utiliza categorías sencillas y consistentes para que el buscador y los filtros sean realmente útiles."),
    ("7. Agrega un producto", "Completa la ficha con información útil", ["Tipo de producto", "Fotos y nombre", "Precio, stock y variantes"], "07-nuevo-producto.png",
     "Presiona Nuevo para abrir el formulario de producto. Primero selecciona si se trata de un producto sencillo o uno con variantes. Después agrega fotografías claras, escribe un nombre fácil de reconocer y una descripción breve. Captura el precio, la categoría y el inventario disponible. Si manejas tallas, colores o presentaciones, crea las variantes correspondientes en lugar de escribirlas solamente en la descripción. Antes de guardar, revisa que el producto esté visible y que el precio sea correcto."),
    ("8. Organiza tus clientes", "Guarda notas y continúa la conversación", ["Nombre y teléfono", "Notas internas", "Acceso directo a WhatsApp"], "08-clientes.png",
     "En Clientes puedes guardar nombre, teléfono y notas internas. Esta lista te ayuda a reconocer compradores frecuentes y conservar información útil para la atención. Desde cada registro puedes abrir WhatsApp sin volver a escribir el número. Las notas deben ser breves y relacionadas con el servicio, por ejemplo una preferencia de entrega o un producto solicitado. Revisa los datos antes de guardarlos y evita almacenar información que no necesitas para atender la venta."),
    ("9. Controla proveedores y compras", "Relaciona reposición con inventario", ["Directorio de proveedores", "Pedidos de compra", "Recepción de mercancía"], "09-proveedores.png",
     "La sección Proveedores y compras reúne dos tareas. A la izquierda puedes crear un directorio con nombre, WhatsApp, correo y notas. A la derecha registras pedidos de compra, eliges proveedor y productos, y defines cantidades y costos. Cuando la mercancía llegue, marca la compra como recibida para mantener el seguimiento. Esta vista es especialmente útil cuando varios productos necesitan reposición y quieres recordar qué se pidió, a quién y por cuánto dinero."),
    ("10. Crea accesos para empleados", "Cada persona con sus propios permisos", ["PIN individual", "Permisos por función", "Editar o desactivar"], "10-empleados.png",
     "Si otras personas ayudan a administrar la tienda, no compartas el PIN principal. En Empleados crea un acceso individual, asigna un nombre y define un PIN distinto. Después activa únicamente los permisos necesarios, como ver productos, editar inventario, atender clientes o gestionar pedidos. Esto mantiene el panel ordenado y reduce cambios accidentales. Si una persona deja de colaborar, elimina o modifica su acceso. El dueño conserva el control general desde su cuenta principal."),
    ("11. Configura tu negocio", "Actualiza los datos que ve el cliente", ["Nombre y descripción", "Redes y contacto", "Horarios y seguridad"], "11-configuracion.png",
     "En Configuración se encuentran los datos generales del negocio. Aquí puedes corregir el nombre, la descripción, el WhatsApp de ventas y los enlaces de redes sociales. También puedes definir horarios, mensajes informativos y opciones de seguridad. Recorre el menú de la izquierda por secciones, guarda los cambios y después abre el catálogo público para comprobar el resultado. Si cambias el teléfono, haz una prueba desde otro dispositivo para confirmar que el botón de WhatsApp abre la conversación correcta."),
    ("12. Diseña el catálogo", "Construye la portada con componentes reales", ["Bloques y secciones", "Vista previa inmediata", "Orden y estilo"], "12-diseno.png",
     "El Constructor permite diseñar la página pública con bloques. Puedes añadir portada, categorías, productos destacados, texto, imágenes, ofertas y otros componentes. En el centro observas la vista previa, y a la derecha editas el bloque seleccionado. Haz cambios pequeños y revisa cómo se comportan en celular. Una portada sencilla, categorías visibles y productos bien fotografiados suelen ser más efectivos que una página saturada. Guarda cada ajuste importante antes de pasar a otra sección."),
    ("13. Revisa tu plan", "Conoce las funciones disponibles", ["Plan actual", "Características incluidas", "Costo y vigencia"], "13-planes.png",
     "En Planes puedes consultar el nivel activo y las funciones incluidas. Esta vista te ayuda a saber si existe algún límite relacionado con productos, herramientas de venta o personalización. Antes de cambiar de plan, revisa las características y piensa cuáles utiliza realmente tu negocio. El tutorial se enfoca en la operación del sistema; la contratación y cualquier pago deben confirmarse directamente con el proveedor cuando decidas que lo necesitas."),
    ("14. Abre el catálogo público", "Así se presenta tu negocio al cliente", ["Portada de la tienda", "Ofertas destacadas", "Botón de WhatsApp"], "14-catalogo-publico.png",
     "Este es el catálogo público real. En la portada aparece la identidad del negocio y, debajo, las ofertas o secciones que configuraste. El botón de WhatsApp permanece accesible para que el visitante pueda pedir ayuda. Observa la página como si fueras un cliente nuevo: debe quedar claro qué vende el negocio, dónde buscar y cómo iniciar un pedido. Comparte este enlace, no el del panel administrativo. Todos los cambios publicados aparecerán aquí automáticamente."),
    ("15. Explora y filtra productos", "Facilita que encuentren lo que buscan", ["Buscador", "Categorías", "Tarjetas con precio y oferta"], "15-catalogo-productos.png",
     "En la zona de productos, el cliente puede buscar por palabra o elegir una categoría. Cada tarjeta muestra fotografía, nombre, precio, promoción y disponibilidad. Cuanto más clara sea la ficha, menos preguntas tendrás que responder antes de cerrar la venta. Verifica que las fotografías no estén cortadas, que el precio anterior solo se use cuando existe una oferta real y que los productos agotados no parezcan disponibles. Una revisión rápida semanal mantiene el catálogo confiable."),
    ("16. Comprueba la vista móvil", "La mayoría de tus clientes llegará desde el teléfono", ["Texto legible", "Botones fáciles de tocar", "Fotos bien recortadas"], "16-catalogo-movil.png",
     "Ahora vemos exactamente el mismo catálogo en un teléfono. Las tarjetas se adaptan al ancho disponible y conservan los botones principales. Esta revisión es indispensable porque la mayor parte de los enlaces enviados por WhatsApp se abren en celular. Comprueba que los textos sean legibles, que los botones no se encimen y que las imágenes comuniquen el producto aun en tamaño pequeño. Si algo se ve confuso, corrígelo desde Productos o desde el Constructor."),
    ("17. El cliente prepara su compra", "Selecciona artículos antes de escribir por WhatsApp", ["Revisa precio", "Agrega productos", "Confirma cantidades"], "17-compra-movil.png",
     "El cliente recorre los productos y presiona Agregar en los artículos que le interesan. Si un producto tiene variantes, primero selecciona la opción correspondiente. La selección funciona como una lista organizada: reúne artículos, cantidades y el total estimado. Antes de enviarla, el comprador puede corregir cantidades o eliminar algo. Finalmente, Catálogo Fácil prepara el mensaje para WhatsApp. Tú confirmas existencias, entrega y pago directamente en la conversación; así mantienes el trato personal sin recibir pedidos desordenados."),
    ("18. Rutina recomendada", "Mantén el catálogo útil con poco esfuerzo", ["Diario: pedidos", "Semanal: stock y precios", "Mensual: métricas y diseño"], "03-panel-resumen.png",
     "Para terminar, establece una rutina simple. Cada día revisa pedidos nuevos, pagos y existencias. Una vez por semana comprueba precios, fotografías, productos ocultos y alertas de stock. Una vez al mes analiza métricas, clientes frecuentes y proveedores, y ajusta la portada si existe una promoción importante. Prueba el catálogo desde tu propio celular después de cambios grandes. Con esta disciplina, Catálogo Fácil se convierte en una herramienta viva para mostrar productos, ordenar conversaciones y dar seguimiento a las ventas."),
]


def font(size, bold=False):
    paths = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for p in paths:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def wrap(draw, text, fnt, width):
    words, lines, line = text.split(), [], ""
    for word in words:
        trial = (line + " " + word).strip()
        if draw.textbbox((0, 0), trial, font=fnt)[2] <= width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return "\n".join(lines)


def contain(im, box):
    x0, y0, x1, y1 = box
    scale = min((x1-x0)/im.width, (y1-y0)/im.height)
    size = (max(1, int(im.width*scale)), max(1, int(im.height*scale)))
    resized = im.resize(size, Image.Resampling.LANCZOS)
    return resized, (x0+(x1-x0-size[0])//2, y0+(y1-y0-size[1])//2)


def make_slide(index, item):
    title, subtitle, bullets, filename, _ = item
    source = Image.open(CAP / filename).convert("RGB")
    bg = source.resize((W, H), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(30))
    shade = Image.new("RGBA", (W, H), (7, 23, 39, 195))
    bg = Image.alpha_composite(bg.convert("RGBA"), shade)
    d = ImageDraw.Draw(bg)
    d.rounded_rectangle((36, 34, 440, 1046), radius=30, fill=(9, 29, 49, 246), outline=(44, 190, 158, 125), width=2)
    d.rounded_rectangle((470, 34, 1884, 1046), radius=28, fill=(243, 247, 247, 255))
    shot, pos = contain(source, (492, 56, 1862, 1024))
    bg.alpha_composite(shot.convert("RGBA"), dest=pos)
    d = ImageDraw.Draw(bg)
    d.rounded_rectangle((68, 70, 190, 108), radius=12, fill=(35, 196, 151, 255))
    d.text((129, 89), "CATÁLOGO FÁCIL", font=font(15, True), fill="white", anchor="mm")
    d.text((395, 89), f"{index:02d}/{len(SEGMENTS):02d}", font=font(16, True), fill=(179, 207, 216), anchor="rm")
    tf = font(42, True)
    d.multiline_text((72, 160), wrap(d, title, tf, 320), font=tf, fill="white", spacing=7)
    sf = font(21)
    d.multiline_text((72, 310), wrap(d, subtitle, sf, 320), font=sf, fill=(180, 204, 213), spacing=6)
    y = 485
    for bullet in bullets:
        d.ellipse((75, y+3, 101, y+29), fill=(35, 196, 151))
        d.text((88, y+16), "✓", font=font(15, True), fill="white", anchor="mm")
        bf = font(20, True)
        d.multiline_text((116, y), wrap(d, bullet, bf, 270), font=bf, fill=(238, 245, 246), spacing=4)
        y += 105
    d.rounded_rectangle((70, 979, 406, 990), radius=5, fill=(44, 67, 83))
    d.rounded_rectangle((70, 979, 70+int(336*index/len(SEGMENTS)), 990), radius=5, fill=(35, 196, 151))
    return bg.convert("RGB")


def speak(text, path):
    escaped = text.replace("'", "''")
    out = str(path).replace("'", "''")
    ps = ("Add-Type -AssemblyName System.Speech;"
          "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;"
          "$s.SelectVoice('Microsoft Sabina Desktop');$s.Rate=-2;$s.Volume=100;"
          f"$s.SetOutputToWaveFile('{out}');$s.Speak('{escaped}');$s.Dispose()")
    enc = base64.b64encode(ps.encode("utf-16le")).decode("ascii")
    subprocess.run(["powershell.exe", "-NoProfile", "-EncodedCommand", enc], check=True, stdout=subprocess.DEVNULL)


def duration(path):
    with wave.open(str(path), "rb") as wav:
        return wav.getnframes()/wav.getframerate()


def music():
    sr, n = 48000, int(TARGET*48000)
    audio = np.zeros(n, dtype=np.float32)
    chords = [[220, 277.18, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 207.65, 246.94]]
    for bar in range(math.ceil(TARGET/3)):
        start = bar*3
        for j, fq in enumerate(chords[bar % 4]):
            a, b = int(start*sr), min(n, int((start+2.85)*sr))
            t = np.arange(b-a, dtype=np.float32)/sr
            env = np.exp(-t*(0.75+j*.12))*(1-np.exp(-t*18))
            audio[a:b] += (np.sin(2*np.pi*fq*t)+.15*np.sin(4*np.pi*fq*t))*env*.018
    fade = int(sr*1.2)
    audio[:fade] *= np.linspace(0, 1, fade)
    audio[-fade:] *= np.linspace(1, 0, fade)
    pcm = (np.clip(audio, -.8, .8)*32767).astype(np.int16)
    with wave.open(str(MUSIC), "wb") as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(sr); wav.writeframes(pcm.tobytes())


def main():
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    raw = []
    for i, item in enumerate(SEGMENTS, 1):
        make_slide(i, item).save(SLIDES/f"slide-{i:02d}.png", quality=95)
        speak(item[4], AUDIO/f"voz-{i:02d}.wav")
        raw.append(duration(AUDIO/f"voz-{i:02d}.wav"))
    gap = 0.55
    tempo = sum(raw)/(TARGET-gap*len(SEGMENTS))
    print(f"voz={sum(raw):.2f}s tempo={tempo:.4f}")
    parts = []
    for i, seconds in enumerate(raw, 1):
        adjusted = seconds/tempo+gap
        part = PARTS/f"parte-{i:02d}.mp4"
        parts.append(part)
        fade_out = max(.1, adjusted-.35)
        vf = (f"scale={W}:{H},zoompan=z='min(zoom+0.000018,1.012)':"
              f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},"
              f"fade=t=in:st=0:d=0.28,fade=t=out:st={fade_out:.3f}:d=0.28,format=yuv420p")
        af = f"atempo={tempo:.6f},apad=pad_dur={gap},aresample=48000,volume=1.18"
        subprocess.run([ff, "-y", "-loop", "1", "-i", str(SLIDES/f"slide-{i:02d}.png"), "-i", str(AUDIO/f"voz-{i:02d}.wav"),
                        "-t", f"{adjusted:.6f}", "-vf", vf, "-af", af, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                        "-c:a", "aac", "-ar", "48000", "-b:a", "160k", "-shortest", str(part)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    concat = OUT/"concat-real.txt"
    concat.write_text("".join(f"file '{str(p).replace(chr(92), '/')}'\n" for p in parts), encoding="utf-8")
    voice = OUT/"tutorial-real-con-voz.mp4"
    subprocess.run([ff, "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(voice)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    music()
    subprocess.run([ff, "-y", "-i", str(voice), "-i", str(MUSIC), "-filter_complex",
                    "[0:a]aresample=48000,volume=1.12[voice];[1:a]volume=.22[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2,loudnorm=I=-16:LRA=8:TP=-1.5[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-b:a", "192k", "-t", str(TARGET), "-movflags", "+faststart", str(FINAL)], check=True)
    make_slide(1, SEGMENTS[0]).resize((1280, 720), Image.Resampling.LANCZOS).save(POSTER, quality=95)
    thumbs = [Image.open(SLIDES/f"slide-{i:02d}.png").resize((384,216), Image.Resampling.LANCZOS) for i in range(1, len(SEGMENTS)+1)]
    board = Image.new("RGB", (384*4, 216*5), "white")
    for i, thumb in enumerate(thumbs):
        board.paste(thumb, ((i%4)*384, (i//4)*216))
    board.save(STORYBOARD, quality=92)
    print(FINAL)


if __name__ == "__main__":
    main()
