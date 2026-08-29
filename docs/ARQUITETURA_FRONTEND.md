# Arquitetura do Frontend — RookHub

Este documento registra as principais decisões técnicas da fundação do frontend.

> **Estado em 29/08/2026.** O texto abaixo foi escrito na Fase 1, quando não existia backend. A
> fundação continua valendo, mas a Fase 2 começou: autenticação, frota, mapa, motoristas,
> segurança, assistente de IA e notificações já vêm da API real do `Backend-web`. Os trechos que
> descrevem simulação seguem verdadeiros apenas para os módulos ainda não ligados. Onde a diferença
> importa, ela está marcada na própria seção.

## 1. Objetivo e escopo

Entregar uma base **sustentável e escalável** do frontend, não um protótipo descartável.
A arquitetura foi desenhada para trocar mocks por chamadas HTTP reais **sem reescrever as telas**,
e foi exatamente isso que permitiu ligar a API real módulo a módulo, sem parar o produto.

## 2. Organização das pastas

A estrutura é deliberadamente **rasa**: o projeto ainda é pequeno, e uma hierarquia
profunda custava três níveis para chegar em um único arquivo.

- `app/` — composição da aplicação: `router.tsx` (lazy loading, guardas e os três grupos de
  rotas), `providers.tsx` (Query, Tema, Tooltip, Toaster) e a configuração (`navigation`,
  `permissions`, `plans`, `environment`).
- `pages/` — telas agrupadas pelas **categorias do menu**: `login/`, `hub/`, `dashboard/`,
  `operations/`, `costs/`, `intelligence/`, `administration/`, `saas/` e `misc/`. As três
  telas de acesso vivem juntas em `login/login-page.tsx`, que também abriga o layout de
  autenticação. `hub/` é a porta de escolha em `/painel`, por onde dono e gestor passam antes de
  entrar no assistente ou na gestão. `mocks/` segue as mesmas categorias.
- `management/` — o painel de gestão em `/gestao`, portado de `System-mobile/apps/web`. Ele
  **preserva as convenções de origem**: organização por feature, exportação nomeada e primitivos
  próprios em `management/ui`. Não achatar nem trocar seus primitivos pelos do painel operacional
  sem uma decisão explícita de unificação.
- `components/` — componentes reutilizáveis em três grupos:
  - `ui/` — primitivos no estilo shadcn/ui (Button, Card, Dialog, Table, …).
  - `layout/` — AppShell, Sidebar, Topbar, Breadcrumbs, menus.
  - `shared/` — `data-table` (tabela + paginação), `charts` (gráficos + ChartCard),
    `cards` (Metric/Info), `filters` (busca, período, barra), `states` (carregando, vazio,
    erro, sem permissão, bloqueado por plano), `guards`, mapa e formulários.
- `services/` — `contracts.ts` (interfaces), `api.ts` (implementações mockadas),
  `http.ts` (atraso simulado, cliente HTTP e paginação) e `index.ts` como ponto de entrada.
- `mocks/`, `stores/`, `hooks/`, `lib/`, `types/`, `styles/`.

Módulos irmãos pequenos ficam num arquivo só, separados por seções comentadas. Só vale
criar arquivo novo quando o conteúdo crescer de verdade.

Aliases de importação: `@/*` → `src/*`.

## 3. Camada de dados e contratos

- **Contratos** (`services/contracts`) definem as interfaces dos serviços
  (ex.: `VehicleService.list/getById/create/update`) e os tipos de parâmetros/entrada.
- **Implementações mockadas** (`services/api`) resolvem os contratos usando os dados de
  `mocks/`, com **atraso de rede simulado** (`services/http.ts`) e suporte a cenários
  de erro para exercitar os estados da UI.
- **Cliente HTTP** (`services/http.ts`) contempla o interceptador de autenticação e o tratamento
  de `401` (sessão expirada). Cada serviço migrado passa a usar `httpRequest` mantendo o mesmo
  contrato, e é assim que a Fase 2 avança sem parar o produto: `services/auth.ts` e
  `services/voice.ts` já migraram, `services/api.ts` ainda não.
- ⚠️ **Chamada com cookie exige origem explícita.** O refresh viaja em cookie `HttpOnly`, então o
  fetch usa `credentials: 'include'` e o backend responde com `allowCredentials`. Nesse modo o
  curinga `*` em CORS é recusado pelo próprio navegador: a origem tem de estar listada.
- **TanStack Query** (`hooks/use-queries.ts`) centraliza `queryKeys`, cache e mutações, com
  invalidação automática após criação/edição.

Regra: **arrays grandes nunca ficam dentro de componentes** — todo dado vem de `mocks/` via serviços.

## 4. Sessão, permissões e planos

