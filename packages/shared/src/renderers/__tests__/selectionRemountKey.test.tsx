import { describe, expect, it } from "vitest";
import { isValidElement } from "react";
import type { PreviewElement, RenderContext } from "../../types/renderer.types";
import {
  renderToggleButton,
  renderToggleButtonGroup,
} from "../CollectionRenderers";
import { renderTabs } from "../LayoutRenderers";
import {
  renderComboBox,
  renderGridList,
  renderListBox,
  renderSelect,
  renderSlider,
} from "../SelectionRenderers";

/**
 * 회귀 방지 — selection 계열 컴포넌트의 패널 prop 토글 re-mount (2026-06-30).
 *
 * **버그(전수조사)**: selection/value 를 uncontrolled(`default*`) 로 렌더하는 컴포넌트들은
 * mount 시점 값만 읽으므로, properties 패널에서 selection 을 토글해도 RAC 내부 상태가 그대로
 * → CSS preview 미반영. Skia 는 props.isSelected / selectedKeys 를 매 scene rebuild 직접 읽어
 * 즉시 반영(buildCatalogShapes / canvasSceneNode) → 두 렌더 경로(Skia vs CSS preview) drift.
 *
 * Checkbox/CheckboxGroup/RadioGroup 과 동종. 정적 교차조사로 drift 확정된 5개:
 *   ToggleButton / ToggleButtonGroup / Tabs / ListBox / GridList.
 *
 * **2026-08-22 — Select/ComboBox 편입**: 구 제외 사유("Skia selection 표시 미구현 → drift
 *   무의미")는 전제가 바뀌어 더는 성립하지 않는다. Skia SelectValue 가 owner 의
 *   selectedKey/selectedValue/inputValue 를 읽어 선택된 라벨을 그리게 되면서(design-data
 *   감사 §1-1), 두 경로가 같은 prop 을 보는 대칭 상태가 됐다. 그러면 uncontrolled 렌더의
 *   원래 결함이 드러난다 — undo/redo·history 복원처럼 **RAC 내부 state 를 거치지 않고**
 *   props 만 바뀌는 경로에서 Skia 는 즉시 바뀌고 DOM 은 이전 선택을 계속 표시한다.
 *   (Menu 는 여전히 제외 — 트리거 버튼만 캔버스에 렌더되고 항목은 Popover 라 Skia 대응물이 없다.)
 *
 * **fix**: uncontrolled 유지(preview 직접 클릭 UX 보존)하되 `key` 에 selection 시그니처를
 * 묶어 패널 토글 시 re-mount → 새 default 를 다시 읽게 한다.
 *
 * 본 테스트는 selection 상태가 바뀌면 root 컴포넌트 key 가 달라지는지 정적으로 확증한다.
 * key 가 element.id 단독으로 회귀하면 패널 토글이 다시 막힌다.
 */

function makeContext(
  element: PreviewElement,
  children: PreviewElement[],
  extraElements: PreviewElement[] = [],
): RenderContext {
  const all = [element, ...children, ...extraElements];
  const childrenByParent = new Map<string, PreviewElement[]>();
  childrenByParent.set(element.id, children);
  return {
    elements: all,
    elementsById: new Map(all.map((e) => [e.id, e] as const)),
    childrenByParent,
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    renderElement: () => null,
  };
}

function keyOf(node: unknown): string | null {
  expect(isValidElement(node)).toBe(true);
  return (node as { key: string | null }).key;
}

