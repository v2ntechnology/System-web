import { ApprovalIcon, ArrowRightIcon, ClockIcon } from '@/components/icons';
import { LightCard, SpectrumButton } from '@/management/ui';
import { Link } from 'react-router';

import { DIAGNOSES_PATH, RELEASES_PATH } from '../paths';
import type { ManagerDecisions } from '../types';
import { SummaryCounts, type CountItem } from './summary-counts';

/**
 * O que está esperando uma decisão sua.
 *
 * ⚠️ Não é a fila de impedimentos, e por isso vem antes dela. Impedimento é o
 * que a plataforma **detecta**; isto é o que ela está esperando de você, e cada
 * pedido parado na fila é um caminhão parado no pátio. Por isso a espera do
 * pedido mais antigo aparece em cima: é a medida do custo de não decidir.
 *
 * "Com o proprietário" fica junto para separar "não decidi" de "não é minha
 * decisão": ocorrência grave sai da alçada do gestor e sobe para o dono.
 */
export function DecisionsCard({ decisions }: { decisions: ManagerDecisions }) {
  const items: CountItem[] = [
    {
      key: 'releases',
      label: 'Liberações na fila',
      value: decisions.pendingReleases,
      tone: decisions.pendingReleases > 0 ? 'attention' : 'neutral',
      hint: 'ativo parado esperando você',
    },
    {
      key: 'owner',
      label: 'Com o proprietário',
      value: decisions.awaitingOwner,
      tone: 'neutral',
      hint: 'graves, fora da sua alçada',
    },
    {
      key: 'diagnoses',
      label: 'Pareceres em aberto',
      value: decisions.openDiagnoses,
      tone: decisions.openDiagnoses > 0 ? 'attention' : 'neutral',
      hint: 'anomalias sem explicação escrita',
    },
  ];

  return (
    <LightCard
      title="Decisões suas"
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SpectrumButton asChild size="sm">
            <Link to={RELEASES_PATH}>
              Tratar liberações
              <ArrowRightIcon size={16} aria-hidden="true" />
            </Link>
          </SpectrumButton>
          <SpectrumButton asChild variant="ghost" size="sm">
            <Link to={DIAGNOSES_PATH}>
              <ApprovalIcon size={16} aria-hidden="true" />
              Pareceres
            </Link>
          </SpectrumButton>
        </div>
      }
    >
      {decisions.pendingReleases > 0 ? (
        <p className="text-on-light-variant text-body-md -mt-2 mb-5 flex items-start gap-2">
          <ClockIcon size={16} className="mt-1 shrink-0" aria-hidden="true" />O pedido mais antigo
          espera há {decisions.oldestWaitHours} h.
        </p>
      ) : (
        <p className="text-on-light-variant text-body-md -mt-2 mb-5">
          Nenhum pedido esperando decisão.
        </p>
      )}

      <SummaryCounts items={items} />
    </LightCard>
  );
}
