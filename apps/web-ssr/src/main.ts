import { createSSRApp, h, ref } from 'vue';
import { createRouter, createMemoryHistory, createWebHistory, RouterView } from 'vue-router';
import routes from './routes';

export function createApp() {
  const isClient = typeof window !== 'undefined';
  const router = createRouter({
    history: isClient ? createWebHistory() : createMemoryHistory(),
    routes
  });

  const head = ref('');

  const app = createSSRApp({
    setup() {
      return () => h(RouterView);
    }
  });

  app.provide('head', head);
  app.use(router);

  return { app, router, head };
}
