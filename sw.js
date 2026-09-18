/* Service worker do ERP Estúdio MABE.
   Sem ele o app instalado no celular dependia do cache do navegador: ficava em branco sem sinal
   e não havia como saber (nem forçar) que existia versão nova.

   - HTML: busca na rede primeiro, para a versão publicada chegar sempre que houver internet;
     sem rede, devolve a última versão que abriu.
   - Bibliotecas, ícones e manifest: servem do cache na hora e são atualizados em segundo plano.
   - Supabase e qualquer outro domínio: passam direto, nunca ficam em cache.

   VERSAO precisa mudar a cada publicação — é o que faz o navegador instalar o worker novo
   e mostrar o aviso "Nova versão disponível" dentro do app. */
const VERSAO = '2026-09-18.2';
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

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (ehDocumento(req)) {
    e.respondWith((async () => {
      try {
        const resp = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./index.html', resp.clone());
        return resp;
      } catch (err) {
        const c = await caches.open(CACHE);
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const emCache = await c.match(req);
    const naRede = fetch(req).then(resp => {
      if (resp && resp.ok) c.put(req, resp.clone());
      return resp;
    }).catch(() => null);
    return emCache || (await naRede) || Response.error();
  })());
});
