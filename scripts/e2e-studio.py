"""E2E do Estúdio em modo real com o GERADOR DE TESTE (STUDIO_ALLOW_FAKE=1, só local; não é IA).
Uso: STUDIO_ALLOW_FAKE=1 STUDIO_TEST_CREDITS=4 npx next start -p 3000 &  python3 scripts/e2e-studio.py [base] [out]
Testa o fluxo, créditos e acabamentos sem gastar com o provedor. A qualidade real é avaliada por scripts/studio-eval.ts.
"""
import io, json, os, re, sys, tempfile, urllib.request, uuid
from PIL import Image
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
OUT = sys.argv[2] if len(sys.argv) > 2 else "e2e-studio-out"; os.makedirs(OUT, exist_ok=True)
env = dict(l.strip().split("=", 1) for l in open(".env.local") if "=" in l and not l.startswith("#"))
URL, K = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": K, "authorization": f"Bearer {K}", "content-type": "application/json"}
def http(method, url, body=None, extra=None):
    r = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None, headers={**H, **(extra or {})})
    with urllib.request.urlopen(r) as resp:
        raw = resp.read(); return json.loads(raw) if raw else None
admin = lambda m, p, b=None: http(m, f"{URL}/auth/v1/admin/{p}", b)
rest = lambda m, p, b=None, extra=None: http(m, f"{URL}/rest/v1/{p}", b, extra)
results = []
def check(name, cond):
    results.append((name, bool(cond))); print(("OK  " if cond else "FAIL"), name)
tmp = tempfile.mkdtemp(); photo = os.path.join(tmp, "abu.jpg"); Image.new("RGB", (640, 480), (120, 90, 60)).save(photo, "JPEG")
email = f"e2e-a-{uuid.uuid4().hex[:8]}@diariodepatas.test"; admin("POST", "users", {"email": email, "email_confirm": True})

