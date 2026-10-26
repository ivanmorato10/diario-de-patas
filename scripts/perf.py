"""Medição de desempenho do modo real (build de produção), com uma conta de teste e um diário de 90 fotos.
Uso: `npm run build && PERF_TIMING=1 npx next start -p 3000 &` e depois
     python3 scripts/perf.py [base_url] [saida.json] [--reps 3] [--keep]
PERF_TIMING=1 (só local) faz /api/rpc devolver Server-Timing: tempo do servidor e idas ao banco (quantas e quanto).
Mede cada fluxo `reps` vezes, com cache frio (contexto novo) e quente, e em rede limitada (4G lento: 150 ms, 1,6 Mbps).
No fim, exclui a conta de teste (a não ser com --keep). Nunca imprime chaves.
"""
import json, os, re, statistics, sys, time, urllib.request, urllib.error, uuid, tempfile
from PIL import Image
from playwright.sync_api import sync_playwright, expect

args = [a for a in sys.argv[1:] if not a.startswith("--")]
BASE = args[0] if args else "http://localhost:3000"
OUT = args[1] if len(args) > 1 else "perf.json"
REPS = int(sys.argv[sys.argv.index("--reps") + 1]) if "--reps" in sys.argv else 3
KEEP = "--keep" in sys.argv
N_PHOTOS = int(os.environ.get("PERF_PHOTOS", "90"))  # limite do diário: 100 (as gravações do teste precisam caber)

env = {}
for line in open(os.path.join(os.path.dirname(__file__), "..", ".env.local")):
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.strip().split("=", 1); env[k] = v
URL, SERVICE = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]

def admin(method, path, body=None):
    req = urllib.request.Request(f"{URL}/auth/v1/admin/{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"apikey": SERVICE, "authorization": f"Bearer {SERVICE}", "content-type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read() or b"null")

run = uuid.uuid4().hex[:8]
email = f"perf-{run}@diariodepatas.test"
user = admin("POST", "users", {"email": email, "email_confirm": True})
tmp = tempfile.mkdtemp()
big = os.path.join(tmp, "grande.jpg")
# Foto "de celular": 4032×3024, com detalhe (gradiente + ruído leve) para o JPEG ter tamanho realista.
img = Image.effect_noise((4032, 3024), 40).convert("RGB")
img = Image.blend(img, Image.linear_gradient("L").resize((4032, 3024)).convert("RGB"), 0.6)
img.save(big, "JPEG", quality=92)

def login(page):
    page.goto(BASE + "/hoje"); page.wait_for_url("**/entrar?next=*")
    page.get_by_role("button", name="Já tenho conta").click(); page.get_by_role("button", name="Entrar com email").click()
    page.get_by_role("button", name="Prefiro receber um código no email").click(); page.get_by_label("Seu email").fill(email)
    page.route("**/auth/v1/otp*", lambda route: route.fulfill(status=200, content_type="application/json", body="{}"))
    page.get_by_role("button", name="Receber código de entrada").click()
    expect(page.get_by_role("heading", name="Confira seu email")).to_be_visible()
    page.get_by_label("Código").fill(admin("POST", "generate_link", {"type": "magiclink", "email": email})["email_otp"])
    page.get_by_role("button", name="Entrar com o código").click()
    page.wait_for_url(lambda u: "/entrar" not in u, timeout=30000)
    page.unroute("**/auth/v1/otp*")

def rpc(page, method, a, dog=None):
    return page.evaluate("""async ([m, a, d]) => { const r = await fetch('/api/rpc/' + m, {method: 'POST', headers: {'content-type': 'application/json', ...(d ? {'x-ddp-dog': d} : {})}, body: JSON.stringify(a)}); return [r.status, await r.json().catch(() => null)]; }""", [method, a, dog])

