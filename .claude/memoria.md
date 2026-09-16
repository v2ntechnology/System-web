# Memória do Projeto: RookHub (System-web)

> Documento versionado e compartilhado pelo time. Guarda somente decisões, limites e armadilhas que
> não ficam claros lendo um arquivo isolado. O código é a fonte de verdade para implementação.

> **Como usar:** localize os títulos com `rg -n "^#{2,3} " .claude/memoria.md`, leia a seção ligada à
> tarefa e **sempre `Gotchas`**. Ao atualizar, registre apenas informação durável e não dedutível do
> código. Quando um fato deixar de valer, **corrija a linha em vez de acrescentar outra embaixo**:
> este arquivo já foi um diário de alterações de 3.104 linhas e virou isto em 16/09/2026.

**Índice:** Produto e escopo · O que é real e o que é mock · Os três painéis · Entrada, sessão e
perfis · Identidade visual · Molde de tela · Telas que exigem cuidado · Mapas · Assistente e voz ·
Telemetria · Segurança e ambiente · Gotchas

---

## Produto e escopo

- **RookHub** é um SaaS de gestão inteligente de frotas para transportadoras. Este repositório é o
  **frontend**, em React 19, Vite e Tailwind 4 CSS-first.
- No ar em **`https://dev.rookhub.com.br`** (porta da equipe) e **`<cliente>.rookhub.com.br`**, no
  Cloudflare Pages ligado à `main`: **push publica**. Fala com a API em `https://api.rookhub.com.br`.
- ⚠️ **A tese do produto é ser integrador, e isso é regra de código.** Várias fontes externas
  desaguam aqui e **nenhuma é fonte de verdade sozinha**. O cadastro do fornecedor de telemetria é
  ponto de partida: quem responde quem é motorista, se está ativo e a que caminhão está ligado é o
  RookHub.
- Quatro projetos irmãos, sem código compartilhado: este, `System-mobile`, `Backend-web` e
  `Website-rookhub`.
- O painel de gestão foi **copiado** de `System-mobile/apps/web` para `src/management`. A origem
  permanece intacta até o usuário autorizar a remoção, e correções feitas aqui **não** são
  sincronizadas com ela.
- Não criar cobrança nem provedor externo novo sem pedido explícito.

## O que é real e o que é mock

⚠️ **Esta é a seção que mais evita conclusão errada.** O estado é misto **de propósito**, e
`VITE_ENABLE_MOCKS` alterna. O padrão no código é `'true'`; o `.env` da equipe traz `false`.

| Área                                                                    | Origem                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------- |
| Autenticação, sessão, convite, troca de senha                           | **API real**                                        |
| Frota, mapa, posições, motoristas, segurança, jornada                   | **API real**                                        |
| Assistente de IA, conversas, voz, catálogo de vozes                     | **API real**                                        |
| Equipe (`/gestao/equipe`), cargos (`/gestao/cargos`)                    | **API real**                                        |
| Backoffice `/admin-saas` inteiro                                        | **API real**, com o store como modo de demonstração |
| Marca do cliente, lida antes do login                                   | **API real**                                        |
| Veículos no `/app`                                                      | **API real**, pela ponte `services/vehicle-api.ts`  |
| O resto do `/app` (operador, manutenção, checklist, alertas, dashboard) | **mock**                                            |
| Custos, manutenção (planos e oficinas), multas, viagens como frete      | **mock**                                            |
| Configurações de `/gestao` (plano, módulos, integrações)                | **mock**                                            |

- ⚠️ **Não é fallback.** Backend fora mostra erro, e não dado de demonstração disfarçado de real.
- ⚠️ **O `/app` roda sobre `services/api.ts`, que importa os mocks direto.** A ponte para a API é
  `services/vehicle-api.ts`, e veículos foi o primeiro domínio a atravessar: é o caminho que os
  outros devem seguir.
- ⚠️ **Tela que é maquete precisa DIZER que é.** `/app/analytics` mostrava "2,9 km/L" como média da
  frota enquanto `/gestao/custos` mostrava 4,13 para a mesma frota, sem nada avisando qual era o
  real. Hoje ela avisa. ⚠️ **Ligar meia tela foi descartado, e o motivo importa:** um número real ao
  lado de três inventados é **pior**, porque empresta credibilidade ao conjunto.
- Telas consomem contratos e hooks de `src/services`, **nunca** os mocks diretamente. Foi isso que
  permitiu ligar a API módulo a módulo.

## Os três painéis

| Área          | Público                          | Convenções                                                               |
| ------------- | -------------------------------- | ------------------------------------------------------------------------ |
| `/app`        | operação, manutenção e motorista | `src/pages`, shadcn/ui, estrutura rasa por categoria do menu             |
| `/gestao`     | proprietário e gestor            | `src/management`, por feature, exportações nomeadas, primitivos próprios |
| `/admin-saas` | equipe RookHub                   | `src/pages/saas`, **o mesmo layout do `/gestao`, em marinho**            |

E o **hub** (`/painel`), a porta protegida sem casca onde dono e gestor escolhem entre o assistente
(`/assistente`) e a gestão.

- ⚠️ **Cor e ícone NÃO entram nessa divisão.** A paleta é uma só (`src/styles/palette.css`) e os
  ícones também (`src/components/icons.ts`). O que `.management-theme` escopa é **forma**: raio,
  vidro, Sora e o Spectrum.
- ⚠️ **O painel de gestão tem UM limite de `Suspense`**, no `ManagementLayout`, em volta do `Outlet`,
  e nenhum por rota. Limite por rota é criado do zero a cada navegação e pinta o fallback na hora: a
  tela inteira sumia e voltava a cada troca. **Não devolver `Suspense` para dentro de `routes.tsx`.**
- ⚠️ **O backoffice usa o MESMO layout do painel do dono**, e a cor é o que separa. Quem conhece um
  já sabe usar o outro.
- A rotina de pátio (`/app/lancamentos` e `/app/triagem`) usa o visual operacional, mas os dados
  ficam em `management/mocks/operator.ts` **de propósito**: ao escalar um checklist ele entra na fila
  de Liberações do gestor. Duplicar o mock quebraria esse fluxo entre painéis.

### O backoffice

- ⚠️ **`pages/saas/saas-api.ts` é o `/v1/saas` inteiro**, mais as rotas de plataforma que moram fora
  daquele prefixo (solicitações, equipe, auditoria, marca). A troca entre API e store fica **dentro
  das funções**, e nenhuma tela sabe em que modo está rodando.
- ⚠️ **`stores/saas-store.ts` existe porque a fila e a lista de empresas são o mesmo dado em dois
  momentos da vida.** Com mocks lidos direto do módulo, aprovar uma solicitação não mudava nada na
  tela. Ele é mutável em memória e some no F5, de propósito.
- ⚠️ **Aprovar não é um botão, é um formulário de quatro passos** (`approval-wizard.tsx`): dados e
  endereço, telemetria, marca, plano. Um botão único deixaria alguém aprovar para descobrir depois
  que faltava escolher o fornecedor.
- ⚠️ **O slug é subdomínio E nome do schema**, então a validação mora em `app/tenant-slug.ts` e não
  dentro da tela: o backend tem a mesma regra, palavra por palavra. Lá estão o formato, os slugs
  reservados e a sugestão a partir da razão social.
- **Telemetria pendente é `warning`, nunca `destructive`.** O ambiente é liberado sem coleta de
  propósito, porque só a MiX tem conector: pintar de vermelho faria a tela mentir sobre a gravidade.
- **A auditoria tem duas abas** porque o acesso de suporte é a exceção deliberada à regra de
  tenancy. Misturá-lo com "fulano aprovou uma solicitação" esconderia o que precisa ser conferível.
- ⚠️ **A tela de uma empresa é `empresas/<slug>`, e a API continua por id.** Quem traduz é a tela,
  procurando o slug na lista. Por isso `useTenant` tem `enabled: id !== ''`, e **a ordem dos desvios
  importa**: consulta desligada é `isPending` para sempre, então quem responde "não existe" é a
  LISTA, antes de olhar a ficha.
- ⚠️ **O modo suporte manda `X-Rookhub-Tenant` SOMENTE em GET, e não nas rotas `/v1/saas/`.** O
  backend aplica o cabeçalho a qualquer requisição que o traga: um GET do backoffice gravaria uma
  linha de acesso de suporte para uma tela que não é do cliente, e a auditoria encheria de ruído.
- ⚠️ **`SaasTenant.mrr` é `number | null`, e não zero.** Não existe cobrança no sistema, e zero diria
  "esta empresa não paga nada". Mesma regra para as contagens fora do estado `READY`: **ausência
  aparece como ausência**.
