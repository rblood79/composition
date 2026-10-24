import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import {
  browserPlugins,
  chartTest,
  chromium,
  sharedResolve,
} from "./vitest.config.ts";

/** 브라우저의 실제 media query를 dark/reduced-motion으로 설정한 대조군. */
export default defineConfig({
  plugins: browserPlugins(),
  resolve: sharedResolve,
  test: {
    ...chartTest,
    include: [
      "../../packages/shared/src/components/chart/chartInteraction.browser.test.tsx",
      "../../packages/shared/src/components/chart/chartTheme.browser.test.tsx",
      "../../packages/shared/src/components/chart/rechartsRuntime.browser.test.tsx",
    ],
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
});
