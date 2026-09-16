import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'vercel-api-dev-middleware',
      configureServer(server) {
        try {
          process.loadEnvFile?.();
        } catch {
          // Ignore if .env is already loaded or in test env
        }

        server.middlewares.use(async (req, res, next) => {
          if (!req.url || !req.url.startsWith('/api/')) {
            return next();
          }

          try {
            const host = req.headers.host || 'localhost:5173';
            const parsedUrl = new URL(req.url, `http://${host}`);
            const routeName = parsedUrl.pathname.replace(/^\/api\//, '').split('/')[0];
            const resolvedPath = path.resolve(process.cwd(), 'api', `${routeName}.js`);
            const fileUrl = pathToFileURL(resolvedPath).href;

            // Polyfill Express/Vercel response methods if running under Connect
            if (!res.status) {
              res.status = function (code) {
                res.statusCode = code;
                return res;
              };
            }
            if (!res.json) {
              res.json = function (data) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return res;
              };
            }
            if (!res.send) {
              res.send = function (data) {
                if (Buffer.isBuffer(data)) {
                  res.end(data);
                } else if (typeof data === 'object' && data !== null) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                } else {
                  res.end(data);
                }
                return res;
              };
            }

            req.query = Object.fromEntries(parsedUrl.searchParams.entries());

            if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
              let body = '';
              req.on('data', (chunk) => {
                body += chunk;
              });
              req.on('end', async () => {
                try {
                  req.body = body ? JSON.parse(body) : {};
                  const mod = await import(fileUrl);
                  await mod.default(req, res);
                } catch (err) {
                  console.error(`[Vite API Dev] Error in ${routeName}:`, err);
                  res.status(500).json({ error: err.message });
                }
              });
            } else {
              const mod = await import(fileUrl);
              await mod.default(req, res);
            }
          } catch (err) {
            console.error(`[Vite API Dev] Middleware error for ${req.url}:`, err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `API route error: ${err.message}` }));
          }
        });
      },
    },
  ],
})