- ⚠️ **`temporaryPassword` de conta de plataforma volta uma vez só, no POST.** Por isso aparece num
  diálogo que fica até alguém fechar, e não num toast: um toast perdido custa uma redefinição.
- **O que a API não tem, a tela parou de afirmar**: praça e fornecedor declarado saíram da fila,
  "último acesso" saiu da equipe, a contagem por cargo saiu da ficha da empresa e o botão de
  reiniciar provisionamento saiu, porque não existe rota que o faça.

## Entrada, sessão e perfis

- `/` é o login; `/login` só redireciona links antigos. Login, recuperação e convite vivem no mesmo
  módulo e usam o visual de `.management-theme`.
- ⚠️ **Quem decide qual painel abrir é o `scope` da sessão (`platform` ou `tenant`), e não o papel.**
  `landingForSession` substituiu o `landingForRole`, o `AdminRoute` exige escopo de plataforma e o
  `RoleAreaRoute` manda a sessão de plataforma de volta ao `/admin-saas`. Consequência pretendida:
  **conta de transportadora não abre o backoffice**, e **conta da equipe não abre `/gestao` nem
  `/app`**, porque entrar na empresa de um cliente é impersonação, que não existe.
- ⚠️ **`AuthSession.tenant` é nulo de verdade**, e o lugar-tenente "RookHub" saiu.
- Papéis canônicos: `OWNER`, `MANAGER`, `OPERATOR`, `MAINTENANCE`, `SUPER_ADMIN` e `DRIVER`. Não
  reintroduzir `TENANT_ADMIN`, `FLEET_MANAGER`, `MAINTENANCE_MANAGER` nem `VIEWER`.
- Destino pós-login: `OWNER`, `MANAGER` e `SUPER_ADMIN` entram em `/painel`; os demais em
  `/app/dashboard`. `RoleAreaRoute` redireciona quem caiu na área errada, em vez de deixá-lo sem
  saída.
- A volta para a hub existe nos dois painéis e só para `HUB_ROLES`: no operacional é o item "Painel"
  da lateral; no `/gestao` é "Painel de escolha" **dentro do menu da conta**.

### O endereço decide a porta

- ⚠️ **`app/tenant-host.ts` decide o modo pelo hostname, e o padrão é `cliente`.** Endereço
  desconhecido, IP ou `*.pages.dev` caem no painel da transportadora: errar para o lado do
  backoffice deixaria um operador olhando administração de plataforma.
- ⚠️ **O espelho local é `*.localhost`, e é como se confere a separação sem publicar.** Todo
  navegador resolve qualquer subdomínio de `localhost` para 127.0.0.1 sozinho, **sem editar arquivo
  de hosts**. Com um servidor do Vite: `dev.localhost:5173` é a plataforma e `servioeste.localhost:5173`
  o cliente. `localhost` puro não redireciona, que é o que evita o laço.
- ⚠️ **Isso exige `server.allowedHosts: ['.localhost']` no `vite.config.ts`**, senão o Vite recusa o
  host por proteção contra DNS rebinding e devolve "Blocked request".
- ⚠️ **É redirecionamento, NUNCA bloqueio.** Quem não é da plataforma entra normal e é levado ao
  endereço do cliente. A sessão sobrevive porque o cookie de refresh é do `api.rookhub.com.br`.
- ⚠️ **`app/tenant-host.test.ts` trava o que causaria incidente**: o laço em `localhost`, o
  `*.pages.dev` e `rookhub.com.br.invasor.example` não virar slug de plataforma.
- ⚠️ **O ícone da aba é trocado em tempo de execução** (`app/favicon.ts`), porque o `index.html` é o
  mesmo para as duas portas. Os dois `<link rel="icon">` são um par de `prefers-color-scheme`,
  escolhido pelo SISTEMA de quem olha: trocar só um deixa metade das máquinas com o ícone errado.
- ⚠️ **A porta da equipe tem casca própria** (`PlatformAuthLayout`), uma coluna centrada sobre o
  fundo `SoffitGradient`, **sem Google e sem o separador "ou"**. Vale **só para o login**: esqueci
  minha senha, convite e sessão expirada seguem nas duas colunas.

### Convite e senha

- ⚠️ **O convite é a única porta de um painel de transportadora.** O seed não cria conta nenhuma, e
  o link **tem de abrir no subdomínio da empresa**: o convite mora no schema do cliente e é o
  `Origin` que diz à API em qual procurar.
- ⚠️ **O aceite devolve a sessão pronta e a tela entra direto.** Mandar para o login pediria a senha
  que a pessoa acabou de criar.
- ⚠️ **`token` e `acceptUrl` vêm NULOS quando a entrega por e-mail está ligada**, que é o estado
  normal. Sem link, a mensagem diz para quem o convite foi.
- ⚠️ **A troca de senha obrigatória tem rota própria (`/trocar-senha`) e guarda própria.** Sem a
  segunda guarda, a primeira mandaria a tela de troca para ela mesma, em laço.
- ⚠️ **O seletor de cargo sai de `GET /v1/roles`, e os ids são POR EMPRESA.** Nada de id fixo. A tela
  mostra o `name`, nunca a `key`. ⚠️ Na edição o cargo começa em "manter": `GET /v1/team` devolve o
  PAPEL e a edição recebe o `roleId`, e os dois não são reversíveis, porque dois cargos caem no mesmo
  papel. Adivinhar trocaria o cargo de alguém em silêncio, e **trocar cargo derruba a sessão na
  hora**.

### A sessão

- Access token **só na memória**, 1 hora; refresh em cookie `HttpOnly` com `Path=/v1/auth`, que nunca
  aparece no corpo de resposta nenhuma.
- ⚠️ **O refresh rotaciona a cada uso**, com duas consequências: no StrictMode dois efeitos
  simultâneos fariam o primeiro invalidar o cookie que o segundo usava (o store guarda a promessa e
  serve a mesma); e as guardas precisam segurar em `restoring`, senão a tela vai para o login e volta
  um instante depois.
- ⚠️ **Cookie entre origens exige `credentials: 'include'` e `allowCredentials` no backend.** Nesse
  modo o curinga `*` é recusado pelo navegador.
- ⚠️ **402 não é 403.** 403 é falta de permissão, e quem resolve é quem administra a equipe da
  empresa; 402 é o plano que não cobre o módulo, e quem resolve é o Dono com a RookHub. O
  `PlanUpgradeError` carrega `modulo` e `plano`, e é com o `modulo` que o `PlanLockedState` diz o que
  falta em vez de falar em "recursos avançados".
- ⚠️ **401 não significa a mesma coisa em toda rota, e o `httpRequest` acha que sim.** Ele trata todo
  401 como sessão perdida. Em `POST /v1/auth/password` o 401 é "a senha atual está errada", então
  quem errava a digitação era deslogado sem explicação: por isso o `changePassword` faz `fetch`
  próprio. **Antes de mandar outra rota pelo `httpRequest`, conferir o que o 401 dela quer dizer.**
- **Guardas de perfil, permissão e plano são UX, não segurança.** Quem revalida é o `Backend-web`, em
  todas as operações. Vale especialmente para a IA: não adianta a tela esconder o custo se o contexto
  enviado ao modelo trouxer o número.
- `DemoMenu` alterna perfil e plano **só para demonstração**. Ao trocar o perfil, trocar a identidade
  completa, não apenas o campo `role`.

## Identidade visual

**A fonte única é `src/styles/palette.css`.** O `@theme` declara a rampa escura e o bloco
`html.light`, fora de camada, redefine as mesmas variáveis com a rampa clara.

Âncoras: grafite `#212121` no escuro, papel `#F2F2F3` no claro, **terracota `#D5623A` como primária**
e **marinho `#010066` como secundária**. A referência é o Itaú: laranja é a ação preenchida, azul
escuro serve link, detalhe e contorno.

- ⚠️ **O tema escuro está DESLIGADO** (`DARK_MODE_ENABLED = false` em `stores/theme-store.ts`). A
  rampa escura continua inteira e volta trocando a constante: **não apagar**. Os três seletores de
  tema mostram a lua desabilitada. São três: mexeu num, mexa nos outros dois.
- ⚠️ **Rotas sem casca ficam claras para sempre**, mesmo quando o escuro voltar: login, esqueci minha
  senha, convite, sessão expirada, 404 e as duas do hub. O mecanismo é o `ThemeLock` do `router.tsx`,
  e é de **rota**, não de componente.
- ⚠️ **UM ÚNICO LARANJA: só o `#D5623A`.** A escala de terracota foi colapsada **na paleta**, e não
  nos componentes: `primary-strong`, `primary-on-light`, `primary-container`, `primary-bright` e
  `chart-1` apontam todos para ele. Os nomes de token continuam porque são a API que a interface
  consome. **Devolver a escala é reeditar só `palette.css`.**
