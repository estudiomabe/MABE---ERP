/**
 * BACKUP DO ERP — Estúdio MABE
 *
 * Duas tarefas, uma diária e uma semanal:
 *
 *  DIÁRIA, às 22h — lê as tabelas do Supabase e manda o arquivo de backup
 *  por e-mail (e guarda uma cópia no Drive). Depois do expediente, para o
 *  backup pegar o dia de trabalho inteiro.
 *
 *  SEMANAL, domingo às 22h — guarda no Drive as fotos e PDFs anexados aos
 *  orçamentos e pedidos, que ficam no Storage do Supabase e NÃO cabem no
 *  .json. Baixa só o que ainda não tem, então a partir da segunda semana
 *  costuma ser rápido. Nada é apagado da pasta: anexo removido do ERP
 *  continua guardado aqui.
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
 * 6. Escolha a função "instalarGatilhos" e Executar. Pronto: o backup diário
 *    sai entre 22h e 23h, e o dos anexos no domingo, no mesmo horário.
 * 7. (opcional) Rode "testarAnexosAgora" uma vez para a primeira carga de
 *    anexos já ficar guardada, sem esperar o domingo.
 *
 * Para desligar depois: rode "removerGatilhos".
 * Para mudar horário, destinatário ou pasta: mexa nos ajustes abaixo e rode
 * "instalarGatilhos" de novo (ele troca os gatilhos antigos pelos novos).
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
 * NÃO entra no .json: as fotos e PDFs anexados aos orçamentos e pedidos,
 * que ficam no Storage do Supabase — o .json guarda o endereço de cada
 * anexo, não o arquivo. É por isso que existe a tarefa semanal, que baixa
 * esses arquivos para uma pasta do Drive.
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

/** --- anexos (tarefa semanal) --- */

/** Subpasta, dentro de PASTA_DRIVE, onde os anexos ficam guardados. */
var PASTA_ANEXOS = 'Anexos';

/** Dia da semana da carga de anexos. */
var DIA_DOS_ANEXOS = 'DOMINGO';

/** Se a pasta inteira couber neste tamanho, o .zip com todos os anexos vai
 *  junto no e-mail. Acima disso, o e-mail leva só o resumo e o link — o
 *  Gmail recusa anexo acima de 25 MB. */
var LIMITE_ZIP_EMAIL_MB = 15;

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

// ===================== ANEXOS (SEMANAL) =====================

/**
 * Guarda no Drive os anexos dos orçamentos e pedidos.
 *
 * A lista sai dos próprios dados, não do Storage: cada orçamento e cada
 * pedido carrega os seus anexos com nome, caminho e endereço. Assim o que
 * é guardado é exatamente o que o ERP usa — e arquivo solto no bucket, que
 * nenhum registro aponta, fica de fora de propósito.
 */
