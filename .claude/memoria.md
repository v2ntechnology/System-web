# Memória do Projeto: RookHub

> Documento versionado e compartilhado pelo time. Guarda somente decisões, limites e armadilhas que
> não ficam claros lendo um arquivo isolado. O código é a fonte de verdade para detalhes de
> implementação e versões.

> **Como usar:** localize os títulos com `rg -n "^#{2,3} " .claude/memoria.md`, leia a seção ligada à
> tarefa e sempre `Gotchas`. Ao atualizar, registre apenas informação durável e não dedutível do
> código; não transforme este arquivo em diário de alterações.

**Índice:** Produto e escopo · Arquitetura e áreas do sistema · Entrada, sessão e perfis · Temas e
identidade visual · Mapas, cenas e voz · Segurança e ambiente · Telemetria MiX (o que importa para a
tela) · Documentação e próximos passos · Gotchas

---

## Produto e escopo

- **RookHub** é um SaaS de gestão inteligente de frotas para transportadoras: telemetria,
  rastreamento, viagens, veículos, motoristas, abastecimentos, manutenção, multas, checklists e
  inteligência operacional.
- Este repositório é o **frontend**. Desde 24/08/2026 ele fala com a API real do `Backend-web`
  (repositório irmão, Java 21 com Spring). O estado é **misto de propósito**: autenticação, frota,
  mapa, motoristas, segurança, assistente e notificações vêm do backend; o painel operacional,
  custos, manutenção e multas seguem simulados. O `.env` alterna os dois lados.
- ⚠️ **A tese do produto é ser integrador, e desde 30/08/2026 isso é regra de código.** Várias
  fontes externas desaguam aqui e **nenhuma é fonte de verdade sozinha**. O cadastro do fornecedor
  de telemetria é ponto de partida: quem responde quem é motorista, se está ativo e a que caminhão
  está ligado é o RookHub. Ver `Cadastro de motoristas` mais abaixo e a memória do `Backend-web`.
- Não criar cobrança nem provedor externo novo sem pedido explícito.
- As telas consomem contratos e hooks de `src/services`; mocks são uma implementação desses
  contratos e podem ser substituídos por HTTP sem reescrever as páginas. Foi o que permitiu ligar
  a API módulo a módulo.
- **O painel está no ar em `https://app.rookhub.com.br`** desde 02/09/2026, no Cloudflare Pages
  ligado ao repositório na `main`: push dispara build. Ele fala com a API real em
  `https://api.rookhub.com.br`. Detalhe em `../Backend-web/docs/INFRAESTRUTURA.md`.
- O produto está dividido em **quatro** projetos irmãos, sem compartilhamento automático de
  código:

  | Projeto           | Responsabilidade                 | Repositório                     |
  | ----------------- | -------------------------------- | ------------------------------- |
  | `System-web`      | esta aplicação React/Vite        | `v2ntechnology/System-web`      |
  | `System-mobile`   | monorepo com painel e app Expo   | `v2ntechnology/System-mobile`   |
  | `Backend-web`     | a API que serve os três clientes | `v2ntechnology/Backend-web`     |
  | `Website-rookhub` | site institucional Next.js       | `v2ntechnology/Website-rookhub` |

- O painel de gestão foi copiado de `System-mobile/apps/web` para `src/management`. A origem deve
  permanecer intacta até o usuário conferir e autorizar sua remoção; correções feitas aqui não são
  sincronizadas com ela.

## Arquitetura e áreas do sistema

- Existem **dois painéis intencionalmente diferentes** dentro deste projeto:

  | Área      | Público principal                | Convenções                                                                                   |
  | --------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
  | `/app`    | operação, manutenção e motorista | `src/pages`, shadcn/ui, estrutura rasa por categoria do menu                                 |
  | `/gestao` | proprietário e gestor            | `src/management`, organização por feature, exportações nomeadas, primitivos próprios e vidro |

  Cor e ícone **não** entram mais nessa divisão: desde 19/08/2026 a paleta é uma só
  (`src/styles/palette.css`) e os ícones também (`src/components/icons.ts`).

- ⚠️ O painel de gestão tem **um** limite de `Suspense`, no `ManagementLayout`, em volta do
  `Outlet`: e nenhum por rota. Um limite por rota é criado do zero a cada navegação, e limite novo
  pinta o fallback na hora: a tela inteira sumia e voltava a cada troca de tela, o que o usuário
  descreveu como "fica um momento branco". Com um limite só, o React segura a tela anterior até a
  próxima estar pronta. Não devolver `Suspense` para dentro de `routes.tsx`.

- `SUPER_ADMIN` mantém a administração SaaS em `/admin-saas` e pode demonstrar áreas internas. Não
  misturar a administração da plataforma com o trabalho de uma transportadora.
- O painel de gestão preserva a arquitetura de origem: `management/ui`, `components`, `features`,
  `mocks`, `styles` e `types`. Não o achatar nem trocar seus primitivos pelos do painel operacional
  sem uma decisão explícita de unificação.
- A sessão do System-web é a única fonte de identidade. `management/features/auth/store.ts` apenas
  projeta essa sessão no formato esperado pelas telas portadas e traduz módulos do plano; não criar
  um segundo store de autenticação.
- A rotina de pátio (`/app/lancamentos` e `/app/triagem`) usa o visual operacional, porém seus dados
  ficam deliberadamente em `management/mocks/operator.ts`: ao escalar um checklist, ele entra na
  fila de Liberações do gestor. `services/operator.ts` é a fronteira; duplicar o mock quebraria esse
  fluxo entre painéis.
- Arrays grandes ficam em mocks, nunca em componentes. No painel operacional, tabelas reutilizam
  `components/shared/DataTable`; no painel de gestão, usam os primitivos próprios de `management/ui`.

### O backoffice `/admin-saas` foi refeito sobre o plano de onboarding (11/09/2026)

O desenho segue `docs/ONBOARDING_TRANSPORTADORAS.md`, que é **proposta e não implementação**: nada
disso existe no `Backend-web`. Estas telas são layout com dado simulado, a pedido do usuário.

- As telas são nove: `saas-overview-page` (era `saas-dashboard-page`), `saas-requests-page`,
  `saas-tenants-page` + detalhe, `saas-plans-page`, `saas-subscriptions-page`,
  `saas-telemetry-page`, `saas-team-page` e `saas-audit-page`. Saíram `saas-users-page` e
  `saas-integrations-page`: a primeira listava usuário de cliente, que é assunto do Dono e não
  nosso, e a segunda virou a de telemetria. As duas rotas antigas (`usuarios`, `integracoes`)
  continuam no router como redirecionamento, para não quebrar link salvo.
- ⚠️ **`stores/saas-store.ts` existe porque a fila e a lista de empresas são o mesmo dado em dois
  momentos da vida.** Com os mocks lidos direto do módulo, aprovar uma solicitação não mudava nada
  na tela e o fluxo central do onboarding ficava impossível de conferir. O store é mutável em
  memória e some no F5, de propósito: quando a API existir ele vira a camada de query/mutation e
  nenhuma tela muda.
- ⚠️ **Aprovar não é um botão, é um formulário de quatro passos** (`approval-wizard.tsx`): dados e
  endereço, telemetria, marca, plano. O ambiente só é utilizável com os quatro resolvidos, e um
  botão único deixaria alguém aprovar para descobrir depois que faltava escolher o fornecedor.
- ⚠️ **O slug é subdomínio E nome do schema**, então a validação mora em `app/tenant-slug.ts` e não
  dentro da tela: o backend precisará da mesma regra, palavra por palavra. Lá estão o formato, os
  doze slugs reservados (`app` é o mais importante, é a porta do Super Admin) e a sugestão a partir
  da razão social.
- **Telemetria pendente é `warning`, nunca `destructive`** (`lib/status-maps.ts`). O ambiente é
  liberado sem coleta de propósito, porque só a MiX tem conector: pintar de vermelho faria a tela
  mentir sobre a gravidade. `PENDING_CONTRACT` é `muted`, que é o cliente que nem contratou
  rastreamento.
- A auditoria tem duas abas porque o acesso de suporte (TI Operacional lendo dados de cliente por
  cabeçalho) é a exceção deliberada à regra de tenancy. Misturá-lo com "fulano aprovou uma
  solicitação" esconderia justamente o que precisa ser conferível.
- Entra-se com `superadmin@rookhub.com.br` e a senha das contas de demonstração, com
  `VITE_ENABLE_MOCKS=true`. Ver `Entrada, sessão e perfis` para o porquê de a conta ter voltado.

## Entrada, sessão e perfis

- ⚠️ **A caixa do sino cortava a lista no DADO, não na altura** (corrigido em 04/09/2026). Os
  dois componentes faziam `slice(0, 4)`: o da gestão
  (`management/features/notifications/components/notifications-bell.tsx`) e o do operacional
  (`components/layout/notification-menu.tsx`). Com 17 não lidas, treze não tinham como aparecer,
  e a rolagem não tinha o que rolar. O operacional até já tinha `max-h-80 overflow-y-auto`, mas
  com quatro itens fixos ela nunca chegava a ativar. Hoje os dois trazem até 12 e a área rola.
- A caixa da gestão corta a altura em `max-h-[21rem]`, pouco mais de quatro itens, de propósito:
  sempre sobra meia linha à mostra, e é isso que avisa que há mais abaixo. A barra continua
  invisível, como em todo o sistema.
- ⚠️ **A rolagem da caixa vazava para a página** (corrigido em 05/09/2026, relatado pelo usuário).
  Chegando ao fim da lista, insistir na roda rolava a tela atrás da caixa aberta. A correção é
  `overscroll-contain` no container que rola, nos **dois** componentes. Medido com a caixa no fim
  da lista e 2000px de roda: sem a classe a página andava 810px, com ela fica em zero. Vale para os
  quatro perfis, porque OWNER, MANAGER, OPERATOR e MAINTENANCE usam o mesmo `AppTopbar`.
- **"Ver todas as notificações" é só o nome** (decisão do usuário em 05/09/2026, que substitui a
  pastilha preenchida de 27/08). Sem fundo, sem seta e sem sublinhado: o hover é só a cor da
  palavra, em `primary-on-light`, que é o único laranja da paleta que muda de valor com o tema e
  por isso passa nos dois (5,00:1 sobre `surface-low` no escuro, 5,91:1 no claro). A caixa tem uma
  ação só e ela não precisa de peso para ser encontrada. ⚠️
  A armadilha de contraste de 27/08 continua valendo e é o motivo de a tinta ser `text-on-surface`:
  o conteúdo é portalizado para fora de `.management-theme`, onde `text-secondary` vira o cinza de
  controle do operacional (lê como desabilitado), e `text-primary-strong` como texto sobre
  superfície escura fica abaixo de 4,5:1.

- `/` é o login; `/login` só redireciona links antigos. O login, a recuperação e o convite vivem no
  mesmo módulo (`pages/login/login-page.tsx`) e usam o visual de `.management-theme`.
- ⚠️ **Login, hub e assistente de voz cabem na janela inteira, sem rolagem vertical** (decisão do
  usuário em 04/09/2026). As três usam a classe `.tela-proporcional` (`styles/globals.css`), que
  aplica `zoom` calculado pela altura: `clamp(0.5, tan(atan2(100dvh, 1080px)), 1)`. Em 1080px de
  altura o zoom é 1 e a tela fica idêntica ao desenho aprovado; abaixo disso **tudo encolhe na
  mesma proporção**, inclusive os componentes compartilhados de altura fixa (campo `h-11`, botão
  `h-13`), que não dá para escalar um a um sem mexer no sistema inteiro.
- ⚠️ **Medir cada peça em `vh` foi tentado antes e não serve.** Cada elemento parava no próprio
  piso do `clamp`, então em janela baixa a logo minguava enquanto os campos seguiam grandes. O
  `zoom` resolve porque é um fator único para tudo. `tan(atan2(a, b))` é como se obtém número
  adimensional de dois comprimentos: `calc()` não divide comprimento por comprimento.
- ⚠️ **Dentro de `zoom`, `dvh` chega reduzido.** Por isso a classe usa
  `height: calc(100dvh / var(--escala-tela))`: com `100dvh` puro a tela ocuparia só a fração
  zoomada da janela e sobraria faixa vazia embaixo.
- ⚠️ **Login, hub e assistente de voz cabem na janela, sem rolagem vertical** (decisão do usuário
  em 04/09/2026). As medidas verticais das três telas são `clamp(piso, Nvh, teto)`: o teto
  reproduz exatamente o desenho aprovado em 1080px de altura, e o piso impede que encolha até
  ficar ilegível. Em janela mais baixa tudo diminui junto e a composição se mantém. Vale para
  espaçamento, tipografia, altura de card e de botão.
- ⚠️ **Decoração grande mede pelos dois eixos.** O globo do hub e a esfera da tela de voz mediam
  só por `vw` (`min(100vw,900px)` e `clamp(17rem,39vw,26rem)`): numa janela larga e baixa eles
  estouravam a altura e quebravam a perspectiva. Hoje usam `min(Nvw, Nvh)`, então encolhem junto
  com o resto. Não repor medida vertical fixa nessas três telas.
- O destino pós-login depende do perfil:
  - `OWNER`, `MANAGER` e `SUPER_ADMIN` entram em `/painel`, a hub protegida sem sidebar/topbar, e
    escolhem `/assistente` ou `/gestao`;
  - os demais perfis entram diretamente em `/app/dashboard`.
- `RoleAreaRoute` redireciona quem caiu na área errada para a porta do próprio perfil, em vez de
  deixá-lo num estado sem saída. O item “Painel” da navegação só aparece para `HUB_ROLES`.
- A volta para a hub existe nos dois painéis e só para `HUB_ROLES`: no operacional é o item “Painel”
  da sidebar; no `/gestao` é o item “Painel de escolha” **dentro do menu da conta**. O usuário pediu
  a porta de volta em 19/08/2026, porque dono e gestor ficavam presos no painel depois de escolher a
  gestão, e no mesmo dia pediu que ela saísse da barra e ficasse só no menu do avatar.
- Papéis canônicos: `OWNER`, `MANAGER`, `OPERATOR`, `MAINTENANCE`, `SUPER_ADMIN` e `DRIVER`. Não
  reintroduzir os nomes antigos `TENANT_ADMIN`, `FLEET_MANAGER`, `MAINTENANCE_MANAGER` ou `VIEWER`.
- ⚠️ **`SUPER_ADMIN` voltou ao login em 11/09/2026, a pedido do usuário** (`superadmin@rookhub.com.br`,
  mesma senha das demais). A regra anterior mandava alcançá-lo só pelo menu de demonstração, e esse
  caminho **não existia mais**: o seletor de perfil vive na topbar do `/app`, `canUseDemoControls` o
  esconde de operador e manutenção, e o `RoleAreaRoute` manda dono e gestor de volta ao `/painel`
  antes de chegarem lá. Sobrava um nó: era preciso já ser super admin para ver o menu que tornaria
  alguém super admin, e o `/admin-saas` ficou inalcançável por meses. Consertar o seletor foi
  oferecido e o usuário preferiu a conta.
- ⚠️ **O `SUPER_ADMIN` cai no `/admin-saas/dashboard`, e não na hub** (`landingForRole`, 11/09/2026).
  A hub escolhe entre a IA e a gestão de UMA transportadora, e nenhuma das duas é o trabalho dele.
  Ele segue em `HUB_ROLES` e em `usesManagementPanel`, então alcança `/painel` e `/gestao` pelo menu
  quando precisa demonstrar as áreas internas.
- **A autenticação é real desde 24/08/2026** (`services/auth.ts`): access token só na memória, com
  1 hora de validade, e refresh em cookie `HttpOnly` com `Path=/v1/auth`, que nunca aparece no corpo
  de resposta nenhuma. A sessão sobrevive ao recarregar.
- ⚠️ **O refresh rotaciona a cada uso**, e isso tem duas consequências que já custaram depuração:
  no StrictMode, dois efeitos simultâneos fariam o primeiro invalidar o cookie que o segundo ainda
  usava, deslogando justamente ao recarregar (o store guarda a promessa e serve a mesma); e as
  guardas precisam segurar em `restoring` enquanto o refresh não responde, senão a tela vai para o
  login e volta um instante depois.
- ⚠️ **Cookie entre origens exige `credentials: 'include'` no fetch e `allowCredentials` no
  backend.** Nesse modo o curinga `*` em CORS é recusado pelo navegador: a origem tem de ser
  explícita. Sem isso a sessão morre a cada recarregamento.
- Com `VITE_ENABLE_MOCKS=true` a autenticação volta a ser simulada: o e-mail define o perfil,
  nenhum token é criado e a sessão não persiste. As contas do modo simulado (`@rookhub.com.br`) e
  as do backend em perfil `dev` (`@teste.com`) são **conjuntos diferentes**, com senhas diferentes.
- `DemoMenu` alterna perfil/plano somente para demonstração e não representa produção.
- `AuthUser.operatorSeesFinancials` controla a exposição de valores consolidados ao operador. Ao
  trocar o perfil no modo demonstração, trocar a identidade completa, não apenas o campo `role`.
- Guardas de perfil, permissão e plano são **UX**, não segurança. O `Backend-web` já existe e é
  quem tem de revalidar autorização e entitlement em **todas** as operações. Vale especialmente
  para o assistente de IA: não adianta a tela esconder o custo consolidado do operador se o
  contexto enviado ao modelo trouxer o número. `operatorSeesFinancials` precisa valer nos dois.

## Temas e identidade visual

### O desenho atual

O usuário recusou o desenho anterior e fixou a direção com três referências de
painel. Decisões confirmadas por ele antes do trabalho começar: **indigo da marca
como cor de destaque** (e não o coral das referências, para o painel continuar
casando com o logo e o site), **densidade equilibrada** (respiro grande nos
resumos, densidade atual em tabela e lista) e **redesign tela por tela nos dois
painéis**.

- ⚠️ **O tema escuro está desligado.** `DARK_MODE_ENABLED = false` em
  `stores/theme-store.ts`. A rampa escura continua inteira em `palette.css` e
  volta trocando a constante; **não apagar**. Os três seletores de tema
  (`components/layout/theme-toggle.tsx`, `management/features/appearance/`,
  `pages/administration/settings-page.tsx`) mostram a lua desabilitada com
  `aria-disabled` e a dica "Tema escuro em breve". São três: mexeu num, mexa nos
  outros dois.
- ⚠️ **Rotas sem casca ficam claras para sempre**, mesmo quando o escuro voltar:
  login, esqueci minha senha, convite, sessão expirada, 404 e as duas do hub. O
  mecanismo é o `ThemeLock` aplicado no `router.tsx` pela função `lockLight`, e
  é de **rota**, não de componente.
- ⚠️ **A foto do caminhão saiu do `PageBanner`**, revertendo a decisão de
  19/08/2026. Sai junto tudo que existia por causa dela: a faixa `bg-brand-night`,
  o gradiente preto, a `drop-shadow` do título, o degrau `rounded-t-4xl`, o
  `-mt-12` do `PageContent`, o `-mt-14` do `PageTabs` e todo o uso de `on-media`
  no menu, na topbar e no sino. O motivo é de ferramenta: 440px de foto em toda
  tela, inclusive nas que são uma tabela de 150 linhas.
- ⚠️ **O `eyebrow` do `PageBanner` não renderiza mais nada.** A prop continua
  aceita para não quebrar 25 telas de uma vez. Rótulo acima de título é proibido
  no piso de qualidade do projeto: o título carrega o próprio peso.
- **A pastilha do item ativo é TERRACOTA** (`bg-primary-strong text-on-primary`) desde
  08/09/2026, no menu superior da gestão E na lateral do operacional. É o que faz as
  duas cascas lerem como um sistema só. Era preta (`bg-bright`) desde 30/08/2026; ver
  a entrada de 08/09 mais abaixo para o que mudou e o que continua preto.
- **A hierarquia é de superfície, não de linha.** Papel morno `#F4F2EF` no
  fundo, branco no card, papel mais fechado no poço. Card não tem borda: tem
  raio grande e sombra com deslocamento e desfoque. `--color-light-edge` virou
  transparente também no claro, e o `border` saiu do `ui/card.tsx`.
- ⚠️ **O vidro morreu no claro.** `--glass-blur: 0px` e traço transparente: o
  `.glass` é placa branca sólida. Antes ele era branco a 86% com borda, ou seja,
  o mesmo objeto que o `LightCard`, com `backdrop-filter` custando GPU para não
  produzir efeito visível.
- ⚠️ **`.metric-tile` substituiu `bg-surface-lowest min-w-0 rounded-lg p-4`**, que
  estava copiado em 16 telas. `surface-lowest` é o token do **poço**, mais escuro
  que o papel: todo indicador da aplicação aparecia afundado no fundo. A classe
  fica em `management/styles/glass.css`. Campo de entrada continua no poço, que é
  o `.glass-well`.
- **Título de `LightCard` deixou de ser indigo.** Em tinta dá 16.8:1 contra 3.7:1
  e devolve o indigo para quem precisa dele.
- ⚠️ **A marca troca de arquivo, e nunca é pintada por filtro.**
  `components/shared/brand-assets.ts` é o mapa único dos dois painéis, e é a
  mesma regra do `components/icons.ts`: um conceito, um desenho, nos quatro
  perfis. O painel de gestão pintava a arte branca de preto com
  `light:brightness-0`, o que resolvia o "Rook" (branco chapado) e **matava a
  torre**, que é gradiente indigo: a marca saía toda preta no papel. O `tone`
  do `RookhubLogo` continua existindo: `media` é sempre a arte branca (sobre
  fotografia e sobre o painel indigo do login), `adaptive` acompanha o tema.
- ⚠️ **O sufixo do arquivo é a cor da arte, não o nome do tema.** `-white` vai
  sobre fundo escuro, `-dark` vai sobre papel. Ler ao contrário inverte os dois,
  e o erro não aparece em revisão de código: só na tela, como um logo sumido.
- **As artes do robô saíram em 30/08/2026**, a pedido do usuário
  (`logo-robot-dark.svg` e `logo-robot-white.svg`). O `RobotMark` que as usava
  estava definido e nunca importado. O mascote do assistente continua vivo: é o
  `logoOfficialBranca.svg` do `@imgs/`, usado pelo `AiLauncher` e pelo
  `AssistantFab` sobre o botão indigo.
- **Raio**: 20px no container, 14px no elemento interno, 28px no bloco grande,
  nos dois painéis (`.management-theme` e o `--radius` do `globals.css`).
- `PRODUCT.md` na raiz guarda a verdade de produto que orienta o design. Ele foi
  escrito no redesign e não descreve visual: visual mora aqui.

### Paleta única

- Decisão do usuário: os dois painéis passaram a ter a **mesma identidade** em claro e escuro. A
  fonte única é `src/styles/palette.css`. O `@theme` de lá declara a rampa **escura** (padrão do
  produto) e o bloco `html.light`, fora de camada, redefine as mesmas variáveis com a rampa clara.
  `html.light` tem especificidade maior que o `:root` do `@theme`, então vence sem depender da ordem
  dos arquivos.
- Âncoras: grafite `#212121` no escuro (o azul-noite `#0B1220` do painel operacional foi aposentado
  porque puxava a tela para o roxo), papel `#F2F2F3` no claro, **terracota `#D5623A` como primária**
  e **marinho `#010066` como secundária**.
- ⚠️ **A secundária virou marinho em 08/09/2026**, decisão do usuário, no lugar do cyan `#06B6D4`.
  A referência dada foi o site do Itaú, que também é laranja: o azul escuro serve link, detalhe e
  parte dos botões, enquanto o laranja fica sendo a ação preenchida.
- ⚠️ **Trocar o token da secundária quase não muda a tela, e a primeira tentativa não mudou nada.**
  O usuário reiniciou o front e não viu diferença, com razão. O `--accent` só é consumido em sete
  lugares do `/hub` (o cartão da Gestão), num ícone da ficha do veículo, na série 2 dos gráficos e
  na voz. E as duas variantes `link` (`Button` e `SpectrumButton`) e a `secondary` do
  `SpectrumButton` **não têm nenhum uso no código**: mexer nelas é mexer em código morto.
- ⚠️ **Link no RookHub não é `variant="link"`: é `<Link>` ou `<a>` com a classe escrita à mão.**
  São dez, e usavam a cor da primária: `text-primary` no painel operacional (`activity-feed`,
  `recent-alerts`, `administration/settings-page`, `saas-dashboard-page`) e `text-primary-on-light`
  no painel de gestão (`insights-card`, `extension-detail-panel`, `person-card` em dois pontos,
  `blocker-row`, `billing-page`). Todos passaram a `text-accent` em 08/09/2026. Quem trocar cor de
  link de novo tem de varrer por `hover:underline`, e não pelas variantes.
- ⚠️ E ao varrer por `hover:underline`, **não** trocar `text-primary-on-light` em bloco no arquivo:
  a mesma classe veste ícone que não é link (o `BillingIcon` da forma de pagamento) e o
  `focus-visible:ring-primary-on-light`, que continua terracota porque foco segue a primária.
- ⚠️ **A secundária TROCA de valor entre os temas, e a primária não.** É a diferença que mais
  confunde na paleta hoje. O `#010066` dá 15,6:1 sobre o papel e **1,07:1 sobre o grafite**, onde
  desaparece: a rampa escura carrega a versão clara da mesma matiz, `#A0A6FF` (7,2:1). A terracota
  tem luminância média e por isso é o mesmo hex nos dois. Quem depender da secundária num contexto
  que não acompanha o tema (3D, MapLibre, halo decorativo) precisa do azul médio, nunca do `#010066`.
- ⚠️ **O botão sem preenchimento do painel de gestão virou contorno marinho** em 08/09/2026, a
  pedido do usuário: o `ghost` do `SpectrumButton` (26 usos) deixou de ser traço cinza com véu e
  passou a `border-accent/60 bg-transparent text-accent`. O `/60` não é estética: a 40% a linha dá
  2,7:1 sobre o papel e fica abaixo do mínimo de 3:1 de contorno de componente; a 60% dá 5,2:1.
- ⚠️ **A hierarquia de botão do painel ficou em três degraus**, e é o desenho pedido: preenchido
  terracota (`primary`) para a ação principal, contorno marinho (`ghost`) para a secundária, e
  `bright` para a ação das telas de acesso. A variante `secondary` (marinho preenchido) existe e
  resolve para a cor certa, mas segue sem nenhum uso.
- ⚠️ **UM ÚNICO LARANJA desde 08/09/2026, a pedido do usuário: só o #D5623A.** A escala de
  terracota foi **colapsada na paleta**, e não nos componentes: `--color-primary-strong`,
  `--color-primary-on-light` (nos dois temas), `--color-primary-container`, `--color-primary-bright`
  e `--color-chart-1` (nos dois temas) apontam todos para `#d5623a`. Os nomes de token continuam
  existindo porque são a API que a interface inteira consome. **Devolver a escala é reeditar só
  `palette.css`**: não saia trocando classe em componente.
- ⚠️ **O laranja único custa AA, e o usuário foi avisado.** O #D5623A dá 3,9:1 com branco. Reprovam
  hoje: os 42 botões preenchidos, a pastilha da navegação da gestão, o visto do checkbox (4,32:1
  contra o branco do visto) e todo texto de marca sobre o papel, que antes era `on-light` a 5,9:1.
  Os degraus `strong` (5,04:1) e `on-light` (5,9:1) existiam exatamente para isso.
- ⚠️ **Junto foram os laranjas decorativos que não eram token**, e é o de sempre: grep de hex não
  acha. `--glow-indigo` (`rgba(190,90,53)`), a deriva do `aurora-backdrop` (`rgba(219,82,61)`), o
  `rimColor` do `globe`, o `COLOR_FRONT` da `voice-sphere`, o `color3` do `login-page`, o
  `gradientColors` do `blinds-backdrop` e a cor da parada do `stops-map` (`#e08a63`).
- ⚠️ **Dois efeitos ficaram CHAPADOS de propósito, e isso não é bug.** O `bg-brand-gradient` vai de
  `primary` a `primary-bright`, que agora são a mesma cor. E o `time-vortex` da sessão expirada teve
  a faixa de matiz colapsada: `HUE_AMBAR` recebeu o valor de `HUE_TERRACOTA`. Os dois nomes ficam,
  e devolver o âmbar num deles devolve o degradê.
- ⚠️ **Com um laranja só, TODA pastilha sobre a faixa some.** Foi o caso do `HeroPill` e, na época,
  do seletor de período de `/gestao/viagens`, que marcava o escolhido com `primary-strong` sobre a
  faixa `primary`: os dois viraram a mesma cor. A regra geral do painel: **sobre a faixa, o destaque
  é branco** (traço ou preenchimento), nunca um segundo laranja. Vale hoje para o `HeroPill`, o
  `HeroLink` e o chip de frescor do mapa ao vivo. (O seletor de viagens saiu da faixa depois; ver a
  entrada abaixo.)
- ⚠️ **A pastilha do `HeroBand` virou traço branco** (referência do Itaú trazida pelo usuário em
  08/09/2026): `HeroPill` e `HeroLink` eram `primary-strong` sobre a faixa `primary`, dois laranjas
  diferentes. Com um laranja só a pastilha sumiria dentro da faixa, então quem separa passou a ser
  a linha branca (`border-on-primary`), com o hover invertendo para fundo branco e texto laranja.
- ⚠️ **`--spectrum-gradient` continua com sete paradas quentes e NÃO foi colapsado**: `.spectrum-text`
  e `.spectrum-bg` não têm nenhum uso em componente, então ele não pinta nada na tela hoje.