- ⚠️ **O laranja único custa AA, e o usuário foi avisado.** O `#D5623A` dá 3,9:1 com branco: reprovam
  os botões preenchidos, a pastilha de navegação, o visto do checkbox e todo texto de marca sobre o
  papel.
- ⚠️ **A secundária TROCA de valor entre os temas, e a primária não.** O `#010066` dá 15,6:1 sobre o
  papel e **1,07:1 sobre o grafite**: a rampa escura carrega `#A0A6FF`. Quem depender da secundária
  num contexto que não acompanha o tema (3D, MapLibre, halo) precisa do azul médio, nunca do
  `#010066`.
- ⚠️ **Anel de foco é `ring-primary`, e não `ring-secondary`.** Foco não é semântica, é estado, e
  estado segue a marca. São **119 usos**, medidos em 16/09/2026: mudar o token sem mudar os
  utilitários recria o bug de campos numa cor e botões noutra. Em portal vale o `PORTAL_FOCUS_RING`.
- ⚠️ **Grep de hex NÃO acha tudo numa troca de paleta.** Já sobraram cores em `rgb()`/`rgba()`,
  gradientes, `--glow-*`, cor de cena 3D e parada de mapa. **Varrer por MATIZ**, calculando o hue e
  listando o que cai na faixa.
- ⚠️ **Link no RookHub não é `variant="link"`: é `<Link>` ou `<a>` com a classe escrita à mão**, hoje
  `text-accent`. Quem trocar cor de link varre por `hover:underline`, e não pelas variantes. ⚠️ E
  **não** trocar `text-primary-on-light` em bloco: a mesma classe veste ícone que não é link.
- ⚠️ **Sobre a faixa laranja, o destaque é BRANCO** (traço ou preenchimento), nunca um segundo
  laranja: com um laranja só, toda pastilha sobre a faixa some.
- ⚠️ **`-on-light` é família de TEXTO**, escurecida para passar 4,5:1 sobre a matiz diluída. Como
  tinta chapada ela fica escura e dessaturada, e duas cores escuras não se separam: **faixa de
  severidade usa a família de preenchimento (`bg-error`, `bg-warning`)**. ⚠️ No tema escuro as duas
  famílias têm o mesmo valor, então o sintoma só aparece no claro.
- ⚠️ **A tinta de um chip não é o token do fundo dele.** Chip tingido é a matiz a 15% com a família
  `-on-light` por cima; com a mesma matiz nos dois, "Bloqueia" ficava em 2,99:1.
- ⚠️ **A marca troca de ARQUIVO, e nunca é pintada por filtro.** `components/shared/brand-assets.ts`
  é o mapa único. `brightness-0` resolve o "Rook" (branco chapado) e **mata a torre**, que é
  gradiente. ⚠️ **O sufixo do arquivo é a COR da arte, não o nome do tema**: `-white` vai sobre fundo
  escuro, `-dark` sobre papel. Ler ao contrário só aparece na tela, como um logo sumido.
- ⚠️ **Quem troca a arte do backoffice é o `useBrandAssets`, não cada componente**, e ele decide por
  **rota e por endereço**. Pôr a marca da equipe só na topbar deixou a torre laranja no drawer da IA
  dentro do backoffice.
- **Ícones**: `src/components/icons.ts` é a fonte única, Lucide via `react-icons/lu`. Verificado:
  **zero imports de `react-icons` fora dele**. A única exceção sancionada é o `TRUCK_SVG` do
  `operation-map`, porque o marcador do MapLibre recebe DOM e não componente React.
- **Barra de rolagem nunca visível**, no sistema inteiro. As regras ficam no `@layer base` do
  `globals.css`. Como a barra some, **área rolável precisa de outra dica** de que há mais conteúdo.
- ⚠️ **A `.saas-theme` precisa repor `--ring`, `--color-ring` e `--color-primary-on-light`**, e não
  só `--primary`/`--secondary`: anel de foco é token próprio e não é alcançado pela troca da marca.
- ⚠️ **O escopo do tema vai no `body`, e quem o marca é o `app-shell.tsx`.** Tudo que o Radix monta
  em portal nasce no `body`, FORA da casca: repor a classe em cada conteúdo portalizado é a correção
  errada, e esquece o próximo portal.
- ⚠️ **`@theme inline` faz o utilitário apontar para o token SEM o prefixo `--color-`.** Repor só
  `--color-primary` num escopo não muda nada, e o sintoma engana: a variável lia branco enquanto a
  borda renderizada era terracota. **Escopo novo repõe os dois.**
- ⚠️ **Em atributo de SVG e estilo inline, `var(--color-secondary)` não existe**: use `var(--secondary)`.
- ⚠️ **Conteúdo em portal do Radix sai de `.management-theme`.** Lá dentro `secondary` volta a ser o
  cinza de controle do operacional. Em portal, usar só tokens da paleta comum.

## Molde de tela

**O molde do painel tem TRÊS camadas, nesta ordem**, e quem sair dele destoa:

```
HeroBand  →  <section> com HeroStats mordendo a borda (-mt-16 sm:-mt-20)  →  PageContent rounded-t-4xl bg-light
```

- ⚠️ **São dois `QueryState`, um por camada**: a subida fica dentro da seção e não em volta dela,
  senão carregando e erro aparecem por cima da faixa colorida.
- ⚠️ **`HeroBand` inclui a topbar**: quem o usa não usa `PageBanner`, senão o título aparece duas
  vezes. E trocar um pelo outro sem pôr o `HeroStats` deixa um vazio de ~100px.
- ⚠️ **Ao mover algo para dentro do painel branco, TROQUE A FAMÍLIA DE TOKEN junto.** `surface` é do
  papel e `light` do painel; no tema claro muitas se equivalem, então o erro só aparece no escuro. O
  poço dentro do painel é `bg-light-container` e o traço é `border-light-outline`.
- ⚠️ **Controle que recorta a lista mora DENTRO do painel branco**, junto do que ele controla, e é
  campo com **rótulo visível** num grid, não pastilha achatada: "Todas as marcas" é um VALOR, não uma
  pergunta.
- ⚠️ **A ABA escolhida é pastilha clara com escrita marinha** (`page-tabs.tsx`), e não preta nem
  terracota: hierarquia por superfície, não por preenchimento.
- **Estado ativo de NAVEGAÇÃO é terracota** (`primary-strong`), no menu superior da gestão e na
  lateral do operacional. **Os dois andam juntos: mexeu num, mexa no outro.** Segue preto
  (`bg-bright`) a paginação, o `period-picker` e a variante `bright`.
- ⚠️ **Estado ativo e hover são EXCLUSIVOS, nunca somados.** Escrever o hover na base e o ativo num
  `&&` depois parece certo: no hover a regra `:hover` vence por especificidade e apaga a pastilha do
  item ativo, e o ícone claro dentro dela some (medido em 1,03:1).
- **Hover de botão colorido escurece a própria cor** (`color-mix(in oklab, <cor> 86%, black)`). Véu
  translúcido não serve: no tema claro ele clareia.
- ⚠️ **Botão que é SÓ ícone nunca pinta fundo.** Ele nasce na cor do seu papel e o hover é a mesma
  cor um degrau adiante. Classes `.acao-editar`, `.acao-excluir`, `.acao-sair`, `.acao-ativar` e
  `.acao-neutra`. No operacional um `compoundVariant` de `ghost + icon` aplica a regra a todos.
- ⚠️ **Um `hover:text-*` que sobre no elemento MATA a `.acao-*` em silêncio.** As `.acao-*` moram em
  `@layer components` e **utilitário vence camada de componente**; e o `tailwind-merge` não conhece
  essas classes. Por isso o `compoundVariant` repete a cor do hover como utilitário, e o
  `lib/utils.ts` ensina o grupo `acao` ao merge com `extendTailwindMerge<'acao'>` (o `'acao'` no
  parâmetro de TIPO é obrigatório). **Não dá para confiar na leitura do código aqui: meça a cor
  computada.**
- ⚠️ **O botão de apoio é o mesmo objeto nos dois painéis**: `ghost` do `SpectrumButton` e `outline`
  do `Button`, traço marinho `/60` com escrita marinha. ⚠️ Ao mudar uma variante do `SpectrumButton`,
  **procure os `className` locais que a sobrescrevem**: o motivo escrito no comentário costuma já ter
  caducado.
- ⚠️ **`secondary` do `SpectrumButton` não é "botão secundário"**: é cheio, e existe para duas
  escolhas equivalentes. Ação de apoio é `ghost`.
