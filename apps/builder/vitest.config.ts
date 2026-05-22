import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: `${resolve(import.meta.dirname, "src")}` },
      {
        find: /^@composition\/shared\/components\/styles\/(.*)$/,
        replacement: `${resolve(import.meta.dirname, "../../packages/shared/src/components/styles/$1")}`,
      },
      {
        find: /^@composition\/shared\/components\/(.*)$/,
        replacement: `${resolve(import.meta.dirname, "../../packages/shared/src/components/$1")}`,
      },
      {
        find: "@composition/shared/components",
        replacement: `${resolve(import.meta.dirname, "../../packages/shared/src/components/index.ts")}`,
      },
      {
        find: "@composition/shared/utils",
        replacement: `${resolve(import.meta.dirname, "../../packages/shared/src/utils/index.ts")}`,
      },
      {
        find: "@composition/shared/types",
        replacement: `${resolve(import.meta.dirname, "../../packages/shared/src/types/index.ts")}`,
      },
      {
        find: "@composition/shared/renderers",
        replacement: `${resolve(import.meta.dirname, "../../packages/shared/src/renderers/index.ts")}`,
      },
      {
        find: "@composition/shared/hooks",
        replacement: `${resolve(import.meta.dirname, "../../packages/shared/src/hooks/index.ts")}`,
      },
      {
        find: "@composition/shared",
        replacement: `${resolve(import.meta.dirname, "../../packages/shared/src/index.ts")}`,
      },
    ],
  },
  test: {
    environment: "jsdom",
    include: [
      "src/**/__tests__/**/*.test.ts",
      "src/**/__tests__/**/*.test.tsx",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
    ],
    // Supabase 환경 변수 stub — 테스트 환경에서 createClient 초기화 오류 방지
    env: {
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
