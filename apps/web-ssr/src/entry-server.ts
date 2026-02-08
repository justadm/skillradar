import { renderToString } from '@vue/server-renderer';
import { createApp } from './main';

export async function render(url: string) {
  const { app, router, head } = createApp();
  await router.push(url);
  await router.isReady();
  const appHtml = await renderToString(app);
  const headTags = head.value || '';
  return { appHtml, headTags };
}
