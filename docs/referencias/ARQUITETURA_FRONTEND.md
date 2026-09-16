# Arquitetura do Frontend: RookHub

As decisões técnicas da fundação do frontend, o que mudou desde ela, e onde vive o plano de
onboarding de transportadoras.

> Este arquivo reúne, desde 16/09/2026, o que antes eram dois: a arquitetura do frontend e o
> ponteiro de `docs/ONBOARDING_TRANSPORTADORAS.md`.

⚠️ **O que o código faz vence o que este documento diz.** Ele registra o porquê das decisões; para o
estado de implementação, o código e o `.claude/memoria.md`.

---

## 1. Objetivo e escopo

Entregar uma base **sustentável**, não um protótipo descartável. A arquitetura foi desenhada para
trocar mocks por chamadas HTTP reais **sem reescrever as telas**, e foi exatamente isso que permitiu
ligar a API real módulo a módulo, sem parar o produto.

O painel está no ar em **`dev.rookhub.com.br`** (porta da equipe) e **`<cliente>.rookhub.com.br`**,
falando com a API em `api.rookhub.com.br`.

## 2. Organização das pastas

A estrutura é deliberadamente **rasa**: hierarquia profunda custava três níveis para chegar num
arquivo só.

- `app/`: composição da aplicação. `router.tsx` (lazy loading, guardas e os grupos de rotas),
  `providers.tsx` (Query, Tema, Tooltip, Toaster) e a configuração (`navigation`, `permissions`,
  `plans`, `environment`, `tenant-host`, `tenant-slug`, `permission-catalog`, `fonts`, `favicon`).
- `pages/`: telas agrupadas pelas **categorias do menu**: `login/`, `hub/`, `dashboard/`,
  `operations/`, `costs/`, `intelligence/`, `administration/`, `saas/` e `misc/`. `mocks/` segue as
  mesmas categorias.
- `management/`: o painel de gestão em `/gestao`, portado de `System-mobile/apps/web`. Ele
  **preserva as convenções de origem**: organização por feature, exportação nomeada e primitivos
  próprios em `management/ui`. **Não achatar** nem trocar seus primitivos pelos do painel operacional
  sem uma decisão explícita de unificação.
- `components/`: `ui/` (primitivos shadcn), `layout/` (AppShell, Sidebar, Topbar, menus) e `shared/`
  (`data-table`, `charts`, `cards`, `filters`, `states`, `guards`, mapa e formulários).
- `services/`: `contracts.ts` (interfaces), `api.ts` (implementações mockadas), `http.ts` (cliente
  HTTP e paginação) e as pontes já ligadas (`auth.ts`, `voice.ts`, `vehicle-api.ts`, `branding.ts`).
- `mocks/`, `stores/`, `hooks/`, `lib/`, `types/`, `styles/`.

Módulos irmãos pequenos ficam num arquivo só, separados por seções comentadas. Alias: `@/*` →
`src/*`.

⚠️ **Tela nova entra na pasta da CATEGORIA DO MENU a que pertence**, e o mock na mesma categoria. Não
recriar `src/features/<dominio>/` nem subdividir `components/` em data-display/forms/feedback: foram
achatados de propósito.

## 3. Camada de dados e contratos

- **Contratos** (`services/contracts`) definem as interfaces dos serviços e os tipos de entrada.
- **Implementações mockadas** (`services/api`) resolvem os contratos com os dados de `mocks/`, com
  atraso de rede simulado e cenários de erro para exercitar os estados da UI.
- **Cliente HTTP** (`services/http.ts`) tem o interceptador de autenticação e o tratamento de 401.
  Cada serviço migrado passa a usar `httpRequest` mantendo o mesmo contrato.
- **TanStack Query** (`hooks/use-queries.ts`) centraliza `queryKeys`, cache e mutações.

⚠️ **Arrays grandes nunca ficam dentro de componentes**: todo dado vem de `mocks/` via serviços. E
telas consomem `src/services` pelos hooks, **nunca** os mocks diretamente.

