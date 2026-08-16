# Arquitetura do Frontend — RookHub (Fase 1 / MVP)

Este documento registra as principais decisões técnicas da fundação do frontend.

## 1. Objetivo e escopo

Entregar uma base **sustentável e escalável** do frontend, não um protótipo descartável.
Nesta fase não há backend: os dados são **mockados**, mas a arquitetura foi desenhada para
trocar mocks por chamadas HTTP reais **sem reescrever as telas**.

## 2. Organização das pastas

A estrutura é deliberadamente **rasa**: o projeto ainda é pequeno, e uma hierarquia
profunda custava três níveis para chegar em um único arquivo.

- `app/` — composição da aplicação: `router.tsx` (lazy loading, guardas e os três grupos de
  rotas), `providers.tsx` (Query, Tema, Tooltip, Toaster) e a configuração (`navigation`,
  `permissions`, `plans`, `environment`).
- `pages/` — telas agrupadas pelas **categorias do menu**: `login/`, `dashboard/`,
  `operations/`, `costs/`, `intelligence/`, `administration/`, `saas/` e `misc/`. As três
  telas de acesso vivem juntas em `login/login-page.tsx`, que também abriga o layout de
  autenticação. `mocks/` segue as mesmas categorias.
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
- **Cliente HTTP** (`services/http.ts`) já existe e contempla o interceptador de
  autenticação e o tratamento de `401` (sessão expirada). Na integração real, cada serviço
  passa a usar `httpRequest` mantendo o mesmo contrato.
- **TanStack Query** (`hooks/use-queries.ts`) centraliza `queryKeys`, cache e mutações, com
  invalidação automática após criação/edição.

Regra: **arrays grandes nunca ficam dentro de componentes** — todo dado vem de `mocks/` via serviços.

## 4. Sessão, permissões e planos (simulados)

- `stores/session-store.ts` mantém a sessão simulada (usuário + tenant). **Nenhum token real**
  é gerado ou persistido.
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
- **Trajetos**: as viagens em andamento aparecem como linha sobre as rodovias. As geometrias
  foram calculadas uma vez com o **OSRM** e gravadas em `mocks/operations/road-routes.ts`.
  A aplicação não consulta serviço de roteamento em runtime — combina com a Fase 1 (dados
  simulados) e evita depender de um servidor público de demonstração. Ao integrar o backend,
  o traçado deve vir da API junto com a viagem.

## 7. Tema e design tokens

- **Tailwind CSS 4 em modo CSS-first**: não existe `tailwind.config.ts` nem PostCSS/autoprefixer.
  A integração é o plugin oficial `@tailwindcss/vite`, e todo o tema vive em
  `styles/globals.css` (`@import 'tailwindcss'`, `@theme inline`, `@custom-variant`, `@utility`).
- Tokens em **CSS variables OKLCH**, equivalentes visuais exatos da paleta HSL original da marca
  (conversão HSL → sRGB → OKLab → OKLCH). OKLCH dá interpolação perceptualmente uniforme e
  permite `color-mix()` previsível para estados translúcidos.
- **Tema escuro** é o padrão (classe `.dark` no `<html>`); o tema claro está preparado e é
  alternável (`stores/theme-store.ts`, persistido em `localStorage`).
- Animações do shadcn/ui vêm de `tw-animate-css` (o antigo `tailwindcss-animate` foi descontinuado).
- Fonte **Space Grotesk** (display) + **Inter** (corpo). Paleta fiel à identidade RookHub.

### Como consumir cores fora do Tailwind

Em estilos inline e props de biblioteca (ex.: Recharts) use o token do tema diretamente —
`var(--color-primary)` — e `color-mix(in oklch, var(--color-muted) 40%, transparent)` para
opacidade. O padrão antigo `hsl(var(--primary))` não existe mais.

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

Só variáveis com prefixo `VITE_` são embutidas no bundle pelo Vite. `GEMINI_API_KEY` está
reservada ao **backend futuro**: fica apenas no `.env` local (ignorado pelo Git), **sem** o
prefixo `VITE_`, e não é lida por nenhum código do frontend — nem em componentes, nem em
`vite.config.ts`, nem via `import.meta.env`. Não há arquivo de exemplo versionado: as
variáveis estão documentadas na tabela do `README.md`.

## 14. Pendências para a integração com backend

- Substituir as implementações de `services/api` por chamadas via `httpRequest`.
- Conectar o fluxo real de autenticação (tokens, refresh) ao `session-store` e ao interceptador.
- Reimplementar **todas** as validações de permissão/plano no backend.
- Integrar provedores reais de mapa, telemetria, rastreamento, multas e IA.
- Persistência de preferências (ex.: filtros) e paginação server-side real.
- Subir para TypeScript 7 quando `typescript-eslint` passar a suportá-lo.
- Code splitting mais agressivo: o chunk principal e o de gráficos passam de 500 kB.
- Smoke test E2E (Playwright) ainda não configurado.
