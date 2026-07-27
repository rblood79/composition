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
// side-effect import — 각 캐시 모듈이 self-register 하도록 로드한다
import "./paints";
import "./imageCache";
import "./nodePictureCache";
import { getRegisteredSkiaCacheNames } from "./disposable";

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

  it("skia 캐시 모듈은 통합 해제 레지스트리에 self-register 한다 (R2 lifecycle)", () => {
    // 레지스트리 자체를 단언한다 — 소스 문자열 검사는 "등록을 지운 경우"만 잡고
    // 정작 막으려는 재발(등록 없이 추가된 새 캐시)은 통과시킨다.
    expect(new Set(getRegisteredSkiaCacheNames())).toEqual(
      new Set(["paintPool", "imageCache", "nodePictureCache"]),
    );
  });

  it("nodePictureCache 는 image 퇴거 역참조를 구독한다 (ADR-153 Phase 3 R2 — 해제 순서 Picture→Image)", () => {
    const src = readFileSync(join(skiaDir, "nodePictureCache.ts"), "utf8");
    expect(src).toContain(
      "registerImageEvictionListener(invalidateNodePicturesByImage)",
    );
  });
});
