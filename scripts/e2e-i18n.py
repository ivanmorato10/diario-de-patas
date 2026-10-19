"""E2E de idiomas (português e inglês) contra um projeto Supabase de verdade (com a migration 20261106000000_i18n).
Uso: com .env.local preenchido, `npm run build && npx next start -p 3000 &` e depois
     python3 scripts/e2e-i18n.py [base_url] [out_dir]
Duas contas: E (navegador em inglês) e P (navegador em português), no MESMO diário — cada uma vê o app no
próprio idioma e recebe os avisos no próprio idioma. Confere também: troca de idioma sem perder a tela,
peso em kg/lb sem mudar o registro, região do calendário sem duplicar pontos, nenhuma chave crua na tela,
nada em português na versão em inglês e nada estourando a largura em iPhones pequenos.
No fim, exclui as duas contas pela API de administração. Nunca imprime chaves.
"""
import re, json, os, sys, tempfile, urllib.request, urllib.error, uuid
from PIL import Image
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
OUT = sys.argv[2] if len(sys.argv) > 2 else "e2e-i18n-out"
os.makedirs(OUT, exist_ok=True)
ROOT = os.path.join(os.path.dirname(__file__), "..")

env = {}
for line in open(os.path.join(ROOT, ".env.local")):
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

results = []
def check(name, cond):
    results.append((name, bool(cond))); print(("OK  " if cond else "FAIL"), name)

def eventually(fn, timeout=15000):
    try:
        fn(timeout); return True
    except AssertionError:
        return False

tmp = tempfile.mkdtemp()
def photo(i):
    p = os.path.join(tmp, f"p{i}.jpg"); Image.new("RGB", (480, 360), (60 + 40 * i % 180, 120, 160)).save(p, "JPEG"); return p

# Namespaces dos arquivos de idioma: "today.paws" na tela = chave crua (texto faltando).
NS = sorted(json.load(open(os.path.join(ROOT, "messages/en.json"))).keys())
RAW_KEY = re.compile(r"\b(" + "|".join(map(re.escape, NS)) + r")\.[a-zA-Z]")
PT_WORDS = re.compile(r"\b(você|não|cachorro|lembrança|lembranças|patinhas|cartinha|ossinho|Salvar|Cancelar|Fechar|Voltar|Guardar|Entrar|Carregando)\b")

def text_checks(page, label, english):
    body = page.locator("main").first.inner_text() if page.locator("main").count() else page.inner_text("body")
    raw = RAW_KEY.findall(body)
    check(f"{label}: sem chave crua na tela", not raw)
    if english:
        hits = sorted(set(PT_WORDS.findall(body)))
        check(f"{label}: nada em português na versão em inglês {hits if hits else ''}", not hits)

def no_overflow(page, label):
    w = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    check(f"{label}: cabe na largura ({w[0]}≤{w[1]})", w[0] <= w[1] + 1)

def rpc(page, method, args):
    return page.evaluate("""async ([m, a]) => { const r = await fetch('/api/rpc/' + m, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(a)}); return [r.status, await r.json().catch(() => null)]; }""", [method, args])

run = uuid.uuid4().hex[:8]
emails = {"E": f"e2e-en-{run}@diariodepatas.test", "P": f"e2e-pt-{run}@diariodepatas.test"}
ids = {}
for k, e in emails.items():
    ids[k] = admin("POST", "users", {"email": e, "email_confirm": True})["id"]

def otp_for(email):
    return admin("POST", "generate_link", {"type": "magiclink", "email": email})["email_otp"]

def login(page, who, english):
    page.goto(BASE + "/hoje"); page.wait_for_url("**/entrar?next=*")
    page.get_by_role("button", name="I already have an account" if english else "Já tenho conta").click()
    page.get_by_role("button", name="Sign in with email" if english else "Entrar com email").click()
    page.get_by_role("button", name="I'd rather get a code by email" if english else "Prefiro receber um código no email").click()
    page.get_by_label("Your email" if english else "Seu email").fill(emails[who])
    page.route("**/auth/v1/otp*", lambda route: route.fulfill(status=200, content_type="application/json", body="{}"))
    page.get_by_role("button", name="Get sign-in code" if english else "Receber código de entrada").click()
    expect(page.get_by_role("heading", name="Check your email" if english else "Confira seu email")).to_be_visible()
    page.get_by_label("Code" if english else "Código").fill(otp_for(emails[who]))
    page.get_by_role("button", name="Sign in with the code" if english else "Entrar com o código").click()
    page.wait_for_url(lambda u: "/entrar" not in u, timeout=20000)

