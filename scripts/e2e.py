"""Teste de fumaça E2E do modo demonstração (Playwright/Chromium headless).
Uso: npm run build && npx next start -p 3100 &  python3 scripts/e2e.py [base_url] [out_dir]
"""
import io, sys, os, tempfile
from PIL import Image
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100"
OUT = sys.argv[2] if len(sys.argv) > 2 else "e2e-out"
os.makedirs(OUT, exist_ok=True)
tmp = tempfile.mkdtemp()

# Foto paisagem 400x200 com EXIF Orientation=6 → deve aparecer em retrato (200x400)
img = Image.new("RGB", (400, 200), (198, 93, 59))
for x in range(0, 120):
    for y in range(0, 60):
        img.putpixel((x, y), (40, 89, 67))
exif = Image.Exif(); exif[0x0112] = 6; exif.get_ifd(0x8825)[1] = "S"; exif.get_ifd(0x8825)[2] = (23.0, 33.0, 0.0)  # GPS fictício
rot_path = os.path.join(tmp, "rotacionada.jpg"); img.save(rot_path, "JPEG", exif=exif.tobytes())
ok_path = os.path.join(tmp, "foto.png"); Image.new("RGB", (640, 480), (166, 187, 166)).save(ok_path)
corrupt = os.path.join(tmp, "corrompida.jpg"); open(corrupt, "wb").write(b"\xff\xd8\xff\xe0" + b"\x00" * 200)
fake = os.path.join(tmp, "texto.jpg"); open(fake, "w").write("não sou uma foto")

results = []
def check(name, cond):
    results.append((name, bool(cond))); print(("OK  " if cond else "FAIL"), name)

