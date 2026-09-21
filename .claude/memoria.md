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
- ⚠️ **O `app.rookhub.com.br` NÃO passa mais por este código** (20/09/2026). Ele foi a porta da
  Servioeste até 12/09/2026, saiu dos domínios do projeto Pages e chegou a **não resolver**
  (NXDOMAIN), com a documentação ainda dizendo que redirecionava. O desvio virou coisa da borda: um
  `AAAA app -> 100::` com proxy, o Worker `rookhub-app-legado` e a rota `app.rookhub.com.br/*`
  respondem **302** para `servioeste.rookhub.com.br`, preservando caminho e query, **antes de o
  painel carregar**. Para o `tenant-host.ts`, `app` nunca foi slug de plataforma: só o `dev` é.
- ⚠️ **O código desse Worker não está em repositório nenhum**, vive só na Cloudflare. Quem apagar
  derruba o redirecionamento sem deixar fonte. Ele saiu por Worker porque o token da conta **não
  tem** permissão para Redirect Rules, só para Workers e DNS.
- ⚠️ **`app/tenant-host.test.ts` trava o que causaria incidente**: o laço em `localhost`, o
  `*.pages.dev` e `rookhub.com.br.invasor.example` não virar slug de plataforma.
- ⚠️ **O ícone da aba é trocado em tempo de execução** (`app/favicon.ts`), porque o `index.html` é o
  mesmo para as duas portas. Os dois `<link rel="icon">` são um par de `prefers-color-scheme`,
  escolhido pelo SISTEMA de quem olha: trocar só um deixa metade das máquinas com o ícone errado.
- ⚠️ **A porta da equipe tem casca própria** (`PlatformAuthLayout`), **sem Google e sem o separador
  "ou"**. Vale **só para o login**: esqueci minha senha, convite e sessão expirada seguem no
  `AuthLayout`.
- ⚠️ **Desde 18/09/2026 ela espelha a forma da porta do cliente** (pedido do usuário): a MESMA grade
  `lg:grid-cols-[1fr_34rem]`, com a cena no painel da esquerda, em cartão com margem e raio, e o
  formulário sobre o papel na coluna da direita. **Mexeu na proporção de uma, mexa na outra.** O que
  ficou para trás foi a coluna centrada no viewport com o gradiente cobrindo a tela.
- ⚠️ **A cena do painel é o `EmberHusk`, e o painel não tem MAIS NADA de HTML**: sem marca, sem
  chapéu, sem título e sem scrim, tudo retirado a pedido do usuário no mesmo dia. **A escolha da cena
  é dele**, e já passou por três propostas minhas recusadas em 15/09 e pelo `SoffitGradient`, que
  continua no repositório servindo as outras telas. Não propor a próxima por conta própria.
- ⚠️ **O centro da cena é um REI DE XADREZ, e não a pedra do fornecedor** (decisão do usuário em
  18/09/2026). Ele nasce por revolução de um perfil (`KING_PROFILE`), é **fatiado em faixas
  horizontais** e cada faixa é um `Piece`: por isso ele se abre em camadas no cursor, em vez de
  estourar como caco. A cruz do topo é a MESMA geometria que já flutuava na cena. As peças em volta
  são peão, cavalo, bispo, torre, dama e rei. ⚠️ **O cavalo é a exceção**: não sai de torno, e é
  resolvido como num jogo recortado, extrudando o contorno da cabeça numa chapa com espessura. De
  lado é um cavalo, de frente é uma placa, e nesse tamanho passa; a alternativa era um `.glb` num
  repositório público.
- ⚠️ **O rei é inclinado por um GRUPO, nunca pela geometria** (pedido do usuário). Girar a geometria
  viraria a peça sem virar o eixo em que as fatias fogem, e ele se abriria na vertical com o corpo
  torto, como pilha de pratos. Por viver dentro do `rig`, a diagonal balança junto com o giro lento
  da cena. ⚠️ As fatias passaram a ser projetadas e empurradas na matriz DESSE grupo, senão o cursor
  acerta a peça onde ela estaria sem a inclinação.
- ⚠️ **O perfil do rei foi desenhado a partir de uma REFERÊNCIA que o usuário trouxe**, e o que
  importa é a anatomia: o pé tem prato e **bojo arredondado** (base que só afina lê como cone, por
  mais degraus que tenha, porque o olho procura a barriga), a coluna é côncava, há um colar antes da
  coroa, e a coroa é uma tulipa que fecha numa boca **com espessura**, com a linha voltando para
  dentro, senão a parede fica de faca e some de perfil.
- ⚠️ **O pé são DOIS ANÉIS empilhados** (pedido do usuário), e cada um precisa de **parede reta mais
  chanfro** para ler como anel: degrau sem parede vira dobra e some a dois metros da tela. O de cima
  é mais estreito que o de baixo, como pedestal; ao contrário, o pé vira cogumelo.
- ⚠️ **Colar de contas e gomos da coroa NÃO saem do torno**: são repetição em volta do eixo, não
  revolução. Vivem no `kingDetails`, cada um declarando o `y` em que mora, e são soldados **na fatia
  daquela altura, antes de escalar**. Sem isso o detalhe fica numa fatia e a coroa noutra, e eles se
  separam no ar quando a peça se abre. ⚠️ **O raio deles acompanha o PERFIL naquela altura**: afinar
  a peça sem trazer as contas junto as deixa boiando em volta da coroa, como anel solto.
- ⚠️ **A cruz do topo parecia não existir, e era só tamanho.** A 0,15 da altura ela some contra a
  coroa; hoje está em 0,22. Antes de procurar defeito de montagem numa peça que "sumiu", aumente-a e
  confira.
- ⚠️ **A órbita das peças é achatada no eixo da câmera.** Numa distribuição de esfera, um terço delas
  cai entre a câmera e o centro e projeta em cima do rei, e afastá-las não resolve: elas continuam na
  frente. Encolher a componente que aponta para o observador é o que transforma o enxame no anel que
  se vê em volta. ⚠️ E elas são bem menores que as cruzes que substituíram: sólido alto perto da
  câmera vira estátua em primeiro plano. **96 peças foi demais, 72 é o que a cena comporta.**
- ⚠️ **`buildHusk` ficou sem uso e continua no arquivo**, porque é contra ele que se compara a versão
  nova do fornecedor. Junto com ele, `structure.shards`, `irregularity` e `thickness` deixaram de
  fazer efeito: quem corta agora é o `KING_BANDS`.
- ⚠️ **Cada peça de xadrez é um `InstancedMesh` próprio**, porque instância desenha uma geometria só.
  A lista da física (`crossPieces`) continua única e as malhas guardam subconjuntos **por
  referência**: misturar as listas escreveria a matriz de um peão no índice de uma torre.
- ⚠️ **`KING_HEIGHT` é a única escala da peça**: perfil, contas, gomos e cruz nascem normalizados e
  são multiplicados por ele, então mexer ali cresce tudo junto e em proporção. Esticar só a altura
  exigiria separar o eixo Y, e aí a peça deforma.
- ⚠️ **Quem limita o tamanho do rei é a PALAVRA, não o enquadramento.** O painel mostra cerca de 1,97
  para cada lado do centro, mas o "Devs RookHub" ocupa a faixa a partir de -1,12: crescer a peça sem
  o `KING_LIFT` enfia o pé dela dentro da escrita. ⚠️ O levantamento é do GRUPO, nunca da geometria:
  as fatias fogem a partir da casa delas, e mover a geometria deslocaria o eixo de fuga, abrindo a
  peça fora de si mesma.
- ⚠️ E o `inner` do calor teve de **baixar** junto com o redesenho: o talo é a parte mais fina da
  peça, e com o valor da esfera a brasa atravessava a pedra e o meio virava névoa, com o sintoma
  parecendo peça faltando na montagem.
- ⚠️ **Fatia de torno precisa de TAMPA nos dois cortes.** O `LatheGeometry` devolve casca aberta e o
  material só desenha a face frontal: sem os pontos de raio zero, olhar a fatia por baixo mostra o
  vazio da peça, e o corte lê como buraco.
- ⚠️ **A tela importa o FORK, em `pages/login/ember-husk-scene.tsx`**, e não a cópia do fornecedor em
  `components/originkit`. A diferença entre os dois é a linha **"Devs RookHub" no rodapé da cena**,
  amostrada em cubos, um `Piece` por cubo, desencaixando no cursor pela mesma física das lascas.
  Trocar o import apaga a linha **sem erro nenhum aparecer**.