⚠️ **Chamada com cookie exige origem explícita.** O refresh viaja em cookie `HttpOnly`, então o fetch
usa `credentials: 'include'` e o backend responde com `allowCredentials`. Nesse modo o curinga `*` em
CORS é recusado pelo próprio navegador.

⚠️ **401 não significa a mesma coisa em toda rota, e o `httpRequest` acha que sim.** Ele trata todo
401 como sessão perdida. Em `POST /v1/auth/password` o 401 é "a senha atual está errada", e quem
errava a digitação era deslogado sem explicação: por isso o `changePassword` faz `fetch` próprio.
**Antes de mandar outra rota pelo `httpRequest`, conferir o que o 401 dela quer dizer.**

⚠️ **`httpRequest` trata 204 e corpo vazio.** Antes uma exclusão bem-sucedida estourava com
`SyntaxError: Unexpected end of JSON input`, e o sintoma engana: funcionou no servidor e a tela
mostra erro.

⚠️ **`httpStream` é para resposta lida enquanto ainda chega**, e devolve a `Response` crua. NDJSON se
corta no `\n`, nunca no pedaço recebido.

## 4. Sessão, permissões e planos

- `stores/session-store.ts` mantém a sessão. **A autenticação é real**: access token só na memória,
  1 hora, e refresh em cookie `HttpOnly` com `Path=/v1/auth`, fora do alcance de qualquer script.
- ⚠️ **O refresh rotaciona a cada uso.** No StrictMode, dois efeitos simultâneos fariam o primeiro
  invalidar o cookie que o segundo usava: o store guarda a promessa e serve a mesma. E as guardas
  seguram em `restoring`, senão a tela pisca no login e volta.
- Com `VITE_ENABLE_MOCKS=true` a sessão volta a ser simulada, sem token e sem persistência. **O
  padrão no código é `'true'`; o `.env` da equipe traz `false`.**
- Permissões em `app/permissions.ts`, planos em `app/plans.ts`, e o catálogo de chaves em
  `app/permission-catalog.ts`.
- ⚠️ **`app/permission-catalog.ts` existe porque a permissão fora do plano não vem na resposta de
  `GET /v1/permissions`, por definição.** Sem uma tabela local, o editor de cargos só teria a chave
  crua para mostrar.
- ⚠️ **`PermissionGuard` e `PlanGuard` são controle VISUAL.** A segurança real é do `Backend-web`, em
  todas as operações.
- ⚠️ **O `AdminRoute` exige ESCOPO de plataforma, e não a permissão `saas.manage`.** Quem decide qual
  mundo abrir é o `scope` da sessão (`platform` ou `tenant`), pelo `landingForSession`: conta de
  transportadora não abre o backoffice, e conta da equipe não abre `/gestao` nem `/app`, porque
  entrar na empresa de um cliente é impersonação, que não existe.

## 5. Roteamento

`react-router` v8 (pacote unificado; `react-router-dom` não é mais usado), com lazy loading de todas
as páginas e quatro grupos:

| Grupo          | Rotas                                                                               |
| -------------- | ----------------------------------------------------------------------------------- |
| Público        | `/`, `/esqueci-minha-senha`, `/trocar-senha`, `/convite/:token`, `/sessao-expirada` |
| Hub            | `/painel`, `/assistente`, `/assistente/vozes`                                       |
| Transportadora | `/app/*` (operação) e `/gestao/*` (gestão)                                          |
| Plataforma     | `/admin-saas/*`                                                                     |

- Guardas: `ProtectedRoute`, `AdminRoute`, `RoleAreaRoute` (redireciona quem caiu na área errada, em
  vez de deixá-lo sem saída) e `PublicOnlyRoute`.
- ⚠️ **O painel de gestão tem UM limite de `Suspense`**, no `ManagementLayout`, em volta do `Outlet`,
  e nenhum por rota. Limite por rota é criado do zero a cada navegação e pinta o fallback na hora: a
  tela sumia e voltava a cada troca. **Não devolver `Suspense` para dentro de `routes.tsx`.**

### O endereço decide a porta

- ⚠️ **`app/tenant-host.ts` decide o modo pelo hostname, e o padrão é `cliente`.** Endereço
  desconhecido, IP ou `*.pages.dev` caem no painel da transportadora: errar para o lado do
  backoffice deixaria um operador olhando administração de plataforma.
