/**
 * Paint 풀 규약 정적 가드 (ADR-153 Phase 2)
 *
 * skia/ 렌더 소스의 Paint 생성 지점을 paints.ts 단일 지점으로 강제한다.
 * `new ck.Paint()` 직접 생성이 재도입되면 frame-hot per-frame WASM
 * malloc/free 가 재발한다 — acquirePooledPaint / acquireScopedPaint 를 사용할 것.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const skiaDir = dirname(fileURLToPath(import.meta.url));

/** 주석 라인 제외한 코드 라인만 검사한다 (disposable.ts 문서 예시 등). */
function codeLines(src: string): string[] {
  return src
    .split("\n")
    .filter(
      (line) =>
        !line.trimStart().startsWith("*") && !line.trimStart().startsWith("//"),
    );
}

describe("paint pool 규약 (ADR-153 Phase 2)", () => {
  it("skia/ 소스의 Paint 생성은 paints.ts 단일 지점만 — 직접 new ck.Paint() 0건", () => {
    const offenders: string[] = [];
    for (const file of readdirSync(skiaDir)) {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
      if (file.includes(".test.")) continue;
      if (file === "paints.ts") continue;
      const src = readFileSync(join(skiaDir, file), "utf8");
      if (codeLines(src).some((line) => line.includes(".Paint()"))) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("paints.ts 는 통합 해제 레지스트리에 등록되어 있다 (R2 lifecycle)", () => {
    const src = readFileSync(join(skiaDir, "paints.ts"), "utf8");
    expect(src).toContain('registerSkiaCacheDestroy("paintPool"');
  });

  it("imageCache 는 통합 해제 레지스트리에 등록되어 있다 (R2 lifecycle)", () => {
    const src = readFileSync(join(skiaDir, "imageCache.ts"), "utf8");
    expect(src).toContain('registerSkiaCacheDestroy("imageCache"');
  });
});
