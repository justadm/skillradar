import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^vue$/, replacement: 'vue/dist/vue.esm-bundler.js' }
    ]
  },
  server: {
    allowedHosts: ['sbdb.loc', 'localhost', '127.0.0.1']
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist/client'),
    emptyOutDir: true
  },
  ssr: {
    noExternal: ['vue', 'vue-router']
  }
});
