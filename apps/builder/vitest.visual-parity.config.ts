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
      // tester 페이지에 Preview 와 같은 폰트를 싣는다 — 두 leg 이 다른 폰트 집합을
      // 보면 케이스가 의도한 축이 아니라 폰트 로딩을 잰다 (harness/setupFonts.ts).
      setupFiles: [
        "./tests/visual-parity/harness/setupFonts.ts",
        // Skia leg 에 production 과 같은 theme 파생을 적용한다 (accent 리터럴 vs oklch 파생).
        "./tests/visual-parity/harness/setupTheme.ts",
      ],
    },
  }),
);

config.test!.include = ["tests/visual-parity/**/*.browser.test.ts"];

// 뷰포트 핀 (HC4) — **캡처 배율을 1:1 로 만들기 위한 것이지 취향이 아니다.**
//
// Vitest 는 tester iframe 을 `browser.viewport` 크기로 만든 뒤 실제 창에 맞게 CSS
// 로 축소한다 (`@vitest/browser-playwright` 의 `getIframeScale`). 그래서
// `page.screenshot({ element })` 는 **축소된** 픽셀을 돌려준다. 실측:
//
// | viewport   | 창 높이 | 배율  | CSS 240x180 → PNG |
// | ---------- | ------- | ----- | ----------------- |
// | 414x896    | 720     | 0.804 | 193x145           |
// | 1280x900   | 720     | 0.800 | 192x144           |
// | 1280x720   | 720     | 1.000 | 240x180           |
//
// 축소된 캡처로 L3 를 재면 두 leg 이 서로 다른 해상도를 비교하게 된다 — 리샘플링
// 오차가 예산 안에 숨어 진짜 발산을 가린다. 창 높이(720) 이하로 두면 배율이 1 이
// 되고, 그 사실은 `productionLeg` 이 `shot.width === rect.width` 로 매번 재확인한다.
config.test!.browser!.viewport = { width: 1280, height: 720 };
config.test!.browser!.instances = [
  { browser: "chromium", viewport: { width: 1280, height: 720 } },
];

export default config;
