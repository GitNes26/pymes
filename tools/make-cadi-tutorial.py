from __future__ import annotations

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

W, H, FPS, DURATION = 720, 1280, 24, 30.0
OUT = ROOT / "artifacts" / "cadi-tutorial"
OUT.mkdir(parents=True, exist_ok=True)
SILENT = OUT / "cadi-tutorial-silent.mp4"
AUDIO = OUT / "cadi-tutorial-audio-original.wav"
FINAL_720 = OUT / "cadi-tutorial-vertical.mp4"
FINAL = OUT / "cadi-tutorial-vertical-1080x1920.mp4"
POSTER = OUT / "cadi-tutorial-poster.png"


def e(v): return P.ease(v)
def pr(t, a, b): return P.scene_progress(t, a, b)
def alpha(color, a): return P.rgba(color, max(0, min(255, int(a))))


def base(t, dark=False):
    if dark:
        return Image.new("RGBA", (W, H), P.NAVY)
    im = P.gradient_bg(P.PAPER, "#EDF8F4")
    P.accent_blobs(im, t, .7)
    return im


def step_header(d, step, title, subtitle=""):
    d.rounded_rectangle((42, 44, 152, 84), radius=12, fill=P.NAVY)
    P.draw_text(d, (97, 64), f"PASO {step}", 15, P.WHITE, "bold", "mm")
    P.draw_text(d, (42, 126), title, 44, P.INK, "bold", spacing=2)
    if subtitle:
        P.draw_text(d, (44, 240), subtitle, 21, P.MUTED, "regular", spacing=6)
    for i in range(1, 6):
        x = 42 + (i - 1) * 131
        d.rounded_rectangle((x, 1138, x + 108, 1146), radius=4,
                            fill=P.TEAL if i <= step else "#D8DEDF")


def pointer(d, x, y, pulse):
    r = int(22 + 10 * math.sin(pulse * math.pi))
    d.ellipse((x-r, y-r, x+r, y+r), outline=alpha(P.BLUE, 100), width=4)
    d.ellipse((x-10, y-10, x+10, y+10), fill=P.BLUE, outline=P.WHITE, width=3)


