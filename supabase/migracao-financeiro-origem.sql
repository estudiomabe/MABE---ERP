-- =====================================================================
--  Financeiro: de onde veio cada lançamento e a que ele está ligado
--  (etapa 1 do plano do Financeiro — "só selos")
-- =====================================================================
--
--  O QUE FAZ
--   1. Cria colunas novas na tabela financeiro (todas começam vazias).
--   2. Marca a ORIGEM dos lançamentos que já existem: extrato, pedido,
--      nf, compra ou manual. É o que aparece como selo no Financeiro
--      (Banco, Pedido, NF, Compra, Manual).
--   3. Liga ao pedido (venda_id) os lançamentos que trazem o código
--      V-xxxx na coluna Pedido ou na descrição "Pedido V-xxxx".
--   4. Termina mostrando quantos lançamentos ficaram em cada origem.
--
--  É SEGURO
--   - Pode rodar de novo: tudo é "if not exists", e cada update só mexe
--     na linha que ainda está em branco naquela coluna.
--   - Nunca apaga lançamento e nunca muda valor, data, tipo, status,
--     descrição, pedido (cat), centro de custo nem observação.
--   - Roda inteiro ou não roda nada (begin/commit): se der erro no meio,
--     o banco fica como estava.
--
--  COMO RODAR
--   Supabase > SQL Editor > New query > colar este arquivo inteiro > Run.
--   O resultado é a contagem por origem. Nos dados de 16/10/2026 o
--   esperado é perto de: extrato 370, pedido 24, manual 5.
--
--  DEPOIS DE RODAR
--   O ERP percebe as colunas sozinho (ao entrar, ou ao abrir o
--   Financeiro) e passa a gravar a origem de todo lançamento novo.
--   Antes de rodar, ele continua funcionando como sempre.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
--  1. Colunas novas
-- ---------------------------------------------------------------------
alter table public.financeiro
  add column if not exists origem       text,   -- extrato | pedido | manual | compra | nf
  add column if not exists venda_id     text,   -- vendas.id: o pedido do lançamento
  add column if not exists pag_id       text,   -- vendas.pags[i].id: a linha de pagamento do pedido
  add column if not exists parcela      int,    -- 1..N no cartão; 1 nas outras formas
  add column if not exists parcelas     int,    -- N (quantas parcelas tem a linha)
  add column if not exists compra_id    text,   -- compras.id: a ordem de compra (OC ou NF)
  add column if not exists fitid        text,   -- identificador da transação no extrato OFX (FITID)
  add column if not exists conta        text not null default '',  -- conta do OFX (BANKID/ACCTID); '' quando não se sabe
  add column if not exists desc_banco   text,   -- texto original do banco (não muda)
  add column if not exists lote_ofx     text,   -- id da importação do extrato
  add column if not exists mesclado_com text,   -- (etapa 2) lançamento que absorveu este
  add column if not exists mesclagem    jsonb,  -- (etapa 2) o que este recebeu de outro e como era antes
  add column if not exists nao_juntar   jsonb default '[]'::jsonb;  -- (etapa 2) pares que não são o mesmo

-- O mesmo FITID não entra duas vezes na mesma conta. Índice simples (sem
-- expressão e sem "where"), para servir também de chave no "gravar
-- ignorando repetidos". Linhas sem FITID (as antigas e as manuais) ficam
-- todas com fitid vazio (null), e isso é permitido quantas vezes for.
create unique index if not exists financeiro_conta_fitid_unico on public.financeiro (conta, fitid);
create index if not exists financeiro_venda_idx on public.financeiro (venda_id);
create index if not exists financeiro_pag_idx   on public.financeiro (pag_id);

-- ---------------------------------------------------------------------
--  2. Origem dos lançamentos que já existem
--     Pela marca que cada caminho do ERP deixa no texto. Não usa a hora
--     de gravação (created_at): depois de um restauro em lote ela mente.
-- ---------------------------------------------------------------------

-- extrato: o importador grava a categoria 'Extrato bancário'
update public.financeiro set origem = 'extrato'
 where origem is null and cat = 'Extrato bancário';

