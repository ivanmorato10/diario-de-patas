"""E2E do modo real (MUDANCAS-V2 §8.3) contra um projeto Supabase de verdade, com duas contas (A e B).
Uso: com .env.local preenchido, `npm run build && npx next start -p 3000 &` e depois
     python3 scripts/e2e-real.py [base_url] [out_dir]
Cria as contas pela API de administração (sem enviar email), entra com o código de uso único,
testa isolamento e, no fim, exclui as duas contas pela própria tela de “Excluir conta”.
Nunca imprime chaves.
"""
import re, json, os, sys, tempfile, time, urllib.request, urllib.error, uuid, datetime
from PIL import Image
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
OUT = sys.argv[2] if len(sys.argv) > 2 else "e2e-real-out"
os.makedirs(OUT, exist_ok=True)

env = {}
for line in open(os.path.join(os.path.dirname(__file__), "..", ".env.local")):
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.strip().split("=", 1)
        env[k] = v
URL, SERVICE = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]

def admin(method, path, body=None):
    req = urllib.request.Request(f"{URL}/auth/v1/admin/{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"apikey": SERVICE, "authorization": f"Bearer {SERVICE}", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raise SystemExit(f"admin {path}: {e.code} {e.read()[:200]!r}")

def otp_for(email):
    return admin("POST", "generate_link", {"type": "magiclink", "email": email})["email_otp"]

results = []
def check(name, cond):
    results.append((name, bool(cond))); print(("OK  " if cond else "FAIL"), name)

tmp = tempfile.mkdtemp()
def photo(i):
    p = os.path.join(tmp, f"p{i}.jpg"); Image.new("RGB", (480, 360), (40 + 30 * i % 200, 140, 170)).save(p, "JPEG"); return p
pdf = os.path.join(tmp, "carteira.pdf"); Image.new("RGB", (600, 800), (255, 255, 255)).save(pdf, "PDF")

run = uuid.uuid4().hex[:8]
emails = {"A": f"e2e-a-{run}@diariodepatas.test", "B": f"e2e-b-{run}@diariodepatas.test"}
for e in emails.values():
    admin("POST", "users", {"email": e, "email_confirm": True})

def login(page, who):
    page.goto(BASE + "/hoje"); page.wait_for_url("**/entrar?next=*")
    page.get_by_role("button", name="Já tenho conta").click(); page.get_by_role("button", name="Entrar com email").click(); page.get_by_label("Seu email").fill(emails[who])
    # O teste não envia email: só o pedido de envio é interceptado; o código de uso único (gerado pela
    # API de administração) é conferido pelo Supabase de verdade em verifyOtp.
    page.route("**/auth/v1/otp*", lambda route: route.fulfill(status=200, content_type="application/json", body="{}"))
    page.get_by_role("button", name="Receber link de entrada").click()
    expect(page.get_by_role("heading", name="Confira seu email")).to_be_visible()
    page.get_by_label("Código").fill(otp_for(emails[who]))
    page.get_by_role("button", name="Entrar com o código").click()
    page.wait_for_url(lambda u: "/entrar" not in u, timeout=20000)

def eventually(fn, timeout=15000):
    """Espera uma condição de interface (rede até o Supabase pode demorar)."""
    try:
        fn(timeout)
        return True
    except AssertionError:
        return False

def rpc(page, method, args):
    return page.evaluate("""async ([m, a]) => { const r = await fetch('/api/rpc/' + m, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(a)}); return [r.status, await r.json().catch(() => null)]; }""", [method, args])

with sync_playwright() as p:
    browser = p.chromium.launch(channel=os.environ.get("E2E_CHANNEL") or None)
    errors = []
    ctxA = browser.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR", timezone_id="America/Sao_Paulo")
    a = ctxA.new_page(); a.on("pageerror", lambda e: errors.append(str(e)))

    # ---------- Splash: a entrada vem antes da apresentação ----------
    a.goto(BASE + "/"); a.wait_for_url("**/entrar")
    check("sem conta, / abre o splash com cadastro", eventually(lambda t: expect(a.get_by_role("button", name="Cadastrar meu cachorro")).to_be_visible(timeout=t)))
    a.get_by_role("button", name="Cadastrar meu cachorro").click()
    check("cadastro oferece Google, Apple e email", eventually(lambda t: expect(a.get_by_role("button", name="Continuar com Google")).to_be_visible(timeout=t)) and a.get_by_role("button", name="Continuar com Apple").is_visible() and a.get_by_role("button", name="Criar com email").is_visible())
    a.goto(BASE + "/bem-vindo"); check("a apresentação pede login antes", "/entrar" in a.url)

    # ---------- Conta A ----------
    login(a, "A")
    a.goto(BASE + "/"); a.wait_for_url("**/bem-vindo", timeout=20000)
    check("depois de entrar sem diário, vem a apresentação", eventually(lambda t: expect(a.get_by_role("button", name="Pular")).to_be_visible(timeout=t)))
    a.goto(BASE + "/entrar"); check("quem já entrou não volta ao login", "/entrar" not in a.url)
    a.goto(BASE + "/comecar"); a.get_by_label("Nome do cachorro").fill("Luna")
    a.locator("input[type=file]:not([capture])").first.set_input_files(photo(0)); a.wait_for_timeout(800)
    a.get_by_role("button", name="Criar meu diário").click(); a.wait_for_url("**/hoje", timeout=30000)
    expect(a.get_by_role("heading", name="Diário de Luna")).to_be_visible()
    check("modo real: sem faixa de demonstração", a.locator(".demo-banner").count() == 0)
    try:
        expect(a.locator("header .avatar img")).to_have_count(1, timeout=15000)
    except AssertionError:
        pass
    dog = rpc(a, "snapshot", {})[1]["dog"]
    st = a.evaluate("id => fetch('/api/media/' + id + '?v=thumb').then(r => r.status)", dog["photoMediaId"]) if dog.get("photoMediaId") else None
    check(f"foto de perfil no bucket privado e no cabeçalho ({st})", st == 200 and a.locator("header .avatar img").count() == 1)
    a.screenshot(path=f"{OUT}/01-hoje-A.png", full_page=True)

    a.get_by_role("link", name="Olá, mundo").first.click(); a.get_by_role("link", name="Enviar foto").click()
    a.locator("input[type=file]:not([capture])").set_input_files(photo(1))
    a.get_by_role("button", name="Guardar e continuar").click()
    expect(a.get_by_role("heading", name="A foto mostra isso?")).to_be_visible(timeout=30000)
    a.get_by_role("button", name="Sim, mostra").click()
    expect(a.get_by_text("+10 XP")).to_be_visible(timeout=20000)
    check("missão confirmada no servidor (+10 XP)", True)

    a.goto(BASE + "/guardar"); a.locator("input[type=file][multiple]").set_input_files(photo(2))
    a.get_by_role("button", name="Guardar foto").click()
    expect(a.get_by_role("heading", name="Guardada no diário")).to_be_visible(timeout=30000)

    a.goto(BASE + "/albuns"); a.get_by_role("button", name="Novo álbum").click()
    a.get_by_label("Nome do álbum").fill("Viagem à praia"); a.get_by_role("dialog").get_by_role("button", name="Criar álbum").click()
    a.wait_for_url("**/albuns/custom-*", timeout=20000)
    a.get_by_role("button", name="Adicionar fotos do diário").click()
    a.get_by_role("dialog").locator("button[aria-pressed]").first.click()
    a.get_by_role("dialog").get_by_role("button", name="Adicionar 1 foto").click()
    check("álbum personalizado com foto (conta real)", eventually(lambda t: expect(a.locator(".grid-photos a")).to_have_count(1, timeout=t)))

    today = a.evaluate("new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())")
    a.goto(BASE + "/cuidados/vacinas"); a.get_by_role("button", name="Adicionar registro").click()
    a.get_by_label("Nome").fill("V10"); a.get_by_label("Próxima dose").fill((datetime.date.fromisoformat(today) + datetime.timedelta(days=10)).isoformat())
    a.get_by_role("dialog").get_by_role("button", name="Salvar").click()
    expect(a.get_by_text("Próxima em até 30 dias")).to_be_visible(timeout=20000)

    # ---------- Remédio semanal: aviso na Hoje, "Já dei" e lembrete no calendário ----------
    today = rpc(a, "snapshot", {})[1]["today"]
    st, med = rpc(a, "saveCare", {"store": "medications", "input": {"name": "Vermífugo teste", "dose": "1 comprimido", "repeat": "weekly", "startDate": today}})
    a.goto(BASE + "/hoje")
    check("aviso 'Hora do remédio' na tela Hoje", eventually(lambda t: expect(a.get_by_text(re.compile("Hora do remédio"))).to_be_visible(timeout=t)))
    a.get_by_role("button", name="Já dei").click(); a.wait_for_timeout(2500)
    meds = rpc(a, "snapshot", {})[1]["health"]["medications"]
    check("'Já dei' marca a dose de hoje", any(m["name"] == "Vermífugo teste" and m.get("lastGiven") == today for m in meds))
    ics = a.evaluate("id => fetch('/api/calendario?tipo=medicamento&id=' + id).then(async r => [r.status, r.headers.get('content-type'), await r.text()])", med["id"])
    check(f"lembrete .ics semanal ({ics[0]})", ics[0] == 200 and "text/calendar" in (ics[1] or "") and "RRULE:FREQ=WEEKLY" in ics[2])
    b_ics = rpc(a, "deleteCare", {"store": "medications", "id": med["id"]})
    future = (datetime.date.fromisoformat(today) + datetime.timedelta(days=10)).isoformat()
    st, vis = rpc(a, "saveCare", {"store": "visits", "input": {"date": future, "time": "14:30", "reason": "Check-up", "clinic": "Clínica Patas"}})
    vics = a.evaluate("id => fetch('/api/calendario?tipo=consulta&id=' + id).then(r => r.text())", vis["id"])
    check(f"consulta agendada com horário no calendário ({st})", st == 200 and "T143000" in vics and "TZID=America/Sao_Paulo" in vics)
    rpc(a, "deleteCare", {"store": "visits", "id": vis["id"]})
    a.goto(BASE + "/cuidados"); a.wait_for_timeout(1500)
    with a.expect_download(timeout=30000) as dl:
        a.get_by_role("button", name=re.compile("PDF para o veterinário")).click()
    pdf_path = os.path.join(OUT, "ficha.pdf"); dl.value.save_as(pdf_path)
    head = open(pdf_path, "rb").read(5)
    check(f"PDF para o veterinário gerado ({os.path.getsize(pdf_path)} bytes)", head == b"%PDF-" and os.path.getsize(pdf_path) > 20000)
    a.goto(BASE + "/cuidados/documentos"); a.get_by_role("button", name="Adicionar documento").click()
    a.locator("dialog[open] input[type=file]").set_input_files(pdf); a.wait_for_timeout(500)
    a.get_by_label("Título").fill("Carteira de vacinação"); a.get_by_role("dialog").get_by_role("button", name="Salvar").click()
    expect(a.get_by_role("button", name="Ver Carteira de vacinação")).to_be_visible(timeout=30000)
    with ctxA.expect_page() as newp:
        a.get_by_role("button", name="Ver Carteira de vacinação").click()
    tab = newp.value; tab.wait_for_url("blob:**")
    kind = a.evaluate("u => fetch(u).then(r => r.blob()).then(b => b.type)", tab.url); tab.close()
    check(f"PDF enviado ao bucket privado e aberto ({kind})", kind == "application/pdf")

    snapA = rpc(a, "snapshot", {})[1]
    entryA = snapA["entries"][0]; mediaA = entryA["mediaId"]; docA = snapA["health"]["documents"][0]["id"]
    check("snapshot de A: 2 lembranças, 10 XP, 1 álbum, 1 vacina, 1 documento",
          len(snapA["entries"]) == 2 and snapA["xpTotal"] == 10 and len(snapA["customAlbums"]) == 1 and len(snapA["health"]["vaccines"]) == 1 and len(snapA["health"]["documents"]) == 1)

    # ---------- Conta B: não vê nem mexe em nada de A ----------
    ctxB = browser.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR", timezone_id="America/Sao_Paulo")
    b = ctxB.new_page(); b.on("pageerror", lambda e: errors.append(str(e)))
    login(b, "B")
    b.goto(BASE + "/comecar"); b.get_by_label("Nome do cachorro").fill("Thor"); b.get_by_role("button", name="Criar meu diário").click(); b.wait_for_url("**/hoje", timeout=30000)
    snapB = rpc(b, "snapshot", {})[1]
    check("B não vê lembranças, álbuns, cuidados nem documentos de A",
          snapB["entries"] == [] and snapB["customAlbums"] == [] and snapB["health"]["vaccines"] == [] and snapB["health"]["documents"] == [] and snapB["dog"]["name"] == "Thor")
    st = b.evaluate("id => fetch('/api/media/' + id + '?v=display').then(r => r.status)", mediaA)
    check(f"B não baixa a foto de A pela URL ({st})", st == 404)
    st = b.evaluate("id => fetch('/api/documents/' + id).then(r => r.status)", docA)
    check(f"B não baixa o documento de A pela URL ({st})", st == 404)
    st, body = rpc(b, "updateEntry", {"id": entryA["id"], "caption": "invadido"})
    check(f"B não edita a lembrança de A ({st})", st == 400)
    st, body = rpc(b, "deleteEntry", {"id": entryA["id"]})
    st2, body2 = rpc(b, "submitMission", {"requestKey": str(uuid.uuid4()), "missionId": "M01", "entryId": entryA["id"], "status": "approved"})
    check(f"B não conclui missão com a foto de A ({st2})", st2 == 400)
    st, body = rpc(b, "addEntriesToAlbum", {"albumId": snapA["customAlbums"][0]["id"], "entryIds": [entryA["id"]]})
    check(f"B não mexe no álbum de A ({st})", st == 400)
    st, body = rpc(b, "deleteDocument", {"id": docA})
    after = rpc(a, "snapshot", {})[1]
    check("dados de A intactos depois das tentativas de B", len(after["entries"]) == 2 and after["entries"][0]["caption"] != "invadido" and len(after["health"]["documents"]) == 1)

    # ---------- Foto de perfil: zoom e posição ----------
    rpc(a, "updateDog", {"avatarCrop": {"x": 40, "y": 30, "zoom": 1.6}})
    a.goto(BASE + "/config"); a.wait_for_timeout(1500)
    # ---------- Compartilhar o diário com código de convite ----------
    expect(a.get_by_role("heading", name="Compartilhar o diário")).to_be_visible(timeout=20000)
    a.get_by_role("button", name="Gerar código de convite").click()
    code_el = a.locator(".invite-code__value"); expect(code_el).to_be_visible(timeout=20000)
    invite_code = code_el.inner_text().strip()
    check(f"código de convite gerado ({invite_code[:9]}…)", invite_code.startswith("PATA-") and len(invite_code) == 14)
    ctxI = browser.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    inv = ctxI.new_page(); inv.goto(BASE + "/entrar")
    inv.get_by_role("button", name=re.compile("Tenho um código de convite")).click()
    inv.get_by_label("Código").fill(invite_code); inv.get_by_role("button", name="Entrar no diário").click()
    inv.wait_for_url(lambda u: "/entrar" not in u, timeout=30000); inv.goto(BASE + "/hoje")
    check("quem recebe o código entra no mesmo diário", eventually(lambda t: expect(inv.get_by_role("heading", name="Diário de Luna")).to_be_visible(timeout=t)))
    inv2 = ctxI.browser.new_context().new_page(); inv2.goto(BASE + "/entrar")
    st_reuse = inv2.evaluate("c => fetch('/api/acesso', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({code: c})}).then(r => r.status)", invite_code)
    check(f"o mesmo código não funciona duas vezes ({st_reuse})", st_reuse == 400)
    ctxI.close()
    a.get_by_role("button", name="Ajustar zoom e posição").click()
    check("editor de foto de perfil abre com o ajuste salvo", a.get_by_label("Zoom").input_value() in ("1.6", "1.60") )
    a.get_by_label("Zoom").fill("2.2")
    a.get_by_role("button", name="Salvar ajuste").click(); a.wait_for_timeout(300)
    check("a foto muda na tela na hora", "scale(2.2)" in (a.locator("header .avatar img").get_attribute("style") or ""))
    a.wait_for_timeout(2500)
    saved = (rpc(a, "snapshot", {})[1]["dog"] or {}).get("avatarCrop") or {}
    check(f"ajuste da foto de perfil salvo pela tela ({saved})", abs(float(saved.get("zoom", 0)) - 2.2) < 0.01)
    # Como no celular: arrastar a foto e fechar a janela sem tocar em salvar.
    a.get_by_role("button", name="Ajustar zoom e posição").click(); a.wait_for_timeout(300)
    box = a.locator(".avatar-crop").bounding_box()
    a.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2); a.mouse.down()
    a.mouse.move(box["x"] + box["width"] / 2 + 50, box["y"] + box["height"] / 2 + 30, steps=8); a.mouse.up()
    a.keyboard.press("Escape"); a.wait_for_timeout(2500)
    dragged = (rpc(a, "snapshot", {})[1]["dog"] or {}).get("avatarCrop") or {}
    check(f"arrastar e fechar a janela salva a posição ({dragged})", abs(float(dragged.get("x", 40)) - 40) > 1 and abs(float(dragged.get("zoom", 0)) - 2.2) < 0.01)
    a.reload(); a.wait_for_timeout(2000)
    check("ajuste continua depois de recarregar", "scale(2.2)" in (a.locator("header .avatar img").get_attribute("style") or ""))

    # ---------- Link compartilhado: só a seleção; revogar corta na hora ----------
    a.goto(BASE + "/albuns/primeiras-lembrancas"); a.wait_for_timeout(1500)
    a.get_by_role("button", name="Compartilhar álbum").click()
    a.get_by_role("button", name="Desmarcar todas").click()
    a.locator("dialog .grid-photos button[aria-pressed]").first.click()
    a.get_by_label("Título do link").fill("Para a vovó")
    a.get_by_role("button", name="Criar link com 1 foto").click()
    link_input = a.get_by_label("Link do álbum compartilhado"); expect(link_input).to_be_visible(timeout=20000)
    share_url = link_input.input_value()
    ctxV = browser.new_context(viewport={"width": 390, "height": 844})
    v = ctxV.new_page(); v.goto(share_url)
    html = v.content()
    img_status = v.evaluate("() => fetch(document.querySelector('figure img').src).then(r => r.status)")
    av_status = v.evaluate("() => fetch(location.pathname + '/perfil').then(r => r.status)")
    check(f"álbum compartilhado mostra a foto de perfil com o ajuste ({av_status})", av_status == 200 and "scale(2.2)" in (v.locator(".shared-avatar img").get_attribute("style") or ""))
    v.wait_for_timeout(800); v.screenshot(path=f"{OUT}/02-compartilhado.png", full_page=True)
    check("página compartilhada convida a criar conta (logo e botão)", v.locator('a[href="/entrar?modo=criar"]').count() >= 3)
    check(f"visitante sem conta vê só a seleção (1 foto, {img_status})", v.locator("figure.shared-photo").count() == 1 and img_status == 200 and v.get_by_role("heading", name="Para a vovó").is_visible())
    check("página compartilhada sem dados de saúde, email ou noindex ausente",
          "V10" not in html and emails["A"] not in html and 'name="robots" content="noindex' in html)
    img_url = v.evaluate("() => document.querySelector('figure img').src")
    a.goto(BASE + "/config"); a.get_by_role("button", name="Revogar o link Para a vovó").click(); a.wait_for_timeout(1500)
    v.goto(share_url)
    st = v.evaluate("u => fetch(u).then(r => r.status)", img_url)
    av_after = v.evaluate("() => fetch(location.pathname + '/perfil').then(r => r.status)")
    check(f"foto de perfil some junto com o link ({av_after})", av_after == 404)
    check(f"link revogado para de funcionar (página e foto {st})", v.get_by_role("heading", name="Este álbum não está disponível").is_visible() and st == 404)
    ctxV.close()

    # ---------- Sair e entrar de novo ----------
    a.goto(BASE + "/config"); a.get_by_role("button", name="Sair da conta").click(); a.wait_for_url("**/entrar")
    a.goto(BASE + "/hoje"); check("depois de sair, o app pede login", "/entrar" in a.url)
    login(a, "A"); a.goto(BASE + "/hoje")
    check("dados persistem depois de sair e entrar",
          eventually(lambda t: expect(a.get_by_role("heading", name="Diário de Luna")).to_be_visible(timeout=t)) and eventually(lambda t: expect(a.get_by_text("10 XP").first).to_be_visible(timeout=t)))

    # ---------- Excluir as contas (pela tela) ----------
    for page, name in [(b, "Thor"), (a, "Luna")]:
        page.goto(BASE + "/config"); page.get_by_label("Para confirmar").fill(name)
        page.get_by_role("button", name="Excluir minha conta").click(); page.wait_for_timeout(4000)
    st = a.evaluate("id => fetch('/api/media/' + id + '?v=display').then(r => r.status)", mediaA)
    check(f"conta excluída: foto de A não abre mais ({st})", st in (401, 404))
    users = admin("GET", f"users?per_page=200")
    left = [u for u in users.get("users", []) if u["email"] in emails.values()]
    check("as duas contas de teste foram excluídas", left == [])

    check(f"sem erros de página ({errors[:2]})", not errors)
    browser.close()

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} verificações OK")
sys.exit(1 if failed else 0)
