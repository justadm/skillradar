import { createSSRApp, h, ref } from 'vue';
import { createRouter, createMemoryHistory, createWebHistory, RouterView } from 'vue-router';
import routes from './routes';

export function createApp() {
  const isClient = typeof window !== 'undefined';
  const router = createRouter({
    history: isClient ? createWebHistory() : createMemoryHistory(),
    routes
  });

  if (isClient) {
    router.beforeEach((to) => {
      if (!to.path.startsWith('/hiring')) return true;
      const authed = localStorage.getItem('sr-authed') === '1';
      if (authed) return true;
      sessionStorage.setItem('sr-redirect', to.fullPath);
      if (to.path === '/login') return true;
      return '/login';
    });
  }

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