- **O rodapé do diálogo é só decisão: fechar ou gravar.** Ação sobre o formulário mora no corpo. No
  backoffice as duas ações ficam juntas à direita, a de sair em `outline`.
- ⚠️ **`LightCard` envolvendo o conteúdo inteiro de uma aba é cartão dentro de cartão.** Ele continua
  certo como UMA das colunas de um master-detail, que é quando a moldura distingue duas coisas.
- ⚠️ **`.metric-tile`, e não `bg-surface-lowest`, para bloco de indicador.** `surface-lowest` é o
  token do **poço**: o indicador afunda no fundo. Campo de entrada continua no poço (`.glass-well`).

### Listas e tabelas

- ⚠️ **Coluna de tabela leva largura em PORCENTAGEM**, somando 100. Com só uma coluna declarada ela
  engole a folga. ⚠️ `whitespace-nowrap` numa célula **anula** a porcentagem.
- ⚠️ **`truncate` sozinho não encolhe coluna**: a coluna nunca fica menor que o texto mais longo. O
  que resolve é `w-full max-w-0` no `<td>`.
- ⚠️ **Nome longo ROLA no hover, e não é cortado com reticências**: nesta frota o cliente escreve
  instrução dentro do próprio nome, e a reticência cortava a explicação. `overscroll-x-contain`
  impede a rolagem de vazar para a página.
- ⚠️ **Item de flex não encolhe sozinho: `truncate` sem `min-w-0` não corta nada.**
- **Usar `Pagination` de `management/ui`**, 30 por página. O `total` que entra é o de **depois dos
  filtros**, e a página atual é fixada dentro do total, senão filtrar estando na página 5 deixa a
  tela vazia.

### Filas master-detail

Gramática fechada, vale para `/gestao/liberacoes`, `/pareceres`, `/aprovacoes` e `/impedimentos`.
**Ao criar ou mexer numa fila, copie daqui e não invente:**

1. **Faixa de severidade** de 4px à esquerda, e a cor SEMPRE repete um rótulo escrito.
2. **Linha de identidade**: título à esquerda, o número que ordena a fila à direita, `tabular`.
3. **Linha de apoio**: severidade mais o tamanho do problema, sem corrente de pontos longa.
4. **Detalhe em zonas nomeadas**: veredito no topo, contexto, evidência, ação.
5. **`xl:sticky xl:top-6 xl:self-start`** no detalhe; sem `self-start` o grudado não tem altura.
6. **Estado vazio com tokens `light`.** Achou `bg-surface-lowest` dentro de `PageContent bg-light`?
   É bug.

- ⚠️ **A faixa de estado existe para SOBREVIVER à seleção.** Sempre que uma lista esconder algo com
  `active ? null :`, o problema é a falta da faixa, e não o chip: a linha selecionada é laranja e o
  chip tonal some nela. Em caminhões isso apagava justamente a informação de que o veículo está
  bloqueado.
- ⚠️ **Nem toda lista quer master-detail.** Use-o quando o detalhe tem seções e formulário; a fila
  corrida serve quando o item cabe numa linha rica.
- ⚠️ **A ordenação das filas NÃO é uniforme, e isso é sabido.** `liberacoes` ordena por horas
  paradas, `aprovacoes` por severidade e depois idade, e `pareceres` **não ordena**. Dívida aberta:
  perguntar antes de mexer.
- **Resumo de fila muda de cor com a situação** (`Alert` error/warning/success), senão "tudo
  explicado" e "1 grave precisa subir" saem no mesmo cinza.

### Formulários

- **Os diálogos de cadastro são ETAPAS** (`WizardSteps` em `management/ui`), porque trinta campos
  numa coluna obrigam a rolar três telas antes de saber o que falta.
- ⚠️ **As etapas são navegáveis, e não um trilho**: aqui a ordem é arrumação, não regra de negócio.
- ⚠️ **"Próximo" só existe no CADASTRO**; na edição o botão grava de qualquer etapa.
- ⚠️ **O botão de avançar é `type="button"`**, senão o Enter tentaria gravar o cadastro inteiro.
- ⚠️ **A validação ao avançar é do passo atual** (`trigger` com a lista de campos), senão sair da
  primeira etapa acusa campo que a pessoa ainda nem viu.
- ⚠️ **A etapa com erro é marcada na barra.** Sem a marca, a pessoa clica em cadastrar, nada
  acontece, e o formulário parece quebrado.
- ⚠️ **`values` do react-hook-form, e não `useEffect` + `reset`.** Sincronizar dado externo com
  efeito é o padrão que o React Compiler recusa aqui. ⚠️ `values: loaded` não compila com
  `exactOptionalPropertyTypes`: espalhar com `...(loaded ? { values: loaded } : {})`.
- **Placeholder é EXEMPLO, e não repetição do rótulo.** "Volvo" mostra o formato num relance; "Digite
  a marca" não ensina nada.
- **Campo de data é o `DatePicker` de `components/ui`, nunca `<input type="date">`**, e `GlassSelect`
  é Radix, nunca `<select>` nativo: a caixa nativa é desenhada pelo sistema operacional e ignora a
  paleta.
- ⚠️ **"Não informado" é apagado ao carregar o formulário**: o literal vem gravado assim no banco, e
  quem não apagasse gravaria a frase como se fosse o modelo.
- ⚠️ **A diferença contra o original percorre uma LISTA**, e não trinta `if` escritos à mão: com esse
  número de campos, o `if` repetido grava o valor do campo vizinho sem nada falhar.
- **Excluir e inativar não são o mesmo botão**, e o diálogo diz isso na cara. Inativar guarda o
  histórico; excluir remove o cadastro que nunca deveria existir, e o backend **recusa com 409**
  quando há viagem, evento ou posição apontando para a pessoa. A mensagem do backend vai inteira para
  a tela.

## Telas que exigem cuidado

### As telas que cabem na janela

Login, hub, voz, 404, sessão expirada e esqueci minha senha usam `.tela-proporcional`
(`styles/globals.css`), que aplica `zoom` calculado pela altura.

- ⚠️ **Medir cada peça em `vh` foi tentado e não serve**: cada elemento parava no próprio piso do
  `clamp`, e a logo minguava enquanto os campos seguiam grandes. O `zoom` resolve porque é um fator
  único para tudo.
- ⚠️ **Dentro de `zoom`, `dvh` chega reduzido**: por isso a classe usa `height: calc(100dvh / var(--escala-tela))`.
- ⚠️ **A referência é o tamanho APARENTE, e quanto MENOR, maior a tela fica.** É contraintuitivo e já
  confundiu: **baixar o número aumenta a tela**. Valores em uso, todos **medidos** e não chutados:
  voz 820, login 900, esqueci a senha 660, sessão expirada 720, 404 460, hub 940 (e 820 na faixa
  baixa).
- ⚠️ **No hub a técnica SAI abaixo de 801px de largura**, de propósito: ali ele empilha e forçar a
  janela espremeria a tela a 70% num celular.
- ⚠️ **Mexeu no conteúdo dessas telas? Meça de novo com o zoom desligado.**
- ⚠️ **Decoração grande mede pelos dois eixos** (`min(Nvw, Nvh)`): o globo do hub e a esfera da voz
  mediam só por `vw` e estouravam a altura numa janela larga e baixa.

### O painel do dono

Podado a **Visão geral e Equipe**, temporariamente, a pedido do usuário.

- ⚠️ **A home é `owner-overview-page`**, e a `owner-home-page` continua no repositório: aquela
  responde "quanto sobrou" com DRE e margem, e **nenhum desses números tem origem**. Voltar é trocar
  o import do `RoleHome`.
- ⚠️ **Em Equipe o dono vê só quem ele convidou** (`somentePainel`), porque os motoristas da
  telemetria empurravam as contas para a segunda página. Some junto o filtro de filial: filtro que
  nunca acha nada lê como defeito.
- ⚠️ **As rotas continuam registradas**: quem digitar `/gestao/resultado` ainda chega. Some do menu
  foi o que se pediu, e é o que torna a volta barata.
- ⚠️ **Cargos saiu do menu do dono, e ele é o único que escreve lá.** Hoje ninguém cria cargo pelo
  menu. Sabido e aceito.

## Mapas

São três (`operation-map`, mapa ao vivo da gestão e `stops-map`), com a base comum em
`components/shared/map-style.ts`: **Liberty no claro e `dark` no escuro**, do OpenFreeMap, sem chave.

- ⚠️ **A atribuição NÃO pode ser removida.** A licença ODbL exige o crédito visível, e
  `attributionControl: false` criaria problema de licença nos três de uma vez. Os três usam
  `compact: false`, senão o bloco cresce para cima e dá um salto no canto a cada clique.