function backupAnexosSemanal() {
  var comeco = new Date().getTime();
  var dia = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
  try {
    var lista = listarAnexos();
    var pasta = pastaDeAnexos();
    var jaTem = {};
    var arquivos = pasta.getFiles();
    while (arquivos.hasNext()) jaTem[arquivos.next().getName()] = true;

    var novos = 0, bytes = 0, sumidos = [], faltou = 0;
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      if (jaTem[a.local]) continue;
      /* o Apps Script derruba a execução aos 6 minutos: para antes e
         continua na semana que vem, em vez de morrer no meio */
      if (new Date().getTime() - comeco > 4.5 * 60 * 1000) { faltou = lista.length - i; break; }
      var resposta = UrlFetchApp.fetch(a.url, { muteHttpExceptions: true });
      if (resposta.getResponseCode() >= 300) { sumidos.push(a.de + ' — ' + a.nome); continue; }
      var blob = resposta.getBlob().setName(a.local);
      pasta.createFile(blob);
      jaTem[a.local] = true;
      novos++;
      bytes += blob.getBytes().length;
    }

    /* o índice diz de qual orçamento veio cada arquivo e com que caminho
       ele precisa voltar para o Storage, se um dia for preciso repor */
    gravarIndice(pasta, lista, dia);

    var totalPasta = tamanhoDaPasta(pasta);
    var mb = totalPasta / 1048576;
    var anexo = [];
    if (mb > 0 && mb <= LIMITE_ZIP_EMAIL_MB) {
      anexo = [zipDaPasta(pasta, 'Anexos-ERP-Mabe-' + dia + '.zip')];
    }

    MailApp.sendEmail({
      to: DESTINATARIOS,
      subject: 'Backup dos anexos do ERP — ' + formatarDiaBR(dia)
        + ' (' + novos + ' novo(s), ' + lista.length + ' no total)',
      body: 'Backup semanal dos anexos (fotos e PDFs dos orçamentos e pedidos).\n\n'
        + '   Anexos usados pelo ERP: ' + lista.length + '\n'
        + '   Baixados agora: ' + novos + ' (' + Math.round(bytes / 1048576 * 10) / 10 + ' MB)\n'
        + '   Guardados na pasta: ' + contarArquivos(pasta) + ' (' + Math.round(mb * 10) / 10 + ' MB)\n'
        + (faltou ? '   Ficaram para a semana que vem: ' + faltou + ' (a execução tem limite de tempo)\n' : '')
        + (sumidos.length ? '\nNão consegui baixar ' + sumidos.length + ':\n   ' + sumidos.join('\n   ')
            + '\n(provavelmente foram apagados do Storage)\n' : '')
        + '\nPasta no Drive: ' + PASTA_DRIVE + ' > ' + PASTA_ANEXOS + '\n'
        + (anexo.length ? '\nO .zip com todos vai anexado aqui.\n'
            : '\nA pasta já passou de ' + LIMITE_ZIP_EMAIL_MB + ' MB, então o .zip não vai por e-mail — abra pelo Drive.\n')
        + '\nNada é apagado desta pasta: anexo removido do ERP continua guardado.\n'
        + 'O arquivo _indice-anexos.json diz de qual orçamento veio cada um e\n'
        + 'com que caminho ele precisa voltar, se um dia for preciso repor.\n',
      attachments: anexo
    });
  } catch (erro) {
    avisarFalhaAnexos(dia, erro);
    throw erro;
  }
}

