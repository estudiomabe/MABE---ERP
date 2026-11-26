-- Ficha do cliente com tudo separado (Clientes → Novo/Editar).
--   endereco (já existia) passa a guardar só a rua; os outros pedaços ganham coluna própria.
--   cep          "00000-000"
--   estado       sigla, "RJ"
--   aniversario  "dd/mm" (sem ano)
--   origem       como nos conheceu — a mesma lista da "Origem do cliente" do pedido
--   indicador_id id de uma pessoa da lista de Comissões (arquiteto, indicação, parceiro...)
--
-- Rode uma vez no SQL Editor do Supabase. É seguro rodar de novo: não faz nada
-- se as colunas já existirem, e não toca em nenhum cliente que já está lá.

alter table public.clientes
  add column if not exists numero        text,
  add column if not exists complemento   text,
  add column if not exists bairro        text,
  add column if not exists cep           text,
  add column if not exists estado        text,
  add column if not exists aniversario   text,
  add column if not exists contato2_nome text,
  add column if not exists contato2_tel  text,
  add column if not exists origem        text,
  add column if not exists indicador_id  text,
  add column if not exists obs_entrega   text;
