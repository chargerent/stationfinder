import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/stationfinder/",
  server: {
    proxy: {
      "/api": {
        target: "https://chargerentstations.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
