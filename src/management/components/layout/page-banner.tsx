import { cn } from '@/management/ui';
import type { ReactNode } from 'react';

import coverImage from '@imgs/truck01.jpg';

import { AppTopbar } from './app-topbar';

export interface PageBannerProps {
  /** Linha curta acima do título — localização, período, contexto. */
  eyebrow?: ReactNode | undefined;
  title: string;
  description?: string | undefined;
  /**
   * Foto de fundo. Sem ela vale a capa padrão da operação, que é o que mantém
   * todas as telas do painel com a mesma faixa superior.
   */
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
        /* A faixa é escura nos dois temas, com foto ou sem: é ela que sustenta a
           barra de navegação e o título, ambos brancos. Com a rampa clara embaixo,
           o texto sumia no próprio banner. */
        'bg-brand-night relative flex flex-col',
        /* O cabeçalho inline tem a mesma altura de capa da visão geral: é o
           desenho que o painel inteiro segue, e uma faixa mais baixa mostrava
           só uma tira da foto. */
        isHero || isInline ? 'min-h-[380px] sm:min-h-[440px]' : 'min-h-[200px] sm:min-h-[240px]',
      )}
    >
      <img
        src={image ?? coverImage}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        className="absolute inset-0 z-0 size-full object-cover object-center"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-gradient-to-b from-black/70 via-black/25 to-black/85"
      />

      <AppTopbar />

      <div
        className={cn(
          /* `relative z-10`: os fundos são absolutos em `z-0` e, sem isto, passariam
             por cima do título — que é conteúdo de fluxo, sem posicionamento. */
          /* `flex-1` ancora o título na base da faixa, em vez de deixá-lo boiando. */
          'relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-end gap-4 px-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between',
          isHero
            ? 'pb-28 pt-16 sm:pb-32 sm:pt-24'
            : isInline
              ? /* Menor que o hero porque o degrau abaixo já reserva 48px/64px: o
                   título encosta na base da foto, como na visão geral. */
                'pb-10 pt-16 sm:pb-12 sm:pt-24'
              : 'pb-20 pt-8 sm:pb-24 sm:pt-10',
        )}
      >
        <div className="flex min-w-0 flex-col">
          {eyebrow ? (
            /*
             * Texto puro e sem ícone à esquerda: um ícone inline empurra o texto
             * uns 22px e ele deixa de alinhar com a primeira letra do título,
             * que é o que fazia o cabeçalho parecer torto.
             */
            <p className="text-on-media-variant text-body-md mb-2">{eyebrow}</p>
          ) : null}

          <h1
            className={cn(
              'font-sora text-on-media max-w-4xl font-bold leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]',
              isHero ? 'text-[28px] sm:text-[40px]' : 'text-[26px] sm:text-[34px]',
            )}
          >
            {title}
          </h1>

          {description ? (
            <p className="text-on-media-variant text-body-lg mt-2 max-w-2xl">{description}</p>
          ) : null}
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
      </div>

      {isInline ? (
        /*
         * Degrau que repete a sobreposição do `PageContent` das telas de visão
         * geral: a faixa termina na curva do conteúdo, e os blocos ganham o
         * mesmo respiro em vez de encostarem na foto.
         *
         * Aqui a faixa reserva o espaço em vez de o conteúdo subir por cima,
         * porque estas telas trazem várias seções irmãs e um segundo
         * `PageContent` significaria um segundo `<main>` na mesma página.
         * `bg-background` é a cor do conteúdo (mesmo valor de `surface`).
         */
        <div
          aria-hidden="true"
          className="rounded-t-4xl bg-background relative z-10 h-12 w-full sm:h-16 sm:rounded-t-[40px]"
        />
      ) : null}
    </section>
  );
}