- `stores/session-store.ts` mantém a sessão (usuário + tenant). **A autenticação é real desde
  24/08/2026**: `services/auth.ts` fala com o `Backend-web`, o access token vive só na memória do
  JavaScript e dura 1 hora, e o refresh viaja em cookie `HttpOnly` com `Path=/v1/auth`, fora do
  alcance de qualquer script da página. Recarregar a aba mantém a sessão, porque o navegador
  reenvia o cookie e a aplicação pede um access token novo antes de decidir a rota.
- ⚠️ O refresh **rotaciona a cada uso**. O StrictMode executa efeitos em dobro no desenvolvimento,
  e duas chamadas simultâneas fariam a primeira invalidar o cookie que a segunda ainda usava. O
  store guarda a promessa da recuperação e serve a mesma para quem chamar de novo. As guardas de
  rota seguram em `restoring` enquanto isso, senão a tela pisca no login e volta.
- Com `VITE_ENABLE_MOCKS=true` a sessão volta a ser simulada, sem token e sem persistência.
- Perfis (`UserRole`) mapeiam para capacidades (`Permission`) em `app/permissions.ts`.
- Planos (`PlanType`) liberam módulos (`ModuleKey`) em `app/plans.ts`.
- `PermissionGuard` e `PlanGuard` ocultam/bloqueiam conteúdo. **Isto é apenas controle visual**
  — a segurança real deve ser reimplementada no backend.
- O modo demonstração (`DemoMenu`, dentro do menu do usuário) permite alternar perfil e plano para evidenciar o
  controle de acesso; não existirá em produção.

## 5. Roteamento

- `react-router` v8 (pacote unificado — `react-router-dom` não é mais usado) com `useRoutes`
  e três grupos: **público** (`/login`, `/esqueci-minha-senha`,
  `/convite/:token`, `/sessao-expirada`), **autenticado** (`/app/*`) e **admin SaaS** (`/admin-saas/*`).
- **Lazy loading** de todas as páginas (`app/router.tsx`) com fallback consistente.
- Guards: `ProtectedRoute` (exige sessão), `AdminRoute` (exige `saas.manage`),
  `PublicOnlyRoute` (redireciona usuários autenticados).
- Página `NotFound` alinhada à marca.

## 6. Layout (AppShell)

- `AppShell` = Sidebar (desktop, recolhível + drawer no mobile) + Topbar + área de conteúdo fluida.
- A Sidebar é agrupada por categoria e filtra itens por **permissão**; itens fora do plano
  aparecem com cadeado. A Topbar traz breadcrumb, busca global (sugere telas conforme se
  digita), notificações e menu do usuário — tema e modo demonstração ficam dentro desse menu.
  O acesso à IA é um botão flutuante no canto inferior direito (`AiLauncher`).

## 6.1. Mapa da operação

- `OperationMap` (`components/shared/operation-map.tsx`) usa **MapLibre GL JS** como
  renderizador e **OpenFreeMap** como provedor de tiles vetoriais.
- A escolha se deve ao custo e às restrições: OpenFreeMap não exige cadastro nem chave de
  API, não declara limite de requisições e permite uso comercial. Mapbox (50 mil
  carregamentos/mês), Google Maps (10 mil/mês, exige billing), MapTiler e Stadia Maps
  restringem o plano gratuito ou proíbem uso comercial nele.
- Estilo `dark` no tema escuro e `positron` no claro, acompanhando o tema da aplicação.
  A atribuição do OpenStreetMap/OpenMapTiles é adicionada automaticamente e **não deve ser
  removida**.
- Contrapartida assumida: o provedor público não oferece SLA nem suporte. Para produção com
  garantia contratual, basta trocar a URL do estilo por um provedor pago — o componente e a
  interface de marcadores permanecem iguais.
- As coordenadas vêm de `mocks/fleet/vehicles.ts`, com lat/lng reais por cidade e um
  deslocamento determinístico para separar veículos da mesma praça.
- **Trajetos**: as viagens em andamento aparecem como linha sobre as rodovias, e hoje há duas
  origens diferentes. No **painel de gestão**, o percurso já vem da API, reconstruído a partir das
  posições reais da telemetria. No **painel operacional**, o traçado ainda é simulado: geometrias
  calculadas uma vez com o **OSRM** e gravadas em `mocks/operations/road-routes.ts`, consumidas por
  `mocks/fleet/vehicles.ts`.
- A aplicação **não consulta serviço de roteamento em runtime** em nenhum dos dois casos, o que
  evita depender de um servidor público de demonstração.
- ⚠️ **O `fitBounds` roda uma vez**, no primeiro carregamento. Refazer a cada ciclo de polling
  arrancaria o mapa da mão de quem estivesse navegando. E o `center` não pode ser fixo: o valor
  herdado dos mocks era do Rio, e com frota real a tela abria numa região vazia.
