# Arquitetura do ERP — Estúdio Mabe

Documento técnico gerado automaticamente pelo próprio sistema em 20/10/2026.
Descreve COMO este ERP foi projetado e construído — tecnologias, banco de dados,
módulos e regras de negócio — para que o sistema possa ser recriado do zero,
mesmo sem acesso ao código-fonte original.

IMPORTANTE: este arquivo NÃO contém dados de clientes, orçamentos, financeiro
etc. Para isso use, em Configurações > Dados & Backup, o botão do backup
completo (.zip) ou os botões separados de JSON, Excel e PDF. Este documento
descreve apenas a ARQUITETURA do sistema.

Como usar: copie todo o conteúdo deste arquivo e cole numa conversa com o
Claude Code, pedindo para ele recriar o sistema a partir daqui (veja um
prompt pronto na última seção).


## 1. Visão geral

- Nome: ERP interno da Estúdio Mabe, marcenaria de móveis sob medida em
  madeira maciça.
- Público: uso interno da equipe, em quatro níveis de acesso
  (Administrador, Financeiro, Produção e Consulta — ver seção 6), no
  computador e no celular — não é um produto para venda a terceiros.
- Formato: aplicação web de página única, sem processo de build — um único
  arquivo "index.html" contendo HTML, CSS e JavaScript puro (ES6+), sem
  framework (sem React/Vue/Angular) e sem TypeScript. Instalável como
  aplicativo (PWA: manifest.json + service worker sw.js, ver seção 4). O
  código evita sintaxe que navegador anterior a 2020 não entende (nada de
  ?. nem ??): um erro de sintaxe derruba o arquivo inteiro e a tela fica
  branca.
- Hospedagem: Vercel, com deploy automático a cada push na branch "master"
  de um repositório no GitHub. Não existe backend próprio nem variáveis de
  ambiente de servidor — o site é 100% estático do ponto de vista do deploy.
- Banco de dados: Supabase (Postgres gerenciado), acessado direto do
  navegador com uma chave pública ("publishable key" do Supabase — segura
  para expor no cliente).
- Cópia secundária opcional: Google Sheets, sincronizada via um Google Apps
  Script publicado como Web App.
- Cache local: todos os dados também ficam espelhados no localStorage do
  navegador (chave "erp_mabe_db_v2"), permitindo abrir o sistema
  rapidamente e mesmo com internet instável. O que for gravado sem
  conexão fica numa fila no aparelho e sobe sozinho quando o sinal volta
  (fila de envio, seção 4).


## 2. Bibliotecas usadas (arquivos em vendor/, sem gerenciador de pacotes)

As bibliotecas JavaScript moram no próprio repositório, na pasta vendor/,
e não em CDN externo: no celular a página ficava em branco esperando
1,2 MB de CDN.

- @supabase/supabase-js 2.57.4 (vendor/supabase.min.js) — cliente de
  acesso ao banco de dados. É o único script carregado na abertura.
- Chart.js 4.4.0 (vendor/chart.umd.min.js) — gráficos do Dashboard e do
  Centro de Custos.
- jsPDF 2.5.1 + jspdf-autotable 3.8.2 (vendor/jspdf.umd.min.js e
  vendor/jspdf.plugin.autotable.min.js) — geração de PDFs (orçamentos,
  relatórios, backups).
- xlsx-js-style 1.2.0 (vendor/xlsx.bundle.js; fork do SheetJS com suporte
  a estilos de célula) — exportação do backup em Excel com a identidade
  visual do estúdio.
- Gráficos, PDF e Excel entram sob demanda, no primeiro uso:
  carregarLib(nome) injeta os scripts listados em LIB_ARQS (chart, jspdf,
  xlsx), um depois do outro, e guarda a promessa para não carregar duas
  vezes; libPronta(nome) espera a carga e, se ela falhar, avisa e deixa
  tentar de novo. A tela que desenha gráfico chama carregarLib e se
  redesenha quando a biblioteca chega.
- Google Fonts: "Plus Jakarta Sans" (textos) e "Fira Code" (números e
  valores monetários, monoespaçada), carregadas sem travar a abertura
  (media="print" trocado para "all" no onload, com `<noscript>` de
  reserva).
- Serviço externo: BrasilAPI (cadastro público de CNPJ da Receita,
  gratuito e sem chave), consultado direto do navegador no cadastro de
  clientes.


## 3. Identidade visual

