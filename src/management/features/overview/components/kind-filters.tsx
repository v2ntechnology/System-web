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
 * ⚠️ A pastilha ativa é preta, e nunca indigo (o indigo é de ação e link). Ativo
 * e hover são exclusivos: somados, o realce do ponteiro apagava o item escolhido.
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
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
              'flex min-w-0 items-center gap-3 rounded-lg px-3.5 py-3 text-left transition-colors',
              'focus-visible:ring-secondary focus-visible:outline-none focus-visible:ring-2',
              active
                ? 'bg-on-surface text-surface'
                : 'bg-on-surface/[0.05] text-on-surface hover:bg-on-surface/[0.09]',
            )}
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-md',
                active ? 'bg-surface/15' : 'bg-on-surface/[0.06]',
              )}
              aria-hidden="true"
            >
              <Icon size={17} />
            </span>

            <span className="flex min-w-0 flex-col">
              <span className="text-label-md truncate normal-case">{label}</span>
              <span className="tabular font-sora text-body-md font-bold leading-tight">
                {counts[kind]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
