from __future__ import annotations

import math
import os
import struct
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".video-deps"))

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 720, 1280
FPS = 24
DURATION = 20.0
FRAMES = int(FPS * DURATION)

INK = "#111315"
MUTED = "#687179"
PAPER = "#F7F7F4"
WHITE = "#FFFFFF"
BLUE = "#155BE8"
CYAN = "#0EA5E9"
TEAL = "#16BE8A"
GREEN = "#25D366"
NAVY = "#102C54"
LINE = "#E5E8EA"

OUT_DIR = ROOT / "artifacts" / "cadi-promo"
OUT_DIR.mkdir(parents=True, exist_ok=True)
SILENT_MP4 = OUT_DIR / "cadi-promocional-silent.mp4"
FINAL_MP4 = OUT_DIR / "cadi-promocional-vertical.mp4"
AUDIO_WAV = OUT_DIR / "cadi-promo-original.wav"
POSTER = OUT_DIR / "cadi-promocional-poster.png"

FONT_REG = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_SEMI = Path(r"C:\Windows\Fonts\seguisb.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")
LOGO_PATH = ROOT / "public" / "icons" / "icon-192.png"


def font(size: int, weight: str = "regular") -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if weight == "bold" else FONT_SEMI if weight == "semi" else FONT_REG
    return ImageFont.truetype(str(path), size)


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def ease(v: float) -> float:
    v = clamp(v)
    return 1 - pow(1 - v, 4)


def ease_in_out(v: float) -> float:
    v = clamp(v)
    return 0.5 - 0.5 * math.cos(math.pi * v)


