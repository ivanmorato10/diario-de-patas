"""Teste de fumaça E2E do modo demonstração (Playwright/Chromium headless).
Uso: npm run build && npx next start -p 3100 &  python3 scripts/e2e.py [base_url] [out_dir]
Com E2E_CHANNEL=chrome usa o Google Chrome instalado em vez do Chromium do Playwright.
"""
import io, sys, os, tempfile, datetime
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
# MUDANCAS-V2: várias fotos (uma com data no EXIF), PDF real e PDF falso
batch = []
for i in range(3):
    bp = os.path.join(tmp, f"lote{i}.jpg"); bi = Image.new("RGB", (320, 240), (60 * i, 140, 170))
    if i == 0:
        bx = Image.Exif(); bx.get_ifd(0x8769)[0x9003] = "2024:07:09 08:15:00"; bi.save(bp, "JPEG", exif=bx.tobytes())
    else:
        bi.save(bp, "JPEG")
    batch.append(bp)
pdf_path = os.path.join(tmp, "carteira.pdf"); Image.new("RGB", (600, 800), (255, 255, 255)).save(pdf_path, "PDF")
fake_pdf = os.path.join(tmp, "falso.pdf"); open(fake_pdf, "w").write("isto é só texto")

results = []
def check(name, cond):
    results.append((name, bool(cond))); print(("OK  " if cond else "FAIL"), name)

def no_overflow(page, label):
    w = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check(f"sem rolagem horizontal: {label}", w <= 0)