- ⚠️ **O foco continuou terracota na troca de 08/09/2026, de propósito.** Chegou a ser cogitado
  passá-lo ao marinho, e foi descartado com o usuário: são 135 `ring-primary` em cerca de 60
  arquivos, e mudar o token sem mudar os utilitários recriaria exatamente o bug relatado em
  05/09/2026 (campos numa cor, botões noutra). Foco é estado, e estado segue a marca primária.
- ⚠️ **A troca do cyan também não foi pega por grep de hex.** Além dos `#06B6D4`, sobraram o
  `#22d3ee` da linha de rota do `operation-map` (a camada de halo e a de cima são cores
  diferentes: mexeu numa, confira a outra), o `rgba(6,182,212,0.24)` do `aurora-backdrop` e o
  `--glow-cyan` do `theme.css`, que virou `--glow-accent`. Vale a mesma receita da troca da
  primária: varrer por matiz, e não por literal.
- ⚠️ **`--glow-indigo` no `theme.css` já é terracota**, e `StatTile` / `fleet-state-cards` /
  `management/types.ts` ainda expõem `accent: 'indigo' | 'cyan'`. Os nomes mentem desde 04/09/2026
  e continuam mentindo: a cor renderizada está certa porque `cyan` resolve para `--secondary`.
  Renomear a API é dívida conhecida, deixada de fora por não ter sido pedida.
- ⚠️ **A primária virou terracota em 04/09/2026**, decisão do usuário, no lugar do indigo `#6366F1`.
  Os derivados acompanharam, preservando a propriedade de contraste que cada um documentava:
  `--color-primary-strong` `#5457EE` → **`#B35231`** (5,04:1 com branco, era 5,28:1),
  `--color-primary-on-light` `#4338CA` → **`#A24A2C`** no claro e `#A5B4FC` → **`#DB7A58`** no
  escuro, `--color-primary-container` `#3730A3` → **`#6F301D`** (mesma luminância).
- ⚠️ **O anel de foco também ficou para trás na troca de paleta, e não é hex nem matiz: é token.**
  Relatado pelo usuário em 05/09/2026 na tela de login, onde a caixa "Manter conectado" e o botão
  "Entrar" acendiam cyan enquanto os campos ao lado acendiam terracota. A causa era `secondary` no
  papel de cor de foco: `focus-visible:ring-secondary` em 46 lugares de `src/management/`, mais o
  `outline: 2px solid var(--secondary)` do `.management-theme :focus-visible` no `theme.css`, que é
  o piso de quem não desenha o próprio foco. Os campos escapavam porque o `FIELD_SURFACES` já usava
  `primary`. Tudo passou a `primary` (#D5623A, 4,35:1 sobre o grafite e 3,31:1 sobre o papel, acima
  do 3:1 que contorno pede), por decisão do usuário: vale na aplicação inteira, e não só no login.
  Junto foram as três bordas de foco em cyan (`focus:border-secondary` do painel do assistente,
  `focus-within:border-secondary` das buscas de motorista e de frota).
- ⚠️ **Anel de foco é `ring-primary`, e não `ring-secondary`.** O cyan continua sendo a secundária
  semântica, mas foco não é semântica: é estado, e estado segue a marca. Em portal vale o
  `PORTAL_FOCUS_RING`, porque `primary` fora de `.management-theme` é outro token.
- ⚠️ **Grep de hex não acha tudo numa troca de paleta.** Depois de trocar os `#6366F1`, sobraram dez
  ocorrências em `rgb()`/`rgba()` e em hex fora da lista: o `--glow-indigo` do `theme.css`, os três
  gradientes do `aurora-backdrop`, o `#5227FF` de `gradient-blinds` e `grainient`, e o `#8385F4` do
  `login-page`. O que funcionou foi varrer **por matiz**, calculando o hue de cada cor e listando o
  que caía na faixa 225-290 com saturação alta.
- ⚠️ **O Spectrum Gradient precisou ser refeito inteiro, não remendado.** Trocar só o indigo dele
  deixava a rampa magenta → roxo → **laranja** → azul → cyan, que não lê como gradiente. Os sete
  stops foram remapeados para família quente, preservando a luminância de cada parada e, com ela, o
  vale de contraste no meio da rampa.
- A secundária saiu dos usos **decorativos** em 04/09/2026: gradiente de marca, dígitos do 404,
  halos, órbita e onda da voz. Ela segue no que é semântico, como cor de gráfico, status
  `EM_VIAGEM` e rota no mapa. ⚠️ `info` é outro token e continua azul-céu: não é a secundária, e
  `fleet-state-cards` usa `info-on-light` no accent que ele chama de `cyan`.
- ⚠️ **Os estados da voz inverteram, e o significado é esse:** a IA **falando** é a única coisa em
  azul (`--color-accent`), justamente para se distinguir; escutando e em repouso são laranja.
  Vale nos três lugares que desenham voz: `.voice-orbit--*` e `.voice-waveform--*` no `globals.css`
  e as constantes `COLOR_FRONT_*` do `voice-sphere.tsx`. Mexeu em um, confira os outros.
- ⚠️ **`--color-primary-bright` (`#E7AD61`) existe para o gradiente não terminar na secundária.** Todo
  gradiente de marca ia de `--color-primary` a `--color-accent`, e com a primária quente isso
  virava laranja para azul. É decorativo: **não carrega texto** (1,9:1 com branco).
- A marca em `public/logo/` seguiu a nomenclatura do `Website-rookhub` em 04/09/2026: três peças
  (`rookhub-full-*`, `rookhub-symbol-*`, `rookhub-wordmark-*`) no par `-dark` (fundo claro) e
  `-white` (fundo escuro). Os arquivos são os mesmos dos dois projetos, e `brand-assets.ts` mantém
  as chaves antigas (`wordmark`, `mark`, `text`) porque são a API que o código consome.
- `globals.css` **não** tem mais par `:root`/`.dark` de cor: um bloco só aponta os tokens da família
  shadcn (`--background`, `--card`…) para os `--color-*` da rampa. Redeclarar cor por tema ali é o
  que fazia os painéis divergirem.
- `--color-fill` e `--color-fill-subtle` existem porque as rampas invertem: o botão neutro é mais
  claro que o fundo no escuro e mais escuro no claro. Idem `--color-surface-high`, que no claro é
  cinza (`#E4E4E7`), não branco, porque na prática é trilho de barra e fundo de avatar.
- `--color-on-media` / `--color-on-media-variant` não acompanham o tema: são para texto sobre
  fotografia. O `PageBanner` é escuro nos dois temas (`bg-brand-night` + véu preto), porque a
  navegação branca mora dentro dele.
- `--color-bright` / `--color-on-bright` **invertem** com o tema (pill claro no escuro, grafite no
  claro). É a ação principal das telas de acesso; fixá-lo no branco sumia no tema claro.
- Único dono do tema é `useThemeStore` (`src/stores`). O menu Aparência do painel de gestão usa essa
  store; o `appearance/store.ts` de lá ficou só com o modo alto desempenho.
- **`LightCard` acompanha o tema** desde 19/08/2026, a pedido do usuário: o painel branco sobre o
  grafite virava um bloco claro no meio da tela escura. Os tokens `--color-light*`, `*-on-light` e
  `--color-chart-*` têm par escuro/claro em `palette.css`. O nome `light` ficou por herança do Figma.
- **Ícones**: `src/components/icons.ts` é a fonte única, Lucide via `react-icons/lu`. `lucide-react`
  e `@phosphor-icons/react` foram desinstalados em 19/08/2026. Ao migrar, `weight` e `mirrored`
  (props do Phosphor) não existem no react-icons; para tipar prop de ícone use `IconType`.
- **Rodapé do menu da conta** (decisão do usuário em 19/08/2026, vale nos quatro perfis): seletor de
  tema à esquerda, sair à direita, os dois sem rótulo de texto. O seletor tem sol e lua num trilho e
  o realce **desliza** para a opção clicada; não é um item que alterna. São dois componentes gêmeos,
  um por design system: `components/layout/theme-toggle.tsx` e
  `management/features/appearance/components/theme-switch.tsx`.
- ⚠️ Nos dois seletores os botões são `tabIndex={-1}`, porque dentro de menu o foco é das setas do
  Radix e Tab fecharia tudo. O caminho de teclado é o `DropdownMenu.Item` que embrulha o seletor:
  ele carrega o `aria-label` com o estado, e o `onSelect` alterna o tema com `preventDefault` para o
  menu não fechar. Trocar isso por um `div` solto tira o controle do teclado.
- ⚠️ E os botões do seletor precisam de `stopPropagation` no clique: sem isso o clique escolhe o
  tema e em seguida sobe até o `onSelect` do item, que **alterna** de novo: as duas ações se
  cancelam e nada muda na tela. O `onMouseDown` com `preventDefault` existe pelo mesmo motivo, para
  o foco não ficar preso no botão e travar as setas do menu.
- A marca só existe em arte branca. `RookhubLogo` com `tone="adaptive"` aplica `brightness(0)` no
  tema claro (variante `light:`, declarada em `globals.css` ao lado de `dark:`).

### Painel operacional

- Tailwind 4 é CSS-first via `@tailwindcss/vite`; o tema vive em `src/styles/globals.css`.
- Fora de utilitários Tailwind, usar `var(--color-...)` e `color-mix(in oklch, ...)`.
- `theme-store.ts` aplica `theme-switching`, troca a classe do tema, força recálculo com
  `getComputedStyle` e só então restaura transições. Essa leitura evita a piscada durante a troca.
- **Campo de data é o `DatePicker` de `components/ui`, nunca `<input type="date">`** (decisão do
  usuário em 20/08/2026, mesma lógica do `Select` em 19/08): a caixa nativa é desenhada pelo sistema
  operacional, ignora a paleta e não deixa saltar de mês. Ele aceita as duas formas: digitar com
  máscara dd/mm/aaaa ou escolher no calendário (setas, select de mês e select de ano). O valor
  trafega em ISO (`yyyy-MM-dd`), que é o que `toEntryDraft` espera. Hoje os únicos campos de data do
  sistema são `at` e `dueDate` do `entry-spec.ts`; **o painel de gestão não tem nenhum** (o
  `PeriodPicker` é de presets). Quando tiver, criar o gêmeo em `management/ui` no contrato do
  `GlassInput`, e não importar este.
- O calendário tem **três profundidades** e nenhuma lista suspensa dentro dele (decisão do usuário
  em 20/08/2026, depois de os dois selects de mês e ano se mostrarem pouco intuitivos): o título
  abre a grade de meses, o título dela abre a grade de anos, e a escolha desce de volta. As setas
  laterais ficam e andam no passo da visão (mês, ano, bloco de 12 anos); o título **não** leva seta
  de abertura, para não ter três setas na mesma linha.
- ⚠️ No `DatePicker`, o texto digitado vive num rascunho `{ text, from }`: o `from` guarda o valor
  que estava valendo, e quando o valor de fora muda (envio, `reset`) o rascunho perde a validade
  sozinho. Isso existe para não usar `useEffect` de sincronização de prop, que é erro de lint aqui.
  A navegação por teclado do calendário é `aria-activedescendant` na grade, e não foco em 42 botões.
- ⚠️ Mês em pt-BR no cabeçalho pede `first-letter:uppercase` num `<span class="block">`:
  `capitalize` escreve "Agosto De 2026", e o pseudo-elemento não pega em container flex.
- **Operador e manutenção não veem "Modo demonstração" nem "Plano e cobrança"** (decisão do usuário
  em 20/08/2026). O primeiro passa por `canUseDemoControls` (`app/permissions.ts`), o segundo pela
  permissão `billing.manage`, que já governava a tela `/app/planos` no menu lateral. Efeito
  colateral a lembrar: entrando como operador, não há mais como voltar a outro perfil pelo menu; a
  troca se faz saindo e usando as contas de demonstração do login.
- **O conteúdo do `AppShell` não tem largura máxima** desde 20/08/2026, a pedido do usuário: o
  `max-w-[1600px]` deixava duas faixas vazias em monitor grande. Com a largura solta, tela nova
  precisa ganhar colunas por breakpoint (`xl:`/`2xl:`) em vez de esticar o campo: no formulário de
  lançamentos, duas colunas viravam campos de 700px para digitar "480,5". No painel de gestão o
  `max-w-[1600px]` **continua**, porque lá ele é a grade que alinha topbar, banner e conteúdo.

### Painel de gestão

- Toda tela de `src/management` e as telas de acesso precisam de um ancestral `.management-theme`.
  O que o escopo carrega hoje é **forma**: raio, vidro, Spectrum, cyan no papel de `--secondary`.
- Em `management/styles/theme.css`, tokens **novos**, que precisam gerar utilitários, ficam em
  `@theme`; o que é específico do painel é redefinido em `.management-theme`.
- O vidro tem versão clara em `html.light .management-theme`: branco quase opaco com traço preto.
  O véu branco a 5% do tema escuro é invisível sobre papel.
- `--radius-pill` precisa permanecer em `@theme`, ou `rounded-pill` deixa de ser gerado. As regras
  escopadas de `rounded-sm`/`rounded-md` corrigem os raios herdados de `@theme inline`.
- O display do painel é `font-sora`. `font-display` resolve para Space Grotesk no `:root` e não pode
  ser trocado por escopo.
- `::selection` e `:focus-visible` do painel ficam em `@layer base`; em CSS manual escopado, usar as
  variáveis-fonte (`--primary`, `--secondary`), pois tokens `--color-*` declarados em `@theme inline`
  podem chegar já resolvidos pelo tema operacional.
- `AiLauncher` e `AssistantFab` representam o mesmo atalho de IA: mantêm o botão quadrado índigo no
  mesmo canto e compartilham `hooks/use-bot-animation.ts`. Alterações visuais devem ser espelhadas.
  Os halos/sombras desses atalhos e da variante `bright` do `SpectrumButton` foram removidos por
  decisão do usuário; não repor sem pedido.
- ⚠️ **Em atributo de SVG e estilo inline, `var(--color-secondary)` e `var(--color-primary)` não
  existem**: os dois vêm do `@theme inline` do painel operacional, que grava o valor dentro do
  utilitário e **não emite a custom property**. O sintoma é gráfico da Recharts com linha e texto de
  tooltip em cinza-chumbo no escuro (foi o que aconteceu no custo por km em 19/08/2026). Usar
  `var(--secondary)` / `var(--primary)`, que existem de verdade e são cyan/indigo dentro do escopo.
- ⚠️ **Conteúdo em portal do Radix (`Portal` de select, menu, modal) monta no `body` e sai de
  `.management-theme`.** Lá dentro, `secondary` volta a ser o cinza de controle do painel
  operacional: um item de lista com `text-secondary` fica ilegível. Em portal, usar só tokens da
  paleta comum (`on-surface`, `surface-low`, `outline-variant`).
- `PageBanner`: **todas** as telas do painel têm a foto de capa (`@imgs/truck01.jpg`), por decisão do
  usuário em 19/08/2026; `image` só sobrescreve a capa. O cabeçalho `inline` tem a mesma altura,
  o mesmo véu e a mesma pilha de texto do `hero`, porque o combinado é uma organização só no painel
  inteiro. A diferença é o **degrau**: um bloco de 48px/64px com `rounded-t-4xl` e `bg-background`
  fechando a faixa, que imita a sobreposição do `PageContent`. As telas inline não podem usar um
  segundo `PageContent` porque ele é um `<main>`, e elas já têm um mais abaixo (o painel `bg-light`).
- `GlassSelect` é Radix, não `<select>` nativo (decisão do usuário em 19/08/2026, vale nos quatro
  painéis): a lista nativa é desenhada pelo sistema operacional e ignora a paleta. A seta gira no
  próprio eixo via `data-[state=open]:[&>svg]:rotate-180` **no gatilho**, que é quem tem
  `data-state`. O gêmeo no painel operacional é `components/ui/select.tsx`, com o mesmo giro.
- **Hover de botão colorido escurece a própria cor** (decisão do usuário em 20/08/2026, vale nos
  quatro perfis): `color-mix(in oklab, <cor> 86%, black)`. O Spectrum Gradient no hover do
  `SpectrumButton` primary foi removido, porque trocava o indigo por uma faixa rosa e cyan. Véu
  translúcido (`/90`) também não serve: no tema claro ele clareia em vez de escurecer.
- **Ação preenchida é `primary-strong` nos quatro perfis** (decisão do usuário em 20/08/2026): as
  variantes `default` e `brand` do `Button` operacional passaram a ter exatamente as classes do
  `primary` do `SpectrumButton`. O `variant="brand"` **perdeu o gradiente** (`bg-brand-gradient`),
  que fazia o botão do operador parecer de outra família ao lado do botão da gestão; a variante
  continua existindo só porque é usada em dezenas de telas. `bg-brand-gradient` segue em barra de
  progresso e nos selos de IA. Roxo preenchido com texto branco usa `primary-strong` + `on-primary`
  (o âncora `--primary` reprova AA com branco); translúcido (`bg-primary/10`) continua no âncora.
- Sino de notificações: **sem pastilha roxa** nos quatro perfis (decisão do usuário em 20/08/2026).
  Só o símbolo (22px) e o número. No painel de gestão ele fica sobre a foto do banner, então é
  `text-on-media` com hover `bg-white/10`, igual ao botão de menu ao lado; no operacional é o
  `Button` ghost de sempre. ⚠️ O sino do operacional precisa de `shrink-0`: a busca ao lado o
  espremia para 26px de largura, e o realce do hover saía oval em vez do círculo de 40px.
- Botão de sair do menu da conta: mesmo desenho nos dois painéis (`app-topbar` e `user-menu`),
  a pedido do usuário em 19/08/2026. Quadrado de 36px com canto de 10px, ícone de 18px, e no hover
  aparece **só o anel** vermelho a 60%, sem preencher o fundo (o preenchimento a 20% do painel
  operacional caiu em 20/08/2026). Mexeu num, espelhe no outro.
- ⚠️ No `DropdownMenuItem asChild` do painel operacional, o Radix Slot **concatena** as duas listas
  de classe em vez de passar pelo `tailwind-merge`: `rounded-sm` e `[&_svg]:size-4` da base venciam
  o `rounded-[10px]` e o ícone de 18px escritos no `<button>` filho. Classe que precisa vencer a
  base vai na prop `className` do item, que é a única que passa pelo `cn`.

### Cadastro de motoristas (`/gestao/motoristas/cadastro`)

Reescrita em **30/08/2026** a pedido do usuário. Deixou de ser um mostruário da bagunça que veio da
telemetria e virou lista de cadastro de verdade, no padrão das telas do outro sistema dele
(`Nação de Talentos/System-web`): tabela com coluna de Ações, atalho de ativar/inativar com
confirmação, e o mesmo diálogo servindo criação e edição.

- **A empresa substituiu a filial em toda a tela.** O seletor listava as 20 linhas de `fleet_sites`,
  com quatro "Default Site" e cinco "DESLIGADOS / INATIVOS" indistinguíveis. Agora são 5 empresas, e
  quem está em qualquer subgrupo de uma conta como sendo dela. A consolidação é do backend, em
  `fleet_companies` e `fleet_site_company`. `GET /v1/fleet/sites` manteve o caminho e trocou o
  conteúdo, porque o `System-mobile` consome a mesma rota.
- ⚠️ **O quadro "Como esta pessoa vai ficar" saiu do diálogo, e o `driver-id-card.tsx` continua no
  repositório de propósito.** O usuário pediu para tirar **por enquanto**. O cabeçalho do arquivo
  explica como devolvê-lo. Varredura de importação acusa como código morto: não apagar.
- O diálogo cria e edita com o mesmo formulário. O que muda é o depois: cadastrar mantém aberto e
  limpo para a próxima pessoa (o caso normal é em lote), editar fecha e devolve a lista.
- ⚠️ **`values` do react-hook-form, e não `useEffect` + `reset`.** Sincronizar dado externo com
  efeito é justamente o padrão que as regras do React Compiler recusam neste projeto.
  `resetOptions: { keepDirtyValues: true }` protege quem já está digitando.
- ⚠️ **`values: loaded` não compila com `exactOptionalPropertyTypes`.** Passar `undefined` explícito
  em campo opcional é erro de tipo. Espalhar: `...(loaded ? { values: loaded } : {})`.
- ⚠️ **Numa tabela de largura automática, `truncate` sozinho não encolhe coluna.** A coluna nunca
  fica menor que o texto mais longo dela, e o nome do motorista empurrava Status e Ações para fora
  da tela. O que resolve é `w-full max-w-0` no `<td>` do nome: `max-w-0` zera a largura mínima e
  `w-full` faz aquela coluna ficar com toda a sobra. As colunas de Empresa, CPF e Atividade levam
  `whitespace-nowrap`, senão "SERVIOESTE - RJ CAMPOS DOS GOYTACAZES" quebra em quatro linhas e cada
  linha da tabela passa de 65px para 100px.
- Ativar/inativar tem rota própria (`PATCH /v1/drivers/{id}/active`) e **não** grava conferência:
  ligar e desligar é operação do dia a dia, e congelar a sincronização por causa disso deixaria o
  cadastro velho para sempre. Salvar a ficha inteira é que congela.
- O chip "Conferido" e o filtro de conferência saem de `registry_updated_at`. É o placar do trabalho
  que a tela existe para fazer: 150 pessoas importadas, 0 conferidas no começo.

### Os diálogos de cadastro são etapas

Decisão do usuário. Trinta campos numa coluna só obrigam a rolar três telas antes de saber o que
falta. As cinco seções viraram etapas, com barra fixa no topo do diálogo e o botão principal
mudando de "Próximo" para "Cadastrar" na última.

- `WizardSteps` em `management/ui` serve os dois. Recebe a marca de erro por etapa, e é só isso:
  o estado da etapa mora em cada formulário, porque um usa `react-hook-form` e o outro `useState`.
- ⚠️ **As etapas são navegáveis, e não um trilho.** Dá para clicar direto na etapa 4. Assistente
  que tranca o avanço serve para fluxo de compra, onde a ordem é regra de negócio; aqui a ordem é
  só arrumação, e quem corrige o CEP de alguém não pode ser obrigado a passar por habilitação e
  aptidão.
- ⚠️ **"Próximo" só existe no CADASTRO.** Na edição o botão grava de qualquer etapa: quem abriu
  para corrigir uma linha não passa por cinco telas para salvar.
- ⚠️ **O botão de avançar é `type="button"`, e não submit.** Com submit, o Enter num campo da
  etapa 1 tentaria gravar o cadastro inteiro em vez de ir para a etapa 2. O `onSubmit` também
  avança em vez de gravar enquanto há etapa pela frente.
- ⚠️ **A validação ao avançar é do passo atual, e não do formulário todo** (`trigger` com a lista
  de campos da etapa). Sem a lista, sair da primeira etapa acusaria o vencimento da CNH em branco,
  que é um campo que a pessoa ainda nem viu.
- ⚠️ **A etapa com erro é marcada na barra.** É o que impede o pior defeito deste tipo de tela: a
  pessoa clica em cadastrar, nada acontece, e o campo inválido está numa etapa que ela não está
  vendo. Sem a marca, o formulário parece quebrado.
- O título da seção sumiu de dentro do corpo: a barra já diz onde a pessoa está, e repetir gastava
  a altura que a mudança existe para poupar. A descrição ficou, porque não está em lugar nenhum.
- "Contato e endereço" virou "Contato" na aba para as cinco caberem sem cortar em 768px.

### As duas fichas, no tamanho do mercado

O cadastro de motorista foi de 11 para 33 campos, em cinco seções (identificação, habilitação,
aptidão, contato e endereço, vínculo), acompanhando o que já tinha sido feito no caminhão.

- ⚠️ **"Identificação na telemetria" e "Registro da CNH" são campos DIFERENTES**, e o rótulo do
  primeiro foi escolhido para ninguém confundir. Um é o que o fornecedor usa para casar a pessoa
  com a viagem (cartão, tag); o outro é o número do documento. Trocar um pelo outro quebra a
  reconciliação, e o sintoma seria viagem sem condutor identificado.
- ⚠️ **Placeholder é EXEMPLO, e não repetição do rótulo.** "Digite a marca" não ensina nada;
  "Volvo" mostra o formato e a granularidade esperada num relance, que é a diferença entre alguém
  escrever "VW" e "Volkswagen" na mesma base. O cinza sai de `placeholder:text-placeholder`, que o
  `GlassInput` já aplica. São 22 no caminhão e 19 no motorista.
- O formulário do caminhão não tinha placeholder nenhum até esta rodada.

### O assistente é drawer, com histórico

Decisão do usuário. O assistente abria num `GlassModal` centralizado, que cobre justamente a tela
sobre a qual a pergunta é feita, e esquecia tudo ao recarregar a página.

- **Drawer pela direita, e o painel de conversas abre ao LADO dele**, pelos três pontinhos do
  cabeçalho (`MoreIcon`, novo em `components/icons.ts`). O conjunto cresce para a esquerda: o chat
  tem largura própria e a lista anima de 0 até `min(18rem,45vw)`.
- ⚠️ **A animação é do Radix, pelo `data-state`, e não uma classe ligada por estado do React.** Quem
  desmonta o conteúdo é o Radix; sem o par `animate-out`/`slide-out-to-right` a entrada fica suave e
  a saída seca, porque o nó some antes de a transição rodar.
- ⚠️ **O painel de conversas não é desmontado quando fecha, a largura é que anima.** Com
  `open && <Painel />` a lista pisca e some no primeiro quadro, antes de a faixa encolher.
- **As quatro sugestões de pergunta saíram** (decisão do usuário). Elas prometiam custo e
  manutenção, que este sistema não tem: a primeira coisa que a tela fazia era oferecer exatamente o
  que o assistente não sabe responder. No lugar ficou "Bem-vindo, {primeiro nome}" e "Como posso
  ajudar você hoje?", como num chat novo do ChatGPT. Só o primeiro nome, porque "Bem-vindo, Fulano
  de Tal Santos" não é como se cumprimenta alguém.
- **O histórico é do backend, nunca de `localStorage`**: são até 10 conversas por usuário, com
  renomear e excluir. Guardar no navegador deixaria pergunta sobre a operação de um cliente na
  máquina de quem abriu o painel, e sumiria ao trocar de computador.
- ⚠️ **Renomear é otimista, excluir confirma na própria linha.** Esperar o servidor para renomear
  faria o texto piscar de volta ao nome antigo; e um diálogo de confirmação por cima do drawer
  empilharia duas camadas de foco preso para uma decisão de dois cliques.
- ⚠️ **A tela de voz do hub usa a MESMA rota e precisa de `{ save: false }`.** Sem isso, cada
  pergunta falada abriria uma conversa e as 10 da pessoa acabariam em dez perguntas. Foi o que o
  `npm run build` pegou: o `tsc -b` alcança `src/pages`, que o `tsc --noEmit` do typecheck rápido
  não estava cobrindo naquele momento.
- **`MAX_ASSISTANT_CONVERSATIONS` mora em `management/types.ts`**, e não na fronteira de API. Se
  vivesse em `features/assistant/api.ts`, o mock teria de importar da API que importa o mock, e o
  ciclo é real porque a constante é valor, não tipo.
- **A procedência ganhou duas origens** (RN-121): "Telemetria MiX" para os blocos agregados e
  "Cadastro RookHub" para o que veio das funções de cadastro. Atribuir os dois à mesma origem
  apagaria o trabalho de conferência que a V16 em diante representa.
- O estado do assistente é do store, com ações assíncronas, e não `useEffect` nos componentes:
  carregar conversa é consequência de um clique, não de uma renderização.

### A tela de voz

Pedido do usuário. A tela `/assistente` já falava, mas por comando solto: uma pergunta, uma
resposta, e a captação cortava na primeira pausa.

- **Um botão só, e ele é o interruptor da conversa.** "Concluir comando" saiu: quem decide que a
  fala acabou passou a ser o silêncio, e um botão para encerrar o que já se encerra sozinho faz a
  pessoa duvidar se precisa apertar. Depois de responder, o microfone reabre sozinho até alguém
  encerrar.
- ⚠️ **O fim da fala é decidido AQUI, e não pelo navegador.** O `use-speech-recognition` passou a
  `continuous = true`: com `false`, a Web Speech encerra na primeira pausa e a pergunta chega pela
  metade, que é exatamente o defeito relatado (a pessoa respira no meio da frase). O corte agora é
  **2,4 segundos** de silêncio. Errar para o lado da espera custa dois segundos; errar para o lado
  da pressa custa a pergunta inteira.
- ⚠️ **Duas fontes de "ainda está falando", e as duas são necessárias**: o volume do microfone, que
  a tela já media para animar a esfera, e a transcrição chegando (`onSpeech`). Só o volume
  confundiria ar condicionado com voz; só a transcrição perderia a pausa curta entre duas frases,
  porque ela chega em blocos.
- ⚠️ **A transcrição ACUMULA, não substitui.** Com a sessão contínua o reconhecimento entrega a fala
  em vários trechos finais, e sobrescrever deixava só o último pedaço.
- ⚠️ **O `onend` do navegador não significa que acabou.** O Chrome encerra a sessão sozinho depois de
  um tempo de silêncio, mesmo com `continuous`. Sem religar, a transcrição morre no meio da conversa
  sem erro nenhum aparecer.
- **As frases de espera são da TELA, e não do modelo** (`voice-phrases.ts`). "Só um segundo, estou
  verificando" precisa ser dito ENQUANTO a consulta corre; vinda do modelo, sairia junto com a
  resposta, que é justamente quando ela não serve mais. Só entram depois de 900 ms, porque resposta
  rápida não precisa de aviso. Há várias de cada tipo e o sorteio nunca repete a anterior: ouvir a
  mesma frase toda vez denuncia a gravação.
