from __future__ import annotations

import base64
import importlib.util
import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".video-deps"))
spec = importlib.util.spec_from_file_location("cadi_promo", ROOT / "tools" / "make-cadi-promo.py")
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)
import imageio_ffmpeg

W, H, FPS, TARGET = 720, 1280, 24, 300.0
OUT = ROOT / "artifacts" / "cadi-tutorial-5min"
SLIDES = OUT / "slides"
AUDIO = OUT / "narracion"
PARTS = OUT / "partes"
for folder in (OUT, SLIDES, AUDIO, PARTS): folder.mkdir(parents=True, exist_ok=True)
FINAL = OUT / "cadi-tutorial-completo-5-minutos.mp4"
POSTER = OUT / "cadi-tutorial-completo-poster.png"
STORYBOARD = OUT / "cadi-tutorial-completo-storyboard.png"
MUSIC = OUT / "musica-original.wav"

SEGMENTS = [
    {
        "title": "Cómo usar Catálogo Fácil",
        "subtitle": "De una tienda vacía a tu primer pedido por WhatsApp",
        "bullets": ["Tutorial completo", "Sin conocimientos técnicos", "Cinco minutos"],
        "kind": "intro",
        "narration": "Bienvenido a Catálogo Fácil. En este tutorial aprenderás a crear y administrar tu catálogo digital desde cero. Veremos cómo registrar tu negocio, personalizar su apariencia, cargar productos, compartir el enlace y recibir pedidos directamente por WhatsApp. No necesitas conocimientos técnicos ni una tienda en línea complicada. La idea es que tus clientes encuentren información clara, armen su pedido y hablen contigo para confirmar la compra."
    },
    {
        "title": "Antes de comenzar",
        "subtitle": "Ten preparados estos datos",
        "bullets": ["Nombre y descripción del negocio", "WhatsApp de ventas", "Fotos y precios de productos"],
        "kind": "checklist",
        "narration": "Antes de registrarte, prepara tres cosas. Primero, el nombre de tu negocio y una descripción corta que explique qué vendes. Segundo, el número de WhatsApp donde quieres recibir los pedidos. Tercero, algunas fotos de tus productos junto con sus nombres y precios. También crearás un PIN de acceso. Este PIN protege el panel de administración, así que elige uno que puedas recordar y no lo compartas con tus clientes."
    },
    {
        "title": "Registra tu tienda",
        "subtitle": "Entra a cadi.nessik.net y selecciona “Registrar tienda”",
        "bullets": ["Escribe el nombre", "Confirma el enlace", "Conecta WhatsApp y crea tu PIN"],
        "kind": "register",
        "narration": "En la página principal, presiona Registrar tienda. Escribe el nombre del negocio. Catálogo Fácil creará automáticamente un enlace público; puedes conservarlo o cambiarlo por uno más sencillo. Añade una descripción breve y tu WhatsApp de ventas con diez dígitos. Después crea un PIN de seis a doce números. Mientras completas los datos verás una vista previa que te ayuda a confirmar que el nombre, el enlace y el teléfono sean correctos. Finalmente presiona Crear mi tienda."
    },
    {
        "title": "Personaliza el negocio",
        "subtitle": "El asistente prepara una base adecuada para tu giro",
        "bullets": ["Elige tu giro", "Selecciona una vibra", "Revisa las categorías sugeridas"],
        "kind": "options",
        "narration": "Al crear la tienda aparecerá el asistente de bienvenida. Busca y selecciona tu giro, por ejemplo panadería, ferretería, boutique o restaurante. En el segundo paso elige la vibra visual que represente mejor al negocio. El sistema marcará una recomendación, pero puedes escoger otra. En el resumen final revisa el giro, los colores y las categorías que se crearán automáticamente. Todo esto puede modificarse más adelante, así que no te preocupes si todavía no tienes la decisión perfecta."
    },
    {
        "title": "Conoce tu panel",
        "subtitle": "Aquí controlas toda la operación",
        "bullets": ["Resumen y pedidos", "Productos y clientes", "Diseño y configuración"],
        "kind": "dashboard",
        "narration": "Después entrarás al panel de administración. La navegación agrupa las tareas principales: resumen, productos, pedidos, clientes, reportes, diseño y configuración. En el resumen puedes revisar rápidamente la actividad de la tienda. En productos mantienes actualizado el catálogo. En pedidos das seguimiento a lo que te solicitaron. Diseño cambia la apariencia pública y configuración guarda los datos generales. Cuando estés aprendiendo, trabaja una sección a la vez; tus cambios quedarán asociados únicamente a tu negocio."
    },
    {
        "title": "Agrega un producto",
        "subtitle": "Una buena ficha responde las dudas principales",
        "bullets": ["Fotografía clara", "Nombre y descripción", "Precio y categoría"],
        "kind": "product",
        "narration": "Para publicar el primer artículo, abre Productos y elige Nuevo producto. Sube una fotografía clara, preferiblemente con buena luz y sin texto pequeño. Escribe un nombre fácil de reconocer. Agrega una descripción breve con materiales, tamaño o información relevante. Captura el precio y selecciona una categoría. Si el producto está en oferta, puedes indicar el precio anterior. Antes de guardar, revisa la vista previa. Un catálogo consistente vende mejor, así que usa fotografías con una proporción parecida y nombres cortos."
    },
    {
        "title": "Controla variantes e inventario",
        "subtitle": "Evita aceptar pedidos que no puedes surtir",
        "bullets": ["Tallas, colores o presentaciones", "Existencias disponibles", "Producto visible u oculto"],
        "kind": "inventory",
        "narration": "Si vendes ropa, alimentos por tamaño o artículos con diferentes colores, usa las variantes. Crea atributos como talla, color o presentación y registra las combinaciones disponibles. También puedes indicar existencias. Cuando una combinación se agota, el sistema evita que el cliente solicite más de lo disponible. Si todavía estás preparando una ficha, desactiva su visibilidad y publícala cuando esté lista. Actualiza el inventario con frecuencia, especialmente después de ventas realizadas fuera del catálogo."
    },
    {
        "title": "Organiza y diseña",
        "subtitle": "Haz que encontrar un producto sea inmediato",
        "bullets": ["Categorías comprensibles", "Ofertas visibles", "Colores coherentes con tu marca"],
        "kind": "design",
        "narration": "Organiza los productos en categorías que tus clientes entiendan. Evita crear demasiadas categorías con uno o dos productos. Después abre Diseño para ajustar colores, tipografía, portada y bloques de contenido. Puedes mostrar ofertas, una galería, información de contacto, preguntas frecuentes y productos destacados. Mantén el catálogo sencillo: una portada clara, categorías útiles y fotografías consistentes suelen funcionar mejor que una página saturada. Guarda los cambios y abre la vista pública para comprobar el resultado en computadora y celular."
    },
    {
        "title": "Publica y comparte",
        "subtitle": "Tu catálogo vive en un enlace propio",
        "bullets": ["Copia el enlace público", "Compártelo en WhatsApp y redes", "Colócalo en tu perfil y negocio"],
        "kind": "share",
        "narration": "Cuando tus productos estén listos, copia el enlace público de la tienda. Compártelo por WhatsApp, Facebook, Instagram o cualquier red que uses. También puedes colocarlo en la descripción de tu perfil, imprimirlo como código QR o enviarlo cuando alguien pregunte por precios. No compartas la dirección del panel administrativo ni tu PIN. El cliente solamente necesita el enlace público. Cada cambio de producto, precio o disponibilidad aparecerá en ese mismo enlace, así que no tendrás que enviar un catálogo nuevo."
    },
    {
        "title": "Así compra tu cliente",
        "subtitle": "No necesita registrarse ni aprender otra aplicación",
        "bullets": ["Busca y filtra", "Revisa detalles", "Selecciona productos"],
        "kind": "customer",
        "narration": "Al abrir el catálogo, el cliente ve el nombre del negocio, las ofertas y los productos. Puede usar el buscador, filtrar por categoría y revisar cada ficha. Si existen variantes, elige la talla, color o presentación antes de agregar el artículo. La selección funciona como una lista temporal del pedido; no se realiza un cobro en línea. El objetivo es que el cliente decida con información completa y luego envíe una solicitud ordenada a tu WhatsApp para confirmar disponibilidad, entrega y forma de pago."
    },
    {
        "title": "Recibe el pedido en WhatsApp",
        "subtitle": "Productos, cantidades y total llegan organizados",
        "bullets": ["Mensaje preparado automáticamente", "Confirma existencias", "Acuerda entrega y pago"],
        "kind": "order",
        "narration": "Cuando el cliente termina, presiona Enviar por WhatsApp. Catálogo Fácil prepara un mensaje con los productos, variantes, cantidades y total estimado. Tú recibes la conversación en el número configurado. Responde para confirmar existencias, tiempo de entrega, domicilio y método de pago. El sistema no sustituye esa conversación: la organiza. Después de enviar el pedido, la selección del cliente se limpia para evitar duplicados. Si cambias tu número de ventas, actualízalo en configuración antes de volver a compartir el catálogo."
    },
    {
        "title": "Da seguimiento a pedidos",
        "subtitle": "Mantén cada venta en el estado correcto",
        "bullets": ["Revisa solicitudes nuevas", "Actualiza el estado", "Registra pagos o abonos"],
        "kind": "orders",
        "narration": "En la sección Pedidos puedes revisar las solicitudes registradas y su información. Abre cada una, valida los artículos y cambia el estado según tu proceso: pendiente, confirmado, entregado o cancelado. Si manejas pagos parciales, registra los abonos para saber cuánto falta. Evita dejar pedidos viejos como pendientes porque distorsionan tus reportes. Una rutina sencilla es revisar solicitudes nuevas por la mañana, confirmar por WhatsApp y actualizar el estado en cuanto entregues o cierres la venta."
    },
    {
        "title": "Clientes y reportes",
        "subtitle": "Convierte la actividad en decisiones",
        "bullets": ["Historial de clientes", "Productos más solicitados", "Exportación a Excel"],
        "kind": "reports",
        "narration": "La sección Clientes reúne información útil de quienes han realizado pedidos. Los reportes muestran actividad, productos más solicitados y ventas registradas. Utiliza estos datos para decidir qué volver a comprar, qué producto destacar y qué promociones repetir. Cuando necesites trabajar fuera del sistema, descarga el reporte en Excel. Recuerda que las cifras serán confiables solamente si mantienes los estados y pagos al día. Los reportes no son decoración: conviértelos en una revisión semanal de inventario, ventas y oportunidades."
    },
    {
        "title": "Tu rutina recomendada",
        "subtitle": "Un catálogo actualizado genera más confianza",
        "bullets": ["Diario: pedidos e inventario", "Semanal: precios y productos", "Mensual: diseño y reportes"],
        "kind": "routine",
        "narration": "Para terminar, adopta una rutina fácil. Cada día revisa pedidos y existencias. Una vez por semana comprueba precios, fotografías y productos agotados. Cada mes analiza reportes y mejora la portada o las ofertas destacadas. Si tienes muchos artículos, utiliza la importación desde Excel para acelerar la carga. Prueba siempre el catálogo desde tu propio celular después de cambios importantes. Ya conoces el flujo completo: registra, personaliza, publica, comparte y atiende tus pedidos. Entra a cadi punto nessik punto net y crea tu tienda."
    },
]


