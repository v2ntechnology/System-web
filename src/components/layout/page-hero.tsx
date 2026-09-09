import type { IconType } from '@/components/icons';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Faixa de abertura das telas do painel operacional.
 *
 * É a mesma peça que o dashboard desenha inline desde 09/09/2026, no molde do
 * `HeroBand` da visão geral do gestor: terracota chapada, texto branco e as
 * pastilhas de contorno claro no canto oposto. Aqui ela virou componente porque
 * passou a valer para as outras telas do `/app`.
 *
 * ⚠️ Sem rótulo acima do título: o título carrega o próprio peso, e o `eyebrow`
 * do painel de gestão nem renderiza mais.
 *
 * O respiro de baixo muda conforme a tela: com `HeroStats` embaixo, a fileira
 * sobe por cima da borda e a faixa precisa da folga para ser mordida.
 */
export function PageHero({
  title,
  description,
  children,
  bleed = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Pastilhas e atalhos, alinhados à direita no monitor. */
  children?: ReactNode | undefined;
  /** `false` fecha o respiro de baixo, para tela sem fileira de números. */
  bleed?: boolean;
}) {
  return (
    <section
      className={cn(
        'text-on-primary rounded-xl bg-primary px-6 pt-8 sm:px-8 sm:pt-10',
        bleed ? 'pb-24 sm:pb-28' : 'pb-8 sm:pb-10',
      )}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col">
          {/* `-0.03em` fecha o espaço que a Sora deixa entre maiúsculas em corpo
              grande. O piso de tracking do projeto é -0.04em. */}
          <h1 className="font-display text-[28px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[36px]">
            {title}
          </h1>
          {description ? <p className="text-body-lg mt-2 max-w-2xl">{description}</p> : null}
        </div>

        {children ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3">{children}</div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Painel de conteúdo da tela, no molde do `PageContent` do painel de gestão.
 *
 * A curva do topo é o que emenda o painel na faixa: os cards do `HeroStats`
 * sobem por cima da borda dela e descem sobre esta superfície.
 *
 * ⚠️ É uma `div`, e não `main`: o `AppShell` já abriu o `main` da página, e dois
 * `main` no documento é HTML inválido. Lá no painel de gestão o `PageContent` é
 * o `main` porque a casca de lá não abre nenhum.
 */
export function PagePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        'bg-light rounded-t-4xl mt-8 px-4 pb-16 pt-7 sm:rounded-t-[40px] sm:px-6 xl:px-10',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Pastilha da faixa, gêmea do `HeroPill` do painel de gestão.
 *
 * ⚠️ Traço branco, e não um segundo laranja: com a marca reduzida a um único
 * #D5623A, fundo e pastilha ficariam do mesmo tom.
 */
export function HeroPill({ icon: Icon, children }: { icon: IconType; children: ReactNode }) {
  return (
    <span className="text-label-md border-on-primary inline-flex items-center gap-2 rounded-md border px-3.5 py-2 normal-case">
      <Icon className="h-[15px] w-[15px]" aria-hidden />
      {children}
    </span>
  );
}

/**
 * Placa de conteúdo dentro do `PagePanel`, no molde do `LightCard` do painel de
 * gestão: `bg-light` com traço externo e a sombra rasa.
 *
 * ⚠️ Não é o `Card` de `components/ui`. Aquele é da família `surface`, que é a
 * do papel do painel operacional; dentro do painel branco ele some contra o
 * fundo. Card sobre esta superfície usa `light`.
 */
export function LightCard({
  title,
  action,
  description,
  children,
  className,
}: {
  title?: ReactNode;
  /** Canto oposto ao título: chip de status, botão, atalho. */
  action?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section
      className={cn(
        'bg-light ring-light-edge flex min-w-0 flex-col rounded-xl p-6 shadow-[0_1px_2px_rgba(28,26,24,0.04),0_8px_24px_-12px_rgba(28,26,24,0.14)] ring-1 sm:p-7',
        className,
      )}
    >
      {title || action ? (
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-on-light text-headline-md tracking-[-0.02em]">
              {title}
            </h2>
            {description ? (
              <p className="text-on-light-muted text-label-md mt-1 normal-case">{description}</p>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

export interface HeroStat {
  key: string;
  label: string;
  value: string | number;
  /** Uma linha do que o número quer dizer para quem está olhando. */
  hint?: string | undefined;
  icon: IconType;
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
 * Os números de abertura da tela, em cards que encostam na faixa.
 *
 * Um card por número, e não um card com quatro caixas dentro: a moldura externa
 * fazia o indicador parecer campo de formulário.
 *
 * ⚠️ A fileira SOBE por cima da faixa, e é isso que emenda as duas: a margem
 * negativa e o `z-10` moram aqui, e o `pb` da `PageHero` existe para recebê-la.
 * Mexeu numa, confira a outra.
 */
export function HeroStats({
  items,
  className,
}: {
  items: HeroStat[];
  className?: string | undefined;
}) {
  return (
    <dl
      className={cn(
        'relative z-10 -mt-16 grid grid-cols-2 gap-4 sm:-mt-20 sm:grid-cols-3',
        items.length >= 6
          ? 'xl:grid-cols-6'
          : items.length === 5
            ? 'xl:grid-cols-5'
            : 'xl:grid-cols-4',
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
                'font-display mt-1 text-[30px] font-bold leading-none tabular-nums',
                VALUE[tone],
              )}
            >
              {item.value}
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
