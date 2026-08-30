# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Quatro perfis usam este repositório, e eles não se parecem em nada no uso:

- **Proprietário (OWNER)** e **Gestor (MANAGER)** entram em `/gestao`. O dono olha resultado
  consolidado, margem e aprovações, geralmente sentado, uma ou duas vezes por dia, e decide. O
  gestor olha prontidão da operação, liberações e pareceres, várias vezes ao dia.
- **Operador (OPERATOR)** e **Manutenção (MAINTENANCE)** entram em `/app`. São turno inteiro na
  tela, com muitas linhas, muitos filtros e trabalho repetitivo de conferência e lançamento.
- **Motorista (DRIVER)** tem app próprio (`System-mobile`) e no web só alcança o hub.
- **SUPER_ADMIN** administra a plataforma e entra por outra porta (`/admin-saas`), nunca pela de
  quem opera uma transportadora.

A separação de casca é deliberada: menu no topo para quem decide, menu lateral para quem executa.

## Product Purpose

RookHub é um SaaS multiempresa de gestão de frotas para transportadoras rodoviárias de carga. Cada
transportadora é um tenant isolado, e o que cada pessoa vê depende de duas coisas independentes: o
**perfil de acesso** e o **plano contratado**. Este repositório é o painel web do cliente.

Sucesso é o gestor conseguir responder, sem sair da tela, se a operação está pronta hoje, e o dono
conseguir ver o resultado sem pedir planilha para ninguém.

## Positioning

A tese não é ser mais um sistema de frota: é ser **ecossistema**. Várias fontes externas desaguam
num lugar só, organizadas e cruzadas. Hoje a fonte é a MiX Telematics (telemetria); câmeras e multas
do Detran são as próximas.

⚠️ **Nenhuma fonte externa é fonte de verdade sozinha** (decisão do usuário em 30/08/2026). O
cadastro do fornecedor é ponto de partida: quem responde quem é motorista, se está ativo e a que
caminhão está ligado é o RookHub. Conferir uma ficha na tela congela aquele registro para a
sincronização.

## Operating Context

- Frota real de referência: **SERVIOESTE**, 5 empresas, 40 caminhões, 150 motoristas.
- O dado que chega do fornecedor é sujo por natureza: nome de pessoa com instrução digitada dentro,
  filial "Default Site", placa repetida entre empresas por transferência que ninguém limpou. **As
  telas precisam mostrar o conflito, não escondê-lo**: esconder é esconder o trabalho a fazer.
- Metade das viagens da frota real não tem motorista identificado. Ranking e score nascem com
  buraco, e a tela precisa dizer isso em vez de exibir um primeiro lugar fantasma.
- Campo que a telemetria não tem fica **vazio, nunca zero**. Ano de fabricação, CPF, CNH e custo por
  quilômetro não existem na MiX. Número inventado em banco é pior que campo vazio.

## Capabilities and Constraints

- Vite, React 19, React Router 8, Tailwind 4 CSS-first, Zustand, TanStack Query, Recharts, MapLibre
  GL, Radix. Único dos quatro projetos do produto com suíte de testes (37 testes, Vitest).
- Dois painéis no mesmo repositório: `/gestao` (23 telas, `src/management/`, design system próprio
  portado do `System-mobile`) e `/app` (36 telas, `src/pages/` + shadcn/ui).
- Estado misto de propósito: autenticação, frota, mapa, motoristas, segurança, assistente e
  notificações vêm da API real; painel operacional, custos, manutenção e multas seguem simulados.
- **Guarda de permissão e plano no cliente é experiência de uso, não segurança.** A autorização que
  vale é a do `Backend-web`. Módulo não contratado aparece com cadeado, e não some (RN-004).
- Nomes de código, arquivo e pasta em inglês; texto de interface em pt-BR.

## Brand Commitments

- **Indigo `#6366F1`** é a marca primária e está no logo. Confirmado pelo usuário em 30/08/2026 como
  a cor de destaque do redesign, mesmo com as referências visuais usando coral e roxo: o painel
  precisa continuar casando com o logo e com o site institucional.
- **Cyan `#06B6D4`** é a secundária, usada em foco e destaque.
- **Nunca travessão (`—`)** em texto de interface. Decisão do usuário em 15/08/2026.
- **Barra de rolagem nunca visível** em nenhuma tela, caixa, campo, lista, modal ou drawer. A
  rolagem funciona, só a barra não aparece. Decisão do usuário em 19/08/2026.
- Ícone vem sempre de `src/components/icons.ts`, que é a fonte única dos quatro painéis: o mesmo
  conceito é o mesmo desenho em `/app` e em `/gestao`. A família é a Lucide.
- Cor literal nunca no componente. Os tokens de `src/styles/palette.css` são a fonte única.

## Evidence on Hand

- `docs/pdf/relatorio_frota_servioeste.pdf`: relatório real de frota do cliente de referência.
- `docs/pdf/` tem mais quatro documentos de arquitetura e integração, versionados de propósito.
- ⚠️ `RookHub_Arquitetura_e_Decisoes_Tecnicas.pdf` descreve a arquitetura-alvo e **diverge do que
  foi construído** em três pontos. Não citar como estado atual.
- Não existem depoimentos, clientes publicáveis, benchmarks ou preços confirmados. Não inventar.

## Product Principles

1. **Mostrar o conflito, não a média.** Quem está marcado como inativo e mesmo assim rodou é o caso
   que precisa de alguém olhando. Uma classificação única esconderia exatamente esse caso.
2. **Vazio é informação.** Campo que a fonte não tem aparece vazio e explicado, nunca preenchido com
   zero nem escondido.
3. **Duas cascas, um sistema.** Quem decide tem menu no topo, quem executa tem menu na lateral, e os
   dois compartilham cor, ícone, raio, tipografia e vocabulário. Diferença é de disposição, nunca de
   linguagem.
4. **A tela é ferramenta de trabalho repetitivo.** Ação a um clique, filtro que persiste, lista que
   volta onde estava. Perder a posição da rolagem é perder o trabalho.
5. **O plano limita o que aparece, e diz que limitou.** Cadeado com explicação, nunca ausência
   silenciosa.

## Accessibility & Inclusion

- Contraste é medido, não estimado: a paleta atual documenta a razão de cada par de texto sobre
  superfície, e os pares abaixo de AA já foram corrigidos uma vez.
- A paleta de gráficos é validada para deutan e tritan, com ordem fixa: uma série nunca troca de cor
  quando um filtro muda a contagem.
- ⚠️ Como a barra de rolagem é invisível no sistema inteiro, **área rolável precisa de outra pista
  visual** (sombra, corte de card, gradiente de borda), senão o corte lê como fim do conteúdo.