- **O áudio dessas frases é sintetizado uma vez e guardado na sessão.** São sempre as mesmas dez, e
  sem o cache cada "só um segundo" gastaria créditos da ElevenLabs de novo e ainda somaria a
  latência da síntese ao silêncio que a frase existe para preencher.
- **A conversa falada não é gravada** (decisão do usuário): o fio vive num ref e some ao sair da
  tela, com os 10 últimos turnos indo ao backend a cada pergunta. Cada pergunta falada abrindo uma
  conversa gastaria as dez do histórico do chat em dez perguntas.
- ⚠️ **Falha do microfone precisa FECHAR a conversa.** Sem isso o botão ficava em "Encerrar
  conversa" para uma conversa que nunca começou. Foi a suíte que pegou (`hub-flow.test.tsx`), e é o
  tipo de defeito que passa despercebido no teste manual, porque quem testa tem microfone.
- ⚠️ **Não usar `lastAnswerRef` para decidir dentro de uma função assíncrona.** O ref é preenchido
  por efeito, que só roda depois do render: lido no meio de um `await`, ele ainda traz a resposta
  ANTERIOR. Vale para qualquer ref espelhado de estado.

#### A tela acompanha a conversa

Ajustes pedidos pelo usuário depois de conversar com a assistente de voz.

- **A frase "só um segundo, estou consultando" agora é disparada por EVENTO do backend**
  (`converse` recebe um `onConsulting`), e não por um relógio de 900 ms. Um "oi" não chama função
  nenhuma e passa direto para a resposta. Ver a seção correspondente na memória do `Backend-web`.
- **As falas da própria tela põem a esfera em "falando"** (`sayPhrase` marca o estado e roda a
  animação sintética). Antes a assistente falava com a tela parada no desenho de repouso, e a voz
  parecia vir de outro lugar: quem conversa lê a esfera antes de ler o texto.
- ⚠️ **Com a conversa aberta, o repouso não é "Pronto para conversar".** Entre a resposta e a
  reabertura do microfone a tela passava por `idle` e voltava a dizer "ative o microfone e fale",
  no meio de uma conversa em andamento, o que se lê como "ela desligou". Agora esse intervalo diz
  "Conversa aberta".
- ⚠️ **`httpStream` em `services/http.ts` é para resposta lida enquanto ainda está chegando.** O
  `httpRequest` só devolve com o corpo inteiro, e aqui o meio do caminho é o que importa. Ele
  devolve a `Response` crua: o formato do fluxo é problema de quem pediu.
- ⚠️ **NDJSON se corta no `\n`, nunca no pedaço recebido.** Um pedaço da rede não respeita fronteira
  de linha: pode trazer meia linha ou duas e meia. O leitor guarda o resto entre uma leitura e
  outra.

#### Detecção de fala em lugar barulhento (05/09/2026)

Relatado pelo usuário: em ambiente barulhento a conversa **trava**. Ele termina de falar, a
assistente continua "ouvindo" o barulho da sala e a pergunta nunca é processada.

- ⚠️ **A causa era o limiar FIXO** (`NIVEL_DE_FALA = 0.055`). Num pátio ou numa oficina o ruído de
  fundo já passa desse valor, então `lastVoiceAtRef` era renovado a cada quadro e o relógio do
  silêncio nunca andava. O teto que existia só valia quando NÃO havia pergunta, então, uma vez que
  havia, não sobrava saída nenhuma.
- A decisão saiu da tela para `pages/hub/speech-detection.ts`, com três defesas: **piso de ruído
  adaptativo** (desce rápido, sobe devagar, para a própria fala não levantar o piso e se anular),
  **persistência de 140 ms** (estalo e batida de porta não são fala) e **teto pelo reconhecedor**,
  que é a rede de segurança: com pergunta na mão e 4 s sem texto novo do navegador, processa mesmo
  que o microfone continue ouvindo barulho.
- ⚠️ **`onSpeech` e `onResult` deixaram de ser a mesma coisa.** O evento do navegador dispara com
  atividade de áudio, inclusive ruído; só `onResult` significa palavra reconhecida. Misturar os dois
  era parte do travamento: o barulho renovava o relógio da "transcrição" que nunca tinha existido.
- O nível medido passou a ser o da **faixa de 300 a 3400 Hz**, e não o espectro inteiro. Motor, ar
  condicionado e vento vivem embaixo de 300 Hz; é a mesma faixa que o telefone transmite, e pelo
  mesmo motivo. A animação da esfera continua usando o espectro cheio, que é o que ela quer.
- ⚠️ **Isto é testável sem microfone, e por isso tem teste** (`speech-detection.test.ts`, 8 casos).
  O defeito NÃO aparece em teste manual: quem testa está sentado numa sala silenciosa, onde o limiar
  fixo funcionava. O caso do pátio (ruído constante em 0,30) é um teste nomeado.

#### A conversa falada virou transcrição e ganhou memória (05/09/2026)

⚠️ **Reverte a decisão de 30/08/2026 de a conversa falada não ser gravada.** A troca é do usuário, e
o motivo é a pergunta que ela desbloqueia: "sobre o que a gente conversou semana passada?".

- A tela abre a sessão em `POST /v1/assistant/voice/session` e passa o `conversationId` em cada
  pergunta. O servidor decide entre retomar e abrir nova; a tela só recebe o fio de volta e desenha.
- **A transcrição fica à esquerda, e some abaixo de 1024px.** Empilhada, ela empurraria a esfera
  para fora da tela justamente quando a conversa fica longa. Em tela estreita, ler e falar ao mesmo
  tempo não acontece, e o painel comeria o espaço de quem dá o retorno de que a assistente ouve.
- ⚠️ **A transcrição é DERIVADA** (`turnos do servidor + turnos desta visita`), e não um terceiro
  estado. Foi a segunda vez no dia que o `react-hooks/set-state-in-effect` cobrou isso: o efeito só
  pode encostar em ref. Ver também o rodízio de voz, logo abaixo.
- O efeito da sessão só escreve refs (`sessaoIdRef` e `historyRef`), e tem guarda pelo id: sem ela,
  uma revalidação da consulta no meio da conversa apagaria o fio da sessão em andamento.
- ⚠️ **O painel precisa de `min-h-0` na seção E na `aside`.** Sem isso, um filho de flex tem altura
  mínima igual ao conteúdo: o painel crescia com a conversa, esticava a página e o começo do que foi
  dito sumia da tela. Foi exatamente o que o usuário relatou. Tem `max-h-[70vh]` de reserva, para o
  painel continuar limitado se algum ancestral perder a altura.
- ⚠️ **A rolagem automática depende de `transcricao.length`, não do array**, e roda dentro de um
  `requestAnimationFrame` com `scrollTop` direto. Medido: com `[transcricao]` a lista descia a cada
  render, inclusive no meio de alguém lendo o histórico; sem o quadro de espera, o efeito rodava
  antes de o turno ter altura e a caixa parava em zero ao abrir conversa guardada; e com
  `behavior: 'smooth'` a animação continuava rolando enquanto a pessoa arrastava para cima,
  brigando com a mão dela.
- A tela aplica a troca de voz pedida por comando falado (evento `voice` do fluxo), chamando o mesmo
  `trocarGenero` do botão. Ver a fronteira dessa função na memória do `Backend-web`.
- ⚠️ **O teste `hub-flow` precisou de `QueryClientProvider`.** A tela passou a usar `useQuery` para o
  catálogo de vozes e para a sessão, e sem o provedor ela nem monta. Os dois pedidos falham dentro do
  teste de propósito: o que ele checa é o caminho do microfone indisponível.
- As frases da tela passaram de 17 para 50 (20 de espera, 10 de "não ouvi", 8 de falha, 12 de
  saudação), a pedido do usuário. Com seis frases de espera, quem conversa dez minutos ouve a mesma
  três vezes: o sorteio sem repetir a anterior resolve o par seguido, não o ciclo curto.

#### A pessoa escolhe o timbre (05/09/2026)

Pedido do usuário: escolher entre voz feminina e masculina, a escolha sobreviver a sair e voltar, e
**dentro do gênero a voz alternar a cada visita**, para não ser sempre a mesma.

- **O que fica no `localStorage` é o gênero e um contador, nunca a voz.** Gravar a voz exata daria o
  contrário do pedido, que é justamente não repetir o mesmo timbre.
- ⚠️ **O catálogo vem do backend** (`GET /v1/voice/voices`), e não de uma lista no cliente: ele muda
  com o provedor ativo e com o que foi baixado na imagem do sintetizador. Lista fixa aqui ofereceria
  voz que não existe mais.
- ⚠️ **O passo do rodízio anda dentro do `queryFn`**, e esse detalhe custou duas tentativas. Ele
  escreve no `localStorage`, e escrever no render é erro de `react-hooks/purity`; mover para um
  efeito esbarra em `react-hooks/set-state-in-effect`, que este projeto também trata como erro. O
  `queryFn` é o único lugar da tela que roda uma vez por visita e fora do render. `staleTime: 0` e
  `gcTime: 0` são o que fazem cada entrada buscar de novo e, com isso, girar a voz.
- ⚠️ **Trocar a voz exige limpar o cache das frases de espera.** Ele guarda o ÁUDIO já sintetizado, e
  não o texto: sem limpar, "só um segundo" continuaria saindo na voz anterior no meio de uma conversa
  que já trocou de voz.
- ⚠️ **Só existe UMA voz feminina em pt-BR** nos dois modelos locais (`pf_dora`, do Kokoro), então o
  rodízio feminino não tem entre o que alternar. É limite de catálogo, não da tela: o mecanismo
  alterna sozinho assim que houver uma segunda. O `Backend-web/docs/VOZ_DA_ASSISTENTE.md` lista os
  dois caminhos para arrumar mais uma.
- Quem prefere feminina e cai num provedor sem voz feminina (o Piper) ouve a masculina, em vez de a
  assistente emudecer. O cabeçalho mostra o nome da voz no ar, senão o rodízio parece defeito.

#### A conversa falada no celular (06/09/2026)

Relatado pelo usuário, no Chrome do Android **e** no Safari do iPhone: ele começa a conversar, e na
hora de a assistente responder o microfone reabre sozinho, ela volta a falar do começo e a resposta
nunca chega. No computador a mesma tela funciona.

- ⚠️ **`stop()` do reconhecimento é um pedido, não um fato.** A tela chamava `speech.stop()` e
  seguia direto para tocar a resposta. No computador o encerramento vem em poucos milissegundos e
  ninguém percebe; no celular ele demora, e a resposta começava com o reconhecedor **ainda segurando
  o microfone**. No iPhone isso joga a saída no alto-falante da orelha, e a voz some; nos dois, a
  fala dela volta para a captação e vira a pergunta seguinte. O `stop` agora devolve promessa que só
  cumpre no `onend`, com teto de 1,5 s para navegador que engole o evento, e `finishListening` espera
  por ela antes de falar.
- ⚠️ **`abort()` e não `stop()` para encerrar.** `stop()` ainda entrega os trechos finais que estavam
  na fila, e eles chegam **depois** de a pergunta ter sido enviada, sujando a próxima. Quem chama já
  leu a transcrição.
- ⚠️ **`start()` não significa que o microfone abriu.** O hook marcava `listening` no pedido, e no
  celular o pedido é recusado quando a sessão anterior não fechou: a tela dizia "Estou ouvindo" com o
  microfone fechado, o detector desistia por silêncio e a assistente respondia "não ouvi" em ciclo.
  Quem marca agora é o `onstart` do navegador.
- ⚠️ **O `AudioContext` do iPhone precisa nascer no toque.** Ele era criado dentro de
  `startListening`, **depois** do `await` da saudação: fora do gesto, o iOS o deixa suspenso para
  sempre e a assistente fica muda sem erro nenhum. Agora `garantirContextoDeReproducao` roda de forma
  síncrona no `onClick`. Efeito colateral bem-vindo: a saudação voltou a ser falada na primeira vez,
  que antes saía calada porque o contexto ainda não existia quando `phraseAudio` era chamado.
- A pausa antes de reabrir o microfone é de 1 s em aparelho de ponteiro grosso, contra 500 ms no
  computador. Lá o alto-falante fica a centímetros do microfone e não há como afastar um do outro.
- ⚠️ **Isto tem teste porque não aparece em teste manual no computador**
  (`use-speech-recognition.test.ts`, 6 casos). O reconhecimento falso só dispara os eventos quando o
  teste manda, que é como se reproduz o celular lento. Mesma lição do `speech-detection.test.ts`.

#### O seletor de voz virou animação (06/09/2026)

Pedido do usuário: ver o seletor trocar, **inclusive quando a troca é pedida por voz**, e o seletor
ficar mais visível.

- A pílula desliza porque é posicionada pelo **gênero no ar**, e não por quem pediu a troca. Clique
  e comando falado passam os dois por `trocarGenero`, então não existe um segundo caminho para
  manter em pé. Um anel pisca junto, e ele existe pela troca falada: quem fala está olhando para a
  esfera, e a mudança no cabeçalho aconteceria fora do campo de visão.
- As colunas do seletor são iguais (`grid` com `1fr`) porque "Feminina" e "Masculina" têm larguras
  diferentes: sem igualar, a pílula mudaria de tamanho no meio do caminho.
- ⚠️ **O anel pisca de novo por causa da `key`.** Ela é o contador de trocas: sem trocar a chave, o
  React reaproveita o elemento e o keyframe não recomeça. O keyframe é `voice-switch-flash`, no
  `@theme` do `globals.css`.
- ⚠️ **Não usar `setTimeout` guardado em ref para isso.** Foi a primeira tentativa, e o `ref` lido no
  cleanup do efeito fez o compilador do React desistir de otimizar a tela inteira: o lint saltou de
  0 para **7 erros de uma vez**, e nenhum deles apontava para o código novo (apontavam para
  `useMemo`, `Date.now` e refs que já estavam lá havia semanas). O erro que importa é o primeiro,
  `Compilation Skipped` no `useMemo`; os outros seis são consequência. Quando o lint explodir assim
  depois de uma mudança pequena, o caminho é bissectar a própria mudança, não perseguir os
  diagnósticos.

#### Eco do alto-falante e modo de consulta

As armadilhas do lado do servidor (placa soletrada com tolerância de edição, prompt, NDJSON e
`ResponseBodyEmitter`) estão em `../Backend-web/.claude/memoria.md`. Aqui fica o que é da tela.

- ⚠️ **Sem fone, a voz dela entra no microfone e vira pergunta.** O alto-falante volta para a
  captação, e a pergunta chegou ao backend com o "oi tudo bem" que ela mesma acabara de dizer
  grudado na frente: o modelo respondeu ao próprio cumprimento. Duas defesas, as duas na tela: meio
  segundo de pausa antes de reabrir o microfone, e o `semEco`, que corta do começo da transcrição o
  que ela falou por último. **O corte exige três palavras seguidas**: com uma, "onde" ou "está"
  roubariam o começo de perguntas legítimas.
- **Modo de consulta**: enquanto ela busca o dado, a esfera fica indigo com pulso próprio, mais
  lento e mais amplo que o de processamento, e volta ao normal para falar. O estado dura até a
  resposta chegar, e não só enquanto a frase "só um segundo" toca: a busca é o que demora, e uma
  esfera congelada no meio da espera parece conversa travada.

### Mapa ao vivo como central de comando (`/gestao/mapa`)

Redesenhada em **30/08/2026**, e revista no mesmo dia depois que o usuário usou a tela. A regra
que ficou: **o que é do mapa mora no mapa**, e a página em volta guarda só o que não cabe lá.

⚠️ **O dono NÃO tem esta tela.** Ela está no menu do gestor e do administrador; o `OWNER_NAV` de
`nav-items.ts` é curto de propósito (a visão do dono existe para avaliar lucratividade sem
distração operacional). A rota `/gestao/mapa` não tem `RoleRoute`, então quem digitar o endereço
entra: é decisão de menu, não de permissão.

- ⚠️ **Os quatro números saíram** (em movimento, prontos para operar, pedem atenção, sem sinal),
  a pedido do usuário. Eles ficavam abaixo do mapa depois de já terem sido tirados de cima por
  empurrarem o território para fora da primeira dobra. A contagem que importa já está nos chips
  de filtro da lista, com a vantagem de serem clicáveis.
- ⚠️ **A lista fica à ESQUERDA e o mapa à direita, com a MESMA altura.** A leitura vai do painel
  para o território: quem opera procura uma placa na lista e confirma onde ela está, e não o
  contrário. A altura é da LINHA do grid (`items-stretch` mais `h-full` nos dois filhos), e não
  de cada peça: antes o mapa tinha altura própria e a lista tinha `max-h-[620px]`, então uma
  sobrava enquanto a outra faltava.
- ⚠️ **A ficha do veículo é uma TERCEIRA COLUNA, e ela só existe com algo escolhido.** Antes
  morava dentro da lista, entre os filtros e as placas: cada clique empurrava a lista para baixo
  e a placa recém-escolhida saía do campo de visão no instante em que era escolhida. Sem seleção
  a coluna não ocupa espaço e o mapa recebe a largura de volta
  (`320px_300px_1fr` contra `360px_1fr`).
- **Escolher uma placa leva a câmera até ela** (`ZOOM_DE_FOCO`, piso de 13). O que existia antes
  não cumpria: o mapa só se mexia quando a ROTA chegava, o que dependia de uma segunda
  requisição e enquadrava o dia inteiro, não o veículo. ⚠️ O efeito compara com o alvo anterior
  antes de agir: o polling reescreve `positions` a cada dez segundos e, sem essa guarda, a câmera
  voltaria para o veículo escolhido toda vez, arrancando o mapa da mão de quem estivesse
  arrastando. Centraliza na posição DESENHADA, não na do dado: com o deslize em curso o crachá
  está a caminho.
- **A câmera SEGUE o veículo escolhido enquanto ele anda** (pedido do usuário em 30/08/2026). O
  seguimento acontece dentro do laço de animação, com `setCenter` na MESMA posição interpolada do
  caminhão, quadro a quadro: o veículo fica parado no centro e o território desliza por baixo.
  ⚠️ Seguir com `easeTo` a cada leitura daria um solavanco por ciclo, porque a câmera correria
  até o destino e pararia esperando o próximo.
- ⚠️ **NENHUM gesto desliga o seguimento. Quem desiste do veículo é quem fecha a ficha** (regra
  final do usuário em 30/08/2026, depois de duas versões mais restritivas). A "mexidinha" para
  olhar um cruzamento ao lado não é um pedido de abandonar a placa: na leitura seguinte a câmera
  volta para ela.
- **A câmera parte de ONDE ESTÁ, e não salta.** O laço guarda `map.getCenter()` no início de cada
  deslize e interpola dali até o veículo na mesma curva do caminhão. Perto dele o movimento é
  imperceptível e a câmera desliza junto; longe, ela volta andando. Escrever o centro direto na
  posição do veículo daria um salto seco em quem tivesse arrastado para longe.
- ⚠️ **`arrastando` marca o gesto EM CURSO, e não é um interruptor.** Enquanto o dedo está no
  botão, mandar o centro seria disputar o mapa com a mão de quem está usando; ao soltar, o
  seguimento continua normalmente. Confundir "está arrastando agora" com "desistiu de seguir" foi
  o erro das versões anteriores.
- **O ângulo escolhido sobrevive sozinho no seguimento:** `setCenter` mexe só no centro, e
  `bearing` e `pitch` seguem intactos. ⚠️ Mas os dois `fitBounds` (enquadramento inicial e
  abertura do trajeto) PRECISAM receber `bearing` e `pitch` atuais explicitamente: sem eles o
  MapLibre calcula a câmera como se o mapa estivesse achatado e devolve a visão para o de cima,
  desfazendo a inclinação que a pessoa escolheu.
- ⚠️ **Armadilha ao TESTAR o seguimento:** as posições reais não mudam entre leituras (a coleta da
  MiX é de 5 em 5 minutos), e o React Query faz _structural sharing_: dado igual mantém a MESMA
  referência, o efeito não dispara e parece que o seguimento quebrou. Para testar é preciso
  interceptar `/v1/fleet/positions` e deslocar as coordenadas. ⚠️ E filtrar por
  `status === 'EM_VIAGEM'` no interceptador NÃO funciona: ali o DTO ainda traz o status CRU do
  backend, e o filtro não casa com nada. Deslocar todos os veículos é o caminho. Perdi duas
  rodadas achando que o produto estava quebrado quando o quebrado era o teste.
- ⚠️ O polling também PARA quando a aba perde o foco (`refetchIntervalInBackground` é falso por
  padrão). Num teste automatizado, `page.bringToFront()` antes de esperar.
- ⚠️ A guarda do `originalEvent` separa o gesto da pessoa do movimento que o próprio código pede:
  `easeTo`, `fitBounds` e o `setCenter` do laço também disparam esses eventos, e sem ela o
  seguimento se desligaria sozinho no primeiro quadro que ele mesmo produzisse.
- ⚠️ **`isEasing()` protege a animação de foco.** Sem essa guarda, o `setCenter` do laço cortaria
  o `easeTo` que roda ao escolher a placa, e o enquadramento chegaria de repente.
- ⚠️ **O chip de status aparece TAMBÉM no cartão selecionado da lista.** Ele era escondido ali
  (`active ? null : <chip/>`), e o efeito era perder a única informação que diz o estado do
  veículo justamente no cartão que a pessoa está olhando. A razão de esconder era boa (as duas
  superfícies do `StatusChip` contam com fundo neutro e somem sobre o indigo cheio), mas a
  solução era errada: em vez de tirar o chip, dar a ele um fundo. Usa `surface="light"` com
  `className="bg-surface-container"`, que mede 8,97:1. ⚠️ Sólido, e não translúcido: um véu deixa
  o indigo atravessar e derruba o contraste da cor semântica, que é o que separa "em viagem" de
  "sem sinal". O `VehicleStatusChip` ganhou `className` só para isso.
- ⚠️ **A legenda é DERIVADA de `CORES_DA_GESTAO` e `VEHICLE_STATUS_LABELS`, nunca escrita à mão.**
  A versão fixa tinha três itens e mentia por omissão: os caminhões cinza (sem sinal) e vermelhos
  (bloqueado) apareciam no mapa sem nada que os explicasse, e "sem sinal" é o segundo estado mais
  comum desta frota. Ela também dizia "Atenção" onde o sistema diz "Manutenção", que é o tipo de
  sinônimo que faz a pessoa procurar um filtro que não existe. Derivando, status novo aparece
  sozinho.
- ⚠️ **A rota só desce para o `FleetMap` com o painel de trajeto aberto**, e isso não é economia:
  é o `FleetMap` que enquadra o trajeto ao recebê-lo. Mandando sempre, escolher uma placa
  afastaria a câmera para caber o dia todo e desfaria o foco que acabou de ser pedido.
- **O trajeto (janelas de 6h/24h/72h e o replay 1x/2x/4x) foi para DENTRO do mapa**, atrás de um
  botão só-ícone no canto inferior esquerdo. Fechado, ele é um ícone; aberto, um cartão sobre o
  território. Trocar de veículo fecha o painel, e isso é feito no handler `select`, nunca num
  `useEffect`: sincronizar estado com prop em efeito é erro de lint aqui.
- **A legenda de cores subiu para o topo do mapa.** Ela explica o crachá, então mora onde o olho
  entra no território. ⚠️ Os três literais são os mesmos de `STATUS_COLOR` no `fleet-map.tsx`:
  legenda que mente é pior que legenda nenhuma.
- **Saíram o cartão "Visão territorial" e o "Veículo selecionado".** O primeiro repetia a
  contagem que a lista já dá; o segundo repetia a placa que a ficha ao lado mostra em corpo
  maior. Os dois cobriam território, que é o que a tela existe para mostrar.
- ⚠️ **O aviso de dessincronizados virou aviso FLUTUANTE** (`sonner`, 8s). Era uma faixa fixa
  ocupando uma linha inteira acima do mapa o tempo todo. A guarda pelo número anterior é o que
  torna isso usável: a tela repergunta a cada dez segundos e, sem ela, o mesmo aviso apareceria
  seis vezes por minuto até virar ruído que se aprende a ignorar. Ele volta quando a CONTAGEM
  muda. O `id` fixo troca o conteúdo do aviso em cartaz em vez de empilhar um segundo.
- ⚠️ **Os cartões sobrepostos empilham à ESQUERDA.** O canto superior direito é do controle de
  zoom do MapLibre, e o que for posto lá fica meio escondido embaixo dele.
- **Atualização a cada 10 segundos** (era 4). O número sai de `REFETCH_MS` e não de dois lugares:
  ele aparece escrito na tela, e com o valor repetido a legenda passaria a mentir na primeira vez
  que alguém mexesse no outro.
- ⚠️ **"Atualização automática a cada 10 segundos" era mentira, e saiu** (usuário em 30/08/2026).
  Os 10 segundos são de quanto em quanto tempo a TELA repergunta ao nosso banco. O banco só
  recebe posição nova quando o coletor da MiX roda, e ele roda a cada **5 minutos**
  (`rookhub.mix.collection-interval-ms`, padrão 300000, `fixedDelay`), mais o tempo que o
  rastreador leva para reportar à MiX. O chip agora mostra a IDADE da leitura mais recente da
  frota, medida no cliente a partir de `lastSyncAt`, e o intervalo do polling ficou no `title`.
  ⚠️ Medir em vez de repetir o número do backend é de propósito: aquele valor é configuração, e
  o atraso do rastreador não é configurável por ninguém.
- ⚠️ **O replay não passa mais por estado do React.** O `TrackReplay` chamava `setState` no pai a
  cada quadro, e o pai é a página inteira: lista de 40 veículos, ficha e mapa re-renderizavam
  dezenas de vezes por segundo para mover um ponto, e era isso que fazia o play engasgar. O
  `FleetMap` virou `forwardRef` e expõe `setReplayPose` (`FleetMapHandle`); o laço escreve direto
  na fonte do MapLibre e o React não roda nenhuma vez enquanto o trajeto corre. Só o rótulo de
  hora e o slider continuam em estado, a 8 atualizações por segundo (`PASSO_DA_INTERFACE_MS`).
- **O marcador do replay é um CAMINHÃO, e a posição é interpolada entre leituras.** Um círculo
  âmbar não dizia o que era (evento? parada? cursor?), e sem interpolar ele saltava de esquina em
  esquina dez vezes por segundo, que era metade da sensação de travamento. ⚠️ São duas camadas
  pelo mesmo motivo da frota: a seta gira com a direção, o crachá não, senão o caminhão fica de
  cabeça para baixo em todo trecho rumo ao oeste. O rumo usa a fórmula da esfera, e não `atan2`
  cru: em latitude de 23 graus um grau de longitude é bem mais curto que um de latitude, e
  ignorar isso entorta a seta em todo trecho que corre para leste.
- ⚠️ **O zoom do MapLibre desceu para o rodapé direito** para o mapa de calor poder ir ao topo
  direito, onde o usuário pediu. É o mesmo conflito de canto já registrado antes: devolver o zoom
  para cima traz a sobreposição de volta.
- ⚠️ **O que flutua sobre o mapa usa a MESMA receita do mapa da operação**
  (`components/shared/operation-map`), decidido pelo usuário em 30/08/2026: papel a 80%, traço de
  divisória, `rounded-md`, `backdrop-blur` padrão e texto de 11px. São dois mapas do mesmo
  produto, e a informação sobreposta não pode ter dois desenhos. A constante é `SOBRE_O_MAPA`, no
  topo da página; mexeu num mapa, confira o outro.
- Os tokens têm nomes diferentes nos dois lados e apontam para os mesmos valores: `background`,
  `border` e `muted-foreground` do painel operacional são aliases de `surface`, `outline-variant`
  e `on-surface-muted`, declarados no `@theme inline` do `globals.css`. Dentro de `management/`
  usa-se o nome da gestão, que é a convenção da pasta.
- ⚠️ **Duas versões foram recusadas antes desta, e as duas valem como aviso.** A primeira era uma
  placa quase preta (`bg-[#101014]/82`), que eu escolhi para ganhar contraste: sobre o Liberty,
  que é um mapa claro, ela não lê como vidro, lê como buraco. A segunda era branco puro com
  `backdrop-blur-2xl`, que ficava mais pesada que o próprio mapa. Papel a 80% deixa o território
  aparecer sem disputar com ele.
- ⚠️ **Quem garante a leitura é a camada de papel, não o desfoque.** O `backdrop-blur` só dissolve
  a malha de ruas; ele não escurece nem clareia nada, e um cartão com blur e fundo transparente
  fica ilegível sobre mapa detalhado.
- ⚠️ Aqui o desfoque FAZ sentido, ao contrário do resto do painel, onde ele foi removido no mesmo
  redesign: lá era placa branca sobre papel branco e custava GPU sem efeito visível; sobre o mapa
  há conteúdo atrás de verdade. Os dois mapas são as únicas superfícies do sistema que ainda usam
  `backdrop-filter`.
- ⚠️ **O filtro do painel lateral filtra a LISTA, não os marcadores.** Continua assim, e a tela
  não promete o contrário. Vale registrar como pendência: hoje um gestor que filtra por
  "Manutenção" vê a lista encolher e o mapa igual.

### Carregamento das telas: a tampa dos mapas

- ⚠️ **`desenharConteudo` tem trava de reentrância, e sem ela há CORRIDA.** Ela é assíncrona:
  espera a rasterização dos ícones antes de montar. Nessa espera o `styledata` dispara, passa
  pela guarda e entra em paralelo; as duas execuções chegam em `montarCamadas`, a primeira
  adiciona a fonte "heat" e a segunda estoura com `Source "heat" already exists`. O mapa cai e o
  erro se repete a cada disparo (27 vezes no relato do usuário em 30/08/2026). O defeito era
  antigo e só ficou visível quando o par de imagens do replay entrou em `loadVehicleIcons` e
  alargou a janela.
