from pathlib import Path
import math
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".video-deps"))
import imageio_ffmpeg

W, H, FPS = 1080, 1920, 30
OUT = ROOT / "artifacts" / "cadi-status-promo"
CAP = ROOT / "artifacts" / "cadi-tutorial-real" / "capturas"
SLIDES = OUT / "slides"
PARTS = OUT / "partes"
for folder in (OUT, SLIDES, PARTS):
    folder.mkdir(parents=True, exist_ok=True)

FINAL = OUT / "catalogo-facil-estado-whatsapp-30s.mp4"
POSTER = OUT / "catalogo-facil-estado-whatsapp-poster.png"
STORYBOARD = OUT / "catalogo-facil-estado-whatsapp-storyboard.png"
MUSIC = OUT / "musica-promo-original.wav"
HARDWARE_SHEET = OUT / "assets" / "ferreteria-productos-2x2.png"

SCENES = [
    ("¿Sigues enviando fotos\nuna por una?", "Hay una forma más fácil.", "16-catalogo-movil.png", "hook"),
    ("Crea tu catálogo\ndigital", "Productos, precios y ofertas en un solo enlace.", "14-catalogo-publico.png", "catalog"),
    ("Administra todo\ndesde tu panel", "Productos · inventario · promociones", "06-productos.png", "panel"),
    ("Recibe pedidos\nordenados", "Tus clientes eligen y te escriben por WhatsApp.", "05-pedidos-recientes.png", "orders"),
    ("Conoce lo que\nmás se vende", "Visitas, clientes y resultados claros.", "03-panel-resumen.png", "metrics"),
    ("Tu negocio.\nUn solo enlace.", "Crea tu tienda en\ncadi.nessik.net", "17-compra-movil.png", "cta"),
]


