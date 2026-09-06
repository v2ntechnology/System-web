import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { applyPerformanceProfile } from '@/management/lib/performance';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado.');

/* Antes do render: as classes decidem vidro e animação já no primeiro quadro. */
applyPerformanceProfile();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
