import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

import { elevenLabsVoicePlugin } from './server/elevenlabs-voice';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      elevenLabsVoicePlugin({
        apiKey: environment.ELEVENLABS_API_KEY,
        voiceId: environment.ELEVENLABS_VOICE_ID,
      }),
    ],
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
