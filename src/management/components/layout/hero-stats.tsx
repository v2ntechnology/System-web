import type { IconType } from '@/components/icons';
import { cn } from '@/management/ui';

export interface HeroStat {
  key: string;
  label: string;
  value: string | number;
  /** Uma linha do que o número quer dizer para quem está olhando. */
  hint?: string | undefined;
  icon: IconType;
  /** Denominador, quando o número é parte de um todo. */
  outOf?: number | undefined;
  /** `warn` pinta o número; `alert` pinta e contorna o card. */
  tone?: 'neutral' | 'warn' | 'alert' | undefined;
}

/* Tokens `on-light`: os cards são placas claras, e os semânticos da marca são
   claros demais para o papel. */
const TILE = {
  neutral: 'bg-primary-on-light/10 text-primary-on-light',
  warn: 'bg-warning-on-light/12 text-warning-on-light',
  alert: 'bg-error-on-light/10 text-error-on-light',
} as const;

const VALUE = {
  neutral: 'text-on-light',
  warn: 'text-warning-on-light',
  alert: 'text-error-on-light',
} as const;

/**
 * Os números de abertura de uma tela, em cards que encostam na faixa colorida.
 *
 * Um card por número, e não um card com quatro caixas dentro: a moldura
 * externa fazia o indicador parecer campo de formulário, e a placa branca sobre
 * o papel já separa cada um do seguinte.
 *
 * O `HeroBand` deixa o respiro de baixo justamente para esta fileira subir por
 * cima da borda dele. Quem usa aplica a margem negativa (`-mt-16 sm:-mt-20`).
 */
export function HeroStats({ items, className }: { items: HeroStat[]; className?: string }) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-4 sm:grid-cols-3',
        items.length >= 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4',
        className,
      )}
    >
      {items.map((item) => {
        const tone = item.tone ?? 'neutral';
        const Icon = item.icon;

        return (
          <div
            key={item.key}
            className={cn(
              'bg-light min-w-0 rounded-xl p-5 ring-1',
              'shadow-[0_1px_2px_rgba(28,26,24,0.04),0_8px_24px_-12px_rgba(28,26,24,0.14)]',
              tone === 'alert' ? 'ring-error-on-light/30' : 'ring-light-edge',
            )}
          >
            <span
              className={cn('flex size-9 items-center justify-center rounded-md', TILE[tone])}
              aria-hidden="true"
            >
              <Icon size={17} />
            </span>

            <dt className="text-on-light-variant text-label-sm mt-4 normal-case">{item.label}</dt>

            <dd
              className={cn(
                'tabular font-sora mt-1 text-[30px] font-bold leading-none',
                VALUE[tone],
              )}
            >
              {item.value}
              {item.outOf ? (
                <span className="text-on-light-muted text-body-md font-normal">
                  {' '}
                  / {item.outOf}
                </span>
              ) : null}
            </dd>

            {item.hint ? (
              <p className="text-on-light-muted text-label-sm mt-1.5 normal-case">{item.hint}</p>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}
