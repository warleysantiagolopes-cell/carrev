import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/carrev/",

  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",
      manifestFilename: "carrev.webmanifest",

      includeAssets: [
        "icons/apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
      ],

      manifest: {
        id: "/carrev/",
        name: "CarRev",
        short_name: "CarRev",
        description: "Sua garagem sempre em dia",
        lang: "pt-BR",
        theme_color: "#0b0f14",
        background_color: "#0b0f14",
        display: "standalone",
        start_url: "/carrev/",
        scope: "/carrev/",

        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});