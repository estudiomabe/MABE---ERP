/**
 * Apps Script ERP — Estúdio MABE
 *
 * Backend do ERP (index.html):
 *  - doPost: recebe os registros salvos no navegador e grava/atualiza/apaga
 *    a linha correspondente na aba certa, usando "id" (ou "campo", na aba
 *    config) como chave.
 *  - doGet: devolve o conteúdo de todas as abas em JSON, para o ERP carregar
 *    ao abrir (ou quando a pessoa clicar em "Buscar atualizações da
 *    planilha"). Assim, se o computador A salvar algo, e depois o celular B
 *    abrir o ERP (ou clicar em atualizar), o celular B já vê os dados novos.
 *
 * IMPORTANTE: isso NÃO é sincronização em tempo real. Cada dispositivo só
 * busca a versão mais recente no momento em que abre o ERP ou clica em
 * atualizar — se duas pessoas estiverem com o ERP aberto ao mesmo tempo e
 * editarem juntas, ainda pode haver conflito (números de pedido duplicados,
 * etc.). Para eliminar esse risco de vez, seria necessário um banco de dados
 * de verdade (ex: Firebase) em vez de uma planilha.
 *
 * COMO IMPLANTAR / ATUALIZAR
 * 1. Abra a planilha no Google Sheets → Extensões → Apps Script.
 * 2. Apague o conteúdo atual e cole este arquivo inteiro (se já tinha uma
 *    versão anterior implantada, é só substituir o conteúdo e salvar — não
 *    precisa apagar a implantação).
 * 3. Salve (ícone de disquete).
 * 4. Implantar → Gerenciar implantações → ✏️ (editar) → Nova versão → Implantar.
 *    (Se ainda não implantou nenhuma vez: Implantar → Nova implantação →
 *    tipo "App da Web" → Executar como "Eu" → Acesso "Qualquer pessoa".)
 * 5. Copie a URL (ela não muda ao criar uma "nova versão", só ao criar uma
 *    implantação nova) e cole em Configurações → "URL do Apps Script" no ERP.
 *
 * A planilha precisa ter uma aba para cada uma destas entidades, com o
 * cabeçalho (linha 1) igual ao nome dos campos usados no ERP:
 *   clientes, produtos, madeiras, vendas, orcamentos, pcp, entregas,
 *   ferramentas, financeiro, fornecedores, compras, historico, config
 *
 * Todas usam "id" como chave, exceto "config", que usa "campo".
 * A aba "usuarios" é ignorada de propósito (login/senha nunca saem do
 * navegador, por segurança).
 */

var CHAVE_POR_ENTIDADE = {
  config: 'campo'
};

var ENTIDADES_IGNORADAS_NA_LEITURA = ['usuarios'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return saidaJson({ ok: false, erro: 'Requisição sem corpo (postData ausente).' });
    }
    var body = JSON.parse(e.postData.contents);
    var entity = body.entity;
    var action = body.action;
    var data = body.data || {};

    if (entity === 'ping') {
      return saidaJson({
        ok: true,
        pong: true,
        planilha: SpreadsheetApp.getActiveSpreadsheet().getName(),
        agora: new Date().toISOString()
      });
    }

    var planilha = SpreadsheetApp.getActiveSpreadsheet();
    var aba = planilha.getSheetByName(entity);
    if (!aba) {
      return saidaJson({ ok: false, erro: 'Aba "' + entity + '" não existe nesta planilha.' });
    }

    var chaveCol = CHAVE_POR_ENTIDADE[entity] || 'id';
    var ultimaColuna = aba.getLastColumn();
    var cabecalhos = aba.getRange(1, 1, 1, ultimaColuna).getValues()[0];
    var idxChave = cabecalhos.indexOf(chaveCol);
    if (idxChave === -1) {
      return saidaJson({ ok: false, erro: 'Coluna chave "' + chaveCol + '" não encontrada na aba "' + entity + '".' });
    }

    var linhaEncontrada = encontrarLinhaPorChave(aba, idxChave, data[chaveCol]);

    if (action === 'delete') {
      if (linhaEncontrada > -1) aba.deleteRow(linhaEncontrada);
      return saidaJson({ ok: true, deletado: true });
    }

    // upsert
    var valoresLinha = cabecalhos.map(function (campo) {
      var v = data[campo];
      if (v === undefined || v === null) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });

    var linhaAlvo = linhaEncontrada > -1 ? linhaEncontrada : aba.getLastRow() + 1;
    var faixa = aba.getRange(linhaAlvo, 1, 1, valoresLinha.length);
    // Força texto puro na linha antes de escrever, para o Sheets não
    // "adivinhar" tipo (datas, telefones e CPF/CNPJ com zero à esquerda ou
    // traços seriam corrompidos se o Sheets os tratasse como número/data).
    faixa.setNumberFormat('@');
    faixa.setValues([valoresLinha]);

    return saidaJson({ ok: true, upsert: true });

  } catch (erro) {
    return saidaJson({ ok: false, erro: String(erro) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    var planilha = SpreadsheetApp.getActiveSpreadsheet();
    var abas = planilha.getSheets();
    var dados = {};

    abas.forEach(function (aba) {
      var nome = aba.getName();
      if (ENTIDADES_IGNORADAS_NA_LEITURA.indexOf(nome) > -1) return;

      var ultimaLinha = aba.getLastRow();
      var ultimaColuna = aba.getLastColumn();
      if (ultimaLinha < 2 || ultimaColuna < 1) { dados[nome] = (nome === 'config') ? {} : []; return; }

      var cabecalhos = aba.getRange(1, 1, 1, ultimaColuna).getValues()[0];
      var linhas = aba.getRange(2, 1, ultimaLinha - 1, ultimaColuna).getValues();

      if (nome === 'config') {
        var idxCampo = cabecalhos.indexOf('campo');
        var idxValor = cabecalhos.indexOf('valor');
        var configObj = {};
        linhas.forEach(function (linha) {
          var campo = linha[idxCampo];
          if (campo === '' || campo === null) return;
          configObj[campo] = linha[idxValor];
        });
        dados[nome] = configObj;
        return;
      }

      dados[nome] = linhas
        .filter(function (linha) { return linha.some(function (v) { return v !== '' && v !== null; }); })
        .map(function (linha) {
          var registro = {};
          cabecalhos.forEach(function (campo, i) {
            registro[campo] = linha[i] instanceof Date ? linha[i].toISOString() : linha[i];
          });
          return registro;
        });
    });

    return saidaJson({
      ok: true,
      planilha: planilha.getName(),
      abas: abas.map(function (s) { return s.getName(); }),
      dados: dados
    });
  } catch (erro) {
    return saidaJson({ ok: false, erro: String(erro) });
  }
}

function encontrarLinhaPorChave(aba, idxChaveZeroBased, valorChave) {
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2 || valorChave === undefined) return -1;
  var valores = aba.getRange(2, idxChaveZeroBased + 1, ultimaLinha - 1, 1).getValues();
  for (var i = 0; i < valores.length; i++) {
    if (String(valores[i][0]) === String(valorChave)) return i + 2;
  }
  return -1;
}

function saidaJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