def mix(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def scene_progress(t: float, start: float, end: float) -> float:
    return clamp((t - start) / (end - start))


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha


def draw_text(draw: ImageDraw.ImageDraw, xy, text: str, size: int, color=INK,
              weight="regular", anchor="la", spacing=4):
    draw.multiline_text(xy, text, font=font(size, weight), fill=color,
                        anchor=anchor, spacing=spacing)


def fit_text(draw: ImageDraw.ImageDraw, text: str, max_width: int, start_size: int,
             min_size: int = 18, weight: str = "bold") -> ImageFont.FreeTypeFont:
    for size in range(start_size, min_size - 1, -1):
        f = font(size, weight)
        if draw.textbbox((0, 0), text, font=f)[2] <= max_width:
            return f
    return font(min_size, weight)


def wrap(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, max_width: int) -> str:
    words, lines, current = text.split(), [], ""
    for word in words:
        attempt = word if not current else current + " " + word
        if draw.textbbox((0, 0), attempt, font=f)[2] <= max_width:
            current = attempt
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return "\n".join(lines)


def rounded_shadow(base: Image.Image, box, radius: int, fill: str,
                   shadow=(0, 16, 42, 34), shadow_color="#102C54"):
    x0, y0, x1, y1 = map(int, box)
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    sx, sy, blur, alpha = shadow
    d.rounded_rectangle((x0, y0 + sy, x1, y1 + sy), radius=radius,
                        fill=rgba(shadow_color, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(layer)
    ImageDraw.Draw(base).rounded_rectangle((x0, y0, x1, y1), radius=radius, fill=fill)


def brand(draw: ImageDraw.ImageDraw, y: int, alpha=255, centered=True):
    mark_x = 258 if centered else 44
    draw.rounded_rectangle((mark_x, y, mark_x + 50, y + 50), radius=12, fill=rgba(NAVY, alpha))
    draw.rectangle((mark_x + 12, y + 11, mark_x + 21, y + 20), fill=rgba(WHITE, alpha))
    draw.rectangle((mark_x + 28, y + 11, mark_x + 37, y + 20), fill=rgba(CYAN, alpha))
    draw.rectangle((mark_x + 12, y + 27, mark_x + 21, y + 36), fill=rgba(BLUE, alpha))
    draw.polygon([(mark_x + 28, y + 27), (mark_x + 39, y + 27), (mark_x + 39, y + 38)], fill=rgba(TEAL, alpha))
    draw_text(draw, (mark_x + 63, y + 25), "Catálogo Fácil", 27, rgba(INK, alpha), "bold", "lm")


def gradient_bg(top=PAPER, bottom="#EDF7F4") -> Image.Image:
    arr = np.zeros((H, W, 4), dtype=np.uint8)
    c1, c2 = np.array(rgba(top)), np.array(rgba(bottom))
    for y in range(H):
        p = y / max(1, H - 1)
        arr[y, :, :] = (c1 * (1 - p) + c2 * p).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def accent_blobs(im: Image.Image, t: float, strength=1.0):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    y1 = 160 + int(24 * math.sin(t * .7))
    y2 = 900 + int(30 * math.cos(t * .55))
    d.ellipse((-260, y1 - 250, 290, y1 + 300), fill=rgba(BLUE, int(25 * strength)))
    d.ellipse((430, y2 - 260, 980, y2 + 290), fill=rgba(TEAL, int(30 * strength)))
    im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(90)))


def phone_shell(im: Image.Image, x: float, y: float, scale: float = 1.0, screen="catalog"):
    pw, ph = int(398 * scale), int(780 * scale)
    x, y = int(x), int(y)
    rounded_shadow(im, (x, y, x + pw, y + ph), int(48 * scale), "#141719", (0, 18, 38, 42))
    d = ImageDraw.Draw(im)
    m = int(10 * scale)
    d.rounded_rectangle((x + m, y + m, x + pw - m, y + ph - m), radius=int(39 * scale), fill="#F8F8F5")
    d.rounded_rectangle((x + int(148 * scale), y + int(17 * scale), x + int(250 * scale), y + int(42 * scale)), radius=int(14 * scale), fill="#141719")
    sx, sy = x + int(24 * scale), y + int(64 * scale)
    sw = pw - int(48 * scale)
    if screen == "catalog":
        d.rounded_rectangle((sx, sy, sx + sw, sy + int(132 * scale)), radius=int(24 * scale), fill=NAVY)
        d.ellipse((sx + int(18 * scale), sy + int(22 * scale), sx + int(62 * scale), sy + int(66 * scale)), fill="#FF7A45")
        draw_text(d, (sx + int(40 * scale), sy + int(44 * scale)), "F", max(10, int(17 * scale)), WHITE, "bold", "mm")
        draw_text(d, (sx + int(76 * scale), sy + int(29 * scale)), "Ferretería El Toro", max(12, int(19 * scale)), WHITE, "semi")
        draw_text(d, (sx + int(76 * scale), sy + int(56 * scale)), "Torreón, Coah.", max(9, int(13 * scale)), "#C9D8E7")
        d.rounded_rectangle((sx, sy + int(150 * scale), sx + sw, sy + int(198 * scale)), radius=int(24 * scale), fill=WHITE)
        draw_text(d, (sx + int(20 * scale), sy + int(174 * scale)), "Buscar productos", max(9, int(13 * scale)), "#7A8288", anchor="lm")
        chips = [("Todo", BLUE), ("Herramientas", "#E8EEF8"), ("Hogar", "#E8EEF8")]
        cx = sx
        for text, col in chips:
            cw = int((62 + len(text) * 4) * scale)
            d.rounded_rectangle((cx, sy + int(216 * scale), cx + cw, sy + int(252 * scale)), radius=int(12 * scale), fill=col)
            draw_text(d, (cx + cw / 2, sy + int(234 * scale)), text, max(8, int(11 * scale)), WHITE if col == BLUE else NAVY, "semi", "mm")
            cx += cw + int(9 * scale)
        card_y = sy + int(272 * scale)
        card_w = int((sw - 12 * scale) / 2)
        for i, (name, price, color) in enumerate([("Martillo 16oz", "$189", "#E8EEF8"), ("Pintura", "$420", "#DDF5EC")]):
            cx = sx + i * (card_w + int(12 * scale))
            d.rounded_rectangle((cx, card_y, cx + card_w, card_y + int(234 * scale)), radius=int(18 * scale), fill=WHITE)
            d.rounded_rectangle((cx + int(10 * scale), card_y + int(10 * scale), cx + card_w - int(10 * scale), card_y + int(128 * scale)), radius=int(13 * scale), fill=color)
            if i == 0:
                d.rounded_rectangle((cx + int(48 * scale), card_y + int(42 * scale), cx + int(91 * scale), card_y + int(94 * scale)), radius=int(8 * scale), fill="#71839A")
                d.rectangle((cx + int(86 * scale), card_y + int(64 * scale), cx + int(125 * scale), card_y + int(72 * scale)), fill="#394957")
            else:
                d.ellipse((cx + int(50 * scale), card_y + int(35 * scale), cx + int(110 * scale), card_y + int(100 * scale)), fill="#63A890")
            draw_text(d, (cx + int(13 * scale), card_y + int(148 * scale)), name, max(9, int(13 * scale)), INK, "semi")
            draw_text(d, (cx + int(13 * scale), card_y + int(182 * scale)), price, max(11, int(17 * scale)), NAVY, "bold")
            d.rounded_rectangle((cx + int(12 * scale), card_y + int(204 * scale), cx + card_w - int(12 * scale), card_y + int(224 * scale)), radius=int(8 * scale), fill=TEAL)
        d.rounded_rectangle((sx, sy + int(530 * scale), sx + sw, sy + int(602 * scale)), radius=int(20 * scale), fill=GREEN)
        draw_text(d, (sx + sw / 2, sy + int(566 * scale)), "Pedir por WhatsApp", max(11, int(16 * scale)), WHITE, "bold", "mm")
    elif screen == "order":
        draw_text(d, (sx, sy + int(8 * scale)), "Tu pedido", max(17, int(27 * scale)), INK, "bold")
        draw_text(d, (sx, sy + int(49 * scale)), "Listo para enviar", max(10, int(14 * scale)), MUTED)
        for i, (name, qty, price) in enumerate([("Martillo 16oz", "2", "$378"), ("Cinta métrica", "1", "$95")]):
            yy = sy + int((100 + i * 112) * scale)
            d.rounded_rectangle((sx, yy, sx + sw, yy + int(92 * scale)), radius=int(18 * scale), fill=WHITE)
            d.rounded_rectangle((sx + int(12 * scale), yy + int(12 * scale), sx + int(78 * scale), yy + int(80 * scale)), radius=int(12 * scale), fill="#E8EEF8")
            draw_text(d, (sx + int(94 * scale), yy + int(28 * scale)), name, max(10, int(15 * scale)), INK, "semi")
            draw_text(d, (sx + int(94 * scale), yy + int(61 * scale)), "Cantidad " + qty, max(9, int(12 * scale)), MUTED)
            draw_text(d, (sx + sw - int(16 * scale), yy + int(46 * scale)), price, max(10, int(15 * scale)), NAVY, "bold", "rm")
        d.line((sx, sy + int(350 * scale), sx + sw, sy + int(350 * scale)), fill=LINE, width=max(1, int(2 * scale)))
        draw_text(d, (sx, sy + int(390 * scale)), "Total", max(12, int(18 * scale)), MUTED, "semi")
        draw_text(d, (sx + sw, sy + int(390 * scale)), "$473.00", max(18, int(28 * scale)), INK, "bold", "ra")
        d.rounded_rectangle((sx, sy + int(455 * scale), sx + sw, sy + int(531 * scale)), radius=int(20 * scale), fill=GREEN)
        draw_text(d, (sx + sw / 2, sy + int(493 * scale)), "Enviar por WhatsApp", max(11, int(16 * scale)), WHITE, "bold", "mm")


def scene_hook(t: float) -> Image.Image:
    im = gradient_bg(PAPER, "#EEF5FA"); accent_blobs(im, t, .8); d = ImageDraw.Draw(im)
    p = ease(scene_progress(t, 0, .7)); y = int(mix(120, 86, p)); brand(d, y, int(255 * p))
    q = ease(scene_progress(t, .35, 1.2));
    draw_text(d, (60, int(mix(420, 352, q))), "Tu negocio merece\nverse profesional.", 58, rgba(INK, int(255*q)), "bold", spacing=2)
    s = ease(scene_progress(t, 1.05, 1.7));
    draw_text(d, (60, int(mix(625, 590, s))), "No más productos perdidos\nentre mensajes y publicaciones.", 28, rgba(MUTED, int(255*s)), "regular", spacing=10)
    pill = ease(scene_progress(t, 1.5, 2.2));
    d.rounded_rectangle((60, int(mix(895, 850, pill)), 452, int(mix(967, 922, pill))), radius=20, fill=rgba(WHITE, int(255*pill)))
    draw_text(d, (86, int(mix(931, 886, pill))), "Todo en un solo enlace", 24, rgba(NAVY, int(255*pill)), "semi", "lm")
    d.line((60, 1115, 660, 1115), fill=rgba(NAVY, 30), width=2)
    draw_text(d, (60, 1160), "cadi.nessik.net", 21, NAVY, "semi")
    return im


def scene_catalog(t: float) -> Image.Image:
    im = gradient_bg("#F8F8F5", "#EEF8F4"); accent_blobs(im, t, 1); d = ImageDraw.Draw(im)
    p = ease(scene_progress(t, 2.6, 3.35));
    draw_text(d, (58, 92), "Tu catálogo\nen línea.", 61, rgba(INK, int(255*p)), "bold", spacing=1)
    draw_text(d, (60, 245), "Productos claros. Clientes decididos.", 24, rgba(MUTED, int(255*p)))
    px = mix(760, 176, p); phone_shell(im, px, 330, .92, "catalog")
    badges = [("Filtros", BLUE), ("Buscador", CYAN), ("Categorías", TEAL)]
    for i, (text, col) in enumerate(badges):
        bp = ease(scene_progress(t, 3.6 + i*.16, 4.25 + i*.16)); x = 54 + i*205
        d.rounded_rectangle((x, 1138, x+180, 1196), radius=15, fill=rgba(col, int(255*bp)))
        draw_text(d, (x+90, 1167), text, 18, rgba(WHITE, int(255*bp)), "semi", "mm")
    return im


def scene_order(t: float) -> Image.Image:
    im = gradient_bg("#F6F8F7", "#EBF8F0"); accent_blobs(im, t, .65); d = ImageDraw.Draw(im)
    p = ease(scene_progress(t, 6.0, 6.75));
    draw_text(d, (58, 86), "El cliente elige.", 49, rgba(INK, int(255*p)), "bold")
    draw_text(d, (58, 151), "El pedido llega ordenado.", 29, rgba(TEAL, int(255*p)), "semi")
    phone_shell(im, mix(-430, 162, p), 255, .99, "order")
    bubble = ease(scene_progress(t, 7.4, 8.1)); by = int(mix(1160, 1064, bubble))
    rounded_shadow(im, (70, by, 650, by+108), 24, WHITE, (0, 10, 25, 26), NAVY)
    d = ImageDraw.Draw(im)
    d.ellipse((92, by+24, 150, by+82), fill=GREEN)
    draw_text(d, (121, by+53), "✓", 25, WHITE, "bold", "mm")
    draw_text(d, (172, by+34), "Pedido listo para WhatsApp", 21, INK, "bold")
    draw_text(d, (172, by+70), "$473.00 confirmado", 18, TEAL, "semi")
    return im


def scene_metrics(t: float) -> Image.Image:
    im = Image.new("RGBA", (W, H), NAVY); d = ImageDraw.Draw(im)
    p = ease(scene_progress(t, 9.3, 10));
    draw_text(d, (58, 90), "Conoce tu negocio.", 52, rgba(WHITE, int(255*p)), "bold")
    draw_text(d, (58, 160), "Deja de adivinar. Mira tus números.", 24, rgba("#C9D8E7", int(255*p)))
    cards=[("127","visitas"),("34","pidieron"),("27%","convierten")]
    for i,(num,label) in enumerate(cards):
        cp=ease(scene_progress(t,9.8+i*.15,10.55+i*.15)); x=50+i*214
        d.rounded_rectangle((x,300,x+194,500),radius=28,fill=rgba(WHITE,int(245*cp)))
        draw_text(d,(x+24,350),num,48,rgba(INK,int(255*cp)),"bold")
        draw_text(d,(x+24,425),label,19,rgba(MUTED,int(255*cp)),"semi")
    chart_p=ease(scene_progress(t,10.55,11.4)); rounded_shadow(im,(50,560,670,1005),28,"#16375F",(0,0,0,0))
    d=ImageDraw.Draw(im);draw_text(d,(80,606),"Ventas esta semana",20,"#C9D8E7","semi")
    draw_text(d,(80,654),"$8,540",54,WHITE,"bold")
    pts=[(84,902),(166,850),(250,868),(334,760),(418,790),(502,674),(628,626)]
    base_y=925
    for x,_ in pts:d.line((x,base_y,x,base_y-8),fill="#56708B",width=2)
    shown=max(2,int(2+(len(pts)-2)*chart_p)); d.line(pts[:shown],fill=TEAL,width=9,joint="curve")
    for x,y in pts[:shown]:d.ellipse((x-8,y-8,x+8,y+8),fill=TEAL)
    draw_text(d,(58,1130),"Reporte de ventas en Excel",22,"#D8E5EF","semi")
    return im


def scene_features(t: float) -> Image.Image:
    im=gradient_bg(PAPER,"#EFF7F4");accent_blobs(im,t,.7);d=ImageDraw.Draw(im)
    p=ease(scene_progress(t,12.2,12.85));draw_text(d,(58,86),"Todo lo que necesitas\npara vender mejor.",50,rgba(INK,int(255*p)),"bold",spacing=3)
    features=[("01","Filtros por categoría",BLUE),("02","Pedidos por WhatsApp",TEAL),("03","Reporte Excel",NAVY),("04","Dominio propio",CYAN)]
    for i,(n,label,col) in enumerate(features):
        fp=ease(scene_progress(t,12.7+i*.22,13.35+i*.22));y=330+i*165;x=int(mix(760,54,fp))
        rounded_shadow(im,(x,y,x+612,y+125),24,WHITE,(0,8,25,20),NAVY);d=ImageDraw.Draw(im)
        d.rounded_rectangle((x+18,y+18,x+107,y+107),radius=20,fill=rgba(col,245))
        draw_text(d,(x+62,y+62),n,20,WHITE,"bold","mm");draw_text(d,(x+137,y+63),label,25,INK,"semi","lm")
    return im


def scene_cta(t: float) -> Image.Image:
    im=gradient_bg("#F8F8F5","#E9F8F2");accent_blobs(im,t,1.1);d=ImageDraw.Draw(im)
    p=ease(scene_progress(t,15.8,16.6)); brand(d,90,int(255*p))
    draw_text(d,(360,int(mix(520,440,p))),"Tu negocio merece\nverse profesional.",54,rgba(INK,int(255*p)),"bold","ma",spacing=3)
    s=ease(scene_progress(t,16.45,17.15));draw_text(d,(360,625),"Crea tu catálogo y recibe\ntus pedidos por WhatsApp.",27,rgba(MUTED,int(255*s)),"regular","ma",spacing=8)
    b=ease(scene_progress(t,17.05,17.8));bw=int(mix(160,590,b));x0=(W-bw)//2
    d.rounded_rectangle((x0,790,x0+bw,884),radius=25,fill=rgba(INK,int(255*b)))
    draw_text(d,(360,837),"Registra tu tienda gratis",25,rgba(WHITE,int(255*b)),"bold","mm")
    draw_text(d,(360,956),"cadi.nessik.net",31,rgba(NAVY,int(255*s)),"bold","ma")
    draw_text(d,(360,1011),"Sin tarjeta · Sin módulos extra",18,rgba(MUTED,int(255*s)),"semi","ma")
    d.rounded_rectangle((238,1100,482,1146),radius=14,fill=rgba("#DDF5EC",int(255*s)))
    draw_text(d,(360,1123),"HECHO POR NESSIK.NET",14,rgba(TEAL,int(255*s)),"bold","mm")
    return im


SCENES=[(0,2.7,scene_hook),(2.7,6.0,scene_catalog),(6.0,9.3,scene_order),(9.3,12.2,scene_metrics),(12.2,15.8,scene_features),(15.8,20.0,scene_cta)]


def render_frame(t: float) -> Image.Image:
    for start,end,fn in SCENES:
        if start<=t<end or (t>=DURATION and end==DURATION):
            im=fn(t)
            fade=0.28
            if start>0 and t<start+fade:
                prev=SCENES[SCENES.index((start,end,fn))-1][2](start-.001)
                im=Image.blend(prev,im,ease_in_out((t-start)/fade))
            return im.convert("RGB")
    return scene_cta(t).convert("RGB")


def make_audio():
    sr=48000;n=int(DURATION*sr);audio=np.zeros(n,dtype=np.float64)
    chords=[[261.63,329.63,392.00],[220.00,261.63,329.63],[174.61,220.00,261.63],[196.00,246.94,293.66]]
    for bar in range(10):
        start=bar*2.0;chord=chords[bar%4]
        for note_i,freq in enumerate(chord):
            idx0=int(start*sr);idx1=min(n,int((start+1.85)*sr));tt=np.arange(idx1-idx0)/sr
            env=np.exp(-tt*(1.5+note_i*.25))*(1-np.exp(-tt*35))
            tone=np.sin(2*np.pi*freq*tt)+.28*np.sin(2*np.pi*freq*2*tt)
            audio[idx0:idx1]+=tone*env*.055
        for beat in range(4):
            bs=start+beat*.5;idx0=int(bs*sr);idx1=min(n,idx0+int(.16*sr));tt=np.arange(idx1-idx0)/sr
            kick=np.sin(2*np.pi*(74-34*tt/.16)*tt)*np.exp(-tt*30)
            audio[idx0:idx1]+=kick*.10
        if bar%2==1:
            bs=start+1.48;idx0=int(bs*sr);idx1=min(n,idx0+int(.2*sr));tt=np.arange(idx1-idx0)/sr
            noise=np.random.default_rng(bar).normal(0,1,len(tt))*np.exp(-tt*28)
            audio[idx0:idx1]+=noise*.025
    fade_len=int(.8*sr);audio[:fade_len]*=np.linspace(0,1,fade_len);audio[-fade_len:]*=np.linspace(1,0,fade_len)
    audio=np.clip(audio,-.9,.9);pcm=(audio*32767).astype(np.int16)
    with wave.open(str(AUDIO_WAV),"wb") as wf:
        wf.setnchannels(1);wf.setsampwidth(2);wf.setframerate(sr);wf.writeframes(pcm.tobytes())


def make_video():
    writer=imageio_ffmpeg.write_frames(str(SILENT_MP4),(W,H),fps=FPS,codec="libx264",quality=8,
                                       output_params=["-pix_fmt","yuv420p","-movflags","+faststart"])
    writer.send(None)
    poster=None
    for i in range(FRAMES):
        frame=render_frame(i/FPS)
        if i==int(16.9*FPS):poster=frame.copy()
        writer.send(np.asarray(frame).tobytes())
    writer.close()
    (poster or render_frame(17)).save(POSTER,quality=95)


def mux():
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ffmpeg,"-y","-i",str(SILENT_MP4),"-i",str(AUDIO_WAV),"-c:v","copy","-c:a","aac","-b:a","160k","-shortest","-movflags","+faststart",str(FINAL_MP4)],check=True)


if __name__=="__main__":
    make_audio();make_video();mux()
    print(FINAL_MP4)