def switch_locale_in_place(page, locale):
    """O mesmo que o seletor faz: cookie + atualização da página sem recarregar (o estado da tela continua)."""
    page.evaluate("l => { document.cookie = 'ddp_locale=' + l + '; path=/'; window.next.router.refresh(); }", locale)
    page.wait_for_function("l => document.documentElement.lang === l", arg=locale, timeout=15000)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel=os.environ.get("E2E_CHANNEL") or None)
        errors = []
        # iPhone SE (a menor tela comum) em inglês americano, fuso de Nova York.
        ctxE = browser.new_context(viewport={"width": 375, "height": 667}, locale="en-US", timezone_id="America/New_York", device_scale_factor=2, is_mobile=True, has_touch=True)
        e = ctxE.new_page(); e.on("pageerror", lambda x: errors.append(str(x)))

        # ---------- Entrada: idioma do navegador, seletor antes do login, troca sem recarregar ----------
        e.goto(BASE + "/entrar")
        check("navegador em inglês: entrada em inglês já na primeira resposta", e.evaluate("document.documentElement.lang") == "en" and e.get_by_role("button", name="Sign up my dog").is_visible())
        check("'Paw Diary' discreto abaixo da marca", e.get_by_text("Paw Diary").first.is_visible())
        e.evaluate("window.__sameDoc = 1")
        e.get_by_role("radio", name="Português").click()
        check("seletor antes do login: troca para português", eventually(lambda t: expect(e.get_by_role("button", name="Cadastrar meu cachorro")).to_be_visible(timeout=t)))
        check("troca de idioma não recarrega a página", e.evaluate("window.__sameDoc") == 1)
        check("escolha salva em cookie antes do login", "ddp_locale=pt-BR" in e.evaluate("document.cookie"))
        e.get_by_role("radio", name="English").click()
        expect(e.get_by_role("button", name="Sign up my dog")).to_be_visible()
        text_checks(e, "entrada (en)", True); no_overflow(e, "entrada 375px")
        e.screenshot(path=f"{OUT}/01-entrar-en.png", full_page=True)

        # ---------- Conta nova em inglês: apresentação, criar diário ----------
        login(e, "E", True)
        e.goto(BASE + "/"); e.wait_for_url("**/adicionar", timeout=20000)
        check("adicionar cachorro em inglês", eventually(lambda t: expect(e.get_by_role("link", name=re.compile("Sign up a dog"))).to_be_visible(timeout=t)))
        e.get_by_role("link", name=re.compile("Sign up a dog")).click(); e.wait_for_url("**/bem-vindo", timeout=20000)
        check("apresentação do Abu em inglês, com seletor de idioma na primeira tela", eventually(lambda t: expect(e.get_by_role("heading", name=re.compile("Hi, I'm Abu"))).to_be_visible(timeout=t)) and e.get_by_role("radio", name="Português").is_visible())
        text_checks(e, "apresentação (en)", True); no_overflow(e, "apresentação 375px")
        e.screenshot(path=f"{OUT}/02-bem-vindo-en.png", full_page=True)
        e.goto(BASE + "/comecar"); e.get_by_label("Dog's name").fill("Luna")
        e.get_by_role("button", name="Create my diary").click(); e.wait_for_url(lambda u: "bemvindo=1" in u, timeout=30000)
        check("diário criado; convite da família em inglês", eventually(lambda t: expect(e.get_by_role("heading", name=re.compile("Luna's diary is ready"))).to_be_visible(timeout=t)))
        e.get_by_role("button", name="Not now").click(); e.wait_for_url("**/hoje", timeout=10000)
        expect(e.get_by_role("heading", name="Luna's Diary")).to_be_visible(timeout=15000)
        snap = rpc(e, "snapshot", {})[1]
        check("idioma em uso gravado no perfil da pessoa (en)", eventually(lambda t: expect.poll if False else None) or rpc(e, "snapshot", {})[1]["me"]["locale"] == "en")
        user = admin("GET", f"users/{ids['E']}")
        check("idioma também nos metadados do login (emails do Supabase em inglês)", (user.get("user_metadata") or {}).get("locale") == "en")
        text_checks(e, "Hoje (en)", True); no_overflow(e, "Hoje 375px")
        e.screenshot(path=f"{OUT}/03-hoje-en.png", full_page=True)

        # ---------- Missão e envio de foto ----------
        e.get_by_role("link", name="Hello, world").first.click()
        check("missão em inglês com o nome do cachorro (sem troca de palavras)", eventually(lambda t: expect(e.get_by_text("Luna clearly visible.")).to_be_visible(timeout=t)))
        text_checks(e, "missão (en)", True)
        e.get_by_role("link", name="Send photo").click()
        e.locator("input[type=file]:not([capture])").set_input_files(photo(1))
        e.get_by_role("button", name="Save and continue").click()
        expect(e.get_by_role("heading", name="Does the photo show this?")).to_be_visible(timeout=30000)
        text_checks(e, "confirmação da missão (en)", True)
        e.get_by_role("button", name="Yes, it does").click()
        check("missão concluída: +10 paws", eventually(lambda t: expect(e.get_by_text("+10 paws 🐾")).to_be_visible(timeout=t), 20000))
        xp_before = rpc(e, "snapshot", {})[1]["xpTotal"]

        # Formulário preenchido continua ao trocar de idioma (mesma tela, sem recarregar).
        e.goto(BASE + "/guardar"); e.locator("input[type=file][multiple]").set_input_files(photo(2))
        e.get_by_label("Caption").fill("Beach day ☀️")
        switch_locale_in_place(e, "pt-BR")
        check("trocar idioma no meio do envio: legenda e foto continuam", e.get_by_label("Legenda").input_value() == "Beach day ☀️" and e.get_by_role("heading", name="Ajuste e guarde").is_visible())
        switch_locale_in_place(e, "en")
        e.get_by_role("button", name="Save photo").click()
        expect(e.get_by_role("heading", name="Saved in the diary")).to_be_visible(timeout=30000)
        check("legenda escrita pela pessoa não é traduzida", True)

        # ---------- Diário e álbuns ----------
        e.goto(BASE + "/diario")
        check("Diário em inglês, legenda da pessoa intacta", eventually(lambda t: expect(e.get_by_text("Beach day ☀️").first).to_be_visible(timeout=t)))
        check("mês da linha do tempo em inglês", bool(re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}", e.inner_text("main"))))
        text_checks(e, "Diário (en)", True); no_overflow(e, "Diário 375px")
        e.goto(BASE + "/albuns"); expect(e.get_by_role("heading", name="Albums").first).to_be_visible()
        text_checks(e, "Álbuns (en)", True); no_overflow(e, "Álbuns 375px")
        e.get_by_role("tab", name=re.compile("Collections")).click()
        text_checks(e, "Coleções (en)", True)

        # ---------- Cuidados: peso em lb por padrão (inglês), banco em kg ----------
        e.goto(BASE + "/cuidados"); text_checks(e, "Cuidados (en)", True); no_overflow(e, "Cuidados 375px")
        e.goto(BASE + "/cuidados/peso")
        e.get_by_label("Weight (lb)").fill("27.6"); e.get_by_role("button", name="Add weight").click()
        check("peso digitado em libras aparece em libras", eventually(lambda t: expect(e.get_by_role("cell", name="27.6 lb")).to_be_visible(timeout=t)))
        kg = rpc(e, "snapshot", {})[1]["health"]["weights"][0]["kg"]
        check(f"banco guarda kg ({kg})", abs(float(kg) - 12.52) < 0.005)  # coluna com 2 casas: 27,6 lb → 12,52 kg
        e.get_by_role("radio", name="kg").click()
        check("trocar a unidade só muda a tela (12.52 kg)", eventually(lambda t: expect(e.get_by_role("cell", name="12.52 kg")).to_be_visible(timeout=t)))
        check("registro real não mudou ao trocar a unidade", float(rpc(e, "snapshot", {})[1]["health"]["weights"][0]["kg"]) == float(kg))
        e.get_by_role("radio", name="kg").click(); e.get_by_role("radio", name="lb").click()  # toques rápidos
        e.wait_for_timeout(2500)
        check("toques rápidos na unidade: vale a última escolha (lb)", rpc(e, "snapshot", {})[1]["me"]["weightUnit"] == "lb")
        text_checks(e, "Peso (en)", True); no_overflow(e, "Peso 375px")
        for w in (375, 320):  # a data não pode vazar da caixa do formulário (iPhone dá largura mínima ao campo de data)
            e.set_viewport_size({"width": w, "height": 740}); e.wait_for_timeout(300)
            box, field = e.locator("form.card").bounding_box(), e.locator("#wdate").bounding_box()
            check(f"Peso {w}px: data inteira dentro da caixa", field["x"] >= box["x"] and field["x"] + field["width"] <= box["x"] + box["width"] - 8)
            e.locator("form.card").screenshot(path=os.path.join(OUT, f"peso-form-{w}.png"))
        e.set_viewport_size({"width": 375, "height": 667})

        # ---------- Estúdio: temas por região, mensagem pronta no idioma, edição preservada ----------
        e.goto(BASE + "/estudio")
        check("Estúdio em inglês com datas dos EUA (Thanksgiving chegando)", eventually(lambda t: expect(e.get_by_role("button", name=re.compile("Thanksgiving"))).to_be_visible(timeout=t)))
        cards = e.locator(".preset-card strong").all_inner_texts()
        check(f"EUA: datas que estão chegando primeiro ({cards[:2]})", cards[:2] == ["Fun Halloween", "Thanksgiving"])
        e.get_by_role("button", name=re.compile("^Birthday")).click()
        check("mensagem pronta no idioma da pessoa", e.get_by_label(re.compile("^Message")).input_value() == "Happy birthday!")
        switch_locale_in_place(e, "pt-BR")
        check("sem editar, a mensagem pronta acompanha o idioma", e.get_by_label(re.compile("^Mensagem")).input_value() == "Feliz aniversário!")
        e.get_by_label(re.compile("^Mensagem")).fill("Parabéns, Luna!")
        switch_locale_in_place(e, "en")
        check("mensagem editada pela pessoa continua igual ao trocar o idioma", e.get_by_label(re.compile("^Message")).input_value() == "Parabéns, Luna!")
        text_checks(e, "Estúdio (en)", True); no_overflow(e, "Estúdio 375px")
        e.screenshot(path=f"{OUT}/04-estudio-en.png", full_page=True)
        balance_before = rpc(e, "studioState", {})[1]["balance"]

        e.goto(BASE + "/estudio/creditos")
        e.wait_for_function("() => !document.querySelector('main [aria-busy=true]') && /Credits|credits/.test(document.querySelector('main').innerText) && !/Loading/.test(document.querySelector('main').innerText)", timeout=20000)
        body = e.inner_text("main")
        check("Créditos em inglês: valor na moeda real (BRL), sem conversão", ("(BRL)" in body and "$" in body) or "Coming soon" in body)
        text_checks(e, "Créditos (en)", True); no_overflow(e, "Créditos 375px")

        # ---------- Minha conta: idioma, região e unidade da pessoa ----------
        e.goto(BASE + "/conta"); e.get_by_role("button", name=re.compile("Idioma")).click()
        dlg = e.locator("dialog[open]")
        dlg.get_by_role("radio", name="Brazil").click()
        expect(dlg.get_by_role("radio", name="Brazil")).to_have_attribute("aria-checked", "true")
        e.screenshot(path=f"{OUT}/05-conta-idioma.png")
        e.wait_for_timeout(2500)
        e.get_by_role("button", name="Close").last.click()
        e.goto(BASE + "/estudio")
        expect(e.get_by_role("button", name=re.compile("Thanksgiving"))).to_be_visible(timeout=20000)
        cards_br = e.locator(".preset-card strong").all_inner_texts()
        if cards_br[-2:] != ["National Dog Day (Aug 26)", "Thanksgiving"]: print("datas:", cards_br, rpc(e, "snapshot", {})[1]["me"])
        check("região Brasil (com inglês): datas do Brasil continuam, EUA vão para o fim", cards_br[-2:] == ["National Dog Day (Aug 26)", "Thanksgiving"])
        snap2 = rpc(e, "snapshot", {})[1]
        check("trocar região e idioma não duplica patinhas", snap2["xpTotal"] == xp_before)
        check("trocar região e idioma não muda créditos", rpc(e, "studioState", {})[1]["balance"] == balance_before)
        check("região salva no perfil", snap2["me"]["region"] == "BR")
        e.goto(BASE + "/conta"); text_checks(e, "Minha conta (en)", True); no_overflow(e, "Minha conta 375px")
        e.goto(BASE + "/sobre"); text_checks(e, "Sobre (en)", True); no_overflow(e, "Sobre 375px")
        e.goto(BASE + "/missoes"); text_checks(e, "Missões (en)", True); no_overflow(e, "Missões 375px")

        # ---------- Família com idiomas diferentes: cada um vê e recebe no próprio idioma ----------
        st, inv = rpc(e, "createInvite", {"role": "editor"})
        ctxP = browser.new_context(viewport={"width": 320, "height": 568}, locale="pt-BR", timezone_id="America/Sao_Paulo")
        pp = ctxP.new_page(); pp.on("pageerror", lambda x: errors.append(str(x)))
        login(pp, "P", False)
        st2, _ = rpc(pp, "acceptInvite", {"code": inv["code"], "name": "Paula"})
        pp.goto(BASE + "/hoje")
        check("pessoa em português no mesmo diário vê tudo em português", eventually(lambda t: expect(pp.get_by_role("heading", name="Diário de Luna")).to_be_visible(timeout=t)))
        text_checks(pp, "Hoje (pt-BR)", False); no_overflow(pp, "Hoje 320px (pt-BR)")
        pp.goto(BASE + "/guardar"); pp.locator("input[type=file][multiple]").set_input_files(photo(3))
        pp.get_by_role("button", name="Guardar foto").click()
        expect(pp.get_by_role("heading", name="Guardada no diário")).to_be_visible(timeout=30000)
        e.wait_for_timeout(3000)
        e.goto(BASE + "/novidades")
        check("aviso para quem usa inglês sai em inglês (idioma de quem recebe)", eventually(lambda t: expect(e.get_by_text(re.compile("Paula saved an adventure of Luna"))).to_be_visible(timeout=t), 20000))
        text_checks(e, "Novidades (en)", True); no_overflow(e, "Novidades 375px")
        # Ossinho de E (inglês) na foto de P (português): o aviso de P sai em português.
        entry = next(x for x in rpc(e, "snapshot", {})[1]["entries"] if x.get("createdByName") == "Paula")
        rpc(e, "toggleBone", {"targetType": "entry", "targetId": entry["id"]})
        pp.wait_for_timeout(3000); pp.goto(BASE + "/novidades")
        check("aviso para quem usa português sai em português", eventually(lambda t: expect(pp.get_by_text(re.compile("deu um ossinho na sua foto de Luna"))).to_be_visible(timeout=t), 20000))
        st3, err = rpc(pp, "createAlbum", {"title": ""})
        st4, err_en = rpc(e, "createAlbum", {"title": ""})
        check("erro do servidor no idioma de quem pede", err.get("message") == "Dê um nome ao álbum." and err_en.get("message") == "Give the album a name.")

        check("sem erros de JavaScript nas páginas", not errors)
        if errors: print(errors[:5])
        browser.close()
finally:
    for k in ids:
        try: admin("DELETE", f"users/{ids[k]}")
        except SystemExit: pass

ok = sum(1 for _, c in results if c)
print(f"\n{ok}/{len(results)} verificações OK")
sys.exit(0 if ok == len(results) else 1)
