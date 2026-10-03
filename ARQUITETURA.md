# Arquitetura do ERP — Estúdio Mabe

Documento técnico gerado automaticamente pelo próprio sistema em 03/10/2026.
Descreve COMO este ERP foi projetado e construído — tecnologias, banco de dados,
módulos e regras de negócio — para que o sistema possa ser recriado do zero,
mesmo sem acesso ao código-fonte original.

IMPORTANTE: este arquivo NÃO contém dados de clientes, orçamentos, financeiro
etc. Para isso use os botões "Baixar Backup Completo" em JSON, Excel ou PDF,
em Configurações. Este documento descreve apenas a ARQUITETURA do sistema.

Como usar: copie todo o conteúdo deste arquivo e cole numa conversa com o
Claude Code, pedindo para ele recriar o sistema a partir daqui (veja um
prompt pronto na última seção).


## 1. Visão geral

- Nome: ERP interno da Estúdio Mabe, marcenaria de móveis sob medida em
  madeira maciça.
- Público: uso interno da equipe (administradores, operadores e
  visualizadores) — não é um produto para venda a terceiros.
- Formato: aplicação web de página única, sem processo de build — um único
  arquivo "index.html" contendo HTML, CSS e JavaScript puro (ES6+), sem
  framework (sem React/Vue/Angular) e sem TypeScript.
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
  rapidamente e mesmo com internet instável.


## 2. Bibliotecas usadas (via CDN jsdelivr, sem gerenciador de pacotes)

- Chart.js 4.4.0 — gráficos do Dashboard.
- @supabase/supabase-js v2 — cliente de acesso ao banco de dados.
- jsPDF 2.5.1 + jspdf-autotable 3.8.2 — geração de PDFs (orçamentos,
  relatórios, backups).
- xlsx-js-style 1.2.0 (fork do SheetJS com suporte a estilos de célula) — exportação do backup em Excel com a identidade visual do estúdio.
- Google Fonts: "Plus Jakarta Sans" (textos) e "Fira Code" (números e
  valores monetários, monoespaçada).


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
- Tipografia: "Plus Jakarta Sans" para textos gerais, "Fira Code" para
  números, códigos e valores monetários.


## 4. Estrutura do arquivo único (index.html)

- <head>: meta tags, título, favicon inline (SVG em data-URI), fontes do
  Google, os 5 scripts de CDN, e um único bloco <style> com variáveis CSS
  (:root) e todas as classes usadas no sistema.
- <body>:
  - uma tela de login (mostrada/escondida por classe CSS);
  - uma barra lateral fixa (sidebar) com links para cada módulo, agrupados
    por categoria (Principal, Comercial, Produção, Estoque, Financeiro,
    Compras, Cadastros);
  - uma topbar com busca global e nome/perfil do usuário logado;
  - uma div por módulo (classe "section", com "id=section-NOME"), todas
    presentes no mesmo HTML — a navegação apenas alterna qual delas recebe
    a classe "active" e fica visível;
  - modais (overlays) para os formulários de cadastro/edição de cada
    módulo;
  - um único <script> no final do arquivo com toda a lógica em JavaScript.


## 5. Modelo de dados — tabelas no Supabase (Postgres)

O CREATE TABLE de todas elas, pronto para rodar no SQL Editor de um
projeto novo, está em "supabase/estrutura.sql" no repositório. A lista
abaixo é o resumo em português.

1. clientes — nome, email, tel, doc (CPF/CNPJ), cidade, endereco, status
2. produtos — usada tanto para "Portfólio" (produtos prontos vendáveis)
   quanto para "Insumo" (matéria-prima); campos: nome, tipo, cat, preco,
   custo, est (estoque atual), min (estoque mínimo), un (unidade)
3. madeiras — espécie, tipo, dimensões (para cálculo de volume em m³),
   custo, estoque mínimo
4. vendas (Pedidos) — num sequencial, cli_id, data, pag (forma de
   pagamento), status, itens (array em JSON), total, baixa (boolean)
5. orcamentos — num sequencial, cli_id, data, validade, status, itens
   (array em JSON com o detalhamento de custo/preço de cada item),
   anexos, custo, preco, lucro, op_id (ordem de produção vinculada)
6. producao (Ordens de Produção / PCP) — num sequencial, titulo, cli_id,
   prazo, resp (responsável), prio (prioridade), etapa (índice 0-6 do
   kanban), status, orc_id, fim
7. entregas — op_id, data, cli_id, peca, endereco, resp, status, obs
8. ferramentas (Máquinas & Ferramentas) — nome, tipo, ult (última
   manutenção), intervalo (dias), obs
