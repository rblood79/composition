import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import base from "./vitest.browser.config.ts";

// ADR-248 G3 old/new Canvas comparison. The frozen G0 Canvas captures were taken by headless
// Chrome (`channel: "chrome"`, WebGL surface), so the new Canvas leg rasterizes in the same
// browser channel. Kept out of the default parity include because its oracle is the frozen
// production capture environment.
export default defineConfig({
  ...base,
  // Diagnostic only: `ADR248_DUMP_DOM=<Type> ADR248_DUMP_DIR=<abs dir>` writes that type's
  // isolated DOM box tree.
  define: {
    ...base.define,
    __ADR248_REPLAY__: JSON.stringify(process.env.ADR248_REPLAY ?? ""),
    __ADR248_OLD_PNG_DIR__: JSON.stringify(
      process.env.ADR248_OLD_PNG_DIR ?? "",
    ),
    __ADR248_CASES__: JSON.stringify(process.env.ADR248_CASES ?? ""),
    __ADR248_REPORT__: JSON.stringify(process.env.ADR248_REPORT ?? ""),
    __ADR248_DUMP_DOM__: JSON.stringify(process.env.ADR248_DUMP_DOM ?? ""),
    __ADR248_DUMP_DIR__: JSON.stringify(process.env.ADR248_DUMP_DIR ?? ""),
    // `ADR248_SCENARIO=axis`: the frozen palette-variant-size scenario (386 single axes).
    __ADR248_SCENARIO__: JSON.stringify(process.env.ADR248_SCENARIO ?? "base"),
    // `ADR248_LIVE_DIR=<abs dir>`: Phase 4 live leg — the real Builder's captures of each case.
    __ADR248_LIVE_DIR__: JSON.stringify(process.env.ADR248_LIVE_DIR ?? ""),
  },
  test: {
    ...base.test,
    include: ["tests/adr248-g3/**/*.browser.test.ts"],
    browser: {
      ...base.test!.browser!,
      provider: playwright({ launchOptions: { channel: "chrome" } }),
      viewport: { width: 1440, height: 900 },
    },
  },
});
