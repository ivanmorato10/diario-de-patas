"""E2E da compra em dólar (região EUA) com o Stripe em MODO DE TESTE, contra um projeto Supabase de verdade.
Uso: .env.local com STRIPE_SECRET_KEY=sk_test_… e STRIPE_ENABLED=true; `npm run build && npx next start -p 3000 &`;
     python3 scripts/e2e-stripe.py [base_url] [out_dir]
Confere: pacotes em dólar só na região EUA; preço vem do servidor; desistir na página do Stripe não cobra nem dá
créditos; pagar com o cartão de teste 4242 entrega os créditos UMA vez (consultar de novo não duplica); cartão
recusado não entrega nada; o servidor confere valor e moeda com o Stripe. Recusa chave que não seja de teste.
No fim, exclui a conta de teste. Nunca imprime chaves.
"""
import json, os, re, sys, urllib.request, urllib.error, uuid
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
OUT = sys.argv[2] if len(sys.argv) > 2 else "e2e-stripe-out"
os.makedirs(OUT, exist_ok=True)
ROOT = os.path.join(os.path.dirname(__file__), "..")
env = dict(l.strip().split("=", 1) for l in open(os.path.join(ROOT, ".env.local")) if "=" in l and not l.lstrip().startswith("#"))
if not env.get("STRIPE_SECRET_KEY", "").startswith("sk_test_"):
    raise SystemExit("Este teste só roda com a chave de TESTE do Stripe (sk_test_…).")
URL, SERVICE = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]

