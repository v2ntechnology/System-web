import type { ComponentProps } from 'react';
import { Toaster as SonnerToaster } from 'sonner';

import { useThemeStore } from '@/stores/theme-store';

type ToasterProps = ComponentProps<typeof SonnerToaster>;

export function Toaster(props: ToasterProps) {
  const theme = useThemeStore((state) => state.theme);

  return (
    <SonnerToaster
      theme={theme}
      position="top-right"
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
