import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Serves the Vercel functions in /api during `npm run dev`, so the whole app runs
 * with one command and no Vercel login. Each request loads the function module
 * through Vite (hot reload included) and calls its exported HTTP-method handler.
 */
function localApi(): Plugin {
  return {
    name: 'splitnight-local-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const match = /^\/api\/([a-z-]+)$/.exec(url.pathname);
        if (!match) return next();
        try {
          const mod = (await server.ssrLoadModule(`/api/${match[1]}.ts`)) as Record<
            string,
            ((request: Request) => Promise<Response> | Response) | undefined
          >;
          const handler = mod[req.method ?? 'GET'];
          if (!handler) {
            res.statusCode = 405;
            res.end();
            return;
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value);
          }
          headers.set('x-forwarded-for', req.socket.remoteAddress ?? '127.0.0.1');
          const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
          const response = await handler(
            new Request(url, { method: req.method, headers, body }),
          );
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          server.config.logger.error(`[api] ${(error as Error).message}`);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: { code: 'UPSTREAM', message: 'Local API error' } }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make server-only variables (GROQ_API_KEY, model overrides) visible to the local API.
  // They are never exposed to the browser bundle: Vite only inlines VITE_* variables.
  Object.assign(process.env, loadEnv(mode, process.cwd(), 'GROQ_'));

  return {
    plugins: [
      react(),
      tailwindcss(),
      localApi(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'samples/*.svg'],
        manifest: {
          name: 'SplitNight',
          short_name: 'SplitNight',
          description: 'Split the bill with friends — scan, say who had what, done.',
          theme_color: '#140f2e',
          background_color: '#140f2e',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          lang: 'en-GB',
          categories: ['utilities', 'lifestyle', 'food'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [],
        },
      }),
    ],
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 600,
    },
  };
});