- ⚠️ **`setStyle` do MapLibre apaga fontes e camadas customizadas.** As rotas precisam ser
  recriadas no evento `styledata`, senão somem ao trocar de tema.

## 7. Tema e design tokens

- **Tailwind CSS 4 em modo CSS-first**: não existe `tailwind.config.ts` nem PostCSS/autoprefixer.
  A integração é o plugin oficial `@tailwindcss/vite`.
- ⚠️ **A cor mora em `styles/palette.css` desde 19/08/2026**, não mais em `globals.css`. Os dois
  painéis passaram a ter a mesma identidade, e a paleta é única. O `@theme` de `palette.css`
  declara a rampa escura (padrão do produto) e o bloco `html.light`, fora de camada, redefine as
  mesmas variáveis com a rampa clara. O `globals.css` ficou com a mecânica do Tailwind
  (`@import`, `@theme inline`, `@custom-variant`, `@utility`) e apenas aponta os tokens da família
  shadcn para os `--color-*` da rampa. Redeclarar cor por tema ali é o que fazia os painéis
  divergirem.
- Tokens em **CSS variables OKLCH**, equivalentes visuais exatos da paleta HSL original da marca
  (conversão HSL → sRGB → OKLab → OKLCH). OKLCH dá interpolação perceptualmente uniforme e
  permite `color-mix()` previsível para estados translúcidos.
- **Tema escuro** é o padrão (o `<html>` já nasce com `.dark` no `index.html`); o tema claro é
  completo e alternável. O `stores/theme-store.ts` é o **único dono do tema**: ele alterna as duas
  classes, `.dark` e `.light`, e persiste a escolha em `localStorage`.
- Animações do shadcn/ui vêm de `tw-animate-css` (o antigo `tailwindcss-animate` foi descontinuado).
- Fonte **Space Grotesk** (display) + **Inter** (corpo) no painel operacional. O painel de gestão
  usa **Sora** como display, via `font-sora`, que não pode ser trocado por `font-display`.

### Como consumir cores fora do Tailwind

Em estilos inline e props de biblioteca (ex.: Recharts) use o token do tema diretamente,
`var(--color-primary)`, e `color-mix(in oklch, var(--color-muted) 40%, transparent)` para
opacidade. O padrão antigo `hsl(var(--primary))` não existe mais.

⚠️ **Dentro de `.management-theme`, isso se inverte para primária e secundária.** Em atributo de
SVG e estilo inline, `var(--color-primary)` e `var(--color-secondary)` **não existem**: os dois
vêm do `@theme inline`, que grava o valor dentro do utilitário e não emite a custom property. O
sintoma é gráfico da Recharts com linha e tooltip em cinza-chumbo no tema escuro. Ali, usar
`var(--primary)` e `var(--secondary)`, que existem de verdade e são indigo e cyan dentro do escopo.

⚠️ **Conteúdo em portal do Radix monta no `body` e sai de `.management-theme`.** Lá fora,
`secondary` volta a ser o cinza de controle do painel operacional, e um item de lista com
`text-secondary` fica ilegível. Em portal, usar só tokens da paleta comum (`on-surface`,
`surface-low`, `outline-variant`).

## 8. Estados de interface

Componentes dedicados para **carregando** (skeletons), **vazio** (`EmptyState`), **erro**
(`ErrorState` com retry), **sem permissão** (`NoAccessState`) e **bloqueado por plano**
(`PlanLockedState`). O objetivo é que nenhuma tela funcione "apenas quando os dados estão perfeitos".

## 9. Formulários

- `react-hook-form` + `zod` (`@hookform/resolvers`). O cadastro de veículo
  (`pages/vehicles-page.tsx`) é o exemplo funcional completo: validação, mensagens em pt-BR,
  estado de envio, feedback (toast) e **confirmação ao sair com alterações não salvas**.

## 10. Acessibilidade e responsividade

- HTML semântico, `aria-label` em botões só com ícone, foco visível, tabelas com cabeçalhos,
  diálogos com foco controlado e respeito a `prefers-reduced-motion`.
- Layout validado para 360px → 1920px: sidebar em drawer no mobile, grids adaptativos e
  tabelas com rolagem horizontal.

## 11. Configuração do TypeScript e aliases

