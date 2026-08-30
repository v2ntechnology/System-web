# Memória do Projeto — RookHub

> Documento versionado e compartilhado pelo time. Guarda somente decisões, limites e armadilhas que
> não ficam claros lendo um arquivo isolado. O código é a fonte de verdade para detalhes de
> implementação e versões.

> **Como usar:** localize os títulos com `rg -n "^#{2,3} " .claude/memoria.md`, leia a seção ligada à
> tarefa e sempre `Gotchas`. Ao atualizar, registre apenas informação durável e não dedutível do
> código; não transforme este arquivo em diário de alterações.

**Índice:** Produto e escopo · Arquitetura e áreas do sistema · Entrada, sessão e perfis · Temas e
identidade visual · Mapas, cenas e voz · Segurança e ambiente · Telemetria MiX · Documentação e
próximos passos · Gotchas

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
- O produto está dividido em três projetos irmãos, sem compartilhamento automático de código:

  | Projeto         | Responsabilidade               | Repositório                   |
  | --------------- | ------------------------------ | ----------------------------- |
  | `System-web`    | esta aplicação React/Vite      | `v2ntechnology/System-web`    |
  | `System-mobile` | monorepo com painel e app Expo | `v2ntechnology/System-mobile` |
  | `Website`       | site institucional Next.js     | `v2ntechnology/Website`       |

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
  `Outlet` — e nenhum por rota. Um limite por rota é criado do zero a cada navegação, e limite novo
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

## Entrada, sessão e perfis

- `/` é o login; `/login` só redireciona links antigos. O login, a recuperação e o convite vivem no
  mesmo módulo (`pages/login/login-page.tsx`) e usam o visual de `.management-theme`.
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
- A lista de contas demonstrativas contém apenas os quatro perfis de cliente pedidos pelo usuário;
  `SUPER_ADMIN` continua acessível pelo menu de demonstração, mas não deve voltar ao login sem pedido.
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

### Redesign de 30/08/2026 — o desenho atual

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
- **A pastilha do item ativo é preta** (`bg-bright text-on-bright`), no menu
  superior da gestão E na lateral do operacional. É o que faz as duas cascas
  lerem como um sistema só. Indigo ficou para ação, link e primeira série de
  gráfico: usá-lo também no estado ativo gastava a cor até parar de significar.
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

### Paleta única (19/08/2026)

- Decisão do usuário: os dois painéis passaram a ter a **mesma identidade** em claro e escuro. A
  fonte única é `src/styles/palette.css`. O `@theme` de lá declara a rampa **escura** (padrão do
  produto) e o bloco `html.light`, fora de camada, redefine as mesmas variáveis com a rampa clara.
  `html.light` tem especificidade maior que o `:root` do `@theme`, então vence sem depender da ordem
  dos arquivos.
- Âncoras: grafite `#212121` no escuro (o azul-noite `#0B1220` do painel operacional foi aposentado
  porque puxava a tela para o roxo), papel `#F2F2F3` no claro, indigo `#6366F1` como primária e cyan
  `#06B6D4` como secundária. Roxo só no gradiente Spectrum.
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
  tema e em seguida sobe até o `onSelect` do item, que **alterna** de novo — as duas ações se
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

### As duas fichas ficaram do tamanho do mercado (30/08/2026)

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
  cada quadro, e o pai é a página inteira: lista de 33 veículos, ficha e mapa re-renderizavam
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

### A base cartográfica dos três mapas (30/08/2026)

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

### Marca e artes

- No painel operacional, usar `BrandLogo`, `RookMark` e `RobotMark`. O sufixo do arquivo indica a
  cor da arte: `-white` aparece no tema escuro e `-dark` no claro. O painel de gestão usa seu próprio
  `RookhubLogo` e os assets de `src/assets`.
- As artes 3D da hub (`hub-robot.png` e `hub-rook.png`) já têm transparência. `mix-blend-screen` é
  apenas realce do tema escuro; no tema claro ele apaga a imagem.
- Os SVGs do mascote dependem de subpaths num único `<path fill-rule="evenodd">`; separar os paths
  fecha os recortes do visor e da boca.

## Mapas, cenas e voz

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
- `ACCESS_TOKEN_GITHUB` no `.env` é o PAT do GitHub usado para autenticar o push desta máquina. Não
  tem prefixo `VITE_` e nunca deve ganhar um: não é variável de aplicação. Para usá-lo, passar por
  `GIT_ASKPASS` com `credential.username=x-access-token`, nunca embutir o valor na URL do remoto nem
  em argumento de comando.
