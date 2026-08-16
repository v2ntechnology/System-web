# Memória do Projeto — RookHub

> Documento versionado e compartilhado pelo time. Guarda somente decisões, limites e armadilhas que
> não ficam claros lendo um arquivo isolado. O código é a fonte de verdade para detalhes de
> implementação e versões.

> **Como usar:** localize os títulos com `rg -n "^#{2,3} " .claude/memoria.md`, leia a seção ligada à
> tarefa e sempre `Gotchas`. Ao atualizar, registre apenas informação durável e não dedutível do
> código; não transforme este arquivo em diário de alterações.

**Índice:** Produto e escopo · Arquitetura e áreas do sistema · Entrada, sessão e perfis · Temas e
identidade visual · Mapas, cenas e voz · Segurança e ambiente · Documentação e próximos passos ·
Gotchas

---

## Produto e escopo

- **RookHub** é um SaaS de gestão inteligente de frotas para transportadoras: telemetria,
  rastreamento, viagens, veículos, motoristas, abastecimentos, manutenção, multas, checklists e
  inteligência operacional.
- Este repositório é o **MVP frontend**. A experiência é navegável, mas usa dados simulados. Não
  criar backend, banco, cobrança, autenticação, telemetria ou LLM reais sem pedido explícito.
- As telas consomem contratos e hooks de `src/services`; mocks são a implementação atual e devem
  poder ser substituídos por HTTP sem reescrever as páginas.
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

  | Área      | Público principal                | Convenções                                                                                                           |
  | --------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
  | `/app`    | operação, manutenção e motorista | `src/pages`, shadcn/ui, Lucide, tokens OKLCH, estrutura rasa por categoria do menu                                   |
  | `/gestao` | proprietário e gestor            | `src/management`, organização por feature, exportações nomeadas, Phosphor, primitivos próprios e vidro sobre grafite |

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
- Papéis canônicos: `OWNER`, `MANAGER`, `OPERATOR`, `MAINTENANCE`, `SUPER_ADMIN` e `DRIVER`. Não
  reintroduzir os nomes antigos `TENANT_ADMIN`, `FLEET_MANAGER`, `MAINTENANCE_MANAGER` ou `VIEWER`.
- A lista de contas demonstrativas contém apenas os quatro perfis de cliente pedidos pelo usuário;
  `SUPER_ADMIN` continua acessível pelo menu de demonstração, mas não deve voltar ao login sem pedido.
- A autenticação é simulada: o e-mail define o perfil, nenhum token é criado e a sessão não persiste
  após recarregar. `DemoMenu` alterna perfil/plano somente para demonstração e não representa produção.
- `AuthUser.operatorSeesFinancials` controla a exposição de valores consolidados ao operador. Ao
  trocar o perfil no modo demonstração, trocar a identidade completa, não apenas o campo `role`.
- Guardas de perfil, permissão e plano são **UX**, não segurança. O backend futuro deve revalidar
  autorização e entitlement em todas as operações.

## Temas e identidade visual

### Painel operacional

- Tailwind 4 é CSS-first via `@tailwindcss/vite`; o tema vive em `src/styles/globals.css`. Tokens do
  painel operacional são OKLCH e o tema escuro é o padrão.
- Fora de utilitários Tailwind, usar `var(--color-...)` e `color-mix(in oklch, ...)`.
- `theme-store.ts` aplica `theme-switching`, troca a classe do tema, força recálculo com
  `getComputedStyle` e só então restaura transições. Essa leitura evita a piscada durante a troca.

### Painel de gestão

- A separação visual é deliberada. Toda tela de `src/management` e as telas de acesso precisam de
  um ancestral `.management-theme`.
- Em `management/styles/theme.css`, tokens **novos**, que precisam gerar utilitários, ficam em
  `@theme`; tokens que colidem com o painel operacional são redefinidos em `.management-theme`.
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
- `/assistente` continua demonstrativo: não há chamada real a LLM. A síntese usa
  `/api/voice/synthesize`, exposta pelo plugin Node do Vite em desenvolvimento/preview. A chave da
  ElevenLabs nunca vai ao navegador; o áudio alimenta o `AnalyserNode` e `SpeechSynthesis` é fallback.
  Em produção, esse contrato deve migrar para o backend real.

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

## Documentação e próximos passos

- `docs/pdf/RookHub_Arquitetura_e_Decisoes_Tecnicas.pdf` descreve a arquitetura-alvo completa
  (backend Java/Spring, PostgreSQL/TimescaleDB, Redis, R2, Gemini e infraestrutura). **Não descreve o
  estado implementado**, que ainda é frontend com mocks. Consulte o código e o README para o agora.
- PDFs e vídeos em `docs/` são versionados de propósito. Não sugerir removê-los ou migrá-los para
  LFS sem solicitação.
- Pendências principais: API e autenticação reais; autorização no backend; integrações de
  telemetria/mapa/multas/IA; paginação server-side; smoke E2E; code splitting; decidir o destino da
  cópia em `System-mobile`; avaliar persistência segura de sessão; migrar para TS 7 quando o
  ecossistema de lint suportar.

## Gotchas

- **Não** reintroduzir `baseUrl` nem `ignoreDeprecations`: aliases usam caminhos relativos no
  `tsconfig.app.json` e são espelhados no Vite.
- **Não** subir TypeScript acima de `~6.0.3` enquanto `typescript-eslint@8.65` exigir `<6.1.0`.
- **Não** criar `tailwind.config.ts`, PostCSS ou autoprefixer; Tailwind 4 aqui é CSS-first.
- **Não** usar `hsl(var(--...))`; os tokens do painel operacional são OKLCH.
- **Não** misturar os design systems de `/app` e `/gestao` nem montar gestão fora de
  `.management-theme`.
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