- ⚠️ **A guarda do `styledata` pergunta por `SOURCE_HEAT`, a PRIMEIRA fonte montada.** Perguntar
  pela última (`SOURCE_ID`) deixava passar qualquer montagem incompleta, e a tentativa seguinte
  estourava na fonte que já existia.
- ⚠️ **`montarCamadas` é idempotente**: `addSource` e `addLayer` lançam quando o id já existe, e a
  função roda de novo a cada troca de base. As duas guardas locais (`fonte` e `camada`) impedem
  que uma montagem morta no meio vire um laço de erro que nunca sai sozinho.
- ⚠️ **O evento `error` do MapLibre NUNCA derruba a tela. Duas versões erradas já moraram nessa
  linha**, as duas quebrando a tela em 30/08/2026:
  1. `setFailed(true)` em qualquer `error`. O MapLibre emite esse evento por muita coisa que não
     impede o mapa de funcionar: tile que não veio, faixa de glifo com 404, sprite ausente.
  2. Derrubar só quando `isStyleLoaded()` fosse falso. Parecia mais preciso e era PIOR: erro de
     tile chega cedo, enquanto o estilo ainda carrega, então a condição era verdadeira justamente
     no pior momento. A base do OpenFreeMap emite "Expected value to be of type number, but found
     null" ao processar certos tiles, e isso sozinho matava a tela.
- **As duas provas reais de falha** são o `catch` de `desenharConteudo` (não conseguimos montar as
  camadas) e `ESPERA_MAXIMA_MS`, um relógio de 15s para a base chegar. Nenhum erro assíncrono
  isolado é prova de que o mapa é inutilizável.
- ⚠️ **Todo caminho de falha LOGA antes de derrubar.** Os dois `catch` engoliam o erro em
  silêncio, e o resultado era a tela de falha sem uma linha no console dizendo por quê: o pior
  estado possível para quem precisa consertar. Os prefixos são `[mapa]` e `[mapa 3D]`.
- ⚠️ **A camada 3D não pode derrubar o mapa.** `onAdd` e `render` são embrulhados em `try`, e o
  primeiro erro liga uma bandeira que desliga a camada para sempre. Sem isso, um erro dentro do
  `render` se repetiria a sessenta quadros por segundo. É a peça mais nova e mais arriscada do
  mapa: ela falha sozinha, e o território, a lista e o trajeto continuam.
- ⚠️ **Nada de raio de canto no elemento do mapa.** O container da página tem `rounded-2xl` e o
  mapa tinha raio próprio, menor: a diferença entre os dois deixava quatro lascas do fundo do
  container aparecendo nos cantos e, com o fundo escuro que havia ali, elas liam como bordas
  pretas enquanto a base carregava (relatado pelo usuário em 30/08/2026). Quem arredonda é o
  container, pelo `overflow-hidden`, e o fundo dele agora é papel (`bg-surface-lowest`).

Decisão do usuário: nenhuma tela pode travar enquanto monta. Onde o custo é de DADO, isso já
existia; o que faltava era onde o custo é de RENDERIZAÇÃO, que são os três mapas.

- **Dados já estavam cobertos.** As páginas do painel de gestão usam `QueryState`
  (`management/components/layout/query-state.tsx`), e as do operacional usam `LoadingState` ou
  `Skeleton` de `components/shared/states.tsx`. Conferido arquivo por arquivo: nenhuma tela ficou
  de fora. Os componentes internos que não usam (painel de detalhe, cartão, modal) carregam
  dentro de uma tela que já está visível, que é outro caso.
- ⚠️ **A tampa COBRE o mapa, e não adia a montagem dele.** O MapLibre precisa de um elemento com
  tamanho para se instalar: montar só depois do carregamento é esperar por algo que nunca começa.
  O spinner é um irmão posicionado por cima, e o container fica montado desde o primeiro render.
- **O que travava era ver o mapa em construção:** base branca, tiles entrando em bloco e a frota
  surgindo depois. A montagem continua custando o mesmo; o que muda é acontecer atrás da tampa.
- ⚠️ **No mapa ao vivo a tampa espera DOIS sinais**, `ready` (camadas montadas) e
  `modelo3dPronto` (o GLB baixado). Se fossem o mesmo, o mapa apareceria sem os caminhões e eles
  surgiriam de uma vez, que é o pisca-pisca que a tampa existe para evitar.
- ⚠️ **O erro do GLTFLoader também avisa que terminou.** Quem espera esse retorno é a tampa: sem
  avisar, um 404 no modelo deixaria a tela em "Carregando o mapa" para sempre, sem erro visível.

### A ficha virou drawer, e o mapa ganhou base e ângulo (05/09/2026)

Pedido do usuário. A ficha do veículo era a terceira coluna do grid e virou drawer; o mapa encolhe
enquanto ela está aberta e volta a esticar ao fechar.

- ⚠️ **O `FleetMap` precisou de um `ResizeObserver` chamando `map.resize()`.** O MapLibre escuta o
  `resize` da JANELA, e só ele: com o drawer encolhendo o container, o canvas ficava com a largura
  antiga e o clique saía deslocado do que se via. Medido depois de ligar: linha 1140, coluna do mapa
  784, canvas 782, drawer 340.
- O drawer é IRMÃO do mapa numa linha flex, e não uma camada por cima: sobreposto, ele taparia
  justamente o caminhão recém-escolhido.
- ⚠️ **São DUAS animações ao mesmo tempo, e as duas precisam existir** (corrigido em 05/09/2026,
  depois de o usuário apontar que "não era drawer"): a LARGURA do `aside` (`w-0` para `w-[340px]`),
  que é o que faz o mapa encolher, e o DESLIZE do painel ancorado à direita (`translate-x-full` para
  `translate-x-0`). Só a largura dava meio drawer: a caixa crescia e o conteúdo aparecia de um
  quadro para o outro.
- ⚠️ **O painel fica SEMPRE montado**, senão ele nasceria já na posição aberta e a entrada não
  animaria: transição precisa de um estado anterior para sair dele.
- ⚠️ **A ficha desenhada (`fichaId`) é estado SEPARADO da seleção (`selectedId`).** Fechar limpa só
  a seleção; quem apaga a ficha é o `onTransitionEnd` da largura, filtrado por `propertyName` e por
  `target === currentTarget` (o deslize do painel também borbulha até lá). Desmontando junto com a
  seleção, a caixa encolhia vazia e não havia animação de saída nenhuma.
- ⚠️ **Animação de 300 ms NÃO se verifica por captura de tela nem por `requestAnimationFrame` no
  Playwright.** A captura demora mais que a transição e chega sempre no estado final; o `rAF` é
  estrangulado e devolveu uma amostra só. O que funcionou foi ler o estilo computado 80 ms depois do
  clique: largura em 128,25 px de 340, e `translate` em 28,157%. Perdi três rodadas concluindo que
  a animação não existia quando o problema era a régua.
- ⚠️ **No Tailwind 4, `translate-x-*` usa a propriedade CSS `translate`, e não `transform`.** Ler
  `getComputedStyle(...).transform` devolve `none` mesmo com o deslize aplicado, e isso parece
  defeito.
- **Nem o drawer nem a lista têm moldura de cartão** (pedido do usuário em 05/09/2026). O drawer usa
  a mesma receita do drawer do assistente: fundo `surface-low`, traço só à esquerda, canto quadrado
  e altura cheia. Com borda em volta e canto arredondado ele lia como um terceiro cartão do layout,
  e não como uma gaveta. A lista perdeu borda, canto e fundo próprio, e o que a separa do mapa é o
  vão do grid.
- ⚠️ **O drawer empurra o mapa em vez de flutuar sobre a tela, e essa é a ÚNICA diferença para o
  drawer do assistente.** O do assistente é `fixed inset-y-0 right-0` e cobre a topbar; este vive
  dentro da linha do grid, porque o pedido anterior do usuário foi que o mapa encolhesse ao abrir.
  As duas coisas não convivem: gaveta que cobre a tela não empurra nada.
- Os filtros de situação subiram para a linha do chip de leitura, e a lista ficou só com a busca por
  placa. As contagens continuam sendo sobre a frota inteira, e não sobre o filtro aplicado.
- **Cinco modos** (`MAP_BASES`), com os nomes do painel de referência do usuário: Minimalista
  (positron), Ruas (liberty), Vivo (bright), Escuro (dark) e Noturno (fiord). Os cinco foram
  conferidos contra o provedor, um a um: responderam 200 e trazem estilo de verdade (48 a 119
  camadas). ⚠️ Estilo inexistente não dá erro visível, o mapa fica em branco.
  E **não existe satélite** no OpenFreeMap: isso exigiria outro provedor, com chave, e chave no
  navegador é chave publicada.
- ⚠️ **A base escolhida VENCE o tema.** Quem escolheu o noturno escolheu o noturno, e uma troca de
  tema não pode desfazer. O ouvinte de `styledata` continua sendo quem remonta as camadas depois do
  `setStyle`, e foi conferido que os caminhões 3D sobrevivem à troca de base.
- ⚠️ **Os três controles do mapa vivem JUNTOS no canto superior direito** (05/09/2026): o modo do
  mapa em MENU (fechado ocupa a largura de um rótulo), mais os ícones de inclinar e de eventos na
  rota. Em linha, os cinco modos mais a legenda mais dois ícones não cabiam com a ficha aberta:
  quebravam para a linha de baixo e saíam do canto. O cartão de duas linhas dos eventos virou ícone
  com dica no `title`: quem opera todo dia não precisa reler "ative o mapa de calor" toda vez.
- O drawer virou seções com LINHAS (ícone e rótulo à esquerda, valor à direita), no lugar da grade
  de duas colunas, que numa coluna estreita quebrava o rótulo e separava o valor do par.
- ⚠️ **A frase sobre a rede CAN e a temperatura saiu da tela** a pedido do usuário em 05/09/2026. O
  motivo dela continua valendo e está no cabeçalho do `vehicle-drawer.tsx`: o RPM é da viagem, e
  temperatura não existe no schema. Quem for acrescentar temperatura precisa de origem primeiro.
- ⚠️ **A inclinação não se julga por captura de tela.** Cheguei a concluir duas vezes que o botão
  não funcionava, olhando o mapa em zoom regional: a 55 graus, sobre base sem prédio, a perspectiva
  é sutil demais. O container agora escreve `data-pitch` e `data-bearing` no DOM, e a medição
  mostrou 0 → 55 → 0. Julgar ângulo por imagem foi erro meu; o atributo existe para não repetir.
- O drawer mostra o que a telemetria REALMENTE tem: velocidade, direção, odômetro e posição ao vivo,
  mais RPM máximo, velocidade máxima, distância e combustível **da última viagem**. ⚠️ O RPM existia
  no banco (`vehicle_journeys.max_rpm`) e não chegava ao frontend: foi exposto no DTO do
  `Backend-web`. **Temperatura não existe em lugar nenhum do schema** (conferido coluna a coluna), e
  por isso não aparece: a regra é não preencher com zero o campo que a telemetria não tem.
- O modelo 3D gira no alto do drawer, hoje o mesmo `truck.glb` para toda placa. A escolha do arquivo
  mora numa função só (`modeloDoVeiculo`), para o dia em que houver um GLB por tipo de veículo.
- ⚠️ **A gaveta encosta na BORDA DA TELA por margem negativa** (pedido do usuário em 05/09/2026).
  Aberta, o `aside` é `w-[380px] -mr-10`, e o `-mr-10` cancela o `xl:px-10` da página: sem isso
  sobrava uma faixa de fundo à direita e parecia que a gaveta tinha parado antes de chegar. A
  margem entra na MESMA transição da largura (`transition-[width,margin]`), senão os 40 pixels
  apareceriam de um quadro para o outro. O 40 é literal: mudar o padding da página pede mudar aqui.
  Medido com a gaveta aberta a 1720 de largura: `aside.right` = 1720, sem folga.
- A ficha de dentro é `w-full`, e não mais `w-[340px]`: com largura fixa ela deixava 40 pixels de
  vão dentro da própria gaveta depois que o `aside` passou a 380.
- O giro do modelo 3D é `0.0022` radiano por quadro, uma volta a cada 48 segundos. Estava quase três
  vezes mais rápido e o usuário pediu para desacelerar: quem lê a ficha ao lado não pode ter um
  movimento puxando o olho o tempo todo.
- **A tela ABRE inclinada e no modo Ruas** (pedido do usuário em 05/09/2026). O `pitch: 55` e o
  `bearing: -20` estão na criação da instância, e são os MESMOS números do botão de inclinar: ele
  decide o que fazer olhando `getPitch() > 5`, então um ângulo inicial diferente deixaria o ícone
  dizendo uma coisa e a câmera mostrando outra. O estado `inclinado` da página nasce em `true` pelo
  mesmo motivo. O `fitBounds` de abertura já preservava `pitch` e `bearing`, e é por isso que o
  enquadramento inicial não desfaz o ângulo.
- ⚠️ **O caminhão 3D some atrás da base quando o mapa está inclinado, e a correção é
  `renderer.clearDepth()`.** O MapLibre grava profundidade nas camadas opacas do estilo, um degrau
  por camada, e esse número é sintético: serve só para ordenar camadas 2D. A 55 graus, um caminhão
  longe do observador é projetado com profundidade perto de 1, e numa base cheia de camadas (a de
  Ruas tem 119) os degraus da base ficam abaixo disso: o teste reprova o caminhão e ele desaparece
  atrás de uma área verde ou da água, sem erro no console. Quem olha conclui que a telemetria
  parou. Limpar o buffer antes de `render` apaga os degraus; a profundidade ENTRE os caminhões
  continua valendo, porque o three grava a dele depois. O preço aceito pelo usuário: prédio em 3D
  também deixa de esconder o caminhão.
- Conferido nas CINCO bases, com o mapa inclinado: Ruas, Escuro, Vivo, Noturno e Minimalista, todas
  com a frota desenhada por cima.
- O botão de trajeto virou RODAPÉ do drawer, com traço próprio e largura cheia. Quem rola agora é o
  miolo, e não a caixa inteira: com a caixa rolando, o botão ficava no fim do conteúdo, saía da
  tela numa ficha alta e encostava na última linha de dado numa ficha baixa.
- ⚠️ **O miolo do drawer leva `overscroll-contain`**, pelo mesmo motivo da caixa de notificações:
  chegar no fim e insistir na roda fazia o navegador passar a rolagem para a página, e a tela
  inteira descia enquanto a pessoa achava que ainda estava lendo o veículo. Provado por contraste
  no navegador, com a roda de verdade: com a contenção, a página fica em 0 depois de 1800 pixels de
  insistência; desligando `overscroll-behavior` no ar e repetindo o mesmo gesto, ela vai para 46,
  que é o fim dela. Toda caixa rolante nova desta tela precisa da mesma classe.
- ⚠️ **A linha reta que o trajeto desenha em trecho sem rua NÃO é defeito do mapa** (apurado em
  06/09/2026, a partir do RDU8D06). O desenho liga leitura a leitura, a consulta ordena por
  `recorded_at` e a resposta real veio com zero pontos fora de ordem: a reta é a lacuna entre uma
  posição e a seguinte. No RDU8D06 foram 413 posições em 72 horas, em 8 rajadas curtas, contra 46
  viagens no mesmo período somando centenas de quilômetros (41, 55, 73, 80 km): as VIAGENS chegam
  da MiX, as POSIÇÕES não chegam na mesma densidade. A frota inteira grava de 300 a 500 posições
  por veículo por dia, uma a cada 3 a 5 minutos, e não as 2.863 diárias que o comentário do
  `FleetController` assume.
- ⚠️ **E não é culpa de o backend local ficar desligado.** A coleta guarda `since_token` por fluxo
  e recupera retroativamente: a ingestão ficou 18 horas parada em 05/09 e, ao voltar às 21:42,
  gravou posições com `recorded_at` das 15:02 daquele dia, dentro da janela parada. Nas horas em
  que o RDU8D06 ficou mudo, outros veículos reportaram normalmente. Antes de culpar o ambiente
  local, comparar a lacuna do veículo com a da frota na mesma hora: se a frota reportou, o buraco
  é do fornecedor.
- ⚠️ **CORREÇÃO (06/09/2026): era, sim, o backend local desligado.** A primeira conclusão foi
  errada e a medição em produção provou: lá o mesmo RDU8D06 tem **13.565 posições em 72 horas**
  contra 413 aqui, e **um único salto acima de 3 km** (3,3 km com zero minuto de intervalo, que é
  ruído de GPS, não lacuna). Produção roda 12 ciclos por hora, sem nenhuma parada acima de 30
  minutos em 7 dias, e grava de 4.000 a 4.400 posições por veículo por dia. A base local ficou
  ligada cerca de 7 horas em 72, e o cursor não recupera o atrasado nesse ritmo: cada ciclo drena
  cerca de 1.000 registros além do corrente, e 18 horas paradas acumulam 116 mil. Com o teto de 7
  dias do `sinceToken`, o que não for drenado nessa janela se perde de vez.
- **Conclusão para quem for depurar: buraco no trajeto local não é bug, é a base local.** Antes de
  investigar código, comparar com produção (`ssh lucas@144.22.177.229`, container
  `rookhub-postgres-1`). Comparar também a lacuna do veículo com a da frota na mesma hora.
- **O mapa passou a separar trecho MEDIDO de LACUNA** (06/09/2026), que é o `gaps=split` do OSRM
  feito por nós. `track-segments.ts` quebra a rota quando passa de 5 minutos ou 1 km entre
  leituras, e descarta o ponto cuja velocidade implícita passe de 200 km/h, que é coordenada
  impossível e não excesso de velocidade. O traço sólido é o que foi medido; o vão vira tracejado
  fino e apagado, e o cartão diz quantos são e o tamanho do maior. ⚠️ **A lacuna é desenhada, não
  apagada**: sumir com ela esconderia buraco de cobertura, que é informação de operação.
- ⚠️ **Reta entre dois pontos não é errada por si.** A Geotab reduz a série com Ramer-Douglas-
  Peucker (1116 pontos para 148 num exemplo publicado) e a garantia do método é que entre dois
  pontos guardados o movimento é aceitavelmente linear. O que o nosso limiar separa é a reta que
  só existe porque faltou dado.
- O prop `track` do `FleetMap` recebe `TrajetoPreparado`, e não mais lista de coordenadas. A linha
  virou `MultiLineString`, um traço por trecho.
- ⚠️ **O replay engasgava porque avançava por ÍNDICE DE PONTO** (corrigido em 06/09/2026). O
  índice mede quantidade de dado, não passagem de tempo: parado no semáforo, dezenas de leituras
  iguais plantavam o caminhão; numa lacuna, duas leituras consecutivas a 20 km eram atravessadas
  num décimo de segundo. Medido nos dados REAIS de produção (3.495 pontos em 24 h), com 240
  amostras: por índice, o maior avanço era **9,5 vezes a média**; por tempo, **3,1 vezes**, com a
  mesma média. `track-timeline.ts` é o relógio do replay.
- O replay agora dura sempre 40 segundos a 1x, seja a janela de 6 ou de 72 horas. Parada longa é
  comprimida (teto de 30 s de tempo real por passo) e lacuna custa um valor fixo, para o caminhão
  atravessar o vão devagar e visivelmente em vez de teleportar.
- **O marcador do replay é o caminhão 3D em âmbar** (`definirReplay` na `fleet-3d-layer`), 35%
  maior que os da frota. O crachá 2D continua montado como PLANO B e é escondido por
  `setLayoutProperty` quando `modelo3dPronto`: se o GLB falhar, o replay não fica sem marcador.
- O giro do caminhão do replay PERSEGUE o rumo alvo (16% do que falta por quadro) em vez de saltar
  para ele. Sem isso, uma curva de 90 graus acontecia num quadro e o modelo piscava. No arrasto do
  slider a perseguição é desligada, senão ele rodopiaria até alcançar a direção nova.
- ⚠️ **Parada NÃO é lacuna, e isso só apareceu nos dados de produção.** Com o critério só de tempo,
  o RDU8D06 tinha 70 "trechos sem leitura" em 24 h, quase todos o caminhão parado no pátio. A
  condição passou a exigir tempo longo E deslocamento acima de 50 m: os mesmos dados viraram **1
  lacuna e 2 trechos**, com 3.486 dos 3.495 pontos dentro de trecho contínuo.
- **Validar algoritmo de trajeto com dado de PRODUÇÃO, não com o local.** O caminho usado: exportar
  o trajeto por `ssh` + `psql` para JSON e rodar as funções puras sobre ele num teste temporário. O
  falso positivo da parada era invisível na base local, porque lá quase tudo é lacuna de verdade.
- O selo de caminhão que ficava à direita de "Monitoramento da frota" saiu: não clicava, não
  informava nada além do título, e num cabeçalho sem moldura lia como um botão que não é botão.
- **Para ver a tela com dados de produção**, sem tocar no ambiente local: a API pública responde em
  `https://api.rookhub.com.br` (401 sem token, que é o esperado), então basta uma segunda instância
  do Vite, `VITE_API_BASE_URL=https://api.rookhub.com.br npx vite --port 5180`. O dev server da
  pessoa continua intacto na 5173, e o login é com conta de PRODUÇÃO. ⚠️ A instância morre com a
  sessão do agente, que é a regra do projeto: nada de agendador nem serviço.
- **A dica do mapa foi redesenhada** (06/09/2026): placa, selo de situação com o ponto na cor do
  status, velocidade em corpo grande, e então motorista, empresa e local. Linha sem dado não
  aparece, em vez de aparecer vazia. O estilo saiu do preto fixo `rgb(11 11 14)` e passou a usar os
  tokens da paleta, então ela acompanha o tema. ⚠️ Todo valor passa por `escapar`: nome de
  motorista e de empresa vêm da telemetria do fornecedor, que é entrada externa.
- ⚠️ **A EMPRESA precisou de mudança no `Backend-web`**: `vehicle_last_positions` não trazia nada
  disso, e a consulta de posições passou a subir por `COMPANY_JOIN` até `fleet_companies`. É a
  empresa, e não a filial crua da MiX, pelo motivo já registrado lá: 14 dos 40 caminhões moram no
  "Default Site".

### O replay ganhou animação e câmera de perseguição (06/09/2026)

Pedido do usuário, e as três armadilhas abaixo custaram uma captura de tela cada.

- **O caminhão do replay anda de verdade**: as rodas giram na conta física (um metro percorrido
  gira a roda 1/raio radianos), o corpo balança de leve e sai fumaça do escapamento. Tudo
  proporcional à VELOCIDADE REAL do marcador, medida entre dois quadros: animação por relógio solto
  deixaria a roda girando com o caminhão parado no semáforo.
- ⚠️ **`sizeAttenuation: true` NÃO funciona nesta camada.** O three calcula `gl_PointSize` a partir
  do Z do espaço da câmera, e aqui a projeção inteira vem do MapLibre por uma matriz montada à mão,
  com `modelViewMatrix` identidade: a conta dá tamanho perto de zero e a fumaça some, sem erro no
  console. O tamanho é em PIXELS, como o do caminhão.
- ⚠️ **`AdditiveBlending` some sobre base clara.** Aditivo com cor clara sobre branco continua
  branco, e a fumaça sumia nos modos Ruas, Vivo e Minimalista. Mistura normal, com cinza médio.
- ⚠️ **`PointsMaterial` sem `map` desenha QUADRADO sólido**, e 28 quadrados sobrepostos viram um
  bloco com quinas. A textura é um disco com gradiente, desenhado em canvas na montagem.
- ⚠️ **Partícula guarda MERCATOR, não a posição no espaço local.** O espaço local é recriado a cada
  quadro com origem no centro visível: guardar a posição nele fazia a fumaça andar colada na tela
  em vez de ficar para trás no chão.
- O balanço vai no FILHO do grupo, e não no grupo: o grupo já gira em Z para apontar o rumo, e uma
  segunda rotação nele acontece em torno de um eixo fixo do mundo, então o caminhão balançaria
  sempre para o mesmo lado geográfico.
- ⚠️ **A roda precisa de um PIVÔ no próprio eixo, senão ela orbita o caminhão.** O GLB do Quaternius traz as rodas como nós irmãos da carroceria, com a geometria já posicionada e o pivô na ORIGEM do modelo: `roda.rotation.x` fazia cada uma descrever uma órbita em volta do centro do veículo. Parado quase não se nota; numa curva fechada elas descolam e ficam boiando ao lado, que foi a reclamação do usuário em 06/09/2026. `comPivoNoEixo` mede a caixa da roda, cria um grupo no centro dela e a pendura ali. A função foi extraída para o módulo só para poder ser testada sem WebGL, e `wheel-pivot.test.ts` trava os dois lados: com o pivô o centro não se move nem numa meia-volta (menos de 1e-6), sem ele a roda anda mais de 0,9 unidade.
- O acumulador do giro leva módulo de uma volta: a velocidade do marcador é alta (um dia cabe em 40 segundos) e sem isso ele chega à casa dos milhões, onde o `float32` da GPU já não distingue um quadro do seguinte.
- ⚠️ **A fumaça é emitida por DISTÂNCIA percorrida, e não por quadro.** Emitindo por quadro, com vida de 1,4 s, o rastro ficava quilométrico: o replay comprime um dia em 40 segundos, então o marcador percorre centenas de metros por segundo de tela. Agora sai uma baforada a cada meio comprimento de modelo, com vida de meio segundo e 14 partículas, o que dá uma nuvem curta junto ao escapamento.
- **A câmera segue o caminhão ao dar play**, em vista de perseguição (pitch 60, zoom 16, giro
  acompanhando o rumo), e volta ao enquadramento anterior na pausa ou no fim. O enquadramento de
  origem é guardado na entrada: sem isso a pessoa terminaria o replay num zoom de rua sem relação
  com o que tinha antes.
- ⚠️ **`jumpTo` CANCELA `easeTo`.** A entrada era animada com `easeTo` e o laço perseguia com
  `jumpTo` a cada quadro: o `jumpTo` matava a animação no quadro seguinte e o pitch ficava nos 55
  que a tela já tinha, sem nunca chegar aos 60. Agora o próprio laço aproxima zoom e inclinação e
  solta os dois ao alcançá-los, para a pessoa poder dar zoom durante o replay.
- O aviso de play sai de um EFEITO, e não do clique: o replay também termina sozinho ao chegar ao
  fim, e ali não há clique nenhum. Sem isso a câmera ficaria presa na perseguição.

### A roda do mouse e o ritmo do replay (09/09/2026)

Dois pedidos do usuário sobre o mapa ao vivo, no mesmo dia, os dois com causa fora do lugar óbvio.

- ⚠️ **A página dava um solavanco vertical no meio do zoom, e a culpa é da ÁRVORE, não do
  MapLibre.** Ele escuta `wheel` no `.maplibregl-canvas-container`, e a legenda, a barra do topo e o
  painel do trajeto são **irmãos** do container do mapa, desenhados por cima com `absolute`. Girar a
  roda sobre qualquer um deles nunca chegava ao mapa, e quem rolava era a página. Para quem usa não
  existem duas camadas: o cursor está "no mapa" e o que se espera é zoom. A correção é um ouvinte na
  **captura** da moldura (`live-map-page.tsx`), que barra a rolagem em todo o retângulo e reenvia o
  giro ao canvas pelo `zoomComRoda` do `FleetMapHandle`.
- ⚠️ **O reenvio é o MESMO evento, clonado, e não uma conta de zoom escrita à mão.** O passo, a
  suavização e a âncora sob o cursor continuam sendo os do MapLibre. O clone nasce com `isTrusted`
  falso, e é isso que corta o laço: ele volta a passar pela captura da moldura, que só trata giro de
  verdade. Sem esse guarda, recursão infinita.
- ⚠️ **Cuidado ao pôr qualquer coisa ROLÁVEL dentro da moldura do mapa.** O ouvinte barra a rolagem
  do retângulo inteiro. Hoje não há nada com `overflow` lá dentro (o menu de base usa Portal e a
  gaveta da ficha é irmã da moldura), e quem acrescentar uma lista rolável ali precisa abrir exceção
  no ouvinte, senão ela não rola.
- **O replay estava quatro vezes rápido demais, e o usuário chamou o número certo**: "o 1x de hoje é
  na verdade o 4x". O `DURACAO_ALVO_S` do `track-timeline.ts` era 40 segundos para o trajeto inteiro,
  então um dia de rodagem passava em 40 segundos. Passou para **160**, e a escala inteira desceu
  junto: 2min40 a 1x, 1min20 a 2x e 40s a 4x, que é exatamente o 1x de antes. Medido no navegador com
  o replay correndo: ritmo 1,00 a 1x e 3,97 a 4x.
- A constante vale para QUALQUER janela (6h, 24h ou 72h), porque tudo é reescalado para ela. Mexer
  nesse número muda as três velocidades de uma vez, que é o ponto dela existir.
- Efeito colateral esperado e desejável na camada 3D: a velocidade do marcador caiu junto, então as
  rodas giram mais devagar e o balanço do corpo ficou mais discreto. Os dois são proporcionais à
  velocidade medida entre quadros, e antes ela era artificialmente alta.
- ⚠️ **A lista lateral acompanha quem foi escolhido NO MAPA**, rolando até a linha dele. Antes a
  linha ficava marcada, mas podia estar a trinta placas de distância, fora da área visível: a tela
  apontava para um lugar que ninguém estava vendo.