- Não persistir tokens ou dados sensíveis em `localStorage`. A persistência atual guarda apenas
  preferências não sensíveis, como tema.

## Telemetria MiX

Acesso validado de ponta a ponta em 24/08/2026, contra o ambiente US
(`identity.us.mixtelematics.com/core` e `integrate.us.mixtelematics.com`). O que segue são limites
do fornecedor e armadilhas do teste, não configuração: credenciais ficam só no `.env`.

- Só o grant **`password`** está liberado para a aplicação. `client_credentials` responde
  `unauthorized_client`, e a diferença para `invalid_client` é justamente a prova de que a
  credencial da aplicação é válida. O token dura 1h e vem com `refresh_token`, então o backend
  depende de renovar por refresh: não existe conta de serviço.
- ⚠️ **IDs de 64 bits são destruídos pelo `JSON.parse` do JavaScript.** Os identificadores da MiX
  têm 19 dígitos e o `Number.MAX_SAFE_INTEGER` tem 16. `1723190672275386368` vira
  `1723190672275386400` silenciosamente. Com o ID arredondado a API responde
  `401 UnauthorizedAccessException: Not Authorised`, ou seja, **o sintoma parece falta de permissão
  e é ID inexistente**. Em Node, extrair os ids do texto cru antes do parse; no Java, `long` na
  ingestão e **string na borda** que serializa para o navegador. Por isso `external_id` é `TEXT` no
  schema do `Backend-web`.
- Os ids são `long` **com sinal**: `SiteGroup` e `EventTypeId` aparecem negativos. Nada de
  `UNSIGNED` nem validação que rejeite negativo.
- ⚠️ **Teto de 20 requisições por minuto** (`429 API calls quota exceeded`). Isso define o
  scheduler: 5 organisation groups por 3 fluxos são 15 chamadas, ou seja, cabe **um ciclo de
  polling por minuto** e sobram 5 chamadas para cadastro. Polling por veículo é inviável. Falta
  confirmar com a MiX se o limite é por conta, por aplicação ou por IP.
- **`sinceToken=NEW` significa "comece de agora"**, não "traga o histórico": a primeira chamada
  volta 0 registros e só o cursor. Backfill exige montar o cursor no formato `yyyyMMddHHmmssfff`
  com data no passado. O cursor seguinte vem no header `GetSinceToken`.
- Rotas `latest` exigem `quantity=1` quando o corpo traz vários ids
  (`positions/groups/latest`, `trips/assets/latest`). As rotas de **eventos por ativo** pedem um
  `EventFilter` no corpo cujo formato não foi decifrado em três tentativas; o fluxo do MVP é a rota
  incremental por organização, que não precisa de filtro.
- `DisplayTimeZone` vem como ID do Windows (`E. South America Standard Time`), não IANA. Converter
  antes de usar.
- Volume medido no piloto: 24 veículos de um grupo geraram **65.452 posições em 3 dias**, cerca de
  900 por veículo por dia, uma a cada 95 segundos. Use esse número para dimensionar a hypertable,
  não a estimativa do documento executivo.
- ⚠️ **`ignition_on` não tem equivalente no payload da MiX**, que traz `IsAvl`, `Source`, `Hdop`,
  `Pdop` e `NumberOfSatellites`. Precisa ser derivado do início e fim dos trechos em
  `vehicle_journeys`. Continua valendo.
- O schema do `Backend-web` **cobre viagens, eventos e catálogo de tipos** desde as migrations V3 a
  V7 (`vehicle_journeys`, `vehicle_events`, `event_types`). A afirmação antiga de que faltavam
  essas tabelas venceu: ver a subseção de 26/08/2026 logo abaixo, que é o estado corrente.

### Coleta ligada de ponta a ponta (26/08/2026)

Conector multiempresa, coleta incremental e telas com dado real. O que foi descoberto medindo, e
não lendo documentação:

- ⚠️ **O `sinceToken` retroage no máximo 7 dias.** Ele é um timestamp e aceita valor no passado,
  mas além disso a MiX responde `400 ArgumentException: SinceToken must not be older than 7 days`.
  Não é limite de quantidade: 14 dias falha com qualquer `quantity`. **Consequência de produto:
  cliente novo entra enxergando uma semana, e não há como reconstruir histórico antigo por esta
  rota.** Histórico maior exigiria o Data Feed, contratado à parte.
