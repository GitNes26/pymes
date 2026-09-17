from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '.video-deps'))
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', args=['--disable-gpu'])
    page=browser.new_page()
    page.goto('http://localhost:3000/ferreteria-del-toro-tutorial-20260917')
    print('TITLE:', page.title())
    print('INPUTS:', page.locator('input').evaluate_all('(els)=>els.map(e=>({id:e.id,name:e.name,type:e.type,placeholder:e.placeholder}))'))
    print('BUTTONS:', page.locator('button').evaluate_all('(els)=>els.map(e=>({id:e.id,text:e.innerText,aria:e.getAttribute("aria-label")}))'))
    print('LINKS:', page.locator('a').evaluate_all('(els)=>els.map(e=>({text:e.innerText,href:e.getAttribute("href")})).filter(x=>x.text.trim()||x.href).slice(0,50)'))
    page.locator('button.prod-btn').first.click(timeout=8000)
    page.locator('#chat-fab').click()
    print('CART:', page.locator('#chat-panel').inner_text()[:2500] if page.locator('#chat-panel').count() else page.locator('body').inner_text()[-2500:])
    print('CART BUTTONS:', page.locator('button').evaluate_all('(els)=>els.filter(e=>e.offsetWidth||e.offsetHeight).map(e=>({id:e.id,text:e.innerText,aria:e.getAttribute("aria-label")})).slice(-30)'))
    browser.close()
