/**
 * block-child `width:100%` 보정의 부모 게이트 (2026-07-14).
 *
 * **배경 (TagGroup labelPosition="side" CSS↔Skia 비대칭)**:
 *   `fullTreeLayout` 5.5 블록은 flex-row-wrap 부모 안의 block-level 자식에
 *   `width:100%` 를 주입한다. 이 보정의 대상은 **IFC 시뮬레이션 부모**뿐이다
 *   (CSS block container + inline-level 자식 → `toTaffyDisplay` 가 row+wrap 합성.
 *   CSS 상 block container 안의 block 자식은 부모 폭 100% 이므로 재현이 맞다).
 *
 *   그러나 게이트가 **결과 style**(`display:flex && flexWrap:wrap`)만 보고 있어
 *   **사용자/카탈로그가 선언한 진짜 CSS flex 컨테이너**까지 오폭했다. CSS flex item 은
 *   block-level 이어도 부모 폭 100% 가 되지 않는다 (flex-basis/grow 가 폭을 정한다).
 *
 *   실제 사고: `labelPosition="side"` TagGroup 은 catalog containerVariants 로
 *   `display:flex + flexDirection:row + flexWrap:wrap` 이 된다. 그 자식 TagList 는
 *   `flex:1 / flexBasis:0%` 를 받았는데도 본 보정이 `width:100%` 를 덮어써 350px 로
 *   고정 → `Label(68) + gap(4) + TagList(350) > 350` → TagList 가 **둘째 줄로 wrap**.
 *   Skia 만 세로 배치가 되고 DOM(flex-basis 우선)은 가로 배치 → CSS↔Skia 비대칭.
 */

import { describe, expect, it } from "vitest";
import {
  isInlineBlockSimulationParent,
  needsBlockChildFullWidth,
} from "../taffyDisplayAdapter";

describe("isInlineBlockSimulationParent — width:100% 보정의 부모 게이트", () => {
  // ── 회귀 게이트: 진짜 flex 컨테이너는 보정 대상이 아니다 ──────────────────
  it("display:flex 컨테이너는 시뮬레이션이 아니다 (TagGroup side 회귀)", () => {
    // side 모드 TagGroup 이 정확히 이 형태 — 보정이 걸리면 TagList 가 100% 로 고정돼
    //   Label 옆에 못 들어가고 둘째 줄로 wrap 된다.
    expect(isInlineBlockSimulationParent("flex")).toBe(false);
  });

  it("inline-flex / grid / inline-grid 도 시뮬레이션이 아니다", () => {
    expect(isInlineBlockSimulationParent("inline-flex")).toBe(false);
    expect(isInlineBlockSimulationParent("grid")).toBe(false);
    expect(isInlineBlockSimulationParent("inline-grid")).toBe(false);
  });

  // ── 보존: IFC 시뮬레이션은 계속 보정 대상 ────────────────────────────────
  it("block / flow-root 부모는 시뮬레이션 대상 (기존 보정 보존)", () => {
    // block 부모 + inline-block 자식 → toTaffyDisplay 가 row+wrap 을 합성하는 경로.
    expect(isInlineBlockSimulationParent("block")).toBe(true);
    expect(isInlineBlockSimulationParent("flow-root")).toBe(true);
  });

  it("inline-block 부모도 시뮬레이션 대상 (inner=flow-root)", () => {
    expect(isInlineBlockSimulationParent("inline-block")).toBe(true);
  });
});

describe("needsBlockChildFullWidth — 자식 축 판정 (부모 게이트와 조합)", () => {
  it("width 없는 block-level 자식은 보정 대상", () => {
    expect(needsBlockChildFullWidth("block", undefined)).toBe(true);
    expect(needsBlockChildFullWidth("block", "auto")).toBe(true);
    // TagList 는 display:flex(=block-level) + store width 없음 → 자식 축만 보면 true.
    //   부모 게이트가 없으면 side TagGroup 에서 오폭된다.
    expect(needsBlockChildFullWidth("flex", undefined)).toBe(true);
  });

  it("명시 width 가 있거나 inline-level 이면 보정 제외", () => {
    expect(needsBlockChildFullWidth("block", "120px")).toBe(false);
    expect(needsBlockChildFullWidth("inline-block", undefined)).toBe(false);
  });

  it("side TagGroup(flex 부모) × TagList(flex 자식) 조합은 최종 보정 제외", () => {
    const parentIsSimulation = isInlineBlockSimulationParent("flex");
    const childNeeds = needsBlockChildFullWidth("flex", undefined);
    // 자식 축 단독으로는 true 지만, 부모 게이트가 false 라 최종 보정은 적용되지 않는다.
    expect(childNeeds).toBe(true);
    expect(parentIsSimulation && childNeeds).toBe(false);
  });
});