- ⚠️ **"Devs" é TEXTO desenhado na hora, e "RookHub" é a ARTE da marca**, os dois no mesmo canvas
  antes de virarem cubo. Escrever a marca com fonte seria trocar o logotipo por uma imitação: o
  desenho tem ajuste de letra que fonte nenhuma reproduz. O prefixo usa Sora 700, e o corpo dele sai
  de **medição** (`actualBoundingBoxAscent` do "D" contra a altura da arte), nunca de uma fração
  chutada, senão ele desalinha quando a fonte de display mudar. ⚠️ **Esperar `document.fonts.load`
  antes de medir**: com a Sora ainda vindo, a medida sai da fonte de sistema e o "Devs" nasce torto,
  sem erro nenhum.
- ⚠️ **`WORD_WIDTH` é a largura da LINHA INTEIRA**, prefixo incluído, e a célula sai de `cols`, não
  de `WORD_COLUMNS`. Dividir pelo número errado joga a linha para fora do painel pela direita.
- ⚠️ **A palavra vive fora do `rig`**, no grupo `word`, porque o `rig` é quem gira e balança com o
  drift: lá dentro ela sairia de prumo e viraria de costas. Por isso o `proximity` e o `stepPieces`
  passaram a receber a MATRIZ do grupo: com a do `rig` fixa, o cursor empurraria os cubos a partir de
  onde eles não estão.
- ⚠️ **A cena é MARINHO, e não o vermelho de fábrica do componente** (decisão do usuário em
  18/09/2026). As cores vão por prop, no `EMBER_SCENE` do `login-page.tsx`, e saem de tokens que já
  existem: `#2A2F9E` é o `--color-secondary-container` da `.saas-theme`, `#4348D9` é o `--ring` dela e
  `#A0A6FF` é a secundária da rampa escura. É a mesma regra que pinta o backoffice: **porta da equipe
  é marinho, porta do cliente é terracota.** ⚠️ Hex literal aqui é proposital, porque quem recebe é um
  shader, que precisa do valor e não da variável de CSS; o `Grainient` do painel do cliente faz igual.
- ⚠️ **`EMBER_BG` sai do mesmo objeto da cena.** Quando eram dois valores soltos, trocar a cor da cena
  deixava uma borda de outra cor em volta dela, visível no `no-blur` e no instante antes do primeiro
  quadro.
- ⚠️ **A palavra usa o material das CRUZES**, então as duas têm sempre a mesma cor. Dar tinta própria
  à palavra exige um material separado, com os mesmos uniformes: hoje ela é branca justamente por ser
  a tinta de maior contraste contra o fundo escuro.
- ⚠️ **A palavra reage ao cursor MUITO menos que o resto**, a pedido do usuário: metade da força e
  alcance menor no `stepPieces` dela, mais o `tilt` cortado a 45%. São três coisas diferentes, e
  confundi-las custa tempo: a força diz o quão LONGE o cubo vai, o alcance diz QUANTOS cubos saem
  (o tamanho do buraco na palavra), e o `tilt` diz o quanto cada um capota. Com o tombo cheio, a
  palavra ficava felpuda mesmo com o empurrão curto, porque o que se vê de longe é a face girada.
  **Ela é o único elemento da cena que precisa continuar legível enquanto se mexe.**
- ⚠️ **A palavra passa na FRENTE de toda a cena** (pedido do usuário), e são duas linhas juntas:
  `renderOrder` alto no mesh dela e `clearDepth()` no `onBeforeRender`. Só a ordem não resolve, porque
  a pedra e o cascalho já gravaram profundidade mais perto da câmera. É a mesma receita que o
  caminhão 3D do mapa precisou. ⚠️ **Zerar a profundidade é melhor que `depthTest: false`**: sem o
  teste, os cubos parariam de se cobrir entre si e, no meio da explosão, o que está longe apareceria
  por cima do que está perto.
- ⚠️ **`WORD_STRIDE` e `MAX_WORD_PIECES` existem por custo, e o teto baixo já custou legibilidade.**
  O passo abre sozinho quando a arte rende peça demais, e a 760 ele pulava para 3 assim que o "Devs"
  entrou: as letras de caixa baixa ficavam com seis células de altura e viravam borrão, que foi
  exatamente o que o usuário apontou. Hoje o teto é 1600 e o passo fica em 2. ⚠️ **O que torna o teto
  alto barato está numa linha do `stepPieces`: a projeção na tela, que é a parte cara, só roda
  enquanto o cursor está sobre o painel.** Parada, cada peça custa quatro contas.
- ⚠️ **O prefixo é desenhado LETRA POR LETRA, com espaço extra.** A fonte entrega "e", "v" e "s"
  quase encostados, contando com a suavização da borda para separá-los, e na grade de cubos, que não
  tem meio-tom, os três viravam um bloco só. O `fillText` da palavra inteira aplica kerning e ignora
  pedido de espaço, daí o laço por caractere. ⚠️ Pelo mesmo motivo o limiar de alfa é **baixo** (96):
  cortar na metade comia o contorno onde o "e" e o "s" se fecham. **O "RookHub" nunca sofreu disso**,
  porque a arte da marca já nasce com espaçamento aberto.
- ⚠️ **Caixa baixa é quem manda na resolução.** O "RookHub" sozinho se lia com 150 colunas, mas o "e",
  o "v" e o "s" do prefixo têm metade da altura de uma maiúscula: é essa altura, depois do passo, que
  decide se a letra fecha. Por isso `WORD_COLUMNS` subiu para 230.
- ⚠️ **A amostragem da arte é por ALFA, nunca por brilho.** O wordmark é branco sobre transparente:
  num teste de luminância o fundo passa no limiar e a palavra sai como um retângulo cheio.
- **A cena entra por `lazy`**, e o motivo é o login do CLIENTE: o arquivo serve as duas portas, e o
  import estático fazia toda transportadora baixar o `three` (143 kB comprimidos) por um painel que
  só existe do lado da equipe.
- ⚠️ **`EMBER_BG` no `login-page.tsx` é CÓPIA do `background.color` do componente**, porque ele não
  exporta os próprios padrões. É o que pinta o painel antes do primeiro quadro e no `no-blur`, onde a
  cena não monta. Trocar a cor da cena pede trocar essa linha junto.
- ⚠️ **A `.vidro-da-plataforma` ficou SEM USO nessa troca, e continua no `globals.css`.** Ela era a
  ilha escura que segurava o formulário por cima do gradiente; sobre o papel a tinta do tema claro
  vale de novo, e quem devolve o marinho ao contorno e ao anel dos campos é a `.saas-theme`, agora na
  coluna do formulário. Quem devolver o bloco para cima do gradiente precisa das duas de volta, e
  quem o mantiver no papel pode apagar a classe.

### A caixa de notificações

- **É UMA implementação para os quatro painéis** (`components/shared/notification-bell.tsx`): o que
  muda por painel é o dado, não o desenho. Quem chama normaliza para `NotificationBellItem`.
- ⚠️ **Duas tentativas foram recusadas aqui, e as duas valem como aviso.** A primeira pôs faixa de
  severidade de 4px à esquerda: aquela é a gramática das FILAS de decisão, onde a linha é larga, e
  numa caixa de 344px vira talho colorido a cada duas linhas. A segunda deu fundo a cada aviso, e
  doze avisos viraram doze caixas empilhadas.
- ⚠️ **A gramática preservada**: aviso **transparente**, com a severidade no CONTORNO, a palavra do nível
  na mesma família de cor, e **sem ícone** antes do título, que com o contorno era o
  terceiro sinal da mesma coisa. Véu só no hover. ⚠️ A palavra fica porque cor sozinha não basta
  (RNF-028).
- A segunda revisão de 19/09/2026 responde ao print em que a caixa ainda parecia antiga: largura
  `min(28rem, 100vw - 1rem)`, canto de 24px, sem sombra, filtros Todas/Prioritárias (crítico e
  alto) e rodapé fixo só com texto.
  Severidade fica acima do título; “Não lida” só aparece se a origem informa leitura. Os filtros
  atuam ANTES do limite de 12; a contagem informa o corte. Não chamar de “Mais recentes”: a API
  ordena por severidade primeiro. Fechar a caixa restaura Todas.
- ⚠️ **Raio e borda do aviso ficam no wrapper de `SwipeToDismiss`**, via `className`, nunca no
  link interno: o deslize remove o raio dos filhos para encaixar a lixeira. Borda no filho era a
  causa dos cantos quadrados e cortados do print. Espaçamento fica fora da superfície deslizante.
