import { resolve } from "path";
import { defineConfig } from "vitest/config";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  // ADR-916 Phase 2-B (B2): dual-run 테스트가 두 wasm-pack 산출물(--target
  // bundler)을 ES 모듈로 로드하려면 vite-plugin-wasm 이 필요하다. .wasm import 가
  // 없는 기존 테스트에는 no-op(개입 없음).
  plugins: [wasm()],
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
    exclude: ["**/node_modules/**", "**/*.browser.test.tsx"],
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
