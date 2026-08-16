import { cn } from '@/management/ui';
import type { ReactNode } from 'react';

import { AppTopbar } from './app-topbar';

export interface PageBannerProps {
  /** Linha curta acima do título — localização, período, contexto. */
  eyebrow?: ReactNode | undefined;
  title: string;
  description?: string | undefined;
  /** Foto de fundo. Sem ela o banner usa só o gradiente da marca. */
  image?: string | undefined;
  /**
   * `hero`   — alto, com foto (dashboard)
   * `compact`— médio, com gradiente; o conteúdo sobe por cima
   * `inline` — só cabeçalho, título e descrição na mesma linha, sem sobreposição
   */
  size?: 'hero' | 'compact' | 'inline' | undefined;
  actions?: ReactNode | undefined;
}

/**
 * Faixa superior de todas as telas do painel: contém a navegação e identifica
 * onde o usuário está.
 *
 * O gradiente escuro não é decoração — é o que garante o contraste do título
 * sobre uma foto de conteúdo imprevisível (RNF-028).
 *
 * ⚠️ **Esta `<section>` não pode criar contexto de empilhamento** (nada de
 * `isolate`, nada de `z-*` nela). A topbar mora aqui dentro e precisa dos seus
 * `z-[1000]` valendo na página inteira — presa num contexto local, ela perdia
 * para o `PageContent` (`z-10`) e o menu suspenso ficava **atrás dos cards**, com
 * o último item impossível de clicar. É a regra 8h em ação. Por isso os fundos
 * usam `z-0` e o conteúdo `z-10`, em vez de `-z-10` sob isolamento.
 */
export function PageBanner({
  eyebrow,
  title,
  description,
  image,
  size = 'compact',
  actions,
}: PageBannerProps) {
  const isHero = size === 'hero';
  const isInline = size === 'inline';

  return (
    <section
      className={cn(
        'bg-surface-lowest relative flex flex-col',
        isHero
          ? 'min-h-[380px] sm:min-h-[440px]'
          : isInline
            ? ''
            : 'min-h-[200px] sm:min-h-[240px]',
      )}
    >
      {image ? (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="absolute inset-0 z-0 size-full object-cover object-center"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0"
          style={{
            backgroundImage:
              'radial-gradient(120% 140% at 15% 0%, rgba(99,102,241,0.35) 0%, transparent 60%), radial-gradient(100% 120% at 85% 10%, rgba(6,182,212,0.22) 0%, transparent 62%)',
          }}
        />
      )}

      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 z-0',
          image
            ? 'bg-gradient-to-b from-black/70 via-black/25 to-black/85'
            : 'bg-gradient-to-b from-black/40 via-transparent to-[color-mix(in_oklab,var(--color-background)_92%,transparent)]',
        )}
      />

      <AppTopbar />

      <div
        className={cn(
          /* `relative z-10`: os fundos são absolutos em `z-0` e, sem isto, passariam
             por cima do título — que é conteúdo de fluxo, sem posicionamento. */
          'relative z-10 mx-auto flex w-full max-w-[1600px] flex-col justify-end gap-4 px-4 sm:px-6 lg:flex-row lg:justify-between',
          /* flex-1: ancora o título na base do banner, em vez de deixá-lo boiando. */
          !isInline && 'flex-1',
          isInline ? 'lg:items-baseline' : 'lg:items-end',
          isHero
            ? 'pb-28 pt-16 sm:pb-32 sm:pt-24'
            : isInline
              ? 'pb-8 pt-6 sm:pb-10 sm:pt-8'
              : 'pb-20 pt-8 sm:pb-24 sm:pt-10',
        )}
      >
        <div
          className={cn(
            'flex min-w-0',
            /* No cabeçalho inline, título e descrição dividem a linha (Figma). */
            isInline ? 'flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-5' : 'flex-col',
          )}
        >
          {eyebrow ? (
            /*
             * Texto puro e sem ícone à esquerda: um ícone inline empurra o texto
             * uns 22px e ele deixa de alinhar com a primeira letra do título,
             * que é o que fazia o cabeçalho parecer torto.
             */
            <p className="text-on-surface-variant text-body-md mb-2">{eyebrow}</p>
          ) : null}

          <h1
            className={cn(
              'font-sora text-on-surface font-bold leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]',
              isHero ? 'max-w-4xl text-[28px] sm:text-[40px]' : 'text-[26px] sm:text-[34px]',
              !isInline && 'max-w-4xl',
            )}
          >
            {title}
          </h1>

          {description ? (
            <p
              className={cn(
                'text-on-surface-variant',
                isInline ? 'text-body-md max-w-2xl lg:pb-0.5' : 'text-body-lg mt-2 max-w-2xl',
              )}
            >
              {description}
            </p>
          ) : null}
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