- ⚠️ **O espelho local é `*.localhost`**, e é como se confere a separação sem publicar. Exige
  `server.allowedHosts: ['.localhost']` no `vite.config.ts`, senão o Vite devolve "Blocked request".
- ⚠️ **É redirecionamento, NUNCA bloqueio.** A sessão sobrevive porque o cookie de refresh é do
  `api.rookhub.com.br`, same-site com os dois subdomínios.
- ⚠️ **`app/tenant-slug.ts` guarda a validação do slug**, e não a tela: **o slug é subdomínio E nome
  do schema**, e o backend tem a mesma regra, palavra por palavra.
- ⚠️ **O ícone da aba é trocado em tempo de execução** (`app/favicon.ts`), porque o `index.html` é o
  mesmo para as duas portas. Os dois `<link rel="icon">` são um par de `prefers-color-scheme`,
  escolhido pelo SISTEMA de quem olha: trocar só um deixa metade das máquinas com o ícone errado.

## 6. Layout

- `AppShell` = Sidebar recolhível (drawer no mobile) + Topbar + conteúdo fluido, no `/app`.
- O `/gestao` e o `/admin-saas` usam **topbar com pastilhas de navegação**, o mesmo layout, e a cor é
  o que separa: terracota no cliente, marinho na plataforma.
- ⚠️ **O escopo do tema do backoffice vai no `body`, e quem o marca é o `app-shell.tsx`.** Tudo que o
  Radix monta em portal nasce no `body`, FORA da casca: repor a classe em cada conteúdo portalizado
  é a correção errada, e esquece o próximo portal.
- **O conteúdo não tem largura máxima** no `/app`, e as telas de `/gestao` usam a janela inteira
  (`px-4 sm:px-6 xl:px-10`). Tela nova ganha colunas por breakpoint em vez de esticar o campo.
- O assistente de IA é um **drawer**, e é o mesmo objeto nos quatro perfis: o `/app` importa o
  `AssistantDrawer`, o store e o atalho do `management` de propósito. A sessão atravessa porque
  `management/features/auth/store` é uma **ponte** sobre o `session-store` único.

## 7. Mapas

`OperationMap` e os dois mapas da gestão usam **MapLibre GL JS** com **OpenFreeMap**, sem chave.

A escolha é de custo e restrição: OpenFreeMap não exige cadastro nem chave, não declara limite e
permite uso comercial. Mapbox, Google Maps, MapTiler e Stadia restringem o plano gratuito ou proíbem
uso comercial nele. **Contrapartida assumida: não há SLA.** Trocar por provedor pago é trocar a URL
do estilo.

- A base comum vive em `components/shared/map-style.ts`, com cinco modos (`positron`, `liberty`,
  `bright`, `dark`, `fiord`). ⚠️ **`positron` e `dark-matter` são bases de FUNDO**, feitas para sumir
  atrás do dado: numa central de comando isso tira contexto de quem mais precisa dele. Por isso o
  padrão claro é o **Liberty**.
- ⚠️ **A atribuição do OpenStreetMap NÃO pode ser removida**: a licença ODbL exige o crédito visível.
- ⚠️ **`setStyle` descarta fonte, camada E imagem registradas.** A montagem é função reexecutável,
  chamada no evento `styledata` (não em `load`, que dispara uma vez na vida do mapa). ⚠️ **Ouvinte de
  ponteiro NÃO entra na função de montagem**, senão um clique vale dois.
- ⚠️ **Camada de texto PRECISA declarar `text-font`**: sem ela o MapLibre usa a família do CARTO, que
  o OpenFreeMap não serve, e cada faixa de glifo vira 404. O rótulo ainda aparece pelo recurso
  alternativo, que é o que torna o defeito fácil de não ver.
- ⚠️ **O `fitBounds` roda UMA vez**, no primeiro carregamento, e o `center` não pode ser fixo: o
  valor herdado dos mocks era do Rio, e com frota real a tela abria numa região vazia.
