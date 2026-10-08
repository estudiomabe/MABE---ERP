-- Links de referência do orçamento (ficha do orçamento → "Links de Referência",
-- logo acima dos anexos). Cada link guardado: { url, nome }
--
-- Rode uma vez no SQL Editor do Supabase. É seguro rodar de novo: não faz nada
-- se a coluna já existir, e não toca em nenhum orçamento que já está lá.

alter table public.orcamentos
  add column if not exists links jsonb default '[]'::jsonb;
