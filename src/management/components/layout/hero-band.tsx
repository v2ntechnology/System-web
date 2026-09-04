import type { IconType } from '@/components/icons';
import { cn } from '@/management/ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { AppTopbar } from './app-topbar';

/**
 * Faixa colorida de abertura da tela.
 *
 * ⚠️ Só aqui, e de propósito: é o indigo da marca chapado (`bg-primary`, o
 * #6366F1 de `palette.css`), que nenhuma outra tela do painel usa como fundo.
 *
 * A cor é a mesma nos dois temas, então o texto é branco (`on-primary`) sempre,
 * e o que for pequeno fica sobre `primary-strong`: o mesmo indigo um degrau mais
 * escuro, que é o que devolve o contraste do texto miúdo sobre a cor.
 *
 * O respiro de baixo é maior que o de cima porque é ali que os cards da tela
 * encostam, subindo por cima da borda.
 *
 * ⚠️ A topbar mora aqui dentro, **fora** do indigo, sobre o papel: ela tem marca,
 * menu e avatar pintados com os tokens do tema, e sobre a faixa saturada nada
 * disso se lê. Quem usa `HeroBand` não usa `PageBanner`: os dois são o
 * cabeçalho da página, e o título apareceria duas vezes.
 */
export function HeroBand({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  /** Pastilhas e atalhos, alinhados à direita no monitor. */
  children?: ReactNode | undefined;
}) {
  return (
    <section className="bg-surface flex flex-col">
      <AppTopbar />

      <div className="bg-primary text-on-primary px-4 pb-24 pt-8 sm:px-6 sm:pb-28 sm:pt-10 xl:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col">
            {/* `-0.03em` fecha o espaço que a Sora deixa entre maiúsculas em
                corpo grande. O piso de tracking do projeto é -0.04em. */}
            <h1 className="font-sora text-[28px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[36px]">
              {title}
            </h1>
            <p className="text-body-lg mt-2 max-w-2xl">{description}</p>
          </div>

          {children ? (
            <div className="flex shrink-0 flex-wrap items-center gap-3">{children}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const PILL = 'rounded-pill text-label-md inline-flex items-center gap-2 px-3.5 py-2 normal-case';

export function HeroPill({ icon: Icon, children }: { icon: IconType; children: ReactNode }) {
  return (
    <span className={cn(PILL, 'bg-primary-strong')}>
      <Icon size={15} aria-hidden="true" />
      {children}
    </span>
  );
}

/** Mesma pastilha, quando ela leva a algum lugar. */
export function HeroLink({
  to,
  icon: Icon,
  children,
}: {
  to: string;
  icon: IconType;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        PILL,
        'bg-primary-strong hover:bg-[color-mix(in_oklab,var(--color-primary-strong)_86%,black)]',
        'focus-visible:ring-on-primary transition-colors focus-visible:outline-none focus-visible:ring-2',
      )}
    >
      <Icon size={15} aria-hidden="true" />
      {children}
    </Link>
  );
}
