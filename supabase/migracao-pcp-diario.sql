-- Foto e registro do dia em cada ordem do PCP (botão 📷 no cartão).
--   diario  lista de registros, do mais antigo para o mais novo:
--           [{ "id", "dt" (data e hora ISO), "por" (quem registrou), "etapa",
--              "texto" (o que foi feito hoje), "fotos": [{ "path", "nome", "url" }] }]
--   As fotos ficam no Storage, bucket orcamentos-anexos, pasta producao/<id da OP>/.
--
-- Rode uma vez no SQL Editor do Supabase. É seguro rodar de novo: não faz nada
-- se a coluna já existir, e não toca em nenhuma ordem que já está lá.

alter table public.producao
  add column if not exists diario jsonb default '[]'::jsonb;
