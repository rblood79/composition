import { describe, expect, it } from "vitest";
import { isValidElement } from "react";
import type { PreviewElement, RenderContext } from "../../types/renderer.types";
import {
  renderToggleButton,
  renderToggleButtonGroup,
} from "../CollectionRenderers";
import { renderTabs } from "../LayoutRenderers";
import { renderGridList, renderListBox } from "../SelectionRenderers";

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
 *   (Select/ComboBox/Menu 는 Skia selection 표시 미구현 → drift 무의미라 제외)
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
});
