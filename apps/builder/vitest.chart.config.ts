import browserConfig from "./vitest.browser.config.ts";

/** ADR-209 실제 Recharts와 Canvas 기하 대조. 기존 Chromium pin을 재사용한다. */
export default {
  ...browserConfig,
  test: {
    ...browserConfig.test,
    include: ["../../packages/shared/src/components/chart/*.browser.test.tsx"],
    testTimeout: 15000,
  },
};
