import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import {
  browserPlugins,
  chromium,
  parityTest,
  sharedResolve,
} from "./vitest.config.ts";

export default defineConfig({
  plugins: browserPlugins(),
  resolve: sharedResolve,
  test: {
    ...parityTest,
    include: ["tests/parity/fontBoxAlias.browser.test.ts"],
    browser: chromium(playwright({ contextOptions: { deviceScaleFactor: 2 } })),
  },
});
