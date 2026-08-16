import { useNavigate } from 'react-router';

import { StackedBrandLogo } from '@/components/shared/brand-logo';
import { TimeVortex } from '@/components/shared/time-vortex';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/stores/session-store';

export default function SessionExpiredPage() {
  const logout = useSessionStore((s) => s.logout);
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center p-6 text-center">
      {/* Fora do fluxo: a marca sobe sem deslocar o bloco central. */}
      <StackedBrandLogo
        className="absolute left-1/2 top-[7vh] -translate-x-1/2"
        markClassName="h-16 w-16"
        textClassName="h-9"
      />

      <div className="flex translate-y-12 flex-col items-center gap-8">
        <TimeVortex className="w-[clamp(14rem,40vw,20rem)]" />

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Sua sessão expirou</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Por segurança, sua sessão foi encerrada após um período de inatividade. Faça login
            novamente para continuar.
          </p>
        </div>

        <Button
          variant="brand"
          onClick={() => {
            logout();
            navigate('/', { replace: true });
          }}
        >
          Fazer login novamente
        </Button>
      </div>
    </div>
  );
}
