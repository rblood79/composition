import { resolve } from "path";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import wasm from "vite-plugin-wasm";

// ADR-156 Phase 1 — Chrome 차등 하니스 (G1)
//
// jsdom(vitest.config.ts)은 레이아웃 계산이 없어 oracle 이 될 수 없다. 본 config 는
// @vitest/browser + Playwright(Chromium)로 **실 DOM `getBoundingClientRect`**(leg 1,
// ground truth)와 **엔진 `computeLayout`**(leg 2)을 한 파일에서 대조한다. 두 leg 가
// 한 번에 돌아 상수 고정(순환 oracle)이 불필요하다.
//
// alias 는 vitest.config.ts(jsdom) 와 동일 — 엔진 wrapper 및 그 import 체인 해석용.
export default defineConfig({
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
    include: ["tests/parity/**/*.browser.test.ts"],
    env: {
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: "chromium" }],
    },
  },
});
