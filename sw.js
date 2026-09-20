/* Service worker do ERP Estúdio MABE.
   Sem ele o app instalado no celular dependia do cache do navegador: ficava em branco sem sinal
   e não havia como saber (nem forçar) que existia versão nova.

   - HTML: busca na rede primeiro, para a versão publicada chegar sempre que houver internet;
     sem rede, devolve a última versão que abriu.
   - Bibliotecas, ícones e manifest: servem do cache na hora e são atualizados em segundo plano.
   - Supabase e qualquer outro domínio: passam direto, nunca ficam em cache.

   VERSAO precisa mudar a cada publicação — é o que faz o navegador instalar o worker novo
   e mostrar o aviso "Nova versão disponível" dentro do app. */
const VERSAO = '2026-09-20.14';
const CACHE = 'mabe-erp-' + VERSAO;
const ESSENCIAIS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './vendor/supabase.min.js'
];

self.addEventListener('install', e => {
  /* addAll falha inteiro se um arquivo falhar: guarda um por um para uma falha isolada não derrubar a instalação */
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(
    ESSENCIAIS.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null))
  )));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n.startsWith('mabe-erp-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data && e.data.tipo === 'ATUALIZAR') self.skipWaiting();
  if (e.data && e.data.tipo === 'VERSAO') e.source.postMessage({ tipo: 'VERSAO', versao: VERSAO });
});

const ehDocumento = req => req.mode === 'navigate' || req.destination === 'document';

/* Rede com prazo: sinal ruim costuma deixar a conexão pendurada em vez de falhar.
   Sem esse limite a tela fica esperando de branco, mesmo havendo versão guardada. */
const TEMPO_LIMITE = 4000;
function daRede(req, ms) {
  return new Promise(resolve => {
    let respondido = false;
    const responder = v => { if (!respondido) { respondido = true; resolve(v); } };
    setTimeout(() => responder(null), ms);
    fetch(req).then(responder).catch(() => responder(null));
  });
}

const PAGINA_SEM_CONEXAO = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Estúdio MABE — sem conexão</title>
<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f0e8;color:#1a1714;font-family:system-ui,sans-serif;text-align:center;padding:24px}
.cx{max-width:340px}h1{font-size:19px;margin:0 0 10px}p{font-size:14px;line-height:1.5;color:#7a6f62;margin:0 0 18px}
button{background:#1a1714;color:#faf7f2;border:0;border-radius:10px;padding:12px 20px;font-size:14px;font-weight:600}</style></head>
<body><div class="cx"><h1>Sem conexão</h1><p>Não consegui abrir o ERP e ainda não há uma versão guardada neste aparelho. Verifique a internet e tente de novo.</p>
<button onclick="location.reload()">Tentar de novo</button></div></body></html>`;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (ehDocumento(req)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const resp = await daRede(req, TEMPO_LIMITE);
      if (resp && resp.ok) {
        try { await c.put('./index.html', resp.clone()); } catch (err) {}
        return resp;
      }
      const guardado = (await c.match('./index.html')) || (await c.match('./'));
      /* demorou demais: entrega o que está guardado e atualiza o cache sem pressa, para a próxima abertura */
      if (guardado) {
        if (!resp) e.waitUntil(fetch(req).then(r => r.ok && c.put('./index.html', r.clone())).catch(() => {}));
        return guardado;
      }
      return resp || new Response(PAGINA_SEM_CONEXAO, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    })());
    return;
  }

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const emCache = await c.match(req);
    if (emCache) {
      e.waitUntil(fetch(req).then(r => { if (r && r.ok) return c.put(req, r.clone()); }).catch(() => {}));
      return emCache;
    }
    const resp = await daRede(req, TEMPO_LIMITE * 3);
    if (resp && resp.ok) { try { await c.put(req, resp.clone()); } catch (err) {} }
    return resp || Response.error();
  })());
});
