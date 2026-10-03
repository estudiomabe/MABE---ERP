-- =====================================================================
--  ESTÚDIO MABE — ERP
--  Estrutura do banco (Supabase / PostgreSQL)
-- =====================================================================
--
--  PARA QUE SERVE
--  O backup .json guarda os DADOS; este arquivo guarda a FORMA onde eles
--  entram. Num desastre total — projeto do Supabase apagado, conta
--  perdida — só o .json não basta: alguém precisa recriar as tabelas
--  antes de poder devolver os registros. É isso que este script faz.
--
--  COMO USAR NUM PROJETO NOVO
--    1. Criar um projeto novo no Supabase.
--    2. Abrir o SQL Editor e rodar este arquivo inteiro.
--    3. Trocar SUPABASE_URL e SUPABASE_KEY no index.html pelos do
--       projeto novo (estão juntos, perto do início do <script>).
--    4. Abrir o ERP, entrar como administrador e usar
--       Configurações > Restaurar backup (.json).
--    5. Criar o bucket público `orcamentos-anexos` em Storage, se for
--       usar anexos (as imagens em si não vêm no .json — ver o LEIA-ME
--       do backup).
--
--  DE ONDE VEIO ESTE ARQUIVO
--  Reconstruído a partir do banco em produção (colunas e tipos lidos
--  pela API REST em 03/10/2026) e das funções `*ParaSupabase` do
--  index.html, que são quem escreve em cada tabela. `madeiras` e
--  `compras` estavam vazias na leitura, então as colunas delas vieram
--  só do código.
--
--  O que a API não revela, e por isso aqui é reconstrução e não cópia:
--  a precisão exata dos números (usei `numeric`, que aceita qualquer
--  valor que o ERP grava), os valores DEFAULT do servidor e os índices
--  além das chaves primárias. Nada disso muda o funcionamento do ERP.
--
--  SEGURANÇA
--  Este script deixa o banco como ele está hoje: sem RLS, acessível com
--  a chave publicável. Para fechar o acesso, rodar depois o
--  `ativar-rls.sql`, que está nesta mesma pasta e explica as etapas.
--
--  Rodar duas vezes não quebra nada: tudo é `if not exists`.
-- =====================================================================

-- ---------------------------------------------------------------------
--  CADASTROS
-- ---------------------------------------------------------------------

-- Clientes. `doc` guarda CPF ou CNPJ; `id` é o identificador gerado pelo
-- próprio ERP (não é sequencial), por isso text e não uuid.
create table if not exists public.clientes (
  id          text primary key,
  nome        text not null,
  email       text,
  tel         text,
  doc         text,
  cidade      text,
  endereco    text,
  status      text default 'Ativo',
  created_at  timestamptz default now()
);

-- Fornecedores e prestadores de serviço (os dois ficam aqui).
create table if not exists public.fornecedores (
  id          text primary key,
  nome        text not null,
  cnpj        text,
  tel         text,
  email       text,
  cidade      text,
  status      text default 'Ativo',
  created_at  timestamptz default now()
);

-- Portfólio e insumos na mesma tabela, separados por `tipo`
-- ('Portfólio' ou 'Insumo'). `materiais` é a ficha de composição do
-- produto: [{ref, desc, qty, custo}].
create table if not exists public.produtos (
  id          text primary key,
  nome        text not null,
  tipo        text default 'Portfólio',
  cat         text,
  un          text default 'un',
  preco       numeric default 0,
  custo       numeric default 0,
  est         numeric default 0,
  min         numeric default 0,
  materiais   jsonb default '[]'::jsonb,
  created_at  timestamptz default now()
);

-- Estoque de madeira. Medidas em centímetros; o volume em m³ é
-- calculado no ERP, não fica guardado.
create table if not exists public.madeiras (
  id          text primary key,
  especie     text not null,
  tipo        text,
  esp         numeric default 0,
  larg        numeric default 0,
  comp        numeric default 0,
  qtd         numeric default 0,
  custo       numeric default 0,
  umidade     numeric default 0,
  min         numeric default 0,
  forn        text,
  created_at  timestamptz default now()
);

