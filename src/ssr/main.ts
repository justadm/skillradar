import 'reflect-metadata';
import path from 'path';
import fs from 'fs';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { createServer as createViteServer } from 'vite';
import { buildApiRouter } from '../web/server';

@Module({})
class AppModule {}

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  const root = path.resolve(__dirname, '../../apps/web-ssr');
  const distClient = path.resolve(__dirname, '../../dist/client');
  const distServer = path.resolve(__dirname, '../../dist/server');

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  const server = app.getHttpAdapter().getInstance();
  server.use(express.json());
  server.use(buildApiRouter());

  let vite: any;
  if (!isProd) {
    vite = await createViteServer({
      root,
      server: { middlewareMode: true, allowedHosts: ['sbdb.loc', 'localhost', '127.0.0.1'] },
      appType: 'custom'
    });
    server.use(vite.middlewares);
  } else {
    server.use(express.static(distClient));
  }

  server.use('*', async (req: any, res: any) => {
    const url = req.originalUrl;
    try {
      let template = fs.readFileSync(
        isProd ? path.join(distClient, 'index.html') : path.join(root, 'index.html'),
        'utf8'
      );
      if (!isProd) {
        template = await vite.transformIndexHtml(url, template);
        const { render } = await vite.ssrLoadModule('/src/entry-server.ts');
        const rendered = await render(url);
        const html = template
          .replace('<!--app-html-->', rendered.appHtml)
          .replace('<!--head-tags-->', rendered.headTags || '');
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } else {
        const { render } = require(path.join(distServer, 'entry-server.js'));
        const rendered = await render(url);
        const html = template
          .replace('<!--app-html-->', rendered.appHtml)
          .replace('<!--head-tags-->', rendered.headTags || '');
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      }
    } catch (err: any) {
      if (!isProd && vite) vite.ssrFixStacktrace(err);
      res.status(500).end(err?.stack || err?.message || 'Server error');
    }
  });

  const port = Number(process.env.WEB_PORT || 3000);
  await app.listen(port);
  console.log(`[ssr] listening on http://localhost:${port}`);
}

bootstrap();
