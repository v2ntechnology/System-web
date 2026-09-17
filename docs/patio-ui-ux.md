# Pátio — especificação UI/UX

Rota: `/gestao/patio`. Implementação: React + TypeScript, com CSS de escopo `yard-*` e componentes existentes de navegação e consulta. A navegação já chama a seção de Pátio; Cadastro e Manutenção permanecem módulos próprios.

## Hierarquia e referências

1. Cabeçalho compacto: título Pátio, contexto de frota, horário da última consulta e ação Atualizar.
2. Filtro de filial em destaque: Todos os pátios ou filial específica, com busca dentro do dropdown. Busca de veículo ao lado; filtros empilhados no celular.
3. Indicadores clicáveis: total da filial, disponíveis, em viagem, manutenção, bloqueados e sem sinal. Cada indicador filtra a grade; clicar novamente remove esse recorte. Os totais representam a filial, independentemente da busca textual e do status selecionado.
4. Grade agrupada por filial: SVG isométrico padronizado, marcações sutis de estacionamento, status escrito, placa, número interno opcional, modelo e uma linha de apoio.
5. Rodapé: esclarece que os grupos representam a filial de vínculo e informa a frequência de consulta.

A primeira referência orienta a perspectiva isométrica e a uniformidade dos veículos; a segunda orienta o ritmo das vagas e o agrupamento visual. As cores amarelas e superfícies claras das referências são substituídas pelo navy solicitado. A grade representa veículos existentes, sem inventar vagas, capacidade do pátio ou localização GPS.

## Cards e reconhecimento

- Placa em Sora, peso 600, números tabulares e espaçamento ampliado; permanece o principal identificador.
- Ilustração SVG decorativa local, sem carregamento de imagens externas. Variações compacta, cavalo mecânico e carreta usam o mesmo enquadramento; são genéricas, sem representar o modelo exato.
- Número interno `internalCode` aparece como complemento quando disponível. Modelo em uma linha, com texto integral no atributo `title`.
- Em viagem, motorista quando informado. Nos demais casos, odômetro.
- Cards de leitura, sem clique ou seleção sem destino.
- Grade automática com células a partir de 205 px no desktop e duas colunas no celular; cantos de 18 px nos veículos e 24 px no painel.

## Cores e contrato de dados

| Situação recebida | Aparência                             | Significado                                      |
| ----------------- | ------------------------------------- | ------------------------------------------------ |
| `DISPONIVEL`      | Navy `#0B1220`, borda e badge neutros | Disponível para alocação                         |
| `EM_VIAGEM`       | Azul `#3B82F6`                        | Em rota externa                                  |
| `MANUTENCAO`      | Laranja `#F59E0B`                     | Manutenção                                       |
| `BLOQUEADO`       | Vermelho `#EF4444`                    | Bloqueio operacional de saída                    |
| `SEM_SINAL`       | Laranja `#F59E0B`, ícone de radar     | Telemetria indisponível; condição não confirmada |

A API atual não distingue análise técnica, quebra, avaria ou sinistro. Não se deve renomear bloqueio como sinistro. Quando esses estados forem disponibilizados pelo backend, análise técnica deve usar o tom warning, e quebra/avaria/sinistro, o tom error, com rótulos próprios no mapeamento `yard-status.ts`.

A cor aparece na borda, no traço superior, no fundo discreto e no badge. Texto e ícones repetem o estado; disponibilidade não recebe verde. Textos dos badges usam versões claras das cores para contraste sobre navy. O painel usa transparência, bordas sutis, sombra limpa e blur, com alternativa sem blur para preferência de transparência reduzida. Sora em títulos/placas e Inter nos dados.

## Comportamento e acessibilidade

- Dados vêm de `getVehicles`, respeitando a configuração existente de API/mocks; nenhuma frota fictícia é inserida na página de produção.
- Combinação instantânea de filial + status + busca por placa, frota, modelo, motorista ou filial. Busca ignora caixa e acentos.
- Dropdown Radix com foco na busca ao abrir, Escape para fechar, Tab para percorrer opções, seta para baixo para a primeira opção e Enter para selecionar resultado único.
- Indicadores expõem `aria-pressed`; cards têm identificação acessível e SVG decorativo.
- Carregamento e erro não aparecem como disponibilidade zero. Estados vazios permitem limpar os filtros.
- Consulta automática a cada 60 segundos enquanto a tela está ativa, mais atualização manual. O horário exibido é o da consulta, não a confirmação de telemetria recente.
- Sincronização ausente, inválida ou com mais de 30 minutos gera aviso para a filial selecionada. Filial ausente aparece como “Sem pátio definido”.

## Código

- `src/management/features/trucks/pages/yard-page.tsx`: tela, consultas, agrupamento e indicadores.
- `src/management/features/trucks/pages/yard.css`: tokens locais, status, grid e responsividade.
- `src/management/features/trucks/components/yard-card.tsx`: card reutilizável; recebe `{ vehicle: Vehicle }`.
- `src/management/features/trucks/components/yard-vehicle-illustration.tsx`: SVG padronizado.
- `src/management/features/trucks/components/yard-filters.tsx`: filtros controlados e seletor pesquisável.
- `src/management/features/trucks/yard-status.ts`: rótulos, ícones e tons de status.
- `src/management/features/trucks/yard-filters.ts`: tipos, constantes e normalização de busca.

## Validação

Cinco testes de interação em `yard-page.test.tsx` cobrem filtros combinados, totais por filial, separação dos status, teclado, resultado vazio, dados desatualizados e erro da API. Build de produção e lint dos arquivos alterados verificados. Prévia isolada com dados fictícios inspecionada em 1440 px e 390 px, sem overflow horizontal. Essa prévia não equivale a validar uma sessão autenticada com a API real.
