-- Motivo da reprovação do orçamento (caixa "Qual foi o motivo da reprovação?",
-- aberta ao reprovar). Texto só: o motivo escolhido na lista do ERP
-- (MOTIVOS_REPROVACAO) e, se houver, o comentário depois de " — ".
-- Ex.: "Preço acima do esperado — achou caro o freijó"
--
-- Rode uma vez no SQL Editor do Supabase. É seguro rodar de novo: não faz nada
-- se a coluna já existir, e não toca em nenhum orçamento que já está lá.

alter table public.orcamentos
  add column if not exists motivo_reprovacao text;
