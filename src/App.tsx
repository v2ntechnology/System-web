import { BrowserRouter } from 'react-router';

import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </BrowserRouter>
  );
}
