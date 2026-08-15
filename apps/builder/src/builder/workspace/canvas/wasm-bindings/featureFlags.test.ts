// @vitest-environment node
/**
 * Feature flag 표의 정직성 계약.
 *
 * **Why (2026-08-15 실측)**: `isUnifiedFlag` 가 `UNIFIED_ENGINE` 을 먼저 보고
 * true 면 즉시 true 를 돌려줬다. `UNIFIED_ENGINE: true` 인 지금 **모든 플래그가
 * true** 로 읽혀, 당시 표에 `false` 로 적혀 있던 6개가 거짓말이었다. 소비자가
 * 0건이라 무증상이었을 뿐 — 새 소비자가 붙으면 표를 읽고 판단한 쪽과 동작이 갈린다.
 *
 * 같은 날 소비자 0건 플래그 8개를 삭제해 표에 `false` 항목이 남지 않았다.
 * 그래서 **값 비교만으로는 이 회귀를 잡을 수 없다** (전부 true 면 단락 평가를
 * 되살려도 결과가 같다). 아래 두 가드가 그 공백을 나눠 맡는다:
 *   1. 소스 텍스트 — 단락 평가 부재 (지금 유일하게 물리는 가드)
 *   2. 값 비교 — `false` 플래그가 다시 도입되면 자동으로 다시 물린다
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  UNIFIED_ENGINE_FLAGS,
  isUnifiedFlag,
  type UnifiedEngineFlag,
} from "./featureFlags";

const keys = Object.keys(UNIFIED_ENGINE_FLAGS) as UnifiedEngineFlag[];

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "featureFlags.ts"),
  "utf8",
);

/** 주석(구 구현을 인용하는 Why 블록)을 걷어낸 실제 코드. */
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("isUnifiedFlag — 선언값 그대로", () => {
  it("다른 플래그 값으로 분기하지 않는다 (단락 평가 부재)", () => {
    const body = code.match(/function isUnifiedFlag[\s\S]*?\n\}/)?.[0] ?? "";

    expect(body).toContain("return UNIFIED_ENGINE_FLAGS[flag]");
    // 구 회귀 형태: `if (UNIFIED_ENGINE_FLAGS.UNIFIED_ENGINE) return true;`
    expect(body).not.toMatch(/UNIFIED_ENGINE_FLAGS\.\w+/);
    expect(body).not.toMatch(/\breturn true\b/);
  });

  it.each(keys)("%s 는 선언된 값을 돌려준다", (key) => {
    expect(isUnifiedFlag(key)).toBe(UNIFIED_ENGINE_FLAGS[key]);
  });

  it("false 로 선언된 플래그가 있다면 실제로도 false 다", () => {
    const declaredFalse = keys.filter((k) => !UNIFIED_ENGINE_FLAGS[k]);

    // 지금은 전부 true 라 공집합이다 — 그 경우 이 계약은 공허하게 통과하고,
    //   회귀 감시는 위 소스 텍스트 가드가 단독으로 맡는다.
    expect(declaredFalse.filter((k) => isUnifiedFlag(k))).toEqual([]);
  });
});

describe("flag 표 — 소비처 없는 항목 금지", () => {
  /**
   * 2026-08-15 에 소비자 0건 8개를 삭제한 기준을 고정한다. 삭제한 이름이
   * 되살아나면 "토글할 수 있는 것" 이라는 오해가 함께 되살아난다 —
   * `USE_CAMERA_OBJECT` 는 같은 날 삭제된 `viewport/Camera.ts` 를,
   * `REMOVE_PIXI` 는 이미 사라진 PixiJS ticker 정지 경로를 가리키고 있었다.
   */
  const REMOVED = [
    "USE_DOM_HOVER",
    "USE_DOM_CURSOR",
    "USE_CAMERA_OBJECT",
    "USE_SCENE_GRAPH",
    "USE_HYBRID_TEXT",
    "USE_CSS3_EFFECTS",
    "USE_TILE_CACHE",
    "REMOVE_PIXI",
  ];

  it("삭제된 소비처 없는 플래그가 되살아나지 않았다", () => {
    expect(
      REMOVED.filter((name) => keys.includes(name as UnifiedEngineFlag)),
    ).toEqual([]);
  });
});
