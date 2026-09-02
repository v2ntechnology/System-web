import { ArrowUpRightIcon, ShieldAlertIcon } from '@/components/icons';
import { LightCard, SpectrumButton } from '@/management/ui';
import { Link } from 'react-router';

import { SAFETY_PATH } from '../paths';
import { SAFETY_TYPE_META, rateHint } from '../safety';
import type { SafetySnapshot } from '../types';
import { SummaryCounts, type CountItem } from './summary-counts';

/**
 * Segurança na janela curta, dentro da visão geral.
 *
 * ⚠️ Resumo, e não a tela de segurança: evento, vídeo, contestação e copiloto
 * continuam em `/gestao/seguranca`, que não foi tocada. Aqui entram só os
 * números que mudam a decisão do dia, porque um caminhão liberado com um
 * motorista em sonolência é liberação errada, e isso pertence à mesma leitura
 * dos impedimentos.
 *
 * A taxa por mil km vem junto da contagem de propósito: a contagem dimensiona a
 * fila, a taxa diz se a frota melhorou ou piorou.
 */
export function SafetySummaryCard({ safety }: { safety: SafetySnapshot }) {
  const items: CountItem[] = [
    {
      key: 'critical',
      label: 'Eventos críticos',
      value: safety.criticalEvents,
      tone: 'critical',
      hint: safety.windowLabel,
    },
    {
      key: 'attention',
      label: 'Em atenção',
      value: safety.attentionEvents,
      tone: 'attention',
      hint: 'acompanhar sem travar a saída',
    },
    {
      key: 'contests',
      label: 'Contestações',
      value: safety.pendingContests,
      tone: 'neutral',
      hint: 'aguardando sua decisão',
    },
  ];

  return (
    <LightCard
      title="Segurança"
      action={
        <SpectrumButton asChild variant="ghost" size="sm">
          <Link to={SAFETY_PATH}>
            Ver segurança
            <ArrowUpRightIcon size={16} aria-hidden="true" />
          </Link>
        </SpectrumButton>
      }
    >
      <p className="text-on-light-variant text-body-md -mt-2 mb-5 flex items-start gap-2">
        <ShieldAlertIcon size={16} className="mt-1 shrink-0" aria-hidden="true" />
        {rateHint(safety.perThousandKm, safety.perThousandKmPrevious)}
      </p>

      <SummaryCounts items={items} />

      {/* Os tipos com o mesmo tratamento dos impedimentos: um desenho por
          assunto, para reconhecer sem ler. */}
      <div className="mt-5 flex flex-wrap gap-2">
        {safety.byType.map(({ type, count }) => {
          const { label, icon: Icon } = SAFETY_TYPE_META[type];

          return (
            <span
              key={type}
              className="bg-on-light/[0.05] text-on-light-variant text-label-md inline-flex items-center gap-2 rounded-lg px-3 py-2 normal-case"
            >
              <Icon size={16} className="shrink-0" aria-hidden="true" />
              {label}
              <span className="tabular font-sora text-on-light font-bold">{count}</span>
            </span>
          );
        })}
      </div>
    </LightCard>
  );
}