- ⚠️ **Os eventos que o cliente usa têm `category = System`.** "VELOCIDADE LIMITE" e "USO DOS
  FREIOS" são eventos padrão que ele renomeou em português. Filtrar por
  `category NOT IN ('Hidden','Diagnostic','System')` parecia o caminho óbvio e esconderia
  justamente os eventos com volume. O filtro correto é por categoria de risco derivada da
  descrição.
- **114 tipos de evento na frota, e 33 deles são saúde do rastreador**: "Firmware version changed",
  "OBC unit reset", "MiX Vision: Power loss". Sem uma categoria própria, apareciam na tela de
  segurança ao lado de sonolência ao volante.
- ⚠️ **"ACELERAÇÃO (Evolução das marchas)" não é aceleração brusca.** São 3.053 ocorrências em 7
  dias numa frota de 41 caminhões: é o contador de progressão de marchas do pacote de direção
  econômica. Classificado como risco, sozinho zerava a nota de todos os motoristas.
- ⚠️ **Não existe escala absoluta de nota de motorista.** Esta frota gera 170 eventos de freio por
  mil quilômetros porque o evento dela conta uso do freio; outro cliente, com o evento padrão da
  MiX, geraria dois. A nota é relativa à própria frota: 75 na média dela, 100 para quem não gera
  evento, 50 para quem gera o dobro.
- **`IsSystemDriver` não basta para identificar conta de sistema.** Dez contas vinham marcadas e
  outras doze não, com o mesmo papel. Sete se chamam "Automatically created driver N" e cinco
  "Unknown"; uma delas apareceu no mapa dirigindo um caminhão. O casamento é por **prefixo** do
  nome, nunca por trecho, senão um sobrenome legítimo vira conta de sistema.
- **Posição do fluxo incremental vem sem `FormattedAddress`.** O endereço geocodificado só
  acompanha início e fim de trecho, e a posição do evento. O mapa mostra coordenada quando não há
  endereço.
- Volume real das 5 organizações: **54 ativos, 41 placas distintas, 149 motoristas, 154.625
  posições por dia**, cerca de 2.863 por veículo por dia, uma a cada 30 segundos.

## Documentação e próximos passos

- `docs/pdf/RookHub_Arquitetura_e_Decisoes_Tecnicas.pdf` descreve a arquitetura-alvo. **Não descreve
  o estado implementado**, e diverge do que foi construído em três pontos registrados em
  `Backend-web/docs/INFRAESTRUTURA.md`: ele diz OpenAI (existem chaves de Gemini também), diz AWS
  (fomos de Oracle e Cloudflare por custo) e não menciona TimescaleDB, que está no schema desde a
  `V1__baseline.sql`. Consulte o código e os READMEs para o agora.
- Os PDFs em `docs/pdf/` são versionados de propósito. Não sugerir removê-los ou migrá-los para LFS
  sem solicitação.
- ⚠️ **`docs/referencias/` não existe mais** (removida a pedido do usuário em 30/08/2026): eram 4
  vídeos de WhatsApp e 2 PNGs de referência visual, 13 MB. Saíram junto do `public/images/` as
  capturas `truck-login`, `dashboard-preview-dark/light` e `assistant-preview-dark/light`, 2,9 MB
  que **nenhum código importava**. Sobraram em `public/images/` só `hub-robot.png` e `hub-rook.png`,
  que são as artes dos dois cartões do hub. Não recriar.
- Pendências principais: ligar `services/api` (painel operacional) na API real; tela de Viagens,
  que depende de decidir entre cadastro próprio e TMS do cliente; origem de custo; encadear a voz
  com a resposta do assistente; autorização revalidada no backend; integrações de multas e câmeras;
  paginação server-side; smoke E2E; code splitting; decidir o destino da cópia em `System-mobile`;
  migrar para TS 7 quando o ecossistema de lint suportar.

## Gotchas

- ⚠️ **Não** reintroduzir a foto do banner, a borda dos cards nem o vidro no tema claro. Os três
  saíram no redesign de 30/08/2026 e cada um deixou rastro em vários arquivos. Ver
  `Redesign de 30/08/2026`.
- ⚠️ **Não** usar `bg-surface-lowest` para bloco de indicador: é o token do **poço**, mais escuro
  que o papel, e o indicador afunda no fundo. Usar `.metric-tile`. Campo de entrada continua no
  poço, que é o `.glass-well`.
- ⚠️ **Não** pintar estado ativo de indigo. A pastilha ativa é preta nos dois painéis; o indigo é de
  ação, link e série de gráfico.
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
