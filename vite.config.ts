import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Serves api/extract.ts in `vite dev` (on Vercel it runs as a serverless function).
// Server-only keys are loaded from .env into process.env and never reach the client bundle.
const devApi = (): Plugin => ({
  name: 'dev-api',
  apply: 'serve',
  configureServer(server) {
    Object.assign(process.env, loadEnv(server.config.mode, server.config.root, ''))

    server.middlewares.use('/api/extract', async (req, res) => {
      try {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const host = req.headers.host ?? 'localhost'
        const headers = new Headers()
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === 'string') headers.set(k, v)
        }
        const request = new Request(`http://${host}/api/extract`, {
          method: 'POST',
          headers,
          body: Buffer.concat(chunks),
        })
        const mod = (await server.ssrLoadModule('/api/extract.ts')) as {
          POST: (r: Request) => Promise<Response>
        }
        const response = await mod.POST(request)
        res.statusCode = response.status
        response.headers.forEach((value, name) => res.setHeader(name, value))
        res.end(Buffer.from(await response.arrayBuffer()))
      } catch (e) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error' }))
      }
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
})
