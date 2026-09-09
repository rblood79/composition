import { playwright } from "@vitest/browser-playwright";
import chartConfig from "./vitest.chart.config.ts";

/** 브라우저의 실제 media query를 dark/reduced-motion으로 설정한 대조군. */
export default {
  ...chartConfig,
  test: {
    ...chartConfig.test,
    include: [
      "../../packages/shared/src/components/chart/chartInteraction.browser.test.tsx",
      "../../packages/shared/src/components/chart/chartTheme.browser.test.tsx",
      "../../packages/shared/src/components/chart/rechartsRuntime.browser.test.tsx",
    ],
    browser: {
      ...chartConfig.test.browser,
      provider: playwright({
        contextOptions: {
          colorScheme: "dark",
          reducedMotion: "reduce",
          deviceScaleFactor: 2,
        },
      }),
    },
  },
};