- A altura usa a área disponível calculada pelo Radix; a lista tem `min-h-0` e `overscroll-contain`.
  Verificado no navegador com roda sintética do CDP: sobre o cabeçalho, lista 240 e página 0; sobre
  a lista, lista 480 e página 0; forçando além do fim, lista trava em 1590 e página segue em 0; fora
  da caixa, página 300 e lista parada. Loading e vazio distintos.
- ⚠️ **`rounded-full`, e não `rounded-pill`, em qualquer arredondamento daqui**: o raio de
  pastilha é do `@theme` do painel de GESTÃO, e esta caixa também roda no `/app`, onde o token
  não existe.
- **Os filtros Todas/Prioritárias são abas de texto** desde 19/09/2026, a pedido do usuário: sem
  pastilha e sem fundo, só o traço de 2px da aba ativa encostando na régua do cabeçalho (por isso o
  `header` fica com `pb-0` e os botões com `-mb-px`). O contador fica ao lado do rótulo, em
  `opacity-60`. ⚠️ **O `aria-label` continua sendo "Todas 27" / "Prioritárias 25"**, que é como os
  testes acham os botões.
- ⚠️ **O cabeçalho é só o título e o X** (19/09/2026): saíram a sobrancelha “Central de avisos”,
  que repetia o título, e a linha “27 não lidas · 25 prioritárias”, que repetia os contadores das
  abas. `countLabel` continua na prop porque é o `aria-label` do sino, não texto de tela. Com isso
  o carregamento perdeu a frase “Buscando os avisos...”, e quem anuncia agora é o esqueleto da
  lista, que já tem `role="status"`.
- ⚠️ **O link do rodapé é `text-primary-on-light`**, o terracota da marca (pedido do usuário em
  19/09/2026, que antes era `text-accent`, marinho). Token, e não laranja literal: no `.saas-theme`
  esse mesmo token já vale marinho, e o link acompanha a inversão da área interna sem `if` nenhum.
  ⚠️ **Contraste medido: 3,7:1** do #d5623a sobre o branco do popover, abaixo dos 4,5:1 de texto
  normal. Fica registrado como decisão do usuário, não como descuido; se um dia precisar passar,
  o caminho é um terracota mais escuro em token novo, não mudar a cor no componente.
- **O rodapé não avisa mais sobre o transbordo** ("Mais avisos disponíveis na central", removido em
  19/09/2026): a linha "12 de 27 avisos" acima da lista já diz o mesmo, e o link do rodapé já leva à
  central.
- ⚠️ **Com a caixa aberta, a roda do mouse sobre ela nunca move a página atrás** (pedido de
  19/09/2026). O `overscroll-contain` da lista só resolve enquanto o cursor está SOBRE a lista; o
  que vazava era a roda sobre o cabeçalho e o rodapé, que não rolam e entregavam o gesto à página.
  O listener é `wheel` nativo com `{ passive: false }`, porque o `onWheel` do React é registrado
  na raiz como passivo e `preventDefault()` ali é no-op. Nada de travar o `body`: fora da caixa a
  página tem de rolar normal, isto é um popover, não um modal.
- ⚠️ **Para pegar o nó do `PopoverContent` do Radix, use ESTADO (`ref={setBox}`), nunca
  `useRef` + `useEffect`.** O Radix monta o conteúdo num segundo passe, disparado por um efeito de
  layout do `Presence` dele: um `useEffect` com dependência `[open]` roda ANTES disso e lê a ref
  ainda vazia, então o listener simplesmente não existe e o bug parece "preventDefault não
  funciona". Diagnosticado com `DOMDebugger.getEventListeners` no nó `[role="dialog"]`, que é o
  jeito honesto de saber se o listener chegou lá.

### A barra de atalhos favoritos

- ⚠️ **Sem sombra projetada, nem na barra nem no cartão** (pedido do usuário em 19/09/2026). Eram
  dois borrões, de 40px e de 48px. Quem separa os dois do fundo agora é o traço de 1px, que é a
  mesma decisão da lista de select, do calendário e do cartão do hub.
- ⚠️ **A barra e o cartão DEIXARAM de ser o mesmo material, e isso foi pedido.** A barra continua
  vidro (`surface-low/55`, desfoque e saturação); o cartão virou **opaco**. Quem mexer num não
  replica no outro sem pensar, ao contrário do que valia antes.
- ⚠️ **O cartão é opaco porque translúcido o tingia.** Era `surface-low/80` com
  `backdrop-saturate-150`: aberto sobre a faixa laranja da página, ganhava um degradê rosado que
  parecia enfeite e era só o fundo vazando. Hoje é `surface-low` sozinho, que já é **branco puro no
  tema claro e grafite no escuro**, sem precisar de `bg-white`, que seria branco fixo errado no
  escuro. ⚠️ **O `backdrop-blur` e o `backdrop-saturate` saíram junto**, e não por descuido: com
  fundo opaco nada atravessa, e os dois eram custo de composição sem efeito na tela.
- ⚠️ **Tirar a sombra deixou o cartão sem borda visível, e o conserto foi trocar o TOKEN do traço**
  (no mesmo dia). O branco a 20% era o brilho da quina do vidro, e só funcionava porque a sombra
  desenhava o limite: sobre o papel claro o cartão virou branco no branco. Hoje o anel é `outline`,
  o traço de componente da paleta comum, com 3,2:1, que aparece nos dois temas. ⚠️ **Tem de ser
  token da paleta COMUM**, porque isto vive em portal, fora de `.management-theme`.
- ⚠️ **Com o cartão aberto, a roda sobre ele nunca move a página atrás** (mesmo pedido). É a receita
  da caixa de notificações, aplicada de novo: `overscroll-contain` na lista, mais um listener
  `wheel` **nativo e não passivo** no conteúdo do Radix, porque o `onWheel` do React é registrado na
  raiz como passivo e `preventDefault()` ali é no-op. ⚠️ **O nó vem por ESTADO (`ref={setCaixa}`),
  nunca `useRef` + `useEffect`**: o Radix monta o conteúdo num segundo passe e a ref estaria vazia.
  Nada de travar o `body`, que isto é popover e não modal.
- **Medido no navegador com roda de verdade** (`page.mouse.wheel`, que passa pelo CDP): com o cursor
  sobre o cartão a página ficou em 300 e a lista foi de 0 a 312, o fim dela; com o cursor fora, a
  página andou de 300 para 700. Evento sintético por `dispatchEvent` não serve para conferir isto,
  porque não aciona a rolagem nativa.

### O aviso de sincronização não viaja de tela

- ⚠️ **O `Toaster` vive no layout, acima das rotas, então o toast SOBREVIVE à navegação.** Quem
  trocasse de tela antes dos segundos acabarem levava para a tela nova um aviso sobre a frota do
  Pátio ou sobre as posições do mapa, sem nada ali que o explicasse. Desde 19/09/2026 as duas telas
  dispensam o próprio aviso ao serem desmontadas, pelo `id` fixo que elas já usavam.
- ⚠️ **O efeito que dispensa é SEPARADO, com lista de dependências vazia.** Pôr o `dismiss` no
  `return` do efeito que cria o aviso faria ele piscar a cada mudança de contagem, porque aquele
  efeito roda de novo a cada `staleCount`.
- ⚠️ **`toast.dismiss` DEVOLVE o id**, então a seta concisa (`() => () => toast.dismiss(x)`) faz o
  cleanup devolver `string` e o TypeScript recusa. O corpo vai entre chaves.
- ⚠️ **Quem mocka `sonner` num teste precisa incluir `dismiss`.** O mock do `yard-page.test.tsx`
  tinha só `warning`, `success`, `error` e `info`, e a falta derrubou **nove testes de uma vez**, com
  a pilha apontando para o `commitPassiveUnmountEffects` do React em vez de para o mock.
- **Conferido no navegador com navegação SPA de verdade**, e não com `page.goto`: recarregar a
  página desmonta tudo e o aviso sumiria de qualquer jeito, então o teste passaria sem provar nada.
  Com clique no menu: aparece na tela (1), some ao sair (0) e volta ao reentrar (1).