9. financeiro — tipo (Entrada/Saída), data, descricao, cat, centro_custo,
   val, status (Pago/Pendente/Cancelado)
10. fornecedores — nome, cnpj, tel, cidade, status
11. compras (Ordens de Compra) — num sequencial, for_id, data, total,
    status, obs, lancado (boolean)
12. historico (auditoria) — dt, user_nome, acao, modulo, detalhe; toda
    ação relevante do sistema grava uma linha aqui
13. usuarios — login, senha (hash SHA-256), nome, perfil, status, ultimo
    acesso, pergunta e resposta de recuperação
14. config — tabela chave-valor simples (campo, valor). É o "porão" do
    sistema: tudo que precisaria de uma tabela nova mora aqui como JSON
    numa linha, porque o app não roda DDL. Guarda custos fixos padrão,
    custos fixos extras, tipos de mão de obra, folha de pagamento,
    condições de pagamento (taxas de parcelamento e % de PIX antecipado),
    dados cadastrais da empresa, saldo inicial do caixa, data da última
    importação de OFX, catálogo de serviços de terceiros, lista de
    comissionados, tempos de produção por produto, links de compra dos
    materiais e as fichas de preço do portfólio.

Storage (arquivos): existe um bucket "orcamentos-anexos" no Supabase
Storage, com as pastas "orcamentos/<id>/" e "pedidos/<id>/", onde ficam
os arquivos de referência anexados a cada orçamento e a cada pedido. No
banco, as tabelas guardam só a lista (nome, caminho e URL) na coluna
"anexos".

Colunas que nasceram depois: algumas colunas foram acrescentadas à mão no
Supabase (orcamentos.origem, financeiro.obs, vendas.anexos). Como o app
não roda DDL, ele detecta em tempo de execução se a coluna existe antes
de gravar — assim continua funcionando mesmo num banco que ainda não a
tenha.

Convenção de nomes: no banco os campos usam "snake_case" (ex: cli_id,
centro_custo, for_id) e no JavaScript usam "camelCase" (ex: cliId,
centroCusto, forId) — cada módulo tem duas pequenas funções de conversão
(ex: "vendaParaSupabase" e "vendaDeSupabase") que traduzem de um formato
para o outro.

Numeração: contadores sequenciais ficam guardados à parte (venda, compra,
orc, op) e aparecem na tela com prefixo e zero à esquerda, por exemplo:
ORC-0007, V-0014, OP-0009, OC-0003.


## 6. Autenticação e permissões

- Login pelo próprio ERP, contra a tabela usuarios: a senha é guardada
  como "sha256$sal$resumo" (SHA-256 com sal por usuário, via Web Crypto) e nunca
  em texto puro. Não usa OAuth; o Supabase Auth está preparado no código
  mas ainda não é a fonte do login.
- Recuperação de senha por pergunta e resposta, com a resposta guardada
  do mesmo jeito que a senha.
- 4 níveis de acesso: Administrador (tudo, inclusive Usuários,
  Configurações e Folha de Pagamento), Financeiro (tudo menos Usuários e
  Configurações), Produção (Calendário, PCP, Máquinas, Estoque, Pedidos e
  Clientes — sem Financeiro, sem Orçamentos e sem nenhum valor em R$) e
  Consulta (as mesmas telas da Produção, somente leitura). Os perfis
  antigos (Admin, Operador, Visualizador) são convertidos na carga.
- Funções centrais no código: nivelDe(u) devolve o nível, já convertendo
  os perfis antigos; canEdit() diz quem pode gravar; isAdmin() só o
  Administrador; verValores() quem pode ver dinheiro; podeVer(secao)
  quais telas aparecem; guard() e guardValores() bloqueiam a ação e
  mostram o aviso.
- Sessão: o id do usuário logado fica salvo no localStorage (chave
  "erp_mabe_session") para manter o login entre acessos.


## 7. Módulos / telas do sistema

- Dashboard — KPIs do período (orçamentos, pedidos, entradas, saídas,
  faturamento = soma dos pedidos, despesas fixas, lucro), gráfico de evolução de pedidos, gráfico de status dos
  pedidos, estoque crítico, últimas transações; botão para gerar um PDF
  com o mesmo conteúdo do período selecionado.
