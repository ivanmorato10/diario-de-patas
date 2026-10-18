"""E2E dos caminhos difíceis do Pix com um Mercado Pago SIMULADO (nenhum dinheiro, nenhuma chamada real).
Uso: python3 scripts/e2e-pix.py  (sobe o simulador na porta 4010; o app deve rodar com)
   MP_API_BASE=http://127.0.0.1:4010 MP_ACCESS_TOKEN=TEST-simulado PAYMENTS_ENABLED=true npx next start -p 3000 &
Confere: resposta perdida ao criar NÃO cancela e a nova tentativa recupera a MESMA cobrança; recusa clara
cancela; aprovação concede uma vez; estorno retira o que sobrou, uma vez; valor diferente não concede.
"""
import json, os, sys, threading, time, urllib.request, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
env = {}
for l in open(os.path.join(os.path.dirname(__file__), "..", ".env.local")):
    if "=" in l and not l.lstrip().startswith("#"):
        k, v = l.strip().split("=", 1); env[k] = v
U, S = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": S, "authorization": f"Bearer {S}", "content-type": "application/json"}
adm = lambda m, p, b=None: json.load(urllib.request.urlopen(urllib.request.Request(f"{U}/auth/v1/admin/{p}", method=m, headers=H, data=json.dumps(b).encode() if b is not None else None)))
rest = lambda p: json.load(urllib.request.urlopen(urllib.request.Request(f"{U}/rest/v1/{p}", headers=H)))

# ---------- Mercado Pago simulado ----------
MP = {"payments": {}, "by_key": {}, "mode": "ok", "seq": 1000}
class Sim(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))) or b"{}")
        key = self.headers.get("x-idempotency-key")
        mode = MP["mode"]
        if mode == "reject": return self.send(400, {"message": "recusado"})
        # cria (ou devolve a mesma, pela chave de idempotência)
        if key not in MP["by_key"]:
            MP["seq"] += 1; pid = str(MP["seq"])
            MP["payments"][pid] = {"id": int(pid), "status": "pending", "external_reference": body["external_reference"], "transaction_amount": body["transaction_amount"], "currency_id": "BRL",
                                   "date_of_expiration": body.get("date_of_expiration"), "point_of_interaction": {"transaction_data": {"qr_code": f"PIX-SIMULADO-{pid}", "qr_code_base64": None}}}
            MP["by_key"][key] = pid
        if mode == "lost":  # criou, mas a resposta "se perdeu"
            MP["mode"] = "ok"; return self.send(500, {"message": "erro interno"})
        self.send(201, MP["payments"][MP["by_key"][key]])
    def do_GET(self):
        path = self.path.split("?")[0]
        if path.endswith("/payments/search"):
            ref = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("external_reference", [""])[0]
            return self.send(200, {"results": [p for p in MP["payments"].values() if p["external_reference"] == ref]})
        pid = path.rsplit("/", 1)[-1]
        p = MP["payments"].get(pid)
        return self.send(200, p) if p else self.send(404, {"message": "não existe"})
import urllib.parse
srv = ThreadingHTTPServer(("127.0.0.1", 4010), Sim); threading.Thread(target=srv.serve_forever, daemon=True).start()

results = []
def check(name, cond):
    results.append(bool(cond)); print(("OK  " if cond else "FAIL"), name)