/** Os anexos citados pelos orçamentos e pedidos, sem repetir. */
function listarAnexos() {
  var lista = [], vistos = {};
  var junta = function (linhas, prefixo) {
    for (var i = 0; i < linhas.length; i++) {
      var r = linhas[i];
      var anexos = r.anexos || [];
      for (var j = 0; j < anexos.length; j++) {
        var a = anexos[j];
        if (!a || !a.url || vistos[a.url]) continue;
        vistos[a.url] = true;
        var caminho = a.path || String(a.url).split('/orcamentos-anexos/').pop();
        lista.push({
          de: prefixo + pad4(r.num),
          nome: a.nome || caminho,
          url: a.url,
          path: caminho,
          /* a pasta do Drive é plana: a barra vira __ para não haver dois
             arquivos com o mesmo nome vindos de orçamentos diferentes */
          local: String(caminho).replace(/\//g, '__')
        });
      }
    }
  };
  junta(lerTabela('orcamentos'), 'ORC-');
  junta(lerTabela('vendas'), 'V-');
  return lista;
}

function pad4(n) { var s = String(n == null ? '' : n); while (s.length < 4) s = '0' + s; return s; }

function pastaDeAnexos() {
  var nomePai = PASTA_DRIVE || 'Backups ERP Mabe';
  var pais = DriveApp.getFoldersByName(nomePai);
  var pai = pais.hasNext() ? pais.next() : DriveApp.createFolder(nomePai);
  var filhas = pai.getFoldersByName(PASTA_ANEXOS);
  return filhas.hasNext() ? filhas.next() : pai.createFolder(PASTA_ANEXOS);
}

function gravarIndice(pasta, lista, dia) {
  var conteudo = JSON.stringify({
    geradoEm: new Date().toISOString(),
    bucket: 'orcamentos-anexos',
    comoRepor: 'Subir cada arquivo no bucket com o caminho em "path". O nome na pasta do Drive é o "path" com / trocado por __.',
    anexos: lista
  }, null, 1);
  var antigos = pasta.getFilesByName('_indice-anexos.json');
  while (antigos.hasNext()) antigos.next().setTrashed(true);
  pasta.createFile(Utilities.newBlob(conteudo, 'application/json', '_indice-anexos.json'));
}

function contarArquivos(pasta) {
  var n = 0, f = pasta.getFiles();
  while (f.hasNext()) { f.next(); n++; }
  return n;
}

function tamanhoDaPasta(pasta) {
  var total = 0, f = pasta.getFiles();
  while (f.hasNext()) total += f.next().getSize();
  return total;
}

function zipDaPasta(pasta, nomeZip) {
  var blobs = [], f = pasta.getFiles();
  while (f.hasNext()) blobs.push(f.next().getBlob());
  return Utilities.zip(blobs, nomeZip);
}

function avisarFalhaAnexos(dia, erro) {
  try {
    MailApp.sendEmail({
      to: DESTINATARIOS,
      subject: 'ATENÇÃO: o backup dos anexos falhou — ' + formatarDiaBR(dia),
      body: 'A carga semanal de anexos não terminou.\n\n'
        + 'Erro: ' + (erro && erro.message ? erro.message : erro) + '\n\n'
        + 'O backup diário dos dados não depende desta tarefa e continua\n'
        + 'funcionando. Dá para rodar esta na mão: no script, função\n'
        + '"testarAnexosAgora".\n'
    });
  } catch (e) { }
}

// ===================== LIGAR E DESLIGAR =====================

/** Roda o backup dos dados agora, para conferir. Use esta na primeira vez. */
function testarAgora() {
  backupDiario();
}

/** Roda a carga de anexos agora. A primeira vez é a demorada. */
function testarAnexosAgora() {
  backupAnexosSemanal();
}

/** Liga as duas tarefas. Rodar de novo troca os gatilhos, não duplica. */
function instalarGatilhos() {
  removerGatilhos();
  ScriptApp.newTrigger('backupDiario')
    .timeBased()
    .atHour(HORA_DO_ENVIO)
    .everyDays(1)
    .inTimezone(FUSO)
    .create();
  ScriptApp.newTrigger('backupAnexosSemanal')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay[DIA_DOS_ANEXOS === 'DOMINGO' ? 'SUNDAY'
      : DIA_DOS_ANEXOS === 'SEGUNDA' ? 'MONDAY'
      : DIA_DOS_ANEXOS === 'TERCA' ? 'TUESDAY'
      : DIA_DOS_ANEXOS === 'QUARTA' ? 'WEDNESDAY'
      : DIA_DOS_ANEXOS === 'QUINTA' ? 'THURSDAY'
      : DIA_DOS_ANEXOS === 'SEXTA' ? 'FRIDAY' : 'SATURDAY'])
    .atHour(HORA_DO_ENVIO)
    .inTimezone(FUSO)
    .create();
}

/** Desliga as duas. */
function removerGatilhos() {
  var nossas = { backupDiario: true, backupAnexosSemanal: true };
  var gatilhos = ScriptApp.getProjectTriggers();
  for (var i = 0; i < gatilhos.length; i++) {
    if (nossas[gatilhos[i].getHandlerFunction()]) ScriptApp.deleteTrigger(gatilhos[i]);
  }
}

/** Nomes antigos, de quando só existia a tarefa diária. */
function instalarGatilhoDiario() { instalarGatilhos(); }
function removerGatilhoDiario() { removerGatilhos(); }