- ⚠️ **`setStyle` descarta fonte, camada E imagem registradas.** A montagem é função reexecutável,
  chamada no evento `styledata` (não em `load`, que dispara uma vez na vida do mapa). ⚠️ **Ouvinte de
  ponteiro NÃO entra na função de montagem**, senão um clique vale dois.
- ⚠️ **Camada de texto PRECISA declarar `text-font`.** Sem ela o MapLibre usa a família do CARTO, que
  o OpenFreeMap não serve, e cada faixa de glifo vira 404. O rótulo ainda aparece pelo recurso
  alternativo, que é o que torna o defeito fácil de não ver. A família publicada é `Noto Sans`.
- ⚠️ **Não existe satélite no OpenFreeMap**, e chave de outro provedor no navegador é chave
  publicada.
- ⚠️ **`montarCamadas` é idempotente e `desenharConteudo` tem trava de reentrância.** Sem ela há
  corrida: o `styledata` dispara durante a espera da rasterização dos ícones e as duas execuções
  estouram com `Source already exists`, num laço que não sai sozinho.
- ⚠️ **O evento `error` do MapLibre NUNCA derruba a tela.** Ele é emitido por muita coisa que não
  impede o mapa de funcionar. As duas provas reais de falha são o `catch` de `desenharConteudo` e um
  relógio de 15s para a base chegar. ⚠️ **Todo caminho de falha LOGA antes de derrubar.**
- ⚠️ **A tampa COBRE o mapa, e não adia a montagem dele**: o MapLibre precisa de um elemento com
  tamanho para se instalar. No mapa ao vivo ela espera **dois** sinais, camadas montadas e GLB
  baixado, senão os caminhões surgem de uma vez. ⚠️ **O erro do GLTFLoader também avisa que
  terminou**, senão um 404 no modelo deixa a tela em "Carregando" para sempre.
- ⚠️ **Nada de raio de canto no elemento do mapa**: quem arredonda é o container, pelo
  `overflow-hidden`.
- ⚠️ **O que flutua sobre o mapa usa a MESMA receita nos dois** (papel a 80%, traço, `rounded-md`,
  `backdrop-blur`, 11px). ⚠️ **Quem garante a leitura é a camada de papel, não o desfoque.** Os dois
  mapas são as únicas superfícies do sistema que ainda usam `backdrop-filter`.
- ⚠️ **Os cartões sobrepostos empilham à ESQUERDA**: o canto superior direito é do controle de zoom.

### Mapa ao vivo (`/gestao/mapa`)

- ⚠️ **O dono NÃO tem esta tela no menu**, mas a rota não tem guarda: quem digitar entra. É decisão
  de menu, não de permissão.
- **A lista fica à esquerda e o mapa à direita, com a MESMA altura** (altura da LINHA do grid). A
  ficha é uma **gaveta** que empurra o mapa, e não uma camada por cima: sobreposta, taparia o
  caminhão recém-escolhido.
- ⚠️ **O `FleetMap` precisa de `ResizeObserver` chamando `map.resize()`**: o MapLibre escuta só o
  `resize` da JANELA, e com a gaveta encolhendo o container o clique sai deslocado do que se vê.
- ⚠️ **São DUAS animações na gaveta**: a largura do `aside` (que encolhe o mapa) e o deslize do
  painel. Só a largura dá meio drawer. ⚠️ O painel fica **sempre montado**, senão nasce na posição
  aberta e a entrada não anima. ⚠️ A ficha desenhada é estado SEPARADO da seleção, e quem a apaga é o
  `onTransitionEnd` da largura, filtrado por `propertyName` e por `target === currentTarget`.
- **A câmera SEGUE o veículo escolhido**, dentro do laço de animação, com `setCenter` na mesma
  posição interpolada. ⚠️ **NENHUM gesto desliga o seguimento: quem desiste é quem fecha a ficha.**
  ⚠️ `arrastando` marca o gesto EM CURSO, e não é um interruptor. ⚠️ A guarda do `originalEvent`
  separa o gesto da pessoa do movimento que o próprio código pede, e `isEasing()` protege a animação
  de foco.
- ⚠️ **Os dois `fitBounds` PRECISAM receber `bearing` e `pitch` atuais**, senão o MapLibre devolve a
  visão para o de cima e desfaz a inclinação escolhida. **A base escolhida VENCE o tema.**
- ⚠️ **A roda do mouse sobre a legenda ou o painel não chegava ao mapa**, porque eles são irmãos do
  container. A correção é um ouvinte na **captura** da moldura que reenvia o **mesmo evento clonado**
  (o clone nasce com `isTrusted` falso, e é isso que corta o laço). ⚠️ **Cuidado ao pôr algo ROLÁVEL
  dentro da moldura**: o ouvinte barra a rolagem do retângulo inteiro.
- ⚠️ **A lista acompanha quem foi escolhido no mapa, rolando no `scrollTop` dela, e NÃO
  `scrollIntoView`**, que sobe rolando todos os ancestrais e traz de volta o solavanco da página.
  Item já visível fica onde está.
- ⚠️ **"Atualização a cada 10 segundos" era mentira.** Os 10s são de quando a TELA repergunta; o
  banco só recebe posição quando o coletor roda, a cada 5 minutos, mais o atraso do rastreador. O
  chip mostra a IDADE da leitura, medida no cliente.
- ⚠️ **O aviso de dessincronizados é flutuante e só volta quando a CONTAGEM muda**, senão apareceria
  seis vezes por minuto até virar ruído.
- ⚠️ **A legenda é DERIVADA de `STATUS_COLOR` e dos rótulos, nunca escrita à mão.** Legenda que mente
  é pior que legenda nenhuma. `features/live-map/status-color.ts` é a fonte única, e antes a tabela
  estava copiada em três lugares.
- ⚠️ **O filtro do painel filtra a LISTA, não os marcadores.** Pendência conhecida.
- ⚠️ **Armadilha ao TESTAR o seguimento:** as posições reais não mudam entre leituras e o React Query
  faz structural sharing, então o efeito não dispara e parece quebrado. É preciso interceptar a rota
  e deslocar as coordenadas; filtrar por status no interceptador **não** funciona, porque ali o DTO
  traz o status cru. ⚠️ O polling também para quando a aba perde o foco.

### O replay e a camada 3D

- ⚠️ **O replay não passa por estado do React.** O `FleetMap` é `forwardRef` e expõe `setReplayPose`;
  o laço escreve direto na fonte do MapLibre. Antes o `setState` no pai re-renderizava lista, ficha e
  mapa dezenas de vezes por segundo.
- ⚠️ **O replay avança por TEMPO, e não por índice de ponto.** Por índice, parado no semáforo dezenas
  de leituras iguais plantavam o caminhão, e numa lacuna duas leituras a 20 km eram atravessadas num
  décimo de segundo. `track-timeline.ts` é o relógio, e `DURACAO_ALVO_S` vale para qualquer janela:
  mexer nele muda as três velocidades de uma vez.
- ⚠️ **Parada NÃO é lacuna**, e isso só apareceu nos dados de produção: com critério só de tempo, um
  veículo tinha 70 "trechos sem leitura" em 24h, quase todos parado no pátio. A condição exige tempo
  longo **E** deslocamento acima de 50 m. ⚠️ **Validar algoritmo de trajeto com dado de PRODUÇÃO**, e
  não com o local, onde quase tudo é lacuna de verdade.
- ⚠️ **A lacuna é DESENHADA, não apagada** (tracejado fino): sumir com ela esconderia buraco de
  cobertura, que é informação de operação. `track-segments.ts` quebra a rota e descarta o ponto com
  velocidade implícita acima de 200 km/h, que é coordenada impossível.
- ⚠️ **Buraco no trajeto local não é bug, é a base local.** Medido: o mesmo veículo tem 413 posições
  em 72h aqui contra 13.565 em produção. Antes de investigar código, comparar com produção.
- ⚠️ **A matriz da camada 3D é `defaultProjectionData.mainMatrix`, NUNCA `modelViewProjectionMatrix`.**
  As duas chegam no mesmo objeto e os nomes enganam: com a errada os caminhões simplesmente não
  aparecem, sem uma linha de erro.
- ⚠️ **`renderer.resetState()` antes de cada `render` é obrigatório**, senão o mapa inteiro some
  depois do primeiro quadro. ⚠️ A câmera é `Camera` crua, e a origem do sistema acompanha o centro do
  mapa, senão o `float32` da GPU não distingue dois caminhões da mesma cidade.
- ⚠️ **Nunca combinar X e Z na mesma chamada de `rotation.set`**: a ordem do Euler XYZ aplica o Z
  primeiro e o caminhão capota. O meio-giro que aponta a frente mora no GRUPO.