email = f"e2e-pix-{uuid.uuid4().hex[:6]}@diariodepatas.test"; u = adm("POST", "users", {"email": email, "email_confirm": True})
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel=os.environ.get("E2E_CHANNEL") or None); pg = b.new_page()
        rpc = lambda m, a: pg.evaluate("async ([m, a]) => { const r = await fetch('/api/rpc/' + m, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(a)}); return [r.status, await r.json().catch(() => null)]; }", [m, a])
        pg.goto(BASE + "/entrar?modo=entrar"); pg.get_by_role("button", name="Entrar com email").click()
        pg.get_by_role("button", name="Prefiro receber um código no email").click(); pg.get_by_label("Seu email").fill(email)
        pg.route("**/auth/v1/otp*", lambda r: r.fulfill(status=200, content_type="application/json", body="{}"))
        pg.get_by_role("button", name="Receber código de entrada").click()
        pg.get_by_label("Código").fill(adm("POST", "generate_link", {"type": "magiclink", "email": email})["email_otp"]); pg.get_by_role("button", name="Entrar com o código").click()
        pg.wait_for_url("**/adicionar", timeout=30000)
        rpc("createDiary", {"timezone": "America/Sao_Paulo", "name": "Pepe", "birthDate": None, "preferences": {"home": True, "outdoor": True, "people": True, "socialDogs": False}})
        bal = lambda: rpc("studioState", {})[1]["balance"]
        start = bal()

        # 1) resposta perdida ao criar: não cancela; nova tentativa (mesma chave) recupera a MESMA cobrança
        key = str(uuid.uuid4()); MP["mode"] = "lost"
        st, body = rpc("createPurchase", {"packageId": "p5", "idempotencyKey": key})
        row = rest(f"credit_purchases?select=id,status,provider_payment_id&idempotency_key=eq.{u['id']}:{key}")[0]
        check(f"resposta perdida: erro para a pessoa ({st}), compra continua pendente ({row['status']})", st == 502 and row["status"] == "pending" and row["provider_payment_id"] is None)
        st, body = rpc("createPurchase", {"packageId": "p5", "idempotencyKey": key})
        check(f"nova tentativa recupera a mesma cobrança ({st}, {body and body.get('pixQr')})", st == 200 and body["pixQr"].startswith("PIX-SIMULADO-") and len(MP["payments"]) == 1)
        pid = body["id"]

        # 2) aprovação concede uma vez
        list(MP["payments"].values())[0]["status"] = "approved"
        rpc("purchaseStatus", {"id": pid}); rpc("purchaseStatus", {"id": pid})
        check(f"aprovado concede 5 uma vez ({start} → {bal()})", bal() == start + 5)

        # 3) estorno depois de aprovado: retira o que sobrou, uma vez
        list(MP["payments"].values())[0]["status"] = "refunded"
        rpc("purchaseStatus", {"id": pid}); rpc("purchaseStatus", {"id": pid})
        r = rest(f"credit_purchases?select=status,refund_applied_at,refund_credits_taken&id=eq.{pid}")[0]
        check(f"estorno aplicado uma vez ({r['refund_credits_taken']} retirados, saldo {bal()})", r["status"] == "refunded" and r["refund_applied_at"] and bal() == start)

        # 4) recusa clara cancela
        MP["mode"] = "reject"; key2 = str(uuid.uuid4())
        st, _ = rpc("createPurchase", {"packageId": "p1", "idempotencyKey": key2})
        r2 = rest(f"credit_purchases?select=status&idempotency_key=eq.{u['id']}:{key2}")[0]
        check(f"recusa clara do Mercado Pago cancela ({st}, {r2['status']})", st == 502 and r2["status"] == "cancelled")
        MP["mode"] = "ok"

        # 5) valor diferente não concede
        key3 = str(uuid.uuid4()); st, body3 = rpc("createPurchase", {"packageId": "p1", "idempotencyKey": key3})
        pay = MP["payments"][MP["by_key"][body3["id"]]]; pay["status"] = "approved"; pay["transaction_amount"] = 0.01
        before = bal(); st, _ = rpc("purchaseStatus", {"id": body3["id"]})
        check(f"pagamento com valor diferente não concede ({st}, saldo {before} → {bal()})", bal() == before)
        b.close()
finally:
    adm("DELETE", f"users/{u['id']}"); srv.shutdown()
print(f"\n{sum(results)}/{len(results)} verificações OK")
sys.exit(0 if all(results) else 1)
