import { BrowserRouter } from 'react-router';

import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import { SupportBanner } from '@/components/layout/support-banner';

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRouter />
        {/* Fora do roteador de propósito: o modo suporte atravessa as rotas, e a
            faixa não pode sumir ao navegar. */}
        <SupportBanner />
      </AppProviders>
    </BrowserRouter>
  );
}
