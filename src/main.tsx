import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { applyPlatformFavicon } from '@/app/favicon';
import { applyPerformanceProfile } from '@/management/lib/performance';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado.');

/* Antes do render: as classes decidem vidro e animação já no primeiro quadro. */
applyPerformanceProfile();

/* O ícone da aba é do `index.html`, que é o mesmo arquivo para as duas portas.
   Na da equipe ele vira a torre azul. */
applyPlatformFavicon();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