def draw_wrapped(d, xy, text, size, color, weight, width, spacing=7):
    f = P.font(size, weight)
    P.draw_text(d, xy, P.wrap(d, text, f, width), size, color, weight, spacing=spacing)


def header(d, idx, title, subtitle):
    P.brand(d, 45, 255, centered=False)
    d.rounded_rectangle((540, 53, 672, 91), radius=12, fill=P.NAVY)
    P.draw_text(d, (606, 72), f"{idx:02d} / {len(SEGMENTS):02d}", 14, P.WHITE, "bold", "mm")
    draw_wrapped(d, (44, 142), title, 44, P.INK, "bold", 620, 2)
    draw_wrapped(d, (46, 258), subtitle, 20, P.MUTED, "regular", 620, 5)
    y = 1184
    d.rounded_rectangle((44, y, 676, y+8), radius=4, fill="#DCE2E3")
    d.rounded_rectangle((44, y, 44+int(632*(idx/len(SEGMENTS))), y+8), radius=4, fill=P.TEAL)


def bullet_rows(d, bullets, y0=850):
    for i, text in enumerate(bullets):
        y = y0 + i*88
        d.rounded_rectangle((54, y, 666, y+68), radius=18, fill=P.WHITE)
        d.ellipse((72, y+17, 106, y+51), fill=P.TEAL)
        P.draw_text(d, (89, y+34), "✓", 17, P.WHITE, "bold", "mm")
        P.draw_text(d, (126, y+34), text, 18, P.INK, "semi", "lm")