- **A aplicação não consulta serviço de roteamento em runtime.** No painel de gestão o percurso vem
  da API, reconstruído das posições reais; no operacional o traçado ainda é geometria pré-calculada
  no OSRM e gravada em `mocks/operations/road-routes.ts`.

As armadilhas da camada 3D, do replay e do seguimento de câmera estão em `.claude/memoria.md`, seção
`Mapas`.

## 8. Tema e design tokens

- **Tailwind CSS 4 em modo CSS-first**: não existe `tailwind.config.ts` nem PostCSS/autoprefixer. A
  integração é o `@tailwindcss/vite`.
- ⚠️ **A cor mora em `styles/palette.css`, e é única para os dois painéis.** O `@theme` declara a
  rampa escura e o bloco `html.light`, fora de camada, redefine as mesmas variáveis com a rampa
  clara. O `globals.css` ficou com a mecânica do Tailwind e aponta os tokens da família shadcn para
  os `--color-*`. **Redeclarar cor por tema ali é o que fazia os painéis divergirem.**
- Tokens em **CSS variables hex**. O espaço perceptual entra no consumo, não na declaração: hover e
  véu usam `color-mix(in oklab, ...)`.
- **Marca**: terracota `#D5623A` como primária e marinho `#010066` como secundária, com o Itaú como
  referência (laranja é a ação, azul escuro é o link e o detalhe).
- ⚠️ **A secundária troca de valor entre os temas e a primária não.** O marinho dá 15,6:1 sobre o
  papel e **1,07:1 sobre o grafite**, onde some: a rampa escura usa `#A0A6FF`. Quem depender dela num
  contexto que não acompanha o tema (3D, MapLibre, halo) precisa do azul médio.
- ⚠️ **Foco é a PRIMÁRIA, e não a secundária.** É estado, não semântica. Foi unificado justamente
  porque metade da tela acendia numa cor e metade na outra.
- ⚠️ **O tema escuro está DESLIGADO** (`DARK_MODE_ENABLED = false` em `stores/theme-store.ts`), e o
  `theme-store` é o único dono do tema. ⚠️ **O `index.html` ainda nasce com `class="dark"`**: é
  resíduo, e quem manda é o store, que força o claro. A rampa escura continua inteira e volta
  trocando a constante: **não apagar**.
- ⚠️ **Rotas sem casca ficam claras para sempre**, mesmo quando o escuro voltar (login, recuperação,
  convite, sessão expirada, 404 e as duas do hub), pelo `ThemeLock` do `router.tsx`. É de **rota**,
  não de componente.
- **Fonte**: **Inter** no corpo e **Sora** no display, nos dois painéis. ⚠️ **A Space Grotesk saiu em
  09/09/2026**: dois números grandes lado a lado, um em cada painel, faziam o produto parecer de duas
  empresas. `--font-display` e `--font-sora` apontam para a mesma família.
- Animações do shadcn vêm de `tw-animate-css`.

### Como consumir cores fora do Tailwind

Em estilo inline e prop de biblioteca (Recharts), usar o token direto: `var(--color-primary)`, e
`color-mix(in oklch, ...)` para opacidade. O padrão antigo `hsl(var(--primary))` não existe mais.

⚠️ **Dentro de `.management-theme` isso se inverte**: `var(--color-primary)` e
`var(--color-secondary)` **não existem**, porque vêm do `@theme inline`, que grava o valor dentro do
utilitário e não emite a custom property. O sintoma é gráfico com linha e tooltip em cinza-chumbo.
Ali, usar `var(--primary)` e `var(--secondary)`.

⚠️ **`@theme inline` também faz o utilitário apontar para o token SEM o prefixo `--color-`.** Repor
só `--color-primary` num escopo não muda nada, e o sintoma engana: a variável lia branco enquanto a
borda renderizada era terracota. **Escopo novo repõe os dois.**

⚠️ **Conteúdo em portal do Radix monta no `body` e sai de `.management-theme`.** Lá fora `secondary`
volta a ser o cinza de controle do operacional. Em portal, usar só tokens da paleta comum.

## 9. Estados, formulários e acessibilidade

