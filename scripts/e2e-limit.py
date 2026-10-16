"""E2E do limite de lembranças (conta real). Sobe o servidor com um limite pequeno, só para o teste:
   DIARY_MAX_ENTRIES=2 STUDIO_ALLOW_FAKE=1 STUDIO_TEST_CREDITS=4 npx next start -p 3000 &
   python3 scripts/e2e-limit.py [base]
Confere: aviso sem mandar apagar, as lembranças continuam visíveis, e o Estúdio recusa ANTES de cobrar.
"""
import json, os, sys, tempfile, urllib.request, uuid
from PIL import Image
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
env = {}
for l in open(os.path.join(os.path.dirname(__file__), "..", ".env.local")):
    if "=" in l and not l.lstrip().startswith("#"):
        k, v = l.strip().split("=", 1); env[k] = v
U, S = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": S, "authorization": f"Bearer {S}", "content-type": "application/json"}
adm = lambda m, p, b=None: json.load(urllib.request.urlopen(urllib.request.Request(f"{U}/auth/v1/admin/{p}", method=m, headers=H, data=json.dumps(b).encode() if b is not None else None)))
results = []
def check(name, cond):
    results.append(bool(cond)); print(("OK  " if cond else "FAIL"), name)
tmp = tempfile.mkdtemp()
def photo(i):
    p = os.path.join(tmp, f"p{i}.jpg"); Image.new("RGB", (480, 360), (40 * i % 255, 140, 170)).save(p, "JPEG"); return p

email = f"e2e-limit-{uuid.uuid4().hex[:6]}@diariodepatas.test"; u = adm("POST", "users", {"email": email, "email_confirm": True})
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel=os.environ.get("E2E_CHANNEL") or None); pg = b.new_page(viewport={"width": 390, "height": 844})
        rpc = lambda m, a: pg.evaluate("async ([m, a]) => { const r = await fetch('/api/rpc/' + m, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(a)}); return [r.status, await r.json().catch(() => null)]; }", [m, a])
        pg.goto(BASE + "/entrar?modo=entrar"); pg.get_by_role("button", name="Entrar com email").click()
        pg.get_by_role("button", name="Prefiro receber um código no email").click(); pg.get_by_label("Seu email").fill(email)
        pg.route("**/auth/v1/otp*", lambda r: r.fulfill(status=200, content_type="application/json", body="{}"))
        pg.get_by_role("button", name="Receber código de entrada").click()
        pg.get_by_label("Código").fill(adm("POST", "generate_link", {"type": "magiclink", "email": email})["email_otp"]); pg.get_by_role("button", name="Entrar com o código").click()
        pg.wait_for_url("**/adicionar", timeout=30000)
        rpc("createDiary", {"timezone": "America/Sao_Paulo", "name": "Pepe", "birthDate": None, "preferences": {"home": True, "outdoor": True, "people": True, "socialDogs": False}})
        for i in (1, 2):
            pg.goto(BASE + "/guardar"); pg.locator("input[type=file][multiple]").set_input_files(photo(i))
            pg.get_by_role("button", name="Guardar foto").click(); expect(pg.get_by_role("heading", name="Guardada no diário")).to_be_visible(timeout=30000)
        # 3ª foto: o servidor recusa sem mandar apagar nada.
        pg.goto(BASE + "/guardar"); pg.locator("input[type=file][multiple]").set_input_files(photo(3))
        pg.get_by_role("button", name="Guardar foto").click()
        expect(pg.get_by_text("Todas continuam guardadas").first).to_be_visible(timeout=30000)
        txt = pg.get_by_text("Todas continuam guardadas").first.inner_text()
        check("limite: mensagem sem 'exclua', com suporte", "exclua" not in txt.lower() and "diariodepatas.app@gmail.com" in txt)
        snap = rpc("snapshot", {})[1]
        check(f"as lembranças continuam lá ({len(snap['entries'])})", len(snap["entries"]) == 2)
        pg.goto(BASE + "/diario"); expect(pg.locator("article.polaroid")).to_have_count(2, timeout=20000)
        check("o Diário continua mostrando tudo", True)
        # Estúdio: recusa ANTES de reservar crédito.
        before = rpc("studioState", {})[1]["balance"]
        st, body = rpc("studioCreateJob", {"entryId": snap["entries"][0]["id"], "presetId": "aniversario", "idempotencyKey": str(uuid.uuid4())})
        after = rpc("studioState", {})[1]["balance"]
        check(f"Estúdio sem espaço recusa ({st}, {body and body.get('code')}) e não cobra ({before} → {after})", st == 400 and body.get("code") == "NO_SPACE" and after == before)
        b.close()
finally:
    adm("DELETE", f"users/{u['id']}")
print(f"\n{sum(results)}/{len(results)} verificações OK")
sys.exit(0 if all(results) else 1)
