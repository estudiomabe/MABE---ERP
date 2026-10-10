# Testar o ERP na pré-visualização

O servidor local é o `erp-mabe` do `.claude/launch.json` (porta 8123). Abra com
`preview_start {name:"erp-mabe"}`. Ele serve os arquivos do disco, então a cada
patch basta recarregar a aba (`navigate` para `http://localhost:8123/`).

Sem login não há dados: o ERP só carrega o banco depois de entrar. Por isso todo
teste começa montando um usuário e dados **só na memória da aba**.

## 1. Bloquear a escrita no Supabase — antes de qualquer outra coisa

O ERP de teste fala com o **mesmo banco de produção**. Um clique em "Salvar"
durante o teste grava de verdade no banco do estúdio. Então a primeira coisa,
depois de a página carregar, é cortar as escritas:

```js
await new Promise(r=>setTimeout(r,3000));            // deixa o boot terminar
const fromOriginal=supa.from.bind(supa);
window.__ESCRITAS=[];
const parado={then:(f)=>Promise.resolve({data:null,error:{message:'bloqueado no teste'}}).then(f)};
supa.from=function(tab){
 const real=fromOriginal(tab);
 return new Proxy(real,{get(t,k){
  if(['insert','update','upsert','delete'].includes(k))
   return ()=>{__ESCRITAS.push(k+' '+tab);return parado;};
  const v=Reflect.get(t,k);return typeof v==='function'?v.bind(t):v;}});};
```

Envolva o objeto, **não troque `supa.from` inteiro** por um falso: os
carregadores chamam `supa.from(...).select()` e, sem o original, gravam
`DB.x=[]` e a tela esvazia como se fosse bug.

Quando o teste precisa que a gravação "dê certo" (para o fluxo seguir até o
fim, como num salvar que fecha o modal), devolva sucesso em vez de erro — e
continue registrando em `__ESCRITAS`, para inspecionar o que seria enviado:

```js
const falso=()=>({eq:()=>Promise.resolve({data:null,error:null}),
 select:()=>({single:()=>Promise.resolve({data:{num:99},error:null})}),
 then:(f)=>Promise.resolve({data:null,error:null}).then(f)});
// ...e no Proxy: return (arg)=>{__ESCRITAS.push({tab,op:k,arg});return falso();};
```

**Termine todo teste conferindo `__ESCRITAS`.** Vazio, ou só com as operações
que você esperava e que nunca chegaram ao banco.

## 2. Usuário de teste

```js
USER={id:'t',nome:'Teste',perfil:'Administrador'};
document.body.classList.add('logado');
document.getElementById('login-screen').style.display='none';
```

O campo é **`perfil`**, não `nivel`. `canEdit()` lê `nivelInfo(USER)`, que olha
`u.perfil`. Com o campo errado, `canEdit()` dá falso, `editVenda()`/`editOrc()`
saem na primeira linha sem desenhar nada, e parece que o patch não funcionou.

## 3. Dados de teste

Escreva direto em `DB`: `DB.clientes`, `DB.vendas`, `DB.orcamentos`,
`DB.financeiro`, `DB.config.mdoTipos`, `DB.config.servicos`... Use dados que
**exercitem o caso** — para uma comparação com o mês anterior, dois meses; para
um filtro, registros que ele deve mostrar *e* registros que deve esconder.

Não chame `saveDB()` à toa: ele grava no localStorage da aba, e um próximo boot
pode ler esses dados falsos.

## 4. Abrir uma seção sem o `navigate()`

```js
document.querySelectorAll('.section.active').forEach(e=>e.classList.remove('active'));
document.getElementById('section-orcamentos').classList.add('active');
CUR='orcamentos';
```

Depois chame o render da seção (`renderDashboard()`, `renderOrcamentos()`...) ou
a função que abre a ficha (`editVenda(id)`, `abrirDetalheOrc(id)`,
`abrirAdicionarItem()` + `selecionarTipoOrc('sob_medida')`).

O `navigate()` do ERP pode disparar recarga do banco e desfazer os dados falsos.

## 5. Medir antes de olhar

Screenshot mostra, mas não prova. Prefira medir no JavaScript:

- altura de linha: `el.getBoundingClientRect().height`
- colunas do grid: `getComputedStyle(el).gridTemplateColumns` (e conferir que o
  cabeçalho tem as mesmas)