- Paleta de interface: fundo bege claro (#f5f0e8), superfícies claras
  (#faf7f2 / #ede8df / #e0d9ce), texto quase preto (#1a1714), dourado como
  cor de destaque (#c8a96e), verde para sucesso (#3d6b4f), vermelho para
  erro (#b54040), laranja para alerta (#a07830).
- Paleta usada nos PDFs (RGB): escuro (26,23,20), dourado (200,169,110),
  cinza-texto (122,111,98), branco (255,255,255), creme de fundo
  (245,240,232).
- Logotipo: um quadrado escuro sólido ao lado do texto "estúdio" (peso
  normal) sobre "mabe." (peso bold, maior), com a tagline "MARCENARIA ·
  MADEIRA MACIÇA" abaixo, em letras espaçadas e maiúsculas.
- Na tela, o logotipo é um SVG inline (classe brand-svg) desenhado em
  currentColor: claro sobre a barra lateral escura (#1a1714) e escuro no
  cartão de login. Nos PDFs entra o PNG descrito na seção 11.
- A barra de status do celular usa a cor das superfícies (#faf7f2, em
  theme-color e no manifest.json) e continua o cabeçalho; o fundo de
  abertura do app instalado é o bege #f5f0e8 (background_color).
- Tipografia: "Plus Jakarta Sans" para textos gerais, "Fira Code" para
  números, códigos e valores monetários.


## 4. Estrutura do arquivo único (index.html)

- `<head>`: meta tags (viewport com viewport-fit=cover, theme-color e
  as de app instalado), título, ícone (icon.png, que também é o
  apple-touch-icon do iOS), o link para o manifest.json, fontes do Google,
  um só script — vendor/supabase.min.js — e um único bloco `<style>` com
  variáveis CSS (:root) e todas as classes usadas no sistema.
- `<body>`:
  - uma tela de login: camada fixa por cima de tudo, escondida pela
    classe "hidden". Ela não usa height:100dvh nem align-items:center — o
    cartão se centraliza por margin:auto, que não corta o topo quando o
    teclado do celular abre. No rodapé do cartão aparece o número da
    atualização em uso, e o botão "Instalar o ERP neste aparelho" só
    aparece onde o navegador oferece instalar. O foco automático no campo
    de e-mail só acontece no computador (com mouse e tela larga): no
    celular ele abriria sozinho o teclado e o preenchimento automático;
  - uma barra lateral fixa (sidebar) com o sinal de conexão no topo, a
    marca, os links dos módulos agrupados por categoria (Principal,
    Comercial, Produção, Estoque, Financeiro, Compras, Cadastros,
    Documentos (modelos) e Sistema) e, no rodapé, nome e nível do usuário
    logado com o botão Sair. aplicarPermissoes() esconde o link
    (navigate) que o nível não alcança e o grupo que fica vazio; os itens
    de Documentos (abrirDocumento) ficam à vista e a própria tela recusa
    quem não tem o nível. As seções Madeiras e Entregas continuam no HTML,
    mas não têm link no menu;
  - uma topbar com o botão de menu (só no celular), o aviso da fila de
    envio, o título da tela, a busca global e o botão "+ Novo" da tela
    aberta (só para quem pode editar);
  - uma div por módulo (classe "section", com "id=section-NOME"), todas
    presentes no mesmo HTML — a navegação apenas alterna qual delas recebe
    a classe "active" e fica visível. navigate(sec) confere podeVer(sec),
    faz a troca, redesenha a tela e busca de novo no banco as tabelas
    dela; a última tela aberta fica no localStorage (chave
    "erp_mabe_last_section") e é a que abre no próximo acesso;
  - modais (overlays) para os formulários de cadastro/edição de cada
    módulo. Fechado, o overlay fica com opacity:0 E visibility:hidden (a
    transição do visibility, 0s com atraso de 0.2s, mantém o fade): só a
    opacidade zero, com o backdrop-filter, fazia o Chrome do Android
    pintar as janelas fechadas por cima do login. No celular as janelas
    ocupam a tela inteira, com Salvar/Cancelar sempre à vista no rodapé;
  - fora do #main: a barra de navegação de baixo do celular
    (#barra-inferior), o anel do puxar para atualizar, a área dos avisos
    (toasts), o aviso de versão nova e a tela "O ERP não terminou de
    abrir";
  - um único `<script>` no final do arquivo com toda a lógica em
    JavaScript.

Arquivos ao lado do index.html (publicados juntos pela Vercel):
- sw.js — o service worker (app instalado e modo offline).
- manifest.json — nome curto "Mabe ERP", display standalone, start_url e
  scope "./", cores de fundo e de tema e os ícones icon-192.png,
  icon-512.png e icon-512-maskable.png (icon.png é o da aba e do iOS).
- vendor/ — as bibliotecas da seção 2.
- diag.html — página solta de diagnóstico do aparelho (tamanho da janela,
  zoom, densidade, tema, modo de exibição, versão publicada e faixas de
  cor que dizem se a pintura funciona), para quando o ERP não abre
  direito num celular; tem um botão que limpa o cache do site.
- Apps_Script_ERP.gs e Planilha_ERP_MABE.xlsx (a ponte com o Google
  Sheets, seção 12), Apps_Script_Backup.gs (o backup automático diário,
  seção 13) e supabase/ (os scripts SQL da estrutura do banco e das
  migrações).

App instalado (PWA) e versão:
- O sw.js guarda o app num cache chamado "mabe-erp-" + VERSAO; ao ativar,
  apaga os caches de versões anteriores. Na instalação guarda, um por um
  (um arquivo que falhe não derruba os outros), index.html, manifest,
  ícones e vendor/supabase.min.js. Só pedidos GET do próprio site passam
  por ele:
  - HTML: rede primeiro, com prazo de 4 s; se a rede falhar ou demorar,
    entrega o último index.html guardado (e atualiza o cache sem pressa);
    sem nada guardado, mostra uma página "Sem conexão" com "Tentar de
    novo";
  - os demais arquivos do site (bibliotecas, ícones, manifest): do cache
    na hora, atualizados em segundo plano; o que ainda não estava guardado
    vem da rede e entra no cache (assim as bibliotecas sob demanda também
    ficam no aparelho);
  - Supabase, Google Fonts e qualquer outro domínio passam direto, sem
    cache.
- As 4 constantes de versão sobem juntas a cada publicação: VERSAO e
  ATUALIZACAO no sw.js, APP_VERSAO e APP_ATUALIZACAO no index.html.
  VERSAO tem o formato "AAAA-MM-DD.N" (a data da publicação e o número
  dela no dia) e ATUALIZACAO é um contador que sobe de um em um. Mudar o
  sw.js é o que faz o navegador baixar o worker novo — sem isso o celular
  não recebe a atualização —, e APP_VERSAO é a versão que a página aberta
  diz ter, comparada com a do worker novo. A tela mostra "contador /
  data", por exemplo "42 / 05/03/2026" (rotuloAtualizacao): no rodapé do
  login, no aviso de versão e em Configurações.
- Aviso de atualização: registrarServiceWorker() registra o sw.js e
  procura versão nova de hora em hora e ao voltar para a tela
  (reg.update()). Quando um worker novo fica instalado esperando, aparece
  o aviso "Nova versão disponível" com "Você está na X e a nova é a Y" (a
  versão nova é perguntada ao worker por postMessage, tipo VERSAO, ou lida
  do texto do sw.js publicado); se for a mesma já aberta, o aviso some.
  "Atualizar" manda ATUALIZAR ao worker (skipWaiting) e a página recarrega
  no controllerchange; "Depois" fecha. O app nunca se recarrega sozinho:
  troca que a pessoa não pediu só vale na próxima abertura (recarregar no
  meio deixava a tela pintada pela metade no Chrome do Android). No
  celular o aviso fica acima da barra de baixo, e os toasts sobem para
  cima dele.
- Configurações mostra a versão em uso, o número da atualização (com
  "hoje", "ontem" ou "há N dias"), se o modo offline está ativo e os
  botões "Procurar atualização" e "Limpar cache e recarregar" (desregistra
  o worker e apaga os caches; dados, login e configurações do
  localStorage ficam).
- Instalar: o ERP pega o evento beforeinstallprompt (com preventDefault,
  que também cala a barrinha do Chrome) e mostra no login o botão
  "Instalar o ERP neste aparelho", que abre só a pergunta "Instalar?" —
  pelo menu do Chrome aparece também "Criar atalho", que abre o site no
  navegador, com barra de endereço. O botão some quando o app já roda
  instalado (display-mode: standalone).
- Cara de aplicativo no celular: viewport-fit=cover com folga de
  env(safe-area-inset-*) no cabeçalho, no menu, no conteúdo e nos avisos;
  sem o retângulo cinza do toque (-webkit-tap-highlight-color), sem o
  atraso do duplo toque (touch-action:manipulation), sem seleção de texto
  na moldura (o conteúdo continua selecionável) e com resposta visual ao
  apertar (:active, já que no toque não há hover). No celular os campos
  têm fonte de 16 px, para o iPhone não dar zoom sozinho.

Abertura vigiada:
- loadDB() lê o espelho do localStorage; em seguida a sessão do Supabase
  Auth é conferida (getSession), com prazo de 8 s (comPrazo), e o ERP
  entra pela sessão que encontrar.
- Se a abertura não terminar em 14 s, aparece a tela "O ERP não terminou
  de abrir", com a etapa em que parou, a versão, "Tentar de novo" e
  "Limpar cache e recarregar"; ela some sozinha se a abertura terminar
  depois.
- Depois do login, afterLogin() desenha a tela e dispara as 13 cargas do
  banco (cargasDoBanco). Cada carga que chega agenda um redesenho da tela
  aberta (agendarRedesenho), juntando as que caem na mesma janela de
  250 ms — e sem redesenhar Configurações enquanto alguém digita ali.
- O servidor devolve no máximo 1.000 linhas por leitura, sem avisar. O
  Financeiro é lido inteiro por lerTudoSupabase(tabela, opções): páginas
  de 1.000 pela chave primária (id maior que o último lido, em ordem
  crescente; o total contado na 1ª página garante que nada fica de fora
  mesmo com um limite menor no servidor), com 20 s de prazo por página e
  60 s no total (o tempo com o ERP escondido não conta, e a página cujo
  prazo venceu com ele escondido é lida de novo). Qualquer página que
  falhe é erro de carga, e a lista do aparelho fica como estava (nunca
  pela metade). A ordem da tela (data mais nova primeiro, o id
  desempatando) é aplicada no aparelho, e só a carga mais recente do
  Financeiro vale (CARGA_FIN_SEQ): a que deixou de valer para no fim da
  página, e as pedidas no mesmo passo (abrir o app no Financeiro) são
  uma só. Uma gravação deste aparelho no Financeiro durante a
  leitura (contarEscritaFin, na fila de envio) faz a leitura ser
  refeita, senão uma página lida antes dela traria o valor velho de
  volta. Também a gravação que passa de 30 s (esperando a fila de envio
  numa rede lenta): ela deixa de segurar a carga, mas, quando termina,
  a leitura feita no meio é refeita. E a mudança feita na linha ou no
  modal vai para o lançamento da lista de agora (finDaListaAgora): uma
  carga pode ter trocado os objetos durante a gravação. A leitura só
  para com uma página incompleta. A leitura igual à lista do aparelho não muda nem redesenha nada. A mesma leitura
  serve à releitura do ajuste do saldo (que, com alteração do
  Financeiro na fila de envio, não troca a lista e não ajusta nada) e
  ao histórico do backup. As
  outras tabelas ainda são lidas de uma vez: estão longe das 1.000
  linhas.
- Erro de JavaScript não tratado (window error / unhandledrejection) vira
  uma faixa vermelha "Erro interno" no topo, com ✕, em vez de uma tela
  parada sem pista.

Fila de envio (caixa de saída) — instalarFilaDeEnvio():
- supa.from(tabela) é embrulhado num Proxy: insert, update, upsert e
  delete passam por executarEscrita(); as leituras vão direto.
- Com conexão, a gravação vai ao banco e devolve o resultado de sempre.
  Se falhar por rede (sem resposta, status 0, 502, 503, 504 ou 520 a
  524, "Failed to fetch") ou passar de 12 s, ela é guardada no aparelho
  (localStorage, chave "erp_mabe_fila_envio") e a chamada responde como
  aceita (naFila).
  Logo depois de uma falha, as gravações seguintes vão direto para a fila
  por 20 s, sem esperar o prazo de novo.
- A fila é reenviada sozinha, na mesma ordem: no evento online, a cada
  20 s, ao voltar para a tela e num toque no aviso. Reenviar é seguro:
  update, upsert e delete repetidos dão o mesmo resultado, e o insert usa
  id gerado no aparelho — se o banco responder "já existe" (23505), conta
  como enviado; um lote com uma linha repetida volta para a fila linha a
  linha. O que o servidor recusar vai para "erp_mabe_fila_falhas" e o
  aviso fica vermelho até a pessoa conferir a lista.
- Gravação que precisa da resposta do banco (com .select) não entra na
  fila. As ações que dependem do servidor — criar e aprovar orçamento,
  importar nota ou extrato e, no Financeiro, mesclar, separar, restaurar,
  ajustar o saldo inicial e mudar ou excluir uma linha do banco — passam
  antes por exigeConexao(), que testa o servidor, esvazia a fila e, sem
  conexão, recusa com um aviso claro; o resto continua funcionando.
- Enquanto uma tabela tem alteração na fila, a carga dela não sobrescreve
  a lista local; quando a fila esvazia, as tabelas mexidas são buscadas
  de novo.
- O aviso da fila fica na topbar: "N aguardando envio" (no celular uma
  faixa com texto, "Sem conexão · N a enviar") ou "N não enviadas".

Trava de gravação — instalarTravaDeGravacao():
- As funções de gravar listadas em FUNCOES_DE_GRAVAR (salvar, aprovar,
  excluir, mover etapa, mesclar...) são embrulhadas: enquanto uma chamada
  não termina, outro toque é ignorado com o aviso "Ainda salvando...
  aguarde terminar" — com internet lenta, o segundo toque duplicava
  pedido, contas a receber e OP. A trava é pelo nome da função (vale
  também para o Enter e para outro botão que chama a mesma função) ou,
  nas listadas em TRAVA_POR_REGISTRO, pelo nome mais o id do registro.
- O botão tocado fica desligado com "Salvando...", "Excluindo..." ou
  "Entrando..." até a promessa terminar (botão só de ícone apenas
  desliga); uma válvula solta tudo depois de 120 s (15 s no login).
- Quem chama uma dessas funções pelo código precisa de await: a segunda
  chamada sem esperar é ignorada.

Avisos (toasts):
- toast(msg, tipo, ms) some sozinho (3,2 s por padrão), menos o erro de
  gravação (reconhecido pelo texto, ERRO_DE_GRAVACAO), que fica até a
  pessoa fechar no ✕ — no máximo três na tela, sem repetir o mesmo.
- "Failed to fetch" e afins viram "sem conexão com o servidor"
  (semJargaoDeRede), e as falhas de carga que chegam juntas viram um
  aviso só (erroDeCarga).
- Texto com comando de banco (SQL, nome de coluna) é só para o
  Administrador (classe eh-admin no body, classes so-admin e so-equipe e
  a função paraAdmin(), ver seção 6); os outros níveis leem uma frase
  simples.

Sinal de conexão:
- No topo da barra lateral, acima da marca, um botão com o desenho de
  wi-fi e a palavra do estado: "Conectado", em verde, ou "Sem conexão",
  em vermelho, piscando e com as ondas cortadas por uma barra (dois
  desenhos, não só duas cores); quem pediu movimento reduzido no sistema
  recebe o vermelho sem piscar.
- "Conectado" quer dizer "o servidor respondeu", não "o wi-fi está
  ligado": o sinal lê o mesmo estado da fila de envio (SEM_REDE, ligado
  por uma falha de rede e desligado quando algo volta a responder, mais o
  navigator.onLine).
- Confere sozinho a cada minuto e ao voltar para a tela
  (conferirConexaoEmSilencio); um toque testa na hora (servidorResponde,
  uma leitura mínima com prazo de 6 s) e, se a conexão voltou, já envia a
  fila.

Navegação no celular (até 860 px de largura):
- A barra lateral vira uma gaveta, aberta pelo botão de menu da topbar,
  com fundo escurecido; as tabelas viram cartões.
- Barra de navegação de baixo (#barra-inferior, montada por
  montarBarraInferior a partir de BARRA_INFERIOR): Início, Orçamentos,
  Pedidos e Produção a um toque, mais "Mais", que abre a gaveta do menu.
  Os botões nascem filtrados pelo nível (podeVer); a tela ativa ganha um
  traço dourado no topo e "Mais" acende quando a tela aberta não é
  nenhuma das quatro. A barra respeita a barra de gestos do aparelho
  (safe-area-inset-bottom), e o conteúdo, os toasts e o aviso de versão
  param acima dela.

Rolagem entre telas:
- Todas as telas rolam no mesmo #content. Orçamentos e Pedidos têm telas
  internas (lista, cabeçalho, detalhe, ficha do item, ficha do pedido),
  trocadas por orcShow/vndShow. Aba nova e tela interna começam no topo
  (irAoTopo); voltar para a lista de orçamentos ou de pedidos devolve a
  posição em que ela estava (trocarVista guarda em POS_LISTA) e destaca
  rapidamente o cartão de onde se saiu. Tocar de novo na aba aberta volta
  para a lista; já na lista, sobe ao topo. A Agenda (Calendário), no
  celular, rola até hoje.
- Puxar para atualizar (celular): o gesto nativo do navegador não
  funciona aqui, porque quem rola é o #content e a página tem
  overscroll-behavior:none; então o gesto é do app. Só começa com a tela
  no topo; um anel desce com o dedo e, passando de 70 px, refaz as 13
  cargas do banco e redesenha a tela; abaixo disso recua sem buscar nada.

Busca global (handleSearch, campo da topbar):
- Filtra na hora as linhas (ou os cartões) da tela aberta, sem acento e
  sem diferenciar maiúsculas. No Financeiro, que desenha só uma parte, a
  busca filtra a lista de lançamentos (os dados, pelo texto que a linha
  mostra), 250 ms depois da última letra.
- A partir de 2 letras, abre uma lista de resultados de todos os
  cadastros que o nível enxerga (fontesBusca: comissões, serviços,
  clientes, orçamentos, pedidos, produção, portfólio, material/insumo,
  financeiro, fornecedores e máquinas), até 6 por grupo, com setas, Enter
  e Esc.
- Tocar num resultado abre o próprio registro, como tocar nele na lista;
  sem permissão para abrir, vai para a tela já filtrada pelo termo (o
  filtro é reaplicado quando a seção recarrega do banco).

Ordenação e filtro por coluna:
- Clicar no título de uma coluna ordena a tabela (prepararOrdenacao e
  ordenarTabela, direto no DOM, reconhecendo data, número e valor; as
  linhas de subitem andam junto da linha-mãe). No Financeiro a ordem é
  aplicada na lista (ordenarListaFin, mesma regra; Pedido e Centro pelo
  escolhido) e continua depois de redesenhar.
- Um funil em cada título abre uma janelinha só com o filtro daquela
  coluna (texto, opções, intervalo de datas ou faixa de valor); o funil
  fica dourado enquanto o filtro está ligado, e um resumo mostra quantos
  registros passam, a soma quando faz sentido e "Limpar filtros". No
  celular, onde a lista vira cartão, um botão "Filtros" abre todos numa
  janela. O filtro de coluna de valor some para quem não vê R$.
- Orçamentos têm o filtro próprio (ORC_FILTROS). Pedidos e mais 11 listas
  (PCP, Máquinas, Material/Insumo, Portfólio, Financeiro, Centro de
  Custos, Compras, Comissões, Serviços, Fornecedores e Clientes) usam o
  motor genérico: fcRegistrar(chave, config) descreve cada coluna (tipo e
  de onde vem o valor), fcPassa decide se o registro passa e fcPreparar
  injeta os funis pelo índice do título e a barrinha. No PCP o filtro
  vale para o quadro, a lista e a impressão.

Datas:
- As datas são gravadas como texto "AAAA-MM-DD". today() monta a data de
  hoje pelo relógio do aparelho (getFullYear, getMonth, getDate), não
  por toISOString: em UTC, depois das 21h de Brasília os campos de data
  já vinham com o dia seguinte. addDays e addMonths fazem a conta ao
  meio-dia (T12:00:00), para a conversão não mudar o dia.


## 5. Modelo de dados — tabelas no Supabase (Postgres)

O CREATE TABLE de todas elas, pronto para rodar no SQL Editor de um
projeto novo, está em "supabase/estrutura.sql" no repositório. A lista
abaixo é o resumo em português.

1. clientes — nome, email, tel, doc (CPF/CNPJ), cidade, endereco, status
2. produtos — usada tanto para "Portfólio" (produtos prontos vendáveis)
   quanto para "Insumo" (matéria-prima); campos: nome, tipo, cat, preco,
   custo, est (estoque atual), min (estoque mínimo), un (unidade) e
   materiais (JSON com a lista de materiais do produto do portfólio,
   [{ref, desc, qty, custo}]; vazia no insumo)
3. madeiras — especie, tipo, dimensões em cm (esp, larg, comp) e qtd de
   peças, de onde sai o volume em m³ (calculado na tela, não gravado),
   custo (por m³), umidade (%), min (volume mínimo, em m³) e forn (id do
   fornecedor)
4. vendas (Pedidos) — num sequencial, cli_id, data, status, obs, origem
   (de onde veio o cliente: Indicação, Instagram...), total, baixa
   (boolean: o estoque dos itens já foi baixado) e pag (o rótulo das
   formas de pagamento, ex.: "PIX + Cartão de Crédito 3x"). Em JSON:
   - itens: [{prodId, desc, qty, preco}], com preco por unidade;
   - pags: as linhas de pagamento, [{id, forma, valor, parcelas, data
     (vencimento), status (situação), local (local de recebimento, texto
     livre que sugere os já usados), comprovantes: [{path, nome, url}]}].
     O id da linha é o pag_id dos lançamentos do Financeiro. Pedido sem
     pags (antigo) remonta as linhas a partir do texto de pag;
   - horas: as horas trabalhadas no pedido, [{data, tipoId (tipo de mão
     de obra), horas, valor, obs}], gravadas no Salvar Pedido;
   - lixeira: itens tirados do pedido, [{item, pos, em, por}] (o item, a
     posição de onde saiu, quando e quem), restauráveis no mesmo lugar;
   - anexos: [{path, nome, url}] dos arquivos de referência.
5. orcamentos — num sequencial, cli_id, data, validade (na prática, a
   data de entrega combinada: é o campo "Data de Entrega" do cabeçalho),
   status, obs, origem (de onde veio o cliente), custo, preco e lucro
   (somas dos itens), op_id (ordem de produção vinculada) e, em JSON:
   - itens: um objeto por item, com o detalhamento de custo e preço: id,
     tipo (sob_medida, catalogo, novo_produto), prodId, desc, obs, qty,
     materiais [{mode, ref, desc, qty, custo}] (mode "manual" é o custo
     avulso, com qty 1), servicos [{fornId, desc, qtd, valorUn, unidade,
     valor = qtd × valorUn}], mdo [{tipoId, tipoNome, horas, valorHora}],
     cf (cópia dos custos fixos do dia em que o item foi salvo), cfHoras,
     frete, imposto, maquina/maquinaVal, comissao/comissaoNome/
     comissaoVal, markup, precoManual, precoSugerido, margemSugerida e os
     totais custo, preco e lucro, já vezes a qty (materiais, serviços e
     horas da ficha valem por unidade). Todo item da ficha grava descPct
     (0 sem desconto) e precoCheio (o preço sem desconto, já vezes a
     qty); com desconto, preco é o preço com desconto, e a ficha reabre
     com os dois. O item de catálogo sem ficha grava só descPct;
   - anexos: [{path, nome, url}] dos arquivos de referência;
   - links: links de referência, [{url, nome}] (só http e https);
   - lixeira: itens excluídos, [{item, pos, em, por}], que voltam ao
     mesmo lugar ou são apagados de vez.

   As colunas tipo, descricao, cf, mdo, materiais, imposto, markup,
   prod_id, qty e desc_pct são de quando o orçamento tinha um item só. O
   app grava vazio ou zero em tipo, cf, mdo, materiais, imposto, markup,
   prod_id, qty e desc_pct, não mexe em descricao e só lê descricao, para
   os registros antigos continuarem abrindo.
6. producao (Ordens de Produção / PCP) — num sequencial, titulo, cli_id,
   prazo, resp (responsável), prio (prioridade), etapa (índice 0-6 do
   kanban), status, obs, orc_id, fim (data de conclusão)
7. entregas — op_id, data, cli_id, peca, endereco, resp, status, obs
8. ferramentas (Máquinas & Ferramentas) — nome, tipo, ult (última
   manutenção), intervalo (dias), obs
9. financeiro — tipo (Entrada/Saída), data, descricao, cat (na tela é a
   coluna Pedido: o rótulo do pedido escolhido na linha, "V-0031 —
   cliente"; os lançamentos que o sistema cria nascem com um valor
   genérico, 'Pedidos', 'Compras' ou 'Extrato bancário', que a coluna
   mostra como opção à parte, e a ligação com o pedido fica em
   venda_id), centro_custo, val, status (Pago/Pendente/Cancelado), obs.
   E de onde veio cada lançamento: origem (extrato, pedido, manual,
   compra ou nf), a ligação com o pedido (venda_id; pag_id = a linha de
   pagamento; parcela/parcelas) e com a compra (compra_id) e, do
   extrato, o identificador do banco (fitid, único por conta), a conta,
   o texto original (desc_banco) e a importação (lote_ofx). Mesclar (aba
   Conferir com o banco): a linha do
   banco fica e guarda em mesclagem como era antes e o que recebeu; o
   outro lançamento fica Cancelado com mesclado_com = id da linha do banco
   (e, em mesclagem, só o status que tinha, para restaurar) e some das
   listas, contas, relatórios e planilha. Só conta como mesclado quando a
   linha do banco o guarda na mesclagem dela; senão a aba mostra
   "Precisa de atenção". nao_juntar (na linha do banco) guarda os pares
   marcados como "não é o mesmo".
10. fornecedores — nome, cnpj, tel, email, cidade, status (os
    prestadores dos serviços de terceiros também ficam aqui)
11. compras (Ordens de Compra) — num sequencial, for_id, data, total,
    status, obs, lancado (boolean)
12. historico (auditoria) — dt, user_nome, acao, modulo, detalhe; toda
    ação relevante do sistema grava uma linha aqui
13. usuarios — login (o e-mail de acesso), senha (hash SHA-256), nome,
    role (o nível de acesso; no app, perfil), status, pergunta e
    resposta de recuperação. Duas colunas são opcionais e o app só grava
    nelas se existirem (temColuna): ultimo (último acesso; sem ela, fica
    só no aparelho) e auth_id (liga o cadastro a uma conta do Supabase
    Auth, ver seção 6).
14. config — tabela chave-valor simples (campo, valor). É o "porão" do
    sistema: tudo que precisaria de uma tabela nova mora aqui como JSON
    numa linha, porque o app não roda DDL. Guarda custos fixos padrão,
    custos fixos extras, tipos de mão de obra, folha de pagamento,
    condições de pagamento (taxas de parcelamento e % de PIX antecipado),
    dados cadastrais da empresa, saldo inicial do caixa, data da última
    importação de OFX, o último saldo informado pelo banco no extrato
    mais recente (saldoBancoOfx), catálogo de serviços de terceiros, lista de
    comissionados, tempos de produção por produto, links de compra dos
    materiais, o frete de cada material (a divisão entre preço de compra
    e frete) e as fichas de preço do portfólio. Os números simples ficam
    um por linha, com o nome da chave no campo: aluguel, iptu, agua,
    energia, contador, outros, hmes (horas/mês), imposto, markup,
    taxaMaquina, pixAntecipado, taxaParc1 a taxaParc10 e saldoInicial
    (hsocio e haux são de antes dos tipos de mão de obra). Os compostos
    são JSON em texto: custosFixosExtras, mdoTipos, folhaPagamento,
    empresaInfo, servicos, comissionados, temposProducao, linksProdutos,
    fretesProdutos, fichasProdutos e saldoBancoOfx; ultimaImportacaoOfx
    é a data e hora em texto.

Storage (arquivos): existe um bucket "orcamentos-anexos" no Supabase
Storage, com uma pasta por orçamento e outra por pedido (os comprovantes
de pagamento ficam junto dos arquivos do pedido); o nome do arquivo
ganha um id na frente. Aceita PNG, JPEG ou PDF de até 10 MB. No banco,
as tabelas guardam só a lista de cada arquivo ({path, nome, url}): na
coluna "anexos" do orçamento e do pedido, e em comprovantes, dentro de
vendas.pags. O pedido gerado na aprovação herda os anexos do orçamento
sem copiar o arquivo; tirar o anexo do pedido não apaga o arquivo que o
orçamento ainda usa.

Colunas que nasceram depois: algumas colunas foram acrescentadas à mão no
Supabase depois da primeira versão: orcamentos.origem e vendas.origem,
financeiro.obs, vendas.anexos, vendas.horas, vendas.pags,
vendas.lixeira, orcamentos.links, orcamentos.lixeira e as de origem e
ligação do financeiro (estas pelo arquivo
supabase/migracao-financeiro-origem.sql); em usuarios, ultimo e auth_id
são opcionais. Como o app não roda DDL, ele detecta em tempo de execução
se a coluna existe (em geral, uma leitura mínima da coluna, com limit 1)
antes de gravar — assim continua funcionando mesmo
num banco que ainda não a tenha: o campo some ou o botão fica desligado
e, para o administrador, a tela mostra a linha de SQL que cria a coluna.
No financeiro, só a resposta "a coluna não existe" (código 42703)
desliga a origem e a ligação; sem rede, a conferência fica para depois.

Convenção de nomes: no banco os campos usam "snake_case" (ex: cli_id,
centro_custo, for_id) e no JavaScript usam "camelCase" (ex: cliId,
centroCusto, forId) — cada módulo tem duas pequenas funções de conversão
(ex: "vendaParaSupabase" e "vendaDeSupabase") que traduzem de um formato
para o outro. produtos, madeiras e fornecedores usam os nomes do banco
direto, sem conversão. No financeiro, a conversão só manda o campo de
origem/ligação que o lançamento traz, para um registro antigo (ou de um
backup de antes das colunas) não apagar o que o banco já tem.

Numeração: o número (coluna num de orcamentos, vendas, producao e
compras) vem do próprio banco, de uma sequência na coluna: o app insere
o registro novo sem num e lê o número na resposta
(insert(...).select().single()). Na tela ele aparece com prefixo e zero
à esquerda, por exemplo: ORC-0007, V-0014, OP-0009, OC-0003. O objeto
seq guardado no aparelho (venda, compra, orc, op) é de versões antigas
e não numera nada.


## 6. Autenticação e permissões

- Login por e-mail e senha no Supabase Auth (signInWithPassword). A
  tabela usuarios guarda o perfil de cada pessoa (nome, nível na coluna
  role, status) e a coluna auth_id liga o cadastro à conta do Auth; ela
  é preenchida na primeira entrada (entrarComAuth), que acha o cadastro
  pelo auth_id ou pelo e-mail. Conta sem cadastro em Usuários, ou com o
  cadastro Inativo, não entra. Não usa OAuth.
- Cadastros antigos, criados antes do Auth, entram pelo login do próprio
  cadastro até a migração para o Auth terminar. A senha deles fica
  guardada como `sha256$sal$resumo` (SHA-256 com sal por usuário) e
  nunca em texto puro.
- Usuário novo é criado pelo Administrador, com e-mail e senha (mínimo 6
  caracteres): criarContaAuth cria a conta no Auth com um segundo
  cliente do supabase-js, sem guardar sessão, para não derrubar a sessão
  do administrador. O administrador não troca a senha de ninguém: manda
  o link de redefinição. Excluir o cadastro tira a pessoa do ERP; a
  conta correspondente no Supabase Auth deve ser removida também, pelo
  painel do Supabase.
- Recuperação de senha pelo e-mail: o Auth manda o link
  (resetPasswordForEmail), que volta ao ERP com type=recovery e abre a
  tela de senha nova (updateUser). Para o cadastro antigo sem e-mail, a
  reserva é a pergunta e resposta de segurança, com a resposta guardada
  do mesmo jeito que a senha.
- 4 níveis de acesso: Administrador (tudo, inclusive Usuários,
  Configurações e Folha de Pagamento), Financeiro (tudo menos Usuários e
  Configurações), Produção (Dashboard, Calendário, PCP, Entregas,
  Máquinas, Material/Insumo, Portfólio, Pedidos e Clientes — sem
  Financeiro, sem Orçamentos, sem Madeiras e sem nenhum valor em R$) e
  Consulta (as mesmas telas da Produção, somente leitura). Os perfis
  antigos (Admin, Operador, Visualizador) são convertidos na carga.
- Funções centrais no código: nivelDe(u) devolve o nível, já convertendo
  os perfis antigos; canEdit() diz quem pode gravar; isAdmin() só o
  Administrador; verValores() quem pode ver dinheiro; podeVer(secao)
  quais telas aparecem; guard() e guardValores() bloqueiam a ação e
  mostram o aviso.
- aplicarPermissoes() esconde da barra lateral (e da barra de baixo do
  celular) as telas que o nível não alcança e liga duas classes no body:
  sem-valores, que some pelo CSS com tudo o que é em R$, e eh-admin.
  paraAdmin(técnica, simples) escolhe o aviso: o que cita comando SQL ou
  nome de coluna aparece só para o Administrador; a equipe lê uma frase
  simples.
- Sessão: a do Supabase Auth fica guardada pelo próprio supabase-js e é
  conferida na abertura (getSession). Sair (doLogout) encerra a sessão.


## 7. Módulos / telas do sistema

- Dashboard — período escolhido em Mês, Ano ou Tudo. Em cima, quatro
  números maiores: Faturamento (soma dos pedidos não cancelados do
  período, não o caixa), Lucro (faturamento − despesas fixas), Margem
  (lucro ÷ faturamento) e A Receber (entradas pendentes do período; o
  cartão abre o Financeiro já filtrado). Cada um mostra a variação contra
  o mês ou o ano anterior, com seta e sinal além da cor; a Margem varia
  em pontos percentuais, A Receber fica sem cor (subir ali não é bom nem
  ruim) e em "Tudo" o cartão diz que não há período anterior. As contas
  ficam em metricasDoPeriodo(p), que recebe o período como argumento e
  por isso roda de novo no anterior (periodoAnterior). Abaixo, uma faixa
  compacta: Orçamentos do Período (sem rascunho nem reprovado; os
  rascunhos aparecem como nota ao lado, com quantidade e valor), Ticket
  Médio, Recebido e Pago (o que entrou e saiu pago no período) e
  Despesas Fixas (custo fixo + folha; no mês que ainda corre o valor é
  rateado pelos dias já passados e no ano corrente pelos meses, e o
  rótulo diz isso — periodoCorrido). Gráficos: Evolução de Pedidos
  (barras em escala logarítmica: 6 meses até o mês escolhido, os 12
  meses do ano ou um por ano) e Status dos Pedidos (rosca com legenda de
  quantidade e %). Tabelas: Estoque Crítico, Top 5 Clientes do Período
  (por faturamento) e Últimas Transações. Quem não vê valores fica só
  com o gráfico de status e o estoque crítico. O botão "Gerar Relatório
  Dashboard em PDF" leva a tabela de indicadores, o estoque crítico e as
  últimas transações do período selecionado.
- Calendário (de Entregas) — grade do mês (‹ ›, Hoje) com três tipos de
  compromisso: as entregas cadastradas, na cor do status (Agendada, Em
  rota, Entregue/Instalada; Agendada com data passada aparece como
  Atrasada); a previsão de entrega de cada pedido em produção que ainda
  não tem entrega (o prazo da OP do pedido, em tracejado); e a próxima
  manutenção preventiva de cada máquina. Cada dia mostra até dois e
  "+N mais", com borda vermelha quando há algo atrasado; tocar abre a
  entrega, o pedido ou a máquina. No celular a grade vira uma agenda em
  lista por dia, que sempre inclui hoje e abre rolada até hoje. O botão
  "+ Nova Entrega" fica aqui.
- Orçamentos — criação de orçamentos com múltiplos itens (sob medida,
  catálogo ou novo produto); status em caixa de seleção na própria lista
  (Rascunho, Enviado, Em ajuste, Aprovado, Reprovado, Concluído);
  aprovação parcial de itens (checklist) que gera automaticamente um
  Pedido, contas a receber e uma Ordem de Produção; anexos de referência
  (fotos, PDFs); geração do PDF da proposta (com capa), do contrato de
  prestação de serviço e envio por WhatsApp ou e-mail.
  - Lista: seletor de período (Mês, Ano, Tudo), busca por número ou
    cliente sem ligar para acento, ordem clicando no título da coluna (no
    celular, um seletor ao lado da busca) e um funil em cada coluna
    (número, status, data, cliente, entrega, contato, valor) que abre o
    filtro só daquela coluna e fica dourado enquanto está ligado; no
    celular um botão junta todos os filtros numa janela. Com filtro ou
    busca, um resumo mostra quantos orçamentos e a soma, com "Limpar
    filtros". Cada linha tem ✔ aprovar, ✗ reprovar, ▶ enviar para a
    produção (aprovado ainda sem OP), + Item, PDF e ⧉ duplicar orçamento
    (a cópia nasce Rascunho, com data de hoje e entrega em 15 dias); na
    coluna Contato, WhatsApp e e-mail, quando o cliente os tem. Na
    barra da lista, ao lado da busca, e no cabeçalho do orçamento aberto,
    um "olho" esconde lucro e custo da tela, lembrado no aparelho.
  - Status: trocado na caixa da própria lista; Aprovado, Reprovado e a
    saída de Aprovado seguem o fluxo da seção 9. Em ajuste (cor âmbar,
    depois de Enviado) é o orçamento que foi ao cliente e voltou para
    mexer; continua podendo ser aprovado ou reprovado e conta como
    orçamento feito no Dashboard.
  - Cabeçalho: cliente (com "+ Novo Cliente"), data, prazo em dias e data
    de entrega (um atualiza o outro; a data de entrega é gravada na
    coluna validade e é a coluna Entrega da lista), origem do cliente,
    status e observações gerais. O orçamento novo abre numa página só: o
    cabeçalho fica no topo da ficha do primeiro item e o Salvar cria o
    orçamento e o item de uma vez.
  - Itens: cada item guarda a ficha completa no JSON itens, inclusive os
    custos fixos do dia em que foi salvo. A ficha tem: horas para o
    rateio do custo fixo, separadas das horas de mão de obra (item salvo
    antes desse campo abre com a soma da mão de obra); mão de obra por
    tipo; materiais/insumos do cadastro (com o link de compra) e o botão
    "Adicionar custo manual" (descrição opcional, que vira "Custo manual"
    se ficar vazia, quantidade fixa 1 escondida e o valor no custo
    unitário); serviços terceirizados do cadastro (escolher traz
    prestador, valor e unidade) ou digitados, cada linha com quantidade ×
    valor da unidade = total — a unidade vem da cobrança do cadastro (por
    peça, por hora, diária, por m², por metro linear, por projeto) e o
    item grava valor (o total), qtd, valorUn e unidade, e linha antiga
    abre como 1 × valor; "+ Cadastrar Serviço Terceirizado" cadastra sem
    sair da ficha e já preenche uma linha; frete do item (começa em
    FRETE_PADRAO), que entra no custo como um serviço; imposto, taxa da
    máquina, comissão e quem recebe, margem e desconto (%). O desconto não
    mexe no Preço Final: aparecem abaixo o desconto e o preço com
    desconto, imposto, comissão e taxa da máquina passam a incidir sobre
    ele, e o item grava o preço com desconto, descPct e precoCheio. Tudo
    na ficha vale para 1 unidade e é multiplicado pela quantidade (as
    contas estão na seção 8).
  - ⧉ Duplicar Item pergunta qual item copiar e põe a cópia (profunda,
    com id novo) logo abaixo do original, recalculando o total. Excluir
    item manda para a lixeira do orçamento (coluna orcamentos.lixeira:
    item, posição, quando e quem); a janela Lixeira restaura no mesmo
    lugar ou apaga de vez.
  - Links de referência (coluna orcamentos.links, { url, nome }), acima
    dos anexos, gravam na hora, sem depender de botão de salvar. Só http
    e https viram link (linkDeReferenciaValido: endereço sem esquema
    ganha https, texto sem domínio é recusado), e eles abrem com
    rel="noopener noreferrer". Os anexos (PNG, JPEG ou PDF até 10 MB,
    também arrastando para a área) gravam na hora, e as imagens marcadas
    "Mostrar no orçamento" entram na proposta.
  - Na tela do orçamento saem ainda o PDF "Detalhamento de Cálculo"
    (documento interno, com custo e margem de cada item) e a impressão; a
    proposta diz a validade em dias (VALIDADE_PROPOSTA_DIAS). Excluir o
    orçamento mantém as OPs ligadas a ele, só desvinculadas.
- Pedidos (Vendas) — lista de pedidos gerados manualmente ou a partir da
  aprovação de orçamentos, com o mesmo seletor de período e um filtro em
  cada coluna (Pedido, Data, Cliente, Itens, Total, Pagamento, Status R$
  e Status PCP, que é a etapa da OP do pedido), resumo de quantidade e
  soma e "Limpar filtros"; clicar na linha abre o pedido, e ⧉ duplica
  (a cópia nasce Pendente, com data de hoje, sem baixa de estoque e sem
  lançamento no financeiro). Status: Pendente, Confirmado, Enviado,
  Entregue, Cancelado. A ficha do pedido é uma página com:
  - itens de catálogo ou livres; "+ Adicionar Item ao Pedido" usa a mesma
    tela de composição de preço dos orçamentos;
  - pagamento em várias linhas (coluna vendas.pags): forma (PIX, Cartão
    de Crédito com parcelas de 1x a 10x e a taxa de cada uma, Dinheiro,
    Transferência, Boleto), valor, vencimento, situação (A receber / Já
    recebido), local de recebimento (texto livre que sugere os locais já
    usados em outros pedidos, para o nome não variar) e os comprovantes
    da linha (PNG, JPEG ou PDF até 10 MB, enviados na hora para a pasta
    do pedido no Storage, só depois de o pedido existir). Num pedido novo
    as linhas precisam somar o total dos itens e cada uma vira conta a
    receber (o cartão, uma por parcela, já com a taxa); num pedido já
    salvo, mudar as linhas regrava as linhas (pags) e o texto do
    pagamento, mas as contas a receber ficam como estão no Financeiro;
  - lixeira de itens: o ✕ manda o item para a lixeira da ficha, que vai
    para a coluna vendas.lixeira no Salvar Pedido (item, posição, quando
    e quem); Restaurar devolve a linha ao lugar de onde saiu;
  - Visão Geral com as datas do ciclo (orçamento, pedido, entrega
    prevista = prazo da OP, entregue em, último pagamento): no Salvar
    Pedido, a data mudada é gravada na origem (orçamento, OP ou
    Financeiro), e as que não têm registro próprio ficam marcadas no
    texto das observações;
  - "Valor gasto neste pedido", só leitura: as saídas do Financeiro
    (inclusive as do extrato) em que o pedido foi escolhido na coluna
    Pedido, com o total e quanto ainda falta pagar — o vínculo é pelo
    número V-0000, não pelo nome do cliente — e o comparativo com o que o
    orçamento de origem previu em materiais/insumos e serviços
    terceirizados, vezes a quantidade de cada item;
  - horas trabalhadas (coluna vendas.horas): linhas de data, mão de obra
    (os tipos de Configurações), horas, valor (sai do valor/hora, mas
    pode ser digitado) e observação, com a soma por mão de obra, o total e
    o comparativo Orçado × Trabalhado com as horas de mão de obra da
    ficha do orçamento (vezes a quantidade do item). As horas só vão para
    o banco no Salvar Pedido: a seção avisa isso e sair da ficha com horas
    não salvas pede confirmação;
  - anexos de referência próprios e dois documentos para impressão:
    "Imprimir pedido (PCP)", com opção de ocultar valores para a oficina,
    e "Imprimir recibo" para o cliente. Em ambos dá para escolher, por
    caixa de seleção, quais anexos saem junto.

  Salvar um pedido novo que não esteja Cancelado dá baixa no estoque dos
  produtos de catálogo (coluna baixa), cria as contas a receber e uma OP
  em Planejamento. Excluir um pedido (delVenda), inclusive o gerado na
  aprovação de um orçamento, mostra antes o que sai junto e o que fica:
  saem as contas a receber ainda pendentes e a OP que segue em
  Planejamento (não concluída, sem etapa começada e sem entrega); ficam
  os recebimentos já pagos, as saídas ligadas ao pedido, a OP já
  começada ou concluída, as entregas e o orçamento. O pedido é apagado
  primeiro e só depois o estoque volta (se teve baixa) e saem as contas
  e a OP, para um erro do banco não devolver estoque à toa.
- Produção (PCP) — 7 etapas fixas: Planejamento, Corte & Usinagem,
  Montagem, Acabamento, Retrabalho, Pronto, Entregue. Dois modos de
  visualização, escolhidos num seletor e gravados no aparelho: Kanban
  (quadro por etapa) e Lista (tabela única por prazo, com a etapa em
  coluna de status e a observação recolhível). O responsável por cada
  ordem é escolhido direto no cartão ou na linha. O botão "Imprimir PCP"
  gera a folha de produção em PDF, com quadrado de conferência e a
  observação de cada ordem.
  Retrabalho é desvio, não passo da fila: o ▶ de Acabamento vai direto
  para Pronto (o de Retrabalho também), o ◀ de Pronto ou de Retrabalho
  volta para Acabamento, e entra-se em Retrabalho pela ficha da OP
  (campo Etapa Atual); o banco guarda só o índice da etapa
  (proximaEtapa/etapaAnterior). Na última etapa o botão vira ✓ Concluir:
  a OP fica Concluída, com a data de fim, e, se ainda não tem entrega,
  uma entrega Agendada é criada ligada a ela. No topo ficam os contadores
  (Planejamento, Em produção, Retrabalho, Prontas, Atrasadas e
  Concluídas no mês); Atrasadas é um botão que mostra só as atrasadas.
  Filtros: prioridade (Urgente, Alta, Normal), "Mostrar concluídas" e um
  funil em cada coluna (pedido, peça, cliente, status, responsável,
  prioridade, prazo), que valem para o quadro, a lista e a impressão. O
  cartão mostra a peça (tirada dos itens do pedido quando o título é só
  "Pedido V-0000 — cliente"), o cliente, o pedido e a OP. No celular o
  quadro mostra uma etapa por vez, em abas com a contagem e um ponto
  vermelho quando há ordem atrasada, e abre na etapa da ordem mais
  urgente (atrasada, depois prioridade, depois prazo).
- Entregas — controle de entregas/instalações (data, cliente, peça,
  endereço, responsável, status e observações), com o status andando em
  Agendada → Em rota → Entregue → Instalada. Concluir uma OP no PCP
  agenda sozinha uma entrega ligada a ela (op_id), na data do prazo da
  OP (ou daqui a 3 dias) e com o endereço do cliente, quando a OP ainda
  não tem entrega. As entregas são criadas e abertas pelo Calendário; a
  tela de lista própria (section-entregas: botão de avançar o status e,
  no celular, cartões com links para abrir o endereço no mapa e ligar
  para o cliente) continua no código, mas não tem link no menu lateral.
- Máquinas & Ferramentas — cadastro com alerta de manutenção preventiva
  vencida. A próxima manutenção é a última mais o intervalo em dias
  (ferProx); a situação é Em dia, Próxima (até 7 dias) ou Vencida, e o
  botão Feita registra a manutenção com a data de hoje. As manutenções
  previstas aparecem também no Calendário.
- Material/Insumo — estoque de matéria-prima com alerta de estoque
  mínimo e link de compra do material (o nome fica sublinhado e abre a
  página do fornecedor). Estoque mínimo zero quer dizer "não controlo
  este item" e não gera alerta; com mínimo, o selo é Crítico (estoque
  ≤ mínimo), Perto do mínimo (até 1,5× o mínimo) ou OK — a mesma regra
  vale para o Portfólio (statusEstoque). O custo do material é o preço
  de compra mais o frete; a divisão fica em config.fretesProdutos, só
  para o formulário separar os dois de novo.
- Portfólio — catálogo de produtos prontos vendáveis, também com alerta
  de estoque mínimo. Cada item tem uma FICHA DE PREÇO (a mesma tela de
  composição usada no orçamento: materiais, mão de obra, serviços,
  máquina, imposto, comissão e markup), guardada em config.fichasProdutos.
  Ao adicionar o item a um orçamento, a ficha vem preenchida e é
  recalculada com os custos do dia. Salvar a ficha atualiza o preço e o
  custo do produto; a ficha do portfólio não tem o campo Desconto do
  orçamento, então o preço de tabela é sempre o cheio. Cada produto tem
  também a lista de materiais (coluna materiais: ref, desc, qty, custo)
  e o tempo de produção em dias (config.temposProducao); abrindo a
  linha, a lista mostra, para a quantidade a produzir, quanto de cada
  material falta comprar diante do estoque. Cada item também gera uma
  Ficha Técnica em PDF para a execução na oficina.
- Madeiras — estoque de madeira com cálculo de volume em m³: espessura
  × largura × comprimento (em cm, convertidos para m) × peças (madM3).
  O custo é por m³, o mínimo é em m³ (abaixo dele, Repor), a umidade tem
  selo (até 12% verde, até 18% amarelo, acima vermelho) e "Dar baixa"
  tira peças do estoque. A tela (section-madeiras) continua no código,
  mas saiu do menu lateral.
- Financeiro — lançamentos de entrada/saída com status de pagamento,
  importação de extrato bancário em OFX e conciliação com os lançamentos
  já existentes. No topo: Saldo Atual (saldo inicial + o que está Pago,
  fora os mesclados; vermelho e com sinal só quando negativo), Recebido
  no mês, Pago no mês e Pendências (tocar abre a lista só com os
  pendentes). O saldo aparece dividido em No banco (saldo inicial +
  extrato), Fora do banco e, quando há, o pago com data futura.
  - Origem: cada lançamento guarda de onde veio (origem = extrato,
    pedido, manual, compra ou nf) e mostra um selo junto do tipo (Banco,
    Pedido, Manual, Compra, NF). O filtro Origem fica no funil da coluna
    Tipo, e a opção Mesclados no funil de Status. Na própria linha se
    escolhem o pedido (rótulo "V-0031 — Cliente", que vira a ligação
    venda_id), o centro de custo e a observação. No lançamento novo, o
    status acompanha a data até ser escolhido à mão (data futura =
    Pendente; hoje ou antes = Pago), e o modal grava só os campos que
    mostra. Sem as colunas de origem no banco, os selos, a aba Conferir
    com o banco e o saldo dividido não aparecem, e o Financeiro funciona
    como antes.
  - A lista: totais, filtros, filtros por coluna, busca do topo, ordem
    pelo título, contador, resumo, Conferir com o banco e exportações usam
    todos os lançamentos; só o desenho é parcial. Desenha só a vista que
    aparece (cartões até 860 px, tabela acima; girar o celular ou mudar a
    janela redesenha), 100 por vez, com "Ver mais" no fim, que acrescenta
    os 100 seguintes. O seletor de Pedido da linha vem só com "— Nenhum —",
    o valor antigo e o escolhido, e recebe os outros pedidos no toque, no
    clique ou no foco (encherPedidoFin). Na tabela, uma linha invisível
    no rodapé (tfoot, visibility:collapse, linhaMedidaFin) leva o conteúdo
    mais largo de cada coluna da lista inteira, e as colunas ficam com a
    largura de quando tudo era desenhado. Quantos aparecem volta para 100 quando a
    lista muda (filtro, busca, ordem, abrir a tela, trocar de aba);
    editar uma linha, a volta da carga e salvar pelo modal mantêm a
    quantidade, a rolagem e o foco (a observação que estava sendo escrita
    continua no campo). Cada desenho troca só as linhas que mudaram
    (atualizarLinhasFin): com centenas à mostra, classificar uma linha
    não redesenha as outras. As sugestões de mescla ficam guardadas
    enquanto os dados não mudam, e os cartões fora da tela não são
    calculados pelo navegador (content-visibility).
  - Importação do OFX (parseOfx): cada linha entra como Pago e guarda o
    FITID, a conta do arquivo (BANKID/ACCTID), o texto original do banco
    e o lote. A mesma transação (mesmo FITID na conta, mesma data, valor
    e tipo) vem desmarcada e não entra de novo; o FITID que o banco
    repetiu para outra transação ganha uma chave longa
    (FITID|data|valor|tipo); o parecido (mesmo tipo e valor, até 3 dias)
    vem desmarcado como possível duplicado. Enquanto se marca, a janela
    compara o No banco depois da importação com o saldo que o banco
    declara no arquivo (LEDGERBAL). Com esse saldo no arquivo, depois de
    importar a conferência lista o que explica a diferença: lançamentos
    que o extrato não traz, itens não importados, pagos fora do banco e
    pendentes. Com as colunas de origem, importar precisa de internet.
  - A aba Conferir com o banco (com um contador do que há para
    conferir) sugere os lançamentos que são o mesmo dinheiro de uma
    linha do banco para Mesclar, e Separar desfaz. Sem dúvida: o
    lançamento já está Pago, ele e a linha do banco só têm um ao outro,
    as datas ficam a até 3 dias e o banco traz o nome (ou parte dele) ou
    o CPF/CNPJ; "Mesclar estes N" mescla só os pares que estão na tela
    (até 30), um por vez. Confira: toda conta pendente (mesclar dá a
    baixa nela), mais de uma possibilidade (um seletor escolhe a linha
    do banco), data longe, nome diferente, cartão, devolução ou
    depósito; sempre pergunta antes. Casos antigos: a linha do banco que
    foi cancelada à mão; Mesclar faz ela voltar a valer. "Não é o mesmo"
    pergunta antes, anota o par em nao_juntar e o aviso tem Desfazer.
    A aba mostra também as mesclagens pela metade (Precisa de atenção,
    com Restaurar ou Separar), os Mesclados e o último saldo informado
    pelo banco.
  - Regras da sugestão (sugerirMesclasFin, uma função pura): mesmo tipo
    e mesmo valor (até R$ 0,01); a linha do banco a até 3 dias do
    lançamento (do pedido: de 30 dias antes a 7 depois; a conta pendente
    aceita até hoje, mas então vai para Confira); um para um, o par mais
    parecido primeiro. O nome é comparado sem os termos que todo extrato
    repete, nomes de banco, palavras de empresa e cidades; o CPF/CNPJ do
    texto do banco decide quando o cadastro também o tem. Dinheiro,
    maquininha e cartão a receber nunca entram.
  - Mesclar, Separar e Restaurar precisam de internet: releem os
    lançamentos do servidor e gravam com condição (a linha do banco só
    se ainda não tem mesclagem, o outro só se ainda não foi mesclado),
    para dois aparelhos não mexerem no mesmo par; se a segunda gravação
    falha, a linha do banco volta como estava. O lançamento mesclado só
    se consulta, e a linha do banco que recebeu outro precisa ser
    separada antes de ser cancelada ou excluída.
  - Linha do banco tem data, valor e tipo travados no modal ("Editar
    mesmo assim" pergunta antes). O ajuste do saldo inicial é perguntado,
    só no extrato mais recente, só com uma conta no banco, e só quando
    nenhuma linha de extrato ficou fora do ERP (as que faltaram ficam
    guardadas com o saldo do banco), nenhuma linha do banco no ERP falta
    no extrato e nenhum caso antigo está por inverter. Ele aparece também
    no bloco Saldo do banco, sem importar de novo. Antes de gravar, o ERP
    relê do servidor o saldo inicial e o Financeiro e refaz a conta;
    nenhum lançamento é criado ou apagado, e dá para desfazer.
- Centro de Custos — segmentação dos lançamentos financeiros por setor
  fixo (Marketing, Vendas, Pedidos, Insumo, Folha de Pagamento,
  Administrativo, Manutenção). A lista é a constante SETORES_FIXOS, a
  mesma dos seletores do Financeiro. Por período (Mês, Ano ou Tudo),
  soma pagos e pendentes (fora os cancelados e os mesclados) em saídas e
  entradas por centro, com o percentual das saídas e um gráfico de
  rosca; o contador de lançamentos sem centro abre o Financeiro já
  filtrado neles, para classificar.
- Relatórios — relatório gerencial por período (Mês, Ano ou Tudo):
  faturamento e ticket médio dos pedidos não cancelados, margem média
  dos orçamentos, orçamentos realizados e aprovados (com o pedido
  gerado), margem por orçamento, top clientes, preços ajustados à mão
  contra o sugerido pela fórmula (o preço cheio, antes do desconto) e
  madeira por espécie. O mesmo conteúdo sai em PDF (gerarPdfRelatorio).
- Compras (Ordens de Compra) — pedidos a fornecedores (Pendente,
  Confirmado, Recebido ou Cancelado; no celular, Recebido com um toque).
  "Lançar no financeiro" cria uma saída (Pago se a ordem já foi
  recebida, senão Pendente) com origem compra e compra_id, e marca a
  ordem como lançada.
  Importação da NF-e em XML (parseNfe), que atualiza os custos no
  cadastro de material/insumo:
  - o fornecedor é achado pelo CNPJ (ou cadastrado) e cada item da nota
    é casado com um insumo pelo nome, ou vira um insumo novo;
  - o custo de cada linha é o que saiu do caixa: valor do produto −
    desconto + frete, seguro, outras despesas, IPI e ICMS-ST, dividido
    pela quantidade; no insumo que já tinha estoque, a quantidade soma e
    o custo vira a média ponderada (nfCustoMedio);
  - por opção (as duas vêm marcadas), registra a ordem de compra já
    Recebida, com o número e a chave de acesso da nota na observação, e
    lança as saídas no Financeiro com origem nf: uma Pendente por
    duplicata da nota, ou uma só, Pago quando a forma da nota é à vista;
  - nota já importada (pela chave de acesso) só entra de novo marcando
    "Importar mesmo assim".
- Serviços de Terceiros — catálogo de serviços contratados (corte a
  laser, tapeçaria, vidro) com valor e unidade, usado na composição de
  preço dos orçamentos.
- Comissões — cadastro de quem recebe comissão e o percentual padrão.
- Documentos (modelos) — quatro itens no menu (Orçamento, Recibo do
  Pedido, Contrato e Ficha Técnica) que abrem a mesma tela
  (section-documentos), com abas no topo para trocar. Ela monta o PDF do
  modelo em branco com os mesmos geradores dos documentos de verdade
  (montarPdfOrcamento, montarPdfRecibo, montarPdfContrato e
  montarPdfFichaTecnica), mostra numa moldura e abre em outra aba — só
  para conferir o visual, sem nenhum dado de cliente ou pedido.
- Fornecedores / Clientes — CRMs simples.
  Clientes (nome, e-mail, telefone, CPF/CNPJ, cidade, endereço, status)
  tem busca que ignora acento e máscara (acha por nome, e-mail, cidade
  ou pelos dígitos do telefone e do documento) e filtro por coluna; no
  celular cada cliente vira um cartão com Ligar, WhatsApp, E-mail e
  quantos pedidos tem. Com 14 dígitos válidos no CPF/CNPJ, o cadastro
  consulta o CNPJ no BrasilAPI (cadastro público da Receita, gratuito e
  sem conta) e preenche só os campos vazios (nome, telefone, e-mail,
  cidade e endereço); o que já foi digitado fica, com um link para
  trocar pelos dados da Receita, e o nome fantasia vira opção. Avisa
  dígito verificador errado, CNPJ não encontrado, situação diferente de
  ATIVA e falta de internet. CPF não é consultado. Orçamento e pedido
  têm "+ Novo Cliente", que abre o mesmo cadastro e já escolhe o cliente
  novo.
- Usuários — gestão de usuários e níveis (só o Administrador): e-mail de
  login, nome, nível e status na tabela usuarios. O nível se troca
  direto na lista; o último administrador ativo não pode ser rebaixado
  nem desativado; a senha de outra pessoa não se edita: vai o link de
  redefinição por e-mail.
- Histórico de Edições — auditoria de todas as ações relevantes (quem fez
  o quê e quando).
- Configurações — sincronização com Google Sheets, custos fixos padrão
  (mais custos fixos extras dinâmicos) com horas/mês, imposto, taxa da
  máquina e margem de lucro padrão, saldo inicial da conta (a base do
  "No banco" do Financeiro), folha de pagamento, tipos de mão de obra,
  condições de pagamento, dados cadastrais da empresa (o CNPJ é também a
  chave PIX dos PDFs), versão do app (procurar atualização e limpar o
  cache, sem mexer nos dados), backups (o .zip com tudo, ou
  JSON/Excel/PDF/Arquitetura separados), restaurar backup e "Resetar
  Dados", que apaga só o espelho local deste aparelho (o banco não é
  tocado e os dados voltam na próxima carga).


## 8. Motor de precificação de orçamentos (a regra de negócio mais importante)

Para cada item de um orçamento, o cálculo segue esta ordem:

1. Custo fixo do período = soma de Aluguel + IPTU + Água + Energia +
   Contador + Outros + quaisquer custos fixos extras cadastrados
   dinamicamente.
2. Esse custo fixo mensal é dividido pelas "Horas/Mês" configuradas (o
   valor da hora de oficina) e multiplicado pelas "Horas para o rateio"
   do item (campo próprio, gravado em cfHoras) → "custo fixo rateado".
   São as horas em que o item ocupa a oficina, que não precisam bater
   com as de mão de obra (secagem, cura e montagem em obra pesam numa e
   não na outra). Sem horas, o custo fixo não entra no preço e a tela
   avisa em vermelho. Item salvo antes desse campo existir abre com a
   soma das horas de mão de obra, para o preço não mudar sozinho.
3. Mão de obra = soma de (horas × valor/hora) para cada tipo de mão de
   obra usado (tipos configuráveis, ex: Sócio, Auxiliar, Marceneiro, cada
   um com seu valor/hora).
4. Materiais = soma de (quantidade × custo unitário) de cada
   material/madeira/insumo usado no item. A linha pode vir do cadastro
   (madeira ou insumo, com ref "m:id" ou "p:id" e o custo cadastrado),
   ser digitada à mão, ou ser um custo manual (botão "Adicionar custo
   manual": descrição opcional — vazia, grava "Custo manual" —,
   quantidade fixa 1 escondida e o valor no custo unitário). Quem lê os
   materiais sempre soma qty × custo, sem olhar o tipo da linha.
5. Serviços terceirizados = soma de (quantidade × valor da unidade) de
   cada linha, arredondada em centavos. A unidade vem do cadastro de
   serviços (Por peça, Por hora, Diária, Por m², Por metro linear, Por
   projeto). O total da linha fica no campo valor, que custo, PDFs,
   pedido e relatórios somam; qtd, valorUn e unidade vão junto para a
   ficha reabrir como foi digitada. Linha antiga, sem quantidade, abre
   como 1 × valor.
6. Frete (R$) do item: vem preenchido com o frete padrão (constante
   FRETE_PADRAO) e pode ser trocado; entra no custo, como um serviço.
7. Custo total do item = custo fixo rateado + mão de obra + materiais +
   serviços + frete.
8. Preço sugerido = custo total ÷ (1 − (imposto % + comissão % + taxa da
   máquina % + margem de lucro %) / 100), com a soma dos percentuais
   limitada a 95%. Imposto, comissão e taxa da máquina são percentuais
   do preço, cobrados do cliente (não saem da margem); o lucro é preço ×
   margem %. Imposto, margem e taxa da máquina começam com os padrões de
   Configurações (cf.imposto, cf.markup, cf.taxaMaquina).

Comissão: o campo "Quem recebe a comissão" lista os comissionados
cadastrados (config.comissionados) e, ao escolher, traz o percentual
combinado da pessoa; "Outro" libera digitar o nome, com os nomes já
usados como sugestão. O item guarda comissao (%), comissaoNome e
comissaoVal, e o orçamento soma a comissão por pessoa
(comissaoPorPessoa).

Preço à mão e margem implícita: digitar o preço final liga o modo
manual (PRECO_MANUAL). O lucro passa a ser preço − custo − imposto −
comissão − taxa da máquina, e o campo de margem mostra a margem
implícita (lucro ÷ preço). A margem de antes fica guardada
(MARGEM_SUGERIDA, gravada como margemSugerida) para o "recalcular
automático"; digitar a margem volta ao cálculo automático. O item grava
precoManual e precoSugerido (o preço automático), que o relatório
gerencial usa para mostrar o desvio dos preços ajustados à mão.

Quantidade: a tela calcula 1 unidade — mão de obra, materiais e
serviços valem por unidade. Ao salvar, o item grava custo, preço,
lucro, comissaoVal, maquinaVal e precoSugerido já multiplicados pela
quantidade (o preço é arredondado em centavos por unidade antes de
multiplicar). O item também guarda uma cópia dos custos fixos do dia
(cf, com os extras e as horas/mês), que o PDF de detalhamento lê.

Desconto (%): campo opcional no quadro Impostos, Comissão & Markup. O
Preço Final continua cheio (segue a margem); abaixo aparecem o desconto
e o preço com desconto. A conta é feita em centavos a partir do preço
cheio já arredondado, para Preço Final − Desconto fechar com o Preço com
desconto. Imposto, comissão e taxa da máquina passam a incidir sobre o
preço com desconto, e o que se abre mão sai do lucro; a tela mostra a
margem que sobra (ou o prejuízo). O item grava preco (com desconto: é o
que vai para a proposta, o pedido e os totais), descPct e precoCheio;
reabrir traz os dois (no preço à mão, o campo mostra o preço cheio).
Desconto fora de 0 a 100% não salva; 100% pede confirmação.

Portfólio: a ficha de preço de um produto é a mesma tela, sem o campo
de desconto — é o preço de tabela. Salvar grava a ficha em
config.fichasProdutos e atualiza preço e custo do produto com o preço
cheio; o produto novo cadastrado a partir de um item ("novo produto")
também entra com o preço cheio e ganha a ficha. Ao pôr um produto do
portfólio no orçamento: com ficha, ela abre recalculada com os custos
do dia (material do cadastro pega o custo atual; o digitado à mão
mantém o da ficha) e aceita desconto como qualquer item; sem ficha, o
item entra pela tela de catálogo, a preço de tabela × quantidade menos
um desconto % próprio (orc-cat-desc-pct), com custo = custo do cadastro
× quantidade. O desconto digitado na tela de catálogo segue para a
ficha quando o produto tem uma.

A mesma tela também adiciona um item direto a um pedido (o pedido
"empresta" a tela): aí volta só a descrição, a quantidade e o preço
unitário já com desconto.


## 9. Fluxo de aprovação de orçamento

Status do orçamento (lista ORC_STATUS): Rascunho, Enviado, Em ajuste,
Aprovado, Reprovado e Concluído. Quem pode editar troca o status direto
na caixa da lista (statusOrcHtml / mudarStatusOrc). Aprovado e Reprovado
não são só etiqueta: escolhidos na caixa, ela volta ao valor antigo e
abre o fluxo próprio (a caixa de aprovação, ou a confirmação de
reprovar). Sair de Aprovado pede confirmação e avisa que o pedido, os
lançamentos e a OP continuam existindo. Os botões Aprovar e Reprovar só
aparecem com ao menos um item e enquanto o status não é Aprovado,
Reprovado nem Concluído; Concluído é marcado à mão. Os selects de lista
fixa (status de orçamento, pedido, financeiro, compras e entregas,
prioridade da OP e centro de custo) são montados da lista oficial e
mantêm o valor gravado que não está nela (opcoesLista): abrir e salvar
uma ficha nunca apaga um status antigo.

Na caixa de aprovação o usuário informa:

- quais itens o cliente de fato aprovou (checklist — permite aprovação
  parcial; os itens não aprovados saem do orçamento);
- a data da aprovação, que vira a data do pedido, e a data de entrega
  combinada, que não pode ser anterior à aprovação;
- as formas de pagamento, uma por linha: forma (PIX, Cartão de Crédito,
  Dinheiro, Transferência ou Boleto), valor, parcelas (só no cartão),
  vencimento e situação (A receber / Já recebido). A caixa abre com PIX
  em duas linhas: o "% de PIX antecipado" das condições de pagamento na
  data da aprovação e o resto na data de entrega. Boleto vence, por
  padrão, na entrega. As linhas precisam somar, em centavos, o total dos
  itens marcados — senão a aprovação não segue;
- se o primeiro pagamento já caiu no extrato: aí escolhe o lançamento
  (entradas pagas dos últimos 180 dias ainda não classificadas num
  pedido), que vira a primeira conta em vez de criar outra; a
  observação que ele tinha fica, e o aviso entra depois dela.

Aprovar exige conexão (exigeConexao): o pedido e a OP recebem o número
do banco, e sem rede o fluxo pararia no meio. Ao confirmar, o sistema,
nesta ordem: grava o orçamento como Aprovado, só com os itens aprovados
e os totais refeitos; cria o Pedido (venda, status Pendente) com esses
itens — preço unitário = preço do item ÷ quantidade, já com desconto —,
as linhas de pagamento, os mesmos anexos do orçamento (sem copiar os
arquivos), a origem e a observação "Gerado automaticamente do ORC-… ·
Entrega combinada: …"; dá baixa no estoque dos itens de catálogo;
lança as contas a receber no Financeiro — uma por linha e, no cartão,
uma por parcela, mês a mês, com a taxa do número de parcelas (1x a 10x)
somada por cima e a sobra de centavos na última —, já ligadas ao pedido
(origem pedido, venda_id, pag_id, parcela/parcelas) quando o banco tem
essas colunas; e cria a Ordem de Produção na etapa "Planejamento", com
prazo = entrega combinada e a lista dos itens (com a descrição
detalhada) na observação, ligada ao orçamento (orc_id na OP, op_id no
orçamento). Orçamento aprovado que ficou sem OP mostra o botão ▶
"Enviar para produção" (orcParaProducao), que cria a OP em
Planejamento.

confirmarAprovarOrc está na trava de gravação (seção 4): sem ela, um
toque duplo com internet lenta duplicava pedido, contas a receber e OP.
Excluir o pedido gerado segue a regra de Pedidos da seção 7 (delVenda).


## 10. Alertas automáticos (badges no menu lateral e na barra de baixo)

updateBadges() recalcula os números no login (quando as cargas do banco
chegam), a cada gravação (commit) e no puxar para atualizar:

- Estoque crítico de Insumos e de Portfólio (estoque atual ≤ estoque
  mínimo; só conta o item com mínimo cadastrado maior que zero).
- Manutenção de máquina atrasada (a próxima — última manutenção mais o
  intervalo em dias — já passou).
- Ordem de Produção com prazo vencido e ainda não concluída. No celular,
  o botão Produção da barra de baixo ganha um ponto vermelho quando há
  alguma, e no PCP cada aba de etapa com ordem atrasada ganha o seu.


## 11. Geração de PDFs

Os documentos em PDF são: proposta do orçamento, detalhamento de cálculo
do orçamento (interno), contrato de prestação de serviço, ficha técnica
do produto, folha do pedido (com valores, ou sem valores para a
oficina), recibo do cliente, folha de produção do PCP, relatório do
dashboard, relatório gerencial (tela Relatórios) e o backup completo.
Todos seguem o mesmo padrão visual: fundo creme, cabeçalho com a marca
da Mabe, título, linha divisória dourada, tabelas com cabeçalho escuro e
linhas zebradas, rodapé com linha dourada, endereço/contato (ou a
identificação do documento) e número de página. A proposta, o pedido, o
recibo, a ficha técnica e a folha do PCP abrem com uma página de capa,
com a marca centralizada e sem rodapé; o backup em PDF tem capa
própria. O contrato, o detalhamento e os relatórios começam direto no
conteúdo.

O que cada um tem de particular:

- Proposta (montarPdfOrcamento; o arquivo sai como "Proposta-ORC-…"):
  antes de gerar, uma janela deixa marcar quais itens entram. A capa
  traz "Preparado para", o cliente e as datas do orçamento e da entrega.
  Depois vêm a tabela de itens (#, item, qtd, unitário, subtotal), com a
  descrição detalhada numa linha menor logo abaixo do item; a caixa do
  TOTAL; as formas de pagamento (o % de PIX inicial vem da mesma
  configuração usada ao aprovar, e a chave PIX entra quando o CNPJ da
  empresa está cadastrado); a validade da proposta, só o prazo em dias
  (constante VALIDADE_PROPOSTA_DIAS); observações e assinaturas; e, no
  fim, as imagens de referência marcadas no orçamento, duas por página.
  Cada item aparece só com o preço final: o desconto não é mostrado ao
  cliente.
- Detalhamento de cálculo (montarPdfDetalhamentoOrc): documento interno,
  com o aviso "USO INTERNO — mostra custo e margem" no rodapé de todas
  as páginas. Para cada item, nas mesmas duas colunas da ficha: custos
  fixos (horas do rateio, custo do mês, horas/mês e valor da hora), mão
  de obra, impostos/comissão/margem/frete, materiais, serviços (com qtd
  × valor da unidade) e o resumo escuro; com desconto, o resumo mostra o
  preço sem desconto, o desconto e o preço com desconto. Lê o que está
  gravado no item, inclusive a cópia dos custos fixos do dia em que ele
  foi salvo. Com mais de um item, fecha com uma tabela de custo, preço,
  lucro e margem por item.
- Pedido e recibo (montarPdfRecibo): mesma diagramação; mudam o título,
  o rótulo do número e o bloco de pagamento. Na impressão escolhe-se,
  por caixa de seleção, quais anexos saem junto (as imagens entram no
  fim do PDF; os PDFs anexados abrem em outra aba) e se a folha sai sem
  valores, para a oficina: some preço, total e condições, e entra a data
  de entrega combinada.
- Contrato (montarPdfContrato): sai do orçamento aberto, com os dados do
  cliente (nome, CPF/CNPJ, endereço, telefone, e-mail), valor total, %
  de entrada, a referência do ORC e, quando o orçamento tem, a data de
  entrega; o foro e a cidade vêm dos dados da empresa (empresaInfo).
  Multas, data de assinatura e, sem data de entrega, o prazo ficam em
  linha, para preencher.
- Ficha técnica (montarPdfFichaTecnica): sai com a identificação
  preenchida (peça, cliente, ORC e data, quando houver) e o resto em
  branco de propósito, para ser preenchido à mão na bancada (dimensões,
  madeira e acabamento, lista de peças, ferragens, encaixes, montagem,
  croqui).
- Folha do PCP (montarPdfPcp): uma lista só, em ordem de prazo, com a
  etapa em coluna; respeita os filtros da tela.
- Relatório do dashboard: tabela de indicadores do período, estoque
  crítico e as últimas transações. É mais simples que o painel: nele o
  custo fixo do mês corrente entra inteiro e os rascunhos contam junto
  com os orçamentos, sem o rateio por dias corridos que a tela faz.
- Relatório gerencial: faturamento, margem média, ticket médio e o
  desvio dos preços ajustados à mão (preço sugerido × preço cheio, sem
  contar o desconto), mais orçamentos realizados e aprovados, margem por
  orçamento, maiores clientes e madeira por espécie.

No celular (tela sem hover), imprimir baixa o PDF em vez de abrir a
janela de impressão, que ali não funciona.

A marca é um PNG com fundo transparente embutido no próprio index.html
como data URI (constante MARCA_PNG, com a proporção em MARCA_PROP), e é
desenhada com addImage(...,'SLOW') — assim o arquivo final fica na casa
das dezenas de KB em vez de centenas. Não se deve redesenhar o logotipo
com fonte do jsPDF: a fonte da marca é geométrica e o resultado não bate.
Três cabeçalhos ainda montam a marca com um quadrado escuro e o texto
"estúdio"/"mabe." em Helvetica: o da página 2 da proposta, o do
relatório do dashboard e o do relatório gerencial.

Duas armadilhas do jsPDF que o código contorna: as fontes são Latin-1, de
modo que emojis e setas corrompem a linha inteira (há uma função que
limpa o texto antes de escrever); e o alinhamento centralizado ignora o
charSpace, então existe um helper que desconta a largura do espaçamento
ao centralizar títulos espaçados.

Detalhe técnico relevante: a biblioteca jspdf-autotable pode criar
páginas extras sozinha quando uma tabela não cabe numa página só. Para
garantir que o fundo colorido apareça em TODA página (inclusive essas
criadas automaticamente), o código usa um de dois jeitos. Ou intercepta
(monkey-patch) a função doc.addPage do jsPDF, pintando o fundo assim que
qualquer página nova é criada — antes de qualquer conteúdo ser desenhado
nela (relatório do dashboard, backup em PDF e detalhamento, que também
redesenha o cabeçalho) —, ou usa o gancho willDrawPage do autotable: na
proposta e no pedido/recibo ele pinta o fundo das páginas que a tabela
abre e pula a primeira, que já veio pintada e com o título; na folha do
PCP ele redesenha fundo e cabeçalho. O relatório gerencial
(gerarPdfRelatorio) é a exceção: pinta o fundo só nas páginas que ele
mesmo abre antes de cada seção, e a página que uma tabela longa abre
sozinha sai sem o creme. O contrato não usa autotable: as páginas dele
são abertas e pintadas pelo próprio gerador.


## 12. Sincronização com Google Sheets (opcional, não é a fonte de verdade)

Um Google Apps Script é publicado como aplicativo Web (executar como
"eu", acesso "qualquer pessoa"). O ERP envia requisições POST para essa
URL a cada alteração relevante (formato: entidade, ação, dados), e a
planilha guarda uma cópia legível dos dados. Também é possível puxar
(importar) da planilha de volta para o sistema. Essa sincronização é
totalmente opcional — o sistema funciona plenamente sem ela, usando
apenas o Supabase.

Como funciona no código:
- O código do script é o arquivo Apps_Script_ERP.gs do repositório
  (doPost recebe cada alteração e doGet atende a leitura de volta), e a
  planilha-base é Planilha_ERP_MABE.xlsx (uma aba por entidade:
  clientes, produtos, madeiras, vendas, orcamentos, pcp, entregas,
  ferramentas, financeiro, fornecedores, compras, historico e config).
- A URL do script é colada em Configurações e fica guardada só no
  aparelho (DB.config.sheetsUrl, no espelho do localStorage), não na
  tabela config: cada aparelho configura a sua. Ela funciona como a
  chave da planilha e não deve ser publicada; o backup .json a leva
  junto.
- syncSheets(entidade, ação, dados) manda um POST com o JSON no corpo,
  como text/plain (requisição simples, sem a pré-checagem de CORS), e não
  espera resposta; sem URL configurada, não faz nada. Cada linha nova do
  histórico também vai.
- "Salvar & Testar" manda um ping; "Sincronizar tudo agora" reenvia todos
  os registros, um por vez, e no fim diz quantos deram certo e quantos
  falharam (do financeiro vão só os lançamentos visíveis, sem os
  mesclados; do histórico, os 200 mais recentes; da config, os custos
  fixos).
- Ler a planilha é um GET na mesma URL (carregarDaPlanilha): acontece em
  silêncio toda vez que o ERP entra (login ou sessão salva), quando há
  URL, e pelo botão "Buscar atualizações da planilha", que pede
  confirmação porque substitui os dados locais pelos da planilha (a
  numeração não muda: o número vem do banco, seção 5).


## 13. Backups existentes

O botão principal baixa um único arquivo .zip com os quatro documentos
abaixo mais um LEIA-ME explicando cada um. O .zip é montado pelo próprio
navegador, sem biblioteca: o código escreve os cabeçalhos locais, o
diretório central e o EOCD na mão, com CRC-32 próprio e compressão via
CompressionStream('deflate-raw'); sem ela no navegador (ou quando não
compensa), o arquivo entra guardado sem compressão. Só o Administrador
baixa ou restaura backup.

- Backup Completo (JSON) — todos os dados no formato das telas
  (camelCase, com geradoEm), inclusive os usuários com a senha na forma
  em que ela é guardada (`sha256$sal$resumo`) e o financeiro inteiro,
  com os lançamentos absorvidos numa mesclagem (o restauro devolve o
  par); é o arquivo que restaura o sistema, e por isso deve ser tratado
  como confidencial.
- Backup em Planilhas (Excel) — os mesmos dados em abas, uma por módulo,
  incluindo configurações, serviços, comissionados e fichas de preço. O
  Financeiro sai com a origem de cada lançamento e sem os absorvidos numa
  mesclagem, como nas listas (o PDF faz o mesmo). Planilha e PDF não
  levam senha.
- Backup Completo (PDF) — documento visual com a identidade da marca,
  para leitura ou impressão.
- Backup de Arquitetura (este documento) — não contém dados, contém a
  descrição de como o sistema foi construído.

Restaurar: "Restaurar backup (.json)" aceita dois arquivos, o .json do
ERP e o do backup automático diário (ver abaixo), e reconhece qual é
(normalizarBackup). Lê o arquivo, mostra quantos registros de cada
módulo serão gravados, pede confirmação por escrito (digitar RESTAURAR)
e então grava por cima no Supabase: os registros (upsert pelo id, em
blocos de 100, cada bloco só com linhas que trazem as mesmas colunas,
para uma linha sem o campo não apagar o que o banco tem) e as
configurações, uma linha de config por campo. Se o banco recusa um
bloco por chave repetida (ex.: o mesmo FITID na mesma conta, com outro
id), grava linha a linha e lista as que ficaram de fora. Antes, se o
arquivo traz origem e ligações do Financeiro, confere se o banco tem
essas colunas e avisa quando não tem. No fim recarrega tudo do banco.
Nada é apagado: o que existe no banco e não está no arquivo permanece. Os
usuários entram com a senha que tinham, de modo que as pessoas continuam
entrando com a mesma senha de antes; usuários vindos de um backup antigo,
sem o campo senha, são ignorados, para não criar contas sem entrada. O
histórico não é restaurado (é um diário; recarregá-lo duplicaria as
linhas).

Restaurar num banco novo: a tabela usuarios começa vazia, então o
primeiro acesso é uma conta criada no painel do Supabase Auth, com um
cadastro provisório de Administrador de mesmo e-mail em usuarios
(entrarComAuth acha o cadastro pelo e-mail). Depois do restauro, esse
cadastro sai, e vale conferir em Usuários que só ficaram os da equipe.
Vale conferir também as sequências de numeração (num) das tabelas
orcamentos, vendas, producao e compras: o número de um registro novo
vem da sequência do banco (seção 5), que não avança sozinha com os
números restaurados; ajuste cada uma para depois do maior num. O começo
do supabase/estrutura.sql traz o passo a passo, e o fim, o comando das
sequências.

O histórico do backup vem completo: a tela guarda os 400 registros mais
recentes, mas na hora de montar o backup o sistema busca a tabela inteira
no Supabase (lerTudoSupabase, em páginas pela chave). Se ela não vier
inteira, o backup leva os registros guardados no aparelho e avisa.

O que NÃO entra no backup do ERP: os arquivos anexados (fotos e PDFs de
referência e os comprovantes de pagamento), que ficam no Supabase
Storage — o backup guarda só a referência de cada um (nome e caminho).
Os anexos de referência têm a cópia semanal no Drive descrita abaixo.

Backup automático (fora do ERP): um Google Apps Script
(Apps_Script_Backup.gs) com duas tarefas. A diária, às 22h (depois do
expediente), gera uma cópia das tabelas do banco, manda por e-mail e
guarda também uma cópia numa pasta do Drive. A semanal (domingo, 22h)
copia para uma subpasta dessa pasta os anexos de referência que os
orçamentos e pedidos citam na coluna anexos: a lista sai dos dados, não
do bucket, e a tarefa baixa só o que ainda não tem e nunca apaga (os
comprovantes de pagamento, dentro de vendas.pags, não entram nela). O
arquivo diário é a cópia crua das tabelas, no formato
{formato: "supabase-bruto", geradoEm, tabelas: {clientes: [...], ...,
config: [...]}}, com os nomes de coluna do banco; por isso o restauro
grava essas linhas sem conversão (e tira delas as colunas de origem do
Financeiro se o banco ainda não as tiver). Como no restauro do .json do
ERP, usuários sem senha e o histórico ficam de fora.


## 14. Segurança

- A chave do Supabase embutida no código é do tipo "publishable"
  (pública/anônima) — fica exposta a qualquer visitante do site por
  design, e isso não representa uma falha de segurança por si só; o
  controle de acesso real depende das regras (RLS — Row Level Security)
  configuradas no projeto Supabase.
- O backup .json leva a senha na forma em que ela é guardada
  (`sha256$sal$resumo`), para o restauro devolver os acessos, e leva
  também a URL do script da planilha (seção 12). Não dá para voltar do
  resumo à senha digitada, mas o arquivo é confidencial: não deve ser
  mandado por grupo nem deixado em pasta compartilhada. A planilha e o
  PDF do backup não levam senha nenhuma.
- Login e perfis de usuário são a única camada de controle de acesso
  dentro da própria aplicação.
- O token da sessão do Supabase Auth é o que as regras de acesso do
  banco (RLS) podem usar para saber quem está pedindo: a coluna
  usuarios.auth_id liga cada conta do Auth ao perfil e ao nível de
  acesso da pessoa.
- As telas montam o HTML passando o texto gravado por esc(), que escapa
  os caracteres especiais do HTML. Link colado num orçamento só vira
  link clicável se for http ou https (linkDeReferenciaValido) e abre com
  rel=noopener, para um "javascript:..." colado não virar código rodando
  no ERP de quem abrir o orçamento.
- Avisos que citam comando SQL ou nome de coluna aparecem só para o
  Administrador (paraAdmin); a equipe lê uma frase simples.
- Serviço externo: a consulta de CNPJ do cadastro de clientes manda ao
  BrasilAPI (cadastro público da Receita, sem conta) só o número do
  CNPJ; CPF não é consultado.


## 15. Prompt pronto para recriar este sistema (copie e cole no Claude Code)

Quero que você crie, do zero, um ERP web para uma marcenaria de móveis
sob medida em madeira maciça chamada "Estúdio Mabe". Requisitos:

FORMATO: um único arquivo index.html com HTML, CSS e JavaScript puro (sem
framework, sem processo de build, sem TypeScript), hospedado como site
estático (ex: Vercel). Ao lado dele: a pasta vendor/ com as bibliotecas,
um manifest.json e um service worker (sw.js), para instalar como
aplicativo (PWA) no celular e no computador, com aviso de versão nova.
Gravações feitas sem conexão vão para uma fila no aparelho
(localStorage) e são reenviadas na ordem quando o sinal volta; o que
depende da resposta do servidor (criar documento numerado — ORC, V, OP,
OC —, importar nota ou extrato, mesclar no Financeiro) exige conexão.

BANCO DE DADOS: Supabase (Postgres). Crie um projeto Supabase e as
tabelas: clientes, produtos, madeiras, vendas, orcamentos, producao,
entregas, ferramentas, financeiro, fornecedores, compras, historico,
usuarios e config — com os campos descritos na seção 5 deste documento
(com o repositório, o "supabase/estrutura.sql" cria todas; sem ele, a
lista da seção 5 basta) — e o bucket "orcamentos-anexos" do Storage,
para os anexos. Use a chave
"publishable"/anon do Supabase direto no código do cliente (sem backend
próprio); o controle de acesso depende das regras do projeto (ver seção
14). A tabela usuarios guarda o perfil e o nível de cada pessoa; o login
é pelo Supabase Auth, com e-mail e senha, e as telas seguem os 4 níveis
de acesso da seção 6.

IDENTIDADE VISUAL: siga a paleta de cores e tipografia da seção 3 (fundo
bege claro, dourado como destaque, fontes "Plus Jakarta Sans" e "Fira
Code").

MÓDULOS: implemente cada módulo listado na seção 7, com navegação por uma
barra lateral fixa e uma área de conteúdo que troca de visibilidade sem
recarregar a página. No celular, a barra lateral vira menu e uma barra
embaixo deixa a um toque Início, Orçamentos, Pedidos e Produção (o resto
fica no "Mais"), só com as telas que o nível de acesso enxerga.

REGRAS DE NEGÓCIO: implemente o motor de precificação de orçamentos
exatamente como descrito na seção 8 (rateio do custo fixo pelas horas do
item, frete no custo, imposto, comissão e taxa da máquina dentro do
preço, preço à mão com margem implícita, quantidade, e desconto com
preço cheio e preço com desconto), e o fluxo de aprovação de orçamento
da seção 9 (aprovação parcial de itens + formas de pagamento que fecham
o total + geração automática de pedido + contas a receber + ordem de
produção), com a trava que impede gravar duas vezes num toque duplo, e,
no Financeiro, a importação do extrato OFX e a aba Conferir com o banco
da seção 7 (sugestões por valor, data e nome; Mesclar e Separar sem
perder o lançamento).

ALERTAS: implemente os badges automáticos descritos na seção 10.

PDFS: gere PDFs com jsPDF + jspdf-autotable seguindo o padrão visual e a
lista de documentos da seção 11 (a proposta ao cliente com capa,
validade e só o preço final; o detalhamento interno com custo, margem e
desconto), e pinte o fundo das páginas que a tabela cria sozinha
(interceptando doc.addPage ou pelo gancho willDrawPage do autotable).

BACKUP: inclua os 4 tipos de backup da seção 13 (JSON completo, Excel
multi-abas, PDF visual, e um documento de arquitetura como este), o
botão que baixa os quatro juntos num .zip e o "Restaurar backup
(.json)", disponíveis na tela de Configurações.

BIBLIOTECAS: use exatamente as listadas na seção 2, sem gerenciador de
pacotes, com os arquivos guardados no próprio repositório (pasta
vendor/): o cliente do Supabase carrega com a página; Chart.js, jsPDF +
autotable e xlsx-js-style só no primeiro uso (carregarLib / libPronta).

Comece pela estrutura do HTML/CSS (barra lateral + seções + modais),
depois o modelo de dados e a camada de sincronização com Supabase,
depois cada módulo, e por último o motor de precificação, o fluxo de
aprovação de orçamentos e a conferência com o banco do Financeiro, que
são as partes mais complexas do sistema.


---
Fim do documento. Gerado automaticamente pelo ERP Estúdio Mabe em 20/10/2026.
