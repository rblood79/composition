import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config.ts";

// ADR-220 고정 컨텍스트 스냅샷 하니스 — `scripts/` 에 있어 기본 include(`src/**`) 밖이다.
//   ADR220_SNAPSHOT_ARM=baseline|candidate TZ=UTC pnpm -F @composition/builder exec vitest run --config vitest.adr220.config.ts
const config = mergeConfig(
  baseConfig,
  defineConfig({ cacheDir: "node_modules/.vite/adr220-snapshot" }),
);

config.test!.include = ["scripts/adr220-snapshot.test.ts"];
export default config;