def field(d, box, label, value, focused=False, check=False):
    x0, y0, x1, y1 = box
    P.draw_text(d, (x0, y0-24), label, 14, P.INK, "semi")
    d.rounded_rectangle(box, radius=16, fill=P.WHITE,
                        outline=P.BLUE if focused else P.LINE, width=3 if focused else 2)
    P.draw_text(d, (x0+18, (y0+y1)//2), value, 18, P.INK if value else "#899196", "regular", "lm")
    if check:
        d.ellipse((x1-48, y0+14, x1-16, y0+46), fill=P.TEAL)
        P.draw_text(d, (x1-32, y0+30), "✓", 17, P.WHITE, "bold", "mm")


def scene_intro(t):
    im = base(t); d = ImageDraw.Draw(im)
    p = e(pr(t, 0, .7)); P.brand(d, 78, int(255*p))
    y = int(P.mix(520, 400, p))
    P.draw_text(d, (360, y), "Crea tu catálogo\nen 5 pasos.", 61, alpha(P.INK, 255*p), "bold", "ma", spacing=3)
    q = e(pr(t, .8, 1.5))
    P.draw_text(d, (360, 590), "Desde cero hasta tu primer\npedido por WhatsApp.", 27, alpha(P.MUTED, 255*q), "regular", "ma", spacing=8)
    b = e(pr(t, 1.45, 2.2))
    d.rounded_rectangle((100, 780, 620, 866), radius=24, fill=alpha(P.INK, 255*b))
    P.draw_text(d, (360, 823), "Guía rápida para tu negocio", 23, alpha(P.WHITE, 255*b), "bold", "mm")
    P.draw_text(d, (360, 1080), "cadi.nessik.net", 22, P.NAVY, "semi", "ma")
    return im


def scene_register(t):
    im = base(t); d = ImageDraw.Draw(im); step_header(d, 1, "Registra tu tienda.", "Escribe lo esencial. Verás tu tienda tomar forma.")
    p = e(pr(t, 2.6, 3.25)); x = int(P.mix(760, 52, p))
    P.rounded_shadow(im, (x, 330, x+616, 1030), 30, P.WHITE, (0, 14, 34, 28), P.NAVY); d = ImageDraw.Draw(im)
    P.draw_text(d, (x+28, 370), "Dale vida a tu tienda", 29, P.INK, "bold")
    P.draw_text(d, (x+28, 413), "La vista previa cambia mientras escribes.", 16, P.MUTED)
    name_p=e(pr(t,3.4,4.05)); phone_p=e(pr(t,4.2,4.85)); pin_p=e(pr(t,5.0,5.55))
    name="Panadería La Esperanza"[:int(23*name_p)]
    phone="8711234567"[:int(10*phone_p)]
    pin="••••••"[:int(6*pin_p)]
    field(d,(x+28,500,x+588,570),"NOMBRE DEL NEGOCIO",name,0<name_p<1,name_p>=1)
    field(d,(x+28,650,x+588,720),"WHATSAPP DE VENTAS",phone,0<phone_p<1,phone_p>=1)
    field(d,(x+28,800,x+588,870),"PIN DE ACCESO",pin,0<pin_p<1,pin_p>=1)
    ready=e(pr(t,5.4,6.1));d.rounded_rectangle((x+28,925,x+588,989),radius=18,fill=alpha(P.INK,255*ready))
    P.draw_text(d,(x+308,957),"Crear mi tienda",20,alpha(P.WHITE,255*ready),"bold","mm")
    active=[(x+300,535,name_p),(x+300,685,phone_p),(x+300,835,pin_p)]
    for ax,ay,ap in active:
        if 0<ap<1:pointer(d,ax,ay,ap)
    return im


def option_card(d, box, title, sub, color, selected=False):
    x0,y0,x1,y1=box
    d.rounded_rectangle(box,radius=20,fill=P.WHITE,outline=P.BLUE if selected else P.LINE,width=4 if selected else 2)
    d.rounded_rectangle((x0+18,y0+18,x0+72,y0+72),radius=14,fill=color)
    P.draw_text(d,(x0+88,y0+30),title,19,P.INK,"bold")
    P.draw_text(d,(x0+88,y0+62),sub,14,P.MUTED)
    if selected:
        d.ellipse((x1-48,y0+23,x1-18,y0+53),fill=P.BLUE)
        P.draw_text(d,(x1-33,y0+38),"✓",16,P.WHITE,"bold","mm")


def scene_personalize(t):
    im=base(t);d=ImageDraw.Draw(im);step_header(d,2,"Elige tu giro\ny tu estilo.","Cadi prepara categorías y diseño para tu negocio.")
    p=e(pr(t,6.4,7.0)); y=int(P.mix(1180,370,p))
    selected=pr(t,7.4,8.2)>=.55
    option_card(d,(54,y,666,y+112),"Panadería","Pan y repostería","#F3A04B",selected)
    option_card(d,(54,y+132,666,y+244),"Boutique","Ropa y accesorios","#B57BEA",False)
    option_card(d,(54,y+264,666,y+376),"Ferretería","Herramientas y hogar","#6C8399",False)
    if 0<pr(t,7.4,8.2)<1:pointer(d,610,y+56,pr(t,7.4,8.2))
    q=e(pr(t,8.4,9.05));P.draw_text(d,(54,805),"Ahora elige la vibra",25,alpha(P.INK,255*q),"bold")
    colors=[("Moderno",P.BLUE),("Cálido","#D9784D"),("Natural",P.TEAL)]
    for i,(label,col) in enumerate(colors):
        x=54+i*204; sel=i==2 and pr(t,9.2,10.0)>.5
        d.rounded_rectangle((x,860,x+182,982),radius=20,fill=P.WHITE,outline=P.BLUE if sel else P.LINE,width=4 if sel else 2)
        d.ellipse((x+59,882,x+123,946),fill=col);P.draw_text(d,(x+91,965),label,15,P.INK,"semi","ma")
    sp=pr(t,9.2,10.0)
    if 0<sp<1:pointer(d,553,913,sp)
    return im


def scene_product(t):
    im=base(t);d=ImageDraw.Draw(im);step_header(d,3,"Agrega tu primer\nproducto.","Foto, nombre y precio. Eso es todo para comenzar.")
    p=e(pr(t,10.4,11.1));x=int(P.mix(-650,52,p))
    P.rounded_shadow(im,(x,338,x+616,1050),30,P.WHITE,(0,14,34,28),P.NAVY);d=ImageDraw.Draw(im)
    d.rounded_rectangle((x+28,372,x+588,610),radius=24,fill="#E7F0F7",outline=P.LINE,width=2)
    d.rounded_rectangle((x+230,435,x+386,548),radius=20,fill="#73869A")
    d.rectangle((x+374,478,x+460,494),fill="#354759")
    P.draw_text(d,(x+308,582),"Toca para subir una foto",15,P.MUTED,"semi","ma")
    name_p=e(pr(t,11.6,12.2));price_p=e(pr(t,12.25,12.8))
    field(d,(x+28,675,x+588,745),"NOMBRE","Martillo de uña 16oz"[:int(21*name_p)],0<name_p<1,name_p>=1)
    field(d,(x+28,825,x+588,895),"PRECIO","$189.00"[:int(7*price_p)],0<price_p<1,price_p>=1)
    save=e(pr(t,13.0,13.65));d.rounded_rectangle((x+28,946,x+588,1010),radius=18,fill=alpha(P.INK,255*save))
    P.draw_text(d,(x+308,978),"Guardar producto",20,alpha(P.WHITE,255*save),"bold","mm")
    if 0<save<1:pointer(d,x+308,978,save)
    return im


def scene_share(t):
    im=base(t);d=ImageDraw.Draw(im);step_header(d,4,"Comparte tu enlace.","Envíalo por WhatsApp, redes o colócalo en tu negocio.")
    p=e(pr(t,14.2,14.9));P.phone_shell(im,P.mix(760,161,p),300,.99,"catalog");d=ImageDraw.Draw(im)
    link=e(pr(t,15.4,16.1));ly=int(P.mix(1120,1015,link))
    P.rounded_shadow(im,(58,ly,662,ly+102),24,P.WHITE,(0,10,26,25),P.NAVY);d=ImageDraw.Draw(im)
    P.draw_text(d,(88,ly+31),"Tu enlace está listo",16,P.MUTED,"semi")
    P.draw_text(d,(88,ly+70),"cadi.nessik.net/panaderia-esperanza",19,P.NAVY,"bold")
    d.rounded_rectangle((568,ly+24,638,ly+78),radius=15,fill=P.BLUE);P.draw_text(d,(603,ly+51),"✓",22,P.WHITE,"bold","mm")
    return im


def scene_order(t):
    im=base(t);d=ImageDraw.Draw(im);step_header(d,5,"Recibe el pedido\npor WhatsApp.","El cliente elige y tú recibes productos, cantidades y total.")
    p=e(pr(t,18.3,19.0));P.phone_shell(im,P.mix(-430,161,p),300,.99,"order");d=ImageDraw.Draw(im)
    bubble=e(pr(t,20.0,20.8));y=int(P.mix(1170,1035,bubble))
    P.rounded_shadow(im,(66,y,654,y+105),24,P.WHITE,(0,10,28,27),P.NAVY);d=ImageDraw.Draw(im)
    d.ellipse((88,y+23,148,y+83),fill=P.GREEN);P.draw_text(d,(118,y+53),"✓",25,P.WHITE,"bold","mm")
    P.draw_text(d,(170,y+34),"Pedido registrado",22,P.INK,"bold")
    P.draw_text(d,(170,y+72),"$473.00 confirmado",18,P.TEAL,"semi")
    return im


def scene_finish(t):
    im=base(t);d=ImageDraw.Draw(im);p=e(pr(t,22.4,23.1));P.brand(d,80,int(255*p))
    P.draw_text(d,(360,int(P.mix(500,390,p))),"Listo.\nYa puedes vender.",61,alpha(P.INK,255*p),"bold","ma",spacing=3)
    q=e(pr(t,23.3,24.0));P.draw_text(d,(360,590),"Tu catálogo trabaja contigo:\nproductos, pedidos y reportes.",27,alpha(P.MUTED,255*q),"regular","ma",spacing=8)
    items=["1. Registra","2. Personaliza","3. Publica","4. Comparte","5. Recibe pedidos"]
    for i,text in enumerate(items):
        ip=e(pr(t,24.0+i*.18,24.7+i*.18));x=60+(i%2)*310;y=730+(i//2)*74
        d.rounded_rectangle((x,y,x+285,y+54),radius=15,fill=alpha(P.WHITE,245*ip))
        P.draw_text(d,(x+18,y+27),text,17,alpha(P.NAVY,255*ip),"semi","lm")
    b=e(pr(t,25.6,26.4));d.rounded_rectangle((65,1000,655,1090),radius=25,fill=alpha(P.INK,255*b))
    P.draw_text(d,(360,1045),"Crea tu tienda gratis",25,alpha(P.WHITE,255*b),"bold","mm")
    P.draw_text(d,(360,1165),"cadi.nessik.net",28,alpha(P.NAVY,255*b),"bold","ma")
    return im


SCENES=[(0,2.6,scene_intro),(2.6,6.4,scene_register),(6.4,10.4,scene_personalize),(10.4,14.2,scene_product),(14.2,18.3,scene_share),(18.3,22.4,scene_order),(22.4,30.0,scene_finish)]


def frame(t):
    for idx,(a,b,fn) in enumerate(SCENES):
        if a<=t<b:
            im=fn(t)
            if idx and t<a+.3:
                prev=SCENES[idx-1][2](a-.001)
                im=Image.blend(prev,im,P.ease_in_out((t-a)/.3))
            return im.convert("RGB")
    return scene_finish(t).convert("RGB")


def audio():
    sr=48000;n=int(DURATION*sr);a=np.zeros(n);chords=[[261.63,329.63,392],[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66]]
    for bar in range(math.ceil(DURATION/2)):
        st=bar*2.0
        for j,fq in enumerate(chords[bar%4]):
            i0=int(st*sr);i1=min(n,int((st+1.85)*sr));tt=np.arange(i1-i0)/sr;env=np.exp(-tt*(1.4+j*.2))*(1-np.exp(-tt*30))
            a[i0:i1]+=(np.sin(2*np.pi*fq*tt)+.22*np.sin(4*np.pi*fq*tt))*env*.07
        for beat in range(4):
            i0=int((st+beat*.5)*sr);i1=min(n,i0+int(.14*sr));tt=np.arange(i1-i0)/sr
            a[i0:i1]+=np.sin(2*np.pi*(70-30*tt/.14)*tt)*np.exp(-tt*32)*.10
    fade=int(.7*sr);a[:fade]*=np.linspace(0,1,fade);a[-fade:]*=np.linspace(1,0,fade);pcm=(np.clip(a,-.9,.9)*32767).astype(np.int16)
    with wave.open(str(AUDIO),"wb") as wf:wf.setnchannels(1);wf.setsampwidth(2);wf.setframerate(sr);wf.writeframes(pcm.tobytes())


def render():
    wr=imageio_ffmpeg.write_frames(str(SILENT),(W,H),fps=FPS,codec="libx264",quality=8,output_params=["-pix_fmt","yuv420p","-movflags","+faststart"]);wr.send(None)
    poster=None
    for i in range(int(DURATION*FPS)):
        im=frame(i/FPS)
        if i==int(22.9*FPS):poster=im.copy()
        wr.send(np.asarray(im).tobytes())
    wr.close();(poster or frame(23)).save(POSTER,quality=95)


def finish():
    ff=imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ff,"-y","-i",str(SILENT),"-i",str(AUDIO),"-c:v","copy","-af","volume=3.0","-c:a","aac","-b:a","160k","-shortest","-movflags","+faststart",str(FINAL_720)],check=True)
    subprocess.run([ff,"-y","-i",str(FINAL_720),"-vf","scale=1080:1920:flags=lanczos","-c:v","libx264","-preset","medium","-crf","18","-pix_fmt","yuv420p","-c:a","copy","-movflags","+faststart",str(FINAL)],check=True)


if __name__=="__main__":
    audio();render();finish();print(FINAL)
