import { ArrowRightIcon } from '@/components/icons';
import { LightCard, SpectrumButton } from '@/management/ui';
import { useMemo } from 'react';
import { Link } from 'react-router';

import { TRIPS_PATH } from '../paths';
import type { ActiveTrip } from '../types';
import { SummaryCounts, type CountItem } from './summary-counts';

/**
 * Faixa 3: quantas viagens estão na estrada e quantas já furaram a previsão.
 *
 * Mesmo desenho do card de impedimentos, de propósito: número no card, lista na
 * tela do assunto. A ação aqui é `ghost` porque a faixa fecha a página e não
 * pode competir com os impedimentos.
 */
export function TripsSummaryCard({ trips }: { trips: ActiveTrip[] }) {
  const delayed = useMemo(() => trips.filter((trip) => trip.delayMinutes > 0).length, [trips]);

  const items: CountItem[] = [
    {
      key: 'total',
      label: 'Em andamento',
      value: trips.length,
      tone: 'neutral',
      hint: 'viagens na estrada agora',
    },
    {
      key: 'onTime',
      label: 'No prazo',
      value: trips.length - delayed,
      tone: 'positive',
      hint: 'dentro da previsão de chegada',
    },
    {
      key: 'delayed',
      label: 'Atrasadas',
      value: delayed,
      tone: 'critical',
      hint: 'cliente precisa ser avisado',
    },
  ];

  return (
    <LightCard
      title="Viagens em andamento"
      action={
        <SpectrumButton asChild variant="ghost">
          <Link to={TRIPS_PATH}>
            Ver viagens
            <ArrowRightIcon size={16} aria-hidden="true" />
          </Link>
        </SpectrumButton>
      }
    >
      {/* Na coluna estreita do monitor as três placas ficam uma sobre a outra:
          lado a lado, o número de 30px encostava no rótulo. */}
      <SummaryCounts items={items} className="xl:grid-cols-1" />
    </LightCard>
  );
}