- ⚠️ **Os eixos do modelo foram MEDIDOS, não deduzidos.** Já "corrigi" isso trocando o sinal do X, e
  estava errado: o espelhamento da matriz é em Y, nunca cima e baixo.
- ⚠️ **O caminhão some atrás da base quando o mapa está inclinado**, e a correção é
  `renderer.clearDepth()`: o MapLibre grava profundidade sintética por camada, e numa base com 119
  camadas o teste reprova o caminhão. Preço aceito: prédio em 3D também deixa de escondê-lo.
- ⚠️ **O status é a COR DA LATARIA, e não um disco no chão** (o disco tapava o modelo). Pintar exige
  **duas peneiras**: as rodas se separam por MALHA e os faróis por MATERIAL. ⚠️ A textura é descartada
  (`map = null`), senão a cor multiplica pela cor assada, e por isso a luz virou três pontos.
  ⚠️ **Os materiais são CLONADOS por caminhão**, senão pintar um pinta todos.
- ⚠️ **As camadas 2D continuam montadas com `icon-opacity: 0`, e isso é estrutural**: custom layer do
  three não responde a `queryRenderedFeatures`, e os três handlers estão ligados ao id do símbolo.
  Apagar a camada quebra a interação inteira sem erro no console.
- ⚠️ **A roda precisa de PIVÔ no próprio eixo**, senão orbita o caminhão. `wheel-pivot.test.ts` trava
  os dois lados.
- ⚠️ **A fumaça é emitida por DISTÂNCIA percorrida, e não por quadro**, senão o rastro fica
  quilométrico. E ela guarda MERCATOR, não a posição no espaço local, que é recriado a cada quadro.
- ⚠️ **`sizeAttenuation` não funciona nesta camada** (a projeção vem do MapLibre), **`AdditiveBlending`
  some sobre base clara** e **`PointsMaterial` sem `map` desenha quadrado**.
- ⚠️ **`jumpTo` CANCELA `easeTo`**: a entrada animada morria no quadro seguinte e o pitch nunca
  chegava ao alvo.

## Assistente e voz

- **O assistente é um DRAWER pela direita, e é o MESMO nos quatro perfis.** O `/app` importa o
  `AssistantDrawer`, o store e o atalho do `management` **de propósito**: uma cópia local divergiria
  na primeira correção. A sessão atravessa porque `management/features/auth/store` é uma **ponte**
  sobre o `session-store` único, e não um segundo store.
- ⚠️ **Antes disso eram DOIS assistentes, e o do `/app` não era assistente nenhum**: a tela fabricava
  a resposta em código e devolvia sempre o mesmo texto. Operador e manutenção recebiam resposta
  inventada sem nada avisando.
- ⚠️ **O atalho é Ctrl+K, e só ele.** O Ctrl+R foi removido e **não deve voltar**: sobrescrevia o
  recarregar do navegador, que a pessoa tem memorizado há anos.
- **O histórico é do backend, nunca de `localStorage`**: guardar no navegador deixaria pergunta sobre
  a operação de um cliente na máquina de quem abriu o painel. São até 10 conversas por pessoa.
- ⚠️ **Renomear é otimista; excluir confirma na própria linha.** Esperar o servidor faria o texto
  piscar de volta, e um diálogo por cima do drawer empilharia duas camadas de foco preso.
- ⚠️ **O drawer não escurece a tela, e eram DOIS caminhos**: o véu do `Overlay` e a sombra projetada
  do painel. ⚠️ **O `Overlay` continua existindo, só que sem cor**: é ele que o Radix usa para fechar
  ao clicar fora e prender o foco.
- **O painel de conversas não é desmontado quando fecha, a largura é que anima**, e a animação é do
  Radix pelo `data-state`, senão a saída fica seca.
- **O estado é do store, com ações assíncronas**, e não `useEffect` nos componentes: carregar
  conversa é consequência de um clique, não de uma renderização.
- **`MAX_ASSISTANT_CONVERSATIONS` mora em `management/types.ts`**, e não na fronteira de API, senão o
  mock importaria da API que importa o mock.

### Gráfico e tabela na resposta

- ⚠️ **O gráfico aparece nos TRÊS lugares**: no chat, na tela de voz durante a conversa e no
  histórico relido. Na voz é a exceção deliberada à regra de não mostrar texto: "quarenta e um
  caminhões" se ouve, mas a comparação entre as quatro situações só se enxerga.
- ⚠️ **No histórico o gráfico volta COM a hora da apuração**, e é isso que resolve a objeção antiga
  de não guardá-lo: sem a data, um número da semana passada passaria por número de agora.
- **Os números são os da CONSULTA, não os do modelo.** `AnswerChart` e a tabela existiam desde
  sempre, e só o mock os preenchia.
- **O gráfico da resposta anterior sai quando chega outra pergunta**, senão a tela mostraria o
  retrato errado enquanto a próxima é respondida.
- ⚠️ **A linha de FONTE saiu da resposta** por decisão do usuário. Quem quiser repor tem o
  `turn.answer.source` ainda chegando do backend.

### A tela de voz

- **Um botão só, e ele é o interruptor da conversa.** Quem decide que a fala acabou é o silêncio.
- ⚠️ **O fim da fala é decidido AQUI, e não pelo navegador** (`continuous = true`, corte em 2,4s de
  silêncio). Com `continuous = false` a Web Speech encerra na primeira pausa e a pergunta chega pela
  metade. ⚠️ **O `onend` do navegador não significa que acabou**: o Chrome encerra sozinho e sem
  religar a transcrição morre no meio da conversa. ⚠️ **A transcrição ACUMULA, não substitui.**
- ⚠️ **Duas fontes de "ainda está falando", e as duas são necessárias**: o volume do microfone e a
  transcrição chegando. Só o volume confundiria ar condicionado com voz; só a transcrição perderia a
  pausa entre frases. ⚠️ **`onSpeech` e `onResult` não são a mesma coisa**: o primeiro dispara com
  atividade de áudio, inclusive ruído.
- ⚠️ **Em lugar barulhento o limiar FIXO trava a conversa.** A decisão mora em
  `pages/hub/speech-detection.ts`, com três defesas: piso de ruído **adaptativo** (desce rápido, sobe
  devagar), **persistência de 140 ms** e **teto pelo reconhecedor** (4s sem texto novo processa
  assim mesmo). O nível medido é o da faixa de **300 a 3400 Hz**: motor e vento vivem abaixo disso.
  ⚠️ **Isto tem teste porque não aparece em teste manual**: quem testa está numa sala silenciosa.
- ⚠️ **No celular, `stop()` é um pedido, não um fato.** Ele agora devolve promessa que só cumpre no
  `onend`, com teto de 1,5s. Sem isso a resposta começava com o reconhecedor ainda segurando o
  microfone, e a fala dela virava a pergunta seguinte. ⚠️ **`abort()` e não `stop()` para encerrar**,
  porque `stop()` ainda entrega os trechos da fila. ⚠️ **`start()` não significa que o microfone
  abriu**: quem marca é o `onstart`. ⚠️ **O `AudioContext` do iPhone precisa nascer no toque**, de
  forma síncrona no `onClick`, senão o iOS o deixa suspenso para sempre.
- ⚠️ **Sem fone, a voz dela entra no microfone e vira pergunta.** Duas defesas na tela: meio segundo
  de pausa antes de reabrir, e o `semEco`, que corta do começo da transcrição o que ela falou por
  último. **O corte exige três palavras seguidas**, senão "onde" ou "está" roubariam o começo de
  perguntas legítimas.
- ⚠️ **Nada de texto da conversa aparece na tela de voz** (decisão do usuário). Saíram o painel da
  esquerda, que agora só aparece ao ABRIR uma conversa gravada, **e o balão da última resposta**, que
  era o que mais fazia a tela parecer um chat. Quem fala não lê, e o registro continua em
  `Conversas`.
- ⚠️ **Cada início de conversa falada é uma conversa nova.** A sessão abre no `startListening`, e não
  no mount: abrir no mount criaria conversa vazia só por alguém passar pela tela. O `endConversation`
  solta o id, senão o próximo início gravaria dentro da conversa fechada.
- ⚠️ **A lista da barra lateral é do canal `voice`**, e a chave da query leva o canal, senão as duas
  listas dividem o mesmo cache. A tela **invalida essa chave quando a sessão abre**, porque a barra
  busca ao montar e a sessão nasce depois dela.
- **As frases de espera são da TELA, e não do modelo** (`voice-phrases.ts`): vindas do modelo,
  sairiam junto com a resposta, que é quando já não servem. ⚠️ **O aviso é disparado por EVENTO do
  backend** (`onConsulting`), e não por relógio: um "oi" não chama função nenhuma.
