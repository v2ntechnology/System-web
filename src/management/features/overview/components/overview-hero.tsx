import { CalendarIcon, ClockIcon } from '@/components/icons';
import { useSession } from '@/management/features/auth/store';

import { HeroBand, HeroPill } from '@/management/components/layout/hero-band';

/* Por extenso porque é cabeçalho: "01/09" é formato de tabela. */
const TODAY = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Sao_Paulo',
});

const HOUR = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

function greetingFor(hour: number) {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Faixa de abertura da visão geral: quem está olhando, e de quando é o dado. */
export function OverviewHero() {
  const session = useSession();
  const now = new Date();
  const firstName = session?.user.name.split(' ')[0] ?? null;

  return (
    <HeroBand
      title={`${greetingFor(now.getHours())}${firstName ? `, ${firstName}` : ''}`}
      description={`Veja quem pode rodar hoje${session ? ` na ${session.tenant.name}` : ''} e o que está travando o resto da frota.`}
    >
      <HeroPill icon={CalendarIcon}>Hoje, {TODAY.format(now)}</HeroPill>
      <HeroPill icon={ClockIcon}>Atualizado às {HOUR.format(now)}</HeroPill>
    </HeroBand>
  );
}
