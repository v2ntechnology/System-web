import { CheckCircleIcon } from '@/components/icons';
import { LightCard } from '@/management/ui';
import { useMemo, type ReactNode } from 'react';

import { sortBySeverity } from '../blockers';
import type { Blocker } from '../types';
import { BlockerRow } from './blocker-row';

/**
 * A fila de impedimentos.
 *
 * Fila **única**, ordenada por severidade: o topo é sempre o que tem de ser
 * consertado primeiro. Nenhum filtro muda essa ordem, só o que entra nela. O
 * gestor não pergunta "quantos checklists reprovaram", ele pergunta o que
 * impede o próximo caminhão de sair.
 */
export function BlockerQueue({
  blockers,
  note,
  action,
  emptyMessage = 'Nenhum impedimento aberto. A frota inteira pode rodar hoje.',
}: {
  blockers: Blocker[];
  /** Linha de contexto acima da lista, como o recorte que está em vigor. */
  note?: ReactNode | undefined;
  /** Ação do cabeçalho, como limpar o filtro. */
  action?: ReactNode | undefined;
  emptyMessage?: string | undefined;
}) {
  const ordered = useMemo(() => sortBySeverity(blockers), [blockers]);

  return (
    <LightCard title="Fila de impedimentos" action={action}>
      {note ? (
        <p className="text-on-light-muted text-label-md -mt-2 mb-3 normal-case">{note}</p>
      ) : null}

      {ordered.length === 0 ? (
        <p className="text-on-light-variant text-body-md flex items-center justify-center gap-2 py-10">
          <CheckCircleIcon size={18} aria-hidden="true" />
          {emptyMessage}
        </p>
      ) : (
        <ol className="flex flex-col">
          {ordered.map((blocker) => (
            <BlockerRow key={blocker.id} blocker={blocker} />
          ))}
        </ol>
      )}
    </LightCard>
  );
}