- ⚠️ **Quem rola é a LISTA, no `scrollTop` dela, e NÃO `scrollIntoView`.** Aquele método sobe
  rolando todos os ancestrais roláveis até achar espaço, e o de cima é a página: usá-lo aqui traria
  de volta o solavanco vertical que o ouvinte da roda tinha acabado de resolver, no mesmo dia.
- **Item já visível fica onde está.** Centralizar sempre faria a lista pular a cada clique nela
  mesma, inclusive na linha que estava debaixo do cursor. Perto das pontas o item também não chega
  ao centro, porque o scroll acaba antes, e isso é correto: medido, o 36º de 37 para em 59px do
  centro.
- ⚠️ **Se o filtro ou a busca escondem o veículo escolhido, não há linha para centralizar** e o
  efeito não faz nada. É o caso de escolher no mapa um "em viagem" com o filtro em "sem sinal".
- **A pastilha do frescor ficou LARANJA e desceu 8px**, os dois a pedido do usuário. O deslocamento
  é `translate-y-2`, e não margem: `translate` não ocupa espaço no layout, então o segmentado de
  filtros ao lado não sai do lugar, que era a condição do pedido.
- ⚠️ **A pastilha do frescor da leitura voltou da faixa laranja para a linha dos filtros**, no mesmo
  dia e a pedido do usuário. ISSO REVERTE a mudança registrada em `Mapa ao vivo como central de
comando`, e o comentário que justificava a ida para a faixa foi reescrito no lugar. O desenho
  mudou junto, e tinha de mudar: sobre a faixa o estado era dito invertendo a pastilha para branco
  cheio, e no painel claro isso desapareceria. Agora em dia ela é o mesmo poço (`bg-light-container`)
  do trilho de filtros ao lado, e atrasada vira `bg-warning-on-light/12` com texto âmbar, que é a
  pastilha de alerta que o resto do painel já usa.

### Hover do sair e contraste do menu superior (06/09/2026)

- ⚠️ **O botão de sair do `/app` tinha DOIS defeitos, não um.** Medido: no hover a cor ia de
  `rgb(225,29,72)` para `rgb(25,24,23)`, quase preto, E aparecia um anel vermelho de 2px.
- A cor preta vinha do `focus:text-secondary-foreground` que o `DropdownMenuItem` traz na base. O
  Radix FOCA o item quando o cursor passa por cima, então tudo que é `focus:` dispara com o mouse,
  e o item só cancelava o fundo (`focus:bg-transparent`), não o texto.
- ⚠️ **Um seletor mais específico não resolve isso.** Utilitário do Tailwind vence
  `@layer components` por CAMADA. A regra precisou ir para `@layer utilities`, no fim do
  `globals.css`, como `.acao-sair-no-menu`. Foi a segunda tentativa: a primeira, em `components`,
  não pegou, e a medição mostrou a cor voltando ao preto.
- O anel saiu por completo, e isso é a decisão registrada do projeto: hover de botão só-ícone move
  a COR, nunca desenha forma nova. Ele estava em `focus-visible` no item, que disparava com mouse.
- **O contraste do menu superior do `/gestao` subiu**, a pedido do usuário. O véu do item não
  selecionado foi de 6% para 12% de `on-surface`: a 6% o fundo era indistinguível do papel, e o
  único sinal acabava sendo o texto escurecer.
- O degrau da pastilha ativa foi de `#2A2724` para `#3A3531` no tema claro, e de `#E9EDF2` para
  `#DDE3EA` no escuro. ⚠️ Catorze pontos de luminosidade não se enxergam numa pastilha pequena;
  com trinta a resposta ao cursor aparece. Contraste contra o texto segue em 10,8:1 e 14,4:1,
  muito acima do mínimo AA de 4,5:1.

### O painel `/app` começou a falar com a API real (06/09/2026)

- Até aqui o `/app` inteiro era servido por `services/api.ts`, que importa os mocks diretamente.
  **Veículos é o primeiro domínio a atravessar**, em `services/vehicle-api.ts`, e é o caminho que
  os outros devem seguir. A chave é a mesma do `/gestao` (`VITE_ENABLE_MOCKS`), e não é fallback:
  backend fora mostra erro, e não dado de demonstração disfarçado de real.
- ⚠️ **Os dois painéis modelam veículo de formas diferentes**, e a tradução mora no adaptador, não
  nas telas: situação (`EM_VIAGEM` contra `on_trip`), motorista (nome contra objeto com id) e
  número de frota (`internalCode` contra `fleetNumber`).
- ⚠️ **`SEM_SINAL` vira `stopped`, e a tradução PERDE informação.** São coisas diferentes: parado é
  um caminhão que reportou e não anda; sem sinal é um caminhão que ninguém sabe onde está. O
  `/app` não tem o segundo estado no vocabulário, e inventar um valor fora da união quebraria os
  mapas de rótulo e de cor em silêncio. Acrescentar `no_signal` pede mexer em `status-maps`, nas
  abas de filtro e na legenda do mapa.
- **O backend passou a expor `criticality`** na rota de veículos: a coluna existia e não estava no
  DTO. ⚠️ Os 40 veículos estão em `low`, que é o padrão da migration e não classificação de
  ninguém. Quem usar isso para priorizar precisa saber que o campo espera curadoria.
- Dois defeitos de apresentação que a ponte trouxe e foram corrigidos: o odômetro vinha com casas
  decimais e a tela mostrava "206.572,953 km"; e o ano ausente virava "· 0" ao lado do modelo, o
  que lê como defeito. Zero é AUSÊNCIA de ano, e agora é omitido.
- ⚠️ Criação e edição de veículo continuam SEM caminho real e lançam 501. O backend tem as rotas,
  mas o formulário do `/app` fala outro vocabulário: falhar alto é melhor que gravar metade do
  formulário em silêncio.
- A lista é paginada no CLIENTE: `/v1/vehicles` devolve a frota toda, 40 linhas. O sinal para
  mudar isso é a resposta passar de alguns milhares.

### Busca e categorias na mesma linha em Custos (09/09/2026)

Pedido do usuário: as pastilhas de categoria (Caminhão, Van) foram para a direita do campo de busca,
em vez de empilhadas embaixo dele. São os dois controles do mesmo recorte, e empilhados empurravam o
ranking para baixo da dobra num notebook.

- ⚠️ **O `gap-1.5` da coluna das categorias repete o do `GlassInput`**, que é quem separa o rótulo do
  campo lá dentro. Sem copiar esse número, o "Por categoria" e o "BUSCAR" saem em alturas diferentes
  e as duas metades da linha parecem desencontradas. Conferido no navegador: os dois rótulos no
  mesmo `top`.
- **O grid das pastilhas caiu de `xl:grid-cols-5` para `xl:grid-cols-4`**, porque agora divide a
  linha com a busca. Sem isso as pastilhas ficariam estreitas demais no espaço que sobrou.
- Empilha abaixo de `lg`. Medido em 1920, 1440, 1100, 900 e 500px: lado a lado nos três primeiros,
  empilhado nos dois últimos, e nenhuma largura transborda na horizontal.
- **As próprias CATEGORIAS também ficaram lado a lado**, no mesmo dia e a pedido do usuário: sem
  filtro escolhido a tela mostra a frota inteira, e Caminhão em cima de Van empurrava a segunda para
  fora da dobra, de modo que comparar as duas exigia rolar até perder a primeira de vista.
- ⚠️ **Duas colunas só com MAIS DE UM grupo** (`grupos.length > 1 && 'xl:grid-cols-2'`). Com um só, o
  grid deixaria a lista em meia largura e a outra metade vazia, que é exatamente o estado logo depois
  de clicar numa pastilha de categoria. Conferido: com "Caminhão" escolhido a lista volta a ocupar
  os 1840px inteiros; sem filtro, cada categoria fica com 904px.
- ⚠️ **As colunas têm alturas diferentes de propósito**, e igualá-las seria erro: são 20 caminhões
  contra 6 vans, e esticar a menor só inventaria espaço vazio dentro dela. Daí o `items-start`.
- O corte é `xl` (1280px). Medido em 1920, 1600, 1440, 1280, 1100, 900 e 500: lado a lado até 1280,
  empilhado de 1100 para baixo, sem transbordo horizontal em nenhuma.

### O "Sair" do rodapé estava cinza, e eram dois empates (09/09/2026)

O usuário pediu o hover de botão só-ícone nos dois ícones do rodapé do menu do `/app`. Medido, o
hover **já estava certo**: o `compoundVariants` de `ghost + icon` no `ui/button.tsx` injeta
`acao-neutra hover:bg-transparent hover:text-on-surface` desde que a regra foi estendida ao painel
operacional. A cor andava e nenhum fundo aparecia.

⚠️ **Mas o botão "Sair" saía CINZA, igual ao de configurações ao lado**, quando o próprio arquivo diz
que ele é a cor de remover. Duas causas somadas, e cada uma pede um lugar diferente:

- **Cor de repouso**: o `cn` não sabia que `.acao-neutra` e `.acao-sair` disputam a mesma coisa, e as
  duas ficavam na string; vencia a que o `globals.css` declara por último, que é a `.acao-neutra`.
  Resolvido em `lib/utils.ts`, ensinando o grupo ao `tailwind-merge` com
  `extendTailwindMerge<'acao'>`. ⚠️ O `'acao'` no parâmetro de TIPO é obrigatório: sem ele o
  TypeScript só aceita os ids de fábrica e acusa `TS2353`.
- ⚠️ **`.acao-sair-no-menu` NÃO entra nesse grupo.** Ela não é uma sexta cor, é um reforço que anda
  junto com `.acao-sair` na mesma string (ver `user-menu.tsx`). No grupo, o merge descartaria uma
  delas e o botão perderia repouso ou hover.
- **Hover**: o `hover:text-on-surface` do mesmo `compoundVariants` é utilitário, e utilitário vence
  `@layer components` por CAMADA. Resolvido pondo `.acao-sair:hover` em `@layer utilities` no
  `globals.css`, ao lado da `.acao-sair-no-menu`, que existia pelo mesmo motivo.
- Medido depois, no operador: repouso `rgb(225,29,72)` e hover num vermelho mais fechado, sem fundo
  em nenhum dos dois estados; a engrenagem segue cinza andando para o texto cheio. Na manutenção a
  cor de repouso confere e a regra de hover está no CSSOM: o rodapé é o MESMO componente para os dois
  perfis, sem ramificação.

⚠️ **A regra do projeto continua valendo e foi reconfirmada pelo usuário**: hover de botão só-ícone
move a COR DO TRAÇO, nunca desenha anel nem fundo. Quando ele falou em "hover no contorno", era o
traço do ícone, e não uma borda nova.

⚠️ **Armadilha de teste que repetiu:** `locator.click()` e `locator.hover()` do Playwright não
acionam elemento que seja `TooltipTrigger asChild` do Radix, e no menu recolhido o botão de expandir
é um. O que funciona é `element.click()` por `page.evaluate`. Quando nem o `:hover` registra, a prova
que resta é ler a regra no CSSOM (`document.styleSheets`), que é determinística.

### A espera e o trilho do /app copiaram o painel de gestão (09/09/2026)

Dois pedidos do usuário no mesmo dia, os dois de consistência entre os quatro perfis.

- **A espera das telas do `/app` virou a do `QueryState` do gestão.** O `LoadingState` mostrava um
  giro de 16px com o rótulo escrito ao lado (`py-12`); agora é o giro de 24px sozinho, centrado num
  bloco `min-h-60`, exatamente como no painel de gestão. Vale para as seis telas do `/app` que o
  usam e para o `PageFallback` do carregamento de módulo, que dizia "Carregando módulo…".
- ⚠️ **O rótulo NÃO sumiu, mudou de lugar**: foi para o `aria-label` do próprio SVG, que é como o
  giro do gestão anuncia a espera. Ler "Carregando ordens…" a cada navegação é ruído para quem
  enxerga, e apagar de vez seria silêncio para quem não enxerga. Medido na tela: giro 24x24, bloco
  de 240px, `aria-label="Carregando ordens…"` e texto visível vazio.
- **O trilho lateral do `/app` ganhou a curva e os tempos do drawer do assistente**: `ease-out` no
  lugar de `ease-in-out`, com 300ms para abrir e 200ms para fechar. Conferido no navegador:
  `cubic-bezier(0, 0, 0.2, 1)` nos dois sentidos, `0.3s` ao expandir e `0.2s` ao recolher.
- ⚠️ **O tempo mora na classe do ESTADO ALVO**, e é isso que faz a assimetria funcionar: quando
  `collapsed` vira verdadeiro, a transição para 84px já lê `duration-200`; a volta para 256px lê
  `duration-300`. Pôr os dois na classe fixa daria um tempo só.
- ⚠️ **Igualar mais que a curva não dá, e o motivo é estrutural.** O drawer desliza uma peça pronta
  por `transform`; o trilho anima LARGURA, que custa refluxo a cada quadro, e ainda TROCA o conteúdo
  no caminho (a marca vira o símbolo, o botão muda de lugar, os rótulos somem). Deixar o trilho
  flutuar sobre o conteúdo, como o drawer faz, mudaria o layout do painel inteiro, porque hoje ele
  empurra a coluna em vez de cobrir.

⚠️ **Armadilha de teste, não de código:** emular rede lenta pelo CDP (`Network.emulateNetworkConditions`)
para observar o estado de carregamento **travou a página duas vezes**, e o `page.goto` seguinte
estourou o tempo mesmo depois de restaurar as condições. Foi preciso derrubar o navegador. Para ver
um estado que passa rápido, o caminho que funcionou foi um `MutationObserver` na página guardando a
primeira ocorrência, sem mexer na rede.

### As telas de entrada passaram a caber na janela (10/09/2026)

A `.tela-proporcional` saiu do login e da voz e virou o padrão das telas de entrada, a pedido do
usuário: 404, sessão expirada, esqueci a senha e o hub de escolha.

- **Cada tela tem a própria referência, e o número sai de MEDIÇÃO** com o zoom desligado, nunca de
  chute. As alturas naturais medidas: 404 com **404px**, esqueci a senha com **608px**, sessão
  expirada com **676px**, hub com **781px** ou **917px**, e o resto é folga.
- ⚠️ **O hub precisou de DUAS referências**, 940px e 820px, porque ele já muda de tamanho sozinho no
  breakpoint de `max-height: 800px`: acima o conteúdo pede 917px, abaixo pede 781px. Uma referência
  única serviria mal um dos lados. As duas moram no `hub.css`, a segunda dentro daquela media query.
- ⚠️ **No hub a técnica SAI abaixo de 801px de largura, e isso é deliberado.** Ali ele empilha em uma
  coluna e o conteúdo sobe para cerca de 1150px: forçar a janela espremeria a tela a 70% num
  celular, o que é pior que rolar. A media query devolve `zoom: 1`, `height: auto` e o `min-height`.
  O login e o esqueci a senha NÃO precisaram disso, porque o conteúdo deles cabe mesmo no telefone.
- ⚠️ **O `min-h-svh`/`min-h-dvh` saiu das telas que receberam a classe.** Ela já define a altura
  exata, e manter os dois deixaria duas fontes para a mesma medida.
- ⚠️ **Comentário JSX não pode ficar entre o `return (` e o elemento raiz**: vira um segundo filho e
  o TypeScript acusa `TS1005`. A nota de cada tela ficou como bloco `/* */` antes do `return`.
- Conferido em 1920x1080, 1600x900, 1440x850, 1366x768, 1280x720, 1280x650 e nos telefones 390x844 e
  360x740: nenhuma rola nem corta no desktop, e o hub rola só no telefone, como decidido.

### A escala do login deixou de encolher demais (10/09/2026)

O usuário entrou pelo notebook da empresa e achou os campos pequenos. A técnica de caber na janela
sem rolagem estava certa, o que estava errado era a calibragem.

- ⚠️ **A `--altura-de-referencia` da `.tela-proporcional` virou parâmetro.** O padrão de 1080px
  continua e é a janela em que a tela de VOZ foi aprovada; o login passou a declarar **900px**. Sem
  isso, mexer no login mexeria na voz junto.
- **O número saiu de medição, não de gosto.** Com o zoom desligado, o conteúdo do login ocupa 725px,
  e o estado mais alto (login com mensagem de erro) ocupa **815px**. Com os 48px de respiro do
  `main`, o pior caso pede **863px**, bem abaixo dos 1080 que a referência assumia: por isso a tela
  encolhia sem necessidade.
- **O ganho medido é de ~20%** na altura dos campos: 37px para 44px em 1366x768, e 43px para 52px em
  1600x900, que passou a rodar em escala 1.
- Conferido em 1080, 900, 768, 720 e 650px de altura, no estado normal e **com erro na tela**: a
  página não rola, a coluna não rola por dentro, e o botão Entrar e a mensagem de erro ficam
  inteiros à vista.
- ⚠️ **Mexeu no conteúdo do login ou do convite? Meça de novo com o zoom desligado.** Passando de
  900px em escala 1, a coluna da direita começa a rolar por dentro. Isso é a salvaguarda do
  `overflow-y-auto` e não quebra a tela, mas é o oposto do que se pediu aqui.
- O `ForgotPasswordPage` NÃO usa essa técnica: ele tem `main` próprio com `min-h-dvh` e rola normal.
  Quem herda a referência do login é o `InvitePage`, que divide o `AuthLayout`.

### O assistente virou um só nos quatro perfis (09/09/2026)

Relatado pelo usuário: no painel operacional a IA abria numa tela própria, e não no drawer. A
verificação achou coisa pior que um destino errado.

- ⚠️ **Eram DOIS assistentes, e o do `/app` não era assistente nenhum.** O `AiLauncher` fazia
  `navigate('/app/ia')`, e aquela tela **fabricava a resposta em código**: a função `buildAnswer`
  devolvia sempre o mesmo texto ("3 veículos da linha pesada com aumento de consumo acima de 9%"),
  com fontes e histórico fixos. Do outro lado, dono e gestor conversavam com `/v1/assistant/ask` de
  verdade pelo drawer. Operador e manutenção recebiam resposta inventada sem nada avisando.
- **Agora o `AppShell` monta o mesmo `AssistantDrawer` do painel de gestão** e liga o
  `useAssistantShortcut`, então Ctrl+K passou a valer nos quatro. O `title` do atalho flutuante já
  prometia o atalho antes de ele existir deste lado.
- ⚠️ **Importar do `management` no `/app` é de propósito.** Drawer, store e atalho são os MESMOS
  objetos, e uma cópia local divergiria na primeira correção. A sessão atravessa porque
  `management/features/auth/store` é uma ponte sobre o `session-store` único, e não um segundo store:
  isso é o que torna o drawer portável entre os dois painéis.
- **Saíram os TRÊS caminhos que levavam à tela**: a rota `/app/ia`, o item de menu "IA RookHub" e o
  botão do `ai-insight-card`, que agora abre o drawer e diz "Perguntar à assistente". O arquivo
  `pages/intelligence/ai-page.tsx` foi apagado.
- Conferido nos quatro perfis com as contas da seed: `manutencao@`, `operador@`, `gestor@` e `dono@`
  abrem o drawer com campo de pergunta, e o Ctrl+K também abre. O menu não tem mais o item e
  `/app/ia` cai na tela 404 do projeto, sem quebrar.
- ⚠️ **`botao.click()` do Playwright NÃO abre este atalho**, e isso é armadilha de teste, não defeito:
  o botão do `/app` é `TooltipTrigger asChild` do Radix. O clique programático (`el.click()`) e o
  mouse de verdade (`mouse.down`/`up` nas coordenadas) funcionam; o `.click()` do locator ficava sem
  efeito e me fez procurar defeito onde não havia.

⚠️ **Contexto que apareceu na varredura e vale para o painel inteiro:** o `/app` roda sobre MOCK.
`operatorService`, `maintenanceService`, `checklistService`, `alertService` e `dashboardService` todos
devolvem `mockResponse`, e a fronteira para o backend é `management/features/operator/api.ts`. O
dashboard do operador que o Vinícius refez em 09/09 é bonito e é maquete. Isso qualifica o aviso de
demonstração que foi posto na tela de Análise no mesmo dia: ele está certo, mas as telas vizinhas
estão no mesmo estado sem dizer.

### As animações do atalho da IA saíram (09/09/2026)

Pedido do usuário, sem meio-termo: "remova todas, não vai ter mais animações ali". Eram **20**
animações sorteadas, uma a cada **8 segundos** com o atalho parado, mais uma a cada `hover` ou
`focus`.

- Saíram os três lugares de uma vez: o hook `hooks/use-bot-animation.ts` (apagado), o uso nos dois
  atalhos (`management/components/layout/assistant-fab.tsx`, da gestão, e
  `components/layout/ai-launcher.tsx`, do operacional) e **69 regras** do `styles/globals.css`, entre
  classes `.bot-anim-*`, `.bot-eye`, `.bot-mouth` e os `@keyframes bot-*`. O CSS encolheu de 1.562
  para 891 linhas.
- ⚠️ **O bloco do CSS NÃO podia ser cortado de uma vez.** Entre a primeira e a última regra do bot
  moravam `.brand-gradient-text`, `.map-surface` e o ajuste da atribuição do MapLibre, que é o
  crédito obrigatório do OpenStreetMap. Recortar o intervalo inteiro levaria os três junto, e o do
  mapa é problema de licença, não de estilo. A remoção foi regra a regra, por seletor.
- `.bot-eye` e `.bot-mouth` já eram código morto antes disso: os dois atalhos mostram o logo num
  `<img>`, e o robô com rosto que aquelas regras animavam não existe mais em TSX nenhum.
- **O `hover:scale-105` FICOU**, nos dois, mas MUDOU DE ELEMENTO no mesmo dia. É transição de estado
  ao ponteiro, e não animação espontânea: tirá-lo deixaria o botão sem resposta ao mouse.
- ⚠️ **Escalar um elemento que contém `<img>` BORRA a imagem no hover**, e foi o que o usuário
  relatou logo depois: o logo ficava nítido parado e embaçado ao passar o mouse. O navegador
  rasteriza o conteúdo da camada uma vez e amplia o bitmap, em vez de redesenhar no tamanho final.
  Vale para SVG em `<img>` também, porque ali ele já virou bitmap no tamanho de layout.
- **A correção foi tirar o `img` de dentro da camada que escala**: quem cresce agora é um `span` de
  fundo (`absolute inset-0`, com a cor e o raio) e o logo fica por cima, sem transform. O quadrado
  continua expandindo igual, e o logo é desenhado uma vez, no tamanho final.
- ⚠️ **O `img` precisa de `relative`**: o fundo é `absolute` e, sem posicionamento, o logo seria
  pintado ATRÁS dele. Elemento posicionado pinta acima de não posicionado no mesmo contexto.
- ⚠️ SVG inline resolveria também, e melhor, mas **não é o padrão daqui**: o projeto não tem `svgr`, e
  até o `RookMark` usa `<img>`. Trocar isso seria mudança de arquitetura para um botão.
- Conferido no navegador, nos dois painéis, com a conta certa em cada um: `animationstart` observado
  por **20 segundos** (caberiam duas animações no ciclo de 8s) não disparou nenhuma vez, o `<span>`
  que recebia a classe sumiu do DOM e o CSS carregado tem **zero** regras `bot-anim`.

### A régua do consumo passou a ser a mesma em toda tela (09/09/2026)

Pedido do usuário: as médias de consumo não podiam divergir entre telas no mesmo período. Varri
`/gestao` (gestor e dono) e `/app` procurando toda média de veículo, e a divergência era uma só, mas
grande.

- ⚠️ **O card do dono tinha cálculo próprio, por MÉDIA DAS MÉDIAS.** Medido contra os dados de
  produção do dia: dava **4,55 km/l** para "truck" onde a régua ponderada dá **3,56**, uma
  superestimação de **27,7%**. Na van a diferença era de só 0,5%, porque as vans são homogêneas: é
  na categoria heterogênea que a média das médias erra feio. Agora ele chama o mesmo
  `aggregateFuel` da tela de Custos.
- Eram **três** divergências no mesmo lugar, e não uma: média das médias, contar veículo PARADO no
  período (Custos exclui) e mandar veículo sem categoria para `truck` em vez de `sem-categoria`.
- ⚠️ **A média do card do dono não aparece na tela**: ela decide quais consumos saem em VERMELHO
  (`text-error-on-light`; o âmbar da coluna ao lado é do motor parado, outra regra). Régua
  inflada gera ALERTA FALSO, que é pior que não alertar, porque quem confere perde a confiança na
  cor. O corte também foi alinhado, de 15% para os **10%** de Custos, senão o mesmo veículo ficava
  âmbar numa tela e normal na outra.
- **O impacto visível hoje é de UMA linha**: o QJC8352, a 3,46 km/l, deixa de ser destacado. O valor
  da correção está na consistência e no dia em que a frota mudar, não no efeito imediato.
- ✅ **A régua do front bate exatamente com a do backend.** Conferido em 09/09/2026 chamando as duas
  rotas: `aggregateFuel` sobre os 40 veículos dá **4,13 km/l**, o mesmo valor da métrica `consumo` de
  `/v1/fleet/operations`. O backend usa `km_medido / litros` em todas as consultas (ver a nota
  **QUILOMETRAGEM RODADA NÃO É QUILOMETRAGEM QUE ENTRA NO CONSUMO** no `FleetQueries` do
  `Backend-web`, de 06/09/2026). A média das médias sobre a mesma frota daria 5,90, ou 43% a mais.
- `fuel.test.ts` trava a régua: ponderação por km, quem não mede fica de fora sem virar zero, parado
  não entra, separação por categoria e o destino de quem não tem categoria.

**Auditado e correto, sem mexer:** `unit-performance-card` e os painéis de motorista usam
`avgFuelEfficiency` vindo do backend, já calibrado; `journey-list` e `vehicle-detail-panel` mostram o
valor de UM percurso ou de UM veículo, que não é média agregada; `/app` `fuel-page` pondera pelos
litros dos abastecimentos lançados à mão, que é outra fonte e outra pergunta.

**As duas pendências da varredura foram resolvidas no mesmo dia**, a pedido do usuário:

