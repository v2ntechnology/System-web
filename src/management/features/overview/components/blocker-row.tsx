import { ArrowRightIcon } from '@/components/icons';
import { SpectrumButton, StatusChip, cn } from '@/management/ui';
import { Link } from 'react-router';

import { KIND_META, SEVERITY_META } from '../blockers';
import type { Blocker } from '../types';

/**
 * Uma linha da fila de impedimentos.
 *
 * O tipo é etiqueta dentro do item, e não uma coluna nem um card próprio: fila
 * única é o ponto da faixa, e separar por categoria devolveria ao gestor o
 * trabalho de comparar quatro listas para achar o que trava primeiro.
 *
 * A ação primária muda de forma com a severidade, de propósito. O que bloqueia
 * agora vem como botão cheio, porque é decisão de hoje; os outros vêm como link,
 * que pesa menos sem deixar de ser clicável.
 */
export function BlockerRow({ blocker }: { blocker: Blocker }) {
  const severity = SEVERITY_META[blocker.severity];
  const kind = KIND_META[blocker.kind];
  const KindIcon = kind.icon;
  const blocksNow = blocker.severity === 'BLOQUEIA_AGORA';

  return (
    <li className="border-light-outline flex items-stretch gap-4 border-b py-4 last:border-b-0">
      {/* Faixa de severidade: a cor repete o chip, nunca substitui o texto dele. */}
      <span className={cn('w-1 shrink-0 rounded-full', severity.rail)} aria-hidden="true" />

      <span className="bg-on-light/[0.06] text-on-light-variant mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded-md sm:flex">
        <KindIcon size={18} aria-hidden="true" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular font-sora text-on-light text-body-lg font-bold tracking-[-0.01em]">
            {blocker.plate}
          </span>
          <StatusChip tone={severity.tone} surface="light">
            {severity.label}
          </StatusChip>
          <StatusChip surface="light" icon={<KindIcon size={13} aria-hidden="true" />}>
            {kind.label}
          </StatusChip>
        </div>

        <p className="text-on-light-variant text-body-md">{blocker.description}</p>

        {blocker.driverName ? (
          <p className="text-on-light-muted text-label-sm normal-case">
            Motorista: {blocker.driverName}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center">
        {blocksNow ? (
          <SpectrumButton asChild size="sm">
            <Link to={blocker.action.to}>
              {blocker.action.label}
              <ArrowRightIcon size={16} aria-hidden="true" />
            </Link>
          </SpectrumButton>
        ) : (
          <Link
            to={blocker.action.to}
            className="text-primary-on-light text-label-md focus-visible:ring-secondary inline-flex items-center gap-1.5 rounded-md px-1 py-1 normal-case hover:underline focus-visible:outline-none focus-visible:ring-2"
          >
            {blocker.action.label}
            <ArrowRightIcon size={15} aria-hidden="true" />
          </Link>
        )}
      </div>
    </li>
  );
}
