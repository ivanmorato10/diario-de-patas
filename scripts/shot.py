"""Screenshots de conferência com uma conta de teste (criada e apagada pela API de administração).
Uso: python3 scripts/shot.py <pasta_saida> <passos.py> [--adicionar]
Os passos rodam com: pg (página), BASE, OUT, save_photo(cor, tamanho), nonav() (esconde o menu de baixo).
Com --adicionar, tira a foto da tela "Qual é o seu caso?" antes de criar o diário Pepe. Nunca imprime chaves.
"""
import json, urllib.request, uuid, sys, os, tempfile, re
from PIL import Image
from playwright.sync_api import sync_playwright
env = {}
for l in open(os.path.join(os.path.dirname(__file__), "..", ".env.local")):
    if "=" in l and not l.lstrip().startswith("#"):
        k, v = l.strip().split("=", 1); env[k] = v
U, S = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": S, "authorization": f"Bearer {S}", "content-type": "application/json"}
def adm(m, p, b=None):
    return json.load(urllib.request.urlopen(urllib.request.Request(f"{U}/auth/v1/admin/{p}", method=m, headers=H, data=json.dumps(b).encode() if b is not None else None)))
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True); BASE = os.environ.get("BASE", "http://localhost:3000")
email = f"e2e-shot-{uuid.uuid4().hex[:6]}@diariodepatas.test"; u = adm("POST", "users", {"email": email, "email_confirm": True})
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel=os.environ.get("E2E_CHANNEL", "chrome")); pg = b.new_page(viewport={"width": 390, "height": 844})
        pg.goto(BASE + "/entrar?modo=entrar"); pg.get_by_role("button", name="Entrar com email").click()
        pg.get_by_role("button", name="Prefiro receber um código no email").click(); pg.get_by_label("Seu email").fill(email)
        pg.route("**/auth/v1/otp*", lambda r: r.fulfill(status=200, content_type="application/json", body="{}"))
        pg.get_by_role("button", name="Receber código de entrada").click()
        pg.get_by_label("Código").fill(adm("POST", "generate_link", {"type": "magiclink", "email": email})["email_otp"]); pg.get_by_role("button", name="Entrar com o código").click()
        pg.wait_for_url("**/adicionar", timeout=30000)
        if "--adicionar" in sys.argv: pg.wait_for_timeout(1500); pg.screenshot(path=OUT + "/adicionar.png")
        pg.evaluate("""() => fetch('/api/rpc/createDiary',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({timezone:'America/Sao_Paulo',name:'Pepe',birthDate:null,preferences:{home:true,outdoor:true,people:true,socialDogs:false}})})""")
        def save_photo(color=(220, 140, 90), size=(600, 450)):
            f = os.path.join(tempfile.mkdtemp(), "p.jpg"); Image.new("RGB", size, color).save(f, "JPEG")
            pg.goto(BASE + "/guardar"); pg.locator("input[type=file][multiple]").set_input_files(f)
            pg.get_by_role("button", name="Guardar foto").click(); pg.get_by_role("heading", name="Guardada no diário").wait_for(timeout=30000)
        nonav = lambda: pg.add_style_tag(content=".bottom-nav{display:none!important}")
        exec(open(sys.argv[2]).read())
        b.close()
finally:
    adm("DELETE", f"users/{u['id']}")