- Orçamentos — criação de orçamentos com múltiplos itens (sob medida,
  catálogo ou novo produto); status em caixa de seleção na própria lista
  (Rascunho, Enviado, Aprovado, Reprovado, Concluído); aprovação parcial
  de itens (checklist) que gera automaticamente um Pedido, contas a
  receber e uma Ordem de Produção; anexos de referência (fotos, PDFs);
  geração do PDF da proposta (com capa), do contrato de prestação de
  serviço e envio por WhatsApp ou e-mail.
- Pedidos (Vendas) — lista de pedidos gerados manualmente ou a partir da
  aprovação de orçamentos, com baixa financeira, anexos de referência
  próprios e dois documentos para impressão: "Imprimir pedido (PCP)",
  com opção de ocultar valores para a oficina, e "Imprimir recibo" para
  o cliente. Em ambos dá para escolher, por caixa de seleção, quais
  anexos saem junto.
- Produção (PCP) — 7 etapas fixas: Planejamento, Corte & Usinagem,
  Montagem, Acabamento, Retrabalho, Pronto, Entregue. Dois modos de
  visualização, escolhidos num seletor e gravados no aparelho: Kanban
  (quadro por etapa) e Lista (tabela única por prazo, com a etapa em
  coluna de status e a observação recolhível). O responsável por cada
  ordem é escolhido direto no cartão ou na linha. O botão "Imprimir PCP"
  gera a folha de produção em PDF, com quadrado de conferência e a
  observação de cada ordem.
- Entregas — controle de entregas/instalações vinculadas às ordens de
  produção.
- Máquinas & Ferramentas — cadastro com alerta de manutenção preventiva
  vencida.
- Material/Insumo — estoque de matéria-prima com alerta de estoque
  mínimo e link de compra do material (o nome fica sublinhado e abre a
  página do fornecedor).
- Portfólio — catálogo de produtos prontos vendáveis, também com alerta
  de estoque mínimo. Cada item tem uma FICHA DE PREÇO (a mesma tela de
  composição usada no orçamento: materiais, mão de obra, serviços,
  máquina, imposto, comissão e markup), guardada em config.fichasProdutos.
  Ao adicionar o item a um orçamento, a ficha vem preenchida e é
  recalculada com os custos do dia. Cada item também gera uma Ficha
  Técnica em PDF para a execução na oficina.
- Madeiras — estoque de madeira com cálculo de volume em m³.
- Financeiro — lançamentos de entrada/saída com status de pagamento,
  importação de extrato bancário em OFX e conciliação com os lançamentos
  já existentes.
- Centro de Custos — segmentação dos lançamentos financeiros por setor
  fixo (Marketing, Vendas, Pedidos, Folha de Pagamento, Administrativo,
  Manutenção).
- Relatórios — relatório financeiro detalhado por período.
- Compras (Ordens de Compra) — pedidos a fornecedores, com importação da
  NF-e em XML, que atualiza os custos no cadastro de material/insumo.
- Serviços de Terceiros — catálogo de serviços contratados (corte a
  laser, tapeçaria, vidro) com valor e unidade, usado na composição de
  preço dos orçamentos.
- Comissões — cadastro de quem recebe comissão e o percentual padrão.
- Documentos (modelos) — um lugar só para ver e gerar em branco todos os
  documentos que o ERP produz: proposta, recibo, pedido, contrato, ficha
  técnica, relatórios e backups.
- Fornecedores / Clientes — CRMs simples.
- Usuários — gestão de usuários e perfis (só Admin; dados 100% locais).
- Histórico de Edições — auditoria de todas as ações relevantes (quem fez
  o quê e quando).
- Configurações — sincronização com Google Sheets, custos fixos padrão
  (mais custos fixos extras dinâmicos), folha de pagamento, tipos de mão
  de obra, condições de pagamento, dados cadastrais da empresa, backups
  (o .zip com tudo, ou JSON/Excel/PDF/Arquitetura separados), restaurar
  backup e reset de dados.


## 8. Motor de precificação de orçamentos (a regra de negócio mais importante)

Para cada item de um orçamento, o cálculo segue esta ordem:

1. Custo fixo do período = soma de Aluguel + IPTU + Água + Energia +
   Contador + Outros + quaisquer custos fixos extras cadastrados
   dinamicamente.
2. Esse custo fixo mensal é dividido pelas "Horas/Mês" configuradas, e
   multiplicado pelas horas de mão de obra lançadas naquele item
   específico → "custo fixo rateado".
3. Mão de obra = soma de (horas × valor/hora) para cada tipo de mão de
   obra usado (tipos configuráveis, ex: Sócio, Auxiliar, Marceneiro, cada
   um com seu valor/hora).
4. Materiais = soma de (quantidade × custo unitário) de cada
   material/madeira/insumo usado no item.
