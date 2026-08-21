import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@composition/shared/components": path.resolve(
        __dirname,
        "../../packages/shared/src/components/index.ts",
      ),
      "@composition/shared/renderers": path.resolve(
        __dirname,
        "../../packages/shared/src/renderers/index.ts",
      ),
      "@composition/shared/types": path.resolve(
        __dirname,
        "../../packages/shared/src/types/index.ts",
      ),
      "@composition/shared/hooks": path.resolve(
        __dirname,
        "../../packages/shared/src/hooks/index.ts",
      ),
      "@composition/shared/utils": path.resolve(
        __dirname,
        "../../packages/shared/src/utils/index.ts",
      ),
      "@composition/shared": path.resolve(
        __dirname,
        "../../packages/shared/src/index.ts",
      ),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Vite 8 기본 Lightning CSS는 Tailwind v4 @utility 등을 미지원 → esbuild 유지
    cssMinify: "esbuild",
    rolldownOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
  server: {
    port: 3001,
  },
});