def no_overflow(page, label):
    w = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check(f"sem rolagem horizontal: {label}", w <= 0)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="pt-BR", timezone_id="America/Sao_Paulo")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))

    page.goto(BASE + "/"); page.wait_for_url("**/bem-vindo")
    page.wait_for_timeout(1500); page.screenshot(path=f"{OUT}/01a-intro-1.png"); no_overflow(page, "intro")
    for i in range(2, 6):
        page.get_by_role("button", name={2: "Vamos nessa, Abu!", 3: "Cada momento conta"}.get(i, "Continuar")).click(); page.wait_for_timeout(1700)
        page.screenshot(path=f"{OUT}/01{'abcde'[i-1]}-intro-{i}.png")
    check("introdução chega ao convite final", page.get_by_role("heading", name="Sempre juntos.").is_visible())
    page.get_by_role("button", name="Já tenho conta").click()
    check("‘Já tenho conta’ explica que contas não estão ativas", page.get_by_text("Contas ainda não estão ativas").is_visible())

    page.get_by_role("link", name="Criar o diário do meu cachorro").click(); page.wait_for_url("**/comecar")
    page.get_by_role("button", name="Criar meu diário").click()
    check("nome obrigatório", page.get_by_role("alert").first.inner_text().startswith("Conte para a gente"))
    page.get_by_label("Nome do cachorro").fill("Luna")
    page.screenshot(path=f"{OUT}/02-onboarding.png", full_page=True); no_overflow(page, "onboarding")
    page.get_by_role("button", name="Criar meu diário").click(); page.wait_for_url("**/hoje")
    expect(page.get_by_role("heading", name="Diário de Luna")).to_be_visible()
    page.screenshot(path=f"{OUT}/03-hoje-inicio.png", full_page=True); no_overflow(page, "hoje")

    page.get_by_role("link", name="Olá, mundo").first.click(); page.wait_for_url("**/missoes/ola-mundo")
    page.screenshot(path=f"{OUT}/04-missao.png", full_page=True)
    page.get_by_role("link", name="Enviar foto").click(); page.wait_for_url("**/guardar?missao=ola-mundo")
    page.locator('input[type=file]:not([capture])').set_input_files(rot_path)
    expect(page.get_by_role("heading", name="Ajuste e guarde")).to_be_visible()
    dims = page.evaluate("(() => { const i = document.querySelector('img.photo'); return [i.naturalWidth, i.naturalHeight]; })()")
    check(f"orientação EXIF corrigida (retrato) {dims}", dims[1] > dims[0])
    page.get_by_label("Legenda").fill("Primeira página do diário")
    page.screenshot(path=f"{OUT}/05-envio.png", full_page=True); no_overflow(page, "envio")
    page.get_by_role("button", name="Guardar e continuar").click()
    expect(page.get_by_role("heading", name="A foto mostra isso?")).to_be_visible()
    page.get_by_role("button", name="Sim, mostra").click()
    expect(page.get_by_text("+10 XP")).to_be_visible()
    check("resultado identifica modo demonstração", page.get_by_text("Confirmada por você").is_visible())
    page.screenshot(path=f"{OUT}/06-resultado.png", full_page=True)

    # Foto livre + arquivos inválidos
    page.goto(BASE + "/guardar")
    page.locator('input[type=file]:not([capture])').set_input_files(fake)
    expect(page.get_by_text("não parece uma foto")).to_be_visible()
    check("arquivo que não é foto é recusado", True)
    page.locator('input[type=file]:not([capture])').set_input_files(corrupt)
    expect(page.get_by_text("corrompida")).to_be_visible()
    check("arquivo corrompido é tratado", True)
    page.locator('input[type=file]:not([capture])').set_input_files(ok_path)
    page.get_by_label("Vida em casa").check()
    page.get_by_role("button", name="Guardar foto").click()
    expect(page.get_by_role("heading", name="Guardada no diário")).to_be_visible()

    # Persistência após recarregar
    page.goto(BASE + "/hoje"); page.reload()
    expect(page.get_by_text("10 XP").first).to_be_visible()
    check("XP persiste após recarregar", True)
    page.screenshot(path=f"{OUT}/07-hoje-depois.png", full_page=True)

    # Reenviar M01 não é possível / não soma
    page.goto(BASE + "/missoes/ola-mundo")
    check("missão concluída não oferece novo envio", page.get_by_role("link", name="Enviar foto").count() == 0)

    for path, name in [("/diario", "08-diario"), ("/albuns", "09-albuns"), ("/albuns/vida-em-casa", "10-album-vida-em-casa"), ("/estudio", "11-estudio"), ("/config", "12-config"), ("/missoes", "13-missoes"), ("/sobre", "14-sobre"), ("/s/qualquer-token", "15-link-indisponivel")]:
        page.goto(BASE + path); page.wait_for_timeout(500)
        page.screenshot(path=f"{OUT}/{name}.png", full_page=True); no_overflow(page, path)

    page.goto(BASE + "/albuns/vida-em-casa"); page.wait_for_timeout(300)
    check("álbum separa fotos de missão e livres", page.get_by_text("0 de missão · 1 livres").is_visible())
    check("estúdio não oferece geração falsa", page.goto(BASE + "/estudio") and page.get_by_role("button", name="Criar desenho").is_disabled())

    # Excluir lembrança mantém conquista
    page.goto(BASE + "/diario"); page.wait_for_timeout(300)
    page.get_by_role("button", name="Excluir lembrança “Primeira página do diário”").click()
    page.get_by_role("dialog").get_by_role("button", name="Excluir").click()
    page.wait_for_timeout(400)
    page.goto(BASE + "/hoje")
    expect(page.get_by_text("10 XP").first).to_be_visible()
    check("conquista permanece após excluir a foto", page.get_by_role("heading", name="Última lembrança").is_visible())

    # Largura estreita 360 px
    small = browser.new_context(viewport={"width": 360, "height": 740}, storage_state=None)
    sp = small.new_page(); sp.goto(BASE + "/bem-vindo"); sp.wait_for_timeout(800); no_overflow(sp, "360px intro"); small.close()
    # Desktop
    page.set_viewport_size({"width": 1280, "height": 900}); page.goto(BASE + "/hoje"); page.wait_for_timeout(400)
    page.screenshot(path=f"{OUT}/16-desktop-hoje.png"); no_overflow(page, "desktop")

    # Apagar diário
    page.goto(BASE + "/config"); page.get_by_label("Para confirmar").fill("Luna")
    page.get_by_role("button", name="Apagar tudo").click(); page.wait_for_url("**/bem-vindo")
    check("apagar diário volta às boas-vindas", True)

    check(f"sem erros no console ({errors[:3]})", len(errors) == 0)
    browser.close()

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} verificações OK")
sys.exit(1 if failed else 0)
