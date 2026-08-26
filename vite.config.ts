import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/*
 * A síntese de voz vivia num plugin Node daqui, registrado apenas em
 * `configureServer` e `configurePreviewServer`. Ou seja, existia só em
 * desenvolvimento: no build publicado a rota não existiria e a voz morreria em
 * produção, sem nada no código denunciando isso. Ela agora é `/v1/voice/synthesize`
 * no `Backend-web`, com o mesmo token e o mesmo controle de acesso do resto da API.
 */
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      // Espelha o alias declarado em `paths` no tsconfig.app.json.
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // Fotografia e logos usadas pelo painel de gestão (`src/management`).
        '@imgs': fileURLToPath(new URL('./src/assets/imgs', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      css: false,
    },
  };
});
