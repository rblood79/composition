/**
 * HC1 크기 게이트 — core+tus ≤ 6KB gz · IIFE ≤ 10KB gz.
 * 측정은 `scripts/measure-size.mjs` (tsup minify + gzip). IIFE 는 빌드 산출물이라 `pnpm build` 가 선행돼야 한다
 * (없으면 이 테스트 안에서 빌드한다).
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PKG = join(import.meta.dirname, "..");

describe("ADR-201 HC1 — 번들 크기", () => {
  it("core+tus ≤ 6,144 B gz · IIFE ≤ 10,240 B gz", async () => {
    if (!existsSync(join(PKG, "dist/composition-upload.iife.js"))) {
      execFileSync("pnpm", ["build"], { cwd: PKG, stdio: "ignore" });
    }
    // @ts-expect-error — .mjs 스크립트에는 선언 파일이 없다
    const { measure, LIMITS } = await import("../scripts/measure-size.mjs");
    const r = await measure();
    expect(
      r.coreTus.gzip,
      `core+tus gzip ${r.coreTus.gzip} B`,
    ).toBeLessThanOrEqual(LIMITS.coreTus);
    expect(r.iife.gzip, `IIFE gzip ${r.iife.gzip} B`).toBeLessThanOrEqual(
      LIMITS.iife,
    );
    expect(r.reactEntry.gzip).toBeLessThanOrEqual(LIMITS.coreTus + 512);
  }, 60_000);
});
