/**
 * Apps Script ERP — Estúdio MABE
 *
 * Backend de backup para o ERP (ERP_Pro.html). Recebe os registros salvos no
 * navegador e grava/atualiza/apaga a linha correspondente na aba certa desta
 * planilha, usando a coluna "id" (ou "campo", no caso da aba config) como
 * chave. É um backup one-way: o ERP nunca lê dados de volta daqui — edite
 * sempre pelo próprio ERP.
 *
 * COMO IMPLANTAR
 * 1. Abra a planilha no Google Sheets → Extensões → Apps Script.
 * 2. Apague o conteúdo padrão (Code.gs) e cole este arquivo inteiro.
 * 3. Salve (ícone de disquete).
 * 4. Implantar → Nova implantação → tipo "App da Web".
 *    - Executar como: Eu (sua conta)
 *    - Quem tem acesso: Qualquer pessoa
 * 5. Autorize as permissões pedidas (é a sua própria conta acessando a sua
 *    própria planilha).
 * 6. Copie a URL gerada e cole em Configurações → "URL do Apps Script" no ERP.
 *
 * A planilha precisa ter uma aba para cada uma destas entidades, com o
 * cabeçalho (linha 1) igual ao nome dos campos usados no ERP:
 *   clientes, produtos, madeiras, vendas, orcamentos, pcp, entregas,
 *   ferramentas, financeiro, fornecedores, compras, historico, config
 *
 * Todas usam "id" como chave, exceto "config", que usa "campo".
 */

var CHAVE_POR_ENTIDADE = {
  config: 'campo'
};

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

    if (linhaEncontrada > -1) {
      aba.getRange(linhaEncontrada, 1, 1, valoresLinha.length).setValues([valoresLinha]);
    } else {
      aba.appendRow(valoresLinha);
    }
    return saidaJson({ ok: true, upsert: true });

  } catch (erro) {
    return saidaJson({ ok: false, erro: String(erro) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  return saidaJson({
    ok: true,
    planilha: planilha.getName(),
    abas: planilha.getSheets().map(function (s) { return s.getName(); })
  });
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