- ⚠️ **A referência das FILIAIS era média das taxas, e o erro era maior que o do consumo.** Medido nos
  dados de produção: 177,4 eventos por mil km contra **206,7** da conta ponderada, porque a filial
  GIG rodou só 2.222 km com 40 eventos por mil e puxava a régua de toda a frota para baixo. O efeito
  na tela era o oposto da intenção escrita no próprio bloco ("comparar com a melhor faria todas
  parecerem ruins"): **quatro das cinco filiais em vermelho, agora uma**. A conta certa é a mesma
  pergunta que a taxa faz: eventos da frota inteira sobre quilômetros da frota inteira.
- **A tela `/app` `analytics-page.tsx` passou a DIZER que é demonstração.** Ela mostrava "2,9 km/L"
  como "média da frota" enquanto `/gestao/custos` mostrava 4,13 para a mesma frota no mesmo período,
  sem nada avisando qual era o real.
- ⚠️ **Ligar aquela tela de a pouco foi descartado, e o motivo importa**: dos quatro números, só o
  consumo tem fonte direta hoje (a métrica `consumo` de `/v1/fleet/operations`); "Custo por km"
  depende do lançamento de despesa, que ainda não existe. Um número real ao lado de três inventados
  é PIOR, porque empresta credibilidade ao conjunto. Quando o custo tiver origem, a tela liga
  inteira e o aviso sai junto.
- ⚠️ **Nenhuma das duas telas pôde ser conferida no navegador**: a de filiais exige perfil DONO e a
  de Análise é do painel `/app`, e a sessão de teste é de gestor do painel de gestão. A validação
  foi por cálculo sobre os dados reais das rotas, mais typecheck, testes e lint.

### O consumo passou a ser agrupado por categoria (06/09/2026)

- A lista de consumo deixou de ser uma ordenação única e virou GRUPOS, cada um com a própria
  média. Medido na tela: Caminhão com 19 veículos e média 3,54 km/l, Van com 6 e média 10,43.
  Comparar os dois no mesmo ranking premiava a van todo mês.
- A média do grupo é ponderada pela QUILOMETRAGEM, e não a média das médias: um veículo que rodou
  200 km não pode pesar igual a um que rodou 3.000.
- Um veículo é destacado em âmbar quando está mais de 10% abaixo da média do próprio grupo. ⚠️ O
  corte existe para o destaque significar alguma coisa: marcar tudo abaixo da média marcaria
  metade da lista por definição.
- ⚠️ **O agrupamento EXPÕE o erro de cadastro em vez de escondê-lo**, e isso é proposital. Com os
  dados de hoje, o TPS6B93 aparece em "Caminhão" fazendo 13,28 km/l, e a SET2H49 (uma Renault
  MASTER) também. Os dois são erro de classificação, e agora estão visíveis para quem confere a
  ficha corrigir.

### Manutenção e ficha do veículo ganharam alerta mecânico (06/09/2026)

- A tela de Manutenção era só o aviso de origem ausente, e isso estava certo pela metade: ordem de
  serviço, oficina e plano de fato não existem, mas o rastreador acusa problema mecânico o tempo
  todo. Medido: **22.307 ocorrências em 30 dias, em 33 veículos**.
- A frota gera exatamente QUATRO tipos: pressão baixa do óleo Euro 6 (9.454), Euro 5 (9.435),
  temperatura alta do motor acima de 87 (1.995) e carga baixa da bateria (1.423).
- ⚠️ **CORREÇÃO: temperatura EXISTE, como evento.** O cabeçalho do `vehicle-drawer` dizia que ela
  não existia em lugar nenhum do schema. Certo sobre COLUNA, errado sobre a informação. Como é
  limiar disparado e não leitura contínua, continua não dando para mostrar "a temperatura agora",
  mas dá para contar quantas vezes passou do limite. O comentário foi corrigido.
- ⚠️ **A ressalva "não é diagnóstico" vem no CABEÇALHO do cartão, não num rodapé.** Quem lê "4.170
  ocorrências de pressão baixa de óleo" forma opinião antes de chegar ao fim, e a consequência
  aqui é caminhão parado indevidamente.
- A ficha do veículo em `/gestao/caminhoes` reusa a MESMA chave de cache da tela de Manutenção e
  filtra no cliente. São 40 linhas agregadas: uma rota por veículo custaria uma ida ao servidor a
  cada clique na lista.
- ⚠️ **A Entrega 4 do plano (detalhe do veículo em `/app`) é MAIOR do que o plano dizia.** A ficha
  do `/gestao` já era real e só precisou do bloco novo. Mas o painel `/app` é servido por
  `services/api.ts`, que importa mocks direto: não existe ponte para a API real ali. Fazer a
  entrega lá significa construir essa ponte, começando por veículos, e é decisão de escopo.

### O mapa da visão geral passou a ser real (06/09/2026)

- O cartão `Mapa da operação` de `/gestao` recebia `ActiveTrip`, um tipo de FRETE com destino,
  previsão de chegada e atraso. Nada disso existe na telemetria, então ele só podia ser alimentado
  por mock: a tela abria com placas `RKH...`, que não existem nesta frota, sobre o interior de São
  Paulo, com os caminhões verdadeiros no Rio de Janeiro. Um gestor que clicasse numa daquelas
  placas procuraria um veículo que não é dele.
- ⚠️ **O `FleetMiniMap` não conhece mais `ActiveTrip`.** Ele fala de `PontoDaFrota`, com id, placa,
  posição e uma marca de alerta. Quem chama decide o que é: hoje é a posição real, e amanhã pode
  ser a viagem planejada, quando ela existir.
- A consulta de posições é SEPARADA do `getFleetOverview`, que continua mock. Foi o que permitiu o
  mapa ficar real sem esperar o resto da tela ganhar origem. Usa a mesma chave do mapa ao vivo
  (`fleet-positions`), então quem vai e volta encontra cache em vez de uma segunda requisição.
- A faixa de placas ROLA na horizontal, e mostra a frota inteira (pedido do usuário em 06/09/2026,
  para ganhar altura no cartão). Chegou a ter um corte em doze, que existia só porque a lista
  quebrava em linhas: com a rolagem o motivo sumiu, e manter o corte passaria a esconder metade da
  frota. Medido: 36 pastilhas em 3.421 pixels de largura, numa faixa de 644 visíveis e 40 de altura.
- ⚠️ Três detalhes seguram a faixa: `shrink-0` nas pastilhas, senão o flex as espreme até caberem
  todas e a placa fica ilegível; `overscroll-x-contain`, senão o fim da faixa passa o gesto adiante
  e a página anda de lado; e `scrollIntoView` na pastilha ativa, porque dá para escolher o caminhão
  CLICANDO NO MAPA e a placa dele pode estar rolada para fora.
- No `scrollIntoView`, `block: 'nearest'` é obrigatório: o padrão é `start`, que rola a PÁGINA na
  vertical para alinhar o elemento no topo, e a tela inteira saltaria a cada clique.
- ⚠️ **A roda do mouse rola a faixa, e isso exige `addEventListener` com `passive: false`.** O
  `onWheel` do React NÃO serve: o React registra ouvintes de roda como passivos, e listener passivo
  não pode chamar `preventDefault`. Sem isso a faixa rolaria de lado E a página desceria junto, no
  mesmo gesto. Medido: 4 giros de roda levam a faixa de 0 a 880 pixels com a página parada em 400.
- A conversão só acontece quando o gesto é vertical (`|deltaY| > |deltaX|`): gesto horizontal de
  trackpad já funciona sozinho. E nas pontas o ouvinte sai do caminho, devolvendo o gesto à página
  em vez de deixá-lo morrer numa parede.
- Clicar na placa APROXIMA de verdade, com `ZOOM_AO_ESCOLHER = 13`, o mesmo do mapa ao vivo. Era
  `max(atual, 7)` e o enquadramento inicial da frota já para entre 7 e 9: na prática o clique só
  deslizava o mapa de lado, sem nunca aproximar. Entra como PISO, para não jogar para trás quem já
  estava no zoom de rua.
- ⚠️ **`STATUS_COLOR` virou arquivo próprio** (`features/live-map/status-color.ts`) em 06/09/2026.
  A tabela estava COPIADA em três lugares do mapa ao vivo (`fleet-map`, `vehicle-icons` e
  `fleet-3d-layer`), iguais por sorte, e o pedido de usar as mesmas cores no mapa da visão geral
  criaria uma quarta cópia. As três agora importam da fonte única, e `CORES_DA_GESTAO` é um alias
  dela.
- O painel do OPERADOR fica de fora: `components/shared/operation-map.tsx` tem paleta própria, com
  tokens do tema e outros nomes de status (`on_trip`, `available`). Unificar os dois é decisão de
  design, não de código.
- O mini-mapa da visão geral pinta por STATUS, e não mais indigo com âmbar para quem está sem
  sinal. Duas telas mostrando a mesma frota com códigos de cor diferentes obrigam quem opera a
  manter duas legendas na cabeça.
- ⚠️ **A rolagem da faixa é ANIMADA, e não um salto.** `scrollLeft += deltaY` joga a faixa uns
  duzentos pixels de uma vez e o olho não acompanha as placas passando. A roda move um ALVO e um
  laço aproxima a posição real dele a cada quadro, vencendo um quinto do que falta, com passo de
  60% do que a roda pediu. É a mesma perseguição do giro do caminhão no replay.
- O alvo é cravado nas pontas: sem isso, giros seguidos acumulam uma dívida enorme e a faixa fica
  presa alguns segundos até pagar a diferença.
- O cartão ganhou LEGENDA de cores logo abaixo do mapa, com quatro situações. ⚠️ Manutenção fica de fora por decisão do usuário: é a única das cinco que não vem da telemetria, e o card Em manutenção logo acima já a informa em número.
- O rodapé mostra só o que a telemetria sabe: placa, motorista (ou "sem motorista identificado"),
  endereço quando houver, e velocidade. Chegada prevista saiu, porque não tem origem. Conferido na
  tela: "BAW1F62, sem motorista identificado, Rua Presidente Costa e Silva, 254, Barra do Piraí,
  0 km/h".
- ⚠️ O mapa só aparece com posição de verdade na mão. Cartão vazio é melhor que mapa com a frota
  de outra empresa.

### A frota em 3D no mapa ao vivo

⚠️ **NÃO FOI VISTO NA TELA.** Escrito com o navegador do Playwright bloqueado, então nada aqui
foi confirmado visualmente. É a primeira coisa a conferir na próxima sessão, e a lista do que
pode estar errado está no fim desta seção.

- **O modelo é `public/models/truck.glb`**, do pacote de veículos do Quaternius, baixado do Poly
  Pizza. **CC0 1.0**: domínio público, uso comercial liberado, sem exigir crédito. ⚠️ Isso foi
  verificado antes de baixar, e importa: dos cinco caminhões que apareceram na busca, só este era
  CC0, os outros quatro eram CC-BY, que obriga a exibir o nome do autor dentro do produto. São
  7.474 triângulos e 319 KB.
- **O `three` já era dependência do projeto** (`three@0.185.1`, usado por `globe`, `time-vortex` e
  `voice-sphere`), e o `GLTFLoader` vem no pacote. O que muda é que o mapa passa a carregar o
  chunk do three: 569 KB, 142 KB comprimido.
- ⚠️ **O risco foi levantado ANTES e o usuário decidiu seguir.** O `vehicle-icons.ts` documenta
  que a primeira versão deste mapa desenhava o veículo visto de cima e foi recusada, porque no
  zoom em que a tela abre o marcador tem ~26px e nesse tamanho caminhão, van e carro viram o
  mesmo retângulo. Um modelo 3D em perspectiva cai na mesma armadilha. Se a legibilidade
  incomodar em uso, o caminho de volta é reativar `icon-opacity` nas camadas 2D, que continuam
  montadas.
- **Uma camada só, N caminhões.** O exemplo oficial do MapLibre cria uma custom layer por modelo,
  com a coordenada fixa na matriz; aqui seriam 33 renderers. `fleet-3d-layer.ts` é uma camada
  única com um clone por veículo na mesma cena.
- ⚠️ **O que virava os caminhões de cabeça para baixo era a ORDEM DO EULER, e não o sinal.** O
  `rotation.set(PI/2, 0, PI)` parece girar o caminhão no próprio eixo, e na prática ele capota: a
  matriz do Euler XYZ do three é `Rx · Ry · Rz`, então o **Z é aplicado ao vetor PRIMEIRO**, com o
  modelo ainda de pé no eixo antigo. O `PI` em Z inverte o +Y do modelo (a altura) antes de o X
  entrar, e o que era o teto termina apontando para baixo. ⚠️ **Nunca combinar X e Z na mesma
  chamada de `rotation.set` neste modelo.** O meio-giro que endireita a frente mora no GRUPO
  (`rotation.z = PI - heading`), onde é a única rotação e não há ordem para atrapalhar.
- ⚠️ **Cheguei a "corrigir" isso trocando o sinal do X para `-PI/2`, e estava errado.** A teoria
  era que o `scale(upm, -upm, upm)` da matriz local espelharia as rotações. Ele espelha, mas em
  Y, e o caminhão fica de pé em Z: o espelhamento troca frente e trás, nunca cima e baixo. Ficou
  duas rodadas errado até eu medir em vez de deduzir.
- **Os eixos do modelo foram MEDIDOS, não deduzidos** (carregando o GLB e lendo as caixas
  envolventes): o modelo assenta em Y=0 e cresce até 2,884, então a ALTURA é +Y; os faróis ficam
  em Z=+2,0 e as lanternas em Z=-3,05, então a FRENTE é +Z. Daí sai tudo: `PI/2` em X leva a
  altura para +Z (o para cima do mapa) e a frente para -Y (sul), e o `PI - heading` do grupo
  devolve a frente ao norte no heading 0.
- **A conferência é reprodutível sem olhar a tela:** carregar o GLB no navegador com o three do
  próprio Vite (`/node_modules/.vite/deps/three.js`), montar grupo e clone como a camada faz, e
  ver para onde vão os vetores (0,0,1) e (0,1,0) com heading 0/90/180/270. O esperado é
  norte/leste/sul/oeste com o topo sempre para cima.
- **A camada 3D existe só no mapa ao vivo da gestão.** Os outros dois mapas (`operation-map` e
  `stops-map`) desenham marcadores próprios e não passam por aqui.
- ⚠️ **O status é a COR DA LATARIA, e não um disco no chão** (decisão do usuário em 30/08/2026).
  A primeira versão punha um círculo colorido embaixo do caminhão, e ele tapava o modelo: quem
  olhava via a bolinha, não o veículo. Pintar o próprio caminhão diz a mesma coisa sem cobrir
  nada.
- ⚠️ **Pintar exige DUAS peneiras, porque o modelo não dá uma só.** As RODAS compartilham o
  material "Atlas" com a carroceria: tingir por material pintaria as rodas junto e o caminhão
  viraria um borrão de uma cor só, então elas se separam por MALHA (`FrontWheel_R`,
  `FrontWheel_L`, `BackWheels` são nós irmãos de `Truck`). Já os FARÓIS e as LANTERNAS vivem
  dentro da malha `Truck` como primitivas e herdam nomes como "Truck_1": pelo nome da malha são
  indistinguíveis da lataria, e o que os separa é o nome do MATERIAL ("Headlights", "BrakeLight").
  Sem a segunda peneira o caminhão fica com os faróis da cor do status.
- ⚠️ **A textura da carroceria é descartada (`map = null`).** O "Atlas" é uma paleta de cores já
  assadas: mantê-la faria a cor do status multiplicar por uma cor existente, e azul sobre
  vermelho dá quase preto. Sem ela a cor sai exata, e quem desenha o volume passa a ser a
  iluminação. Por isso a luz virou três pontos: sem textura, é a diferença de luz entre as faces
  que faz o caminhão parecer um caminhão, e com uma fonte só ele lê como bloco chapado.
- ⚠️ **Os materiais são CLONADOS por caminhão.** O `clone(true)` do three copia a hierarquia mas
  COMPARTILHA os materiais: pintar sem clonar mudaria a cor dos trinta e três de uma vez, e o
  defeito só apareceria quando dois veículos estivessem em estados diferentes. Farol e lanterna
  são a exceção deliberada: como nunca mudam de cor, seguem compartilhados.
- **A paleta entra por PARÂMETRO** (`CORES_DA_GESTAO` é só o padrão). O painel do operador tem
  cores próprias em `operation-map.tsx`, e o usuário pediu que o 3D respeite a paleta de cada
  painel: o dia em que a camada for para lá, ela entra com as cores de lá.
- ⚠️ **A matriz é `defaultProjectionData.mainMatrix`, e NUNCA `modelViewProjectionMatrix`.** As
  duas chegam no mesmo objeto do `render` e os nomes enganam. A `mainMatrix` projeta coordenada
  MERCATOR (0..1, que é o que `MercatorCoordinate` devolve) para a tela, e é a do exemplo oficial.
  A outra parte de outro espaço: usá-la projeta tudo para fora do campo de visão, e o sintoma é
  cruel, porque o mapa desenha normalmente e os caminhões simplesmente não aparecem, sem uma
  linha de erro no console. Foi o que aconteceu em 30/08/2026.
- ⚠️ **A câmera é `Camera` crua, e não `PerspectiveCamera`.** A projeção inteira vem da matriz do
  MapLibre; uma câmera com projeção própria recalcularia por cima dela.
- ⚠️ **A origem do sistema de coordenadas acompanha o centro do mapa.** Coordenada Mercator vive
  entre 0 e 1 e um metro vale ~1e-8 nessa escala: com origem em (0,0) o `float32` da GPU perde a
  diferença entre dois caminhões da mesma cidade e eles tremem na tela.
- ⚠️ **`renderer.resetState()` antes de cada `render` é obrigatório.** O three e o MapLibre
  dividem o mesmo contexto WebGL; sem devolver o estado, o mapa passa a desenhar com o programa e
  os buffers que o three deixou ligados, e o sintoma é o mapa inteiro sumir depois do primeiro
  quadro.
- ⚠️ **As camadas 2D continuam montadas, com `icon-opacity: 0`, e isso é estrutural.** Uma custom
  layer do three não responde a `queryRenderedFeatures`, e os três handlers da tela (clique,
  popup no cursor, troca do ponteiro) estão ligados ao `LAYER_ICON` por id. `icon-opacity` é
  propriedade de PINTURA: o símbolo continua sendo colocado e consultado. Apagar a camada quebra
  a interação inteira sem erro no console.
- **O veículo selecionado cresce 25%**, que é o papel que o halo fazia na versão 2D.
  ⚠️ Este item dizia que o status era um DISCO no chão, contradizendo o item de cima. Conferido no
  código em 03/09/2026: **é a cor da lataria mesmo**, e o disco foi a versão recusada, como o
  próprio `fleet-3d-layer.ts:50` documenta. Texto de versão antiga que sobrou.
- **O modelo é escalado a cada quadro para ocupar ~34px de comprimento**, medindo metros por
  pixel com `project`/`unproject` em vez de fórmula: a fórmula depende da latitude, do tamanho do
  tile e da projeção, e erra em silêncio quando qualquer uma muda.

**O que conferir na tela, em ordem:**

1. O mapa continua desenhando depois do primeiro quadro (se sumir, é o `resetState`).
2. O caminhão está em pé e apontando para a frente. Se estiver deitado, de lado ou andando de ré,
   os dois valores a mexer são `ROTACAO_BASE_X` e `ROTACAO_BASE_Z`, e o motivo de cada um está
   escrito ao lado deles. O GLB veio do FBX2glTF, que exporta Y para cima com o comprimento em Z.
3. O tamanho na tela em zoom de estado e em zoom de rua (`ALVO_PX`).
4. Clicar num caminhão ainda abre o popup e seleciona.
5. O disco de status não pisca contra o chão do modelo (`disco.position.z`).

### A base cartográfica dos três mapas

- ⚠️ **A atribuição do mapa não pode ser removida, e a pergunta já foi feita** (usuário em
  30/08/2026). A base vem do OpenFreeMap com dados do OpenStreetMap, e a licença ODbL exige o
  crédito visível. `attributionControl: false` limparia a tela e criaria um problema de licença
  nos três mapas de uma vez. O que dava para resolver era o comportamento.
- **Os três mapas usam `compact: false`.** No modo compacto a atribuição virava um botão "i" que
  abria um painel ao clique, e como o container do MapLibre é ancorado pelo rodapé
  (`bottom: 0`), o bloco crescia PARA CIMA: um salto no canto do mapa a cada clique. Aberta não
  há estado, não há clique e não há salto. O `compact: false` também apaga o botão, porque o CSS
  da biblioteca só o mostra dentro de `.maplibregl-compact`. O desenho (10px, discreta, encostada
  no canto) fica em `styles/globals.css`, com uma regra que esconde o botão como rede de
  segurança para quem devolver `compact: true` sem ler a nota.

Decisão do usuário: mapa mais detalhado e mais realista, com alternância por tema. A base saiu
de dentro de cada componente e virou `src/components/shared/map-style.ts`, comum aos três mapas
(operacional, frota ao vivo e paradas de viagem). Antes eram duas bases diferentes: CARTO
dark-matter em dois deles e OpenFreeMap positron no terceiro.

- **Liberty no claro, `dark` no escuro**, os dois do OpenFreeMap, gratuitos e sem chave. O
  `positron` e o `dark-matter` são bases de fundo, feitas para sumir atrás do dado: quase sem nome
  de rua, sem área verde, sem construção. Numa central de comando isso tira contexto de quem mais
  precisa dele.
- ⚠️ **Não existe "Liberty escuro".** O par escuro é menos detalhado que o claro, e isso é do
  provedor, não descuido. Quem religar o modo escuro precisa saber que a base muda de caráter
  junto, e não só de cor.
- ⚠️ **`setStyle` descarta fonte, camada E imagem registradas.** Trocar de tema deixava o mapa
  novo sem caminhão, sem trajeto e sem rota desenhada. A montagem virou função reexecutável e é
  chamada de novo no evento `styledata` (não em `load`, que dispara uma vez na vida do mapa). A
  guarda `getSource(...)` evita redesenhar a cada tile que chega. Valia para os três: o
  `operation-map` já alternava tema e perdia a camada de rota desde sempre.
- ⚠️ **Ouvinte de ponteiro NÃO entra na função de montagem.** Ouvinte é do mapa e sobrevive à
  troca de estilo; remontá-lo faria um clique valer dois. Ficam em `ligarInteracoes`, chamada uma
  vez.
- ⚠️ **Camada de texto PRECISA declarar `text-font`.** Sem ela o MapLibre usa o padrão da
  especificação, que é a família do CARTO ("Open Sans Regular, Arial Unicode MS Regular"), e o
  OpenFreeMap não a serve: cada faixa de glifo virava um 404. O rótulo ainda aparecia pelo recurso
  alternativo, que é o que torna o defeito fácil de não ver. A família publicada é `Noto Sans`.
- **Halo é sempre o oposto do texto.** As cores estavam fixas no escuro (texto claro, contorno
  preto) e sobre a base clara liam como adesivo mal recortado. Vale para o rótulo e para o
  contorno dos discos de trajeto.

### Cadastro de frota (`/gestao/caminhoes/cadastro`)

Criada em **30/08/2026**, logo depois da de motoristas e deliberadamente igual a ela: mesmo
cabeçalho de números, mesmos filtros, mesma tabela com largura em porcentagem, mesma paginação de
30, mesma rolagem no hover para texto longo, mesmo diálogo de confirmação antes de apagar. Quem
aprendeu a arrumar as pessoas já sabe arrumar os caminhões.

- **Cadastrar e inativar passaram a existir em 30/08/2026**, a pedido do usuário, e as duas
  objeções que os impediam foram resolvidas em vez de ignoradas:
  - ⚠️ Caminhão criado a mão não tem rastreador e nunca reporta. Ele nasce com `origin = ROOKHUB`,
    e a lista mostra **"sem rastreador"** no lugar de "sem sinal". A diferença é o que faz a
    distinção continuar existindo: sem sinal é problema para investigar, sem rastreador é escolha
    de cadastro.
  - ⚠️ Inativar **não é** tirar de serviço, e o diálogo de confirmação diz isso na cara. Fora de
    serviço pede o motivo e mora no formulário; inativar é sair da frota e fica no botão da linha.
    O erro provável aqui custa caro: quem inativa um caminhão que só está na oficina tira da
    escala um veículo que volta na semana que vem.
- ⚠️ **O chip "Inativo" cala os outros.** Um caminhão que saiu da frota não está "sem sinal": ele
  está fora, e dizer as duas coisas manda alguém procurar um rastreador que não deveria reportar.
  Pela mesma razão os cartões do topo contam só a frota ativa.
- A ficha tem **25 campos em cinco seções** (identificação, ficha técnica, documentação,
  propriedade, operação), e **o mesmo formulário cadastra e edita**. O painel de detalhe do
  caminhão usa esse mesmo componente: o `vehicle-registry-card` foi apagado justamente para não
  existirem duas versões.
- ⚠️ **A diferença contra o original percorre uma lista**, e não trinta `if` escritos à mão. Com
  este número de campos, o `if` repetido produz o erro mais difícil de achar: um campo comparado
  com o vizinho grava o valor errado sem nada falhar.
- ⚠️ **"Não informado" é apagado ao carregar o formulário.** O literal vem gravado assim no banco
  em 16 dos 40 ativos, e se chegasse ao campo a pessoa teria de apagá-lo antes de escrever o
  modelo de verdade. Quem não apagasse gravaria a frase como se fosse o modelo.
- O diálogo **embrulha o `VehicleRegistryCard`** em vez de duplicá-lo. É o mesmo formulário do
  painel de detalhe do caminhão, com a mesma regra de "ausente preserva, nulo apaga". Uma segunda
  cópia divergiria na primeira vez que alguém acrescentasse um campo em um lado só. O card ganhou
  a invalidação de `vehicle-registry-list` para o chip "Conferido" atualizar na lista.
- ⚠️ **Não há coluna de motorista, e não é esquecimento.** A lotação que a MiX entrega é uma conta
  de sistema em 100% dos ativos desta frota, e as contas de sistema foram apagadas: a coluna vinha
  vazia nas 40 linhas. Conferido no banco antes de decidir, e não por suposição.
- **"Sem sinal" usa janela de 7 dias, e não de 30.** É o teto do histórico retroativo da MiX por
  token de sincronização: uma janela maior classificaria de "sem sinal" caminhão que a plataforma
  simplesmente ainda não teve tempo de ver. Hoje são 7 dos 40.
- O chip do estado do fornecedor **só aparece quando não é `Available`**. Repetir "Disponível" em
  38 linhas verdes seria ruído; `Unavailable` aqui quase sempre é resto de transferência, e é o
  que vale olhar.
- ⚠️ **`end: true` no item "Caminhões" do menu**, e não só no filho. `isItemActive` casa por
  prefixo quando `end` é falso, e sem isto "Caminhões" acenderia junto com "Cadastro". Mesma
  armadilha que já tinha aparecido em Motoristas.

### Visão geral do gestor (`/gestao`), reescrita em 01/09/2026

A home do gestor foi substituída inteira. Nasceu como `/gestao/visao-geral-2`, em slice isolado, e
promovida depois de aprovada: a pasta virou `features/overview`, o mock virou `mocks/overview.ts` e
a rota virou a própria `/gestao`. A antiga (`manager-home-page`) foi apagada.

- A tela responde a **uma** pergunta: quantos caminhões podem rodar hoje e o que impede os outros.
  **Nenhum valor em reais**: resultado financeiro é do proprietário.
- ⚠️ **Foram apagados junto quatro blocos que só existiam na home antiga**: `ReadinessStrip`,
  `OperationalMetricsCard`, `EventsTrendCard` e `ChecklistFailuresCard`. Com eles saíram do produto
  o "Desempenho operacional" e o "Eventos de risco", que eram retrospectiva de 30 dias com seletor
  de período. Saíram por decisão do usuário: a tela é do agora, e misturar dois relógios na mesma
  página enfraquece os dois. Se voltarem, é em aba ou rota própria de desempenho, nunca na home.
  `getManagerOverview` e `mockManagerOverview` ficaram sem uso, e não foram removidos.
- A ordem das faixas é a da decisão: estado da frota (contexto, cards baixos encostados na faixa
  indigo), decisões suas e impedimentos (o trabalho do dia, coluna larga), mapa de consulta e
  viagens (coluna estreita).
- **Decisões suas ≠ impedimentos.** Impedimento é o que a plataforma detecta; "decisões suas" é o
  que ela espera do gestor (liberações, pareceres, o que subiu para o dono), e cada pedido na fila
  é caminhão parado. Por isso vem antes, com a espera do pedido mais antigo em cima.
- ⚠️ **"Parado" e "sem sinal" são cards separados**, e a soma dos cinco estados fecha com o total.
  Somados, o gestor procura na oficina um caminhão que pode estar rodando com o rastreador mudo.
- A fila de impedimentos é **única e ordenada por severidade**; nenhum filtro muda a ordem, só quem
  entra nela. Os cards de severidade e a fileira de tipos (`/gestao/impedimentos`) são filtros, e
  as contagens deles são sempre sobre a fila inteira: seguindo o filtro, escolher um tipo zeraria
  os outros e o gestor perderia a noção do todo.
- A faixa indigo (`HeroBand`) é o `bg-primary` chapado (#6366F1) e **só existe neste slice**. Texto
  branco sempre, porque a faixa não muda com o tema; texto pequeno vai sobre `primary-strong`, que
  é o que devolve o contraste (branco sobre o âncora dá 4,3:1).
- O mini mapa (`FleetMiniMap`) é consulta rápida: sem giro, sem camada, sem histórico. Usa a base
  compartilhada de `components/shared/map-style` e repete as três armadilhas já documentadas em
  `A base cartográfica dos três mapas`: remontar camada no `styledata`, ouvinte fora da montagem e
  `text-font` declarado.
- ⚠️ **Dados sem origem real no mock**: CNH vencida/a vencer e disponibilidade de motorista
  dependem de escala e do RH, como a tela de Equipe documenta. São os primeiros números a cair na
  integração.

### A faixa indigo virou o cabeçalho do painel (01/09/2026)

- `HeroBand` (com `HeroPill` e `HeroLink`) saiu do slice da visão geral e virou
  `components/layout/hero-band.tsx`. Ele **inclui a topbar**: quem usa `HeroBand` não usa
  `PageBanner`, senão o título aparece duas vezes. A topbar fica FORA do indigo, sobre o papel,
  porque marca, menu e avatar são pintados com os tokens do tema e somem sobre a cor saturada.
- `components/layout/hero-stats.tsx` é a fileira de números de abertura: um card branco por
  número, com ícone, e não um card com caixas dentro. Quem usa aplica `-mt-16 sm:-mt-20` para os
  cards subirem por cima da borda da faixa; o `pb` grande do `HeroBand` existe para isso.
- Adotaram o par em 01/09/2026: visão geral, impedimentos, viagens, equipe, segurança e
  liberações. **Pareceres e mapa ao vivo entraram em 08/09/2026**, a pedido do usuário. As demais
  telas seguem no `PageBanner`.
- ⚠️ **O mapa ao vivo segue o MESMO molde das outras telas do par**, por decisão do usuário em
  08/09/2026 ("tente replicar exatamente"): `HeroBand` + `HeroStats` com `-mt-16 sm:-mt-20` +
  `PageContent rounded-t-4xl bg-light`. Duas coisas foram testadas antes e recusadas por ele: pôr
  os filtros de situação dentro da faixa ("isso aqui não faz parte do banner") e encolher o respiro
  da faixa com um `bleed={false}` (a prop chegou a existir no `HeroBand` e foi removida junto, para
  não deixar abstração sem uso).
- ⚠️ **A altura do mapa sai de `2xl:h-[clamp(32rem,calc(100dvh-30rem),52rem)]`, e o `30rem` é
  função do cabeçalho.** Era `22rem` quando a tela abria com `PageBanner`; subiu ao adotar a faixa
  mais os cards. Quem mexer no cabeçalho dessa página tem de reacertar esse número, senão o mapa
  passa da dobra. ⚠️ Foi calculado pelos paddings, não medido no navegador: confira ao mexer.
- ⚠️ **O chip de frescor da leitura mora NA FAIXA do mapa** desde 08/09/2026: é status da página, e
  não controle da lista. ⚠️ Sobre a faixa laranja o estado **não** pode ser um ponto colorido: o
  verde escurecido some e o âmbar vira laranja sobre laranja. Quem diz o estado é a pastilha:
  contorno branco quando em dia, branco CHEIO com texto laranja quando atrasada. O `HERO_PILL` é
  exportado do `hero-band.tsx` justamente para este caso, em que o par ícone mais texto do
  `HeroPill` não dá conta.
- ⚠️ **Os filtros de situação do mapa usam o desenho do `PageTabs`** (trilho de poço, escolhido é a
  pastilha clara que sobe dele com escrita marinha). Os dois são a mesma coisa, um segmentado que
  filtra uma lista, e tinham desenhos diferentes na mesma tela. ⚠️ Lá os tokens são `light` e não
  `surface`, porque a barra vive dentro do painel branco e o trilho do `PageTabs` mora sobre o papel.
- ⚠️ Os números do `HeroStats` do mapa **repetem as contagens dos filtros** de situação logo abaixo.
  É aceito: os cards são o resumo de abertura e os filtros são o controle, e é o mesmo arranjo da
  fila de aprovações do dono (cards + alerta com o mesmo número). ⚠️ Trocar `PageBanner` por `HeroBand` sem pôr o `HeroStats` com `-mt-16 sm:-mt-20`
  deixa um vazio laranja de ~100px: o `pb-24 sm:pb-28` da faixa existe para os cards a morderem. O painel branco de conteúdo
  (`rounded-t-4xl bg-light` no `PageContent`) foi mantido nessas telas: os blocos de dentro usam
  `light-container` como poço, e sobre o papel eles sumiriam.
- O `Tile` local da tela de Equipe e os `metric-tile` de resumo de Viagens e Segurança saíram,
  substituídos pelo `HeroStats`.
- ⚠️ **A visão do dono entrou no par em 05/09/2026**, a pedido do usuário: `/gestao` no papel OWNER
  e no papel MANAGER são a mesma rota, e precisavam ser reconhecíveis uma na outra. Saíram dali a
  foto do `PageBanner` e o `OwnerKpiStrip`; resultado, margem, receita, custo por km e km rodado
  viraram cinco cards do `HeroStats`. O `OwnerKpiStrip` **continua em uso** em `/gestao/resultado`,
  que é onde o número grande ainda faz sentido: não é código morto.
- A fila de aprovações do dono virou `HeroLink` dentro da faixa. Continua no cabeçalho pelo motivo
  de sempre: ocorrência grave mantém caminhão parado até ele decidir, e isso não é caixa de entrada.
- No modo com dado real a fileira do dono é montada a partir de `metrics` do `GET
/v1/fleet/operations`, e o ícone sai de um mapa por `id` (`km`, `criticos`, `velocidade`,
  `ocioso`, `consumo`) com `ChartIcon` de reserva. A lista é montada no backend: métrica nova chega
  à tela antes de alguém desenhar um ícone para ela.
- A saudação ("Boa noite, Fulano") está escrita duas vezes, em `overview-hero` e em `owner-hero`.
  São quatro linhas, e centralizá-las obrigaria um dos dois slices a importar do outro só por isso.
- ⚠️ **O seletor de período de Viagens SAIU da faixa em 08/09/2026** e foi para dentro da aba
  "Percursos", acima dos campos de filtro. Duas razões, e as duas valem para qualquer controle que
  alguém queira pôr no cabeçalho: ele **não governa a tela** (a aba "Onde a frota para" é fixa em
  trinta dias, então na faixa ele prometia um controle que não exercia), e ele é o recorte
  **server-side**, enquanto placa, motorista e dia refinam no cliente já carregado. Acima dos
  campos, a ordem na tela é a ordem real do funil. Usa o desenho do `PageTabs` na família `light`.

### A tela de aprovações do dono abre alertando (05/09/2026)

Pedido do usuário: `/gestao/aprovacoes` precisava avisar o dono assim que ele entra, e não deixar
que ele descubra sozinho que tem caminhão parado esperando decisão dele.

- O resumo da fila era um `GlassCard` neutro que se lia como legenda. Virou `HeroBand` + `HeroStats`
  (aguardando você, veículo bloqueado, espera mais longa, impacto em jogo, já decididas) mais um
  `Alert` que muda de cor pelo que está em jogo: `error` com ocorrência grave, `warning` só com
  espera, `success` com a fila vazia. O alerta fica FORA do painel claro de propósito: ele fala da
  fila inteira, não da aba aberta.
- O botão do alerta ("Abrir a mais grave") troca a aba para PENDENTES **e** seleciona o item. Sem a
  troca de aba, quem estivesse em "Já decididas" clicava e não via nada acontecer.
- ⚠️ **A fila pendente é ordenada por severidade e depois pela espera, não por data de chegada.**
  Como o `useMasterDetail` abre o primeiro item, ordenar é o que faz a tela abrir já mostrando o
  caso que bloqueia um caminhão. Um parecer leve pedido hoje na frente de uma liberação grave de
  ontem é o defeito que a ordenação existe para evitar.
- A linha da fila ganhou a faixa de severidade (`SEVERITY_RAIL` em `approval-meta`), no mesmo
  padrão da fila de impedimentos. **Não** usar `StatusChip` aqui: a linha selecionada é
  `bg-primary-strong`, e um chip `on-light` sobre ela fica ilegível.
- Na fila a linha mostra "esperando há X"; na aba das decididas, o status e a data da decisão. Data
  de pedido numa fila obriga o dono a fazer a subtração de cabeça.
- ⚠️ `Date.now()` no corpo do componente é erro de lint (`react-hooks/purity`). O padrão do projeto
  é `const [now] = useState(() => Date.now())`, como em `trucks-page`.
- Aproveitei para trocar os três travessões de texto de interface desta tela (dois toasts e a dica
  da justificativa, em `approval-detail-panel`). O resto do repositório ainda tem muitos, em
  comentário e em texto.

### Gamificação em rota própria (01/09/2026)

- O pódio "Top motoristas por score" saiu de `/gestao/motoristas` e virou `/gestao/gamificacao`,
  a pedido do usuário. O motivo é a pergunta: a tela de motoristas responde "como este motorista
  dirige" e a de gamificação responde "quem está ganhando". Na tela de motoristas o pódio ainda
  dividia espaço com a ficha individual.
- O item entrou no menu do gestor e no operacional, no grupo **Pessoas**, entre Motoristas e
  Segurança.
- A página tem os quatro números, o pódio (que traz o próprio seletor de mês/ano) e a
  **classificação completa**, que a tela antiga não tinha: só o top 5 do mock, ou top 10 da API.
- ⚠️ **A nota é relativa à própria frota** e a tela diz isso na cara. Cada cliente configura
  eventos diferentes na telemetria, então 100 é "não gerou evento nesta configuração", e não
  direção perfeita. Sem essa ressalva o ranking vira comparação entre transportadoras.
- Quem não tem nota (rodou pouco no período) não entra na classificação e é contado na legenda do
  primeiro card: sumir com essas pessoas sem dizer nada faria a frota parecer menor.

### Marca e artes

- No painel operacional, usar `BrandLogo`, `RookMark` e `RobotMark`. O sufixo do arquivo indica a
  cor da arte: `-white` aparece no tema escuro e `-dark` no claro. O painel de gestão usa seu próprio
  `RookhubLogo` e os assets de `src/assets`.
- As artes 3D da hub (`hub-robot.png` e `hub-rook.png`) já têm transparência. `mix-blend-screen` é
  apenas realce do tema escuro; no tema claro ele apaga a imagem.
- Os SVGs do mascote dependem de subpaths num único `<path fill-rule="evenodd">`; separar os paths
  fecha os recortes do visor e da boca.

## Mapas, cenas e voz

- ⚠️ **Animação pesada degrada sozinha em hardware modesto** (pedido do usuário em 04/09/2026).
  `applyPerformanceProfile()` roda no `main.tsx` antes do primeiro render e marca a raiz com duas
  classes pela mesma heurística (4 núcleos ou 4 GB, ou preferência salva): `no-blur`, que já
  existia, e `modo-leve`, nova. Antes disso a função existia no repositório e **nunca era
  chamada**, então o perfil não valia nada.
- O que cada peça faz no modo leve: o **globo do hub congela** (desenha um quadro e não entra no
  laço, como já fazia com `prefers-reduced-motion`); a **esfera de voz continua animando**, mas
  com `setPixelRatio(1)` no lugar de 2 (quatro vezes menos pixels) e um quadro sim outro não; e
  as **72 barras da órbita somem**, sobrando os dois arcos, com giro na metade da velocidade.
  As 32 barras da onda perdem o `animation-delay` individual, que é o que impedia o navegador de
  agrupá-las num só passo de composição.
- ⚠️ **Contar `requestAnimationFrame` não serve para verificar isso no Playwright**: o navegador
  sem compositor entrega ~1 quadro por segundo mesmo com a animação ligada. O que se mede é o
  efeito observável: `display` da barra orbital, `animationDuration` do arco e a razão entre
  `canvas.width` e a largura em CSS, que devolve o pixel ratio real.

- `OperationMap` usa MapLibre 5 + OpenFreeMap, sem chave. A atribuição automática deve permanecer;
  o provedor público não oferece SLA. Rotas rodoviárias são geometrias estáticas pré-calculadas no
  OSRM e guardadas em `mocks/operations/road-routes.ts`, sem chamada de roteamento em runtime.
- `setStyle` do MapLibre apaga fontes e camadas customizadas; as rotas precisam ser recriadas no
  evento `styledata`. No mapa do painel de gestão, não importar o worker separado do MapLibre 6:
  esta aplicação usa o 5, que já embute o worker.
- As cenas Three.js (`voice-sphere`, `globe`, `time-vortex`) montam uma vez, usam `ResizeObserver`,
  cleanup e `prefers-reduced-motion`. `WebGLRenderer` deve ficar em `try/catch`, pois lança em jsdom
  ou máquinas sem WebGL. A esfera recebe estado e nível por `ref` para não recriar as partículas.
- `ogl` é dependência intencional dos fundos `Grainient`/`GradientBlinds` do painel de gestão.
- ⚠️ **A linha de FONTE saiu da resposta da IA** (decisão do usuário em 30/08/2026). Era o rodapé
  "Telemetria MiX · frota, operação... | Cadastro RookHub · cadastro de motoristas" abaixo de cada
  resposta, e existia por **RN-121**: o gestor saber sobre que dado o número foi calculado antes
  de decidir. A regra continua no documento de produto; quem quiser repor tem o `turn.answer.source`
  ainda chegando do backend, é só voltar a renderizar em `assistant-turn.tsx`.
- ⚠️ **O botão das conversas fica ANTES da marca, e é um HAMBÚRGUER** (`MenuIcon`), decidido pelo
  usuário em 30/08/2026 com referência de tela. As duas coisas andam juntas: três pontos
  (`MoreIcon`) é o desenho de "mais ações sobre este item" e, à direita junto do fechar, lia como
  um menu de opções do painel; três barras é o desenho de "abrir a lista lateral", e à esquerda
  ele fica do lado do painel que abre, apontando para onde a coisa acontece. A ordem do cabeçalho
  é hambúrguer, marca, título, e o fechar sozinho na direita.
- ⚠️ **O drawer do assistente escurecia a tela por DOIS caminhos, e os dois saíram** (usuário em
  30/08/2026). Quem procurar "o sombreamento" precisa saber que são dois, porque tirar um só
  deixa o sintoma quase igual:
  1. O **véu** do `Overlay` (`bg-black/60 backdrop-blur-sm`), que cobria a tela inteira.
  2. A **sombra projetada** do painel (`shadow-[-40px_0_120px_-40px_rgba(0,0,0,0.9)]`): preto a
     90% espalhado por 120px para a esquerda. Numa tela clara isso não lê como profundidade, lê
     como sujeira, e comia a primeira coluna do painel.
- ⚠️ **O `Overlay` continua existindo, só que sem cor.** Apagá-lo seria pior: é ele que o Radix
  usa para fechar ao clicar fora e para prender o foco dentro do painel.
- O que separa o drawer da página é o `border-l`, que já existia e basta: o painel tem fundo
  próprio e encosta na borda da janela. E o assistente não é um modal: a pessoa abre para
  perguntar SOBRE o que está vendo, então apagar o que está atrás derruba o contexto da pergunta.
- ⚠️ **O atalho do assistente é Ctrl+K, e só ele.** O Ctrl+K é o padrão de mercado para paleta de
  comando e é o que o PRD pede em RF-033.
- ⚠️ **O Ctrl+R foi REMOVIDO em 30/08/2026, a pedido do usuário. Não repor.** Ele existia em
  paralelo e sobrescrevia o "recarregar página" do navegador. O problema não era técnico
  (`preventDefault` funciona): é um atalho que a pessoa tem memorizado para outra coisa há anos,
  e não há como avisá-la de que mudou. Quem apertava esperando recarregar recebia um painel de
  conversa. A dica do botão flutuante (`assistant-fab.tsx`) também dizia Ctrl+R e foi corrigida:
  são dois arquivos, mexeu num, confira o outro.
- O assistente **já chama LLM de verdade**, sempre pelo `Backend-web`, que monta o contexto depois
  de aplicar o filtro de tenant e de perfil. Chave de provedor no navegador seria chave publicada,
  e contexto montado no cliente permitiria pedir dado de outro nível pelo DevTools.
- ⚠️ **A síntese de voz saiu do Vite** e hoje é `/v1/voice/synthesize` no backend. Ela era um plugin
  Node registrado só em `configureServer`/`configurePreviewServer`, então existia apenas em
  desenvolvimento: no build publicado a rota sumiria e a voz morreria em produção sem nenhum sinal
  no código. Não recriar plugin de rota no `vite.config.ts`. A chave da ElevenLabs nunca vai ao
  navegador; o áudio alimenta o `AnalyserNode` e `SpeechSynthesis` é fallback.
- Falta encadear a voz com a resposta do assistente: as duas peças existem, a conversa por voz do
  hub ainda não passa por elas ponta a ponta.

## Segurança e ambiente

- `.env` na raiz, ignorado pelo Git, é a única cópia de valores reais. Só `VITE_*` pode chegar ao
  bundle; chaves de Gemini e ElevenLabs são server-side.
- Não registrar segredo em comando, log, commit, README ou `.claude`. A pasta `.claude` é versionada
  e não pode conter dados pessoais ou credenciais de máquina.
- `.env.example` e a tabela de variáveis do README foram removidos por decisão do usuário e não
  devem ser recriados sem pedido.
- ⚠️ **O PAT do GitHub não mora mais no `.env`.** O `ACCESS_TOKEN_GITHUB` foi removido em
  03/09/2026, e não deve ser recriado ali: não é variável de aplicação. Quem entrega o token ao Git
  é um credential helper que lê `~/.secrets/github-tokens.json`, escolhendo a conta pela chave
  `credential.<url do repo>.username` do `.git/config` local. Nunca embutir o valor na URL do
  remoto nem em argumento de comando.
- ⚠️ **A ligação com o cofre não é versionada**, porque mora no `.git/config`. Cada desenvolvedor
  monta o próprio cofre, com o próprio token, e refaz a configuração a cada clone novo.
- Não persistir tokens ou dados sensíveis em `localStorage`. A persistência atual guarda apenas
  preferências não sensíveis, como tema.

## Telemetria MiX, o que importa para a tela

O fornecedor, os limites dele e as armadilhas da ingestão estão em
`../Backend-web/.claude/memoria.md`. Nenhum cliente fala com a MiX: tudo chega pela API do
`Backend-web`. Aqui fica só o que muda decisão de tela.

- ⚠️ **IDs de 64 bits são destruídos pelo `JSON.parse` do JavaScript.** Os identificadores da MiX
  têm 19 dígitos e o `Number.MAX_SAFE_INTEGER` tem 16: `1723190672275386368` vira
  `...400` silenciosamente. Com o ID arredondado a API responde `401 Not Authorised`, ou seja, **o
  sintoma parece falta de permissão e é ID inexistente.** Por isso esses identificadores trafegam
  como **string** na borda. Nunca convertê-los para número no cliente.
- ⚠️ **O que a MiX reporta não é o que o painel mostra.** O fornecedor tem 54 ativos e 41 placas
  antes da desduplicação, e 150 motoristas; depois do tratamento sobram **40 caminhões e 110
  motoristas**, que é o que as telas exibem (conferido em 02/09/2026). Comparar os dois números sem
  lembrar dessa diferença leva a conclusão errada.
- ⚠️ **Não existe escala absoluta de nota de motorista.** A nota é relativa à própria frota, porque
  o evento que uma conta gera não é o mesmo que outra gera: 75 na média dela, 100 para quem não gera
  evento, 50 para quem gera o dobro. Nenhuma tela pode apresentar a nota como comparável entre
  clientes.
- **Posição do fluxo incremental vem sem endereço.** O geocodificado só acompanha início e fim de
  trecho e a posição do evento, então o mapa mostra coordenada quando não há endereço.
- ⚠️ **Metade da frota não tem motorista identificado na viagem** (2.069 de 2.287, medido em
  02/09/2026). Qualquer ranking ou quadro de equipe precisa dizer isso na tela, senão o número
  parece errado.

## Documentação e próximos passos

- `docs/referencias/ARQUITETURA_FRONTEND.md` registra as decisões da fundação do frontend. A pasta
  **existe e tem só esse arquivo**: os 4 vídeos e 2 PNGs de referência visual que moravam ali (13 MB)
  foram removidos a pedido do usuário em 30/08/2026, junto das capturas de `public/images/` que
  nenhum código importava. Sobraram em `public/images/` apenas `hub-robot.png` e `hub-rook.png`, que
  são as artes dos dois cartões do hub. Não recriar as que saíram.
- ⚠️ **`docs/pdf/RookHub_Arquitetura_e_Decisoes_Tecnicas.pdf` descreve a arquitetura-ALVO, não o
  estado implementado.** Diverge do construído em três pontos: diz OpenAI (existem chaves de Gemini
  também), diz AWS (fomos de Oracle e Cloudflare por custo) e não menciona TimescaleDB, que está no
  schema desde a `V1__baseline.sql`. Para o agora, o código e os READMEs.
- Os PDFs em `docs/pdf/` são versionados de propósito. Não sugerir removê-los nem migrá-los para LFS
  sem solicitação.
- **Pendências principais**: ligar `services/api` (painel operacional) na API real; tela de Viagens,
  que depende de decidir entre cadastro próprio e TMS do cliente; origem de custo; integrações de
  multas e câmeras; paginação server-side; smoke E2E; code splitting; decidir o destino da cópia em
  `System-mobile`; migrar para TS 7 quando o ecossistema de lint suportar.

## Gotchas

- ⚠️ **Apagar peça no Blender teleporta as filhas dela, e o estrago aparece longe do lugar.** Ao
  tirar o segundo eixo direcional do `cavalo-8x4` para gerar o `cavalo-6x4` (06/09/2026), 30 peças
  que deviam ficar eram filhas de peças removidas: perderam a transformação do pai e pularam até
  4,6 m, com o X trocando de sinal, e foram parar boiando ao lado da cabine. A correção é reancorar
  cada uma no ancestral sobrevivente ANTES de apagar, preservando `matrix_world` na mão.
- ⚠️ **`matrix_world.translation.y -= x` não move objeto que tem pai.** A matriz é recalculada a
  partir do pai no próximo update e a mudança se perde; pior, peça cujo pai também andou anda duas
  vezes. Ou se atribui `matrix_world` inteira, ou se mexe nos vértices. E mover um nó arrasta toda a
  sub-árvore: só dá para mover pelo objeto quando a sub-árvore inteira deve andar junto (aqui, 56
  sub-árvores homogêneas), e o resto vai por vértice.
- **Como se confere um encurtamento desses:** dump das posições do .blend original para JSON e
  comparação peça a peça, exigindo que cada uma esteja ou parada ou deslocada exatamente o recuo.
  Fechou em 642 paradas, 842 movidas e 2 encurtadas por vértice (chassi e cardã, cujo centro anda
  metade do recuo, o que é o certo). Olhar o render não pega isso: as peças erradas ficam fora do
  quadro.
- ⚠️ **Metade do modelo do 3D Warehouse vem com as faces viradas para dentro, e só a luz revela.**
  No `cavalo-8x4` (o Scania V8, renomeado a pedido do usuário em 05/09/2026), 460 peças do lado
  esquerdo têm escala negativa, que é como o SketchUp guarda componente espelhado, contra 129 do
  direito. Escala negativa inverte a orientação da face: sob luz de verdade aquele lado perde o
  sombreado e o farol vira um retângulo cinza chapado. Relatado pelo usuário em 05/09/2026 como
  "de um lado tem a lanterna e do outro não", e não era peça faltando: medido, os dois faróis têm
  967 e 1.060 vértices, mesma textura e mesma UV. A correção é inverter as faces das peças de
  determinante negativo, uma vez por malha (⚠️ duas desfazem) e copiando a malha antes quando ela
  é compartilhada com peças de determinante positivo.
- ⚠️ **Conferir modelo 3D pelo Workbench mente, e conferir por código sem GPU mente também.** O
  Workbench desenha uma aproximação do material: ele mostrou os faróis chapados num arquivo em que
  eles estavam perfeitos, e mostrou o veículo uniforme num arquivo com metade das faces invertidas.
  E o `GLTFLoader` do three rodando em Node não carrega imagem nenhuma, então todo material volta
  como "sem textura", o que não prova nada sobre textura. O que serve para conferir aparência é
  **EEVEE**, e o que serve para conferir conteúdo é ler o JSON do GLB direto.
- ⚠️ **Triângulo por malha armazenada não é triângulo desenhado.** O exportador do Blender
  reaproveita a mesma malha em várias instâncias, então a contagem por malha despencou de 241.745
  para 180.330 num arquivo que na verdade perdeu 1.568 triângulos de 333.042 (0,5%, exatamente a
  escrita da grade que o usuário mandou remover). Comparar arquivos exige percorrer a cena e somar
  por instância, senão o relatório acusa uma perda de 25% que não existe.

- ⚠️ **O Tailwind lê `.glb` como código, e um modelo grande no projeto mata o `vite build`.** A
  detecção automática de conteúdo do Tailwind 4 varre a pasta do projeto atrás de nome de classe e
  pula binário por extensão, mas `.glb` não está na lista do scanner (`@tailwindcss/oxide`: lá
  dentro estão `jpg`, `png`, `mp4`, `webm`, `woff2`, `zip`, e nenhum formato 3D). Com o `truck.glb`
  de 326 KB ninguém percebia. Com os 71 MB convertidos do 3D Warehouse em 05/09/2026, o build
  tentou alocar **16 GB**, morreu em `transforming...` e travou a máquina do usuário por três
  minutos. O sintoma engana duas vezes: a mensagem é só `memory allocation failed`, sem dizer qual
  arquivo, e mover a pasta para fora de `public/` **não** resolve, porque a varredura é do projeto
  inteiro. A correção são os dois `@source not` no topo do `globals.css`. Modelo novo entra numa
  pasta já excluída ou ganha o próprio `@source not`.
- ⚠️ **Os GLB originais moram em `original-models/`, na raiz do projeto, e o Git ignora a
  pasta** (decisão do usuário em 05/09/2026; a pasta saiu de `public/` para a raiz em
  09/09/2026). São 123 MB convertidos do 3D Warehouse, e este repositório é público: quem clonar
  não recebe nenhum deles. Enquanto viveram em `public/`, o `npm run build` copiava a pasta
  inteira para o `dist`, que ia de 7,8 MB para 92 MB; fora de `public/` o Vite não os copia mais,
  mas o `@source not` do `globals.css` continua obrigatório, agora apontando para
  `../../original-models`. Os sete modelos são `cavalo-8x4`, `cavalo-6x4` (derivado do 8x4 em 06/09/2026: saiu o
  segundo eixo direcional e o chassi encurtou 60 cm),
  `conjunto-6x4-basculante-fixo`, `conjunto-8x4-basculante-fixo`,
  `conjunto-quaditrem-basculante`, `conjunto-rodotrem-basculante` e
  `implemento-3-eixo-basculante` (nomes dados pelo usuário em 05/09/2026, em pt-BR: são
  nomenclatura de frota, não identificador de código). Nenhum deles
  é usado por código ainda: o mapa continua no `truck.glb` do Quaternius. ⚠️ Todos saíram do
  conversor com **um material por primitiva** (de 2.121 a 7.040 cada, contra 3 do `truck.glb`),
  então abrem e inspecionam bem, mas não aguentam a frota inteira em tempo real sem uma passagem
  de deduplicação.
- ⚠️ **O 3D Warehouse exporta COLLADA que o COLLADA2GLTF não converte, e o erro é silencioso.** O
  SketchUp põe cada componente em `<library_nodes>` e o referencia por `<instance_node>`; o
  COLLADA2GLTF 2.1.5 ignora essa indireção. Ele termina com sucesso, sem aviso, e o GLB sai com
  768 bytes: a câmera do SketchUp e nenhuma geometria. O jeito de perceber é conferir o tamanho do
  arquivo. `scripts/flatten-dae.py` copia o nó alvo para o lugar da instância antes de converter.
  ⚠️ O Blender não é saída aqui: o importador COLLADA foi removido, a 5.2 não tem `collada_import`.

- ⚠️ **Não** reintroduzir a foto do banner, a borda dos cards nem o vidro no tema claro. Os três
  saíram no redesign de 30/08/2026 e cada um deixou rastro em vários arquivos. Ver
  `Redesign de 30/08/2026`.
- ⚠️ **Não** usar `bg-surface-lowest` para bloco de indicador: é o token do **poço**, mais escuro
  que o papel, e o indicador afunda no fundo. Usar `.metric-tile`. Campo de entrada continua no
  poço, que é o `.glass-well`.
- ⚠️ **Estado ativo de NAVEGAÇÃO é terracota; o resto continua preto.** Em 08/09/2026, a pedido do
  usuário, tanto o menu superior da gestão (`management/components/layout/app-nav.tsx`, nos três
  pontos: item, subitem e menu do mobile) quanto a lateral do operacional
  (`components/layout/sidebar-nav.tsx`) passaram a `primary-strong`. **Os dois andam juntos: mexeu
  num, mexa no outro.** Segue na pastilha preta `bg-bright`: paginação, `period-picker` e a
  variante `bright` do `SpectrumButton`. Antes de "consertar" a divergência, confira aqui: ela é
  decisão.
- ⚠️ **A etapa atual do `WizardSteps` é MARINHO CHEIO** (08/09/2026), e não a tinta preta. ⚠️ Cheio,
  e não a pastilha clara que sobe do poço como nas abas: a barra mora dentro do `GlassModal`, cuja
  superfície já é a mais alta da tela, então uma pastilha clara ali seria branco sobre branco com só
  a sombra sustentando o estado. Mesmo raciocínio das abas, resposta oposta porque a superfície é
  outra.
- ⚠️ **No `WizardSteps`, etapa RESOLVIDA tem texto cheio e a não visitada fica apagada.** Antes as
  duas eram o mesmo cinza e só o tamanho do visto as separava, que é justamente a pergunta que uma
  barra de etapas existe para responder. ⚠️ Dentro da pastilha atual o sinal herda o contraste dela:
  verde e vermelho sobre o marinho reprovam.
- ⚠️ **Faixa de severidade usa a família de PREENCHIMENTO (`bg-error`, `bg-warning`), nunca a
  `-on-light`.** Relatado pelo usuário em 08/09/2026: as faixas estavam em `#9F1239` (vinho) e
  `#6B3F0A` (marrom oliva) e não dava para dizer o que era grave. A causa é conceitual e vale para
  qualquer swatch novo: **`-on-light` é família de TEXTO**, escurecida de propósito para passar
  4,5:1 sobre a matiz diluída (a própria `palette.css` avisa isso). Como tinta chapada ela fica
  escura e dessaturada, e duas cores escuras não se separam. Elemento gráfico pede 3:1 e
  reconhecimento por MATIZ, não contraste de texto. Corrigido nos três lugares que definem faixa:
  `overview/blockers.ts`, `manager/severity.ts` e `owner/components/approval-meta.tsx`
  (`safety-page.tsx` já estava certo e serviu de referência). ⚠️ No tema escuro as duas famílias
  têm o mesmo valor, então o sintoma só aparece no claro.
- ⚠️ **Controle que recorta a lista mora DENTRO do painel branco, junto do que ele controla.**
  Decisão do usuário em 08/09/2026, aplicada ao `FleetFilters` de `/gestao/caminhoes`, que morava na
  seção de papel acima do painel. Duas consequências de estar do lado de fora: separava o controle
  do que ele recorta, e o obrigava à família de token do papel, que ao lado do branco lê como cinza
  FRIO. Dentro do painel a ordem vira a do funil (aba primeiro, refino depois). Mesmo motivo pelo
  qual o seletor de período de `/gestao/viagens` desceu para dentro da aba.
- ⚠️ **Filtro do painel é campo com RÓTULO VISÍVEL em cima, num grid**, e não pastilha achatada
  (decisão do usuário em 08/09/2026). Vale para o `FleetFilters` de `/gestao/caminhoes` e para o
  cadastro de frota, que é o desenho de referência. Chegou a ser tentado o contrário (rótulos
  escondidos, seletores em pílula) e foi recusado: "Todas as marcas" e "Qualquer manutenção" são
  VALORES, não perguntas, então sem o rótulo é preciso abrir cada seletor para saber o que ele
  recorta. ⚠️ Onde a barra já vive dentro do painel branco **não** entra `GlassCard` em volta: no
  cadastro os campos moram num cartão sobre o papel, e aqui seria moldura sobre moldura.
- ⚠️ **`/gestao/manutencao` entrou no molde em 08/09/2026**: `PageBanner` virou `HeroBand`, o
  `GlassCard` de quatro métricas virou `HeroStats` mordendo a borda, os dois `LightCard` que
  embrulhavam as abas Planos e Oficinas viraram seções com título, e 29 linhas do painel trocaram da
  família `surface` para a `light`.
- ⚠️ **A aba Ordens virou FILA ÚNICA, no desenho de `/gestao/impedimentos`** (o usuário pediu
  "algo parecido" com aquela tela). Era master-detail com coluna de 340px. Uma ordem de serviço não
  pede master-detail: tem meia dúzia de fatos e todos cabem na linha. O único que não cabia, a
  quebra de itens, virou um `<details>` nativo dentro da linha, sem estado em React. `useMasterDetail`
  saiu do arquivo. ⚠️ **Nem toda lista quer master-detail**: use-o quando o detalhe tem seções e
  formulário (liberações, pareceres), e a fila corrida quando o item cabe numa linha rica. ⚠️ Na versão com dado real quem morde a faixa é o próprio
  `MechanicalAlertsCard`: ele já é um `GlassCard`, que no claro é a mesma placa branca do
  `HeroStats`, então não foi preciso inventar números para preencher o respiro.
- ⚠️ **`LightCard` envolvendo o CONTEÚDO INTEIRO de uma aba é cartão dentro de cartão.** Corrigido
  em `/gestao/equipe` (08/09/2026), nas duas versões da tela (`team-page` e `team-roster`): a
  moldura embrulhava uma grade de `PersonCard`, que já são cartões, dentro do painel branco da
  página. Três molduras encaixadas para uma lista só. ⚠️ O problema **não** é ele sumir (o
  `LightCard` tem sombra e se destaca): é ele não separar nada, porque não divide a tela com
  ninguém. Onde o `LightCard` continua certo é como UMA das colunas de um master-detail, que é
  quando a moldura de fato distingue duas coisas: `release-detail-panel`, `diagnosis-detail-panel` e
  `approval-detail-panel` seguem assim de propósito.
- ⚠️ **Título de cartão que repete a faixa é o terceiro rótulo da mesma lista.** O "Quadro" de
  `/gestao/equipe` saiu junto com a moldura: a faixa já diz "Equipe" e as abas já dizem o recorte.
- ⚠️ **Ao mover algo para dentro do painel branco, TROQUE A FAMÍLIA DE TOKEN junto.** `surface` é a
  do papel e `light` a do painel; no tema claro muitas se equivalem, então o erro não aparece até o
  tema escuro voltar. O poço dentro do painel é `bg-light-container` (**#F4F2EF**, o próprio papel),
  o traço é `border-light-outline`, e os campos do `management/ui` aceitam `surface="light"`.
- ⚠️ **A ficha do veículo mostra o TOTAL de eventos, e não a lista** (decisão do usuário em
  08/09/2026). A telemetria repete o mesmo evento muitas vezes no mesmo dia, e a lista saía com
  "USO DOS FREIOS" sete vezes seguidas, mesma data, meia tela para dizer uma coisa só. Rolagem e
  `useIncrementalList` tratavam o sintoma. Quem abre a ficha quer saber SE há evento e quanto; quem
  quer ver quais vai para `/gestao/seguranca`, que tem filtro por tipo e severidade, vídeo e
  contestação. O `RecentEvents` local foi removido (o hook `useIncrementalList` segue em uso em
  `drivers-page` e `trucks-page`).
- ⚠️ **`/gestao/seguranca` aceita `?placa=` na URL** e semeia a busca com ela. É **semente, não
  sincronia**: depois de montada, quem manda no campo é quem digita. Espelhar a URL a cada tecla
  brigaria com o input e encheria o histórico do navegador de uma entrada por letra. É o que faz o
  botão "Ver eventos" da ficha do veículo cair já filtrado.
- ⚠️ **O painel do veículo abre o MANUAL, não o cadastro** (decisão do usuário em 08/09/2026). O
  botão "Cadastro da operação" abria o `VehicleRegistryModal`, que é o mesmo formulário editável de
  `/gestao/caminhoes/cadastro`: o produto tinha duas portas para a mesma edição e nenhuma para
  simplesmente LER a ficha. Agora é `VehicleManualDialog`, leitura pura das cinco seções do
  cadastro. ⚠️ O `VehicleRegistryModal` **continua vivo** e é usado pela rota de cadastro: não é
  código morto.
- ⚠️ **As seções do manual saem de `secoesDo()`, uma lista de dados, e não de JSX escrito à mão.**
  É o que faz a tela e o papel nunca divergirem. Campo novo no cadastro entra ali uma vez.
- ⚠️ **"Baixar" é `window.print()`, e não uma biblioteca de PDF.** O navegador oferece "Salvar como
  PDF" e compõe o documento do próprio HTML; uma lib custaria centenas de KB no bundle por um
  resultado pior. O `@media print` fica no fim do `globals.css` e isola quem tem `data-print-root`.
  ⚠️ A técnica é `visibility`, e não `display`: o diálogo do Radix vive num portal no fim do `body`,
  e esconder por `display` levaria o ramo inteiro junto. Para tornar outra coisa imprimível, basta
  pôr `data-print-root` nela.
- ⚠️ **O molde de tela do painel tem TRÊS camadas, nesta ordem**, e quem sair dele destoa:
  `HeroBand` → `<section>` com a fileira que morde a borda (`-mt-16 sm:-mt-20`) → `PageContent` com
  `rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]`. ⚠️ São **dois `QueryState`**, um por
  camada: a subida fica dentro da seção e não em volta dela, senão o estado de carregando e o de
  erro aparecem por cima da faixa colorida.
- ⚠️ **`/gestao/impedimentos` estava sem o painel branco** (corrigido em 08/09/2026, relatado pelo
  usuário como "não tá igual às outras rotas"): usava `<PageContent>` cru, então o conteúdo
  flutuava no papel, e os cards de severidade ficavam dentro dele em vez de entre a faixa e o
  painel. ⚠️ O sinal de que era bug e não decisão: `BlockerQueue`, `BlockerRow` e `SeverityCards` já
  escreviam nos tokens `on-light`, ou seja, foram feitos para um painel branco que a página não
  fornecia. No tema claro `on-light` e `on-surface` têm o mesmo valor, e é por isso que ninguém viu
  antes: só o painel faltando aparecia.
- ⚠️ **A faixa de estado existe para SOBREVIVER à seleção, e o padrão já mordeu DUAS telas.** Em
  `/gestao/viagens` o atraso e em `/gestao/caminhoes` o status eram escondidos na linha escolhida
  (`selected ? null : <Chip/>`), porque o chip tonal não se lê sobre o laranja. Em caminhões isso
  significava que abrir um veículo BLOQUEADO apagava justamente a informação de que ele não pode
  sair. ⚠️ Sempre que uma lista esconder algo com `active ? null :`, o problema é a falta da faixa,
  e não o chip. Mapas prontos: `tripRail()` em `trips-page.tsx` e `VEHICLE_STATUS_RAIL` em
  `trucks/vehicle-status.tsx`. ⚠️ Este último soma um aviso `react-refresh/only-export-components`
  no arquivo, que já tinha o mesmo por exportar `VEHICLE_STATUS_LABELS`: é aceito, como em
  `approval-meta.tsx`, para não fragmentar os metadados de status.
- ⚠️ **A faixa de estado existe para SOBREVIVER à seleção.** Em `/gestao/viagens` o atraso era um
  ícone que a própria seleção escondia (`active ? null : late ? ...`), porque o chip tonal não se lê
  sobre a linha laranja: abrir a viagem apagava a informação mais importante dela. A faixa fica fora
  do preenchimento e vale nos dois estados. `tripRail()` mapeia `isLate` para `bg-error` e
  `finishedLate` para `bg-warning`.
- ⚠️ **DÍVIDA ABERTA em 08/09/2026, levantada mas NÃO corrigida** (fora do escopo do que foi pedido;
  perguntar antes de mexer). Os dois defeitos que já foram corrigidos em liberações, pareceres,
  impedimentos e viagens continuam em outras telas:
  1. `text-primary text-headline-md` em título de painel, que contraria a decisão de 30/08/2026 (a
     cor de marca é de ação, link e série de gráfico, não de título): `drivers-page`,
     `checklists-page`, `report-schedules` e `report-history`. (Já corrigidos: `trucks-page`,
     `trips-page`, `maintenance-page`.)
  2. Estado vazio de master-detail com `bg-surface-lowest` + `text-on-surface-muted` + `min-h-80`
     dentro de um `PageContent bg-light`, que é a família de token errada:
     `owner-approvals-page`, `drivers-page` e `reports-page`. (Já corrigidos: `trucks-page`,
     `trips-page`, `releases-page`, `diagnoses-page`.)
- ⚠️ **As filas master-detail do painel seguem UMA gramática, fechada em 08/09/2026.** Vale para
  `/gestao/liberacoes`, `/gestao/pareceres`, `/gestao/aprovacoes` e `/gestao/impedimentos`. Ao criar
  ou mexer numa fila, copie daqui e não invente:
  1. **Faixa de severidade** de 4px (`SEVERITY_RAIL`) à esquerda da linha, e a cor SEMPRE repete um
     rótulo escrito. Nunca é o único portador.
  2. **Linha de identidade** com o título à esquerda e o número que ordena a fila à direita
     (horas paradas, data de detecção), `tabular` e com peso de dado.
  3. **Linha de apoio** com severidade em `SEVERITY_TEXT` + o tamanho do problema. Corrente de
     pontos com mais de dois itens quebra em três linhas na coluna de 360px: não empilhe.
  4. **Painel de detalhe em zonas nomeadas**: veredito (a regra que muda o que a pessoa pode fazer,
     no topo), contexto (uma linha, um peso), evidência, ação.
  5. **`xl:sticky xl:top-6 xl:self-start`** no detalhe: sem `self-start` o grudado não tem altura
     dentro do grid.
  6. **Estado vazio com tokens `light`** (`bg-light-container`, `text-on-light-muted`). ⚠️ Os quatro
     nasceram com `bg-surface-lowest` + `text-on-surface-muted`, que é a família do tema e não a do
     painel claro. Se achar esse par dentro de um `PageContent bg-light`, é bug.
- ⚠️ **Resumo de fila muda de cor com a situação.** O `Alert` sobre o painel troca error/warning/
  success conforme o que está em jogo. `/gestao/pareceres` tinha um `GlassCard` neutro em que a
  frase mudava e a tela não: "tudo explicado" e "1 grave precisa subir" saíam no mesmo cinza.
- ⚠️ **A ordenação das filas NÃO é uniforme, e isso é sabido.** `liberacoes` ordena por horas
  paradas (decisão registrada no topo do arquivo: "o que dói é o ativo parado"), `aprovacoes` por
  severidade e depois idade, e `pareceres` **não ordena**: sai na ordem da API. Numa fila em que a
  severidade decide quem resolve, isso é dívida aberta, deixada de fora por ser comportamento e não
  layout. Perguntar antes de mexer.
- ⚠️ **O `ghost` do `SpectrumButton` tinha CINCO remendos locais que o anulavam**, removidos em
  08/09/2026. Era sempre a mesma string (`border-light-outline text-on-light bg-light-container
hover:bg-light hover:border-on-light-muted`) com o mesmo comentário: "ghost é desenhado para o
  grafite, sobre o painel claro precisa da borda e do texto escuros para não sumir". Verdade
  enquanto o ghost era véu claro; mentira desde que ele virou contorno marinho, que dá 17,5:1 sobre
  o painel branco. Ficavam em `release-detail-panel`, `approval-detail-panel`,
  `diagnosis-detail-panel`, `extension-detail-panel` (dois) e `billing-page`. ⚠️ Ao mudar uma
  variante do `SpectrumButton`, **procure os `className` locais que a sobrescrevem**: a variante
  troca e a tela não muda, e o motivo escrito no comentário costuma já ter caducado.
- ⚠️ **A ABA escolhida não é nem preta nem terracota: é pastilha clara com escrita marinha**
  (`page-tabs.tsx`, 08/09/2026). O preto era o maior contraste da tela gasto no filtro mais
  barato da página, e terracota faria a mesma cor responder a duas perguntas diferentes ("onde
  estou no sistema" e "que fatia desta tela vejo"). O desenho é o de controle segmentado: o
  escolhido é o que sobe do poço, hierarquia por superfície e não por preenchimento. Vale em 14
  features de `/gestao`, então é a mudança de maior alcance desta leva.
- ⚠️ **O botão de apoio é o mesmo objeto nos dois painéis**: `ghost` do `SpectrumButton` (26 usos em
  `/gestao`) e `outline` do `Button` (12 usos em `/app`) são traço marinho `/60` com escrita
  marinha, sem preenchimento. O `ghost` do `Button` do operacional **não** entrou: lá ele é o botão
  discreto e o só-ícone, que tem regra própria (`acao-*`).
- ⚠️ **Não** ligar `DARK_MODE_ENABLED` de volta sem refazer as telas no escuro: a rampa escura
  continua inteira, mas nunca foi revisada contra o desenho novo.
- ⚠️ **Não** pintar a marca com filtro (`brightness-0`, `invert`) para adaptá-la ao fundo: o "Rook" é
  branco chapado e obedece, mas a torre é gradiente indigo e vira preta. Trocar de arquivo pelo mapa
  de `components/shared/brand-assets.ts`.
- ⚠️ **Não** tentar consertar anel de foco de conteúdo Radix trocando `focus-within` por
  `focus-visible`. Medido no navegador em 30/08/2026: com a lista do `GlassSelect` fechada por
  clique, **os dois casavam**. A causa é o Radix devolver o foco ao gatilho por código em
  `onCloseAutoFocus`, e o navegador tratar foco programático como foco de teclado. A correção é
  rastrear a modalidade (`onPointerDown` e `onPointerDownOutside` marcam ponteiro, `onKeyDown`
  desmarca) e só deixar o foco voltar quando foi teclado. O caminho mais comum não é o clique fora:
  é **escolher uma opção com o mouse**, que fecha a lista do mesmo jeito.
- ⚠️ **Não** pôr anel de foco em item de `listbox` que o Radix percorre. Ele foca a opção escolhida
  por código ao abrir, e o anel aparecia por cima do realce mesmo quando a lista foi aberta com o
  mouse. Quem indica a posição do teclado numa lista é o realce de fundo (`data-[highlighted]`).
- ⚠️ **Item de flex não encolhe sozinho: `truncate` sem `min-w-0` não corta nada.** Item de flex tem
  `min-width: auto` e se recusa a ficar menor que o conteúdo. No gatilho do `GlassSelect`, um nome
  como "SERVIOESTE - RJ CAMPOS DOS GOYTACAZES" vazava por cima da borda do campo e empurrava a seta
  para fora. O conserto é `min-w-0 flex-1 truncate` no invólucro do valor, mais `overflow-hidden` no
  gatilho como rede. `whitespace-nowrap` sozinho **piora**: impede a quebra sem permitir o corte.
- ⚠️ **`secondary` do `SpectrumButton` não é "botão secundário".** É cyan cheio, e existe para telas
  com duas escolhas equivalentes. Usá-lo em ação opcional inverte a hierarquia: no diálogo de
  cadastro, "Adicionar foto" ficava mais forte que "Cadastrar motorista". Ação de apoio é `ghost`.
- **O rodapé do diálogo é só decisão: fechar ou gravar** (decisão do usuário em 30/08/2026). Ação
  sobre o formulário, como limpar, mora no corpo, junto do que ela afeta. Antes o mesmo canto do
  rodapé era "Limpar" no cadastro e "Cancelar" na edição, e quem cadastrava em lote não tinha como
  fechar o diálogo pelo rodapé.
- ⚠️ **Botão que é SÓ um ícone nunca pinta fundo.** Alinhado com o outro sistema do usuário em
  30/08/2026. Ele **nasce na cor do seu papel** e o hover é a mesma cor um degrau adiante: a cor é o
  rótulo, porque não há texto. As classes são `.acao-editar` (indigo), `.acao-excluir` e
  `.acao-sair` (vermelho), `.acao-ativar` (verde) e `.acao-neutra` (cinza), em `styles/globals.css`,
  e valem nos dois painéis. Isso substituiu o `hover:bg-on-surface/[0.06]`, que escondia o desenho,
  e o anel vermelho que os dois botões de sair desenhavam no hover.
- ⚠️ **A regra do ícone sozinho vale nos DOIS painéis, e o operacional chega nela por outro
  caminho.** Na gestão as classes `.acao-*` são escritas à mão em cada botão. No operacional os
  botões são `<Button variant="ghost" size="icon">`, e um `compoundVariant` em `ui/button.tsx`
  aplica a regra a todos de uma vez: sino, menu da topbar, engrenagem, todos os "voltar", a
  navegação do calendário e o retorno do assistente de voz. Alinhado em 30/08/2026, depois de o
  usuário notar que a técnica tinha ficado só na gestão.
- ⚠️ **Um `hover:text-*` que sobre no elemento MATA a classe `.acao-*` em silêncio, e o código
  parece certo.** São duas coisas ao mesmo tempo: as `.acao-*` moram em `@layer components`, e no
  Tailwind 4 qualquer utilitário vence a camada de componente; e o `tailwind-merge` não desfaz o
  conflito porque não conhece `.acao-neutra`, então ele deixa o `hover:text-secondary-foreground`
  do `ghost` passar junto. Por isso o `compoundVariant` **repete a cor do hover como utilitário**
  (`hover:text-on-surface`): é o que faz o merge enxergar o conflito e derrubar a cor do `ghost`.
  Não dá para confiar na leitura do código aqui, tem que medir a cor computada no hover.
- ⚠️ **Uma exceção, e ela não é sobre realce:** o botão de recolher a barra lateral mantém
  `hover:bg-sidebar`. Ele monta em cima da borda da barra e precisa de fundo opaco em repouso,
  senão o traço da divisa atravessa o desenho. O que a regra proíbe é o fundo APARECER no hover;
  ali ele só continua existindo, e quem responde ao cursor é a cor do traço.
- ⚠️ **Estado ativo e hover são EXCLUSIVOS, nunca somados** (corrigido em 30/08/2026, a pedido do
  usuário). Escrever o hover na string base e o ativo num `&&` depois parece certo e não é: no
  hover a regra `:hover` vence a base por especificidade, então ela apaga a pastilha do item
  ativo. Na lateral do painel operacional o preto virava papel a 6% e o ícone, que é claro por
  estar dentro da pastilha, sumia: medido em **1,03:1**. O item de menu piscava e apagava
  justamente quando a pessoa apontava para ele. Vale para menu, aba, lista lateral e cartão
  selecionável; a mesma soma estava em `pages/operations/tracking-page.tsx`.
- **`--color-bright-hover` é o degrau do hover da tinta**, e ele CLAREIA (`#2A2724`). Escurecer
  não responde ao cursor, porque `#1C1A18` já está a um passo do preto. Os dois menus usam o
  mesmo token: o superior da gestão e o lateral do operacional.
- ⚠️ **A tinta de um chip não é o token do fundo dele.** As variantes tingidas do `ui/badge.tsx`
  eram a matiz a 15% com a MESMA matiz por cima. Cada token semântico foi escolhido para dar
  4,5:1 contra o papel BRANCO, mas o papel do chip é ele mesmo diluído, que já subiu meio caminho
  na direção da tinta: "Bloqueia" ficava em 2,99:1, "Alta" em 3,34, "Média" em 3,68 e o indigo do
  avatar em 3,34. A família `-on-light`, que o painel de gestão já usava, existe exatamente para
  isso. Entrou junto o `--color-info-on-light`, que faltava.
- **Como medir contraste aqui:** `getComputedStyle` não serve para o fundo, porque o elemento com
  a cor quase nunca é o que pinta atrás dele, e somar os ancestrais à mão erra na composição de
  alfa. O caminho certo é o CDP: `CSS.getBackgroundColors` devolve o que o DevTools mostra, e daí
  a conversão sai exata pintando fundo e tinta num canvas 1x1 (resolve `oklab` e alfa de uma vez).
  Com esse método, as 15 telas dos dois painéis fecharam sem nenhuma reprovação de AA.
- ⚠️ **Comportamento de componente compartilhado mora num lugar só, e a pele é que muda.**
  Os quatro perfis usam dois conjuntos: `components/ui` no operador e na manutenção,
  `management/ui` no dono e no gestor. O conserto do anel de foco do select nasceu dentro do
  `GlassSelect` e ficou só lá, então o painel operacional passou um dia inteiro com o campo
  contornado depois de cada clique. Virou `hooks/use-pointer-close.ts`, e os dois selects o
  chamam. O `ui/select.tsx` precisou de um contexto para isso: quem usa escreve o `Content` longe
  do `Root`, e passar os handlers à mão em cada uma das oito telas seria a mesma armadilha.
  Mesma passagem alinhou o `ui/checkbox.tsx` ao da gestão: `primary-strong` (o âncora dá 4,32:1
  contra o branco do visto e reprova AA), 20px, raio de 6px e o estado indeterminado, que aqui
  nem existia.
- **O calendário do operador não tinha o mesmo defeito, e foi medido antes de mexer.** O Popover
  do Radix devolve o foco de um jeito que o navegador não trata como teclado: depois de escolher
  um dia com o mouse, `:focus-visible` dá `false`. Não recebeu o hook porque não há o que
  consertar ali, e o dia selecionado já era exclusivo do hover (`!isSelected && hover:...`).
- ⚠️ **`EditIcon` é `LuPencil`, e não `LuSquarePen`.** Corrigido em 30/08/2026 para bater com o
  outro sistema do usuário, que documenta o motivo: em 16px a moldura do quadrado vira ruído ao
  lado da lixeira, que é um desenho aberto. `DeleteIcon` é `LuTrash`.
- ⚠️ **As telas de `/gestao` usam a largura inteira da janela** desde 30/08/2026. O
  `max-w-[1600px] mx-auto` saiu das 21 telas e dos três arquivos de layout: em monitor menor ele não
  fazia nada, e em monitor grande sobrava tarja dos dois lados enquanto a tabela apertava colunas. O
  respiro lateral virou `px-4 sm:px-6 xl:px-10`, que é o que evita o conteúdo encostar na borda.
- ⚠️ **Coluna de tabela leva largura em porcentagem, não deixa o conteúdo mandar.** Com só uma
  coluna declarada (`w-full`), ela engole toda a folga e as outras se espremem numa ponta. As
  porcentagens somam 100 e o navegador distribui a sobra, o que mantém o espaçamento regular em
  qualquer largura de tela. ⚠️ `whitespace-nowrap` numa célula **anula** a porcentagem: o texto mais
  longo força a coluna. Quem tem texto longo usa a rolagem abaixo, e não `nowrap`.
- ⚠️ **Nome longo em lista ROLA no hover, e não é cortado com reticências.** Técnica trazida do
  outro sistema do usuário em 30/08/2026: `max-w-0` no `<td>` e
  `overflow-x-auto overscroll-x-contain whitespace-nowrap` no texto. A barra já é invisível pelo
  `@layer base`, então não precisa de classe extra. O motivo de não usar `truncate`: nesta frota o
  cliente escreve instrução dentro do próprio nome, e a reticência cortava justamente a explicação.
  `overscroll-x-contain` impede que a rolagem vaze para a página ao chegar no fim do texto.
- ⚠️ **Não renderizar lista inteira: usar `Pagination` de `management/ui`**, 30 por página
  (`PAGE_SIZE`). O corte é no cliente e o `total` que entra é o **de depois dos filtros**; passar o
  total da base faria a barra prometer páginas que o filtro esvaziou. A página atual é fixada dentro
  do total em vez de zerada a cada filtro, senão filtrar estando na página 5 deixa a tela vazia.
- ⚠️ **`httpRequest` trata 204 e corpo vazio.** Antes chamava `response.json()` sempre, e uma
  exclusão bem-sucedida (204 sem corpo) estourava com `SyntaxError: Unexpected end of JSON input`. O
  sintoma engana: a operação funcionou no servidor e a tela mostra erro.
- ⚠️ **Excluir grava lápide no backend e é definitivo mesmo com o registro vivo na MiX** (V18). Sem
  ela a exclusão se desfazia sozinha na sincronização seguinte. Ver a memória do `Backend-web`.
- ⚠️ **Excluir e inativar não são o mesmo botão.** Inativar guarda o histórico de quem saiu da
  empresa; excluir remove o cadastro que nunca deveria ter existido, e o backend **recusa com 409**
  quando há viagem, evento, posição ou caminhão apontando para a pessoa. A mensagem do backend vai
  inteira para a tela: é ela que diz o que prende e sugere inativar.
- ⚠️ **`react-icons` é o único pacote de ícone, e `components/icons.ts` o único ponto de import.**
  Verificado em 30/08/2026: zero imports de `react-icons` fora dele. A **única exceção sancionada**
  é o `TRUCK_SVG` de `components/shared/operation-map.tsx`, porque o marcador do MapLibre recebe DOM
  e não componente React; se o `TruckIcon` mudar, aquele precisa mudar à mão.
- ⚠️ **Não** usar `RookhubLogo` sem `tone="adaptive"` fora de fotografia: o padrão é a arte branca, e
  sobre papel ela some.
- **Não** deixar ID da MiX passar por `JSON.parse` do JavaScript nem chegar ao navegador como
  número: 19 dígitos não cabem em `Number` e o arredondamento se manifesta como `401 Not
Authorised`, não como erro de tipo. Ver `Telemetria MiX`.
- **Não** desenhar polling por veículo contra a MiX: o teto é 20 requisições por minuto. Ver
  `Telemetria MiX`.
- **Não** preencher com zero o campo que a telemetria não tem. Ano de fabricação, CPF, CNH, custo
  por quilômetro e plano de manutenção não existem na MiX: o tipo é opcional e a tela mostra
  travessão. Um custo de R$ 0,00 é lido como medição, e depois ninguém distingue o medido do
  chutado.
- **Não** usar `computeIfAbsent` de `ConcurrentHashMap` chamando método que escreve no mesmo mapa:
  o Java responde `IllegalStateException: Recursive update`. Derrubou o primeiro ciclo do
  agendador da MiX. Usar `putIfAbsent` depois de construir.
- **Não** deixar filtro opcional sem `CAST` no SQL do backend: com o parâmetro nulo o Postgres
  recusa com `could not determine data type of parameter`. `CAST(:x AS TEXT) IS NULL OR ...`.
- **Não** ler coluna `::INT` do Postgres como `Double.class` pelo JDBC: ele recusa com
  `conversion to class java.lang.Double from int4 not supported`. Ler no tipo de origem e
  converter em Java.
- **Não** deixar o mapa com centro fixo: o `center` herdado dos mocks era do Rio, e com frota real
  a tela abria numa região vazia. O `fitBounds` roda **uma vez**, no primeiro carregamento; refazer
  a cada polling arrancaria o mapa da mão de quem estivesse navegando.
- **Não** reintroduzir `baseUrl` nem `ignoreDeprecations`: aliases usam caminhos relativos no
  `tsconfig.app.json` e são espelhados no Vite.
- **Não** subir TypeScript acima de `~6.0.3` enquanto `typescript-eslint@8.65` exigir `<6.1.0`.
- **Não** criar `tailwind.config.ts`, PostCSS ou autoprefixer; Tailwind 4 aqui é CSS-first.
- **Não** usar `hsl(var(--...))`; os tokens do painel operacional são OKLCH.
- **Não** deixar barra de rolagem visível: em 19/08/2026 o usuário pediu rolagem sem barra em todo o
  sistema. O `@layer base` de `globals.css` zera `scrollbar-width`, esconde `::-webkit-scrollbar` e
  oculta `[data-radix-scroll-area-scrollbar]` (o `ScrollArea` do Radix desenha barra em DOM, que o
  `::-webkit-scrollbar` não alcança). Como a barra some, área rolável sem pista visual precisa de
  outra dica de conteúdo (sombra, corte de card ou gradiente de borda).
- **Não** montar gestão fora de `.management-theme`, nem devolver cor para dentro desse escopo: a
  cor é comum aos dois painéis desde 19/08/2026 e mora em `src/styles/palette.css`. O que continua
  separado é forma (raio, vidro, Sora, Spectrum).
- **Não** usar `bg-white/N` como véu: some no tema claro. Usar `bg-on-surface/N`. Sobre fotografia
  (topbar e nav do painel de gestão) é o contrário: ali o branco é fixo, com `on-media` no texto.
- **Não** trocar `font-sora` por `font-display`, mover `--radius-pill` para o escopo ou tirar foco e
  seleção do `@layer base` do painel de gestão.
- **Não** atualizar `ref` durante render nem usar `useEffect` + `setState` para media query ou
  sincronização de prop; as regras do React Hooks/Compiler são erro. Use os padrões já existentes.
- **Não** criar WebGL sem `try/catch` nem esquecer de recriar rotas do MapLibre após `setStyle`.
- **Não** duplicar os mocks do operador: triagem e Liberações compartilham estado de propósito.
- `PermissionGuard fallback={null}` não oculta conteúdo, porque `null ?? <NoAccessState />` usa o
  fallback padrão. Para esconder seção, teste `hasPermission(...)` diretamente.
- **Não** aplicar `mix-blend-screen` no tema claro nem usar caminho fixo de logo fora do design
  system correspondente.
- **Não** recriar itens excluídos a pedido do usuário: `.env.example`, tabela de variáveis no
  README, `logo-rookhub-favicon.svg`, PNGs antigos da marca, `rookhub_frontend_kit/`,
  `CLAUDE_FRONTEND_IMPLEMENTATION_PROMPT.md`, `.openai/` ou `src/features/<dominio>/`.
- **Não** recolocar a conta Super Admin no login, sombras/halos removidos ou mudar mídia para LFS sem
  pedido explícito.
- Tratar `npm audit fix` em mudança e commit próprios; não misturar atualização transitiva com
  funcionalidade.
- Em 16/08/2026, a pedido explícito do usuário, o histórico de `main` foi reescrito: o estado atual
  do projeto virou o commit inicial único do repositório (`commit --amend` sobre o `23a1df5` mais
  `push --force-with-lease`). Isso abre exceção à regra do `CLAUDE.md`, que segue valendo: reescrita
  de histórico só com pedido explícito do usuário. Quem já tinha clone precisou de
  `git fetch origin` e `git reset --hard origin/main`. O commit substituído ficou salvo na branch
  local `backup/pre-amend-inicial`.
- `npm run format:check` falha em `.claude/skills/**` (arquivos das skills instaladas, formato de
  terceiros). Não é regressão do projeto e não deve ser "corrigido" com `format:write`, que
  reescreveria centenas de arquivos alheios.
