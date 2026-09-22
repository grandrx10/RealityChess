import path from "node:path";
import { defineConfig } from "vitest/config";

// Next resolves the "@/" alias from tsconfig paths; Vitest needs telling.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
