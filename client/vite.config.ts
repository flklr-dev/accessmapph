import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Add Render API origin to CSP connect-src when VITE_API_BASE_URL is set at build time. */
function injectApiCsp(apiBaseUrl: string | undefined) {
  const base = apiBaseUrl?.trim()
  if (!base) return

  let origin: string
  try {
    origin = new URL(base).origin
  } catch {
    return
  }

  return {
    name: 'inject-api-csp',
    transformIndexHtml(html: string) {
      return html
        .replace("connect-src 'self'", `connect-src 'self' ${origin}`)
        .replace(
          '<!-- Performance: connect early to the origins the map/photos load from -->',
          `<!-- Performance: connect early to the origins the map/photos load from -->
    <link rel="preconnect" href="${origin}" crossorigin />`,
        )
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = env.VITE_API_BASE_URL

  return {
    plugins: [react(), tailwindcss(), injectApiCsp(apiBaseUrl)].filter(Boolean),
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    preview: {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
      },
    },
  }
})
