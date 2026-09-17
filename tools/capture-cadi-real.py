from pathlib import Path
import os
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".video-deps"))

from playwright.sync_api import sync_playwright

OUT = ROOT / "artifacts" / "cadi-tutorial-real" / "capturas"
OUT.mkdir(parents=True, exist_ok=True)

BASE = "https://cadi.nessik.net"
SLUG = "ferreteria-demo"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def shot(page, name, full=False):
    page.wait_for_load_state("networkidle")
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)
    print(name)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME, args=["--disable-gpu"])
    context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    page = context.new_page()

    page.goto(f"{BASE}/registrar", wait_until="networkidle")
    shot(page, "01-registro")

    page.goto(f"{BASE}/{SLUG}/admin", wait_until="networkidle")
    shot(page, "02-acceso")
    page.get_by_label("TU PIN DE ACCESO").fill("1234")
    page.get_by_role("button", name="Entrar a mi panel").click()
    page.wait_for_url(f"**/{SLUG}/admin/**")
    shot(page, "03-panel-resumen")

    page.evaluate("window.scrollTo(0, Math.min(1350, document.body.scrollHeight))")
    page.wait_for_timeout(400)
    shot(page, "04-panel-metricas")

    page.evaluate("window.scrollTo(0, Math.max(document.body.scrollHeight - 900, 0))")
    page.wait_for_timeout(400)
    shot(page, "05-pedidos-recientes")

    routes = [
        ("productos", "06-productos"),
        ("clientes", "08-clientes"),
        ("proveedores", "09-proveedores"),
        ("empleados", "10-empleados"),
        ("config", "11-configuracion"),
        ("diseno", "12-diseno"),
        ("planes", "13-planes"),
    ]
    for route, name in routes:
        page.goto(f"{BASE}/{SLUG}/admin/{route}", wait_until="networkidle")
        shot(page, name)
        if route == "productos":
            add = page.get_by_role("button", name="Agregar producto")
            if add.count() == 0:
                add = page.get_by_text("Agregar producto", exact=False).first
            if add.count():
                add.click()
                page.wait_for_timeout(350)
                shot(page, "07-nuevo-producto")

    public = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1).new_page()
    public.goto(f"{BASE}/{SLUG}", wait_until="networkidle")
    shot(public, "14-catalogo-publico")
    public.evaluate("window.scrollTo(0, 850)")
    public.wait_for_timeout(400)
    shot(public, "15-catalogo-productos")

    mobile_ctx = browser.new_context(viewport={"width": 430, "height": 932}, device_scale_factor=1)
    mobile = mobile_ctx.new_page()
    mobile.goto(f"{BASE}/{SLUG}", wait_until="networkidle")
    shot(mobile, "16-catalogo-movil")
    mobile.evaluate("window.scrollTo(0, 780)")
    mobile.wait_for_timeout(400)
    shot(mobile, "17-compra-movil")

    print(OUT)
    browser.close()
