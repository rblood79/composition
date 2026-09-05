import { defineConfig, mergeConfig } from "vitest/config";
import browserConfig from "./vitest.browser.config.ts";

// 실제 React/RAC viewport 검증은 기존 Skia parity 계측과 dependency cache를 분리한다.
const config = mergeConfig(
  browserConfig,
  defineConfig({
    cacheDir: "node_modules/.vite/navigator-tests",
    // RAC의 test 기본값인 전체 행 렌더 대신 실제 viewport 가상화를 실행한다.
    define: { "process.env.VIRT_ON": "true" },
    resolve: { dedupe: ["react", "react-dom"] },
    optimizeDeps: {
      include: [
        "react",
        "react-dom/client",
        "react-aria-components",
        "react-stately",
        "react-aria",
      ],
    },
  }),
);

config.test!.include = ["src/builder/panels/navigator/**/*.browser.test.tsx"];
export default config;