- Componentes dedicados para **carregando**, **vazio**, **erro** (com retry), **sem permissão** e
  **bloqueado por plano**. O objetivo é que nenhuma tela funcione "apenas quando os dados estão
  perfeitos".
- ⚠️ **402 não é 403.** 403 é falta de permissão, e quem resolve é quem administra a equipe; 402 é o
  plano que não cobre o módulo, e quem resolve é o Dono com a RookHub. O `PlanUpgradeError` carrega
  `modulo` e `plano`, e é com o `modulo` que o `PlanLockedState` diz o que falta.
- Formulários com `react-hook-form` + `zod`. O cadastro de veículo
  (`pages/operations/vehicles-page.tsx`) é o exemplo completo: validação, mensagens em pt-BR, estado
  de envio, toast e confirmação ao sair com alterações não salvas.
- ⚠️ **`values` do react-hook-form, e não `useEffect` + `reset`**, para sincronizar dado externo.
- HTML semântico, `aria-label` em botão só com ícone, foco visível, diálogo com foco controlado e
  respeito a `prefers-reduced-motion`. Layout validado de 360px a 1920px.

## 10. TypeScript e aliases

`tsconfig.app.json` roda com rigor de produto empresarial: `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `useUnknownInCatchVariables`,
`noFallthroughCasesInSwitch` e `verbatimModuleSyntax`.

⚠️ **Consequência de `exactOptionalPropertyTypes`:** campo opcional que pode receber `undefined`
explicitamente precisa ser declarado como `campo?: T | undefined`. E passar `undefined` a um campo
opcional é erro de tipo: espalhar com `...(x ? { campo: x } : {})`.

⚠️ **`baseUrl` foi REMOVIDO**, e não silenciado com `ignoreDeprecations`: ele deixa de funcionar no
TypeScript 7. Cada entrada de `paths` usa caminho relativo ao próprio `tsconfig.app.json`, espelhado
no `vite.config.ts`. **Não deve existir nenhuma ocorrência de `baseUrl` nem de `ignoreDeprecations`
no repositório.**

⚠️ **`import type` é obrigatório**, porque `verbatimModuleSyntax` está ligado.

## 11. Qualidade e testes

- TypeScript estrito, ESLint (flat config) sem erro nem aviso novo, sem `any` para silenciar erro
  (usar `unknown` com narrowing).
- ⚠️ **`eslint-plugin-react-hooks` 7 traz as regras do React Compiler, e elas são ERRO aqui.** Padrões
  adotados por causa delas: media query via `useSyncExternalStore`; sincronização de prop durante o
  render, nunca em efeito; id derivado de contador em `useRef`, não de `Date.now()`; e `useWatch` no
  lugar de `watch()`.
- ⚠️ **Quando o lint explodir com vários erros depois de uma mudança pequena, o que importa é o
  PRIMEIRO** (`Compilation Skipped`); os outros são consequência. Bissectar a própria mudança.
- **Vitest** + **Testing Library** + `jsdom`. A suíte cobre formatadores, schema de veículo, matriz
  de perfis e permissões, `DataTable`, `SearchInput`, a régua de consumo (`fuel.test.ts`), a
  detecção de fala, o reconhecimento no celular, o pivô da roda 3D, o editor de cargos e o
  `tenant-host`.
- ⚠️ **Tela do painel não renderiza em jsdom sem desligar o fundo**: `AuroraBackdrop` e `Grainient`
  desenham em WebGL e o erro não aponta para nenhum dos dois. `vi.mock('@/management/ui')`
  devolvendo os dois como `() => null` resolve.
- Prettier como formatador único. ⚠️ **O `format:check` falha em `.claude/skills/**`**, que é código
  de terceiros: não é regressão e não deve ser "corrigido" com `format:write`.
- Antes de fechar um marco: `npm run format:check && npm run typecheck && npm run lint && npm run test && npm run build`.

## 12. Segredos e variáveis de ambiente

Só variáveis com prefixo `VITE_` são embutidas no bundle. As chaves de provedor de IA e de voz são
**server-side**: ficam no `.env` local, sem o prefixo, e nenhum código do navegador as lê.

Quem consome a chave de IA é o `Backend-web`, que monta o contexto já filtrado por tenant e por
perfil. **A decisão é inegociável**, por duas razões: chave que o navegador usa é chave publicada, e
contexto montado no cliente permitiria pedir dado de outro nível pelo DevTools.

⚠️ **A síntese de voz já não vive no Vite.** Era um plugin Node registrado só em `configureServer`,
ou seja, existia apenas em desenvolvimento: no build publicado a rota não existiria e a voz morreria
em produção, sem nada no código denunciando. **Não recriar plugin de rota no `vite.config.ts`.**

⚠️ **O PAT do GitHub não mora no `.env`.** Quem entrega o token ao Git é um credential helper que lê
um cofre fora do repositório, e a ligação vive no `.git/config`, que não é versionado: cada
desenvolvedor refaz a configuração a cada clone novo.

Não há arquivo de exemplo versionado, e a tabela de variáveis foi removida do `README.md`. **Nenhum
dos dois deve ser recriado.**

## 13. Integração com o backend

O que está ligado e o que segue simulado muda com frequência, e a lista viva está em
`.claude/memoria.md`, seção **O que é real e o que é mock**. O resumo estável:

- **Ligado**: autenticação, sessão e convite; frota, mapa, posições, motoristas, segurança e
  jornada; assistente de IA, voz e notificações; equipe e cargos; o backoffice inteiro; a marca do
  cliente; e veículos no `/app`, pela ponte `services/vehicle-api.ts`.
- **Simulado**: o resto do `/app` (operador, manutenção, checklist, alertas, dashboard), custos,
  manutenção, multas e as configurações de `/gestao`.
- ⚠️ **Não é fallback.** Backend fora mostra erro, e não dado de demonstração disfarçado de real.
- **Nenhum cliente fala com a MiX**: a credencial do fornecedor existe em um lugar só.

**Falta**: substituir `services/api` por chamadas via `httpRequest`; tela de Viagens como frete;
origem de custo; integrações de multas e câmeras; paginação server-side; smoke E2E; code splitting
(o chunk principal e o de gráficos passam de 500 kB); e subir para TypeScript 7 quando o
`typescript-eslint` suportar.

## 14. O plano de onboarding de transportadoras

⚠️ **O plano NÃO vive aqui. A fonte única é o repositório irmão:**

```
../Backend-web/docs/INFRAESTRUTURA.md
```

No GitHub: `v2ntechnology/Backend-web`, em `docs/INFRAESTRUTURA.md`, na **Parte 2**. O plano foi
fundido com a documentação de infraestrutura em 16/09/2026.

### Por que ele não vive aqui

Até 12/09/2026 existiam **duas cópias** do mesmo plano, uma em cada repositório, e elas divergiram
em 208 linhas.

⚠️ **Divergência de cópia não é só incômodo de manutenção: ela propagou um defeito de segurança.** A
cópia velha continuou mandando comparar o `tenantSlug` do login com o **`Host`**, e essa instrução
está errada: o `Host` é sempre `api.rookhub.com.br` para todo cliente, porque o Caddyfile do backend
tem um site block único. **Quem seguisse a cópia implementaria uma checagem que sempre passa.** Quem
identifica o painel chamador é o `Origin`, que o navegador define e a página não forja.

⚠️ **E `Origin` ausente tem de passar**: o app do motorista não envia esse cabeçalho, e recusar por
ausência quebraria o aplicativo inteiro.

O plano fica no `Backend-web` porque o conteúdo é majoritariamente de backend (schema por empresa,
Flyway, provisionamento, escopo do JWT) e porque a implementação começou lá.

**Não recriar a cópia deste lado.**

### O que continua sendo deste lado

As fases que geram tela: a **parametrização e a marca do cliente**, e o **editor de cargos e
equipe**. O plano as descreve, mas quem as implementa é este repositório, e as decisões de frontend
seguem em `.claude/memoria.md`.

⚠️ **O PDF em `docs/pdf/RookHub-Plano-Onboarding-Transportadoras.pdf` está defasado desde
11/09/2026, e não há gerador no repositório.** Ele agora também aponta para um documento que mudou
de nome. Quem for circular o plano precisa regerar à mão.