SEED_JS = """async ([n, start, supa, dog]) => {
  // Fotos geradas no navegador (WebP 1080×810 e miniatura 400×300) e enviadas pelo mesmo caminho do app.
  const call = async (m, a) => { const r = await fetch('/api/rpc/' + m, {method: 'POST', headers: {'content-type': 'application/json', 'x-ddp-dog': dog}, body: JSON.stringify(a)}); if (!r.ok) throw new Error(m + ' ' + r.status + ' ' + await r.text()); return r.json(); };
  const make = async (w, h, i) => { const c = new OffscreenCanvas(w, h); const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, `hsl(${i * 37 % 360} 60% 60%)`); gr.addColorStop(1, `hsl(${i * 53 % 360} 50% 35%)`); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let k = 0; k < 400; k++) { g.fillStyle = `hsla(${(i * 7 + k) % 360} 70% 50% / .5)`; g.fillRect((k * 97 + i) % w, (k * 61 + i * 3) % h, 30, 30); } return c.convertToBlob({ type: 'image/webp', quality: 0.82 }); };
  const one = async (i) => {
    const display = await make(1080, 810, i), thumb = await make(400, 300, i);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await display.arrayBuffer()))).map(b => b.toString(16).padStart(2, '0')).join('');
    const t = await call('createUpload', { kind: 'media', mime: 'image/webp', width: 1080, height: 810, hash, mediaKind: 'photo', sizes: { display: display.size, thumb: thumb.size } });
    for (const u of t.uploads) { const b = u.variant === 'display' ? display : thumb; const r = await fetch(`${supa}/storage/v1/object/upload/sign/${t.bucket}/${u.path}?token=${u.token}`, { method: 'PUT', headers: { 'content-type': 'image/webp', 'x-upsert': 'false' }, body: b }); if (!r.ok) throw new Error('upload ' + r.status); }
    await call('confirmUpload', { kind: 'media', id: t.id });
    const d = new Date(Date.now() - (i + 1) * 86400000 * 2).toISOString().slice(0, 10);
    await call('saveEntry', { requestKey: crypto.randomUUID(), mediaId: t.id, caption: 'Foto ' + i, occurredDate: d, source: 'free', albumIds: [] });
  };
  for (let i = start; i < start + n; i += 4) await Promise.all([0, 1, 2, 3].filter(k => i + k < start + n).map(k => one(i + k)));
  return true;
}"""

SLOW = {"offline": False, "latency": 150, "downloadThroughput": 1_600_000 / 8, "uploadThroughput": 750_000 / 8}

class Meter:
    """Requisições do fluxo: quantidade, bytes recebidos, e o que o servidor contou (Server-Timing)."""
    def __init__(self, page):
        self.page, self.reqs = page, []
        page.on("requestfinished", self._done)
    def _done(self, req):
        try:
            sizes = req.sizes(); resp = req.response()
            st = resp.header_value("server-timing") if resp else None
            self.reqs.append({"url": req.url, "type": req.resource_type, "bytes": sizes.get("responseBodySize", 0) + sizes.get("responseHeadersSize", 0), "st": st, "ms": req.timing.get("responseEnd", 0)})
        except Exception:
            pass
    def start(self):
        self.reqs = []
    def summary(self):
        mine = [r for r in self.reqs if r["url"].startswith(BASE)]
        rpcs = [r for r in mine if "/api/rpc/" in r["url"]]
        app = db = dbcalls = 0.0
        for r in rpcs:
            if r["st"]:
                m = re.search(r"app;dur=([\d.]+)", r["st"]); app += float(m.group(1)) if m else 0
                m = re.search(r"db;dur=([\d.]+);desc=\"(\d+)", r["st"])
                if m: db += float(m.group(1)); dbcalls += int(m.group(2))
        return {"requests": len(self.reqs), "app_requests": len(mine), "rpc": [r["url"].split("/api/rpc/")[1] for r in rpcs],
                "kb": round(sum(r["bytes"] for r in self.reqs) / 1024, 1), "server_ms": round(app), "db_ms": round(db), "db_calls": int(dbcalls),
                "media": len([r for r in mine if "/api/media/" in r["url"]]),
                "slowest": [f"{r['url'].replace(BASE, '')[:60]} {r['ms']:.0f}ms" for r in sorted(mine, key=lambda r: -r["ms"])[:4]]}

SEL = {"hoje": "#dog-title", "diario": ".polaroid", "albuns": "#panel-albuns", "cuidados": "main nav", "estudio": ".photo-strip",
       "creditos": ".shop-packs, main .notice", "guardar": "input[type=file][multiple]", "foto": ".polaroid img", "previa": "main img"}

# Cronômetro DENTRO da página (sem o atraso do Playwright ao conferir): um laço por quadro (e a cada mudança no DOM)
# anota o primeiro instante em que a condição vale. Em abertura de página, o tempo conta do início da navegação.
INIT = """(() => {
  const ok = () => {
    let w = null; try { w = sessionStorage.getItem('__perfWant'); } catch {} w = w || '#dog-title|visible';
    const [sel, kind] = w.split('|');
    const el = document.querySelector(sel); if (!el) return false;
    if (kind === 'img') return el.complete && el.naturalWidth > 0;
    if (kind !== 'attached' && !el.getClientRects().length) return false;
    return !document.querySelector('main [aria-busy=true]');
  };
  const tick = () => { if (window.__perfHit == null && ok()) window.__perfHit = performance.now(); requestAnimationFrame(tick); };
  const start = () => { new MutationObserver(() => { if (window.__perfHit == null && ok()) window.__perfHit = performance.now(); }).observe(document, { subtree: true, childList: true, attributes: true }); tick(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})()"""

