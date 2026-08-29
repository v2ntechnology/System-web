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
- PDFs e vídeos em `docs/` são versionados de propósito. Não sugerir removê-los ou migrá-los para
  LFS sem solicitação.
- Pendências principais: ligar `services/api` (painel operacional) na API real; tela de Viagens,
  que depende de decidir entre cadastro próprio e TMS do cliente; origem de custo; encadear a voz
  com a resposta do assistente; autorização revalidada no backend; integrações de multas e câmeras;
  paginação server-side; smoke E2E; code splitting; decidir o destino da cópia em `System-mobile`;
  migrar para TS 7 quando o ecossistema de lint suportar.

## Gotchas

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
