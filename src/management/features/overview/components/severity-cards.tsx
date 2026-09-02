import { BlockedIcon, ClockCountdownIcon, EyeOffIcon, type IconType } from '@/components/icons';
import { cn } from '@/management/ui';

import { SEVERITY_META, SEVERITY_ORDER } from '../blockers';
import type { BlockerSeverity } from '../types';

const ICON: Record<BlockerSeverity, IconType> = {
  BLOQUEIA_AGORA: BlockedIcon,
  BLOQUEIA_EM_BREVE: ClockCountdownIcon,
  SEM_VISIBILIDADE: EyeOffIcon,
};

const ACCENT: Record<BlockerSeverity, { tile: string; value: string }> = {
  BLOQUEIA_AGORA: {
    tile: 'bg-error-on-light/10 text-error-on-light',
    value: 'text-error-on-light',
  },
  BLOQUEIA_EM_BREVE: {
    tile: 'bg-warning-on-light/12 text-warning-on-light',
    value: 'text-warning-on-light',
  },
  SEM_VISIBILIDADE: {
    tile: 'bg-on-light/[0.06] text-on-light-variant',
    value: 'text-on-light',
  },
};

/**
 * Os três degraus da fila, em cards que encostam na faixa indigo.
 *
 * Cada card é um filtro: clicar deixa na fila só aquele degrau, e clicar de novo
 * devolve a fila inteira. ⚠️ Estado ativo e hover são exclusivos: somados, o
 * realce do ponteiro apagava o anel do card escolhido.
 */
export function SeverityCards({
  counts,
  selected,
  onSelect,
}: {
  counts: Record<BlockerSeverity, number>;
  selected: BlockerSeverity | null;
  onSelect: (severity: BlockerSeverity | null) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {SEVERITY_ORDER.map((severity) => {
        const meta = SEVERITY_META[severity];
        const accent = ACCENT[severity];
        const Icon = ICON[severity];
        const active = selected === severity;

        return (
          <button
            key={severity}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? null : severity)}
            className={cn(
              'bg-light min-w-0 rounded-xl p-5 text-left ring-1',
              'shadow-[0_1px_2px_rgba(28,26,24,0.04),0_8px_24px_-12px_rgba(28,26,24,0.14)]',
              'focus-visible:ring-secondary transition-shadow focus-visible:outline-none focus-visible:ring-2',
              active ? 'ring-on-light ring-2' : 'ring-light-edge hover:ring-on-light/25',
            )}
          >
            <span
              className={cn('flex size-9 items-center justify-center rounded-md', accent.tile)}
              aria-hidden="true"
            >
              <Icon size={17} />
            </span>

            <p className="text-on-light-variant text-label-sm mt-4 normal-case">{meta.label}</p>

            <p
              className={cn(
                'tabular font-sora mt-1 text-[32px] font-bold leading-none',
                accent.value,
              )}
            >
              {counts[severity]}
            </p>

            <p className="text-on-light-muted text-label-sm mt-1.5 normal-case">{meta.hint}</p>
          </button>
        );
      })}
    </div>
  );
}
