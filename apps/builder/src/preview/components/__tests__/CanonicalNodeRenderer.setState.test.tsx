/**
 * ADR-214 Phase 4 — 규칙 `setState` 가 preview 런타임 값을 바꾸고 소비 노드가 갱신된다 (App 없이 같은
 * 배선: `createPreviewEventHandlerMap` + preview 의 writeState 규칙).
 * - Button onPress → increment 프로젝트 변수 → Text "{{ count }}" 갱신
 * - ref 인스턴스 2 — 각자의 버튼이 각자의 요소 변수만 (R3)
 * - 암묵 상태 미러: Checkbox isSelected 에 이름을 붙이면 onChange 가 런타임 값이 되고 `{{ }}` 로 읽힌다 (R6)
 */
import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildInteractionIndex,
  type CompositionDocument,
  type DispatchDeps,
  type ResolvedNode,
} from "@composition/shared";

import { getRuntimeStore } from "../../store";
import type { PreviewElement, RenderContext } from "../../types/index";
import { createPreviewEventHandlerMap } from "../../interactions/createPreviewEventHandlerMap";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

const doc: CompositionDocument = {
  version: "composition-1.0",
  children: [
    {
      id: "home",
      type: "frame",
      metadata: { type: "page" },
      children: [
        { id: "inst-a", type: "ref", ref: "card" },
        { id: "inst-b", type: "ref", ref: "card" },
      ],
    },
    {
      id: "card",
      type: "frame",
      reusable: true,
      state: [{ id: "v-n", name: "n", type: "number", defaultValue: 0 }],
      children: [
        { id: "card-btn", type: "Button", props: { children: "+" } },
        { id: "card-text", type: "Button", props: { children: "n={{ n }}" } },
      ],
    },
    {
      id: "check",
      type: "Checkbox",
      props: { children: "agree" },
      state: [
        {
          id: "v-agree",
          name: "agree",
          type: "boolean",
          defaultValue: false,
          source: { prop: "isSelected" },
        },
      ],
    },
  ],
} as unknown as CompositionDocument;

function makeContext(rules: unknown[]): RenderContext {
  const store = getRuntimeStore();
  const deps: DispatchDeps = {
    getElement: () => undefined,
    updateElementProps: () => {},
    navigate: () => {},
    showToast: () => {},
    writeState: ({ variableId, op, value, instanceKeyFor }) => {
      const { runtimeState } = store.getState();
      const definition = runtimeState.getDefinition(variableId);
      if (!definition) return { ok: false, reason: "no def" };
      const owner = definition.owner;
      const scope =
        owner.kind === "element"
          ? {
              kind: "element" as const,
              instanceKey: instanceKeyFor?.(owner.elementId) ?? owner.elementId,
            }
          : owner.kind === "page"
            ? { kind: "page" as const, pageId: owner.pageId }
            : { kind: "project" as const };
      const result = runtimeState.write({ variableId, op, value, scope });
      return { ok: result.ok, reason: result.reason };
    },
  };
  const interactionIndex = buildInteractionIndex(rules);
  return {
    elements: [],
    elementsById: new Map(),
    childrenByParent: new Map(),
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    renderElement: () => null,
    services: {
      createEventHandlerMap: (element: PreviewElement) =>
        createPreviewEventHandlerMap(element, {
          interactionIndex,
          interactionDeps: deps,
          getRuntimeState: () => store.getState().runtimeState,
        }),
    },
  } as unknown as RenderContext;
}

beforeEach(() => {
  const store = getRuntimeStore().getState();
  store.receiveCanonicalDocument({
    type: "UPDATE_CANONICAL_DOCUMENT",
    projectId: `p-${Date.now()}`,
    documentRevision: Date.now(),
    document: doc,
  });
  store.setCurrentPageId("home");
  store.setVariables([
    {
      id: "v-count",
      name: "count",
      type: "number",
      definitionDefault: 0,
      persist: false,
      scope: "global",
      owner: { kind: "project" },
    },
  ]);
});

const cutover = new Set(["Button", "frame", "Checkbox"]);

describe("CanonicalNodeRenderer — ADR-214 Phase 4 setState", () => {
  it("Button onPress → setState increment (프로젝트 변수) → 소비 Text 갱신 · 인스턴스 2 는 각자 격리", () => {
    const rules = [
      {
        id: "r-count",
        type: "interaction",
        elementId: "btn",
        trigger: "onPress",
        action: { kind: "setState", variableId: "v-count", op: "increment" },
      },
      {
        id: "r-n",
        type: "interaction",
        elementId: "card-btn",
        trigger: "onPress",
        action: {
          kind: "setState",
          variableId: "v-n",
          op: "increment",
          value: 5,
        },
      },
    ];
    const ctx = makeContext(rules);
    const instance = (id: string): ResolvedNode =>
      ({
        id,
        type: "frame",
        _resolvedFrom: "card",
        state: [{ id: "v-n", name: "n", type: "number", defaultValue: 0 }],
        children: [
          { id: "card-btn", type: "Button", props: { children: "+" } },
          { id: "card-text", type: "Button", props: { children: "n={{ n }}" } },
        ],
      }) as unknown as ResolvedNode;
    const { container } = render(
      <>
        <CanonicalNodeRenderer
          node={{
            id: "btn",
            type: "Button",
            props: { children: "count={{ count }}" },
          }}
          renderContext={ctx}
          cutoverPrimitives={cutover}
        />
        <CanonicalNodeRenderer
          node={instance("inst-a")}
          renderContext={ctx}
          cutoverPrimitives={cutover}
        />
        <CanonicalNodeRenderer
          node={instance("inst-b")}
          renderContext={ctx}
          cutoverPrimitives={cutover}
        />
      </>,
    );
    const texts = () =>
      [...container.querySelectorAll("button")].map((b) => b.textContent);
    expect(texts()).toEqual(["count=0", "+", "n=0", "+", "n=0"]);
    const buttons = container.querySelectorAll("button");
    act(() => {
      fireEvent.click(buttons[0]);
      fireEvent.click(buttons[0]);
    });
    expect(texts()[0]).toBe("count=2");
    act(() => {
      fireEvent.click(buttons[1]); // inst-a 의 +
    });
    expect(texts()).toEqual(["count=2", "+", "n=5", "+", "n=0"]);
  });

  it("암묵 상태 미러 — 이름 붙인 Checkbox isSelected 의 onChange 가 런타임 값이 되고 {{ agree }} 로 읽힌다", () => {
    const ctx = makeContext([]);
    const checkNode = doc.children[2] as ResolvedNode;
    const { container } = render(
      <>
        <CanonicalNodeRenderer
          node={checkNode}
          renderContext={ctx}
          cutoverPrimitives={cutover}
        />
        <CanonicalNodeRenderer
          node={{
            id: "label",
            type: "Button",
            props: { children: "agree={{ agree }}" },
          }}
          renderContext={ctx}
          cutoverPrimitives={cutover}
        />
      </>,
    );
    const label = () => container.querySelector("button")!.textContent;
    // 프로젝트 레벨 노드 (check 의 자식이 아님) 는 요소 변수를 못 본다 — 미해결 원문
    expect(label()).toBe("agree={{ agree }}");
    const input = container.querySelector('input[type="checkbox"]')!;
    act(() => {
      fireEvent.click(input);
    });
    expect(
      getRuntimeStore()
        .getState()
        .runtimeState.read("v-agree", {
          kind: "element",
          instanceKey: "check",
        }),
    ).toBe(true);
  });
});
