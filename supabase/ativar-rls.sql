-- =====================================================================
--  ESTÚDIO MABE — ERP
--  Ativação de Row Level Security (RLS) no Supabase
-- =====================================================================
--
--  POR QUE ISTO É NECESSÁRIO
--  A chave publicável do Supabase fica visível no código da página
--  publicada na Vercel. Hoje todas as tabelas aceitam leitura, escrita e
--  exclusão anônimas: qualquer pessoa com o endereço do ERP consegue
--  baixar a base inteira, ou apagá-la, sem fazer login.
--
--  COMO ISTO RESOLVE
--  O RLS filtra cada consulta pelo usuário que a fez. Só que o Postgres
--  não tem como saber quem é o usuário enquanto o login for feito pelo
--  próprio ERP, contra a tabela `usuarios`: para o banco, toda requisição
--  chega como `anon`. Por isso o login precisa passar a ser feito pelo
--  Supabase Auth — é ele que emite o token que o RLS sabe ler.
--
--  Depois deste script, a chave publicável sozinha não dá acesso a nada:
--  é preciso ter um login e senha válidos.
--
-- ---------------------------------------------------------------------
--  ORDEM DE EXECUÇÃO — LEIA ANTES DE RODAR
-- ---------------------------------------------------------------------
--
--    ETAPA 1  Pode rodar agora. Só prepara o terreno (cria colunas e
--             funções). Não muda nada no comportamento do ERP.
--
--    ETAPA 2  Feita no painel do Supabase, não aqui: criar os usuários
--             em Authentication e ligá-los à tabela `usuarios`.
--
--    ETAPA 3  >>> SÓ DEPOIS QUE O ERP ESTIVER USANDO O SUPABASE AUTH <<<
--             É aqui que o RLS liga. Se rodar antes da atualização do
--             ERP estar publicada na Vercel, o sistema para de carregar
--             os dados para todo mundo — inclusive para você.
--
--    ETAPA 4  Limpeza opcional, depois que tudo estiver funcionando.
--
--    ROLLBACK No fim do arquivo, para desligar tudo se algo der errado.
--
-- ---------------------------------------------------------------------
--  O LADO DO ERP JÁ ESTÁ PRONTO
-- ---------------------------------------------------------------------
--
--  O index.html já usa o Supabase Auth: login por e-mail, sessão pelo
--  próprio Auth, criação de conta junto com o cadastro do usuário e
--  redefinição de senha por link no e-mail.
--
--  Ele funciona nos dois modos ao mesmo tempo: se o Auth recusar o
--  login, ele tenta o login antigo direto na tabela `usuarios`. É isso
--  que permite trabalhar normalmente entre a etapa 1 e a etapa 3. Ao
--  ligar o RLS, o caminho antigo perde o acesso à tabela e some sozinho.
--
-- =====================================================================


-- =====================================================================
--  ETAPA 1 — PREPARAÇÃO (segura, pode rodar agora)
-- =====================================================================

-- 1.1 Liga a tabela `usuarios` ao Supabase Auth e cria a coluna de
--     último acesso que faltava.
alter table public.usuarios
  add column if not exists auth_id uuid references auth.users(id) on delete cascade,
  add column if not exists ultimo  text;

create unique index if not exists usuarios_auth_id_key on public.usuarios(auth_id);
create unique index if not exists usuarios_login_key   on public.usuarios(lower(login));


-- 1.2 Funções auxiliares usadas pelas políticas.
--     SECURITY DEFINER para poderem ler `usuarios` sem esbarrar no
--     próprio RLS (senão vira recursão infinita).

create or replace function public.nivel_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.role
    from public.usuarios u
   where u.auth_id = auth.uid()
     and u.status = 'Ativo'
   limit 1
$$;

comment on function public.nivel_atual() is
  'Nível de acesso do usuário autenticado: Administrador, Financeiro, Produção ou Consulta.';

create or replace function public.eh_administrador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.nivel_atual() = 'Administrador', false)
$$;

create or replace function public.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
     where u.auth_id = auth.uid()
       and u.status = 'Ativo'
  )
$$;

comment on function public.usuario_ativo() is
  'Verdadeiro quando quem chamou está autenticado E tem cadastro ativo em usuarios. '
  'Desativar um usuário no ERP corta o acesso dele ao banco na hora.';

revoke all on function public.nivel_atual()     from anon;
revoke all on function public.eh_administrador() from anon;
revoke all on function public.usuario_ativo()    from anon;


-- =====================================================================
--  ETAPA 2 — NO PAINEL DO SUPABASE (não é SQL)
-- =====================================================================
--
--  a) Authentication > Providers > Email:
--       - deixe "Enable email provider" ligado
--       - DESLIGUE "Confirm email" (o estúdio cria as contas na mão;
--         com a confirmação ligada, o usuário não entra até clicar no
--         link do e-mail)
--
--  b) Authentication > Users > "Add user" > "Create new user",
--     um para cada pessoa. Use o e-mail real de cada uma — é por ele
--     que a recuperação de senha vai funcionar daqui pra frente.
--
--  c) Volte aqui e rode o bloco 2.1 abaixo, uma linha por pessoa,
--     trocando o e-mail e o login pelos valores certos.
--
--  ATALHO: a partir da etapa 1, o próprio ERP cria as contas. Em
--  Usuários > Novo Usuário, o campo "E-mail" cria a conta no Auth e já
--  grava o auth_id. Nesse caso você só precisa do item (a) acima e do
--  2.1 para o SEU cadastro, que é anterior à mudança.

