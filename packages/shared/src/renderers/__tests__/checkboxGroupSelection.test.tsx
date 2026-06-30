import { describe, expect, it } from "vitest";
import { Children, isValidElement } from "react";
import type { PreviewElement, RenderContext } from "../../types/renderer.types";
import {
  renderCheckbox,
  renderCheckboxGroup,
  renderRadioGroup,
} from "../FormRenderers";

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

/**
 * 회귀 방지 — 패널 prop 토글 시 selected re-mount (2026-06-29).
 *
 * **버그**: Checkbox/CheckboxGroup/RadioGroup 은 preview 에서 uncontrolled
 * (`defaultSelected`/`defaultValue`) 로 렌더된다. uncontrolled 는 mount 시점 값만
 * 읽으므로, properties 패널에서 isSelected/value 를 토글해도 RAC 내부 상태가 그대로 →
 * DOM 미반영. Skia 는 props.isSelected 를 매 scene rebuild 마다 직접 읽어 즉시 반영 →
 * 두 렌더 경로(Skia vs CSS preview) drift. (라이브 확인: store=true 인데 preview
 * input.checked=false 그대로.)
 *
 * **fix**: uncontrolled 패턴은 유지(preview 직접 클릭 UX 보존 — 기존 회귀 테스트)하되,
 * `key` 에 selected 시그니처를 묶어 패널 토글 시 RAC 를 re-mount → 새 default 를 다시
 * 읽게 한다. preview 직접 클릭은 onChange→store 갱신 후 같은 값으로 key 가 재계산되어
 * 불필요한 re-mount 없이 정상.
 *
 * 본 테스트는 key 가 selected 상태를 포함하는지(상태 변경 → key 변경 → re-mount)를
 * 정적으로 확증한다. key 가 element.id 단독으로 회귀하면 패널 토글이 다시 막힌다.
 */
describe("패널 prop 토글 시 selected re-mount (회귀 방지 2026-06-29)", () => {
  it("단독 Checkbox: isSelected 변경 시 key 가 달라진다(re-mount 유도)", () => {
    const base: PreviewElement = {
      id: "cb-solo",
      type: "Checkbox",
      props: { isSelected: false },
    };
    const off = renderCheckbox(base, makeContext(base, []));
    const on = renderCheckbox(
      { ...base, props: { isSelected: true } },
      makeContext(base, []),
    );
    expect(isValidElement(off)).toBe(true);
    expect(isValidElement(on)).toBe(true);
    const offKey = (off as { key: string | null }).key;
    const onKey = (on as { key: string | null }).key;
    // key 가 selected 상태를 반영해야 패널 토글이 RAC re-mount 를 유도한다.
    expect(offKey).not.toBe(onKey);
    // uncontrolled 계약은 유지(controlled isSelected 회귀 금지).
    expect((on as RenderedProps).props.isSelected).toBeUndefined();
    expect((on as RenderedProps).props.defaultSelected).toBe(true);
  });

  it("단독 Checkbox: isIndeterminate 변경도 key 에 반영된다", () => {
    const base: PreviewElement = {
      id: "cb-ind",
      type: "Checkbox",
      props: { isSelected: false, isIndeterminate: false },
    };
    const a = renderCheckbox(base, makeContext(base, []));
    const b = renderCheckbox(
      { ...base, props: { isSelected: false, isIndeterminate: true } },
      makeContext(base, []),
    );
    expect((a as { key: string | null }).key).not.toBe(
      (b as { key: string | null }).key,
    );
  });

  it("CheckboxGroup: 자식 selection 변경 시 key 가 달라진다", () => {
    const group: PreviewElement = {
      id: "cbg-rm",
      type: "CheckboxGroup",
      props: {},
    };
    const childOff: PreviewElement = {
      id: "cb-x",
      type: "Checkbox",
      props: { isSelected: false },
      parent_id: "cbg-rm",
    };
    const childOn: PreviewElement = {
      ...childOff,
      props: { isSelected: true },
    };
    const off = renderCheckboxGroup(group, makeContext(group, [childOff]));
    const on = renderCheckboxGroup(group, makeContext(group, [childOn]));
    expect((off as { key: string | null }).key).not.toBe(
      (on as { key: string | null }).key,
    );
    // uncontrolled defaultValue 유지(controlled value 회귀 금지).
    expect((on as RenderedProps).props.value).toBeUndefined();
    expect((on as RenderedProps).props.defaultValue).toContain("cb-x");
  });

  it("RadioGroup: value 변경 시 key 가 달라진다", () => {
    const rg: PreviewElement = { id: "rg-rm", type: "RadioGroup", props: {} };
    const r1: PreviewElement = {
      id: "r-a",
      type: "Radio",
      props: { value: "a" },
      parent_id: "rg-rm",
    };
    const off = renderRadioGroup(rg, makeContext(rg, [r1]));
    const on = renderRadioGroup(
      { ...rg, props: { value: "a" } },
      makeContext(rg, [r1]),
    );
    expect((off as { key: string | null }).key).not.toBe(
      (on as { key: string | null }).key,
    );
    // uncontrolled defaultValue 유지(controlled value 회귀 금지).
    expect((on as RenderedProps).props.value).toBeUndefined();
    expect((on as RenderedProps).props.defaultValue).toBe("a");
  });
});