- ⚠️ **Relatórios tinha um cartão que sumia, e a causa eram DUAS coisas somadas** (corrigido em
  19/09/2026): o gráfico de disponibilidade usava `GlassCard` dentro do `PageContent bg-light`, ou
  seja, vidro branco sobre branco com traço transparente, e o container do gráfico tinha `h-56` E
  `flex-1`. ⚠️ **`flex-1` vence altura declarada**, porque traz `flex-basis: 0%`: o bloco media 0px e
  o Recharts, sem altura, não desenha nem o `svg`. O sintoma era um cartão de 94px com o título e
  nada embaixo. **Antes de culpar o gráfico, meça o container.**

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
- ⚠️ **`.management-theme` NÃO pinta fundo** (desde 19/09/2026), e não deve voltar a pintar. A
  classe tem dois usos: casca da aplicação (`ManagementLayout`, `login-page`, que declaram
  `bg-surface` junto) e ESCOPO DE TOKENS repetido dentro de um portal (`GlassModal`,
  `assistant-drawer`). Com `background-color` embutido, os portais recebiam o papel `#f4f2ef` por
  cima do `bg-surface-low` que pediam: o modal saía creme com o rodapé branco, duas cores no mesmo
  cartão. ⚠️ **E não era questão de ordem**: a regra vive FORA de `@layer`, então vencia qualquer
  utilitário, inclusive um `bg-white` escrito à mão. Sintoma para reconhecer: a classe sozinha pinta
  e nenhuma regra de `background` aparece casando com o elemento ao varrer o CSSOM.
- ⚠️ **Conteúdo em portal do Radix sai de `.management-theme`.** Lá dentro `secondary` volta a ser o
  cinza de controle do operacional. Em portal, usar só tokens da paleta comum.

## Molde de tela

**O molde do painel tem DUAS camadas, nesta ordem**, e quem sair dele destoa:

```
HeroBand  →  PageContent rounded-t-4xl bg-light -mt-16 pt-8 sm:-mt-20, com os HeroStats dentro (mb-6)
```

- ⚠️ **Quem morde a faixa laranja é a FOLHA BRANCA, e não os cartões** (18/09 e 19/09/2026, pedido
  do usuário; estreou na Equipe e no Pátio e alcançou as demais telas). A `<section>` intermediária
  que segurava os `HeroStats` sobre o laranja **não existe mais**: eles são conteúdo do painel, como
  os filtros e a lista. A visão inicial (`overview-hero`, `owner-hero`) é a **única exceção** e
  mantém os cartões subindo, a pedido do usuário.
- ⚠️ **Dentro do painel, indicador é placa clara sobre papel branco.** Sobre a faixa ele precisava
  de sombra para se descolar de dois fundos ao mesmo tempo; ali dentro, o `ring-light-edge` basta.
- ⚠️ **Tela com coluna de largura máxima (`mx-auto max-w-[1440px]`) põe os `HeroStats` DENTRO
  dela.** Fora, eles vão de margem a margem enquanto as abas logo abaixo param 200px adiante. Não
  aparecia antes porque os cartões flutuavam longe do conteúdo (visto em Notificações).
- ⚠️ **Um `QueryState` por camada deixou de fazer sentido**: com tudo dentro do painel, o de cima
  virou irmão do de baixo. Onde o rótulo for o mesmo, juntar os dois é o certo (feito no mapa).
- ⚠️ **O cartão de indicador é UM só, o `HeroStats`, e ele serve vinte telas.** Em 19/09/2026 ele
  encolheu a pedido do usuário, com a régua sendo o indicador do Pátio: 16px de respiro, 16px de raio
  e folga de 12px, contra 20px e raio grande. **A tipografia não mudou de propósito**: o número em
  Sora 700 de 30px é o que faz o bloco ser reconhecido de tela em tela. Mexer ali muda todas, então a
  mudança é de proporção, nunca de conteúdo.
- ⚠️ **A grade larga acompanha a QUANTIDADE de cards.** Era fixa em quatro colunas, e numa tela de
  três isso deixava uma coluna vazia à direita, com a fileira parecendo interrompida.
- ⚠️ **Impedimentos passou a ter os cards DENTRO do painel branco** (pedido do usuário), com o painel
  subindo para morder a faixa, que é o molde de liberações, pareceres e viagens. Antes eles ficavam
  entre a faixa e o painel. ⚠️ O `SeverityCards` saiu de cena e o arquivo ficou sem uso: ele era o
  mesmo cartão escrito duas vezes, e manter os dois significa encolher um e esquecer o outro, que foi
  exatamente o que aconteceu.
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
- ⚠️ **A pastilha do escolhido é UMA SÓ, absoluta no trilho, e DESLIZA** (18/09/2026). Não repor
  `bg-light`/`bg-surface-low` nem a sombra no botão ativo: com o fundo no próprio botão a troca vira
  um corte, que é o que o usuário pediu para tirar. Segmentado novo usa `SegmentedFilter`
  (família `light`, botões com `aria-pressed`) ou `PageTabs` (família `surface`, Radix Tabs, troca a
  seção da página); os dois medem pelo `useSlidingPill`. **Medir com `offsetLeft`/`offsetWidth`, e
  não com `getBoundingClientRect`**: o primeiro ignora `transform` de ancestral, e a origem dele
  coincide com a de um filho `absolute left-0`.
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
- ⚠️ **A medida da página depende do VOLUME REAL da tela, e isso já falhou.** O componente se esconde
  quando há uma página só, então uma lista de 26 itens com 30 por página nunca mostra paginação: foi
  o que aconteceu em Alertas, Impedimentos e Gamificação quando o usuário pediu paginação nas três em
  19/09/2026. Hoje as filas usam **10** (fila se lê de cima para baixo e se trata item a item) e a
  classificação usa **15**, que também faz a primeira página ser o topo do ranking.
- **Usar `Pagination` de `management/ui`**, 30 por página nas listas grandes. O `total` que entra é o de **depois dos
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

- ⚠️ **`resetOptions` do `useForm` vale para TODA chamada de `reset`, não só para a que o `values`
  dispara.** O react-hook-form faz `reset(v, o) => _reset(v, { ...options.resetOptions, ...o })`.
  No cadastro de motorista isso deixou o botão **“Limpar formulário” sem efeito nenhum** desde que o
  `keepDirtyValues: true` entrou: os campos digitados são justamente os dirty, e eram os únicos
  preservados, em todas as etapas. Conferido no navegador em 19/09/2026, antes e depois. A correção
  é passar `{ keepDirtyValues: false }` na chamada de `limpar`, não tirar o `resetOptions`, que
  ainda protege quem digita durante uma revalidação da consulta. ⚠️ **O mesmo `limpar` roda depois
  de gravar e ao fechar o diálogo**, então o defeito também fazia a ficha anterior sobrar para o
  próximo cadastro.
- ⚠️ **Para saber se um limpar funcionou de verdade, olhe o BOTÃO, não só os campos.** Ele só
  aparece com `isDirty`, então continuar visível depois do clique é a prova de que o reset não
  pegou, mesmo que a etapa aberta pareça em branco.

