/**
 * BACKUP DIÁRIO DO ERP — Estúdio MABE
 *
 * Toda noite este script lê as tabelas do Supabase e manda o arquivo de
 * backup por e-mail (e, se você quiser, guarda uma cópia no Drive). Às 22h,
 * depois do expediente: o backup pega o dia de trabalho inteiro.
 *
 * POR QUE ASSIM
 * O ERP é um site estático: não existe servidor nosso para rodar uma tarefa
 * de madrugada. O Apps Script roda dentro da própria conta Google do
 * estúdio, de graça, e não exige guardar senha nenhuma em lugar nenhum —
 * a autorização é o seu próprio login do Google.
 *
 * ---------------------------------------------------------------------
 * COMO INSTALAR (uma vez só, uns 3 minutos)
 *
 * 1. Entre no Google com a conta do estúdio (contato.estudiomabe@gmail.com)
 *    e abra https://script.google.com
 * 2. "Novo projeto". Apague o que estiver lá e cole este arquivo inteiro.
 * 3. Dê um nome ao projeto: "Backup ERP Mabe".
 * 4. Salve (ícone de disquete).
 * 5. No seletor de função, escolha "testarAgora" e clique em Executar.
 *    O Google vai pedir autorização: "Revisar permissões" → escolher a
 *    conta → "Avançado" → "Acessar Backup ERP Mabe (não seguro)" →
 *    Permitir. Esse aviso é o normal para script próprio, sem verificação.
 *    Em um minuto o e-mail chega. Se não chegar, veja "Execuções" no menu
 *    da esquerda: o erro aparece lá.
 * 6. Escolha a função "instalarGatilhoDiario" e Executar. Pronto: todo dia
 *    entre 22h e 23h o backup é enviado sozinho.
 *
 * Para desligar depois: rode "removerGatilhoDiario".
 * Para mudar o horário, o destinatário ou a pasta: mexa nos ajustes abaixo
 * e rode "instalarGatilhoDiario" de novo (ele troca o gatilho antigo).
 *
 * ---------------------------------------------------------------------
 * ATENÇÃO — O ARQUIVO É CONFIDENCIAL
 * O backup leva os dados de todos os clientes e a senha dos usuários do
 * ERP na forma embaralhada em que ela é guardada ("sha256$sal$resumo").
 * Não dá para voltar dela à senha digitada, mas o arquivo não deve ser
 * reenviado para grupo nem deixado em pasta compartilhada.
 *
 * ---------------------------------------------------------------------
 * O QUE ENTRA E O QUE NÃO ENTRA
 * Entra: todas as tabelas do banco, inclusive o histórico inteiro e as
 * configurações. Esse arquivo restaura o ERP pela tela
 * Configurações > Restaurar backup (.json).
 * NÃO entra: as fotos e PDFs anexados aos orçamentos e pedidos, que ficam
 * no Storage do Supabase. O backup guarda o endereço de cada anexo, não o
 * arquivo. (O backup manual que você baixa no ERP também não leva.)
 */

// ===================== AJUSTES =====================

/** Projeto Supabase do ERP. A chave é a publicável — a mesma que já está
 *  no index.html, visível para quem abre o site. Não é segredo. */
var SUPABASE_URL = 'https://fzlkuceflazohljpnkgi.supabase.co';
var SUPABASE_KEY = 'sb_publishable_R_Az0yk8mfqTUs_8uoK70Q_yNg8-TAU';

/** Quem recebe. Para mais de um, separe por vírgula. */
var DESTINATARIOS = 'contato.estudiomabe@gmail.com';

/** Pasta do Drive para guardar uma cópia. Deixe '' para não guardar.
 *  A pasta é criada na primeira vez, na raiz do Drive da conta. */
var PASTA_DRIVE = 'Backups ERP Mabe';

/** Apaga do Drive as cópias mais velhas que isto. 0 = nunca apaga.
 *  (O e-mail nunca é apagado por este script.) */
var DIAS_NO_DRIVE = 0;

/** Hora do envio (0 a 23). O Google roda em algum momento dentro da hora
 *  escolhida — 22 significa entre 22h e 23h, não 22h em ponto. */
var HORA_DO_ENVIO = 22;

var FUSO = 'America/Sao_Paulo';

/** As tabelas do ERP, na ordem em que entram no arquivo. */
var TABELAS = ['clientes', 'fornecedores', 'produtos', 'madeiras', 'ferramentas',
  'orcamentos', 'vendas', 'producao', 'entregas', 'compras', 'financeiro',
  'usuarios', 'config', 'historico'];

// ===================== O TRABALHO =====================

