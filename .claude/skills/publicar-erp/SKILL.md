---
name: publicar-erp
description: Roteiro para alterar, testar e publicar o ERP do Estúdio MABE (index.html + sw.js, Supabase, Vercel). Use sempre que o pedido mexer no ERP — adicionar campo, coluna ou seção, mudar layout, corrigir bug, renomear botão, ajustar PDF, criar status — e sempre que o usuário disser "pode publicar", "abra pra eu conferir", "monte na pré-visualização", "me mostra antes" ou "suba a versão", mesmo sem pedir explicitamente para publicar. Cobre o patch seguro, coluna nova no banco, o teste sem gravar no Supabase, a conferência no computador e no celular, as quatro constantes de versão, o commit e a espera pela Vercel.
---

# Publicar o ERP do Estúdio MABE

O ERP é **um arquivo só**: `index.html` (HTML, CSS e JavaScript juntos, sem
build) mais o `sw.js` do aplicativo instalado. Os dados ficam no Supabase. O
site é publicado pela Vercel a cada push no `master` de
`estudiomabe/MABE---ERP` — **um repositório público**.

```
pedido → patch → teste local → [mostrar] → versão → commit → push → Vercel
                                                                      ↓
                                          navegador de quem usa → Supabase
```

O Supabase **não** puxa nada do GitHub. Os `.sql` em `supabase/` são receita
escrita: quem executa é o usuário, à mão, no SQL Editor.

Os scripts deste roteiro ficam em `scripts/`, ao lado deste arquivo. Chame-os
pelo caminho completo:
`C:/Users/mateu/Documents/Claude Code/MABE - ERP/.claude/skills/publicar-erp/scripts/`.

## 1. Entender antes de mexer

Leia o trecho que vai mudar e o que está em volta. O `index.html` passa de 9 mil
linhas; `grep -n` acha o lugar, `sed -n 'A,Bp'` mostra o trecho.

**Procure colisão de nomes antes de criar uma função global.** Todas as funções
vivem no mesmo escopo, e a declaração que aparece depois no arquivo vence. Já
aconteceu de uma `normalizarLink` nova perder para uma antiga de mesmo nome — a
validação nova virou letra morta e um `javascript:` passou. Confira:
`grep -n "function nome\|const nome\b" index.html`.

Quando o pedido é ambíguo e duas leituras levam a trabalhos bem diferentes,
olhe os dados reais antes de perguntar — muitas vezes eles respondem. Se não
responderem, pergunte com opções concretas.

## 2. Alterar com o script de patch

Escreva o script de patch no **rascunho da sessão** com a ferramenta **Write** —
nunca com `cat <<EOF` no terminal: o heredoc come as barras invertidas, e uma
regex `/\d+/` vira `/d+/` sem aviso. Use a biblioteca:

```js
const P = require('C:/Users/mateu/Documents/Claude Code/MABE - ERP/.claude/skills/publicar-erp/scripts/patch-lib.js');
const f = P.abrir('index.html');
f.rep(`texto exato que existe hoje`, `texto novo`);
f.salvar();   // grava e confere a sintaxe de todos os <script>
```

O `rep()` exige achar o texto **exatamente uma vez**. Se achar zero, o texto
mudou — releia o trecho. Se achar dois ou mais, aumente a âncora com a linha
seguinte. Se um `rep()` falhar, nada é gravado. A biblioteca já normaliza o fim
de linha, então âncoras de várias linhas funcionam mesmo depois de um
`git checkout`.

Escreva como o código em volta: comentários em português explicando o **porquê**,
os helpers que já existem (`$`, `esc`, `fmt`, `fmtN`, `fmtD`, `pad`, `today`,
`addDays`, `uid`, `toast`, `guard`, `canEdit`, `cliName`), e o mesmo estilo
compacto de uma linha por instrução.

## 3. Se precisar de coluna nova no banco

A chave do ERP só lê e grava dados: ela **não altera a estrutura das tabelas**.
Uma coluna nova é sempre o usuário quem cria. Então:

1. Escreva a migração em `supabase/migracao-<assunto>.sql`, com
   `add column if not exists` (seguro para rodar duas vezes) e um comentário
   dizendo o formato do dado.
2. Acrescente a coluna em `supabase/estrutura.sql`.
3. Faça o ERP **funcionar sem a coluna**: uma sondagem
   (`supa.from('tabela').select('coluna').limit(1)`) liga uma flag; sem a
   coluna, o conversor `xParaSupabase` não envia o campo, e a seção mostra o SQL
   e **trava** a entrada de dados. Assim o resto do ERP continua salvando, e
   ninguém digita uma tarde inteira para perder tudo no primeiro salvar.
