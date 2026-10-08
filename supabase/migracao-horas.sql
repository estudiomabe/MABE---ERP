-- Apontamento de horas por pedido (ficha do pedido → "Horas trabalhadas neste projeto").
-- Cada linha guardada: { data, tipoId, horas, valor, obs }
-- tipoId aponta para um dos tipos cadastrados em Configurações → Tipos de Mão de Obra.
--
-- Rode uma vez no SQL Editor do Supabase. É seguro rodar de novo: não faz nada
-- se a coluna já existir, e não toca em nenhum pedido que já está lá.

alter table public.vendas
  add column if not exists horas jsonb default '[]'::jsonb;
