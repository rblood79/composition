import { describe, it, expect } from "vitest";

import { buildPropagationUpdates } from "../propagationEngine";
import { getPropagationRules, buttonIconPx } from "../propagationRegistry";

/**
 * 회귀 방지 — ToggleButtonGroup size 변경이 손자 Icon/Text(2단계 깊이)까지 전파 (2026-06-28).
 *
 * **버그**: group size 를 M→다른 size 로 바꾼 뒤(또는 이미 icon 보유 ToggleButton 이 있을 때)
 *   ToggleButton 자체 size 는 group size 를 상속하지만, 그 안의 자식 Icon/Text(icon ToggleButton =
 *   RSP composite)는 옛 size 가 잔존해 시각적으로 group size 를 안 따른다. Button(직접 선택) 은
 *   size 변경 시 1단계 전파(Button→Icon/Text)로 정상이지만, ToggleButton 은 group→ToggleButton→
 *   Icon/Text 의 **2단계 깊이**라 1단계 전파만 일어나 손자가 누락됐다.
 *
 * **근본 원인**: PropertiesPanel 의 propagation 은 선택된 element(group)의 rule 1회만 적용
 *   (cascade 없음). ToggleButtonGroup rule 은 `size → ToggleButton`(1단계)뿐이라 손자 Icon/Text 에
 *   안 닿았다.
 *
 * **수정**: ToggleButtonGroup rule 에 buttonPropagationRules 동형의 **2단계 childPath**
 *   (`["ToggleButton","Icon"]` / `["ToggleButton","Text"]`) rule 추가. resolveChildPath 가
 *   배열을 단계별 순회해 손자를 해석.
 *
 * 검증: group size 변경 시 buildPropagationUpdates 가 손자 Icon/Text element 의 업데이트를 생성.
 */

type El = { id: string; type: string; props: Record<string, unknown> };

function makeTree() {
  const icon: El = { id: "ic1", type: "Icon", props: { size: "md" } };
  const text: El = {
    id: "tx1",
    type: "Text",
    props: { size: "md", style: { fontSize: 14 } },
  };
  const tb1: El = { id: "tb1", type: "ToggleButton", props: { size: "md" } };
  const tb2: El = { id: "tb2", type: "ToggleButton", props: { size: "md" } };
  const group: El = {
    id: "grp",
    type: "ToggleButtonGroup",
    props: { size: "md" },
  };

  const childrenMap = new Map<string, El[]>([
    ["grp", [tb1, tb2]],
    ["tb1", [icon, text]], // icon ToggleButton
    ["tb2", []],
  ]);
  const elementsMap = new Map<string, El>([
    ["grp", group],
    ["tb1", tb1],
    ["tb2", tb2],
    ["ic1", icon],
    ["tx1", text],
  ]);
  return { group, childrenMap, elementsMap };
}

describe("ToggleButtonGroup size → 손자 Icon/Text 2단계 전파 (2026-06-28)", () => {
  it("group size 변경이 직속 ToggleButton 을 갱신한다 (1단계, 회귀 가드)", () => {
    const { group, childrenMap, elementsMap } = makeTree();
    const updates = buildPropagationUpdates(
      group,
      { size: "lg" },
      getPropagationRules("ToggleButtonGroup")!,
      childrenMap,
      elementsMap,
    );
    const tbUpdate = updates.find((u) => u.elementId === "tb1");
    expect(tbUpdate?.props?.size).toBe("lg");
  });

  it("group size 변경이 손자 Icon 의 size + fontSize/height(px)를 갱신한다 (2단계)", () => {
    const { group, childrenMap, elementsMap } = makeTree();
    const updates = buildPropagationUpdates(
      group,
      { size: "lg" },
      getPropagationRules("ToggleButtonGroup")!,
      childrenMap,
      elementsMap,
    );
    const iconUpdate = updates.find((u) => u.elementId === "ic1");
    expect(
      iconUpdate,
      "손자 Icon 업데이트 누락 — group→ToggleButton→Icon 2단계 전파 안 됨",
    ).toBeDefined();
    expect(iconUpdate?.props?.size).toBe("lg");
    // px(fontSize/height)는 buttonIconPx(lg) 로 강제
    const style = iconUpdate?.props?.style as
      | Record<string, unknown>
      | undefined;
    expect(style?.fontSize).toBe(buttonIconPx("lg"));
    expect(style?.height).toBe(buttonIconPx("lg"));
  });

  it("group size 변경이 손자 Text 의 fontSize/lineHeight(버튼 척도)를 갱신한다 (2단계)", () => {
    const { group, childrenMap, elementsMap } = makeTree();
    const updates = buildPropagationUpdates(
      group,
      { size: "lg" },
      getPropagationRules("ToggleButtonGroup")!,
      childrenMap,
      elementsMap,
    );
    const textUpdate = updates.find((u) => u.elementId === "tx1");
    expect(
      textUpdate,
      "손자 Text 업데이트 누락 — group→ToggleButton→Text 2단계 전파 안 됨",
    ).toBeDefined();
    const style = textUpdate?.props?.style as
      | Record<string, unknown>
      | undefined;
    expect(
      style?.fontSize,
      "Text fontSize 가 버튼 척도로 갱신돼야 함",
    ).toBeTypeOf("number");
    expect(
      style?.lineHeight,
      "Text lineHeight 가 'Npx' 문자열이어야 함",
    ).toMatch(/^\d+px$/);
  });

  it("group size 변경이 손자 Text 의 size prop 도 부모 size 로 갱신한다 (데이터 일관, 2026-06-28)", () => {
    const { group, childrenMap, elementsMap } = makeTree();
    const updates = buildPropagationUpdates(
      group,
      { size: "lg" },
      getPropagationRules("ToggleButtonGroup")!,
      childrenMap,
      elementsMap,
    );
    const textUpdate = updates.find((u) => u.elementId === "tx1");
    expect(
      textUpdate?.props?.size,
      "Text size prop 이 부모 size(lg)로 갱신돼야 함 — Icon 자식과 형제 size 일관",
    ).toBe("lg");
  });
});