- se um texto cabe: largura do texto (`canvas.measureText` com a fonte do campo)
  contra `clientWidth` menos padding
- estouro horizontal no celular: `document.documentElement.scrollWidth <= innerWidth`
- elemento recriado ou não (foco preservado): guarde uma marca no nó, redesenhe,
  confira que é o mesmo nó

## 6. Computador e celular

- **Computador**: `resize_window {width:1400~1500, height:900~980}`. A largura
  padrão do painel costuma ficar abaixo de 860px e cai no layout de celular —
  um "não aparece" pode ser só isso.
- **Celular**: `resize_window {preset:"mobile"}` (375×812). O ponto de quebra do
  ERP é `@media (max-width:860px)`.
- No celular a barra lateral pode ficar aberta por cima de tudo, porque o login
  foi forçado. Para a foto:
  `document.querySelector('.sidebar').style.transform='translateX(-110%)'`.

## 7. Rolagem

A página não rola: quem rola é `#content`. Para mostrar algo na foto:
`$('content').scrollTop = $('alvo').offsetTop - 60`.

## 8. Peculiaridades do painel do navegador

- O screenshot às vezes estoura o tempo ("page did not finish rendering").
  Tente **uma** vez de novo; se repetir, siga medindo pelo JavaScript.
- Com o painel escondido, transições e animações de CSS congelam. Antes de ler
  uma cor calculada: `el.style.transition='none'`.
- Com o painel escondido, `focus()` não pega (`document.hasFocus()` é falso).
  Não conclua que o foco se perdeu — confira se o **nó** é o mesmo.
- O Chart.js só desenha com a seção visível.

## 9. Fotos para o usuário

As fotos ficam em `tool-results/`. Copie as que importam para o rascunho da
sessão com nome claro (`1-desktop-xxx.jpg`, `2-celular-xxx.jpg`) e mande com
`SendUserFile`, `display:"render"`.

## 10. Limpar ao terminar

```
resize_window {preset:"desktop"}
navigate http://localhost:8123/
```

A recarga apaga os dados falsos e o bloqueio. Não deixe a aba com números
inventados: o usuário pode abrir o painel e achar que são os dele.

## Testar no celular de verdade, pelo cabo

A simulação de 375px no painel **não reproduz** o compositor da placa de vídeo,
a barra de endereço, o teclado nem o cache do service worker. A "tela de login
cortada" de outubro/2026 (overlays fechadas com `backdrop-filter` vazando a
pintura) nunca apareceu na simulação e levou 20 minutos no aparelho real. Para
qualquer defeito que só acontece no celular, vá ao celular:

```
A=C:/Users/mateu/ferramentas/platform-tools/adb.exe     # ja instalado
$A devices -l                                            # precisa de "device", nao "unauthorized"
$A forward tcp:9222 localabstract:chrome_devtools_remote # inspetor do Chrome do celular
$A reverse tcp:8123 tcp:8123                             # o celular enxerga o servidor de teste
$A shell am start -a android.intent.action.VIEW -d http://localhost:8123/ com.android.chrome
$A exec-out screencap -p > foto.png                      # tela fisica
```

O inspetor responde em `http://localhost:9222/json`; a aba do ERP é a que tem
a URL do ERP (filtre — a lista traz **todas** as abas do usuário). Com o
`webSocketDebuggerUrl` dela, `Runtime.evaluate` roda JavaScript lá dentro e
`Page.captureScreenshot` dá a foto interna do Chrome (compará-la com a física
separa bug de pintura de bug de exibição). Um cliente de 40 linhas com o
`WebSocket` do Node basta; a memória do projeto descreve o `cdp.js` da sessão
de 10/10/2026.

O usuário precisa ligar a Depuração USB no aparelho e aceitar a caixa; o
combinado é desligá-la ao terminar, só mexer na aba do ERP, não instalar nada,
e nunca digitar a senha dele. Fotos da tela podem pegar notificações: se
pegarem, apague a foto.

## Conferir em produção

Para o usuário olhar com os dados reais, abra `https://mabe-erp.vercel.app` com
`preview_start {url:...}` e diga **onde clicar**. O login é dele: nunca digite
senha. Dá para conferir pelo JavaScript da aba, sem login, que a versão e o
código novo estão lá (`APP_VERSAO`, `typeof funcaoNova`).