5. Serviços terceirizados = soma dos valores lançados.
6. Custo total do item = custo fixo rateado + mão de obra + materiais +
   serviços.
7. Preço sugerido = custo total ÷ (1 − (margem de lucro % + imposto %) /
   100). Alternativamente, o usuário pode sobrescrever manualmente o
   preço final do item.


## 9. Fluxo de aprovação de orçamento

Ao aprovar um orçamento, o usuário escolhe quais itens o cliente de fato
aprovou (checklist — permite aprovação parcial) e a forma de pagamento:

- PIX — divisão configurável entre "% antecipado hoje" e o restante "na
  entrega".
- Cartão de Crédito — parcelado, com taxa de juros configurável por
  número de parcelas (1x a 10x).
- Boleto — 100% na entrega.
- Outro — 100% antecipado.

Ao confirmar, o sistema automaticamente: cria um Pedido (venda) só com os
itens aprovados; lança as contas a receber correspondentes no Financeiro
(uma ou mais, conforme a forma de pagamento); e cria uma Ordem de
Produção vinculada, já na etapa "Planejamento".


## 10. Alertas automáticos (badges no menu lateral)

- Estoque crítico de Insumos e de Portfólio (estoque atual ≤ estoque
  mínimo).
- Madeira abaixo do volume mínimo cadastrado.
- Manutenção de máquina atrasada (data prevista já passou).
- Ordem de Produção com prazo vencido e ainda não concluída.


## 11. Geração de PDFs

Os documentos em PDF são: proposta do orçamento, contrato de prestação de
serviço, ficha técnica do produto, pedido para a oficina (PCP), recibo do
cliente, folha de produção do PCP, relatório do dashboard, relatório
financeiro e o backup completo. Todos seguem o mesmo padrão visual:
cabeçalho com a marca da Mabe, título, linha divisória dourada, tabelas
com cabeçalho escuro e linhas zebradas, rodapé com endereço/contato +
número de página. Os documentos que vão para o cliente ou para a oficina
abrem com uma página de capa, com a marca centralizada.

A marca é um PNG com fundo transparente embutido no próprio index.html
como data URI (constante MARCA_PNG, com a proporção em MARCA_PROP), e é
desenhada com addImage(...,'SLOW') — assim o arquivo final fica na casa
das dezenas de KB em vez de centenas. Não se deve redesenhar o logotipo
com fonte do jsPDF: a fonte da marca é geométrica e o resultado não bate.

Duas armadilhas do jsPDF que o código contorna: as fontes são Latin-1, de
modo que emojis e setas corrompem a linha inteira (há uma função que
limpa o texto antes de escrever); e o alinhamento centralizado ignora o
charSpace, então existe um helper que desconta a largura do espaçamento
ao centralizar títulos espaçados.

Detalhe técnico relevante: a biblioteca jspdf-autotable pode criar
páginas extras sozinha quando uma tabela não cabe numa página só. Para
garantir que o fundo colorido apareça em TODA página (inclusive essas
criadas automaticamente), o código intercepta (monkey-patch) a função
doc.addPage do jsPDF, pintando o fundo assim que qualquer página nova é
criada — antes de qualquer conteúdo ser desenhado nela.


## 12. Sincronização com Google Sheets (opcional, não é a fonte de verdade)

Um Google Apps Script é publicado como aplicativo Web (executar como
"eu", acesso "qualquer pessoa"). O ERP envia requisições POST para essa
URL a cada alteração relevante (formato: entidade, ação, dados), e a
planilha guarda uma cópia legível dos dados. Também é possível puxar
(importar) da planilha de volta para o sistema. Essa sincronização é
totalmente opcional — o sistema funciona plenamente sem ela, usando
apenas o Supabase.


## 13. Backups existentes

O botão principal baixa um único arquivo .zip com os quatro documentos
abaixo mais um LEIA-ME explicando cada um. O .zip é montado pelo próprio
navegador, sem biblioteca: o código escreve os cabeçalhos locais, o
diretório central e o EOCD na mão, com CRC-32 próprio e compressão via
CompressionStream('deflate-raw').

- Backup Completo (JSON) — todos os dados, inclusive os usuários com a senha
  na forma em que ela é guardada ("sha256$sal$resumo"); é o arquivo que
  restaura o sistema, e por isso deve ser tratado como confidencial.
- Backup em Planilhas (Excel) — os mesmos dados em abas, uma por módulo,
  incluindo configurações, serviços, comissionados e fichas de preço.
- Backup Completo (PDF) — documento visual com a identidade da marca,
  para leitura ou impressão.