- ⚠️ **Trocar a voz exige limpar o cache das frases de espera**, que guarda o ÁUDIO já sintetizado.
- ⚠️ **A assistente se chama Lia na voz feminina e Dexter na masculina**, e quem decide é o TIMBRE. O
  nome é montado no backend a partir do `voiceGender` que a tela manda. ⚠️ **A tela manda
  `vozAtivaRef.current?.gender`, e não o estado**: o nome tem de casar com a voz que a pessoa ouve, e
  ler estado naquela função assíncrona faz o React Compiler desistir de memoizar a tela inteira.
- ⚠️ **O que fica no `localStorage` é o gênero e um contador, nunca a voz.** Gravar a voz exata daria
  o contrário do pedido, que é não repetir o mesmo timbre. ⚠️ **O passo do rodízio anda dentro do
  `queryFn`**, que é o único lugar que roda uma vez por visita e fora do render.
- ⚠️ **O catálogo vem do backend**, e não de uma lista no cliente. **Quem define o nome da voz é o
  backend**: a tela nunca traduz id para nome.
- ⚠️ **Falha do microfone precisa FECHAR a conversa**, senão o botão fica em "Encerrar" para uma
  conversa que nunca começou. Foi a suíte que pegou.
- ⚠️ **Não usar `lastAnswerRef` para decidir dentro de função assíncrona**: o ref é preenchido por
  efeito e no meio de um `await` ainda traz a resposta ANTERIOR.
- `/assistente/vozes` é uma tela **temporária**, fora do menu, para ouvir e conferir as vozes. O tier
  sai do id por substring, porque a API não o devolve e **o preço muda por tier**.

## Telemetria: o que muda decisão de tela

O fornecedor, os limites e as armadilhas da ingestão estão em `../Backend-web/docs/TELEMETRIA.md`.
Nenhum cliente fala com a MiX.

- ⚠️ **IDs de 64 bits são destruídos pelo `JSON.parse`.** 19 dígitos não cabem em `Number`, e com o
  id arredondado a API responde `401 Not Authorised`: **o sintoma parece falta de permissão e é ID
  inexistente.** Trafegam como **string** na borda.
- ⚠️ **O que a MiX reporta não é o que o painel mostra.** O fornecedor tem 54 ativos e 150
  motoristas; depois do tratamento sobram **40 caminhões e 110 motoristas em produção**. ⚠️ **No banco
  de desenvolvimento compartilhado são 41 e 127**, porque ele nasceu sem a curadoria do cadastro:
  comparar os dois ambientes sem lembrar disso leva a conclusão errada.
- ⚠️ **Metade da frota não tem motorista identificado na viagem.** Qualquer ranking ou quadro de
  equipe precisa dizer isso na tela, senão o número parece errado.
- ⚠️ **Não existe escala absoluta de nota de motorista**: ela é relativa à própria frota, e nenhuma
  tela pode apresentá-la como comparável entre clientes.
- **Posição do fluxo incremental vem sem endereço**: o geocodificado só acompanha início e fim de
  trecho, então o mapa mostra coordenada quando não há endereço.
- ⚠️ **`SEM_SINAL` vira `stopped` no `/app`, e a tradução PERDE informação.** Parado é um caminhão
  que reportou e não anda; sem sinal é um que ninguém sabe onde está. Acrescentar `no_signal` pede
  mexer em `status-maps`, nas abas de filtro e na legenda.
- ⚠️ **"Sem rastreador" não é "sem sinal".** Caminhão criado à mão nasce com `origin = ROOKHUB` e
  nunca reporta: sem sinal é problema para investigar, sem rastreador é escolha de cadastro.
- ⚠️ **O chip "Inativo" cala os outros**: um caminhão que saiu da frota não está "sem sinal".
- ⚠️ **`criticality` está em `low` nos 40 veículos**, que é o padrão da migration e não classificação
  de ninguém. Quem usar isso para priorizar precisa saber que o campo espera curadoria.

### A régua do consumo

⚠️ **A média é ponderada pela QUILOMETRAGEM, nunca média das médias.** Medido: o card do dono dava
**4,55 km/l** onde a régua correta dá **3,56**, 27,7% a mais, e sobre a frota inteira a média das
médias daria 5,90 contra 4,13. **É na categoria heterogênea que a média das médias erra feio.**

- ⚠️ **Régua inflada gera ALERTA FALSO**, que é pior que não alertar: quem confere perde a confiança
  na cor. O corte do destaque é 10% abaixo da média do próprio grupo.
- **O consumo é agrupado por CATEGORIA**, senão o ranking premiaria as vans todo mês (10,43 km/l
  contra 3,54 dos caminhões). ⚠️ **O agrupamento EXPÕE o erro de cadastro em vez de escondê-lo**, e
  isso é proposital: veículo classificado errado aparece fazendo 13 km/l entre caminhões.
- ✅ **A régua do front bate exatamente com a do backend** (`aggregateFuel` dá o mesmo que a métrica
  `consumo` de `/v1/fleet/operations`). `fuel.test.ts` trava isso.
- ⚠️ **A mesma armadilha valia para as FILIAIS**: média das taxas em vez de eventos da frota sobre km
  da frota, e o efeito era quatro das cinco filiais em vermelho, hoje uma.

## Segurança e ambiente

- `.env` na raiz, ignorado pelo Git, é a única cópia de valores reais. **Só `VITE_*` chega ao
  bundle.** Chave de IA e de voz é server-side, e desde 26/08/2026 quem as usa é o `Backend-web`.
- ⚠️ **A síntese de voz saiu do Vite e não deve voltar.** Era um plugin Node registrado só em
  `configureServer`, então existia apenas em desenvolvimento: no build publicado a rota sumiria e a
  voz morreria em produção sem nenhum sinal no código.
- ⚠️ **O PAT do GitHub não mora no `.env`.** Quem entrega o token ao Git é um credential helper que
  lê `~/.secrets/github-tokens.json`. ⚠️ **A ligação com o cofre não é versionada**, porque mora no
  `.git/config`: cada desenvolvedor refaz a configuração a cada clone novo.
- Não registrar segredo em comando, log, commit, README ou `.claude`. **A pasta `.claude` é
  versionada e não pode conter dado pessoal.**
- **Não persistir token nem dado sensível em `localStorage`**: a persistência atual guarda só
  preferência não sensível, como tema.
- `.env.example` e a tabela de variáveis do README foram removidos por decisão do usuário e não devem
  ser recriados.

## Documentação e pendências

- `docs/referencias/ARQUITETURA_FRONTEND.md` registra as decisões da fundação do frontend, e é o
  único arquivo daquela pasta.
- ⚠️ **`docs/pdf/RookHub_Arquitetura_e_Decisoes_Tecnicas.pdf` descreve a arquitetura-ALVO**, e
  diverge do construído em três pontos: diz OpenAI, diz AWS (fomos de Oracle e Cloudflare por custo)
  e não menciona TimescaleDB. Para o agora, o código e os READMEs.
- Os PDFs em `docs/pdf/` são versionados de propósito. **Não** sugerir removê-los nem migrá-los para
  LFS.
- ⚠️ **Os GLB originais moram em `original-models/`, na raiz, e o Git ignora a pasta.** São ~123 MB
  convertidos do 3D Warehouse, e este repositório é **público**: quem clonar não recebe nenhum.
  Nenhum é usado por código ainda; o mapa continua no `truck.glb` do Quaternius (CC0, 319 KB).
- **Pendências principais**: ligar `services/api` do `/app` na API real; tela de Viagens como frete;
  origem de custo; integrações de multas e câmeras; paginação server-side; smoke E2E; code splitting;
  decidir o destino da cópia em `System-mobile`.

## Gotchas

**Tailwind, CSS e camadas**

- ⚠️ **Utilitário vence `@layer components`.** Regra que precisa ganhar de utilitário vai para
  `@layer utilities`. Já custou duas tentativas no `.acao-sair-no-menu`.
- ⚠️ **O Tailwind lê `.glb` como código.** O scanner do Tailwind 4 pula binário por extensão e
  formato 3D não está na lista: com 71 MB de modelos o `vite build` tentou alocar **16 GB** e travou
  a máquina. A mensagem é só `memory allocation failed`, sem dizer o arquivo, e **mover a pasta para
  fora de `public/` não resolve**, porque a varredura é do projeto inteiro. A correção são os
  `@source not` no topo do `globals.css`. Modelo novo entra em pasta já excluída ou ganha o próprio.
- **Não** criar `tailwind.config.ts`, PostCSS ou autoprefixer: Tailwind 4 aqui é CSS-first.
- **Não** usar `hsl(var(--...))`: os tokens do painel operacional são OKLCH.
- **Não** usar `bg-white/N` como véu, que some no tema claro: usar `bg-on-surface/N`. Sobre
  fotografia é o contrário, com `on-media`.
