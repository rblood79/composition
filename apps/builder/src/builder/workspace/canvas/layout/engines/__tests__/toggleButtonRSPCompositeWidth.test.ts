import { describe, it, expect } from "vitest";

import { calculateContentWidth } from "../utils";
import type { CanvasLayoutNode } from "../utils";

/**
 * 회귀 방지 — icon ToggleButton(RSP composite) 의 intrinsic content width 가 자식
 * Icon+gap+Text 를 합산해야 한다 (2026-06-28).
 *
 * **버그**: ToggleButtonGroup 선택 시 Skia selection box(=treeBoundsMap=Skia 노드 bounds)
 *   가 실제 시각(CSS Preview)보다 좁게 그려진다. group 의 intrinsic width 계산 경로 A
 *   (utils.ts:1366 `calculateContentWidth(child) + parseBoxModel`)가 자식 ToggleButton 의
 *   content width 를 `calculateContentWidth` 로 구하는데, icon ToggleButton 은 RSP composite
 *   (자식 Icon+Text element 보유)이고 store props.style 에 `display:flex` 가 없어서:
 *     - line 1453 flex 자식 합산 분기 미진입 (display 조건 불충족)
 *     - type "togglebutton" 이라 button 분기(1510) 미진입
 *     - children:"" 라 text 분기(1585) 미진입
 *   → 최종 fallback `DEFAULT_WIDTH`(80) 반환 → 자식 Icon width + gap 누락 → group width 가
 *   80 기반(예: XL 에서 group 260 vs DOM 308, 48px 부족)으로 좁게 계산.
 *
 * **수정**: button/togglebutton RSP-composite 전용 분기 추가 — 자식 Icon+Text element 가
 *   있으면 display:flex 여부와 무관하게 Icon width + iconGap + Text width 합산.
 *
 * 검증: XL ToggleButton(icon a-arrow-down 28px + "Toggle 1" 18px) content width 가
 *   fallback 80 이 아니라 자식 합산(Icon 28 + gap + Text ~72 ≈ 112)으로 산출.
 */

function makeXLToggleButton(): {
  tb: CanvasLayoutNode;
  icon: CanvasLayoutNode;
  text: CanvasLayoutNode;
  getChild: (id: string) => CanvasLayoutNode[];
} {
  const icon = {
    id: "ic1",
    type: "Icon",
    props: {
      variant: "default",
      size: "xl",
      strokeWidth: 2,
      iconFontFamily: "lucide",
      iconName: "a-arrow-down",
      style: { fontSize: 28, height: 28 },
    },
  } as unknown as CanvasLayoutNode;
  const text = {
    id: "tx1",
    type: "Text",
    props: {
      size: "xl",
      children: "Toggle 1",
      style: { fontSize: 18, lineHeight: "28px" },
    },
  } as unknown as CanvasLayoutNode;
  const tb = {
    id: "tb1",
    type: "ToggleButton",
    props: { children: "", isSelected: false, isDisabled: false, size: "xl" },
  } as unknown as CanvasLayoutNode;
  const kids: Record<string, CanvasLayoutNode[]> = { tb1: [icon, text] };
  const getChild = (id: string) => kids[id] ?? [];
  return { tb, icon, text, getChild };
}

describe("icon ToggleButton(RSP composite) intrinsic width (2026-06-28)", () => {
  it("자식 Icon+Text 를 합산한다 — fallback DEFAULT_WIDTH(80) 가 아님", () => {
    const { tb, icon, text, getChild } = makeXLToggleButton();
    const w = calculateContentWidth(tb, [icon, text], getChild);
    expect(
      w,
      "icon ToggleButton content width 가 fallback 80 으로 떨어지면 안 됨 (자식 합산 누락)",
    ).not.toBe(80);
    // Icon(28) + gap + Text(>= 60) — 최소한 Icon+Text 합 이상
    const iconW = calculateContentWidth(icon, [], getChild);
    const textW = calculateContentWidth(text, [], getChild);
    expect(
      w,
      "content width 가 최소 Icon + Text 합 이상이어야 함 (gap 포함하면 더 큼)",
    ).toBeGreaterThanOrEqual(iconW + textW);
  });

  it("Icon width(28) 와 Text width(>0) 가 0 이 아님 — 합산 전제 확인", () => {
    const { icon, text, getChild } = makeXLToggleButton();
    expect(calculateContentWidth(icon, [], getChild)).toBe(28);
    expect(calculateContentWidth(text, [], getChild)).toBeGreaterThan(0);
  });
});

describe("ToggleButtonGroup intrinsic width — icon 자식 포함 (2026-06-28)", () => {
  it("group width 가 icon 버튼을 감싸도록 자식 border-box 합산 (fallback 기반 좁은 폭 아님)", () => {
    const { tb, icon, text, getChild } = makeXLToggleButton();
    const tb2 = { ...tb, id: "tb2" } as CanvasLayoutNode;
    const group = {
      id: "grp",
      type: "ToggleButtonGroup",
      props: {
        type: "ToggleButtonGroup",
        size: "xl",
        orientation: "horizontal",
        selectionMode: "single",
        value: [],
      },
    } as unknown as CanvasLayoutNode;
    const kids: Record<string, CanvasLayoutNode[]> = {
      tb1: [icon, text],
      tb2: [icon, text],
    };
    const groupGetChild = (id: string) => kids[id] ?? getChild(id);
    const gw = calculateContentWidth(group, [tb, tb2], groupGetChild);
    // fallback 80 기반 group = (80 + 24 + 24 + 2) * 2 = 260. 정상 합산은 이보다 커야 함.
    expect(
      gw,
      "group width 가 fallback(260) 기반이면 안 됨 — 자식 icon+text 합산으로 더 넓어야 함",
    ).toBeGreaterThan(260);
  });
});