with sync_playwright() as p:
    browser = p.chromium.launch(channel=os.environ.get("E2E_CHANNEL") or None)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="pt-BR", timezone_id="America/Sao_Paulo")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))

    page.goto(BASE + "/"); page.wait_for_url("**/bem-vindo")
    page.wait_for_timeout(1500); page.screenshot(path=f"{OUT}/01a-intro-1.png"); no_overflow(page, "intro")
    for i in range(2, 6):
        page.get_by_role("button", name={2: "Vamos nessa, Abu!", 3: "Cada momento conta", 4: "Vamos começar"}.get(i, "Continuar")).click(); page.wait_for_timeout(1700)
        page.screenshot(path=f"{OUT}/01{'abcde'[i-1]}-intro-{i}.png")
    check("introdução chega ao convite final", page.get_by_role("heading", name="Já me conheceu.").is_visible())
    page.get_by_role("button", name="Já tenho conta").click()
    check("‘Já tenho conta’ explica que contas não estão ativas", page.get_by_text("Contas ainda não estão ativas").is_visible())

    page.get_by_role("link", name="Apresentar meu cachorro").click(); page.wait_for_url("**/comecar")
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

    # --- MUDANCAS-V2 §7: missões do dia, troca que persiste, coleções ---
    page.goto(BASE + "/hoje"); page.wait_for_timeout(400)
    daily = page.locator("li.daily-card strong")
    check("3 missões do dia depois de “Olá, mundo”", daily.count() == 3 and page.get_by_text("0 de 3 hoje").is_visible())
    first_b = daily.nth(1).inner_text()
    page.get_by_role("button", name=f"Trocar a missão “{first_b}”").click(); page.wait_for_timeout(400)
    swapped = page.locator("li.daily-card strong").all_inner_texts()
    page.reload(); page.wait_for_timeout(500)
    check("trocar muda a sugestão e persiste ao recarregar", swapped[1] != first_b and page.locator("li.daily-card strong").all_inner_texts() == swapped)
    page.goto(BASE + "/albuns?aba=colecoes"); page.wait_for_timeout(400)
    check("aba Coleções com 5 coleções de 6 espaços", page.locator(".set-grid").count() == 5 and page.locator(".set-grid li").count() == 30)
    page.screenshot(path=f"{OUT}/20-colecoes.png", full_page=True); no_overflow(page, "coleções")

    # Reenviar M01 não é possível / não soma
    page.goto(BASE + "/missoes/ola-mundo")
    check("missão concluída não oferece novo envio", page.get_by_role("link", name="Enviar foto").count() == 0)

    for path, name in [("/diario", "08-diario"), ("/albuns", "09-albuns"), ("/albuns/vida-em-casa", "10-album-vida-em-casa"), ("/estudio", "11-estudio"), ("/config", "12-config"), ("/missoes", "13-missoes"), ("/sobre", "14-sobre"), ("/s/qualquer-token", "15-link-indisponivel")]:
        page.goto(BASE + path); page.wait_for_timeout(500)
        page.screenshot(path=f"{OUT}/{name}.png", full_page=True); no_overflow(page, path)

    page.goto(BASE + "/albuns/vida-em-casa"); page.wait_for_timeout(300)
    check("álbum separa fotos de missão e livres", page.get_by_text("0 de missão · 1 livres").is_visible())
    check("estúdio não oferece geração falsa", page.goto(BASE + "/estudio") and page.get_by_role("button", name="Criar desenho").is_disabled())

    # --- MUDANCAS-V2 §2: várias fotos de uma vez ---
    page.goto(BASE + "/diario"); page.wait_for_timeout(400)
    before = page.locator("article").count()
    page.goto(BASE + "/guardar")
    page.locator("input[type=file][multiple]").set_input_files(batch)
    expect(page.get_by_role("heading", name="3 fotos para guardar")).to_be_visible()
    check("data lida do EXIF no lote", page.get_by_label("Data da foto 1").input_value() == "2024-07-09")
    page.screenshot(path=f"{OUT}/17-varias-fotos.png", full_page=True); no_overflow(page, "várias fotos")
    page.get_by_role("button", name="Guardar todas").click()
    expect(page.get_by_role("heading", name="3 lembranças guardadas")).to_be_visible()
    page.goto(BASE + "/diario"); page.wait_for_timeout(400)
    after = page.locator("article").count()
    check(f"várias fotos: 3 lembranças criadas ({before} → {after})", after == before + 3)

    # --- §2: usar uma foto do Diário numa missão (sem novo upload) ---
    page.get_by_role("button", name="numa missão").first.click()
    page.get_by_role("dialog").get_by_role("link", name="Cara de capa").click()
    expect(page.get_by_role("heading", name="A foto mostra isso?")).to_be_visible()
    page.get_by_role("button", name="Sim, mostra").click()
    expect(page.get_by_text("+10 XP")).to_be_visible()
    page.goto(BASE + "/diario"); page.wait_for_timeout(400)
    check("foto do Diário concluiu missão sem duplicar", page.locator("article").count() == after)

    # --- §3: catálogo e filtro ---
    page.goto(BASE + "/missoes"); page.wait_for_timeout(400)
    check("catálogo com 48 missões", page.get_by_text("de 48 concluídas").is_visible())
    page.get_by_role("button", name="Concluídas (2)").click()
    check("filtro Concluídas mostra as 2 missões", page.locator("a.mission-card").count() == 2)

    # --- §4: vacina com próxima dose em 10 dias aparece em Hoje ---
    today = page.evaluate("new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())")
    next_dose = (datetime.date.fromisoformat(today) + datetime.timedelta(days=10)).isoformat()
    page.goto(BASE + "/cuidados/vacinas")
    page.get_by_role("button", name="Adicionar registro").click()
    page.get_by_label("Nome").fill("V10")
    page.get_by_label("Próxima dose").fill(next_dose)
    page.get_by_role("dialog").get_by_role("button", name="Salvar").click()
    expect(page.get_by_text("Próxima em até 30 dias")).to_be_visible()
    page.goto(BASE + "/hoje"); page.wait_for_timeout(400)
    check("vacina em 10 dias aparece em Próximos cuidados (Hoje)", page.get_by_role("heading", name="Próximos cuidados").is_visible() and page.get_by_text("em 10 dias").first.is_visible())
    page.screenshot(path=f"{OUT}/18-hoje-cuidados.png", full_page=True)

    # --- §5: enviar e abrir um PDF; PDF falso recusado ---
    page.goto(BASE + "/cuidados/documentos")
    page.get_by_role("button", name="Adicionar documento").click()
    page.locator("dialog[open] input[type=file]").set_input_files(fake_pdf); page.wait_for_timeout(400)
    check("arquivo de texto renomeado para .pdf é recusado", page.get_by_text("não parece um PDF").is_visible())
    page.locator("dialog[open] input[type=file]").set_input_files(pdf_path); page.wait_for_timeout(500)
    page.get_by_label("Título").fill("Carteira de vacinação")
    page.get_by_role("dialog").get_by_role("button", name="Salvar").click(); page.wait_for_timeout(400)
    with ctx.expect_page() as newp:
        page.get_by_role("button", name="Ver Carteira de vacinação").click()
    tab = newp.value; tab.wait_for_url("blob:**")
    kind = page.evaluate("u => fetch(u).then(r => r.blob()).then(b => b.type)", tab.url); tab.close()
    check(f"PDF abre numa nova aba ({kind})", kind == "application/pdf")
    page.screenshot(path=f"{OUT}/19-documentos.png", full_page=True)
    for path in ["/cuidados", "/cuidados/dados", "/cuidados/peso", "/cuidados/vacinas", "/cuidados/consultas", "/cuidados/medicamentos", "/cuidados/contatos", "/cuidados/documentos"]:
        page.goto(BASE + path); page.wait_for_timeout(300); no_overflow(page, path)

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
    sp = small.new_page(); sp.goto(BASE + "/bem-vindo"); sp.wait_for_timeout(800); no_overflow(sp, "360px intro")
    sp.goto(BASE + "/comecar"); sp.get_by_label("Nome do cachorro").fill("Mini"); sp.get_by_role("button", name="Criar meu diário").click(); sp.wait_for_url("**/hoje")
    for path in ["/hoje", "/diario", "/missoes", "/albuns", "/cuidados", "/cuidados/peso", "/cuidados/documentos", "/guardar", "/config"]:
        sp.goto(BASE + path); sp.wait_for_timeout(300); no_overflow(sp, f"360px {path}")
    nav = sp.locator("nav.bottom-nav a"); boxes = [nav.nth(i).bounding_box() for i in range(nav.count())]
    check(f"360px: 5 itens na barra numa linha, toque ≥ 44px", nav.count() == 5 and len({round(b["y"]) for b in boxes}) == 1 and min(min(b["width"], b["height"]) for b in boxes) >= 44)
    small.close()
    # Desktop
    page.set_viewport_size({"width": 1280, "height": 900}); page.goto(BASE + "/hoje"); page.wait_for_timeout(400)
    page.screenshot(path=f"{OUT}/16-desktop-hoje.png"); no_overflow(page, "desktop")
    page.goto(BASE + "/cuidados"); page.wait_for_timeout(300); no_overflow(page, "desktop cuidados")

    # Apagar diário
    page.goto(BASE + "/config"); page.get_by_label("Para confirmar").fill("Luna")
    page.get_by_role("button", name="Apagar tudo").click(); page.wait_for_url("**/bem-vindo")
    check("apagar diário volta às boas-vindas", True)

    check(f"sem erros no console ({errors[:3]})", len(errors) == 0)
    browser.close()

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} verificações OK")
sys.exit(1 if failed else 0)
