import { describe, expect, test } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { calculateContentWidth } from "../utils";

/**
 * ToggleButtonGroup intrinsic width 가 자식 ToggleButton 의 icon 을 반영하는지 회귀 검증
 * (2026-06-28).
 *
 * **근본 원인**: `calculateContentWidth` 의 togglebuttongroup 분기가 자식 버튼 폭을
 *   **label 텍스트만** 측정해 산출했다(`border + paddingX + textWidth + paddingX + border`).
 *   icon ToggleButton 은 RSP composite(`<ToggleButton><Icon/><Text/></ToggleButton>`, 자식
 *   Icon/Text element)라 icon width + icon↔text gap 이 빠져 group width 가 텍스트 기준으로만
 *   계산됐다 → CSS(fit-content, icon 포함 ~105px)와 비대칭 → Skia group selection 박스가
 *   icon 버튼을 못 감싸고 좁게(~81px) 그려졌다(사용자 보고: "icon 추가 시 group selection
 *   size 가 정상적으로 안 나타남").
 *
 * **수정**: togglebuttongroup 분기가 일반 flex 컨테이너 분기와 동일하게 자식의
 *   `calculateContentWidth` 재귀 + border-box 산출을 사용 → icon 자식 width 자동 포함.
 *   horizontal=합산+gap, vertical=max 유지.
 *
 * 검증: icon 자식(Icon+Text element)을 가진 group 이 텍스트-only group 보다 넓어야 한다.
 */

const SIZE = "md";

/** icon-only ToggleButton: string children (Icon element 없음). */
const textButton = (id: string, label: string): CanvasLayoutNode =>
  ({
    id,
    type: "ToggleButton",
    props: { size: SIZE, children: label },
  }) as CanvasLayoutNode;

/** RSP composite icon ToggleButton: 자식 Icon + Text element. */
const iconButton = (id: string, label: string): CanvasLayoutNode =>
  ({
    id,
    type: "ToggleButton",
    props: { size: SIZE, children: "" },
  }) as CanvasLayoutNode;

const iconChild = (id: string, parentId: string): CanvasLayoutNode =>
  ({
    id,
    type: "Icon",
    parent_id: parentId,
    props: {
      size: SIZE,
      iconName: "a-arrow-down",
      iconFontFamily: "lucide",
      style: { fontSize: 18, height: 18 },
    },
  }) as CanvasLayoutNode;

const textChild = (
  id: string,
  parentId: string,
  label: string,
): CanvasLayoutNode =>
  ({
    id,
    type: "Text",
    parent_id: parentId,
    props: { size: SIZE, children: label, style: { fontSize: 14 } },
  }) as CanvasLayoutNode;

const group = (orientation: "horizontal" | "vertical"): CanvasLayoutNode =>
  ({
    id: "tbg",
    type: "ToggleButtonGroup",
    props: {
      size: SIZE,
      orientation,
      style: { display: "flex" },
    },
  }) as CanvasLayoutNode;

describe("calculateContentWidth — ToggleButtonGroup icon 자식 width 반영", () => {
  test("icon 자식을 가진 ToggleButton 이 있는 group 은 텍스트-only group 보다 넓다 (horizontal)", () => {
    // text-only: 2 버튼 모두 string children
    const textChildren = [
      textButton("tb1", "Toggle 1"),
      textButton("tb2", "Toggle 2"),
    ];
    const textOnlyWidth = calculateContentWidth(
      group("horizontal"),
      textChildren,
      () => [],
    );

    // icon group: tb1 은 Icon+Text element 보유 (같은 라벨)
    const iconChildren = [
      iconButton("tb1", "Toggle 1"),
      textButton("tb2", "Toggle 2"),
    ];
    const grandChildren: Record<string, CanvasLayoutNode[]> = {
      tb1: [iconChild("ic1", "tb1"), textChild("tx1", "tb1", "Toggle 1")],
    };
    const iconGroupWidth = calculateContentWidth(
      group("horizontal"),
      iconChildren,
      (cid: string) => grandChildren[cid] ?? [],
    );

    expect(
      iconGroupWidth,
      "icon 자식(Icon+Text)을 가진 버튼이 있으면 group width 가 icon width + gap 만큼 커져야 한다",
    ).toBeGreaterThan(textOnlyWidth);
  });

  test("vertical group width = 가장 넓은 자식 (icon 버튼) 반영", () => {
    // icon 버튼이 가장 넓으므로 vertical group width 는 icon 버튼 폭과 같아야 한다
    const iconChildren = [
      iconButton("tb1", "Toggle 1"),
      textButton("tb2", "Toggle 2"),
    ];
    const grandChildren: Record<string, CanvasLayoutNode[]> = {
      tb1: [iconChild("ic1", "tb1"), textChild("tx1", "tb1", "Toggle 1")],
    };
    const verticalWidth = calculateContentWidth(
      group("vertical"),
      iconChildren,
      (cid: string) => grandChildren[cid] ?? [],
    );

    // icon 버튼 단독 width (border-box)
    const iconButtonWidth = calculateContentWidth(
      iconButton("tb1", "Toggle 1"),
      [iconChild("ic1", "tb1"), textChild("tx1", "tb1", "Toggle 1")],
      () => [],
    );

    // vertical group 은 max 자식이므로 icon 버튼 content width 이상이어야 한다
    expect(verticalWidth).toBeGreaterThanOrEqual(iconButtonWidth);
    // icon 없는 버튼 폭보다는 확실히 커야 한다
    const textButtonContentWidth = calculateContentWidth(
      textButton("tb2", "Toggle 2"),
      undefined,
      () => [],
    );
    expect(verticalWidth).toBeGreaterThan(textButtonContentWidth);
  });
});