def make_slide(seg, idx):
    im = P.gradient_bg(P.PAPER, "#ECF8F3")
    P.accent_blobs(im, idx*.7, .55)
    d = ImageDraw.Draw(im)
    header(d, idx, seg["title"], seg["subtitle"])
    kind = seg["kind"]
    if kind == "intro":
        d.rounded_rectangle((80, 420, 640, 735), radius=34, fill=P.NAVY)
        P.draw_text(d, (360, 495), "TU CATÁLOGO", 19, "#BFD4E7", "bold", "ma")
        P.draw_text(d, (360, 570), "Productos claros", 38, P.WHITE, "bold", "ma")
        P.draw_text(d, (360, 632), "Pedidos ordenados", 38, P.WHITE, "bold", "ma")
        d.rounded_rectangle((194, 670, 526, 716), radius=14, fill=P.GREEN)
        P.draw_text(d, (360, 693), "Directo a WhatsApp", 18, P.WHITE, "bold", "mm")
    elif kind == "register":
        P.rounded_shadow(im, (68, 365, 652, 825), 28, P.WHITE, (0, 12, 34, 25), P.NAVY); d = ImageDraw.Draw(im)
        P.draw_text(d, (100, 405), "Dale vida a tu tienda", 27, P.INK, "bold")
        for j,(lab,val) in enumerate([("NOMBRE","Panadería La Esperanza"),("WHATSAPP","871 123 4567"),("ENLACE","cadi.nessik.net/panaderia")]):
            y=475+j*100;P.draw_text(d,(100,y),lab,12,P.MUTED,"bold");d.rounded_rectangle((100,y+26,620,y+86),radius=15,fill="#F7F8F8",outline=P.LINE,width=2);P.draw_text(d,(120,y+56),val,17,P.INK,"regular","lm")
        d.rounded_rectangle((100,760,620,805),radius=14,fill=P.INK);P.draw_text(d,(360,782),"Crear mi tienda",17,P.WHITE,"bold","mm")
    elif kind == "options":
        for j,(name,col,sel) in enumerate([("Panadería","#F0A04B",True),("Boutique","#B67CE8",False),("Ferretería","#70869A",False)]):
            y=380+j*105;d.rounded_rectangle((70,y,650,y+82),radius=18,fill=P.WHITE,outline=P.BLUE if sel else P.LINE,width=3 if sel else 2);d.rounded_rectangle((88,y+15,140,y+67),radius=13,fill=col);P.draw_text(d,(165,y+41),name,19,P.INK,"bold","lm")
        P.draw_text(d,(70,730),"Elige la vibra",22,P.INK,"bold")
        for j,col in enumerate([P.BLUE,"#D7794E",P.TEAL]):d.rounded_rectangle((70+j*195,775,240+j*195,860),radius=18,fill=P.WHITE,outline=P.BLUE if j==2 else P.LINE,width=3 if j==2 else 2);d.ellipse((126+j*195,792,180+j*195,846),fill=col)
    elif kind in ("customer", "share"):
        P.phone_shell(im, 236, 350, .62, "catalog"); d = ImageDraw.Draw(im)
    elif kind in ("order", "orders"):
        P.phone_shell(im, 236, 350, .62, "order"); d = ImageDraw.Draw(im)
    elif kind == "product":
        P.rounded_shadow(im,(68,365,652,830),28,P.WHITE,(0,12,34,25),P.NAVY);d=ImageDraw.Draw(im)
        d.rounded_rectangle((98,395,622,590),radius=22,fill="#E6EEF5");d.rounded_rectangle((275,445,430,555),radius=20,fill="#71859A");d.rectangle((418,486,500,502),fill="#344655")
        for j,(lab,val) in enumerate([("NOMBRE","Martillo de uña 16oz"),("PRECIO","$189.00")]):
            y=640+j*92;P.draw_text(d,(98,y),lab,12,P.MUTED,"bold");d.rounded_rectangle((98,y+24,622,y+78),radius=14,fill="#F7F8F8",outline=P.LINE,width=2);P.draw_text(d,(116,y+51),val,17,P.INK,"regular","lm")
    elif kind == "dashboard":
        P.rounded_shadow(im,(54,355,666,815),28,P.WHITE,(0,12,34,24),P.NAVY);d=ImageDraw.Draw(im)
        d.rounded_rectangle((54,355,210,815),radius=28,fill=P.NAVY)
        for j,txt in enumerate(["Resumen","Productos","Pedidos","Clientes","Reportes","Diseño"]):P.draw_text(d,(80,405+j*61),txt,15,P.WHITE if j==0 else "#BDD0E2","semi")
        P.draw_text(d,(244,402),"Resumen",25,P.INK,"bold")
        for j,(num,lab) in enumerate([("127","Visitas"),("34","Pedidos"),("27%","Conversión")]):
            x=238+j*133;d.rounded_rectangle((x,470,x+118,590),radius=17,fill="#F4F7F8");P.draw_text(d,(x+16,498),num,26,P.NAVY,"bold");P.draw_text(d,(x+16,550),lab,12,P.MUTED,"semi")
        d.rounded_rectangle((238,625,620,770),radius=18,fill="#E8F6F1");d.line([(260,735),(335,700),(405,716),(486,650),(590,620)],fill=P.TEAL,width=6)
    elif kind == "reports":
        im = Image.new("RGBA",(W,H),P.NAVY);d=ImageDraw.Draw(im);P.brand(d,45,255,centered=False);d.rounded_rectangle((540,53,672,91),radius=12,fill="#244970");P.draw_text(d,(606,72),f"{idx:02d} / {len(SEGMENTS):02d}",14,P.WHITE,"bold","mm");draw_wrapped(d,(44,142),seg["title"],44,P.WHITE,"bold",620,2);draw_wrapped(d,(46,258),seg["subtitle"],20,"#C4D5E3","regular",620,5)
        for j,(num,lab) in enumerate([("127","visitas"),("34","pedidos"),("27%","convierten")]):
            x=40+j*225;d.rounded_rectangle((x,390,x+205,590),radius=26,fill=P.WHITE);P.draw_text(d,(x+22,430),num,42,P.INK,"bold");P.draw_text(d,(x+22,515),lab,17,P.MUTED,"semi")
        d.rounded_rectangle((40,635,680,985),radius=28,fill="#183E69");P.draw_text(d,(72,680),"Ventas esta semana",17,"#C4D5E3","semi");P.draw_text(d,(72,730),"$8,540",47,P.WHITE,"bold");d.line([(76,900),(180,850),(280,870),(385,760),(490,790),(635,700)],fill=P.TEAL,width=8)
        d.rounded_rectangle((44,1184,676,1192),radius=4,fill="#355779");d.rounded_rectangle((44,1184,44+int(632*(idx/len(SEGMENTS))),1192),radius=4,fill=P.TEAL)
    else:
        icons={"checklist":[("N","Nombre"),("W","WhatsApp"),("F","Fotos")],"inventory":[("T","Tallas"),("C","Colores"),("S","Stock")],"design":[("C","Categorías"),("O","Ofertas"),("D","Diseño")],"routine":[("D","Diario"),("S","Semanal"),("M","Mensual")]}.get(kind,[("P","Pedidos"),("C","Clientes"),("R","Reportes")])
        for j,(letter,label) in enumerate(icons):
            x=62+j*210;d.rounded_rectangle((x,390,x+176,700),radius=26,fill=P.WHITE);d.ellipse((x+48,430,x+128,510),fill=[P.BLUE,P.TEAL,P.NAVY][j]);P.draw_text(d,(x+88,470),letter,26,P.WHITE,"bold","mm");P.draw_text(d,(x+88,570),label,19,P.INK,"bold","ma")
    if kind not in ("intro", "reports"):
        bullet_rows(d, seg["bullets"], 875)
    elif kind == "intro":
        bullet_rows(d, seg["bullets"], 825)
    return im.convert("RGB")


