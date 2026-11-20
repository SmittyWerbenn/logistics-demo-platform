import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { emailApiPlugin } from "./server/emailApiPlugin.ts";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    // GitHub Pages project sites live under /<repo>/. Set VITE_BASE_PATH at
    // build time (the deploy workflow does this); default is the domain root.
    base: (env.VITE_BASE_PATH as string | undefined) || "/",
    plugins: [react(), tailwindcss(), emailApiPlugin(env)],
    // Demo clone: fixed port so it can run side by side with the real GMS
    // instance (which uses 5183) without collision.
    server: { port: 5184, strictPort: true },
    preview: { port: 5184, strictPort: true },
  };
});
