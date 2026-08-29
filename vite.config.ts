import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/*
 * A síntese de voz é `/v1/voice/synthesize` no `Backend-web`. Ela já viveu num
 * plugin Node daqui, registrado só em `configureServer` e `configurePreviewServer`,
 * e por isso sumia no build publicado. Não trazer de volta.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Espelha o alias declarado em `paths` no tsconfig.app.json.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Fotografia e logos usadas pelo painel de gestão (`src/management`).
      '@imgs': fileURLToPath(new URL('./src/assets/imgs', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
});