- ⚠️ **A etapa 1 abre com NOME, SEXO e NASCIMENTO na mesma coluna, e a foto ao lado das três**
  (pedido do usuário em 19/09/2026). O sexo entrou aqui e é opcional (`GENDERS`, vazio = "Não
  informado"), com coluna `gender` na V33 do `Backend-web`. O arranjo não é estética solta: com o
  nome sozinho, a moldura flutuava ao lado de um vão vazio, e a grade de baixo ficava com uma célula
  órfã. Hoje a moldura usa `sm:h-full` dentro de um invólucro `sm:flex-1`, com a linha em
  `sm:items-stretch`, e termina exatamente na base do campo de nascimento. ⚠️ O `h-full` é só a
  partir de `sm`: empilhado, a coluna não tem altura para dividir e a moldura zeraria.
- ⚠️ **O `className` do `GlassInput` vai para o INPUT, não para o item da grade.** `sm:col-span-2`
  nele nunca fez nada, e o e-mail só passou a ocupar a linha inteira dentro de um `<div>` próprio.
- ⚠️ **`GlassSelect` com opção de valor vazio precisa de `placeholder` com o rótulo dela**, senão o
  gatilho fica em branco: para o Radix, `value=""` é "nada escolhido". Já documentado no componente,
  e o campo de sexo caiu nisso na primeira tentativa.
- ⚠️ **A foto do motorista é uma MOLDURA no canto superior direito da etapa 1**, dividindo a linha
  com o nome (pedido do usuário em 18/09/2026). Antes era um botão solto no pé da etapa, depois da
  data de nascimento: o retrato é a primeira coisa que identifica alguém e estava no último lugar que
  o olho visita. O mesmo diálogo faz cadastro e edição, então vale nos dois.
- ⚠️ **Vazia ela é tracejada, cheia é contínua**, e o traço é de 2px em `outline`, nunca
  `outline-variant`: o `variant` é a divisória sutil, some a 1px, e a moldura deixa de convidar ao
  clique, que é a única função dela enquanto está vazia. O fundo é `glass-well`, o mesmo poço dos
  campos, para ela pertencer ao formulário em vez de parecer um cartão colado.
- ⚠️ **Na edição a moldura mostra a foto GRAVADA**, pelo `DriverAvatar`, que busca na rota
  autenticada. Sem isso ela abriria vazia para quem já tem retrato e a leitura seria "não há foto",
  quando a verdade é que o formulário não carrega os bytes dela. Quem não tem foto cai nas iniciais.
  ⚠️ A regra antiga continua: **não escolher foto significa "não mexi"**, e tratar a ausência como
  remoção apagaria a foto de quem só corrigiu um telefone.
- ⚠️ **O "remover" da foto vive no CANTO da moldura**, e não numa linha embaixo dela: embaixo, ele
  só nascia depois de escolher a imagem e empurrava o bloco para baixo no exato instante em que a
  foto aparecia, com o formulário dando um pulo.
- ⚠️ **`photoPending` existe porque o corte e a redução rodam no NAVEGADOR** e demoram numa foto de
  celular de 8 MB. Sem ele a moldura fica igual entre o clique e a imagem aparecer, e quem escolheu
  clica de novo achando que falhou. O `finally` é obrigatório: preso ao `try`, imagem recusada deixa
  a moldura girando para sempre.
- A frase "Cortada em quadrado e reduzida aqui no navegador" saiu a pedido do usuário. O
  comportamento continua, no `prepareDriverPhoto`.

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
- ⚠️ **Campo de número usa MÁSCARA, e a máscara vem de `lib/input-masks.ts`** (pedido do usuário em
  19/09/2026). Peso, litro e quilômetro mostram o milhar (`36.000`), metro cúbico e km/l usam
  vírgula, dinheiro tem duas casas, e documento tem a pontuação dele. Quem confere cadastro compara
  com um papel na mão: o que está na tela precisa se parecer com o que está no papel.
- ⚠️ **Formatar e converter andam SEMPRE em par.** `Number('8.500')` é **8,5**: com a máscara de
  milhar e um `Number()` solto no envio, o caminhão de oito toneladas e meia vira um de oito quilos e
  meio, sem nada falhar e sem ninguém perceber até alguém somar. Quem exibe com `maskInteger`
  converte com `parseInteger`. ⚠️ E a ficha gravada precisa entrar **já mascarada**, senão o
  formulário abre com `36000` num campo que mostra `36.000` e a comparação acusa mudança em quem só
  abriu e fechou.
- ⚠️ **`inputMode` é dica de TECLADO, não regra.** No celular ele troca o teclado; no computador o
  campo continua aceitando letra. Onde a letra é sempre erro (PIS, registro da CNH, Renavam, RNTRC,
  ano), quem barra é o `onChange` com `onlyDigits`.
- ⚠️ **`type="number"` não serve para campo formatado.** Ele bloqueia letra, mas aceita `e`, `+` e
  `-`, mostra setinha de incremento e **recusa qualquer valor com ponto**, então quilometragem nunca
  mostraria o milhar. O caminho é texto com máscara e `inputMode`, guardando número no estado.
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

### O pátio (`/gestao/patio`)

Substituiu a tela "Caminhões" em 16/09/2026, a pedido do usuário. A lista com despesa do período
respondia "quanto cada caminhão custou"; quem abre o painel de manhã pergunta olhando para um pátio
físico: **o que está aqui, e o que dá para mandar rodar hoje**.

- ⚠️ **A `trucks-page.tsx` continua no repositório**, com a despesa e o ranking junto, e não foi
  apagada: devolvê-la é trocar o import na rota. Mesmo tratamento da `owner-home-page`.
- ⚠️ **`/gestao/caminhoes` virou redirecionamento para `/gestao/patio`.** Onze lugares apontavam
  para o endereço antigo (assistente, visão geral, custos, manutenção, dono), e o redirecionamento é
  o que evitou mexer nos onze. ⚠️ Ele casa o caminho EXATO: `caminhoes/cadastro` é outra rota e
  continua valendo.
- ⚠️ **O pátio É a filial**, e é dado real: o campo `unit` da telemetria. Nesta frota são cinco
  (Queimados 12, São Cristóvão 11, Barra do Piraí 6, Campos 6, GIG 5). Com "Todos os pátios" a grade
  sai **agrupada por filial**, porque cada pátio é uma decisão separada.
- ⚠️ **O prefixo do nome da filial é CALCULADO, não uma string fixa.** As cinco começam com
  "SERVIOESTE - RJ ", e repetir isso em cada título e cada opção gasta a largura dizendo o que não
  distingue ninguém. O corte é no último separador, senão "SANTOS" e "SANTO ANDRÉ" virariam "OS" e
  "O ANDRÉ". Sem prefixo comum, o nome inteiro continua aparecendo.
- ⚠️ **A FOTO DO FORNECEDOR NÃO ENTRA NA GRADE, e isso foi medido olhando a tela.** A MiX devolve
  imagem em 15 dos 40 veículos, e são fotos de verdade: carro preto à noite, frente estourada de
  flash, e um hatch laranja no cadastro de uma van. Numa lista passam; numa grade de quarenta
  quadrinhos cada foto rouba o olho da placa. A silhueta padronizada vale para todos. A foto continua
  na lista e na ficha.
- ⚠️ **O veículo do cartão é `@imgs/truckCargoSide.png`**, a mesma imagem em todos, escolhida pelo
  usuário em 16/09/2026 no lugar do vetor isométrico (`yard-vehicle-illustration.tsx`, que ficou sem
  uso). É por isso que o TIPO vem escrito ao lado do modelo: a imagem não distingue van de caminhão.
- ⚠️ **O arquivo foi APARADO antes de entrar**, e isso não é capricho: o original tinha 2000x2000
  com o caminhão ocupando 788px de altura, ou seja, 60% de transparência. Dentro da vaga ele
  apareceria como um risco no meio do cartão. Recortado e reduzido para 760x318, o peso caiu de
  515KB para 191KB. **Imagem nova passa pelo mesmo corte**, e não por um `scale` na tela, que é o
  remendo que a silhueta antiga precisava.
- ⚠️ **O TRAÇO DA VAGA SAIU do cartão** (decisão do usuário em 16/09/2026). Era um box inclinado
  (`skewY(-7deg)`) com marca de chão, que desenhava a perspectiva do vetor isométrico: com o veículo
  de perfil virou uma diagonal atravessando o cartão, sem nada a que corresponder. Endireitá-lo foi o
  passo intermediário, e o usuário pediu para tirar de vez. O que restou é `.yard-vehicle-figure`, só
  o enquadramento, e o silêncio em volta do caminhão é de propósito. **Não redesenhar vaga sem
  cadastro de vaga**, que é a mesma regra do "vaga vazia não é inventada" acima.
- ⚠️ **Disponível fica SEM faixa de cor** (decisão do usuário: "livre é neutro, sem cor"). São 27 dos
  40: com faixa verde em todos, o verde vira o fundo da tela e o azul de quem está na rua deixa de
  saltar. O chip continua escrito em todos, então a informação não se perde. **Isto diverge da lista
  de frota de propósito**, onde a faixa vale para os cinco estados.
- ⚠️ **"Não informado" é ausência, e não valor.** A telemetria escreve isso no lugar do modelo, e sem
  peneira o cartão dizia "Caminhão · Volkswagen Não informado".
- ⚠️ **VAGA VAZIA NÃO É INVENTADA.** A referência visual trazia vagas numeradas com buracos, e isso
  exige um cadastro de vagas que o produto não tem: desenhar "A-12 livre" seria número inventado na
  tela de quem decide.
- ⚠️ **O cartão LEVA à página do veículo** (`/gestao/patio/<placa>`), e por isso voltou a ser
  clicável. O endereço é a PLACA, e não o id, pela mesma razão do `empresas/<slug>` do backoffice:
  `patio/BAW1F62` se lê e se manda por mensagem. Quem traduz placa em veículo é a tela, procurando na
  lista da frota, que já está em cache. ⚠️ **Como `<a>`, o cartão precisou de `display: block`** no
  CSS, senão a âncora volta a ser inline e desmonta a grade, **e o teste precisou de `MemoryRouter`**,
  senão `Link` estoura em "Cannot destructure basename".

### A ficha do veículo (`/gestao/patio/<placa>`)

Desenhada em 16/09/2026 a partir de três referências de dashboard que o usuário trouxe. Faixa laranja
com **Manual** e volta para o pátio, barra lateral de seções, e a grade de blocos.

- ⚠️ **SEIS DOS NOVE BLOCOS PEDIDOS NÃO TÊM ORIGEM, e a tela DIZ isso.** Consumo (`fuelEfficiency`
  volta nulo), nível de tanque (não existe campo), acelerador (só há `max_rpm` por jornada, que é
  outra coisa), eficiência de rota (exige rota planejada, que o produto não tem), pneu (exige TPMS ou
  inspeção) e cliente/frete (não existe módulo). Cada bloco aparece com a FORMA dele e uma frase
  dizendo o que falta e de onde viria. **Não preencher com valor de exemplo**: é a regra do produto,
  e aqui ela vale para cinco blocos ao mesmo tempo.
- ⚠️ **O que é real**: o rastro do mapa (`/v1/vehicles/{id}/track`, 622 pontos em 24h no BAW1F62), o
  condutor, a quilometragem por dia, os eventos de condução e o manual.
- ⚠️ **O mapa é o PERCORRIDO, não uma rota planejada.** A referência mostrava origem, destino e
  chegada estimada; sem ordem de frete não há destino a desenhar.
- ⚠️ **O mapa da ficha é o MESMO `FleetMap` do `/gestao/mapa`** (pedido do usuário em 16/09/2026), com
  a lista de posições reduzida a um veículo. Um mapa próprio chegou a existir aqui e foi apagado: o
  desenho do caminhão, o crachá da placa, a inclinação e o tratamento de lacuna já estavam resolvidos
  no outro, e a segunda implementação divergiria na primeira correção. **Não recriar mapa por tela.**
- ⚠️ **`prepararTrajeto` é obrigatório antes de mandar o rastro ao mapa**, e não é enfeite: ele separa
  trecho medido de lacuna. Com a lista crua, o mapa liga leitura a leitura sem saber quanto tempo
  passou entre as duas e desenha como percurso uma reta de 20km que ninguém mediu.
- ⚠️ **O `track` precisa de `useMemo` próprio.** Sendo um ternário no corpo do componente, a
  referência muda a cada render e o `prepararTrajeto` reprocessava os 622 pontos toda vez. O lint
  aponta isso, e o aviso é verdadeiro.
- ⚠️ **A ficha é uma COLUNA FLEX de uma tela de altura, e a folha branca cresce dentro dela.** Sem
  isso ela termina onde o conteúdo termina e o papel bege do painel aparece embaixo: a página ficava
  com duas cores nas seções curtas, e o usuário apontou. ⚠️ O invólucro é DA TELA, e não do
  `ManagementLayout`: transformar o layout em coluna flex mudaria o empilhamento de vinte telas de
  uma vez, e margem deixa de colapsar dentro de flex. Com `flex-1` na folha não há número mágico de
  altura de faixa, e a rolagem continua em zero.
- ⚠️ **Manutenção é a seção com EXEMPLO EM TODOS OS CAMINHÕES** (decisão do usuário em 16/09/2026),
  e é a exceção deliberada ao "sem origem" dos outros blocos. O que a separa: **loja parceira é
  CATÁLOGO, e não medição da frota do cliente**. Listar oficinas afirma algo sobre uma rede que a
  RookHub vai montar, e a seção diz isso em uma linha; dizer "68% de tanque" afirmaria algo sobre um
  caminhão que existe. ⚠️ **Por isso nenhum cartão traz "última troca há X km"**: aquilo seria
  medição por veículo, e ninguém tem o dado. O catálogo está em `mocks/maintenance-partners.ts`, com
  a forma que uma API devolveria.
- ⚠️ **Desde 17/09/2026 o vencimento vem PRONTO da API** (`GET /v1/vehicles/{id}/maintenance`), e a
  tela não recalcula nada: o cálculo mora no `VehicleMaintenanceService`, porque a ficha, a fila de
  manutenção e o assistente fazem a mesma pergunta. O plano é editado no **cadastro** (etapa "Plano
  de manutenção", só na edição, porque a rota pede o id do veículo) e a troca é registrada na
  **ficha**, em Manutenção. Os dois se encontram na seção "Manutenção" do manual em PDF.
- ⚠️ **Sem plano, mas com troca, o cartão diz "Trocado em 17/09, sem plano".** Sem essa frase, quem
  acabou de lançar a troca via "sem plano cadastrado" e concluía que o lançamento se perdeu.
- ⚠️ **O plano NÃO entra no `form` do cadastro**: é outra tabela e outra rota, e misturá-lo faria a
  comparação `diferenca()` mandar intervalos no PATCH do cadastro, que os descartaria em silêncio. A
  gravação são duas chamadas na mesma mutação, cadastro primeiro.
- ⚠️ **O vencimento por item separa CATÁLOGO de MEDIÇÃO, e é aqui que a linha passa.** O intervalo
  ("a cada 10.000 km ou 6 meses") vale para qualquer caminhão e aparece sempre. Já "vence em 12
  dias" é afirmação sobre AQUELE veículo: só a **revisão geral** tem origem (`nextMaintenanceDate` e
  `kmToMaintenance` do cadastro) e os outros cinco dizem **"sem última troca registrada"**, porque
  não existe campo de última troca por item em lugar nenhum. Na placa de demonstração todos vencem,
  para o layout aparecer inteiro.
- ⚠️ **`kmToMaintenance` volta nulo nos 40 veículos**, então hoje a revisão mostra "sem plano
  cadastrado" na frota inteira. O caminho para preencher é o cadastro do veículo, não a telemetria.
- ⚠️ **A barra lateral é navegação DA PÁGINA**, e não do produto: o menu é a barra superior, e uma
  segunda navegação global brigaria com ela. Os nomes vieram da referência em inglês; "Viagens" e
  "Cliente" existem porque foram pedidos, e explicam o que o produto não tem.
- ⚠️ **O cadastro entra na ficha só pelo número de eixos**, com a MESMA chave do manual
  (`vehicle-registry`): os dois dividem o cache, então abrir o manual depois não vai ao servidor.
- ⚠️ **`RKH0T99` é a PLACA DE DEMONSTRAÇÃO** (`mocks/demo-vehicle.ts`), criada a pedido do usuário
  para ver a ficha cheia enquanto cinco blocos não têm origem. Ela **não vem da API, não aparece no
  pátio e não entra em contagem nenhuma**: só é alcançada pelo endereço direto. A ficha dela mostra
  uma faixa de aviso permanente, porque um print desta tela numa reunião vira número de cliente.
- ⚠️ **O Manual da placa de demonstração é resolvido na FRONTEIRA (`api.ts`), e não com cache
  plantado.** `setQueryData` foi tentado e não resistiu: o diálogo revalida em segundo plano, a
  requisição de uma placa inexistente falha, e o erro vence o dado do cache. Quem decide mock contra
  real é o `api.ts`, como no resto da feature.
- ⚠️ **O desenho dos blocos de medida mora num molde só, o `MetricCard`.** Ele nasceu do bloco de
  Eficiência da rota, que ganhou tratamento próprio (fundo pêssego, número gigante em marinho, selo
  redondo terracota e rodapé de duas colunas), e o usuário pediu para repetir nos demais. Repetir à
  mão em cinco lugares é o caminho para eles divergirem na primeira alteração. ⚠️ **As cores do
  desenho original eram hexes literais** (`#fff8f5`, `#010066`, `#d5623a`, `#52607a`) e foram
  trocadas por token na extração: o pêssego é a terracota a 5% sobre o branco, e o número é
  `--accent`.
- ⚠️ **Ligar e mandar mensagem para o motorista dependem do TELEFONE, que a rota do veículo não
  traz**: ela devolve o NOME do condutor, e o telefone mora na ficha do motorista, buscada por id. Os
  dois botões aparecem **desabilitados dizendo o porquê**, em vez de sumirem, senão a ficha muda de
  forma conforme o dado. Na placa de demonstração eles funcionam (`tel:` e `wa.me`).
- ⚠️ **O meio do cartão do condutor é odômetro e sincronização**, e existe para fechar um buraco:
  numa linha em que o vizinho é o mapa, o cartão esticava e sobrava meia altura vazia. Os dois valem
  para qualquer veículo, inclusive os sem condutor, então o buraco não volta.
- ⚠️ **CONSULTA DESLIGADA É `isPending` PARA SEMPRE**, e a demonstração desliga quatro. Sem guardar
  cada `QueryState` com `!demonstracao`, a ficha ficava girando para sempre. É a mesma armadilha já
  registrada na ficha da empresa do backoffice.
- ⚠️ **A TIPOGRAFIA DO PÁTIO ESTAVA FORA DA ESCALA DO PAINEL**, e o usuário percebeu comparando com
  `/gestao/caminhoes/cadastro`. A família era a mesma (Inter no corpo, Sora no título): o que
  divergia era o TAMANHO, campo de 13px contra 16px e rótulo de 11px contra 14px, mais uma escada de
  9 e 10px espalhada pelos cartões. Os 27 tamanhos passaram a sair de `var(--text-*)` do
  `theme.css`. **Tamanho literal em px não volta para este arquivo.**
- ⚠️ **`font-size: var(--text-label-*)` SOZINHO NÃO BASTA, e foi por isso que a fonte continuou
  diferente depois da primeira correção.** No Tailwind o peso, o `letter-spacing` e a entrelinha
  viajam no UTILITÁRIO (`.text-label-sm`), e não na variável: escrever só o `font-size` em CSS puro
  entrega o tamanho certo com peso 400, sem tracking e com entrelinha herdada, o que se lê como outra
  fonte ao lado do resto do painel. Em CSS puro, os quatro andam juntos: **label-sm** 12px/500/0.04em,
  entrelinha 16px; **label-md** 14px/500/0.05em, entrelinha 20px; **body-md** 16px, entrelinha 24px.
- ⚠️ **O indicador do pátio copia a receita do `HeroStats`**, que é o mesmo objeto nas outras telas:
  rótulo `label-sm` em `on-light-variant`, número em **Sora 700, 30px, entrelinha 1 e sem tracking**,
  e dica `label-sm` em `on-light-muted`. Peso 500 com entrelinha 1,4 e tracking negativo era o que
  fazia aquele número parecer de outra família.
- ⚠️ **O FOCO DO CAMPO É UM ANEL NA CAIXA, e não um `outline` no `input`.** O `input` não tem canto
  arredondado (quem tem é a caixa), então o contorno desenhava um RETÂNGULO DURO dentro de um campo
  redondo, e era isso que aparecia ao clicar para digitar. Medida a referência do painel: **1px de
  terracota a 50% em volta da caixa**, e nada no `input`.
- ⚠️ **Terracota é AÇÃO e marinho é DETALHE**, que é a divisão que a paleta documenta (referência do
  Itaú). No pátio: anel de foco e realce do seletor em `--color-primary-on-light`; ícone de título em
  `--accent`, que é o #010066 no tema claro.
- ⚠️ **A FICHA DO VEÍCULO NÃO MORA MAIS AQUI.** Ela chegou a abrir abaixo da grade e saiu no mesmo
  dia, a pedido do usuário: vai viver em outro lugar, ainda a definir. Enquanto esse lugar não
  existe, **o cartão é só leitura, sem clique**, porque cartão que parece botão e não leva a lugar
  nenhum é pior que cartão quieto. Voltando o clique, o estado de escolha é **anel**, nunca
  preenchimento: o cartão cheio de terracota apagaria o véu de atenção e o chip junto.
- ⚠️ **Consequência sabida: `VehicleDetailPanel` e o manual em PDF do veículo ficaram sem porta.** A
  `trucks-page` saiu do menu e a ficha saiu do pátio, então hoje nenhuma tela do painel abre os dois.
  Some quando a nova casa for dita.
- ⚠️ **Se a ficha voltar, ela não cabe numa coluna estreita ao lado da grade**: os indicadores dela
  são um `xl:grid-cols-4` desenhado para a largura cheia, e em 400px a ficha quebra.
- ⚠️ **`internalCode` volta NULO nos 40 veículos** (quem preenche o número da porta é a operação, não
  o rastreador), então a placa é o identificador grande e o número da porta é complemento. O cartão
  já o mostra quando existir.
- ⚠️ **A tela teve paleta PRÓPRIA por algumas horas, em navy `#0b1220` com Inter**, escrita a partir
  do prompt que a especificou. O usuário mandou trazê-la de volta para a marca no mesmo dia: **fundo
  branco e a faixa laranja de volta**. Hoje o `yard.css` não tem cor literal nenhuma, só
  `var(--color-*)` de `palette.css`. **Não reintroduzir paleta de tela**: era a única superfície
  escura de um produto que o usuário usa no claro.
- ⚠️ **`yard.css` é um arquivo de CSS por tela, e é a exceção do painel**, que é utilitário Tailwind
  em todo o resto. O que ele guarda é FORMA que não cabe em utilitário: a vaga inclinada, o brilho no
  topo do cartão e a grade que se adapta. Cor, não: cor sai do token.
- ⚠️ **`--yard-accent` é a família de PREENCHIMENTO e `--yard-ink` a de TEXTO**, e trocar uma pela
  outra é o erro que a paleta já documenta: `-on-light` como tinta chapada vira vinho e marrom, que
  não se separam de longe.
- ⚠️ **A `HeroBand` traz a topbar dentro dela.** Ao devolver a faixa laranja, o `AppTopbar` que a tela
  montava sozinha teve de sair, senão saem duas barras. E a folha branca sobe com `margin-top: -68px`
  para morder a faixa: sem isso sobra uma tira laranja vazia de 96px, que é o respiro que a faixa
  reserva para o conteúdo encostar.
- ⚠️ **Manutenção e bloqueado não aparecem no dado de hoje**: a frota real só devolve `DISPONIVEL`,
  `EM_VIAGEM` e `SEM_SINAL`. O laranja e o vermelho do cartão existem e estão corretos no código, mas
  **nunca foram vistos com dado real**.

### A ficha em PDF (manual do veículo e ficha do motorista)

O "Baixar" dos dois diálogos é `window.print()`, e o documento sai do próprio HTML, sem biblioteca de
PDF no bundle. Quem monta o papel é o `@media print` do fim do `globals.css`, e ele foi reescrito em
16/09/2026 porque o PDF saía com **uma página, oito palavras e a coluna da esquerda cortada**.

- ⚠️ **`visibility` reacende o ramo marcado, mas NÃO o solta da caixa dele.** O diálogo é
  `position: fixed`, `max-h-[85dvh]`, `max-w-3xl`, `overflow-hidden` e dois `translate` de -50%: no
  papel isso virava uma moldura de 768px por uma tela de altura, e a folha útil de um A4 com margem
  de 16mm tem ~673px. O resto era descartado **em silêncio**. Quem desfaz é
  `body :has([data-print-root])`, que alcança todo ancestral e tira posição, limite, corte e
  transformação.
- ⚠️ **O minificador do build desfaz `translate: none`.** Ele funde `transform: none` com
  `translate: none` num `transform: translate(0) rotate(0) scale(1)` e **descarta o `translate`**,
  que é a propriedade onde o Tailwind 4 escreve `-translate-x-1/2`. A correção funcionava no
  `npm run dev` e sumia no `npm run build`, que é o pior tipo de defeito. O que atravessa intacto é
  zerar `--tw-translate-x` e `--tw-translate-y`.
- ⚠️ **Irmão do bloco impresso sai por `display`, não por `visibility`.** O cabeçalho do diálogo e a
  barra de botões não são ancestrais: escondidos por `visibility` continuavam ocupando altura, e a
  ficha começava com quatro centímetros de folha em branco.
- ⚠️ **Tinta clara sobre papel branco é papel em branco.** A rampa escura é o padrão do produto e o
  navegador não imprime fundo: quem baixasse a ficha no tema escuro recebia #F0F0F2 sobre branco. O
  bloco de impressão redefine os tokens com os valores do `html.light`, e **não** com uma cor
  chapada, senão o "vencido" deixaria de ser vermelho.
- ⚠️ **Quebra de página é por CAMPO.** `break-inside: avoid` na seção inteira empurraria
  "Identificação", que tem onze campos, para a página seguinte e deixaria meia folha vazia.
- **Como conferir sem clicar**: o Chromium do cache do Playwright imprime por linha de comando
  (`--headless --print-to-pdf`), e `pdftotext -bbox` diz se alguma palavra passou da área útil.
  Contar palavras e seções no PDF pega o corte que o olho não vê.

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

Podado a **Visão geral, Equipe e Cargos**, temporariamente, a pedido do usuário.

- ⚠️ **A home é `owner-overview-page`**, e a `owner-home-page` continua no repositório: aquela
  responde "quanto sobrou" com DRE e margem, e **nenhum desses números tem origem**. Voltar é trocar
  o import do `RoleHome`.
- ⚠️ **Em Equipe o dono vê só quem ele convidou** (`somentePainel`), porque os motoristas da
  telemetria empurravam as contas para a segunda página. Some junto o filtro de filial: filtro que
  nunca acha nada lê como defeito.
- ⚠️ **As rotas continuam registradas**: quem digitar `/gestao/resultado` ainda chega. Some do menu
  foi o que se pediu, e é o que torna a volta barata.
- ⚠️ **Cargos é do DONO, e de mais ninguém, desde 16/09/2026** (decisão do usuário). A tela saiu do
  menu do gestor e entrou no do dono, e a guarda da rota virou `OWNER_ONLY`: o gestor que digitar
  `/gestao/cargos` é levado de volta à visão geral. O motivo é o mesmo que a API já aplica:
  `roles.manage` não é delegável, então ver a alçada de todo mundo numa tela cujos botões não são
  seus só confunde. **Como o `SUPER_ADMIN` espelha o menu do gestor, ele também deixou de alcançar a
  tela.**
- ⚠️ **A tela de equipe NÃO depende dessa rota** para saber o nome de cada cargo: quem responde é
  `GET /v1/roles`, e o gestor continua alcançando a API. O que saiu foi a tela, não a leitura.

### Multas (`/gestao/multas` e `/app/multas`)

Ligadas à API real em 19/09/2026, vindas da Smartec pelo `Backend-web`. **São duas telas sobre o
mesmo endpoint**, e a diferença entre elas é o que cada painel consegue dizer.

- ⚠️ **A lista traz placas que NÃO são da transportadora, e isso é pedido do usuário.** O token da
  Smartec alcança a frota do grupo: 138 veículos lá contra 40 no cadastro, e as outras 100 são de
  SERVIREST, SERVIRIO, HOTEL e MATRIZ. Em `/gestao` elas aparecem com a marca **"Sem cadastro no
  sistema"**, e ficam **fora de toda soma**: o cartão "Em aberto" conta só a frota cadastrada, e o
  cartão "Sem cadastro" existe para dizer quanto ficou de fora. Sem esse segundo número, o topo não
  fecharia com a lista e ninguém saberia por quê.
- ⚠️ **No `/app` entra SÓ a frota cadastrada** (`?registered=true`), e não é filtro por gosto: o
  tipo `Fine` do painel operacional modela placa, condutor e valor, e **não tem onde dizer que a
  placa é de outra empresa**. Mostrar sem poder marcar seria pior que não mostrar.
- ⚠️ **A base do veículo não entra na linha da infração.** O `unit` nasce do subgrupo da MiX, que
  não é estrutura de operação: a primeira versão escreveu **"Base DESLIGADOS/INATIVOS"** ao lado de
  uma multa. O campo continua no contrato, sem uso na tela. O que a linha mostra é a **UF da
  infração**, que é dado do próprio auto.
- **O prazo de indicação é o que dá valor à notificação**, e por isso aparece em destaque e só
  enquanto vale: passada a data, perde-se a chance de dizer quem dirigia e a pontuação fica com a
  empresa.
- **Dez por página**, como as outras filas. `driverName` é sempre "Não identificado" porque a
  Smartec devolve `MOTORISTA_NOME` nulo em toda a frota real.
- ⚠️ **Sem coleta, a tela DIZ que nunca coletou.** Escrever "atualizado agora" com a tabela vazia
  faria alguém concluir que a frota não tem multa nenhuma.
- **Menu e plano usam o módulo `COSTS`**, e não um `FINES` novo: os módulos do painel de gestão são
  sete e fechados (`management/types.ts`), e criar o oitavo mudaria o que cada plano vende.
- ⚠️ **Não dá para conferir `/app/multas` com a conta de gestor**: o `RoleAreaRoute` manda `MANAGER`
  de volta ao `/painel`, e o seed de desenvolvimento só tem essa conta. Verificar aquela tela exige
  conta de operador, manutenção ou motorista.

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

### O mapa da visão geral

- ⚠️ **Desde 18/09/2026 ele é o MESMO `FleetMap` do ao vivo**, com os caminhões em 3D e a legenda
  flutuante (pedido do usuário). Não é mais um mini mapa: `fleet-mini-map.tsx` continua no
  repositório, sem uso, e voltar atrás é trocar o bloco de volta. É a mesma decisão da ficha do
  veículo, de 16/09: **não recriar mapa por tela.**
- ⚠️ **A legenda passou a mostrar os CINCO estados**, derivada de `CORES_DA_GESTAO` e
  `VEHICLE_STATUS_LABELS`. A versão antiga era uma lista fixa de quatro, que omitia manutenção por
  decisão de 06/09/2026, quando aqui só havia pontinhos: com o mapa de verdade, omitir passou a ser
  mentir por omissão, porque o caminhão amarelo aparece na tela sem nada que o explique.
- ⚠️ **A receita do painel flutuante saiu da página para `live-map/overlay.ts`.** Dois mapas do mesmo
  produto não podem ter dois desenhos, e copiar a string é como nasceram as três tabelas de cor que o
  `status-color.ts` existe para evitar.
- ⚠️ **A moldura da legenda é `pointer-events-none`**, e o conteúdo dela `auto`: sem isso o retângulo
  invisível come o arrasto do mapa na faixa de cima.
- **Preço aceito**: a visão geral passou a carregar o `three` e o modelo do caminhão.

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
- ⚠️ **`public/video/truck-highway.mp4` É versionado** (decisão do usuário em 19/09/2026), e não
  segue a regra dos GLB acima. O critério é uso, não formato: ele são 890 KB que o navegador pede em
  toda visita à porta do cliente, enquanto os modelos são fonte de conversão que ninguém baixa. Sem
  ele no repositório, o painel publicado abriria com o painel do login vazio. **O peso foi medido,
  não escolhido**: o x264 a 890 KB venceu o VP9, que gastou 2,08 MB pela mesma qualidade, e por isso
  não há `<source>` de alternativa. Vídeo novo aqui se mede de novo antes de repetir a conclusão.
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
- ⚠️ **Conteúdo flutuante dentro de diálogo precisa de `z-[1200]`, e o número vai no CONTEÚDO.** O
  Popper lê o z-index computado do conteúdo na montagem e o copia para o invólucro posicionado, que
  é quem de fato empilha; o conteúdo em si é `position: static`, onde z-index não tem efeito nenhum.
  O `TooltipContent` nasceu com o `z-50` do shadcn e a ajuda dos campos abria **atrás** do modal, que
  é `z-[1101]` (18/09/2026). Mesma armadilha da lista do `GlassSelect` em 27/08/2026, e a escala do
  painel está em `ui/lib/field-surfaces.ts`.
- ⚠️ **`Select.Value` sem `placeholder` deixa o gatilho em BRANCO quando o valor é `''`.** O Radix
  trata string vazia como "nada escolhido", então a opção `{ value: '' }` que várias listas daqui
  usam para "Não informado" nunca consegue se desenhar no gatilho: quem escolhia via o campo esvaziar
  e lia como falha. Em lista que tem opção vazia, o `placeholder` repete o **rótulo dela**, e não um
  convite como "Selecione…", senão o campo contradiz a escolha recém-feita.
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

**Componente de terceiros (Originkit)**

- **`src/components/originkit/` é código VENDORIZADO**, escrito pelo `npx originkit@latest add <nome>`
  e mantido como veio. Hoje mora ali só o `ui/ember-husk.tsx`. ⚠️ **Ele não é mais o que a tela usa**:
  a porta da equipe importa o fork em `pages/login/ember-husk-scene.tsx`. A cópia fica guardada para
  comparar com uma versão nova do fornecedor, porque `originkit add` reescreve o arquivo inteiro e o
  fork deixou de ser atualizável pelo CLI.
- ⚠️ **Ele não passa no TypeScript nem no ESLint deste projeto**, porque indexa array sem guarda em
  dezenas de lugares e o `noUncheckedIndexedAccess` está ligado. Por isso o arquivo abre com
  `@ts-nocheck` e `eslint-disable`, e a pasta entrou no `.prettierignore`. **Corrigir isso à mão é
  trabalho perdido**: a próxima atualização pelo CLI reescreve o arquivo inteiro.
- ⚠️ **O `"use client"` do topo é do Next e não faz nada no Vite.** Fica porque o brief do CLI manda
  preservá-lo, e tirá-lo só cria diferença com a origem.
- **Instalar exige login** (`originkit login`, OAuth pelo navegador, sessão em `~/.originkit/auth.json`),
  e o `--no-deps` evita mexer no `package.json`: o `three` já é dependência do projeto por causa do
  mapa 3D. O `.originkit/` que o CLI cria é gitignored e não é documentação do produto.
- ⚠️ **Medir o container com `clientWidth`, e não com `getBoundingClientRect`**, é o que faz a cena
  caber dentro da `.tela-proporcional`. O componente já faz certo, e é a mesma armadilha que o
  `Grainient` documenta: o rect vem com o `zoom` aplicado e o canvas encolheria de novo lá dentro.

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
