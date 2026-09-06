import type { ReactNode } from 'react';

import { HeroBand } from '@/management/components/layout/hero-band';
import { useSession } from '@/management/features/auth/store';

/**
 * A saudação é a mesma do `overview-hero` do gestor, e está repetida de
 * propósito: são quatro linhas, e centralizá-las obrigaria um dos dois slices a
 * importar do outro só por causa disso.
 */
function greetingFor(hour: number) {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Faixa de abertura da visão do proprietário.
 *
 * Mesmo cabeçalho da visão geral do gestor, de propósito: as duas são a home de
 * `/gestao`, e o dono que abre o painel precisa reconhecer a tela que o gestor
 * dele descreve. O que muda é a frase e o que vai nas pastilhas, porque a
 * pergunta do dono é outra: quanto sobrou, e o que espera decisão dele.
 *
 * A foto saiu junto com o `PageBanner`: quem usa `HeroBand` não usa os dois,
 * senão o título aparece duas vezes.
 */
export function OwnerHero({
  description,
  children,
}: {
  description: ReactNode;
  /** Pastilhas e atalhos, alinhados à direita no monitor. */
  children?: ReactNode | undefined;
}) {
  const session = useSession();
  const firstName = session?.user.name.split(' ')[0] ?? null;

  return (
    <HeroBand
      title={`${greetingFor(new Date().getHours())}${firstName ? `, ${firstName}` : ''}`}
      description={description}
    >
      {children}
    </HeroBand>
  );
}
