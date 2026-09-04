import { cn } from '@/management/ui';

export type CountTone = 'critical' | 'attention' | 'neutral' | 'positive';

export interface CountItem {
  key: string;
  label: string;
  value: number;
  tone: CountTone;
  /** Uma linha do que aquele número quer dizer para quem despacha. */
  hint: string;
}

/*
 * Tokens `on-light`: estas placas moram dentro de um `LightCard`, e os
 * semânticos da marca são claros demais para o papel.
 */
const TONE_TEXT: Record<CountTone, string> = {
  critical: 'text-error-on-light',
  attention: 'text-warning-on-light',
  neutral: 'text-on-light',
  positive: 'text-success-on-light',
};

const TONE_SURFACE: Record<CountTone, string> = {
  critical: 'bg-error-on-light/[0.07]',
  attention: 'bg-warning-on-light/[0.07]',
  neutral: 'bg-on-light/[0.04]',
  positive: 'bg-success-on-light/[0.07]',
};

/**
 * Placas de contagem no topo de um painel.
 *
 * O card da visão geral é só o número: quem quiser a lista clica no botão e vai
 * para a tela do assunto. O número é grande e em `tabular` para que as três
 * colunas alinhem.
 */
export function SummaryCounts({
  items,
  size = 'md',
  className,
}: {
  items: CountItem[];
  /** `lg` na faixa principal da tela, onde o número é o conteúdo do card. */
  size?: 'md' | 'lg' | undefined;
  className?: string | undefined;
}) {
  return (
    <dl className={cn('grid gap-3 sm:grid-cols-3', className)}>
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            'min-w-0 rounded-lg',
            size === 'lg' ? 'px-5 py-5' : 'px-4 py-3',
            TONE_SURFACE[item.tone],
          )}
        >
          <dt className="text-on-light-variant text-label-sm normal-case">{item.label}</dt>
          <dd
            className={cn(
              'tabular font-sora mt-2 font-bold leading-none',
              size === 'lg' ? 'text-[48px]' : 'text-[30px]',
              TONE_TEXT[item.tone],
            )}
          >
            {item.value}
          </dd>
          <p className="text-on-light-muted text-label-sm mt-1.5 normal-case">{item.hint}</p>
        </div>
      ))}
    </dl>
  );
}
