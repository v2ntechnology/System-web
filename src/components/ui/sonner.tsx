import type { ComponentProps } from 'react';
import { Toaster as SonnerToaster } from 'sonner';

import { useThemeStore } from '@/stores/theme-store';

type ToasterProps = ComponentProps<typeof SonnerToaster>;

export function Toaster(props: ToasterProps) {
  const theme = useThemeStore((state) => state.theme);

  return (
    <SonnerToaster
      theme={theme}
      /* ⚠️ Canto INFERIOR direito desde 18/09/2026, a pedido do usuário. No
         topo, o aviso caía em cima da faixa da página e do menu da conta, que é
         justamente onde o olho está quando a tela acaba de abrir. */
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'font-sans',
        },
      }}
      {...props}
    />
  );
}