- Backup de Arquitetura (este documento) — não contém dados, contém a
  descrição de como o sistema foi construído.

Restaurar: "Restaurar backup (.json)" lê o arquivo, mostra quantos
registros de cada módulo serão gravados, pede confirmação por escrito e
então grava por cima no Supabase (upsert pelo id, em blocos de 100). Nada
é apagado: o que existe no banco e não está no arquivo permanece. Os
usuários entram com a senha que tinham, de modo que as pessoas continuam
entrando com a mesma senha de antes; usuários vindos de um backup antigo,
sem o campo senha, são ignorados, para não criar contas sem entrada. O
histórico não é restaurado (é um diário; recarregá-lo duplicaria as
linhas). Depois de restaurar num
banco novo, vale conferir as sequências de numeração (num) das tabelas
orcamentos, vendas, producao e compras.

O histórico do backup vem completo: a tela guarda os 400 registros mais
recentes, mas na hora de montar o backup o sistema busca a tabela inteira
no Supabase, paginada.

O que NÃO entra no backup: os arquivos anexados (fotos e PDFs de
referência), que ficam no Supabase Storage — o backup guarda só o nome e
o link de cada um.


## 14. Segurança

- A chave do Supabase embutida no código é do tipo "publishable"
  (pública/anônima) — fica exposta a qualquer visitante do site por
  design, e isso não representa uma falha de segurança por si só; o
  controle de acesso real depende das regras (RLS — Row Level Security)
  configuradas no projeto Supabase.
- O backup .json leva a senha na forma em que ela é guardada
  ("sha256$sal$resumo"), para o restauro devolver os acessos. Não dá para voltar
  dela à senha digitada, mas o arquivo é confidencial: não deve ser
  mandado por grupo nem deixado em pasta compartilhada. A planilha e o
  PDF do backup não levam senha nenhuma.
- Login e perfis de usuário são a única camada de controle de acesso
  dentro da própria aplicação.


## 15. Prompt pronto para recriar este sistema (copie e cole no Claude Code)

Quero que você crie, do zero, um ERP web para uma marcenaria de móveis
sob medida em madeira maciça chamada "Estúdio Mabe". Requisitos:

FORMATO: um único arquivo index.html com HTML, CSS e JavaScript puro (sem
framework, sem processo de build, sem TypeScript) — deve rodar sendo
aberto direto no navegador ou hospedado como site estático (ex: Vercel).

BANCO DE DADOS: Supabase (Postgres). Crie um projeto Supabase e as
tabelas: clientes, produtos, madeiras, vendas, orcamentos, producao,
entregas, ferramentas, financeiro, fornecedores, compras, historico e
config — com os campos descritos na seção 5 deste documento. Use a chave
"publishable"/anon do Supabase direto no código do cliente (sem backend
próprio). Não crie tabela de usuários no banco — usuários e login ficam
só no localStorage do navegador (ver seção 6).

IDENTIDADE VISUAL: siga a paleta de cores e tipografia da seção 3 (fundo
bege claro, dourado como destaque, fontes "Plus Jakarta Sans" e "Fira
Code").

MÓDULOS: implemente cada módulo listado na seção 7, com navegação por uma
barra lateral fixa e uma área de conteúdo que troca de visibilidade sem
recarregar a página.

REGRAS DE NEGÓCIO: implemente o motor de precificação de orçamentos
exatamente como descrito na seção 8, e o fluxo de aprovação de orçamento
da seção 9 (aprovação parcial de itens + geração automática de pedido +
contas a receber + ordem de produção).

ALERTAS: implemente os badges automáticos descritos na seção 10.

PDFS: gere PDFs com jsPDF + jspdf-autotable seguindo o padrão visual da
seção 11, e use o truque de interceptar doc.addPage para evitar páginas
extras com fundo errado.

BACKUP: inclua os 4 tipos de backup da seção 13 (JSON completo, Excel
multi-abas, PDF visual, e um documento de arquitetura como este),
disponíveis na tela de Configurações.

BIBLIOTECAS: use exatamente as listadas na seção 2, carregadas via CDN
(jsdelivr), sem gerenciador de pacotes.

Comece pela estrutura do HTML/CSS (barra lateral + seções + modais),
depois o modelo de dados e a camada de sincronização com Supabase,
depois cada módulo, e por último o motor de precificação e o fluxo de
aprovação de orçamentos, que são as partes mais complexas do sistema.


---
Fim do documento. Gerado automaticamente pelo ERP Estúdio Mabe em 03/10/2026.
