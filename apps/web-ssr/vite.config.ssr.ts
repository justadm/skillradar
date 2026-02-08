import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [vue()],
  build: {
    outDir: path.resolve(__dirname, '../../dist/server'),
    ssr: '/src/entry-server.ts'
  },
  ssr: {
    noExternal: ['vue', 'vue-router']
  }
});
