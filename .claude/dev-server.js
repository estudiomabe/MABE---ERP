/* Servidor estatico de desenvolvimento do ERP.
   Serve os arquivos reais da pasta do projeto (index.html, manifest.json,
   os icones), para que o preview se comporte como a Vercel. A versao
   anterior era um one-liner de PowerShell que devolvia index.html para
   qualquer caminho, o que escondeu por dias que o manifest estava faltando. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const PORTA = Number(process.env.PORT) || 8123;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff2':'font/woff2',
  '.txt':  'text/plain; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.gs':   'text/plain; charset=utf-8',
  '.sql':  'text/plain; charset=utf-8'
};

/* manifest.json precisa do tipo de manifesto, nao do tipo generico de JSON */
function tipoDe(arquivo) {
  const base = path.basename(arquivo).toLowerCase();
  if (base === 'manifest.json') return TIPOS['.webmanifest'];
  return TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream';
}

http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400).end('URL invalida');
    return;
  }
  if (rel === '/' || rel === '') rel = '/index.html';

  const destino = path.join(RAIZ, rel);
  /* nao deixa sair da pasta do projeto com ../ */
  if (!destino.startsWith(RAIZ + path.sep) && destino !== RAIZ) {
    res.writeHead(403).end('fora do projeto');
    return;
  }

  fs.stat(destino, (err, st) => {
    if (err || !st.isFile()) {
      /* 404 de verdade: e assim que a Vercel responde, e e assim que da
         para perceber que um arquivo referenciado nao foi publicado */
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 — ' + rel + ' nao existe em ' + RAIZ);
      console.log('404 ' + rel);
      return;
    }
    res.writeHead(200, {
      'content-type': tipoDe(destino),
      'content-length': st.size,
      'cache-control': 'no-store'
    });
    fs.createReadStream(destino).pipe(res);
    console.log('200 ' + rel + '  (' + st.size + ' bytes)');
  });
}).listen(PORTA, () => {
  console.log('ERP servido em http://localhost:' + PORTA + '/');
  console.log('raiz: ' + RAIZ);
});
