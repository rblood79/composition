import { describe, expect, it } from "vitest";
import { Children, isValidElement } from "react";
import type { PreviewElement, RenderContext } from "../../types/renderer.types";
import { renderCheckboxGroup, renderRadioGroup } from "../FormRenderers";

/**
 * 회귀 방지 — CheckboxGroup 선택 uncontrolled 패턴 (2026-06-18).
 *
 * **버그**: preview(CanonicalNodeRenderer)에서 CheckboxGroup 의 체크 선택이 전혀 작동하지 않았다.
 * RadioGroup 은 정상 작동(라이브 확인). root cause = CheckboxGroup 이 controlled `value={selectedValues}`
 * 였고, selectedValues 는 canonical ResolvedNode 트리(flattenNodeChildrenByParent)에서 추출한
 * props.isSelected 기반인데, onChange 는 runtime store 의 elements 배열만 갱신한다. canonical 렌더
 * 경로는 canonicalDocument 만 감시 → elements 변화가 resolve 재계산을 트리거하지 않아 selectedValues
 * 가 영원히 stale → 토글이 화면에 반영 안 됨(ADR-116/122 canonical 전환 잔존 결함).
 *
 * **fix**: renderRadioGroup 의 작동 패턴(`defaultValue` uncontrolled + 자식에 개별 onChange 없음)에
 * 맞춰 CheckboxGroup 도 `defaultValue` 로 전환. RAC 가 내부 상태로 토글을 즉시 표시하고, store 영속화는
 * 그룹 onChange 가 일괄 수행한다(표시는 RAC, 저장은 store 분리). 라이브 검증: 클릭 → checkmark(svg)
 * + data-selected, 재클릭 → 해제(양방향 toggle 정상).
 *
 * 본 테스트는 controlled(`value`) 회귀와 자식 개별 onChange 재도입을 정적으로 차단한다.
 */

function makeContext(
  group: PreviewElement,
  children: PreviewElement[],
): RenderContext {
  const childrenByParent = new Map<string, PreviewElement[]>();
  childrenByParent.set(group.id, children);
  return {
    elements: [group, ...children],
    elementsById: new Map([group, ...children].map((e) => [e.id, e] as const)),
    childrenByParent,
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    renderElement: () => null,
  };
}

type RenderedProps = { props: Record<string, unknown> };

/** 렌더 트리에서 특정 조건의 자식 element 들을 수집(`.checkbox-items` 내부 Checkbox 추출용). */
function collectByPredicate(
  node: unknown,
  predicate: (el: RenderedProps) => boolean,
  acc: RenderedProps[] = [],
): RenderedProps[] {
  if (!isValidElement(node)) return acc;
  const el = node as RenderedProps;
  if (predicate(el)) acc.push(el);
  const kids = (el.props as { children?: unknown }).children;
  Children.toArray(kids as never).forEach((child) =>
    collectByPredicate(child, predicate, acc),
  );
  return acc;
}

describe("CheckboxGroup 선택 uncontrolled 패턴 (회귀 방지 2026-06-18)", () => {
  const group: PreviewElement = {
    id: "cbg-1",
    type: "CheckboxGroup",
    props: {},
  };
  const cb1: PreviewElement = {
    id: "cb-1",
    type: "Checkbox",
    props: { children: "Option 1", isSelected: false },
    parent_id: "cbg-1",
  };
  const cb2: PreviewElement = {
    id: "cb-2",
    type: "Checkbox",
    props: { children: "Option 2", isSelected: true },
    parent_id: "cbg-1",
  };

  it("CheckboxGroup 은 controlled `value` 가 아니라 uncontrolled `defaultValue` 를 사용한다", () => {
    const rendered = renderCheckboxGroup(group, makeContext(group, [cb1, cb2]));
    expect(isValidElement(rendered)).toBe(true);
    const props = (rendered as RenderedProps).props;
    // controlled value 가 다시 들어오면 canonical 트리 stale 로 토글이 막힌다 → 금지.
    expect(props.value).toBeUndefined();
    // uncontrolled defaultValue 필수. 선택된 자식(cb-2)의 id 가 초기값에 포함.
    expect(Array.isArray(props.defaultValue)).toBe(true);
    expect(props.defaultValue).toContain("cb-2");
    expect(props.defaultValue).not.toContain("cb-1");
  });

  it("자식 Checkbox 에 개별 onChange 를 주지 않는다(그룹 onChange 와 경합 방지)", () => {
    const rendered = renderCheckboxGroup(group, makeContext(group, [cb1, cb2]));
    const childCheckboxes = collectByPredicate(
      rendered,
      (el) => "value" in el.props && el.props.value === "cb-1",
    );
    // 자식 Checkbox 가 렌더되었고, 거기에 onChange 핸들러가 없어야 한다.
    expect(childCheckboxes.length).toBeGreaterThan(0);
    for (const child of childCheckboxes) {
      expect(child.props.onChange).toBeUndefined();
    }
  });

  it("그룹 onChange 는 유지(store 영속화 — 표시는 RAC, 저장은 store 분리)", () => {
    const rendered = renderCheckboxGroup(group, makeContext(group, [cb1, cb2]));
    const props = (rendered as RenderedProps).props;
    expect(typeof props.onChange).toBe("function");
  });

  it("작동 참조: RadioGroup 도 동일하게 uncontrolled `defaultValue` 패턴이다", () => {
    const rg: PreviewElement = { id: "rg-1", type: "RadioGroup", props: {} };
    const r1: PreviewElement = {
      id: "r-1",
      type: "Radio",
      props: { value: "a" },
      parent_id: "rg-1",
    };
    const rendered = renderRadioGroup(rg, makeContext(rg, [r1]));
    const props = (rendered as RenderedProps).props;
    expect(props.value).toBeUndefined();
    expect(props.defaultValue).toBeDefined();
  });
});