def want(page, what, nav=False):
    kind = "img" if what in ("foto", "previa") else "attached" if what == "guardar" else "visible"
    page.evaluate("([w, nav]) => { sessionStorage.setItem('__perfWant', w); window.__perfHit = null; window.__perfT0 = nav ? 0 : performance.now(); }", [f"{SEL[what]}|{kind}", nav])

def ready(page, what, timeout=60000):
    page.wait_for_function("() => window.__perfHit != null", timeout=timeout, polling=50)

def took(page, nav=False):
    return page.evaluate("(nav) => window.__perfHit - (nav ? 0 : window.__perfT0)", nav)

def first_photo(page, timeout=60000):
    ready(page, "foto", timeout)

results = {}
def record(flow, cond, ms, meter_sum=None):
    results.setdefault(flow, {}).setdefault(cond, []).append({"ms": round(ms), **(meter_sum or {})})
    print(f"{flow:<34} {cond:<18} {ms:8.0f} ms", (f"req={meter_sum['requests']} kb={meter_sum['kb']} srv={meter_sum['server_ms']} db={meter_sum['db_ms']}/{meter_sum['db_calls']} rpc={','.join(meter_sum['rpc'])}\n      lentas: {' | '.join(meter_sum['slowest'])}" if meter_sum else ""), flush=True)

def timed(page, meter, what, fn, nav=False):
    """Mede `fn` até a tela `what` ficar pronta. nav=True: abertura de página (conta do início da navegação)."""
    meter.start()
    if not nav: want(page, what)
    else: page.evaluate("(w) => { try { sessionStorage.setItem('__perfWant', w); } catch {} }", f"{SEL[what]}|visible")
    t = time.perf_counter(); fn(); ready(page, what); wall = (time.perf_counter() - t) * 1000
    ms = took(page, nav)
    page.wait_for_timeout(300)  # requisições que terminam logo depois (contagem)
    return (ms if ms and ms > 0 else wall), meter.summary()

