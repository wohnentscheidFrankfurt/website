// Static build: `astro build` writes plain HTML, CSS and JS to dist/. Caddy serves dist/ on the server.
import { defineConfig } from "astro/config";
import { mapIntegration } from "./integrations/map.mjs";

export default defineConfig({
  site: "https://wohnentscheid-frankfurt.de",
  output: "static",
  image: { dangerouslyProcessSVG: true }, // rasterise the SVG drawings at build time
  integrations: [mapIntegration()], // checks ../sozialraum-frankfurt and copies the map to dist/sozialraum-frankfurt/
  devToolbar: { enabled: false },
  // `astro dev` and `astro preview` forward /api to the sign-up service (the live Caddy does the same).
  vite: {
    server: {
      proxy: {
        "/api": process.env.API_URL ?? "http://127.0.0.1:8787",
        // Map tiles, dev and preview only: this passes the browser's headers. Live, Caddy proxies without them.
        "/sozialraum-frankfurt/kacheln": {
          target: "https://sgx.geodatenzentrum.de",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/sozialraum-frankfurt\/kacheln/,
            "/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_grau/default/GLOBAL_WEBMERCATOR"),
        },
      },
    },
  },
});