def font(size, bold=False):
    p = Path(r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf")
    return ImageFont.truetype(str(p), size)


def fit(im, box):
    x0, y0, x1, y1 = box
    scale = min((x1-x0)/im.width, (y1-y0)/im.height)
    size = (int(im.width*scale), int(im.height*scale))
    out = im.resize(size, Image.Resampling.LANCZOS)
    return out, (x0+(x1-x0-size[0])//2, y0+(y1-y0-size[1])//2)


def hardware_photos():
    sheet = Image.open(HARDWARE_SHEET).convert("RGB")
    w, h = sheet.size
    pad = max(3, w//250)
    return [
        sheet.crop((0, 0, w//2-pad, h//2-pad)),
        sheet.crop((w//2+pad, 0, w, h//2-pad)),
        sheet.crop((0, h//2+pad, w//2-pad, h)),
        sheet.crop((w//2+pad, h//2+pad, w, h)),
    ]


def replace_empty_product_photos(source, filename):
    photos = hardware_photos()
    boxes = {
        "06-productos.png": [
            (272,254,520,395), (532,254,780,395), (792,254,1040,395),
            (272,530,520,671), (532,530,780,671), (792,530,1040,671),
        ],
        "14-catalogo-publico.png": [
            (476,494,687,656), (711,494,920,656),
            (944,494,1156,656), (1179,494,1390,656),
        ],
        "16-catalogo-movil.png": [(24,704,210,843), (350,339,430,457)],
        "17-compra-movil.png": [(25,517,210,656), (25,943,210,1081)],
    }.get(filename, [])
    for i, box in enumerate(boxes):
        x0, y0, x1, y1 = box
        photo = ImageOps.fit(photos[i % len(photos)], (x1-x0, y1-y0), method=Image.Resampling.LANCZOS)
        source.paste(photo, (x0, y0))
    return source


def slide(scene, i):
    title, subtitle, filename, kind = scene
    source = Image.open(CAP/filename).convert("RGB")
    source = replace_empty_product_photos(source, filename)
    bg = source.resize((W, H), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(42)).convert("RGBA")
    bg = Image.alpha_composite(bg, Image.new("RGBA", (W, H), (4, 24, 40, 205)))
    d = ImageDraw.Draw(bg)
    d.ellipse((-180, -220, 500, 460), fill=(25, 195, 150, 45))
    d.ellipse((740, 1450, 1280, 2050), fill=(75, 126, 255, 38))
    d.rounded_rectangle((64, 60, 360, 120), radius=22, fill=(28, 197, 150))
    d.text((212, 90), "CATÁLOGO FÁCIL", font=font(25, True), fill="white", anchor="mm")
    d.text((1016, 88), f"0{i+1}/06", font=font(22, True), fill=(199, 221, 228), anchor="rm")

    tf = font(78 if kind != "cta" else 88, True)
    d.multiline_text((72, 190), title, font=tf, fill="white", spacing=4)
    sf = font(33, False)
    d.multiline_text((76, 410 if title.count("\n") else 325), subtitle, font=sf, fill=(202, 224, 229), spacing=8)

    card = (58, 580, 1022, 1610)
    panel_size = (card[2]-card[0], card[3]-card[1])
    panel = ImageOps.fit(source, panel_size, method=Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(30)).convert("RGBA")
    panel = Image.alpha_composite(panel, Image.new("RGBA", panel_size, (5, 28, 43, 178)))
    mask = Image.new("L", panel_size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, panel_size[0]-1, panel_size[1]-1), radius=42, fill=255)
    bg.paste(panel, (card[0], card[1]), mask)
    d = ImageDraw.Draw(bg)
    d.rounded_rectangle(card, radius=42, outline=(82, 224, 183, 150), width=3)
    inner = (82, 604, 998, 1586)
    visual, pos = fit(source, inner)
    shadow_pad = 16
    d.rounded_rectangle((pos[0]-shadow_pad, pos[1]-shadow_pad, pos[0]+visual.width+shadow_pad, pos[1]+visual.height+shadow_pad), radius=28, fill=(3, 18, 29, 150))
    bg.alpha_composite(visual.convert("RGBA"), dest=pos)

    d = ImageDraw.Draw(bg)
    if kind == "cta":
        d.rounded_rectangle((110, 1665, 970, 1780), radius=38, fill=(28, 197, 150))
        d.text((540, 1722), "CREA TU CATÁLOGO", font=font(39, True), fill="white", anchor="mm")
        d.text((540, 1840), "cadi.nessik.net", font=font(39, True), fill="white", anchor="mm")
    else:
        d.rounded_rectangle((72, 1700, 1008, 1713), radius=6, fill=(65, 89, 103))
        d.rounded_rectangle((72, 1700, 72+int(936*(i+1)/len(SCENES)), 1713), radius=6, fill=(28, 197, 150))
        d.text((72, 1790), "Catálogo digital + pedidos por WhatsApp", font=font(31, True), fill="white")
    return bg.convert("RGB")


def music():
    sr, seconds = 48000, 30
    n = sr*seconds
    audio = np.zeros(n, np.float32)
    chords = [[261.63,329.63,392.0],[220,277.18,329.63],[196,246.94,293.66],[233.08,293.66,349.23]]
    for beat in range(seconds*2):
        start = beat*.5
        chord = chords[(beat//4)%4]
        a, b = int(start*sr), min(n, int((start+.46)*sr))
        t = np.arange(b-a, dtype=np.float32)/sr
        env = np.exp(-t*7.5)*(1-np.exp(-t*80))
        for fq in chord:
            audio[a:b] += np.sin(2*np.pi*fq*t)*env*.035
        if beat % 2 == 0:
            audio[a:b] += np.sin(2*np.pi*(85-45*t)*t)*np.exp(-t*18)*.09
    for k in range(seconds*4):
        a = int((k*.25)*sr); b = min(n, a+int(.06*sr));
        if b>a:
            rng = np.random.default_rng(k)
            audio[a:b] += rng.normal(0, .012, b-a)*np.linspace(1,0,b-a)
    fade = int(.5*sr)
    audio[:fade] *= np.linspace(0,1,fade); audio[-fade:] *= np.linspace(1,0,fade)
    pcm = (np.clip(audio,-.9,.9)*32767).astype(np.int16)
    with wave.open(str(MUSIC), "wb") as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(sr); wav.writeframes(pcm.tobytes())


def main():
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    parts = []
    for i, scene in enumerate(SCENES):
        img = slide(scene, i)
        src = SLIDES/f"slide-{i+1:02d}.png"
        part = PARTS/f"parte-{i+1:02d}.mp4"
        img.save(src, quality=96)
        z = "min(zoom+0.00012,1.035)" if i%2==0 else "if(eq(on,1),1.035,max(zoom-0.00012,1.0))"
        vf = (f"scale={W}:{H},zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
              f"d=1:s={W}x{H}:fps={FPS},fade=t=in:st=0:d=0.25,fade=t=out:st=4.7:d=0.3,format=yuv420p")
        subprocess.run([ff,"-y","-loop","1","-i",str(src),"-t","5","-vf",vf,"-an","-c:v","libx264","-preset","veryfast","-crf","19",str(part)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        parts.append(part)
    concat = OUT/"concat.txt"
    concat.write_text("".join(f"file '{str(p).replace(chr(92), '/')}'\n" for p in parts),encoding="utf-8")
    silent = OUT/"promo-sin-audio.mp4"
    subprocess.run([ff,"-y","-f","concat","-safe","0","-i",str(concat),"-c","copy",str(silent)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    music()
    subprocess.run([ff,"-y","-i",str(silent),"-i",str(MUSIC),"-map","0:v","-map","1:a","-c:v","copy","-c:a","aac","-b:a","192k","-shortest","-movflags","+faststart",str(FINAL)],check=True)
    slide(SCENES[-1],5).save(POSTER,quality=96)
    thumbs=[Image.open(SLIDES/f"slide-{i:02d}.png").resize((216,384),Image.Resampling.LANCZOS) for i in range(1,7)]
    board=Image.new("RGB",(216*6,384),"white")
    for i,thumb in enumerate(thumbs): board.paste(thumb,(i*216,0))
    board.save(STORYBOARD,quality=92)
    print(FINAL)


if __name__ == "__main__":
    main()