def speak(text, out_path):
    escaped = text.replace("'", "''")
    path = str(out_path).replace("'", "''")
    ps = f"Add-Type -AssemblyName System.Speech;$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;$s.SelectVoice('Microsoft Sabina Desktop');$s.Rate=0;$s.Volume=100;$s.SetOutputToWaveFile('{path}');$s.Speak('{escaped}');$s.Dispose()"
    enc = base64.b64encode(ps.encode("utf-16le")).decode("ascii")
    subprocess.run(["powershell.exe","-NoProfile","-EncodedCommand",enc],check=True,stdout=subprocess.DEVNULL)


def wav_duration(path):
    with wave.open(str(path),"rb") as wf:return wf.getnframes()/wf.getframerate()


def make_music():
    sr=48000;n=int(TARGET*sr);audio=np.zeros(n,dtype=np.float32);chords=[[261.63,329.63,392],[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66]]
    for bar in range(math.ceil(TARGET/2)):
        start=bar*2.0
        for j,fq in enumerate(chords[bar%4]):
            i0=int(start*sr);i1=min(n,int((start+1.9)*sr));tt=np.arange(i1-i0,dtype=np.float32)/sr;env=np.exp(-tt*(1.5+j*.2))*(1-np.exp(-tt*28));audio[i0:i1]+=(np.sin(2*np.pi*fq*tt)+.2*np.sin(4*np.pi*fq*tt))*env*.025
    fade=int(.8*sr);audio[:fade]*=np.linspace(0,1,fade);audio[-fade:]*=np.linspace(1,0,fade);pcm=(np.clip(audio,-.8,.8)*32767).astype(np.int16)
    with wave.open(str(MUSIC),"wb") as wf:wf.setnchannels(1);wf.setsampwidth(2);wf.setframerate(sr);wf.writeframes(pcm.tobytes())


