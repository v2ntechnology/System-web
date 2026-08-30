import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { connectSession } from '@/app/session-bootstrap';
import { applyThemeClass, useThemeStore } from '@/stores/theme-store';

function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/**
 * Aplica o tema na primeira montagem e a cada troca.
 *
 * ⚠️ Chama `applyThemeClass` em vez de mexer nas classes por conta própria. As
 * duas travas de tema (escuro desligado durante o redesign, e as rotas públicas
 * presas no claro) moram lá dentro: uma segunda escrita direta no `<html>` aqui
 * desfaria a trava a cada render que mudasse `theme`, e o defeito só apareceria
 * quando o escuro voltasse a existir.
 */
function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    connectSession();
  }, []);

  return (
    <QueryProvider>
      <ThemeProvider>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
