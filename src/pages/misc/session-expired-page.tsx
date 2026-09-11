import { useNavigate } from 'react-router';

import { StackedBrandLogo } from '@/components/shared/brand-logo';
import { TimeVortex } from '@/components/shared/time-vortex';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/stores/session-store';

export default function SessionExpiredPage() {
  const logout = useSessionStore((s) => s.logout);
  const navigate = useNavigate();

  /*
   * ⚠️ Cabe na janela sem rolagem, pela `.tela-proporcional`, a pedido do
   * usuário em 10/09/2026. A referência de 720px sai de MEDIÇÃO, e não de
   * gosto: o vórtice com o texto e o botão ocupa 676px de altura natural, e o resto é folga.
   *
   * O `min-h` saiu junto porque a classe já define a altura exata da janela, e
   * manter os dois deixaria duas fontes para a mesma medida.
   *
   * ⚠️ Mexeu no conteúdo? Meça de novo com o zoom desligado. Passando da
   * referência, a tela começa a ser CORTADA, porque a classe usa
   * `overflow: hidden`.
   */
  return (
    <div className="tela-proporcional [--altura-de-referencia:720px] relative flex flex-col items-center justify-center p-6 text-center">
      {/* Fora do fluxo: a marca sobe sem deslocar o bloco central. */}
      <StackedBrandLogo
        className="absolute left-1/2 top-[7vh] -translate-x-1/2"
        markClassName="h-16 w-16"
        textClassName="h-9"
      />

      <div className="flex translate-y-12 flex-col items-center gap-8">
        {/* Maior que os 14-20rem originais: sem o disco de fundo, o vórtice
            passou a ser o único elemento gráfico da tela e ganhou espaço. */}
        <TimeVortex className="w-[clamp(18rem,52vw,28rem)]" />

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
