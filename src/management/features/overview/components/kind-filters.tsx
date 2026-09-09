import { cn } from '@/management/ui';

import { KIND_META, KIND_ORDER } from '../blockers';
import type { BlockerKind } from '../types';

/**
 * Os tipos de impedimento, cada um com o próprio desenho.
 *
 * Serve a duas coisas ao mesmo tempo: dizer de olho o que é multa, o que é
 * licenciamento e o que é checklist, e filtrar a fila ao ser clicado. Clicar no
 * tipo já escolhido devolve a fila inteira.
 *
 * Só aparecem os tipos que existem no dado: uma fileira de zeros ocuparia a
 * mesma altura sem dizer nada.
 *
 * ⚠️ É uma BARRA DE FILTRO, e não uma fileira de cards de número (08/09/2026).
 *
 * Já foi um grid de dez placas com ícone em caixa e duas linhas de texto. Duas
 * coisas quebravam ali. A mobília era grande demais para um controle que é
 * secundário: a lista de verdade vem logo abaixo, e o filtro estava com mais
 * peso do que ela. E o contorno marinho, que serve a um botão de apoio quando há
 * um ou dois na tela, em dez virou uma parede de caixas idênticas em que nada se
 * destacava, nem o tipo nem a contagem.
 *
 * Agora é o mesmo desenho de rótulo mais contagem que as abas da página já usam,
 * numa pastilha compacta. O marinho ficou só no NÚMERO, que é o dado: cor de
 * detalhe em elemento pequeno, e não em dez molduras.
 *
 * ⚠️ Continua em GRID, e não numa linha que quebra sozinha (decisão do usuário
 * em 08/09/2026). A largura passa a ser a da coluna, e não a do rótulo: com dez
 * tipos de nome muito desigual ("Multa" contra "Viagem sem atualização"), a
 * barra fluida deixava a fileira de baixo desalinhada da de cima. A contagem
 * alinhada à direita da célula é o que torna os dez números comparáveis de
 * relance, que é metade do propósito deste controle.
 *
 * Os três estados:
 *
 * - **repouso**: pastilha neutra, contagem em marinho.
 * - **ponteiro**: a pastilha inteira passa a laranja tonal.
 * - **escolhido**: laranja PREENCHIDO com escrita branca.
 *
 * O escolhido precisa do preenchimento porque hover e seleção são os dois
 * laranja: se os dois fossem tonais, passar o mouse sobre um vizinho faria dois
 * filtros parecerem ativos ao mesmo tempo. Cheio contra tonal separa os dois sem
 * inventar uma terceira cor.
 *
 * ⚠️ Ativo e hover continuam EXCLUSIVOS: somados, o realce do ponteiro apagava o
 * item escolhido. Por isso as classes de hover só existem no ramo não-ativo.
 */
export function KindFilters({
  counts,
  selected,
  onSelect,
}: {
  counts: Record<BlockerKind, number>;
  selected: BlockerKind | null;
  onSelect: (kind: BlockerKind | null) => void;
}) {
  const kinds = KIND_ORDER.filter((kind) => counts[kind] > 0);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {kinds.map((kind) => {
        const { label, icon: Icon } = KIND_META[kind];
        const active = selected === kind;

        return (
          <button
            key={kind}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? null : kind)}
            className={cn(
              /* `group` para a contagem acompanhar o hover da pastilha. */
              'group flex min-w-0 items-center gap-2 rounded-md px-3.5 py-2.5 text-left transition-colors',
              'focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2',
              active
                ? 'bg-primary-strong text-on-primary'
                : /* ⚠️ `light-container` (#F4F2EF), e não um véu preto a 5%.
                     Escolha do usuário em 08/09/2026. O véu resolvia para um
                     cinza FRIO sobre o branco do painel, que destoava do papel
                     morno do resto da tela; este é o próprio tom do papel, que
                     já existe como o poço dentro do painel claro. Token e não
                     literal: no tema escuro ele acompanha para #262626. */
                  'bg-light-container text-on-light-variant hover:bg-primary/10 hover:text-primary',
            )}
          >
            <Icon size={15} className="shrink-0" aria-hidden="true" />
            <span className="text-label-md min-w-0 flex-1 truncate normal-case">{label}</span>
            <span
              className={cn(
                'tabular shrink-0 font-semibold transition-colors',
                /* O número é o dado, então é ele que carrega a secundária.
                   No hover e no escolhido ele acompanha a pastilha. */
                active ? 'text-on-primary' : 'text-accent group-hover:text-primary',
              )}
            >
              {counts[kind]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