-- extrato que você classificou num pedido: a coluna Pedido trocou o
-- 'Extrato bancário' pelo pedido, mas o texto continua o do banco.
-- Vem logo depois da categoria, antes das regras de pedido, nota e
-- compra, para nenhuma delas tomar uma linha do banco.
update public.financeiro set origem = 'extrato'
 where origem is null
   and descricao ~* '^(transf pix|pgto qr|compra no d[eéÉ]bito|boleto pago|devolu[cçÇ][aãÃ]o de pix|transfer[eêÊ]ncia (recebida|enviada)|dep[oóÓ]sito recebido)';

-- pedido: o Salvar Pedido e a aprovação gravam 'Pedido V-0031 — Cliente — PIX'
update public.financeiro set origem = 'pedido'
 where origem is null and descricao like 'Pedido V-%';

-- nota fiscal: 'NF 1234 — Fornecedor' ou 'OC-0012 — NF 1234 — Fornecedor'
update public.financeiro set origem = 'nf'
 where origem is null and descricao ~ '(^|— )NF \S';

-- ordem de compra: 'OC-0012 — Fornecedor', categoria Compras
update public.financeiro set origem = 'compra'
 where origem is null and (cat = 'Compras' or descricao like 'OC-%');

-- o resto foi lançado à mão
update public.financeiro set origem = 'manual'
 where origem is null;

-- texto do banco: nos lançamentos do extrato é a descrição de hoje, a
-- partir do primeiro trecho típico do banco ('Transf Pix recebida...').
-- Assim, se alguém escreveu algo antes do texto do banco, só o texto do
-- banco fica guardado. Sem trecho típico, vai a descrição inteira.
update public.financeiro
   set desc_banco = coalesce(
         substring(descricao from '(?i)((?:transf pix|pgto qr|compra no d[eéÉ]bito|boleto pago|devolu[cçÇ][aãÃ]o de pix|transfer[eêÊ]ncia (?:recebida|enviada)|dep[oóÓ]sito recebido).*)$'),
         descricao)
 where origem = 'extrato' and desc_banco is null;

-- ---------------------------------------------------------------------
--  3. Ligação com o pedido (venda_id) pelo código V-xxxx
--     Primeiro a coluna Pedido (é a escolha que você fez), depois a
--     descrição gerada pelo pedido. ATENÇÃO para quem for usar depois:
--     os gastos do pedido (Saídas classificadas nele) também ganham
--     venda_id, e as Entradas canceladas também. Tudo o que tratar de
--     PAGAMENTO do pedido (contas a receber, recebido, sincronizar)
--     precisa filtrar tipo = 'Entrada' e status <> 'Cancelado'.
--     O pag_id (a linha de pagamento) não é preenchido aqui: ligar cada
--     linha ao seu lançamento é feito depois, no ERP, com confirmação.
-- ---------------------------------------------------------------------
update public.financeiro f set venda_id = v.id
  from public.vendas v
 where f.venda_id is null
   and f.cat ~ '^V-[0-9]+( |$)'
   and v.num = substring(f.cat from '^V-([0-9]+)')::int;

update public.financeiro f set venda_id = v.id
  from public.vendas v
 where f.venda_id is null
   and f.descricao ~ '^Pedido V-[0-9]+( |$)'
   and v.num = substring(f.descricao from '^Pedido V-([0-9]+)')::int;

commit;

-- ---------------------------------------------------------------------
--  Para conferir à mão (opcional): os lançamentos que viraram 'extrato'
--  só pelo texto do banco, e os que ficaram 'manual'. Selecione as linhas
--  abaixo (sem os dois traços) e rode sozinhas.
-- select id, data, tipo, val, origem, cat, descricao
--   from public.financeiro
--  where (origem = 'extrato' and coalesce(cat,'') <> 'Extrato bancário') or origem = 'manual'
--  order by origem, data;
-- ---------------------------------------------------------------------

-- Conferência: quantos lançamentos ficaram em cada origem
select origem, count(*) as lancamentos
  from public.financeiro
 group by origem
 order by 2 desc;
