/* Sobe as quatro constantes de versão do ERP de uma vez:
 *
 *   sw.js       const VERSAO = 'AAAA-MM-DD.N';    const ATUALIZACAO = 123;
 *   index.html  const APP_VERSAO='AAAA-MM-DD.N';  const APP_ATUALIZACAO=123;
 *
 *   node subir-versao.js              → grava e mostra a versão nova
 *   node subir-versao.js --simular    → só mostra o que faria
 *
 * Por que as quatro juntas: o celular só baixa a versão nova quando o sw.js
 * muda. Se só o index.html mudar, quem tem o ERP instalado continua vendo a
 * versão velha até limpar o cache. E se APP_VERSAO e VERSAO divergirem, o aviso
 * "Nova versão disponível" aparece para sempre, porque nunca bate.
 *
 * A regra do número: a data é a de hoje (relógio desta máquina, horário de
 * Brasília); o .N reinicia em 1 num dia novo e soma 1 no mesmo dia. A
 * ATUALIZACAO sempre soma 1 — é o contador que aparece no rodapé.
 */
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');
const simular = process.argv.includes('--simular');

const SW = path.join(RAIZ, 'sw.js');
const IDX = path.join(RAIZ, 'index.html');
let sw = fs.readFileSync(SW, 'utf8');
let idx = fs.readFileSync(IDX, 'utf8');

const RE = {
  versao: /const VERSAO = '([^']+)';/,
  atual: /const ATUALIZACAO = (\d+);/,
  appVersao: /const APP_VERSAO='([^']+)';/,
  appAtual: /const APP_ATUALIZACAO=(\d+);/
};
const ler = () => ({
  versao: (sw.match(RE.versao) || [])[1],
  atual: Number((sw.match(RE.atual) || [])[1]),
  appVersao: (idx.match(RE.appVersao) || [])[1],
  appAtual: Number((idx.match(RE.appAtual) || [])[1])
});

const antes = ler();
if (!antes.versao || !antes.appVersao || !antes.atual || !antes.appAtual) {
  console.error('Não achei as quatro constantes. sw.js e index.html mudaram de formato?', antes);
  process.exit(1);
}
/* se já estão desencontradas, alguém subiu uma e esqueceu a outra:
   parar aqui é melhor do que somar 1 em cima de um erro */
if (antes.versao !== antes.appVersao || antes.atual !== antes.appAtual) {
  console.error('As constantes já estão DESENCONTRADAS — conserte à mão antes de subir:\n' +
    "  sw.js:      VERSAO='" + antes.versao + "'  ATUALIZACAO=" + antes.atual + '\n' +
    "  index.html: APP_VERSAO='" + antes.appVersao + "'  APP_ATUALIZACAO=" + antes.appAtual);
  process.exit(1);
}

const d = new Date();
const hoje = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const [diaAntes, nAntes] = antes.versao.split('.');
const novaVersao = hoje + '.' + (diaAntes === hoje ? Number(nAntes) + 1 : 1);
const novaAtual = antes.atual + 1;

console.log((simular ? '[simulação] ' : '') + antes.versao + ' / ' + antes.atual + '  →  ' + novaVersao + ' / ' + novaAtual);
if (simular) process.exit(0);

sw = sw.replace(RE.versao, "const VERSAO = '" + novaVersao + "';").replace(RE.atual, 'const ATUALIZACAO = ' + novaAtual + ';');
idx = idx.replace(RE.appVersao, "const APP_VERSAO='" + novaVersao + "';").replace(RE.appAtual, 'const APP_ATUALIZACAO=' + novaAtual + ';');
fs.writeFileSync(SW, sw);
fs.writeFileSync(IDX, idx);

/* relê do disco: confere o que foi gravado, não o que estava na memória */
sw = fs.readFileSync(SW, 'utf8');
idx = fs.readFileSync(IDX, 'utf8');
const depois = ler();
const ok = depois.versao === novaVersao && depois.appVersao === novaVersao && depois.atual === novaAtual && depois.appAtual === novaAtual;
if (!ok) { console.error('Gravei, mas a releitura não bate:', depois); process.exit(1); }
console.log('as quatro constantes conferidas em ' + novaVersao + ' / ' + novaAtual);
