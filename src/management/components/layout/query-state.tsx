import { Alert, Spinner } from '@/management/ui';
import type { ReactNode } from 'react';

/**
 * Estados de carregamento e erro das páginas do painel, em um lugar só —
 * evita três variações levemente diferentes da mesma tela.
 */
export function QueryState({
  isPending,
  isError,
  label,
  children,
}: {
  isPending: boolean;
  isError: boolean;
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