describe("selection 컴포넌트 패널 토글 re-mount (회귀 방지 2026-06-30)", () => {
  it("ToggleButton(단독): isSelected 변경 시 key 가 달라진다", () => {
    const tb: PreviewElement = {
      id: "tb-1",
      type: "ToggleButton",
      props: { isSelected: false },
    };
    const off = renderToggleButton(tb, makeContext(tb, []));
    const on = renderToggleButton(
      { ...tb, props: { isSelected: true } },
      makeContext({ ...tb, props: { isSelected: true } }, []),
    );
    expect(keyOf(off)).not.toBe(keyOf(on));
  });

  it("ToggleButton(group 안): key 는 element.id 단독(group 이 selection 전담)", () => {
    const group: PreviewElement = {
      id: "tbg-p",
      type: "ToggleButtonGroup",
      props: {},
    };
    const tb: PreviewElement = {
      id: "tb-in",
      type: "ToggleButton",
      props: { isSelected: false },
      parent_id: "tbg-p",
    };
    // 부모가 ToggleButtonGroup 이면 isInGroup=true → key 에 selection 미포함.
    const rendered = renderToggleButton(tb, makeContext(tb, [], [group]));
    expect(keyOf(rendered)).toBe("tb-in");
  });

  it("ToggleButtonGroup: 자식 selection 변경 시 key 가 달라진다", () => {
    const group: PreviewElement = {
      id: "tbg-1",
      type: "ToggleButtonGroup",
      props: { selectionMode: "single" },
    };
    const childOff: PreviewElement = {
      id: "tb-a",
      type: "ToggleButton",
      props: { isSelected: false },
      parent_id: "tbg-1",
    };
    const childOn: PreviewElement = {
      ...childOff,
      props: { isSelected: true },
    };
    const off = renderToggleButtonGroup(group, makeContext(group, [childOff]));
    const on = renderToggleButtonGroup(group, makeContext(group, [childOn]));
    expect(keyOf(off)).not.toBe(keyOf(on));
  });

  it("Tabs: defaultSelectedKey 변경 시 key 가 달라진다", () => {
    const tabs: PreviewElement = {
      id: "tabs-1",
      type: "Tabs",
      props: { defaultSelectedKey: "tab1" },
    };
    const a = renderTabs(tabs, makeContext(tabs, []));
    const b = renderTabs(
      { ...tabs, props: { defaultSelectedKey: "tab2" } },
      makeContext({ ...tabs, props: { defaultSelectedKey: "tab2" } }, []),
    );
    expect(keyOf(a)).not.toBe(keyOf(b));
  });

  it("ListBox: selectedKeys 변경 시 key 가 달라진다", () => {
    const lb: PreviewElement = {
      id: "lb-1",
      type: "ListBox",
      props: { selectionMode: "single", selectedKeys: [] },
    };
    const a = renderListBox(lb, makeContext(lb, []));
    const b = renderListBox(
      { ...lb, props: { selectionMode: "single", selectedKeys: ["row-2"] } },
      makeContext(
        { ...lb, props: { selectionMode: "single", selectedKeys: ["row-2"] } },
        [],
      ),
    );
    expect(keyOf(a)).not.toBe(keyOf(b));
  });

  it("GridList: selectedKeys 변경 시 key 가 달라진다", () => {
    const gl: PreviewElement = {
      id: "gl-1",
      type: "GridList",
      props: { selectionMode: "single", selectedKeys: [] },
    };
    const a = renderGridList(gl, makeContext(gl, []));
    const b = renderGridList(
      { ...gl, props: { selectionMode: "single", selectedKeys: ["card-3"] } },
      makeContext(
        { ...gl, props: { selectionMode: "single", selectedKeys: ["card-3"] } },
        [],
      ),
    );
    expect(keyOf(a)).not.toBe(keyOf(b));
  });

  it("Select: selectedKey 변경 시 key 가 달라진다", () => {
    const props = {
      items: [{ id: "opt-1", label: "A", value: "a" }],
      placeholder: "선택",
    };
    const sel: PreviewElement = { id: "sel-1", type: "Select", props };
    const picked: PreviewElement = {
      ...sel,
      props: { ...props, selectedKey: "opt-1", selectedValue: "a" },
    };
    expect(keyOf(renderSelect(sel, makeContext(sel, [])))).not.toBe(
      keyOf(renderSelect(picked, makeContext(picked, []))),
    );
  });

  it("ComboBox: inputValue 변경 시 key 가 달라진다 (자유 입력도 uncontrolled)", () => {
    const cb: PreviewElement = {
      id: "cb-1",
      type: "ComboBox",
      props: { items: [], inputValue: "" },
    };
    const typed: PreviewElement = {
      ...cb,
      props: { items: [], inputValue: "서울" },
    };
    expect(keyOf(renderComboBox(cb, makeContext(cb, [])))).not.toBe(
      keyOf(renderComboBox(typed, makeContext(typed, []))),
    );
  });

  // Slider 는 uncontrolled(defaultValue) 렌더 → value/min/max 편집 시 key 변경으로
  //   리마운트해야 새 defaultValue/range 가 RAC 내부 state 에 반영된다. key 가 value 만
  //   담으면 minValue/maxValue 편집이 리마운트를 못 걸어 RAC 가 이전 range 에 stale →
  //   thumb 위치가 Skia(store 값 기준 percent)와 발산 (2026-07-06 전수조사: value=50/
  //   max=63 이면 Skia 79% vs RAC clamp 100%).
  it("Slider: value 변경 시 key 가 달라진다", () => {
    const sl: PreviewElement = {
      id: "sl-1",
      type: "Slider",
      props: { value: 50, minValue: 0, maxValue: 100 },
    };
    const a = renderSlider(sl, makeContext(sl, []));
    const b = renderSlider(
      { ...sl, props: { value: 30, minValue: 0, maxValue: 100 } },
      makeContext(
        { ...sl, props: { value: 30, minValue: 0, maxValue: 100 } },
        [],
      ),
    );
    expect(keyOf(a)).not.toBe(keyOf(b));
  });

  it("Slider: maxValue 변경 시 key 가 달라진다 (range 편집 리마운트)", () => {
    const sl: PreviewElement = {
      id: "sl-2",
      type: "Slider",
      props: { value: 50, minValue: 0, maxValue: 100 },
    };
    const a = renderSlider(sl, makeContext(sl, []));
    const b = renderSlider(
      { ...sl, props: { value: 50, minValue: 0, maxValue: 63 } },
      makeContext(
        { ...sl, props: { value: 50, minValue: 0, maxValue: 63 } },
        [],
      ),
    );
    expect(keyOf(a)).not.toBe(keyOf(b));
  });

  it("Slider: minValue 변경 시 key 가 달라진다 (range 편집 리마운트)", () => {
    const sl: PreviewElement = {
      id: "sl-3",
      type: "Slider",
      props: { value: 50, minValue: 0, maxValue: 100 },
    };
    const a = renderSlider(sl, makeContext(sl, []));
    const b = renderSlider(
      { ...sl, props: { value: 50, minValue: 20, maxValue: 100 } },
      makeContext(
        { ...sl, props: { value: 50, minValue: 20, maxValue: 100 } },
        [],
      ),
    );
    expect(keyOf(a)).not.toBe(keyOf(b));
  });
});