def admin(method, path, body=None):
    req = urllib.request.Request(f"{URL}/auth/v1/admin/{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"apikey": SERVICE, "authorization": f"Bearer {SERVICE}", "content-type": "application/json"})
    with urllib.request.urlopen(req) as r: return json.loads(r.read() or b"null")

def stripe_get(path):
    req = urllib.request.Request(f"https://api.stripe.com/v1/{path}", headers={"authorization": f"Bearer {env['STRIPE_SECRET_KEY']}"})
    with urllib.request.urlopen(req) as r: return json.loads(r.read())

results = []
def check(name, cond):
    results.append((name, bool(cond))); print(("OK  " if cond else "FAIL"), name)
def eventually(fn, timeout=20000):
    try: fn(timeout); return True
    except AssertionError: return False

def rpc(page, method, args):
    return page.evaluate("""async ([m, a]) => { const r = await fetch('/api/rpc/' + m, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(a)}); return [r.status, await r.json().catch(() => null)]; }""", [method, args])

def fill_card(page, number):
    """Página do Stripe (checkout.stripe.com), modo de teste: cartão de teste publicado pelo Stripe."""
    page.wait_for_url(re.compile(r"checkout\.stripe\.com"), timeout=30000)
    card = page.locator("#cardNumber")
    if not card.is_visible():  # às vezes o cartão fica dentro de uma opção de pagamento
        page.get_by_text(re.compile("^Card$")).first.click()
    card.wait_for(timeout=30000)
    card.fill(number); page.locator("#cardExpiry").fill("12 / 34"); page.locator("#cardCvc").fill("123")
    page.locator("#billingName").fill("Test Buyer")
    if page.locator("#billingCountry").count(): page.locator("#billingCountry").select_option("US")
    if page.locator("#billingPostalCode").count(): page.locator("#billingPostalCode").fill("10001")
    if page.locator("#enableStripePass").count() and page.locator("#enableStripePass").is_checked(): page.locator("#enableStripePass").uncheck()
    page.locator("[data-testid=hosted-payment-submit-button], .SubmitButton").first.click()

email = f"e2e-stripe-{uuid.uuid4().hex[:8]}@diariodepatas.test"
uid = admin("POST", "users", {"email": email, "email_confirm": True})["id"]
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel=os.environ.get("E2E_CHANNEL") or None)
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="en-US", timezone_id="America/New_York", is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.goto(BASE + "/hoje"); pg.wait_for_url("**/entrar*")
        pg.get_by_role("button", name="I already have an account").click(); pg.get_by_role("button", name="Sign in with email").click()
        pg.get_by_role("button", name="I'd rather get a code by email").click()
        pg.get_by_label("Your email").fill(email)
        pg.route("**/auth/v1/otp*", lambda r: r.fulfill(status=200, content_type="application/json", body="{}"))
        pg.get_by_role("button", name="Get sign-in code").click()
        pg.get_by_label("Code").fill(admin("POST", "generate_link", {"type": "magiclink", "email": email})["email_otp"])
        pg.get_by_role("button", name="Sign in with the code").click(); pg.wait_for_url(lambda u: "/entrar" not in u, timeout=30000)
        pg.unroute_all()
        api = ctx.new_page(); api.goto(BASE + "/sobre")  # aba só para consultar o servidor (a outra vai ao Stripe)
        rpc(api, "setMyName", {"name": "Tester"})
        rpc(api, "createDiary", {"timezone": "America/New_York", "name": "Luna", "birthDate": None, "preferences": {"home": True, "outdoor": True, "people": True, "socialDogs": False}})
        rpc(api, "setPreferences", {"locale": "en", "region": "US", "weightUnit": "lb"})
        balance0 = rpc(api, "studioState", {})[1]["balance"]

        # ---------- Loja em dólar ----------
        pg.goto(BASE + "/estudio/creditos")
        check("região EUA: pacotes em dólar", eventually(lambda t: expect(pg.get_by_role("radio", name=re.compile(r"5 credits.*\$2\.99"))).to_be_visible(timeout=t)))
        body = pg.inner_text("main")
        check("preços aprovados ($0.99 · $2.99 · $4.99), sem reais", all(x in body for x in ("$0.99", "$2.99", "$4.99")) and "R$" not in body and "BRL" not in body)
        check("aviso de modo de teste visível", "Test mode" in body)
        pg.screenshot(path=f"{OUT}/01-loja-usd.png", full_page=True)
        st, err = rpc(api, "createPurchase", {"packageId": "p99", "idempotencyKey": str(uuid.uuid4())})
        check(f"pacote inexistente recusado pelo servidor ({st})", st == 400)

        # ---------- Desistir na página do Stripe: nada cobrado, nenhum crédito ----------
        pg.get_by_role("radio", name=re.compile(r"1 credit.*\$0\.99")).tap()
        pg.get_by_role("button", name=re.compile(r"Pay by card")).tap()
        pg.wait_for_url(re.compile(r"checkout\.stripe\.com"), timeout=30000)
        check("abre a página de pagamento do Stripe", "checkout.stripe.com" in pg.url)
        check("Stripe mostra $0.99", eventually(lambda t: expect(pg.get_by_text("$0.99").first).to_be_visible(timeout=t)))
        pg.screenshot(path=f"{OUT}/02-stripe.png", full_page=True)
        pg.go_back()  # volta sem pagar (o "voltar" do Stripe leva ao cancel_url; o do navegador, à loja)
        pg.goto(BASE + "/estudio/creditos")
        shop = rpc(api, "creditShop", {})[1]
        pend = [x for x in shop["purchases"] if x["status"] == "pending"]
        check("compra sem pagar fica pendente, com 'continuar pagamento'", len(pend) == 1 and pend[0]["checkoutUrl"] and pend[0]["currency"] == "USD" and pend[0]["amountCents"] == 99)
        check("tela oferece continuar o pagamento", eventually(lambda t: expect(pg.get_by_role("link", name="Continue to payment")).to_be_visible(timeout=t)))
        pg.get_by_role("link", name="Continue to payment").tap()
        pg.wait_for_url(re.compile(r"checkout\.stripe\.com"), timeout=30000)
        # Desistir pelo link do próprio Stripe (cancel_url)
        back = pg.locator("a[href*='pagamento=cancelado'], [data-testid=business-link]").first
        if back.count():
            back.click()
        else:
            pg.goto(BASE + f"/estudio/creditos?compra={pend[0]['id']}&pagamento=cancelado")
        pg.wait_for_url(re.compile(re.escape(BASE)), timeout=30000)
        check("voltar do Stripe sem pagar: 'não concluído, nada cobrado'", eventually(lambda t: expect(pg.get_by_text("You weren't charged").first).to_be_visible(timeout=t)))
        check("sem pagar, nenhum crédito", rpc(api, "studioState", {})[1]["balance"] == balance0)
        pg.get_by_role("button", name="Choose another package").tap()

        # ---------- Cartão recusado ----------
        pg.get_by_role("radio", name=re.compile(r"5 credits.*\$2\.99")).tap()
        pg.get_by_role("button", name=re.compile(r"Pay by card")).tap()
        fill_card(pg, "4000 0000 0000 0002")
        check("cartão recusado: o Stripe avisa e não sai da página", eventually(lambda t: expect(pg.get_by_text(re.compile("declined", re.I)).first).to_be_visible(timeout=t), 30000) and "checkout.stripe.com" in pg.url)
        check("cartão recusado: nenhum crédito", rpc(api, "studioState", {})[1]["balance"] == balance0)

        # ---------- Cartão aprovado ----------
        pg.locator("#cardNumber").fill("4242 4242 4242 4242")
        pg.locator("[data-testid=hosted-payment-submit-button], .SubmitButton").first.click()
        pg.wait_for_url(re.compile(re.escape(BASE) + r".*/estudio/creditos"), timeout=60000)
        check("pago: volta para o app e confirma", eventually(lambda t: expect(pg.get_by_text("Payment confirmed").first).to_be_visible(timeout=t), 40000))
        pg.screenshot(path=f"{OUT}/03-pago.png", full_page=True)
        bal1 = rpc(api, "studioState", {})[1]["balance"]
        check(f"+5 créditos ({balance0} → {bal1})", bal1 == balance0 + 5)
        shop = rpc(api, "creditShop", {})[1]
        paid = next(x for x in shop["purchases"] if x["status"] == "approved")
        for _ in range(3): rpc(api, "purchaseStatus", {"id": paid["id"]})
        check("consultar de novo não duplica os créditos", rpc(api, "studioState", {})[1]["balance"] == bal1)
        check("compra gravada em USD, 299 centavos", paid["currency"] == "USD" and paid["amountCents"] == 299 and paid["credits"] == 5)
        check("histórico mostra $2.99 pago", eventually(lambda t: expect(pg.get_by_text(re.compile(r"5 credits · \$2\.99"))).to_be_visible(timeout=t)))

        # ---------- O valor cobrado no Stripe é o do servidor ----------
        sessions = stripe_get("checkout/sessions?limit=10")["data"]
        mine = [s for s in sessions if s.get("client_reference_id") == paid["id"]]
        check("Stripe confirma: $2.99 em USD, pago, com a referência da compra", len(mine) == 1 and mine[0]["amount_total"] == 299 and mine[0]["currency"] == "usd" and mine[0]["payment_status"] == "paid")

        # ---------- Região Brasil continua no Pix (em reais) ----------
        rpc(api, "setPreferences", {"region": "BR"})
        shop_br = rpc(api, "creditShop", {})[1]
        check("região Brasil: reais pelo Mercado Pago (não Stripe)", shop_br["currency"] == "BRL" and shop_br["provider"] == "mercadopago")
        browser.close()
finally:
    try: admin("DELETE", f"users/{uid}")
    except Exception: pass

ok = sum(1 for _, c in results if c)
print(f"\n{ok}/{len(results)} verificações OK")
sys.exit(0 if ok == len(results) else 1)