-- 2.1 Liga cada conta do Auth ao cadastro correspondente em `usuarios`.
--     Troque os valores e rode. Repita para cada pessoa.
--
-- update public.usuarios u
--    set auth_id = a.id
--   from auth.users a
--  where a.email = 'mateus@estudiomabe.com.br'   -- e-mail criado na etapa 2b
--    and lower(u.login) = 'admin';               -- login que já existe no ERP

-- 2.2 Confira se ficou tudo ligado antes de seguir para a etapa 3.
--     Toda linha precisa aparecer com auth_id preenchido.
--
-- select u.login, u.nome, u.role, u.status, u.auth_id, a.email
--   from public.usuarios u
--   left join auth.users a on a.id = u.auth_id
--  order by u.nome;


-- =====================================================================
--  ETAPA 3 — LIGAR O RLS
--  >>> SÓ DEPOIS QUE A VERSÃO DO ERP COM SUPABASE AUTH ESTIVER NO AR <<<
-- =====================================================================

-- 3.1 Tabelas de negócio: qualquer usuário autenticado e ativo tem acesso
--     completo. A divisão por nível (Administrador / Financeiro /
--     Produção / Consulta) continua sendo feita na interface do ERP —
--     aqui o objetivo é barrar quem não tem login nenhum.
do $$
declare
  t text;
  tabelas text[] := array[
    'clientes','fornecedores','produtos','madeiras','ferramentas',
    'vendas','orcamentos','producao','entregas','compras',
    'financeiro','config','historico'
  ];
begin
  foreach t in array tabelas loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists erp_acesso_total on public.%I', t);
    execute format(
      'create policy erp_acesso_total on public.%I
         for all to authenticated
         using (public.usuario_ativo())
         with check (public.usuario_ativo())', t);
  end loop;
end $$;


-- 3.2 Tabela de usuários: todo mundo autenticado consegue ler (o ERP
--     precisa da lista para mostrar nomes e níveis), mas só o
--     Administrador cria, altera ou exclui.
alter table public.usuarios enable row level security;

drop policy if exists usuarios_leitura  on public.usuarios;
drop policy if exists usuarios_criar    on public.usuarios;
drop policy if exists usuarios_alterar  on public.usuarios;
drop policy if exists usuarios_excluir  on public.usuarios;
drop policy if exists usuarios_eu_mesmo on public.usuarios;

create policy usuarios_leitura on public.usuarios
  for select to authenticated
  using (public.usuario_ativo());

create policy usuarios_criar on public.usuarios
  for insert to authenticated
  with check (public.eh_administrador());

create policy usuarios_alterar on public.usuarios
  for update to authenticated
  using (public.eh_administrador())
  with check (public.eh_administrador());

create policy usuarios_excluir on public.usuarios
  for delete to authenticated
  using (public.eh_administrador());

-- Exceção: cada pessoa pode atualizar o próprio registro, mas sem se
-- promover nem se reativar sozinha.
create policy usuarios_eu_mesmo on public.usuarios
  for update to authenticated
  using (auth_id = auth.uid())
  with check (
    auth_id = auth.uid()
    and usuarios.role   = public.nivel_atual()
    and usuarios.status = 'Ativo'
  );


-- 3.3 Fecha a porta para o papel anônimo em tudo que é público.
--     Sem isto, uma tabela nova criada no futuro já nasceria aberta.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;


-- 3.4 Conferência: toda tabela precisa aparecer com rowsecurity = true.
--
-- select tablename, rowsecurity
--   from pg_tables
--  where schemaname = 'public'
--  order by rowsecurity, tablename;


-- =====================================================================
--  ETAPA 4 — LIMPEZA (opcional, só depois que tudo estiver rodando)
-- =====================================================================
--
--  Com o Supabase Auth cuidando das senhas, as colunas antigas de
--  credencial em `usuarios` deixam de ser usadas. Enquanto elas
--  existirem, continuam guardando o hash das senhas antigas sem
--  necessidade. Rode só quando tiver certeza de que o login novo está
--  funcionando para todas as pessoas.
--
-- alter table public.usuarios
--   drop column if exists senha,
--   drop column if exists pergunta,
--   drop column if exists resposta;


-- =====================================================================
--  ROLLBACK — DESLIGA TUDO E VOLTA AO ESTADO ANTERIOR
-- =====================================================================
--
--  Use se o ERP parar de carregar dados depois da etapa 3 e você
--  precisar voltar a trabalhar imediatamente. Isto reabre o banco para
--  acesso anônimo — é uma medida de emergência, não um estado final.
--
-- do $$
-- declare
--   t text;
--   tabelas text[] := array[
--     'clientes','fornecedores','produtos','madeiras','ferramentas',
--     'vendas','orcamentos','producao','entregas','compras',
--     'financeiro','config','historico','usuarios'
--   ];
-- begin
--   foreach t in array tabelas loop
--     execute format('alter table public.%I disable row level security', t);
--     execute format('grant all on public.%I to anon, authenticated', t);
--   end loop;
-- end $$;
--
-- grant all on all sequences in schema public to anon, authenticated;
-- grant all on all functions in schema public to anon, authenticated;
