/* Biblioteca dos scripts de patch do ERP.
 *
 * Uso, dentro de um script escrito no rascunho da sessão:
 *
 *   const P = require('C:/Users/mateu/Documents/Claude Code/MABE - ERP/.claude/skills/publicar-erp/scripts/patch-lib.js');
 *   const f = P.abrir('index.html');           // caminho relativo à raiz do projeto
 *   f.rep(`texto exato que existe hoje`, `texto novo`);
 *   f.rep(`outro trecho`, `outro texto`);
 *   f.salvar();                                // grava e confere a sintaxe
 *
 * Por que existe:
 *  - rep() exige achar o texto EXATAMENTE uma vez. Zero quer dizer que o texto
 *    mudou (ou que o fim de linha é outro); dois ou mais quer dizer que a âncora
 *    é curta demais e a troca cairia no lugar errado.
 *  - Nada é gravado até salvar(). Se um rep() falhar no meio, o arquivo fica
 *    intacto — não existe patch pela metade.
 *  - O arquivo é lido com o fim de linha normalizado para LF. Depois de um
 *    `git checkout` o Windows devolve CRLF, e toda âncora de várias linhas
 *    passa a achar zero. O repositório guarda LF, então gravar LF não cria diff.
 *  - salvar() confere a sintaxe de todo <script> inline com new Function().
 *    Um erro de sintaxe num arquivo único derruba o ERP inteiro.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');

function conferirSintaxe(html) {
  const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const erros = [];
  scripts.forEach((codigo, i) => {
    try { new Function(codigo); } catch (e) { erros.push('script #' + i + ': ' + e.message); }
  });
  return erros;
}

function abrir(relativo) {
  const arquivo = path.join(RAIZ, relativo);
  let s = fs.readFileSync(arquivo, 'utf8').replace(/\r\n/g, '\n');
  const original = s;
  let trocas = 0;

  return {
    /* troca `antigo` por `novo`; `vezes` é quantas ocorrências se espera (padrão 1) */
    rep(antigo, novo, vezes = 1) {
      const n = s.split(antigo).length - 1;
      if (n !== vezes) {
        const amostra = antigo.length > 90 ? antigo.slice(0, 90) + '…' : antigo;
        throw new Error('rep(): esperava ' + vezes + ', achei ' + n + ' em ' + relativo + '\n  âncora: ' + JSON.stringify(amostra));
      }
      s = s.split(antigo).join(novo);
      trocas += vezes;
      return this;
    },
    /* quantas vezes um trecho aparece — para conferir antes de escolher a âncora */
    conta(trecho) { return s.split(trecho).length - 1; },
    get texto() { return s; },
    salvar() {
      if (s === original) { console.log('nada mudou em ' + relativo); return; }
      if (/\.html?$/i.test(relativo)) {
        const erros = conferirSintaxe(s);
        if (erros.length) {
          throw new Error('SINTAXE QUEBRADA — nada foi gravado em ' + relativo + ':\n  ' + erros.join('\n  '));
        }
      }
      fs.writeFileSync(arquivo, s);
      console.log(relativo + ': ' + trocas + ' troca(s) gravada(s)' + (/\.html?$/i.test(relativo) ? ', scripts OK' : ''));
    }
  };
}

module.exports = { abrir, conferirSintaxe, RAIZ };
