import { Alert, Spinner } from '@/management/ui';
import type { ReactNode } from 'react';

import { moduleLabel, planoQueInclui, PLAN_LABELS } from '@/app/plans';
import { PlanUpgradeError } from '@/services/http';

/**
 * Estados de carregamento e erro das páginas do painel, em um lugar só —
 * evita três variações levemente diferentes da mesma tela.
 */
export function QueryState({
  isPending,
  isError,
  error,
  label,
  children,
}: {
  isPending: boolean;
  isError: boolean;
  /**
   * A causa da falha, quando a tela tiver como passá-la.
   *
   * ⚠️ Opcional para não obrigar as telas antigas a mudar, mas é o que separa
   * "não carregou" de "o plano não cobre isto". Sem ela, um 402 vira "atualize a
   * página para tentar de novo", que é conselho inútil: atualizar devolve 402 de
   * novo, e o que resolve é contratar outro plano.
   */
  error?: unknown;
  label: string;
  children: ReactNode;
}) {
  if (isPending) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <Spinner className="text-on-surface-muted size-6" label={`Carregando ${label}`} />
      </div>
    );
  }

  if (error instanceof PlanUpgradeError) {
    const nome = moduleLabel(error.modulo) ?? 'Este recurso';
    const necessario = planoQueInclui(error.modulo);
    return (
      <div className="mx-auto max-w-md py-10">
        <Alert severity="info">
          {nome} não está incluído no plano {error.plano ?? 'atual'} da sua empresa.{' '}
          {necessario
            ? `A partir do plano ${PLAN_LABELS[necessario]} ele fica disponível.`
            : 'Fale com a RookHub para saber em qual plano ele entra.'}
        </Alert>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-md py-10">
        <Alert severity="error">
          Não foi possível carregar {label}. Atualize a página para tentar de novo.
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
