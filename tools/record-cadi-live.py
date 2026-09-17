"""Record a continuous, browser-only tutorial of a new local Cadi store."""
from pathlib import Path
import audioop
import base64
import json
import os
import shutil
import subprocess
import sys
import time
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.video-deps'))
import imageio_ffmpeg

OUT = ROOT / 'artifacts' / 'cadi-tutorial-en-vivo-completo'
OUT.mkdir(parents=True, exist_ok=True)
FFMPEG_DIR = OUT / 'playwright-browsers' / 'ffmpeg-1011'
FFMPEG_DIR.mkdir(parents=True, exist_ok=True)
FFMPEG_RECORD = FFMPEG_DIR / 'ffmpeg-win64.exe'
if not FFMPEG_RECORD.exists():
    shutil.copy2(imageio_ffmpeg.get_ffmpeg_exe(), FFMPEG_RECORD)
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = str(OUT / 'playwright-browsers')
from playwright.sync_api import sync_playwright
VOICE = OUT / 'voz'
VOICE.mkdir(exist_ok=True)
BASE = 'http://localhost:3000'
SLUG = 'ferreteria-del-toro-tutorial-completo-20260917'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

NARRATION = [
    ('Arranque', '¡Vamos a levantar una tienda desde cero! Esto es Catálogo Fácil funcionando de verdad. Verás cada clic en una grabación continua: registro, diseño, productos, catálogo y administración. Usaremos datos de ejemplo en una copia local para no publicar un número de WhatsApp inventado.'),
    ('Registro', 'Primero, el nombre. La llamaré Ferretería del Toro, edición tutorial. Escribo una frase corta que explique qué vendemos. Mira la vista previa de la derecha: cambia al instante mientras lleno el formulario.'),
    ('Enlace y contacto', 'Ahora defino el enlace de la tienda. Después conecto el WhatsApp de ventas y creo el PIN de acceso. En una tienda real pondrías tu propio número, porque ahí llegarán los pedidos. Aquí uso un número de prueba únicamente para la demostración local.'),
    ('Crear tienda', '¡Listo! Pulso Crear mi tienda. La plataforma abre directamente el asistente de bienvenida. Este paso es clave: prepara categorías y diseño según el tipo de negocio, así que no empezamos desde una página vacía.'),
    ('Elegir giro', 'Elegimos ferretería. El asistente adapta las sugerencias a herramientas, materiales y accesorios. Si vendieras ropa, comida o servicios, aquí elegirías tu giro y recibirías otra base.'),
    ('Elegir diseño', 'Siguiente: el diseño del catálogo. Podemos probar opciones en tiempo real y ver cómo cambia la vista previa. Me quedo con un estilo claro y fuerte para que los productos se vean rápido en el celular.'),
    ('Categorías', 'Antes de terminar, reviso las categorías sugeridas. Puedes quitar las que sobren y añadir las tuyas. Pulso Crear mi catálogo y entramos al panel. ¡Ya tenemos la estructura de la tienda!'),
    ('Panel', 'Este es el centro de control. Aquí aparecen visitas, pedidos y accesos rápidos. Desde el menú podemos administrar productos, clientes, proveedores y la apariencia. Vamos al paso más importante: cargar artículos reales.'),
    ('Producto', 'En Productos pulso Nuevo. Voy a agregar un taladro percutor como ejemplo: nombre, categoría, precio, existencias y una descripción útil. La foto se puede subir aquí; en este tutorial no invento una imagen de producto.'),
    ('Detalles', 'El formulario permite promociones, código SKU, etiquetas, especificaciones y variantes. No hace falta llenar todo al principio. Avanzo al resumen, reviso los datos y guardo. ¡El primer producto ya está en el catálogo!'),
    ('Segundo producto', 'Agrego un segundo artículo para que se aprecie mejor la tienda. Fíjate en que cada ficha se puede volver a editar: precio, stock, visibilidad y promoción se controlan desde aquí.'),
    ('Catálogo público', 'Ahora abro el catálogo público. Esto es lo que verá un cliente. Puede buscar, entrar a un producto y preparar un pedido. En el plan gratuito también aparece una sección de recomendaciones de otras tiendas al final de la página.'),
    ('Carrito', 'Probemos la compra. Agrego un artículo y abro el carrito. Aquí se ve la cantidad, el total y el botón para pedir. El cliente escribe nombre y teléfono para que luego puedas identificarlo y darle seguimiento.'),
    ('Pedido de prueba', 'Voy a crear un pedido de prueba en esta copia local. La plataforma lo registra y prepara un mensaje de WhatsApp. Bloqueo la salida al WhatsApp externo porque el número que pusimos es ficticio. En tu tienda real, este paso abrirá la conversación con tu negocio.'),
    ('Pedidos en el panel', 'Regreso al panel y ahí está el pedido nuevo. Desde esta sección puedes revisar el total, cambiar el estado, registrar pagos y dar seguimiento. Así se conecta la visita del cliente con la operación de la tienda.'),
    ('Clientes y proveedores', 'En Clientes aparece el comprador del pedido de prueba. En Proveedores se organiza el abastecimiento. Estas pantallas ayudan a operar el negocio día a día, además de publicar artículos.'),
    ('Diseño y ajustes', 'En Diseño y Configuración puedes ajustar la identidad visual, datos de contacto y comportamiento del catálogo. Haz una revisión final en móvil y comparte el enlace cuando estén correctos los precios, las fotos y el WhatsApp.'),
    ('Cierre', '¡Y ahí está! Vimos una tienda nueva nacer en pantalla y recorrimos los procesos principales. La grabación es continua del navegador, con voz encima. Repite cualquier paso a tu ritmo y usa tu propio número y productos cuando crees tu tienda pública.'),
]

