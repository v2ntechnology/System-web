import { ArrowRightIcon } from '@/components/icons';
import { LightCard, SpectrumButton } from '@/management/ui';
import { useMemo } from 'react';
import { Link } from 'react-router';

import { SEVERITY_META, SEVERITY_ORDER, countBySeverity } from '../blockers';
import { BLOCKERS_PATH } from '../paths';
import type { Blocker, BlockerSeverity } from '../types';
import { SummaryCounts, type CountItem } from './summary-counts';

/* O tom da placa de contagem. Separado do `StatusTone` do chip de propósito:
   aqui só existem os três degraus da fila. */
const COUNT_TONE: Record<BlockerSeverity, CountItem['tone']> = {
  BLOQUEIA_AGORA: 'critical',
  BLOQUEIA_EM_BREVE: 'attention',
  SEM_VISIBILIDADE: 'neutral',
};

/**
 * Faixa 2: o tamanho de cada degrau de impedimento, e a porta para a fila.
 *
 * Na visão geral o card é **só número**: a pergunta da tela é quantos caminhões
 * estão travados e por qual motivo, não qual placa é qual. Quem precisa tratar
 * caso a caso vai para a tela de impedimentos pelo botão, que é a única ação
 * cheia da página inteira.
 */
export function BlockersSummaryCard({ blockers }: { blockers: Blocker[] }) {
  const counts = useMemo(() => countBySeverity(blockers), [blockers]);

  const items: CountItem[] = SEVERITY_ORDER.map((severity) => ({
    key: severity,
    label: SEVERITY_META[severity].label,
    value: counts[severity],
    tone: COUNT_TONE[severity],
    hint: SEVERITY_META[severity].hint,
  }));

  return (
    <LightCard
      title="Impedimentos"
      action={
        <SpectrumButton asChild>
          <Link to={BLOCKERS_PATH}>
            Ver impedimentos
            <ArrowRightIcon size={16} aria-hidden="true" />
          </Link>
        </SpectrumButton>
      }
    >
      <p className="text-on-light-variant text-body-md -mt-2 mb-5">
        {blockers.length === 0
          ? 'Nenhum impedimento aberto. A frota inteira pode rodar hoje.'
          : `${blockers.length} impedimentos abertos, do que trava a saída agora ao que ainda não dá para afirmar.`}
      </p>

      <SummaryCounts items={items} size="lg" />
    </LightCard>
  );
}