/**
 * 회귀 방지 — RadioGroup 이 자식 Radio 의 isSelected 를 정본으로 honor (2026-06-29).
 *
 * **버그**: RadioGroup 의 defaultValue/key 가 그룹 `element.props.value` 만 읽어, 개별
 * Radio 의 isSelected 를 패널에서 토글해도 CSS preview 에 반영 안 됨(Skia 는 radio
 * primitive 가 props.isSelected 직접 읽어 즉시 반영 → 두 경로 drift). 라이브 확인:
 * store r2.isSelected=true, rgValue="" 인데 preview 어떤 radio 도 선택 안 됨.
 *
 * **reference 근거**: RAC Radio 에는 isSelected prop 이 없고 선택은 그룹 value 로만 표현
 * (RadioGroup.md API). 그러나 composition catalog 는 Radio.binding 에 "Selected" 토글을
 * 노출(states/renderProps: ["isSelected"])하고 Skia 가 이를 정본으로 그린다. preview 도
 * 같은 정본을 따르되 RAC 계약(value/defaultValue) 안에서 honor 하려면 "isSelected=true 인
 * Radio 의 value" 를 그룹 defaultValue 로 번역한다(CheckboxGroup getSelectedChildIds 동형,
 * 단일 선택이라 첫 매치만).
 *
 * 본 테스트는 그룹 value 가 비어도 자식 isSelected 가 defaultValue/key 에 반영되는지 확증.
 */
describe("RadioGroup 자식 isSelected honor (회귀 방지 2026-06-29)", () => {
  const rg: PreviewElement = { id: "rg-h", type: "RadioGroup", props: {} };
  const rA: PreviewElement = {
    id: "ra",
    type: "Radio",
    props: { value: "a", isSelected: false },
    parent_id: "rg-h",
  };
  const rB: PreviewElement = {
    id: "rb",
    type: "Radio",
    props: { value: "b", isSelected: true },
    parent_id: "rg-h",
  };

  it("그룹 value 가 비어도 isSelected=true 인 자식의 value 를 defaultValue 로 쓴다", () => {
    const rendered = renderRadioGroup(rg, makeContext(rg, [rA, rB]));
    const props = (rendered as RenderedProps).props;
    // 그룹 value 는 "" 인데 자식 rB.isSelected=true → defaultValue="b" 여야 한다.
    expect(props.value).toBeUndefined(); // controlled value 회귀 금지
    expect(props.defaultValue).toBe("b");
  });

  it("자식 isSelected 변경 시 key 가 달라진다(re-mount 유도)", () => {
    const before = renderRadioGroup(rg, makeContext(rg, [rA, rB]));
    // rB 해제, rA 선택으로 전환
    const rAOn = { ...rA, props: { value: "a", isSelected: true } };
    const rBOff = { ...rB, props: { value: "b", isSelected: false } };
    const after = renderRadioGroup(rg, makeContext(rg, [rAOn, rBOff]));
    expect((before as { key: string | null }).key).not.toBe(
      (after as { key: string | null }).key,
    );
    expect((after as RenderedProps).props.defaultValue).toBe("a");
  });

  it("자식 isSelected 가 모두 false 면 그룹 value 로 fallback", () => {
    const rAOff = { ...rA, props: { value: "a", isSelected: false } };
    const rBOff = { ...rB, props: { value: "b", isSelected: false } };
    const rendered = renderRadioGroup(
      { ...rg, props: { value: "a" } },
      makeContext(rg, [rAOff, rBOff]),
    );
    const props = (rendered as RenderedProps).props;
    expect(props.defaultValue).toBe("a");
  });
});
