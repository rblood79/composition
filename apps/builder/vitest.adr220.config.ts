import { defineConfig } from "vitest/config";
import { nodePlugins, sharedResolve, unitTest } from "./vitest.config.ts";

// ADR-220 고정 컨텍스트 스냅샷 하니스 — `scripts/` 에 있어 unit project include(`src/**`) 밖이다.
//   ADR220_SNAPSHOT_ARM=baseline|candidate TZ=UTC pnpm -F @composition/builder exec vitest run --config vitest.adr220.config.ts
export default defineConfig({
  plugins: nodePlugins(),
  resolve: sharedResolve,
  cacheDir: "node_modules/.vite/adr220-snapshot",
  test: { ...unitTest, include: ["scripts/adr220-snapshot.test.ts"] },
});
