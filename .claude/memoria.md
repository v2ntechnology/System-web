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

  | Projeto           | Responsabilidade                  | Repositório                     |
  | ----------------- | --------------------------------- | ------------------------------- |
  | `System-web`      | esta aplicação React/Vite         | `v2ntechnology/System-web`      |
  | `System-mobile`   | monorepo com painel e app Expo    | `v2ntechnology/System-mobile`   |
  | `Backend-web`     | a API que serve os três clientes  | `v2ntechnology/Backend-web`     |
  | `Website-rookhub` | site institucional Next.js        | `v2ntechnology/Website-rookhub` |

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

### Paleta única

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
  MiX é de 5 em 5 minutos), e o React Query faz *structural sharing*: dado igual mantém a MESMA
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
- **O status é dito por um DISCO no chão, não pela pintura do caminhão.** Tingir o modelo
  estragaria a textura, e no tamanho em que ele aparece a cor da lataria não se lê. O escolhido
  cresce 25%, que é o papel que o halo fazia na versão 2D.
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
- `ACCESS_TOKEN_GITHUB` no `.env` é o PAT do GitHub usado para autenticar o push desta máquina. Não
  tem prefixo `VITE_` e nunca deve ganhar um: não é variável de aplicação. Para usá-lo, passar por
  `GIT_ASKPASS` com `credential.username=x-access-token`, nunca embutir o valor na URL do remoto nem
  em argumento de comando.
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
