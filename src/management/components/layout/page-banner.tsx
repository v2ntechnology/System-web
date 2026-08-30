import { cn } from '@/management/ui';
import type { ReactNode } from 'react';

import { AppTopbar } from './app-topbar';

export interface PageBannerProps {
  /**
   * @deprecated Não renderiza mais nada.
   *
   * A linha curta acima do título saiu no redesign de 30/08/2026. A prop
   * continua aceita para não quebrar as 25 telas de uma vez, e some quando a
   * última delas parar de passá-la.
   */
  eyebrow?: ReactNode | undefined;
  title: string;
  description?: string | undefined;
  /**
   * @deprecated Não renderiza mais nada. Ver a nota sobre a foto no cabeçalho
   * do componente.
   */
  image?: string | undefined;
  /**
   * `hero`   — a tela de abertura de cada perfil, com mais respiro no título
   * `compact`— cabeçalho enxuto
   * `inline` — o mesmo que `compact`; existia para acertar a sobreposição do
   *            `PageContent` sobre a foto, e sem foto os dois são iguais
   */
  size?: 'hero' | 'compact' | 'inline' | undefined;
  actions?: ReactNode | undefined;
}

/**
 * Faixa superior de todas as telas do painel: navegação e onde o usuário está.
 *
 * <h2>A foto saiu</h2>
 *
 * ⚠️ Decisão do usuário em 30/08/2026, e reverte a de 19/08/2026 que mandava a
 * capa aparecer em todas as telas. Sai junto tudo que existia por causa dela: a
 * faixa `bg-brand-night`, o gradiente preto de 70%, a `drop-shadow` no título e
 * o degrau `rounded-t-4xl` que emendava a foto no conteúdo.
 *
 * O motivo é de ferramenta, não de gosto. A foto ocupava 440px de altura em
 * **toda** tela do painel, inclusive nas que são uma tabela de 150 linhas: quem
 * trabalha aqui o dia inteiro rolava uma tela e meia de caminhão antes de chegar
 * ao dado. Ela também obrigava o menu inteiro a ser branco fixo (`on-media`),
 * porque flutuava sobre a foto escura, o que travava a tela num contraste que
 * só funcionava com a foto ali.
 *
 * <h2>O que sustenta o cabeçalho agora</h2>
 *
 * O papel. O cabeçalho é a mesma superfície do resto da tela (`bg-surface`), o
 * título é o texto mais pesado da página, e o item ativo do menu é uma pastilha
 * preta. Sem faixa escura, sem sombra no texto, sem véu.
 *
 * ⚠️ **Esta `<section>` continua sem poder criar contexto de empilhamento**
 * (nada de `isolate`, nada de `z-*` nela). A topbar mora aqui dentro e precisa
 * dos seus `z-[1000]` valendo na página inteira. Presa num contexto local, ela
 * perdia para o `PageContent` (`z-10`) e o menu suspenso ficava atrás dos cards,
 * com o último item impossível de clicar.
 */
export function PageBanner({ title, description, size = 'compact', actions }: PageBannerProps) {
  const isHero = size === 'hero';

  return (
    <section className="bg-surface relative flex flex-col">
      <AppTopbar />

      <div
        className={cn(
          /* `relative z-10` continua necessário: o menu suspenso da topbar sai
             por cima deste bloco, e sem a camada explícita o título ficava
             recebendo o clique que era do último item do menu. */
          'relative z-10 flex w-full flex-col gap-5 px-4 sm:px-6 xl:px-10 lg:flex-row lg:items-end lg:justify-between',
          /* Mais espaço acima do título do que abaixo: o cabeçalho pertence ao
             conteúdo que vem depois dele, não à barra que vem antes. */
          isHero ? 'pb-8 pt-10 sm:pb-10 sm:pt-14' : 'pb-7 pt-9 sm:pb-8 sm:pt-12',
        )}
      >
        <div className="flex min-w-0 flex-col">
          <h1
            className={cn(
              /* `-0.03em` fecha o espaço que a Sora deixa entre maiúsculas em
                 corpo grande. O piso de tracking do projeto é -0.04em. */
              'font-sora text-on-surface max-w-4xl font-bold leading-[1.08] tracking-[-0.03em]',
              isHero ? 'text-[34px] sm:text-[46px]' : 'text-[30px] sm:text-[38px]',
            )}
          >
            {title}
          </h1>

          {description ? (
            <p className="text-on-surface-variant text-body-lg mt-3 max-w-2xl">{description}</p>
          ) : null}
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
