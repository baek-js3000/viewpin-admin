import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages 처럼 하위 경로에 올릴 때: VITE_BASE=/viewpin-admin/ npm run build
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
