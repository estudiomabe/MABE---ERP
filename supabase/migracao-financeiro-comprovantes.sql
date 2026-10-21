-- =====================================================================
--  Financeiro: comprovantes dos lançamentos e uma conta por parcela
--  (etapa 4 do plano do Financeiro — "um pagamento, um lançamento")
-- =====================================================================
--
--  O QUE FAZ
--   1. Cria a coluna comprovantes na tabela financeiro, começando vazia
--      ([]) em todos os lançamentos. Ela guarda os comprovantes de quem
--      NÃO é pagamento de pedido: a linha do banco sem pedido, a despesa
--      lançada à mão, a compra, a nota fiscal. O comprovante de um
--      pagamento de pedido continua na linha de pagamento do pedido
--      (vendas.pags) e aparece no Financeiro sem ser copiado.
--   2. Cria uma rede de segurança: o banco passa a recusar uma segunda
--      conta ativa para a mesma linha de pagamento e a mesma parcela.
--      O ERP já evita a duplicata; o índice só pega o caso que escapar
--      (dois aparelhos salvando o mesmo pedido ao mesmo tempo, por
--      exemplo). Se hoje já houver uma duplicata, o índice NÃO é criado
--      (o resto continua) e a mensagem diz como ver qual é.
--   3. Termina mostrando se a coluna e o índice existem.
--
--  É SEGURO
--   - Pode rodar de novo: tudo é "if not exists".
--   - Não muda nenhum lançamento: nada é apagado, nenhum valor, data,
--     tipo, status, descrição, pedido, centro de custo ou observação é
--     tocado. Os lançamentos que já existem só ganham a lista vazia.
--   - Roda inteiro ou não roda nada (begin/commit): se der erro no meio,
--     o banco fica como estava.
--
--  COMO RODAR
--   Supabase > SQL Editor > New query > colar este arquivo inteiro > Run.
--   Rode ANTES de publicar a versão do ERP que traz a etapa 4.
--   O resultado é uma linha: coluna_comprovantes = sim e
--   indice_uma_conta_por_parcela = sim. Se o índice vier "não", veja a
--   consulta comentada no fim do arquivo.
--
--  DEPOIS DE RODAR
--   O ERP percebe a coluna sozinho (ao entrar, ou ao abrir o Financeiro)
--   e libera o 📎 dos lançamentos que não são de pedido. Antes de rodar,
--   ele continua funcionando: os comprovantes dos pedidos aparecem no
--   Financeiro normalmente, e só o 📎 dos outros lançamentos fica
--   desligado, com o aviso.
--   Depois de publicar, anexe um comprovante num lançamento sem pedido
--   (uma despesa à mão, por exemplo) para conferir que o Storage aceita
--   a pasta financeiro/ — os arquivos desses lançamentos vão para
--   financeiro/<id>/comprovantes/ no bucket orcamentos-anexos.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
--  1. A coluna dos comprovantes
--     Mesmo formato dos comprovantes das linhas de pagamento do pedido:
--     [{ "path": ..., "nome": ..., "url": ... }]
-- ---------------------------------------------------------------------
alter table public.financeiro
  add column if not exists comprovantes jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------
--  2. Uma conta por linha de pagamento e parcela
--     Vale só para o lançamento criado pelo pedido (origem 'pedido'),
--     ativo (Pago ou Pendente) e que não foi mesclado numa linha do
--     banco. A linha do banco, o cancelado e o mesclado ficam de fora.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
      from public.financeiro
     where origem = 'pedido'
       and pag_id is not null
       and status in ('Pago', 'Pendente')
       and mesclado_com is null
     group by pag_id, parcela
    having count(*) > 1
  ) then
    raise notice 'O índice financeiro_um_por_parcela NÃO foi criado: há linha de pagamento com duas contas ativas na mesma parcela. A coluna foi criada normalmente. Veja quais são com a consulta do fim do arquivo, resolva no Financeiro e rode este arquivo de novo.';
  else
    create unique index if not exists financeiro_um_por_parcela
      on public.financeiro (pag_id, parcela)
      where origem = 'pedido'
        and pag_id is not null
        and status in ('Pago', 'Pendente')
        and mesclado_com is null;
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------
--  Para conferir à mão (opcional), só se o índice vier "não": as linhas
--  de pagamento com mais de uma conta ativa na mesma parcela. Selecione
--  as linhas abaixo (sem os dois traços) e rode sozinhas.
-- select pag_id, parcela, count(*) as contas,
--        string_agg(id || ' · ' || data || ' · ' || val || ' · ' || status, '  |  ') as quais
--   from public.financeiro
--  where origem = 'pedido' and pag_id is not null
--    and status in ('Pago', 'Pendente') and mesclado_com is null
--  group by pag_id, parcela
-- having count(*) > 1;
-- ---------------------------------------------------------------------

-- Conferência: a coluna e o índice existem?
select
  case when exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'financeiro'
                       and column_name = 'comprovantes')
       then 'sim' else 'não' end as coluna_comprovantes,
  case when exists (select 1 from pg_indexes
                     where schemaname = 'public' and indexname = 'financeiro_um_por_parcela')
       then 'sim' else 'não' end as indice_uma_conta_por_parcela;
