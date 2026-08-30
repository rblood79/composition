import { defineConfig, mergeConfig } from "vitest/config";
import browserConfig from "./vitest.browser.config.ts";

// ADR-198 — D3 Skia↔Preview 시각 파리티 하니스 (test-only)
//
// host 결정 (Phase 0 / G0): pinned @vitest/browser Chromium.
// `initCanvasKit` 이 `window` 와 Vite `BASE_URL` 에 의존하므로 순수 Node host 는
// 프로덕션 초기화를 복제해야 하고 그건 HC3 위반이다. alias/브라우저 핀은
// `vitest.browser.config.ts`(ADR-156) 을 그대로 상속해 두 번째 핀 소스를 만들지 않는다.
//
// `include` 는 상속이 아니라 **교체**다 — mergeConfig 는 배열을 이어붙이므로
// 그대로 두면 ADR-156 parity 34개까지 같이 돌아 게이트 시간 예산(HC10)이 깨진다.
const config = mergeConfig(
  browserConfig,
  defineConfig({
    test: {
      testTimeout: 120_000,
      hookTimeout: 120_000,
    },
  }),
);

config.test!.include = ["tests/visual-parity/**/*.browser.test.ts"];

export default config;
