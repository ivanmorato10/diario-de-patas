"""E2E da compra de créditos com Pix de TESTE (PAYMENTS_FAKE=1, só local; nenhum dinheiro).
Uso: STUDIO_ALLOW_FAKE=1 PAYMENTS_ENABLED=true PAYMENTS_FAKE=1 npx next start -p 3000 &  python3 scripts/e2e-payments.py [base] [out]
"""
import io, json, os, re, sys, tempfile, urllib.request, uuid
from PIL import Image
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
OUT = sys.argv[2] if len(sys.argv) > 2 else "e2e-payments-out"; os.makedirs(OUT, exist_ok=True)
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
    pg.goto(BASE + "/comecar"); pg.get_by_label("Nome do cachorro").fill("Luna"); pg.get_by_role("button", name="Criar meu diário").click(); pg.wait_for_url(lambda u: "bemvindo=1" in u, timeout=30000); pg.get_by_role("button", name="Agora não").click(); pg.wait_for_url("**/hoje", timeout=10000)

    # ---------- Loja: Pix de teste (PAYMENTS_FAKE=1, nenhum dinheiro) ----------
    before = rpc("studioState", {})[1]["balance"]
    pg.goto(BASE + "/estudio"); expect(pg.get_by_role("link", name="Comprar mais")).to_be_visible(timeout=20000)
    pg.get_by_role("link", name="Comprar mais").click(); pg.wait_for_url("**/estudio/creditos")
    expect(pg.get_by_text("Modo de teste")).to_be_visible(timeout=20000)
    check("3 pacotes com preços em reais", pg.get_by_text("R$ 4,90").count() >= 1 and pg.get_by_text("R$ 7,90").count() >= 1 and pg.get_by_text("R$ 19,90").count() >= 1)
    pg.screenshot(path=f"{OUT}/01-pacotes.png", full_page=True)
    st, body = rpc("createPurchase", {"packageId": "p15", "idempotencyKey": "not-a-uuid"})
    check(f"pedido malformado recusado ({st})", st == 400)
    st, body = rpc("fakePayPurchase", {"id": str(uuid.uuid4())})
    check(f"não paga compra de outra pessoa ({st})", st == 404)
    pg.get_by_role("radio", name=re.compile("15")).click()
    pg.get_by_role("button", name=re.compile("Pagar com Pix")).click()
    expect(pg.get_by_label("Pix copia e cola")).to_be_visible(timeout=20000)
    check("Pix gerado com copia e cola e prazo", pg.get_by_text("Aguardando o pagamento").is_visible() and pg.get_by_text(re.compile("Vence em")).is_visible())
    pg.screenshot(path=f"{OUT}/02-pix.png", full_page=True)
    pg.get_by_role("button", name="Simular pagamento (só no teste)").click()
    expect(pg.get_by_text("+15 créditos!")).to_be_visible(timeout=20000)
    after = rpc("studioState", {})[1]["balance"]
    check(f"créditos entraram ({before} → {after})", after == before + 15)
    pg.screenshot(path=f"{OUT}/03-pago.png", full_page=True)
    shop = rpc("creditShop", {})[1]
    pid = shop["purchases"][0]["id"]
    rpc("fakePayPurchase", {"id": pid}); rpc("purchaseStatus", {"id": pid})
    check("pagar de novo não dá crédito em dobro", rpc("studioState", {})[1]["balance"] == after)
    check("histórico mostra a compra paga", shop["purchases"][0]["status"] == "approved" and pg.get_by_text("Pago").count() >= 1)

    pg.goto(BASE + "/conta"); pg.get_by_role("button", name="🗑️ Excluir minha conta").click(); pg.get_by_label("Para confirmar").fill("EXCLUIR"); pg.get_by_role("button", name="Excluir minha conta", exact=True).click(); pg.wait_for_timeout(4000)
    check("conta de teste excluída (compras junto)", not any(u["email"] == email for u in admin("GET", "users?per_page=200")["users"]))
    check(f"sem erros de página ({errors[:2]})", not errors)
    b.close()
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} verificações OK"); sys.exit(1 if failed else 0)
