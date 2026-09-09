import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const dir = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@composition/shared/components": `${dir}/../../packages/shared/src/components/index.ts`,
      "@composition/shared/renderers": `${dir}/../../packages/shared/src/renderers/index.ts`,
      "@composition/shared/types": `${dir}/../../packages/shared/src/types/index.ts`,
      "@composition/shared/hooks": `${dir}/../../packages/shared/src/hooks/index.ts`,
      "@composition/shared/utils": `${dir}/../../packages/shared/src/utils/index.ts`,
      "@composition/shared": `${dir}/../../packages/shared/src/index.ts`,
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Vite 8 기본 Lightning CSS는 Tailwind v4 @utility 등을 미지원 → esbuild 유지
    cssMinify: "esbuild",
    rolldownOptions: {
      input: {
        main: `${dir}/index.html`,
      },
    },
  },
  server: {
    port: 3001,
  },
});