def speak(text, target):
    escaped = text.replace("'", "''")
    destination = str(target).replace("'", "''")
    ps = ("Add-Type -AssemblyName System.Speech;"
          "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;"
          "$s.SelectVoice('Microsoft Sabina Desktop');$s.Rate=3;$s.Volume=100;"
          f"$s.SetOutputToWaveFile('{destination}');$s.Speak('{escaped}');$s.Dispose()")
    encoded = base64.b64encode(ps.encode('utf-16le')).decode('ascii')
    subprocess.run(['powershell.exe', '-NoProfile', '-EncodedCommand', encoded], check=True, stdout=subprocess.DEVNULL)

def wav_duration(path):
    with wave.open(str(path), 'rb') as w:
        return w.getnframes() / w.getframerate()

def build_audio(marks, audio_path):
    rate = 48000
    chunks = []
    cursor = 0
    for label, offset, path in marks:
        with wave.open(str(path), 'rb') as w:
            raw = w.readframes(w.getnframes())
            if w.getnchannels() == 2:
                raw = audioop.tomono(raw, w.getsampwidth(), .5, .5)
            raw = audioop.ratecv(raw, w.getsampwidth(), 1, w.getframerate(), rate, None)[0]
            if w.getsampwidth() != 2:
                raw = audioop.lin2lin(raw, w.getsampwidth(), 2)
        start = round(offset * rate) * 2
        if start > cursor:
            chunks.append(b'\0' * (start - cursor))
            cursor = start
        chunks.append(raw)
        cursor += len(raw)
    with wave.open(str(audio_path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b''.join(chunks))

def main():
    voice_paths = []
    for i, (_, line) in enumerate(NARRATION):
        path = VOICE / f'{i+1:02d}.wav'
        if not path.exists():
            speak(line, path)
        voice_paths.append(path)
    marks = []
    logs = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=CHROME, args=['--disable-gpu', '--no-sandbox'])
        context = browser.new_context(viewport={'width': 1366, 'height': 768}, device_scale_factor=1,
                                      record_video_dir=str(OUT), record_video_size={'width': 1366, 'height': 768})
        context.route('https://wa.me/**', lambda route: route.abort())
        page = context.new_page()
        start = time.monotonic()
        def scene(index, action):
            label = NARRATION[index][0]
            now = time.monotonic() - start
            marks.append((label, now, voice_paths[index]))
            print(f'{index+1:02d} {label} @ {now:.2f}s', flush=True)
            action()
            elapsed = time.monotonic() - start - now
            time.sleep(max(.6, wav_duration(voice_paths[index]) + .45 - elapsed))
            logs.append({'escena': label, 'segundo': round(now, 2), 'url': page.url})
        def go(path):
            page.goto(BASE + path, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(600)
        try:
            scene(0, lambda: go('/registrar'))
            def registration_name():
                page.locator('#f-name').fill('Ferretería del Toro | Tutorial')
                page.wait_for_timeout(700)
                page.locator('#f-description').fill('Herramientas y materiales para cada proyecto.')
                page.wait_for_timeout(700)
            scene(1, registration_name)
            def registration_details():
                page.locator('#f-slug').fill(SLUG)
                page.wait_for_timeout(700)
                page.locator('#f-whatsapp').fill('0000000000')
                page.wait_for_timeout(700)
                page.locator('#f-pin').fill('734281')
            scene(2, registration_details)
            scene(3, lambda: (page.locator('#submit-button').click(), page.wait_for_url('**/admin/bienvenida', timeout=30000)))
            def giro():
                card = page.locator('[data-giro="ferreteria"]')
                if not card.count():
                    card = page.locator('[data-giro]').filter(has_text='Ferretería').first
                card.click()
                page.wait_for_timeout(650)
                page.locator('#wz-next-1').click()
            scene(4, giro)
            def design():
                options = page.locator('.wz-vibe-card')
                preferred = page.locator('[data-design="industrial"]')
                (preferred if preferred.count() else options.first).click()
                page.wait_for_timeout(900)
                page.locator('#wz-next-2').click()
            scene(5, design)
            def categories():
                page.locator('#wz-cat-add-input').fill('Herramientas eléctricas')
                page.locator('#wz-cat-add-btn').click()
                page.wait_for_timeout(700)
                page.locator('#wz-submit').click()
                page.wait_for_url('**/admin/panel?bienvenida=1', timeout=30000)
            scene(6, categories)
            def panel():
                page.mouse.wheel(0, 500)
                page.wait_for_timeout(1000)
                go('/' + SLUG + '/admin/productos')
            scene(7, panel)
            def first_product():
                page.locator('a[href="#nuevo-producto"]').first.click()
                page.locator('#f-name').fill('Taladro percutor 13 mm')
                page.locator('#f-cat').select_option(index=1)
                page.locator('#f-price').fill('1299')
                page.locator('#f-stock').fill('8')
                page.locator('#f-desc').fill('Taladro versátil para reparaciones y proyectos del hogar.')
                page.locator('#f-sku').fill('TAL-001') if page.locator('#f-sku').is_visible() else None
                page.wait_for_timeout(800)
            scene(8, first_product)
            def finish_product():
                for _ in range(3):
                    if page.locator('#pf-next').is_visible():
                        page.locator('#pf-next').click()
                        page.wait_for_timeout(600)
                page.locator('#pf-save').click()
                page.wait_for_load_state('domcontentloaded')
            scene(9, finish_product)
            def second_product():
                go('/' + SLUG + '/admin/productos')
                page.locator('a[href="#nuevo-producto"]').first.click()
                page.locator('#f-name').fill('Martillo de uña 16 oz')
                page.locator('#f-cat').select_option(index=1)
                page.locator('#f-price').fill('249')
                page.locator('#f-stock').fill('20')
                page.locator('#f-desc').fill('Mango cómodo y cabeza resistente para trabajo diario.')
                for _ in range(3):
                    if page.locator('#pf-next').is_visible():
                        page.locator('#pf-next').click()
                        page.wait_for_timeout(400)
                page.locator('#pf-save').click()
                page.wait_for_load_state('domcontentloaded')
            scene(10, second_product)
            def catalog():
                go('/' + SLUG)
                page.mouse.wheel(0, 450)
                page.wait_for_timeout(1000)
            scene(11, catalog)
            def cart():
                page.locator('button.prod-btn').first.click()
                page.wait_for_timeout(700)
                page.locator('#chat-fab').click()
                page.locator('#chat-nombre').fill('Cliente de prueba')
                page.locator('#chat-telefono').fill('0000000000')
            scene(12, cart)
            def order():
                page.get_by_role('button', name='Pedir por WhatsApp').click()
                page.wait_for_timeout(1700)
                go('/' + SLUG + '/admin/panel')
            scene(13, order)
            def orders_panel():
                page.locator('#sec-pedidos').scroll_into_view_if_needed()
                page.wait_for_timeout(900)
            scene(14, orders_panel)
            def operations():
                go('/' + SLUG + '/admin/clientes')
                page.wait_for_timeout(1400)
                go('/' + SLUG + '/admin/proveedores')
            scene(15, operations)
            def settings():
                go('/' + SLUG + '/admin/diseno')
                page.wait_for_timeout(1200)
                go('/' + SLUG + '/admin/config')
                page.mouse.wheel(0, 450)
            scene(16, settings)
            scene(17, lambda: go('/' + SLUG))
        finally:
            context.close()
            video = page.video.path()
            browser.close()
    master = OUT / 'narracion.wav'
    build_audio(marks, master)
    raw = OUT / 'captura-continua.webm'
    if Path(video) != raw:
        shutil.copy2(video, raw)
    final = OUT / 'tutorial-tienda-desde-cero-en-vivo.mp4'
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ff, '-y', '-i', str(raw), '-i', str(master), '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
                    '-c:a', 'aac', '-b:a', '160k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                    '-shortest', str(final)], check=True)
    (OUT / 'recorrido.json').write_text(json.dumps({'slug': SLUG, 'entorno': BASE, 'escenas': logs}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(final, flush=True)

if __name__ == '__main__':
    main()
