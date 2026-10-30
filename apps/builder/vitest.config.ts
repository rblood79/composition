import { resolve } from "path";
import { playwright } from "@vitest/browser-playwright";
import wasm from "vite-plugin-wasm";
import {
  defineConfig,
  type TestUserConfig,
  type ViteUserConfig,
} from "vitest/config";

const shared = (path: string) =>
  resolve(import.meta.dirname, "../../packages/shared/src", path);

export const sharedResolve: ViteUserConfig["resolve"] = {
  alias: [
    { find: "@", replacement: resolve(import.meta.dirname, "src") },
    {
      find: /^@composition\/shared\/components\/styles\/(.*)$/,
      replacement: shared("components/styles/$1"),
    },
    {
      find: /^@composition\/shared\/components\/(.*)$/,
      replacement: shared("components/$1"),
    },
    {
      find: "@composition/shared/components",
      replacement: shared("components/index.ts"),
    },
    {
      find: "@composition/shared/assets",
      replacement: shared("assets/index.ts"),
    },
    {
      find: "@composition/shared/utils",
      replacement: shared("utils/index.ts"),
    },
    {
      find: "@composition/shared/types",
      replacement: shared("types/index.ts"),
    },
    {
      find: "@composition/shared/hooks",
      replacement: shared("hooks/index.ts"),
    },
    { find: "@composition/shared", replacement: shared("index.ts") },
  ],
};

// ADR-916 Phase 2-B (B2): dual-run 테스트가 두 wasm-pack 산출물(--target bundler)을 ES 모듈로
// 로드하려면 vite-plugin-wasm 이 필요하다. 플러그인이 `configResolved` 에서 실행 환경을 기억하므로
// project 마다 새 인스턴스를 만든다.
// vite-plugin-wasm 3.6은 이름이 정확히 `vitest`인 plugin으로 Node 실행을 감지하지만 Vitest 5는
// plugin 이름을 `vitest:*`로 바꿨다. 호환 marker가 없으면 browser URL을 Node fetch에 넘겨
// WASM 테스트가 실패한다. browser project 에 marker 를 두면 .wasm 이 base64 inline 으로 바뀐다.
export const nodePlugins = () => [{ name: "vitest" }, wasm()];
export const browserPlugins = () => [wasm()];

export const unitTest: TestUserConfig = {
  environment: "jsdom",
  setupFiles: ["./src/test/rtlCleanup.ts", "./src/test/i18nPreload.ts"],
  // ADR-256 G5 example 13: the S2 oracle (`@react-spectrum/s2`, a test-only devDependency) imports
  // its compiled `.css` — Vite transforms it (inline) instead of Node loading it.
  server: { deps: { inline: [/@react-spectrum\/s2/] } },
  include: [
    "src/**/__tests__/**/*.test.ts",
    "src/**/__tests__/**/*.test.tsx",
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
  ],
  exclude: ["**/node_modules/**", "**/*.browser.test.tsx"],
};

export const chromium = (
  provider = playwright(),
): NonNullable<TestUserConfig["browser"]> => ({
  enabled: true,
  provider,
  headless: true,
  screenshotFailures: false,
  instances: [{ browser: "chromium" }],
});

// ADR-156 Phase 1 — Chrome 차등 하니스 (G1). jsdom 은 레이아웃 계산이 없어 oracle 이 될 수 없다.
// @vitest/browser + Playwright(Chromium)로 실 DOM `getBoundingClientRect`(leg 1, ground truth)와
// 엔진 `computeLayout`(leg 2)을 한 파일에서 대조한다 — 두 leg 가 한 번에 돌아 상수 고정(순환 oracle)이
// 불필요하다.
export const parityTest: TestUserConfig = {
  include: ["tests/parity/**/*.browser.test.ts"],
  // DOM leg 페이지의 root 폰트 문맥을 production 과 같이 고정한다 — 앱 배럴의 CSS 부작용에
  // 기대지 않는다 (2026-09-16 CSS 단일 채널 뒤 DOM leg 만 Times 로 떨어졌다, harness/setupThemeFont.ts).
  // ADR-293 — 테마 색은 Preview 처럼 resolver snapshot 이 싣는다 (`preview-system.css` 는 계산하지 않는다 —
  // 없으면 `border: … var(--border)` 같은 선언이 무효가 돼 DOM leg 상자가 달라진다).
  setupFiles: [
    "./tests/parity/harness/setupThemeFont.ts",
    "./tests/parity/harness/setupPreviewThemeVars.ts",
  ],
};

// ADR-209 실제 Recharts와 Canvas 기하 대조.
export const chartTest: TestUserConfig = {
  ...parityTest,
  include: ["../../packages/shared/src/components/chart/*.browser.test.tsx"],
  testTimeout: 15000,
};

/** 같은 차트 테스트를 브라우저의 실제 media query를 dark/reduced-motion으로 설정해 돌리는 대조군. */
const chartA11yTest: TestUserConfig = {
  ...chartTest,
  include: [
    "../../packages/shared/src/components/chart/chartInteraction.browser.test.tsx",
    "../../packages/shared/src/components/chart/chartTheme.browser.test.tsx",
    "../../packages/shared/src/components/chart/rechartsRuntime.browser.test.tsx",
  ],
};

// `vitest run --project <name>` 으로 고른다. ADR-248 G3 하니스 (`vitest.adr248-g3.browser.config.ts`)
// 는 고정 캡처가 oracle 이라 기본 실행에 섞이지 않게 별도 config 로 둔다.
export default defineConfig({
  resolve: sharedResolve,
  test: {
    projects: [
      { plugins: nodePlugins(), test: { name: "unit", ...unitTest } },
      // ADR-220 고정 컨텍스트 스냅샷 하니스 — `ADR220_SNAPSHOT_ARM` 이 없으면 전부 skip 한다.
      //   ADR220_SNAPSHOT_ARM=baseline|candidate TZ=UTC pnpm -F @composition/builder exec vitest run --project adr220
      {
        plugins: nodePlugins(),
        test: {
          name: "adr220",
          ...unitTest,
          include: ["scripts/adr220-snapshot.test.ts"],
        },
      },
      {
        plugins: browserPlugins(),
        test: { name: "parity", ...parityTest, browser: chromium() },
      },
      {
        plugins: browserPlugins(),
        test: { name: "chart", ...chartTest, browser: chromium() },
      },
      {
        plugins: browserPlugins(),
        test: {
          name: "chart-a11y",
          ...chartA11yTest,
          browser: chromium(
            playwright({
              contextOptions: {
                colorScheme: "dark",
                reducedMotion: "reduce",
                deviceScaleFactor: 2,
              },
            }),
          ),
        },
      },
    ],
  },
});