/** É esta que o gatilho diário chama. */
function backupDiario() {
  var dia = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
  try {
    var tabelas = {};
    var contagem = [];
    var total = 0;
    for (var i = 0; i < TABELAS.length; i++) {
      var nome = TABELAS[i];
      var linhas = lerTabela(nome);
      tabelas[nome] = linhas;
      contagem.push('   ' + nome + ': ' + linhas.length);
      total += linhas.length;
    }

    var conteudo = JSON.stringify({
      formato: 'supabase-bruto',
      origem: 'Apps Script — backup diário',
      geradoEm: new Date().toISOString(),
      tabelas: tabelas
    }, null, 1);

    var nomeArquivo = 'Dados-ERP-Mabe-' + dia + '.json';
    var arquivo = Utilities.newBlob(conteudo, 'application/json', nomeArquivo);

    var ondeNoDrive = PASTA_DRIVE ? guardarNoDrive(arquivo, nomeArquivo) : '';

    MailApp.sendEmail({
      to: DESTINATARIOS,
      subject: 'Backup do ERP — ' + formatarDiaBR(dia) + ' (' + total + ' registros)',
      body: 'Backup automático do ERP do Estúdio MABE.\n\n'
        + 'Registros por tabela:\n' + contagem.join('\n') + '\n'
        + '   TOTAL: ' + total + '\n\n'
        + 'Tamanho do arquivo: ' + Math.round(conteudo.length / 1024) + ' KB\n'
        + (ondeNoDrive ? 'Cópia no Drive: ' + ondeNoDrive + '\n' : '')
        + '\nPara restaurar: abra o ERP (https://mabe-erp.vercel.app), entre como\n'
        + 'administrador e use Configurações > Dados & Backup > Restaurar backup\n'
        + '(.json), escolhendo o arquivo anexo. Os registros entram por cima dos\n'
        + 'que tiverem o mesmo código; nada é apagado.\n\n'
        + 'Guarde este e-mail: o anexo leva os dados dos clientes e a senha\n'
        + 'embaralhada dos usuários. Não reencaminhe para grupos.\n\n'
        + 'As fotos e PDFs anexados aos orçamentos não vêm neste arquivo —\n'
        + 'eles ficam no Storage do Supabase.\n',
      attachments: [arquivo]
    });
  } catch (erro) {
    avisarFalha(dia, erro);
    throw erro;   // deixa a execução vermelha no painel, para dar para ver depois
  }
}

/** Lê uma tabela inteira, de mil em mil (o Supabase devolve no máximo 1000). */
function lerTabela(nome) {
  var linhas = [];
  var passo = 1000;
  for (var de = 0; de < 200000; de += passo) {
    var resposta = UrlFetchApp.fetch(
      SUPABASE_URL + '/rest/v1/' + nome + '?select=*',
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + SUPABASE_KEY,
          'Range-Unit': 'items',
          Range: de + '-' + (de + passo - 1)
        },
        muteHttpExceptions: true
      });
    var codigo = resposta.getResponseCode();
    /* 206 = veio um pedaço; 200 = veio tudo; 416 = passou do fim, acabou */
    if (codigo === 416) break;
    if (codigo >= 300) {
      throw new Error('Tabela "' + nome + '": o Supabase respondeu ' + codigo
        + ' — ' + resposta.getContentText().slice(0, 300));
    }
    var parte = JSON.parse(resposta.getContentText());
    linhas = linhas.concat(parte);
    if (parte.length < passo) break;
  }
  return linhas;
}

/** Guarda a cópia no Drive e devolve o nome da pasta. */
function guardarNoDrive(arquivo, nomeArquivo) {
  var pastas = DriveApp.getFoldersByName(PASTA_DRIVE);
  var pasta = pastas.hasNext() ? pastas.next() : DriveApp.createFolder(PASTA_DRIVE);
  /* se já existe um arquivo do mesmo dia (rodou duas vezes), o antigo sai */
  var iguais = pasta.getFilesByName(nomeArquivo);
  while (iguais.hasNext()) iguais.next().setTrashed(true);
  pasta.createFile(arquivo);
  if (DIAS_NO_DRIVE > 0) {
    var limite = new Date().getTime() - DIAS_NO_DRIVE * 24 * 60 * 60 * 1000;
    var todos = pasta.getFiles();
    while (todos.hasNext()) {
      var f = todos.next();
      if (f.getDateCreated().getTime() < limite) f.setTrashed(true);
    }
  }
  return PASTA_DRIVE;
}

/** Quando algo dá errado, o silêncio é o pior resultado possível. */
function avisarFalha(dia, erro) {
  try {
    MailApp.sendEmail({
      to: DESTINATARIOS,
      subject: 'ATENÇÃO: o backup do ERP falhou — ' + formatarDiaBR(dia),
      body: 'O backup automático do ERP não foi gerado hoje.\n\n'
        + 'Erro: ' + (erro && erro.message ? erro.message : erro) + '\n\n'
        + 'O que costuma ser:\n'
        + '  • O projeto do Supabase foi pausado por inatividade (plano grátis).\n'
        + '    Entre em https://supabase.com, abra o projeto e clique em Restore.\n'
        + '  • A chave do projeto mudou — nesse caso atualize SUPABASE_KEY aqui\n'
        + '    e no index.html do ERP.\n\n'
        + 'Enquanto isso, dá para baixar o backup na mão: ERP > Configurações >\n'
        + 'Dados & Backup > Baixar backup completo (.zip).\n'
    });
  } catch (e) { /* se nem o e-mail de erro sai, resta o painel de execuções */ }
}

function formatarDiaBR(dia) {
  var p = String(dia).split('-');
  return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : dia;
}

// ===================== LIGAR E DESLIGAR =====================

/** Roda o backup agora, para conferir. Use esta na primeira vez. */
function testarAgora() {
  backupDiario();
}

/** Liga o envio diário. Rodar de novo troca o gatilho, não duplica. */
function instalarGatilhoDiario() {
  removerGatilhoDiario();
  ScriptApp.newTrigger('backupDiario')
    .timeBased()
    .atHour(HORA_DO_ENVIO)
    .everyDays(1)
    .inTimezone(FUSO)
    .create();
}

/** Desliga o envio diário. */
function removerGatilhoDiario() {
  var gatilhos = ScriptApp.getProjectTriggers();
  for (var i = 0; i < gatilhos.length; i++) {
    if (gatilhos[i].getHandlerFunction() === 'backupDiario') {
      ScriptApp.deleteTrigger(gatilhos[i]);
    }
  }
}
