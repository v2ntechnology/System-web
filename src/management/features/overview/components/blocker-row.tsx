import { ArrowRightIcon } from '@/components/icons';
import { StatusChip, cn } from '@/management/ui';
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
 * ⚠️ A ação tem UMA forma só, para todas as linhas (08/09/2026, a pedido do
 * usuário). Ela mudava com a severidade: o que bloqueia agora vinha como botão
 * cheio e o resto como link.
 *
 * Duas razões para uniformizar. A severidade já está dita duas vezes na linha,
 * pela faixa colorida e pela etiqueta, e as duas se leem de relance melhor do
 * que a forma do controle. E, principalmente, nenhuma dessas ações decide coisa
 * alguma: "Ver checklist" e "Abrir ordem" levam para outra tela. Navegação é
 * link, e o botão cheio prometia um peso de decisão que a ação não tem.
 */
export function BlockerRow({ blocker }: { blocker: Blocker }) {
  const severity = SEVERITY_META[blocker.severity];
  const kind = KIND_META[blocker.kind];
  const KindIcon = kind.icon;

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
        <Link
          to={blocker.action.to}
          className="text-accent text-label-md focus-visible:ring-primary inline-flex items-center gap-1.5 rounded-md px-1 py-1 normal-case hover:underline focus-visible:outline-none focus-visible:ring-2"
        >
          {blocker.action.label}
          <ArrowRightIcon size={15} aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}
