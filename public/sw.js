// Service worker mínimo (§15 + PWA): guarda só o shell estático. Nunca respostas autenticadas, APIs nem fotos.
// Versão nova a cada mudança deste arquivo; o navegador busca o sw.js sem cache (updateViaCache: "none"
// e Cache-Control no-cache em next.config.ts), ativa na hora e apaga caches antigos.
const VERSION = "ddp-v5";
const CACHE = `ddp-static-${VERSION}`;
const SHELL = ["/offline.html", "/brand/favicon-64.png", "/brand/abu-mascote.png", "/brand/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // uploads e chamadas ao servidor passam direto, sempre pela rede
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/s/") || url.pathname.startsWith("/auth/")) return; // nunca cachear
  // Assets do Next têm hash no nome: cache-first é seguro (versão nova = nome novo).
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  // Imagens da marca: responde do cache e atualiza por trás (não prende o ícone antigo).
  if (url.pathname.startsWith("/brand/")) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // Páginas: sempre a rede (nada privado em cache); sem conexão, aviso amigável.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
  }
});