-- Máquinas e ferramentas. `ult` é a última manutenção e `intervalo` o
-- número de dias até a próxima.
create table if not exists public.ferramentas (
  id          text primary key,
  nome        text not null,
  tipo        text,
  ult         date,
  intervalo   integer,
  obs         text,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------
--  COMERCIAL
-- ---------------------------------------------------------------------

-- Orçamentos. `itens` é o que vale hoje: cada item carrega a própria
-- ficha de cálculo (materiais, mão de obra, serviços, custos fixos do
-- dia em que foi salvo, impostos, comissão, markup, frete).
-- As colunas `tipo`, `descricao`, `cf`, `mdo`, `materiais`, `prod_id`,
-- `qty` e `desc_pct` são de quando um orçamento tinha um item só;
-- ficam para os registros antigos continuarem abrindo.
create table if not exists public.orcamentos (
  id          text primary key,
  num         integer,
  cli_id      text,                      -- aponta para clientes.id
  data        date,
  validade    date,
  status      text default 'Rascunho',
  obs         text,
  origem      text,
  itens       jsonb default '[]'::jsonb,
  anexos      jsonb default '[]'::jsonb,
  custo       numeric default 0,
  preco       numeric default 0,
  lucro       numeric default 0,
  op_id       text,
  -- legado (orçamento de item único)
  tipo        text,
  descricao   text,
  cf          jsonb,
  mdo         jsonb,
  materiais   jsonb,
  imposto     numeric default 0,
  markup      numeric default 0,
  prod_id     text,
  qty         numeric,
  desc_pct    numeric default 0,
  created_at  timestamptz default now()
);

-- Pedidos. `pag` guarda o rótulo das formas de pagamento e `baixa` diz
-- se o estoque já foi baixado.
create table if not exists public.vendas (
  id          text primary key,
  num         integer,
  cli_id      text,                      -- aponta para clientes.id
  data        date,
  itens       jsonb default '[]'::jsonb,
  anexos      jsonb default '[]'::jsonb,
  total       numeric default 0,
  pag         text,
  status      text default 'Pendente',
  obs         text,
  origem      text,
  baixa       boolean default false,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------
--  PRODUÇÃO E ENTREGA
-- ---------------------------------------------------------------------

-- Ordens de produção (o quadro do PCP). `etapa` é o número da coluna no
-- kanban e `fim` a data de conclusão.
create table if not exists public.producao (
  id          text primary key,
  num         integer,
  titulo      text,
  cli_id      text,                      -- aponta para clientes.id
  orc_id      text,
  prazo       date,
  resp        text,
  prio        text,
  etapa       integer default 0,
  status      text,
  obs         text,
  fim         date,
  created_at  timestamptz default now()
);

create table if not exists public.entregas (
  id          text primary key,
  data        date,
  cli_id      text,                      -- aponta para clientes.id
  op_id       text,
  peca        text,
  endereco    text,
  resp        text,
  status      text,
  obs         text,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------
--  COMPRAS E FINANCEIRO
-- ---------------------------------------------------------------------

-- Ordens de compra. `lancado` marca as que já viraram despesa no
-- financeiro, para não lançar duas vezes.
create table if not exists public.compras (
  id          text primary key,
  num         integer,
  for_id      text,                      -- aponta para fornecedores.id
  data        date,
  total       numeric default 0,
  status      text,
  obs         text,
  lancado     boolean default false,
  created_at  timestamptz default now()
);

-- Lançamentos financeiros. `tipo` é 'entrada' ou 'saida'; `val` é o
-- valor; `centro_custo` liga o lançamento a um centro de custo.
create table if not exists public.financeiro (
  id            text primary key,
  tipo          text,
  data          date,
  descricao     text,
  cat           text,
  centro_custo  text,
  val           numeric default 0,
  status        text,
  obs           text,
  created_at    timestamptz default now()
);

-- ---------------------------------------------------------------------
--  SISTEMA
-- ---------------------------------------------------------------------

-- Usuários do ERP. `senha` guarda "sha256$sal$resumo" — não é a senha
-- em si. `role` é o nível de acesso. `resposta` (da pergunta de
-- segurança) é guardada do mesmo jeito que a senha.
--
-- As colunas `auth_id` e `ultimo` são opcionais: o index.html verifica
-- se existem antes de escrever (`temColuna`). `auth_id` só é criada ao
-- rodar o `ativar-rls.sql`.
create table if not exists public.usuarios (
  id          text primary key,
  login       text not null,
  senha       text,
  nome        text,
  role        text default 'Operacional',
  status      text default 'Ativo',
  pergunta    text,
  resposta    text,
  created_at  timestamptz default now()
);
-- O banco de produção hoje NÃO tem a coluna `ultimo` (último acesso), e o
-- ERP funciona sem ela. Para passar a guardar isso, basta descomentar:
-- alter table public.usuarios add column if not exists ultimo timestamptz;

-- Configurações, no formato campo/valor: cada ajuste do ERP vira uma
-- linha. Os valores compostos (fichas de preço, serviços, folha de
-- pagamento, dados do estúdio) são JSON guardado como texto.
create table if not exists public.config (
  campo       text primary key,
  valor       text,
  updated_at  timestamptz default now()
);

-- Diário de edições. `id` é sequencial do banco (é a única tabela
-- assim); `dt` é a data e hora em texto, como o ERP escreve.
create table if not exists public.historico (
  id          bigint generated by default as identity primary key,
  dt          text,
  user_nome   text,
  acao        text,
  modulo      text,
  detalhe     text,
  created_at  timestamptz default now()
);

-- Buscas que o ERP faz com frequência.
create index if not exists idx_orcamentos_num   on public.orcamentos (num desc);
create index if not exists idx_vendas_num       on public.vendas (num desc);
create index if not exists idx_producao_num     on public.producao (num desc);
create index if not exists idx_compras_num      on public.compras (num desc);
create index if not exists idx_financeiro_data  on public.financeiro (data desc);
create index if not exists idx_historico_id     on public.historico (id desc);
create index if not exists idx_usuarios_login   on public.usuarios (login);

-- =====================================================================
--  Depois de rodar: o banco está vazio e pronto para receber o backup.
--  O ERP recalcula sozinho a numeração (ORC, V, OP, compras) a partir
--  do maior número que encontrar nos dados restaurados.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Sobre as chaves estrangeiras: as ligações entre tabelas (cli_id,
--  for_id, orc_id, op_id) ficam aqui como comentário, não como
--  constraint. A API REST não mostra quais constraints existem hoje em
--  produção, então preferi não inventá-las: sem elas, um backup antigo
--  entra inteiro mesmo que um cliente tenha sido excluído no meio do
--  caminho — com elas, o restauro falharia. Quem quiser o banco rígido
--  adiciona depois do restauro, com `alter table ... add foreign key`.
-- ---------------------------------------------------------------------
