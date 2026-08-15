// @vitest-environment node
/**
 * Feature flag 표의 정직성 계약.
 *
 * **Why (2026-08-15 실측)**: `isUnifiedFlag` 가 `UNIFIED_ENGINE` 을 먼저 보고
 * true 면 즉시 true 를 돌려줬다. `UNIFIED_ENGINE: true` 인 지금 **모든 플래그가
 * true** 로 읽혀, 표에 `false` 로 적힌 6개가 거짓말이었다. 소비자가 0건이라
 * 무증상이었을 뿐 — 새 소비자가 붙으면 표를 읽고 판단한 쪽과 동작이 갈린다.
 */
import { describe, expect, it } from "vitest";
import {
  UNIFIED_ENGINE_FLAGS,
  isUnifiedFlag,
  type UnifiedEngineFlag,
} from "./featureFlags";

const keys = Object.keys(UNIFIED_ENGINE_FLAGS) as UnifiedEngineFlag[];

describe("isUnifiedFlag — 선언값 그대로", () => {
  it.each(keys)("%s 는 선언된 값을 돌려준다", (key) => {
    expect(isUnifiedFlag(key)).toBe(UNIFIED_ENGINE_FLAGS[key]);
  });

  it("false 로 선언된 플래그가 실제로 false 다", () => {
    const declaredFalse = keys.filter((k) => !UNIFIED_ENGINE_FLAGS[k]);

    // 표에 false 가 하나도 없다면 이 계약은 공허하게 통과한다 — 그 사실을 드러낸다.
    expect(declaredFalse.length).toBeGreaterThan(0);
    expect(declaredFalse.filter((k) => isUnifiedFlag(k))).toEqual([]);
  });
});