def main():
    ff=imageio_ffmpeg.get_ffmpeg_exe();durations=[]
    for i,seg in enumerate(SEGMENTS,1):
        img=make_slide(seg,i);img.save(SLIDES/f"slide-{i:02d}.png",quality=95)
        speak(seg["narration"],AUDIO/f"voz-{i:02d}.wav");durations.append(wav_duration(AUDIO/f"voz-{i:02d}.wav"))
    gap=.28;tempo=sum(durations)/(TARGET-gap*len(SEGMENTS));part_paths=[]
    for i,dur in enumerate(durations,1):
        adjusted=dur/tempo+gap;part=PARTS/f"parte-{i:02d}.mp4";part_paths.append(part);fade_out=max(.1,adjusted-.25)
        vf=f"scale={W}:{H},zoompan=z='min(zoom+0.000035,1.018)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},fade=t=in:st=0:d=0.22,fade=t=out:st={fade_out:.3f}:d=0.22,format=yuv420p"
        af=f"atempo={tempo:.6f},apad=pad_dur={gap},volume=1.25"
        subprocess.run([ff,"-y","-loop","1","-i",str(SLIDES/f"slide-{i:02d}.png"),"-i",str(AUDIO/f"voz-{i:02d}.wav"),"-t",f"{adjusted:.6f}","-vf",vf,"-af",af,"-c:v","libx264","-preset","veryfast","-crf","19","-c:a","aac","-b:a","160k","-shortest",str(part)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    concat=OUT/"concat.txt";concat.write_text("".join(f"file '{str(p).replace(chr(92),'/')}'\n" for p in part_paths),encoding="utf-8")
    voice_video=OUT/"tutorial-con-voz.mp4"
    subprocess.run([ff,"-y","-f","concat","-safe","0","-i",str(concat),"-c","copy",str(voice_video)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    make_music()
    subprocess.run([ff,"-y","-i",str(voice_video),"-i",str(MUSIC),"-filter_complex","[0:a]volume=1.15[voice];[1:a]volume=.30[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2,loudnorm=I=-16:LRA=8:TP=-1.5[a]","-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k","-t",str(TARGET),"-movflags","+faststart",str(FINAL)],check=True)
    make_slide(SEGMENTS[0],1).resize((1080,1920),Image.Resampling.LANCZOS).save(POSTER,quality=95)
    thumbs=[Image.open(SLIDES/f"slide-{i:02d}.png").resize((180,320),Image.Resampling.LANCZOS) for i in range(1,len(SEGMENTS)+1)]
    board=Image.new("RGB",(180*7,320*2),"white")
    for i,thumb in enumerate(thumbs):board.paste(thumb,((i%7)*180,(i//7)*320))
    board.save(STORYBOARD,quality=92)
    print(f"duration_raw={sum(durations):.2f}s tempo={tempo:.4f}")
    print(FINAL)


if __name__=="__main__":main()