with sync_playwright() as p:
    b = p.chromium.launch(channel=os.environ.get("E2E_CHANNEL") or None)
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR", timezone_id="America/Sao_Paulo", accept_downloads=True)
    pg = ctx.new_page(); errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    rpc = lambda m, a: pg.evaluate("async ([m, a]) => { const r = await fetch('/api/rpc/' + m, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(a)}); return [r.status, await r.json().catch(() => null)]; }", [m, a])
    pg.goto(BASE + "/hoje"); pg.wait_for_url("**/entrar?next=*")
    pg.route("**/auth/v1/otp*", lambda route: route.fulfill(status=200, content_type="application/json", body="{}"))
    pg.get_by_role("button", name="Já tenho conta").click(); pg.get_by_role("button", name="Entrar com email").click(); pg.get_by_role("button", name="Prefiro receber um código no email").click(); pg.get_by_label("Seu email").fill(email); pg.get_by_role("button", name="Receber código de entrada").click()
    pg.get_by_label("Código").fill(admin("POST", "generate_link", {"type": "magiclink", "email": email})["email_otp"])
    pg.get_by_role("button", name="Entrar com o código").click(); pg.wait_for_url(lambda u: "/entrar" not in u, timeout=20000)
    pg.goto(BASE + "/comecar"); pg.get_by_label("Nome do cachorro").fill("Luna"); pg.get_by_role("button", name="Criar meu diário").click(); pg.wait_for_url("**/hoje", timeout=30000)
    pg.goto(BASE + "/guardar"); pg.locator("input[type=file][multiple]").set_input_files(photo); pg.get_by_role("button", name="Guardar foto").click()
    expect(pg.get_by_role("heading", name="Guardada no diário")).to_be_visible(timeout=30000)

    pg.goto(BASE + "/estudio")
    expect(pg.get_by_text("4 disponíveis")).to_be_visible(timeout=20000)
    check("Estúdio com 4 abas e créditos de teste", pg.get_by_role("tab").count() == 4)
    pg.screenshot(path=f"{OUT}/01-estudio.png", full_page=True)
    def make(tab, label):
        pg.goto(BASE + "/estudio"); expect(pg.get_by_text("Seus créditos")).to_be_visible(timeout=20000)
        pg.locator(".photo-strip__item").first.click(); pg.get_by_role("tab", name=tab).click()
        pg.get_by_role("button", name=label, exact=False).first.click()
        pg.get_by_role("button", name="Criar arte").click()
        if label == "Aniversário":
            pg.wait_for_timeout(3500); pg.screenshot(path=f"{OUT}/01b-criando.png")
        expect(pg.get_by_text("Arte do Estúdio").first).to_be_visible(timeout=90000)
        pg.wait_for_timeout(1500)
    make("Datas", "Aniversário")
    check("arte de aniversário pronta, ao lado da foto original", pg.get_by_text("Foto original").is_visible() and pg.get_by_text("Cada arte é única").is_visible())
    pg.screenshot(path=f"{OUT}/02-aniversario.png", full_page=True)
    snap = rpc("snapshot", {})[1]
    art = [e for e in snap["entries"] if e["source"] == "studio"]
    check("arte salva no diário como estúdio, no álbum Datas especiais", len(art) == 1 and any(a["albumId"] == "datas-especiais" and a["entryId"] == art[0]["id"] for a in snap["albumEntries"]))
    st, body = rpc("submitMission", {"requestKey": str(uuid.uuid4()), "missionId": "M01", "entryId": art[0]["id"], "status": "approved"})
    check(f"arte não conclui missão ({st})", st == 400)
    state = rpc("studioState", {})[1]
    check(f"crédito consumido só uma vez (saldo {state['balance']})", state["balance"] == 3)

    # Duplo clique / retry: mesma chave → mesmo job, cobra uma vez.
    key = str(uuid.uuid4()); photo_id = [e for e in snap["entries"] if e["source"] != "studio"][0]["id"]
    j1 = rpc("studioCreateJob", {"entryId": photo_id, "presetId": "aquarela", "idempotencyKey": key})[1]
    j2 = rpc("studioCreateJob", {"entryId": photo_id, "presetId": "aquarela", "idempotencyKey": key})[1]
    pg.wait_for_timeout(6000)
    state = rpc("studioState", {})[1]
    check(f"duplo clique: mesmo job e uma cobrança (saldo {state['balance']})", j1["id"] == j2["id"] and state["balance"] == 2)

    make("Formatos", "Figurinha para WhatsApp")
    job = [j for j in rpc("studioState", {})[1]["jobs"] if j["presetId"] == "figurinha"][0]
    raw = pg.evaluate("id => fetch('/api/media/' + id).then(r => r.arrayBuffer()).then(b => Array.from(new Uint8Array(b)))", job["outputMediaId"])
    im = Image.open(io.BytesIO(bytes(raw)))
    check(f"figurinha WebP {im.size} com transparência e {len(raw)//1024} KB", im.format == "WEBP" and im.size == (512, 512) and im.mode == "RGBA" and len(raw) <= 100 * 1024)
    pg.screenshot(path=f"{OUT}/03-figurinha.png", full_page=True)

    make("Formatos", "Cartão com mensagem")
    pg.wait_for_timeout(2000)
    is_png = pg.evaluate("() => { const i = document.querySelector('img.studio-art:not(.skeleton)[alt^=\"Arte\"]'); return i ? fetch(i.src).then(r => r.blob()).then(b => b.type) : null }")
    check(f"cartão composto pelo app ({is_png})", is_png == "image/png")
    pg.screenshot(path=f"{OUT}/04-cartao.png", full_page=True)

    # Desligar um preset (tabela studio_presets) o tira do app, sem deploy.
    rest("POST", "studio_presets", {"id": "vitral", "enabled": False}, {"prefer": "resolution=merge-duplicates"})
    # A tela mostra antes o último estado salvo; espera a resposta do servidor.
    with pg.expect_response(lambda r: "/api/rpc/studioState" in r.url, timeout=30000):
        pg.goto(BASE + "/estudio")
    pg.wait_for_timeout(500); expect(pg.get_by_text("Seus créditos")).to_be_visible(timeout=20000); pg.get_by_role("tab", name="Estilos").click()
    panel = pg.get_by_role("tabpanel")
    check("preset desligado some do app", panel.get_by_role("button", name="Vitral").count() == 0 and panel.get_by_role("button", name="Aquarela").count() == 1)
    rest("DELETE", "studio_presets?id=eq.vitral")
    st, body = rpc("studioCreateJob", {"entryId": photo_id, "presetId": "pixel", "idempotencyKey": str(uuid.uuid4())})
    check(f"sem créditos: pedido recusado ({st}, {body and body.get('code')})", st == 400 and body.get("code") == "NO_CREDITS")
    pg.goto(BASE + "/config"); pg.get_by_label("Para confirmar").fill("Luna"); pg.get_by_role("button", name="Excluir minha conta").click(); pg.wait_for_timeout(4000)
    check("conta de teste excluída", not any(u["email"] == email for u in admin("GET", "users?per_page=200")["users"]))
    check(f"sem erros de página ({errors[:2]})", not errors)
    b.close()
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} verificações OK"); sys.exit(1 if failed else 0)