4. Dê ao usuário o SQL num bloco de código e diga onde rodar.
5. Depois que ele rodar, confira em produção que a coluna responde antes de
   dizer que está pronto.

## 4. Testar sem gravar no banco

O teste local fala com o **banco de produção**. Leia
`references/teste-no-preview.md` antes de testar — lá estão o bloqueio de
escrita, o usuário de teste (o campo é `perfil`), como abrir seções e as
peculiaridades do painel do navegador.

Teste o caso que o pedido descreve **e** os vizinhos: o vazio, o limite, o dado
antigo que já está no banco num formato diferente. Os defeitos desta base
costumam estar aí — o serviço digitado à mão que ocupava duas linhas, o pedido
sem orçamento vinculado, o mês sem nada para comparar.

**Confira sempre no computador e no celular (375px).** O usuário pediu isso
como regra: toda mudança de tela tem que ser vista nos dois.

## 5. Mostrar antes ou publicar direto?

- **Mostrar antes** quando o pedido é de layout, de visual ou de algo novo, ou
  quando o usuário diz "monte", "mostre", "abra pra eu ver". Monte na
  pré-visualização, mande as fotos com `SendUserFile`, diga em uma linha o que
  testou, e **espere o "pode publicar"**. Um formato que ele recusa custa muito
  menos aqui do que publicado.
- **Publicar direto** quando o pedido é preciso e pequeno: renomear um botão,
  alargar uma caixa, corrigir um bug claro.

Na dúvida, mostre.

## 6. Publicar

```bash
node ".../scripts/subir-versao.js"
```

Ele sobe as **quatro** constantes juntas (`VERSAO` e `ATUALIZACAO` no `sw.js`,
`APP_VERSAO` e `APP_ATUALIZACAO` no `index.html`) e para se elas já estiverem
desencontradas. Sem o `sw.js` novo, o celular não recebe a atualização. Uma
publicação = uma versão nova; se mais de um ajuste entrar no mesmo push, sobe
uma vez só.

Depois, faça commit **apenas dos arquivos que você mudou** — a pasta tem
arquivos soltos do usuário que não vão para o repositório:

```bash
git add index.html sw.js [supabase/...]
git commit -m "$(printf 'Titulo curto do que mudou\n\nPor que mudou e o que\nnao e obvio no diff.\n\n<linha de atribuição>')"
git push origin master
```

Mensagem de commit em **português, sem acento** (o terminal do Windows estraga
acento no `printf`), título com o resultado para quem usa e corpo com o
**porquê**. A linha de atribuição é a que o lembrete do sistema da sessão
indicar.

Então espere a Vercel e confira o que foi ao ar:

```bash
node ".../scripts/conferir-publicacao.js" <versão> <atualização> <marca1> <marca2>
```

As marcas são trechos que só existem no código novo — um id, um nome de
função. Elas provam que o arquivo publicado é o novo, não só que o número
subiu. Rode em segundo plano se for demorar.

Por fim, **limpe a aba de teste**: volte o tamanho para desktop e recarregue.

## 7. Contar ao usuário

Fale com ele como se fala com o dono do estúdio, não com um programador. Diga:

- a versão que foi ao ar (`2026-10-10.2`, atualização 289);
- o que mudou na tela, **em uma frase**;
- o que você conferiu, com números quando houver ("três linhas, 38px cada");
- o que **não** fez e por quê, se houver algo que ele poderia supor que fez;
- se precisa de alguma ação dele (rodar SQL, puxar a tela no celular).

Sem lista de arquivos, sem nome de função no texto principal.

## Regras desta base

- **O repositório é público.** Nada de dado de cliente, backup, relatório de
  segurança ou segredo no commit. Relatórios desse tipo vão para fora da pasta
  do projeto.
- **Texto que vem do banco entra no HTML por `esc()`.** Qualquer pessoa que
  consiga gravar no banco pode plantar HTML num nome de cliente.
- **Endereço que vira link só aceita `http` e `https`.** Um `javascript:` num
  `href` executa código no navegador de quem clica.
- **Número de dinheiro novo no painel entra também na regra
  `body.sem-valores`**, que esconde valores de quem não tem permissão.
- **PDFs ficam em Helvetica.** Outras fontes já foram testadas e recusadas.
- **Nada de seletor de status escrito à mão.** Monte a partir das listas que já
  existem (`ORC_STATUS`, `SETORES_FIXOS`, `DB.config.mdoTipos`...): opção
  duplicada em dois lugares sempre acaba divergindo.