- **Não** trocar `font-sora` por `font-display`, mover `--radius-pill` para fora do `@theme` nem
  tirar foco e seleção do `@layer base` do painel de gestão.

**React, hooks e Radix**

- ⚠️ **Não atualizar `ref` durante render nem usar `useEffect` + `setState`** para media query ou
  sincronização de prop: as regras do React Compiler são **erro** aqui. `Date.now()` no corpo do
  componente também (`const [now] = useState(() => Date.now())`).
- ⚠️ **Quando o lint explodir com vários erros depois de uma mudança pequena, o que importa é o
  PRIMEIRO** (`Compilation Skipped`); os outros são consequência. O caminho é bissectar a própria
  mudança, não perseguir os diagnósticos.
- ⚠️ **Componente declarado DENTRO do render remonta a cada estado.**
- ⚠️ **No `DropdownMenuItem asChild`, o Radix Slot CONCATENA as listas de classe** em vez de passar
  pelo `tailwind-merge`. Classe que precisa vencer a base vai na prop `className` do item.
- ⚠️ **O Radix FOCA o item quando o cursor passa por cima**, então tudo que é `focus:` dispara com o
  mouse.
- ⚠️ **Não consertar anel de foco do Radix trocando `focus-within` por `focus-visible`**: o Radix
  devolve o foco por código e o navegador trata foco programático como teclado. A correção é rastrear
  a modalidade (`hooks/use-pointer-close.ts`), e o caminho comum não é o clique fora, é **escolher
  uma opção com o mouse**.
- ⚠️ **Não pôr anel de foco em item de `listbox`**: quem indica a posição do teclado é o realce
  (`data-[highlighted]`).
- `PermissionGuard fallback={null}` **não** oculta conteúdo, porque `null ?? <NoAccessState />` usa o
  fallback padrão. Para esconder seção, teste `hasPermission(...)` direto.
- ⚠️ **Comentário JSX não pode ficar entre o `return (` e o elemento raiz**: vira um segundo filho e
  o TypeScript acusa `TS1005`.

**Rolagem e layout**

- ⚠️ **Toda caixa rolante precisa de `overscroll-contain`**, senão chegar ao fim e insistir na roda
  passa a rolagem para a página. Medido: sem a classe a página andava 810px; com ela fica em zero.
- ⚠️ **Filho de flex tem altura mínima igual ao conteúdo: sem `min-h-0` o painel cresce e estica a
  página.**
- ⚠️ **`scrollIntoView` sobe rolando todos os ancestrais roláveis**, e o de cima é a página. Onde
  isso importa, rolar no `scrollTop` do próprio container. Onde `scrollIntoView` for usado,
  `block: 'nearest'` é obrigatório.
- ⚠️ **`onWheel` do React NÃO serve para converter roda em rolagem horizontal**: o React registra
  ouvintes de roda como passivos, e passivo não pode chamar `preventDefault`. Usar
  `addEventListener` com `passive: false`.
- **O conteúdo do `AppShell` não tem largura máxima**, e as telas de `/gestao` usam a janela inteira
  (`px-4 sm:px-6 xl:px-10`). Tela nova ganha colunas por breakpoint em vez de esticar o campo.

**HTTP e dados**

- ⚠️ **`httpRequest` trata 204 e corpo vazio.** Antes uma exclusão bem-sucedida estourava com
  `SyntaxError: Unexpected end of JSON input`, e o sintoma engana: a operação funcionou no servidor e
  a tela mostra erro.
- ⚠️ **`httpStream` é para resposta lida enquanto ainda está chegando**, e devolve a `Response` crua.
  ⚠️ **NDJSON se corta no `\n`, nunca no pedaço recebido.**
- ⚠️ **O `fetch` do Node não manda `Origin`, e é o `Origin` que escolhe a tabela de credenciais.** Num
  teste ou script, o login sem esse cabeçalho cai na empresa padrão e a conta de plataforma responde
  "e-mail ou senha incorretos".
- **Não** deixar o mapa com centro fixo: o `fitBounds` roda **uma vez**, no primeiro carregamento.

**Testes e verificação**

- ⚠️ **Tela do painel não renderiza em jsdom sem desligar o fundo**: `AuroraBackdrop` e `Grainient`
  desenham em WebGL e o erro não aponta para nenhum dos dois. `vi.mock('@/management/ui')`
  devolvendo os dois como `() => null` resolve.
- ⚠️ **`locator.click()` e `.hover()` do Playwright não acionam `TooltipTrigger asChild` do Radix.**
  O que funciona é `element.click()` por `page.evaluate`. Já me fez procurar defeito onde não havia.
- ⚠️ **Animação de 300 ms não se verifica por captura de tela nem por `rAF`**: a captura chega sempre
  no estado final. O que funciona é ler o estilo computado ~80 ms depois do clique.
- ⚠️ **No Tailwind 4, `translate-x-*` usa a propriedade CSS `translate`, e não `transform`**: ler
  `getComputedStyle(...).transform` devolve `none` e parece defeito.
- ⚠️ **Emular rede lenta pelo CDP travou a página duas vezes.** Para ver um estado que passa rápido,
  o caminho que funcionou foi um `MutationObserver` guardando a primeira ocorrência.
- ⚠️ **Contar `requestAnimationFrame` não serve** para verificar degradação de animação: o navegador
  sem compositor entrega ~1 quadro por segundo de qualquer jeito. Medir o efeito observável.
- ⚠️ **Como medir contraste aqui:** `getComputedStyle` não serve para o fundo. O caminho é o CDP
  (`CSS.getBackgroundColors`) e converter pintando fundo e tinta num canvas 1x1, que resolve `oklab`
  e alfa de uma vez.
- ⚠️ **Julgar inclinação de mapa por imagem é erro**: o container escreve `data-pitch` e
  `data-bearing` no DOM justamente para não repetir.
- `npm run format:check` falha em `.claude/skills/**`, que é código de terceiros. **Não é regressão** e
  não deve ser "corrigido" com `format:write`.

**Modelos 3D (Blender e conversão)**

- ⚠️ **Apagar peça no Blender teleporta as filhas dela**, e o estrago aparece longe: reancorar cada
  uma no ancestral sobrevivente ANTES de apagar, preservando `matrix_world`.
- ⚠️ **`matrix_world.translation` não move objeto que tem pai**: a matriz é recalculada a partir do
  pai no próximo update.
- ⚠️ **Metade do modelo do 3D Warehouse vem com as faces viradas para dentro**, porque o SketchUp
  guarda componente espelhado com escala negativa. Sob luz de verdade aquele lado perde o sombreado.
  Inverter as faces das peças de determinante negativo, **uma vez por malha** (duas desfazem).
- ⚠️ **Conferir modelo 3D pelo Workbench mente, e por código sem GPU também.** O que serve para
  aparência é **EEVEE**; para conteúdo, ler o JSON do GLB direto.
- ⚠️ **Triângulo por malha armazenada não é triângulo desenhado**: o exportador reaproveita malha
  entre instâncias, e a contagem por malha acusou perda de 25% que não existia.
- ⚠️ **O 3D Warehouse exporta COLLADA que o COLLADA2GLTF não converte, e o erro é silencioso**: ele
  termina com sucesso e o GLB sai com 768 bytes. O jeito de perceber é o tamanho do arquivo.

**Coisas que não se desfazem**

- **Não** reintroduzir a foto do banner, a borda dos cards nem o vidro no tema claro.
- **Não** ligar `DARK_MODE_ENABLED` sem refazer as telas no escuro: a rampa continua inteira, mas
  nunca foi revisada contra o desenho novo.
- **Não** pintar a marca com filtro para adaptá-la ao fundo.
- **Não** montar gestão fora de `.management-theme`, nem devolver COR para dentro desse escopo.
- **Não** duplicar os mocks do operador: triagem e Liberações compartilham estado de propósito.
- **Não** recriar itens excluídos a pedido do usuário: `.env.example`, tabela de variáveis no README,
  PNGs antigos da marca, `src/features/<dominio>/`.
- **Não** subir TypeScript acima de `~6.0.3` enquanto o `typescript-eslint` exigir `<6.1.0`.
- **Não** reintroduzir `baseUrl` nem `ignoreDeprecations`: aliases usam caminhos relativos e são
  espelhados no Vite.
- Tratar `npm audit fix` em mudança e commit próprios.
- Em 16/08/2026, a pedido explícito do usuário, o histórico da `main` foi reescrito e o estado atual
  virou o commit inicial único. **A regra segue valendo: reescrita de histórico só com pedido
  explícito.**
