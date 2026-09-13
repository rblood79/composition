/**
 * ADR-214 Phase 3 — preview DOM 의 `{{ }}` 런타임 값 해석 (R2 런타임 환경 leg).
 * - project 정의 기본값 → 텍스트 · 값 write → 의존 인덱스로 그 노드만 다시 렌더 (act 밖 동기)
 * - ref 인스턴스 안 요소 변수: 인스턴스별 instanceKey (ref root = refId · 그 안 요소 = `${refId}/${ownerId}`) 로 격리 (R3)
 * - 미해결 이름은 원문 유지
 */
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument, ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { getRuntimeStore } from "../../store";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

const ctx = {} as unknown as RenderContext;

const doc: CompositionDocument = {
  version: "composition-1.0",
  children: [
    {
      id: "home",
      type: "frame",
      metadata: { type: "page" },
      children: [
        { id: "inst-a", type: "ref", ref: "master" },
        { id: "inst-b", type: "ref", ref: "master" },
      ],
    },
    {
      id: "master",
      type: "frame",
      reusable: true,
      state: [
        { id: "v-open", name: "open", type: "boolean", defaultValue: false },
      ],
      children: [
        {
          id: "m-label",
          type: "Button",
          props: { children: "open={{ open }}" },
        },
      ],
    },
  ],
} as unknown as CompositionDocument;

function receive() {
  getRuntimeStore().getState().receiveCanonicalDocument({
    type: "UPDATE_CANONICAL_DOCUMENT",
    projectId: "p-state",
    documentRevision: Date.now(),
    document: doc,
  });
  getRuntimeStore().getState().setCurrentPageId("home");
  getRuntimeStore()
    .getState()
    .setVariables([
      {
        id: "v-user",
        name: "userName",
        type: "string",
        definitionDefault: "guest",
        persist: false,
        scope: "global",
        owner: { kind: "project" },
      },
    ]);
}

describe("CanonicalNodeRenderer — ADR-214 Phase 3 `{{ }}` 런타임 해석", () => {
  beforeEach(() => receive());

  it("project 변수 기본값으로 렌더 · write 뒤 갱신 · 미해결 이름은 원문", () => {
    const node: ResolvedNode = {
      id: "btn-1",
      type: "Button",
      props: { children: "Hi {{ userName }} / {{ nobody }}" },
    };
    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set(["Button"])}
      />,
    );
    const btn = container.querySelector("button")!;
    expect(btn.textContent).toBe("Hi guest / {{ nobody }}");
    act(() => {
      getRuntimeStore()
        .getState()
        .runtimeState.write({ variableId: "v-user", op: "set", value: "Ana" });
    });
    expect(btn.textContent).toBe("Hi Ana / {{ nobody }}");
  });

  it("ref 인스턴스 2개 — 같은 origin 요소 변수를 instanceKey 로 격리한다 (R3)", () => {
    const instance = (id: string): ResolvedNode =>
      ({
        id,
        type: "frame",
        _resolvedFrom: "master",
        state: [
          { id: "v-open", name: "open", type: "boolean", defaultValue: false },
        ],
        children: [
          {
            id: "m-label",
            type: "Button",
            props: { children: "open={{ open }}" },
          },
        ],
      }) as unknown as ResolvedNode;
    const { container } = render(
      <>
        <CanonicalNodeRenderer
          node={instance("inst-a")}
          renderContext={ctx}
          cutoverPrimitives={new Set(["Button", "frame"])}
        />
        <CanonicalNodeRenderer
          node={instance("inst-b")}
          renderContext={ctx}
          cutoverPrimitives={new Set(["Button", "frame"])}
        />
      </>,
    );
    const buttons = () =>
      [...container.querySelectorAll("button")].map((b) => b.textContent);
    expect(buttons()).toEqual(["open=false", "open=false"]);
    act(() => {
      getRuntimeStore()
        .getState()
        .runtimeState.write({
          variableId: "v-open",
          op: "toggle",
          scope: { kind: "element", instanceKey: "inst-a" },
        });
    });
    expect(buttons()).toEqual(["open=true", "open=false"]);
  });
});