`tsconfig.app.json` roda com rigor de produto empresarial: `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `useUnknownInCatchVariables`,
`noFallthroughCasesInSwitch` e `verbatimModuleSyntax`.

Consequência prática de `exactOptionalPropertyTypes`: um campo opcional que pode receber
`undefined` **explicitamente** precisa ser declarado como `campo?: T | undefined`. É por isso
que os tipos de domínio em `src/types/` usam essa forma.

### Remoção do `baseUrl`

`baseUrl` está descontinuado e **deixa de funcionar no TypeScript 7**. Em vez de silenciar o
diagnóstico com `"ignoreDeprecations": "6.0"` — que só esconderia o problema —, a opção foi
removida e cada entrada de `paths` passou a usar caminho relativo explícito ao próprio
`tsconfig.app.json`:

```json
{ "compilerOptions": { "moduleResolution": "bundler", "paths": { "@/*": ["./src/*"] } } }
```

O mesmo alias é espelhado em `vite.config.ts` via `fileURLToPath(new URL('./src', import.meta.url))`.
Não deve existir nenhuma ocorrência de `baseUrl` ou `ignoreDeprecations` no repositório.

## 12. Qualidade e testes

- TypeScript estrito, ESLint (flat config) sem erros nem warnings, sem `any` desnecessário.
- `eslint-plugin-react-hooks` 7 inclui as regras do **React Compiler** (`purity`,
  `set-state-in-effect`, `incompatible-library`). Padrões adotados por causa delas:
  - media queries via `useSyncExternalStore`, não `useEffect` + `setState`;
  - sincronização de prop → estado ajustada **durante o render**, não em efeito;
  - IDs derivados de contador em `useRef`, não de `Date.now()`;
  - `useWatch` do react-hook-form em vez de `watch()`.
- **Vitest** + **Testing Library** + `jsdom`. Cobertura inicial nos pontos críticos:
  formatadores pt-BR, schema de validação de veículo, matriz de perfis × permissões,
  `DataTable` (ordenação, estados vazio/erro, clique na linha) e `SearchInput` (debounce).
- Prettier como formatador único (`npm run format:check` no fluxo de verificação).

## 13. Segredos e variáveis de ambiente

Só variáveis com prefixo `VITE_` são embutidas no bundle pelo Vite. As chaves de provedor de IA e
de voz são **server-side**: ficam apenas no `.env` local (ignorado pelo Git), **sem** o prefixo
`VITE_`, e nenhum código do navegador as lê, nem em componentes, nem em `vite.config.ts`, nem via
`import.meta.env`.

Hoje quem consome a chave de IA é o `Backend-web`, que monta o contexto já filtrado por tenant e
por perfil antes de falar com o provedor. A decisão é inegociável e tem duas razões: chave que o
navegador usa é chave publicada, e contexto montado no cliente permitiria pedir dado de outro
nível de acesso pelo DevTools.

⚠️ **A síntese de voz já não vive mais no Vite.** Ela era um plugin Node registrado apenas em
`configureServer` e `configurePreviewServer`, ou seja, existia só em desenvolvimento: no build
publicado a rota não existiria e a voz morreria em produção, sem nada no código denunciando isso.
Hoje é `/v1/voice/synthesize` no `Backend-web`, com o mesmo token e o mesmo controle de acesso do
resto da API. Não recriar plugin de rota no `vite.config.ts`.

Não há arquivo de exemplo versionado, e a tabela de variáveis foi removida do `README.md` a pedido
do usuário. Nenhum dos dois deve ser recriado: os valores se pedem ao time.

## 14. Integração com o backend

### Já ligado

- Autenticação real, com JWT curto em memória e refresh em cookie `httpOnly` (`services/auth.ts`).
- Frota, mapa, motoristas, ficha, segurança, prontidão e jornada, no painel de gestão
  (`management/lib/fleet-api.ts`).
- Assistente de IA e notificações (`management/features/assistant/api.ts` e
  `management/features/notifications/api.ts`).
- Telemetria da MiX chegando por trás dessas rotas, coletada pelo `Backend-web`. **Nenhum cliente
  fala com a MiX**: a credencial do fornecedor existe em um lugar só.

### Falta

- Substituir as implementações de `services/api` por chamadas via `httpRequest`. É o painel
  operacional, que segue simulado.
- Tela de Viagens, que depende de decidir entre cadastro próprio e integração com o TMS do cliente.
  A `trip` da MiX é o trecho entre ligar e desligar o veículo, e não o frete que a tela mostra.
- Origem de custo, sem a qual não há custo por quilômetro.
- Encadear a voz com a resposta do assistente. A síntese já existe no backend, mas a conversa por
  voz do hub ainda não passa por ela ponta a ponta.
- Reimplementar **todas** as validações de permissão e plano no backend. As guardas daqui são
  experiência de uso, não segurança.
- Integrar multas (Detran) e câmeras, previstas como fontes futuras do ecossistema.
- Persistência de preferências (ex.: filtros) e paginação server-side real.
- Subir para TypeScript 7 quando `typescript-eslint` passar a suportá-lo.
- Code splitting mais agressivo: o chunk principal e o de gráficos passam de 500 kB.
- Smoke test E2E (Playwright) ainda não configurado.
