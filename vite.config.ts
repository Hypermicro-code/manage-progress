import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Map alle "lodash/*.js" til "lodash-es/*.js" (Glide 6.0.1 forventer .js-stier)
      { find: /^lodash\/(.+)\.js$/, replacement: "lodash-es/$1.js" },
      { find: "lodash", replacement: "lodash-es" }
    ]
  },
  optimizeDeps: {
    include: ["lodash-es"]
  },
  server: { port: 5173 },
  build: {
    target: "es2020",
    sourcemap: false
  }
});
