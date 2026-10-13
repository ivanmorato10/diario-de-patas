"""E2E da importação do diário demo para a conta (MUDANCAS-V2 §8.2). Duas fases no MESMO navegador
(perfil persistente, mesma origem):  fase "demo" com o app em modo demonstração; fase "real" com o app em
modo real (.env.local). Uso: python3 scripts/e2e-import.py demo|real [base_url] [perfil_dir]
"""
import json, os, sys, tempfile, urllib.request, uuid
from PIL import Image
from playwright.sync_api import sync_playwright, expect

PHASE = sys.argv[1]; BASE = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:3000"
PROFILE = sys.argv[3] if len(sys.argv) > 3 else os.path.join(tempfile.gettempdir(), "ddp-import-profile")
tmp = tempfile.mkdtemp()
def photo(i):
    p = os.path.join(tmp, f"p{i}.jpg"); Image.new("RGB", (400, 300), (60 * i % 255, 120, 160)).save(p, "JPEG"); return p
results = []
def check(name, cond):
    results.append((name, bool(cond))); print(("OK  " if cond else "FAIL"), name)

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(PROFILE, channel=os.environ.get("E2E_CHANNEL") or None, viewport={"width": 390, "height": 844}, locale="pt-BR", timezone_id="America/Sao_Paulo")
    pg = ctx.pages[0] if ctx.pages else ctx.new_page()
    errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    if PHASE == "demo":
        pg.goto(BASE + "/comecar"); pg.get_by_label("Nome do cachorro").fill("Luna"); pg.get_by_role("button", name="Criar meu diário").click(); pg.wait_for_url("**/hoje")
        pg.get_by_role("link", name="Olá, mundo").first.click(); pg.get_by_role("link", name="Enviar foto").click()
        pg.locator("input[type=file]:not([capture])").set_input_files(photo(1)); pg.get_by_role("button", name="Guardar e continuar").click(); pg.get_by_role("button", name="Sim, mostra").click()
        expect(pg.get_by_text("+10 XP")).to_be_visible()
        pg.goto(BASE + "/guardar"); pg.locator("input[type=file][multiple]").set_input_files(photo(2)); pg.get_by_label("Legenda").fill("Soneca no sofá"); pg.get_by_role("button", name="Guardar foto").click()
        expect(pg.get_by_role("heading", name="Guardada no diário")).to_be_visible()
        pg.goto(BASE + "/albuns"); pg.get_by_role("button", name="Novo álbum").click(); pg.get_by_label("Nome do álbum").fill("Viagem à praia"); pg.get_by_role("dialog").get_by_role("button", name="Criar álbum").click(); pg.wait_for_url("**/albuns/custom-*")
        pg.get_by_role("button", name="Adicionar fotos do diário").click(); pg.get_by_role("dialog").locator("button[aria-pressed]").first.click(); pg.get_by_role("dialog").get_by_role("button", name="Adicionar 1 foto").click(); pg.wait_for_timeout(400)
        pg.goto(BASE + "/cuidados/vacinas"); pg.get_by_role("button", name="Adicionar registro").click(); pg.get_by_label("Nome").fill("V10"); pg.get_by_role("dialog").get_by_role("button", name="Salvar").click(); pg.wait_for_timeout(400)
        check("diário demo criado neste navegador", True)
    else:
        env = dict(l.strip().split("=", 1) for l in open(".env.local") if "=" in l and not l.startswith("#"))
        URL, K = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
        H = {"apikey": K, "authorization": f"Bearer {K}", "content-type": "application/json"}
        def admin(method, path, body=None):
            r = urllib.request.Request(f"{URL}/auth/v1/admin/{path}", method=method, data=json.dumps(body).encode() if body is not None else None, headers=H)
            return json.loads(urllib.request.urlopen(r).read() or b"null")
        email = f"e2e-a-{uuid.uuid4().hex[:8]}@diariodepatas.test"
        admin("POST", "users", {"email": email, "email_confirm": True})
        pg.goto(BASE + "/hoje"); pg.wait_for_url("**/entrar?next=*")
        pg.route("**/auth/v1/otp*", lambda route: route.fulfill(status=200, content_type="application/json", body="{}"))
        pg.get_by_role("button", name="Já tenho conta").click(); pg.get_by_role("button", name="Entrar com email").click(); pg.get_by_label("Seu email").fill(email); pg.get_by_role("button", name="Receber link de entrada").click()
        pg.get_by_label("Código").fill(admin("POST", "generate_link", {"type": "magiclink", "email": email})["email_otp"])
        pg.get_by_role("button", name="Entrar com o código").click(); pg.wait_for_url(lambda u: "/entrar" not in u, timeout=20000)
        pg.goto(BASE + "/comecar"); pg.wait_for_timeout(2000)
        card = pg.get_by_role("heading", name="O diário de Luna está neste aparelho")
        check("conta nova oferece trazer o diário deste aparelho", card.is_visible())
        pg.get_by_role("button", name="Trazer para a conta").click(); pg.get_by_role("button", name="Confirmar e trazer").click()
        # No cadastro, assim que o diário existe na conta o app segue para Hoje.
        pg.wait_for_url("**/hoje", timeout=120000); pg.wait_for_timeout(3000)
        snap = pg.evaluate("() => fetch('/api/rpc/snapshot', {method:'POST', headers:{'content-type':'application/json'}, body:'{}'}).then(r => r.json())")
        check("na conta: Luna, 2 lembranças, 10 XP, álbum e vacina",
              snap["dog"]["name"] == "Luna" and len(snap["entries"]) == 2 and snap["xpTotal"] == 10 and [a["title"] for a in snap["customAlbums"]] == ["Viagem à praia"] and len(snap["health"]["vaccines"]) == 1)
        check("legenda e álbum preservados", any(e["caption"] == "Soneca no sofá" for e in snap["entries"]) and any(x["albumId"].startswith("custom-") for x in snap["albumEntries"]))
        pg.screenshot(path=os.path.join(tmp, "hoje-importado.png"), full_page=True)
        pg.goto(BASE + "/config"); pg.wait_for_timeout(1500)
        check("depois de importar, o cartão não aparece de novo", pg.get_by_role("heading", name="O diário de Luna está neste aparelho").count() == 0)
        pg.get_by_label("Para confirmar").fill("Luna"); pg.get_by_role("button", name="Excluir minha conta").click(); pg.wait_for_timeout(4000)
        users = admin("GET", "users?per_page=200")["users"]
        check("conta de teste excluída", not any(u["email"] == email for u in users))
        print("print:", os.path.join(tmp, "hoje-importado.png"))
    check(f"sem erros de página ({errors[:2]})", not errors)
    ctx.close()
failed = [n for n, ok in results if not ok]
print(f"{len(results) - len(failed)}/{len(results)} verificações OK"); sys.exit(1 if failed else 0)