with sync_playwright() as p:
    browser = p.chromium.launch(channel=os.environ.get("E2E_CHANNEL") or None)
    vp = {"viewport": {"width": 390, "height": 844}, "locale": "pt-BR", "timezone_id": "America/Sao_Paulo"}
    def new_ctx(**kw):
        c = browser.new_context(**vp, **kw); c.add_init_script(INIT); return c
    ctx = browser.new_context(**vp); page = ctx.new_page()
    login(page)
    st, d = rpc(page, "createDiary", {"timezone": "America/Sao_Paulo", "name": "Luna", "birthDate": None, "preferences": {"home": True, "outdoor": True, "people": True, "socialDogs": False}})
    assert st == 200, (st, d)
    luna = rpc(page, "snapshot", {})[1]["dog"]["id"]
    t0 = time.time()
    page.evaluate(SEED_JS, [N_PHOTOS, 0, URL, luna])
    st, _ = rpc(page, "createDiary", {"timezone": "America/Sao_Paulo", "name": "Pepe", "birthDate": None, "preferences": {"home": True, "outdoor": True, "people": True, "socialDogs": False}, "another": True})
    pepe = next(x for x in rpc(page, "snapshot", {})[1]["diaries"] if x["name"] == "Pepe")["id"]
    page.evaluate(SEED_JS, [5, 1000, URL, pepe])
    rpc(page, "switchDog", {"dogId": luna})
    print(f"diário semeado: {N_PHOTOS} fotos (Luna) + 5 (Pepe) em {time.time() - t0:.0f}s", flush=True)
    state = os.path.join(tmp, "state.json"); ctx.storage_state(path=state)
    ctx.close()

    def measure_all():
      # PERF_ONLY=troca: só abertura e troca de cachorro em 4G lento; PERF_ONLY=abrir: só abertura em rede local.
      only = os.environ.get("PERF_ONLY")
      for cond in (["4G lento"] if only == "troca" else ["rede local"] if only == "abrir" else ["rede local", "4G lento", "CPU 4× (celular)"]):
          for rep in range(REPS):
              c = new_ctx(storage_state=state); pg = c.new_page(); m = Meter(pg)
              if cond == "4G lento":
                  cdp = c.new_cdp_session(pg); cdp.send("Network.enable"); cdp.send("Network.emulateNetworkConditions", SLOW)
              if cond.startswith("CPU"):
                  cdp = c.new_cdp_session(pg); cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
              # 1. Abertura até Hoje utilizável (cache frio: contexto novo), depois quente (recarregar)
              ms, s = timed(pg, m, "hoje", lambda: pg.goto(BASE + "/"), nav=True)
              record("1 abrir → Hoje utilizável", f"{cond} · frio", ms, s)
              ms, s = timed(pg, m, "hoje", lambda: pg.reload(), nav=True)
              record("1 abrir → Hoje utilizável", f"{cond} · quente", ms, s)
              if only == "abrir":
                  c.close(); continue
              # 2. Navegação pelo menu inferior (1ª visita a cada tela nesta sessão, depois 2ª)
              for visit in ([] if only == "troca" else ["1ª visita", "2ª visita"]):
                  for href, what in [("/diario", "diario"), ("/albuns", "albuns"), ("/cuidados", "cuidados"), ("/estudio", "estudio"), ("/hoje", "hoje")]:
                      ms, s = timed(pg, m, what, lambda: pg.locator(f'nav.bottom-nav a[href="{href}"]').click())
                      record(f"2 menu → {what} ({visit})", cond, ms, s)
                      if what == "diario" and visit == "1ª visita":
                          want(pg, "foto"); pg.evaluate("(t) => window.__perfT0 = t", pg.evaluate("() => window.__perfT0") - ms); first_photo(pg)
                          record("2b menu → Diário com 1ª foto", cond, took(pg))
              # 3. Troca de cachorro (Luna → Pepe → Luna)
              for name in ["Pepe", "Luna"]:
                  pg.locator("button.dog-switch").click()
                  btn = pg.get_by_role("button", name=re.compile(f"^{name}")); btn.wait_for()
                  pg.evaluate("(n) => sessionStorage.setItem('__perfWant', '#dog-title|visible'), window.__perfHit = null", name)
                  def switch():
                      btn.click(); expect(pg.locator("#dog-title")).to_contain_text(name, timeout=60000)
                  meter_t = time.perf_counter(); m.start(); pg.evaluate("() => { window.__perfT0 = performance.now(); window.__perfHit = null; }")
                  switch(); ready(pg, "hoje")
                  hit = pg.evaluate("(n) => new Promise(r => { const f = () => { const h = document.querySelector('#dog-title'); if (h && h.textContent.includes(n) && !document.querySelector('main [aria-busy=true]')) r(performance.now() - window.__perfT0); else requestAnimationFrame(f); }; f(); })", name)
                  pg.wait_for_timeout(300)
                  record("3 trocar de cachorro", cond, hit, m.summary())
              if only == "troca":
                  c.close(); continue
              # 4. Foto: escolher → prévia; 5. guardar → confirmada
              pg.locator('nav.bottom-nav a[href="/hoje"]').click(); pg.wait_for_selector("#dog-title")
              pg.goto(BASE + "/guardar"); pg.wait_for_selector(SEL["guardar"], state="attached")
              pg.evaluate("() => document.querySelectorAll('main img').forEach(i => i.remove())")
              ms, s = timed(pg, m, "previa", lambda: pg.locator("input[type=file][multiple]").set_input_files(big))
              record("4 escolher foto 12 MP → prévia", cond, ms, s)
              m.start(); t = time.perf_counter()
              pg.get_by_role("button", name="Guardar foto").click(); expect(pg.get_by_role("heading", name="Guardada no diário")).to_be_visible(timeout=90000)
              ms = (time.perf_counter() - t) * 1000; pg.wait_for_timeout(300)
              record("5 guardar foto → confirmada", cond, ms, m.summary())
              # 6. Missão concluída → XP (Olá, mundo), só na 1ª repetição (a missão só conclui uma vez)
              if rep == 0:
                  pg.goto(BASE + "/missoes/ola-mundo")
                  try:
                      pg.get_by_role("link", name="Enviar foto").click(timeout=20000)
                      pg.locator("input[type=file]:not([capture])").first.set_input_files(big)
                      pg.wait_for_function("() => { const i = document.querySelector('main img'); return i && i.complete && i.naturalWidth > 0; }", timeout=60000)
                      xp_before = rpc(pg, "snapshot", {})[1]["xpTotal"]
                      m.start(); t = time.perf_counter()
                      pg.get_by_role("button", name="Guardar e continuar").click()
                      expect(pg.get_by_role("heading", name="A foto mostra isso?")).to_be_visible(timeout=90000)
                      ms_save = (time.perf_counter() - t) * 1000
                      t = time.perf_counter(); pg.get_by_role("button", name="Sim, mostra").click()
                      expect(pg.get_by_text("+10 patinhas 🐾")).to_be_visible(timeout=60000)
                      ms = (time.perf_counter() - t) * 1000; pg.wait_for_timeout(300)
                      record("6a missão: guardar foto → pergunta", cond, ms_save)
                      record("6b missão: confirmar → +10 patinhas", cond, ms, m.summary())
                      print("   xp", xp_before, "→", rpc(pg, "snapshot", {})[1]["xpTotal"], "url", pg.url)
                  except Exception as e:
                      print("   missão não medida:", str(e)[:200])
              # 7. Estúdio e loja de créditos, pelo menu/link (navegação interna)
              pg.goto(BASE + "/hoje"); pg.wait_for_selector("#dog-title")
              ms, s = timed(pg, m, "estudio", lambda: pg.locator('nav.bottom-nav a[href="/estudio"]').click())
              record("7 menu → Estúdio (1ª visita)", cond, ms, s)
              ms, s = timed(pg, m, "creditos", lambda: pg.goto(BASE + "/estudio/creditos"), nav=True)
              record("7b abrir loja de créditos", cond, ms, s)
              # 8. Idioma e região (Minha conta): marca do toque e conclusão
              pg.goto(BASE + "/conta"); pg.locator("button.profile-row", has_text="Idioma / Language").first.click()
              for target, back in [("English", "Português"), ("Português", None)]:
                  chip = pg.locator("dialog[open]").get_by_role("radio", name=target)
                  m.start(); pg.evaluate("() => window.__perfT0 = performance.now()")
                  chip.click()
                  ack = pg.evaluate("(n) => new Promise(r => { const f = () => { const b = [...document.querySelectorAll('dialog[open] [role=radio]')].find(x => x.textContent.includes(n)); if (b && b.getAttribute('aria-checked') === 'true') r(performance.now() - window.__perfT0); else requestAnimationFrame(f); }; f(); })", target)
                  lang = "en" if target == "English" else "pt-BR"
                  pg.wait_for_function("(l) => document.documentElement.lang === l", arg=lang, timeout=30000)
                  done = pg.evaluate("() => performance.now() - window.__perfT0"); pg.wait_for_timeout(300)
                  record(f"8a idioma → {target}: toque marcado", cond, ack)
                  record(f"8b idioma → {target}: tela trocada", cond, done, m.summary())
              for name, after in [("Estados Unidos", "Brasil")]:
                  for n in [name, after]:
                      chip = pg.locator("dialog[open]").get_by_role("radio", name=n, exact=True)
                      pg.evaluate("() => window.__perfT0 = performance.now()"); chip.click()
                      ack = pg.evaluate("(n) => new Promise(r => { const f = () => { const b = [...document.querySelectorAll('dialog[open] [role=radio]')].find(x => x.textContent.includes(n)); if (b && b.getAttribute('aria-checked') === 'true') r(performance.now() - window.__perfT0); else requestAnimationFrame(f); }; f(); })", n)
                      record("8c região: toque marcado", cond, ack); pg.wait_for_timeout(1500)
              c.close()
    try:
      measure_all()
    finally:
      if not KEEP:
        # Exclusão pela própria conta: apaga linhas E arquivos (a API de administração deixaria arquivos órfãos).
        c = browser.new_context(storage_state=state, **vp); pg = c.new_page(); pg.goto(BASE + "/sobre")
        print("conta de teste excluída:", rpc(pg, "deleteAccount", {})[0] == 200); c.close()
    browser.close()


summary = {}
for flow, conds in results.items():
    summary[flow] = {}
    for cond, runs in conds.items():
        med = lambda k: statistics.median([r[k] for r in runs if k in r]) if any(k in r for r in runs) else None
        summary[flow][cond] = {"median_ms": med("ms"), "min_ms": min(r["ms"] for r in runs), "max_ms": max(r["ms"] for r in runs), "n": len(runs),
                               "requests": med("requests"), "kb": med("kb"), "server_ms": med("server_ms"), "db_ms": med("db_ms"), "db_calls": med("db_calls"),
                               "rpc": runs[-1].get("rpc")}
json.dump({"base": BASE, "photos": N_PHOTOS, "reps": REPS, "summary": summary, "runs": results}, open(OUT, "w"), indent=1, ensure_ascii=False)
print("salvo em", OUT)
