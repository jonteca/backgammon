import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import backgammonServer from './vite-server-plugin.js';

export default defineConfig({
  plugins: [react(), backgammonServer()],
  server: {
    port: 3000,
    headers: {
      // Required for Discord Activity iframe embedding
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
});
