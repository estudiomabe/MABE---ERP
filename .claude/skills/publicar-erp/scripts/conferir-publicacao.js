/* Espera a Vercel publicar e confere o que de fato foi ao ar.
 *
 *   node conferir-publicacao.js <versao> <atualizacao> [marca1] [marca2] ...
 *   node conferir-publicacao.js 2026-10-10.2 289 kpi-hero metricasDoPeriodo
 *
 * As "marcas" são trechos que só existem no código novo (um id, um nome de
 * função, um texto de botão). Elas provam que o arquivo publicado é o que
 * acabou de ser enviado, e não só que o número de versão mudou.
 *
 * Por que conferir os dois arquivos separadamente: a Vercel troca sw.js e
 * index.html em momentos ligeiramente diferentes. Já aconteceu de o sw.js
 * estar novo e o index.html ainda velho — olhar só um dos dois dá um falso
 * "publicado".
 */
const URL_BASE = 'https://mabe-erp.vercel.app';
const [, , versao, atual, ...marcas] = process.argv;
if (!versao || !atual) {
  console.error('uso: node conferir-publicacao.js <versao> <atualizacao> [marcas...]');
  process.exit(2);
}
const TENTATIVAS = 40, INTERVALO_MS = 6000;   /* até ~4 minutos */
const espera = ms => new Promise(r => setTimeout(r, ms));

async function baixar(arquivo, n) {
  /* o parâmetro muda a cada tentativa para não pegar cópia guardada na CDN */
  const r = await fetch(URL_BASE + '/' + arquivo + '?conferencia=' + Date.now() + '-' + n, { cache: 'no-store' });
  return r.ok ? r.text() : '';
}

(async () => {
  for (let n = 1; n <= TENTATIVAS; n++) {
    let idx = '', sw = '';
    try { [idx, sw] = await Promise.all([baixar('index.html', n), baixar('sw.js', n)]); }
    catch (e) { console.log('tentativa ' + n + ': rede falhou (' + e.message + ')'); await espera(INTERVALO_MS); continue; }

    const vIdx = (idx.match(/const APP_VERSAO='([^']+)'/) || [])[1];
    const aIdx = (idx.match(/const APP_ATUALIZACAO=(\d+)/) || [])[1];
    const vSw = (sw.match(/const VERSAO = '([^']+)'/) || [])[1];
    const aSw = (sw.match(/const ATUALIZACAO = (\d+)/) || [])[1];
    const pronto = vIdx === versao && vSw === versao && aIdx === String(atual) && aSw === String(atual);

    if (!pronto) {
      console.log('tentativa ' + n + ': index.html ' + vIdx + '/' + aIdx + '  ·  sw.js ' + vSw + '/' + aSw);
      await espera(INTERVALO_MS);
      continue;
    }

    console.log('PUBLICADO — index.html e sw.js em ' + versao + ' / ' + atual);
    let faltou = 0;
    marcas.forEach(m => {
      const q = idx.split(m).length - 1;
      if (!q) faltou++;
      console.log('  ' + (q ? 'ok ' : 'FALTA ') + m + ': ' + q + 'x');
    });
    if (faltou) {
      console.error(faltou + ' marca(s) não aparecem no index.html publicado — a versão subiu, mas o código novo não está lá.');
      process.exit(1);
    }
    process.exit(0);
  }
  console.error('A Vercel não publicou ' + versao + ' / ' + atual + ' em ' + (TENTATIVAS * INTERVALO_MS / 1000) + 's. ' +
    'Confira o push (git log origin/master -1) e o painel da Vercel.');
  process.exit(1);
})();
