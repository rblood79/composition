/**
 * (ADR-923 Phase 5, 2026-09-02) 구 `needsBlockChildFullWidth` / `isInlineBlockSimulationParent` 게이트의
 * 후신 — 두 helper 와 fullTreeLayout §5.5 의 block 형제 width:100% 보정은 삭제됐다 (breakdown §2.2 S2).
 * 회귀 사유는 그대로다: side 모드 TagGroup(flex 부모) 의 TagList(`flex:1`) 에 TS 가 width:100% 를 덮어쓰면
 * 둘째 줄로 wrap 됐다 (2026-07-14). 이제 보정 자체가 없으므로 "보정 코드가 다시 생기지 않는다" 를 정적으로
 * 고정한다 — block 컨테이너 안 block 자식의 auto → stretch 는 엔진 block.rs 가 맡는다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as adapter from "../taffyDisplayAdapter";

describe("ADR-923 Phase 5 — block 형제 width:100% 보정 (S2) 부재 잠금", () => {
  it("IFC 시뮬레이션 helper 는 export 되지 않는다", () => {
    expect("needsBlockChildFullWidth" in adapter).toBe(false);
    expect("isInlineBlockSimulationParent" in adapter).toBe(false);
    expect("blockifyDisplay" in adapter).toBe(false);
  });

  it("fullTreeLayout 에 batch width:100% 주입 코드가 없다", () => {
    const src = readFileSync(
      resolve(__dirname, "../fullTreeLayout.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/style\.width = "100%"/);
    // 호출 형태만 잡는다 — 삭제 이력을 적은 주석의 이름은 허용
    expect(src).not.toMatch(
      /(?:needsBlockChildFullWidth|isInlineBlockSimulationParent|blockifyDisplay)\(/,
    );
  });
});
