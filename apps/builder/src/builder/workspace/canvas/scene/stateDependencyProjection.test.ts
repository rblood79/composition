// @vitest-environment node
/**
 * ADR-214 Phase 1 — G1 scene invalidation (R8 · HC4 · R5).
 *
 * state 정의 자체는 scene signature 밖이다. Canvas 가 기본값으로 소비하는 정의만
 * `CanvasSceneNode.stateDeps` (이름 → id · type · defaultValue) 로 투영되어 signature 에
 * 들어간다:
 * - 미사용 state 편집 (요소 · 페이지 · 프로젝트 어느 소유자든) → signature 불변 (sceneVersion +0)
 * - 소비 중인 defaultValue / name / type 편집 → 의존 노드 `stateDeps` 변경 + signature 변경 (+1)
 * - 비의존 노드의 signature 입력은 불변 (dependency set 만 갱신)
 */
import { describe, expect, it } from "vitest";
import type { CompositionDocument, VariableDef } from "@composition/shared";
import { buildCanvasSceneGraph } from "./canvasSceneNode";
import { createResolvedProjectionSignature } from "./buildSceneSnapshot";

const def = (
  id: string,
  name: string,
  extra: Partial<VariableDef> = {},
): VariableDef => ({ id, name, type: "string", ...extra });

function makeDoc(options: {
  pageState?: VariableDef[];
  cardState?: VariableDef[];
  greeting?: string;
}): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "page" },
        ...(options.pageState ? { state: options.pageState } : {}),
        children: [
          {
            id: "body",
            type: "Body",
            props: {},
            children: [
              {
                id: "card",
                type: "Card",
                props: {},
                ...(options.cardState ? { state: options.cardState } : {}),
                children: [
                  {
                    id: "greeting",
                    type: "Text",
                    props: {
                      children: options.greeting ?? "Hello {{ userName }}",
                    },
                  },
                  { id: "other", type: "Text", props: { children: "static" } },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function signatureOf(
  doc: CompositionDocument,
  projectVariables: VariableDef[],
) {
  const graph = buildCanvasSceneGraph(doc, { projectVariables });
  return {
    graph,
    signature: createResolvedProjectionSignature({
      elements: graph.nodes,
      pageSnapshots: new Map(),
    }),
  };
}

const guest = [def("v_user", "userName", { defaultValue: "guest" })];

describe("stateDeps 투영 — 소비 정의만 signature 에 든다", () => {
  it("소비 노드에만 stateDeps 가 실리고 (이름 → id/type/defaultValue), 비소비 노드는 필드 없음", () => {
    const { graph } = signatureOf(makeDoc({}), guest);
    expect(graph.nodesMap.get("greeting")?.stateDeps).toEqual([
      { name: "userName", id: "v_user", type: "string", defaultValue: "guest" },
    ]);
    expect(graph.nodesMap.get("other")).not.toHaveProperty("stateDeps");
    expect(graph.nodesMap.get("card")).not.toHaveProperty("stateDeps");
  });

  it("미사용 정의 편집은 signature 불변 — 프로젝트 · 페이지 · 요소 소유자 모두 (sceneVersion +0)", () => {
    const base = signatureOf(makeDoc({}), guest).signature;

    // 프로젝트에 미사용 변수 추가 · 편집
    expect(
      signatureOf(makeDoc({}), [
        ...guest,
        def("v_x", "unused", { defaultValue: 1 }),
      ]).signature,
    ).toBe(base);
    expect(
      signatureOf(makeDoc({}), [
        ...guest,
        def("v_x", "unused", { defaultValue: 2 }),
      ]).signature,
    ).toBe(base);
    // 페이지 · 요소 state 추가 (미사용)
    expect(
      signatureOf(makeDoc({ pageState: [def("v_p", "pageVar")] }), guest)
        .signature,
    ).toBe(base);
    expect(
      signatureOf(
        makeDoc({
          cardState: [def("v_c", "count", { type: "number", defaultValue: 0 })],
        }),
        guest,
      ).signature,
    ).toBe(base);
    expect(
      signatureOf(
        makeDoc({
          cardState: [def("v_c", "count", { type: "number", defaultValue: 9 })],
        }),
        guest,
      ).signature,
    ).toBe(base);
  });

  it("소비 중인 defaultValue 편집 (guest → Ana) 은 의존 노드 stateDeps 변경 + signature 변경 (+1), 비의존 노드 입력 불변", () => {
    const before = signatureOf(makeDoc({}), guest);
    const after = signatureOf(makeDoc({}), [
      def("v_user", "userName", { defaultValue: "Ana" }),
    ]);
    expect(after.signature).not.toBe(before.signature);
    expect(
      after.graph.nodesMap.get("greeting")?.stateDeps?.[0].defaultValue,
    ).toBe("Ana");
    // 비의존 노드는 같은 입력
    const strip = (n: unknown) =>
      JSON.stringify(n, (k, v) => (k === "sourceNode" ? undefined : v));
    expect(strip(after.graph.nodesMap.get("other"))).toBe(
      strip(before.graph.nodesMap.get("other")),
    );
    expect(strip(after.graph.nodesMap.get("card"))).toBe(
      strip(before.graph.nodesMap.get("card")),
    );
  });

  it("소비 중인 name / type 편집도 signature 변경 · 이름을 잃으면 미해결 항목으로 남아 재정의 시 다시 변한다", () => {
    const base = signatureOf(makeDoc({}), guest).signature;
    const renamed = signatureOf(makeDoc({}), [
      def("v_user", "user", { defaultValue: "guest" }),
    ]);
    expect(renamed.signature).not.toBe(base);
    expect(renamed.graph.nodesMap.get("greeting")?.stateDeps).toEqual([
      { name: "userName", id: null, type: null, defaultValue: undefined },
    ]);
    const retyped = signatureOf(makeDoc({}), [
      def("v_user", "userName", { type: "number", defaultValue: "guest" }),
    ]);
    expect(retyped.signature).not.toBe(base);
  });

  it("가까운 소유자가 이긴다 — 요소 state 가 같은 이름을 정의하면 그 기본값이 실린다", () => {
    const { graph } = signatureOf(
      makeDoc({
        cardState: [def("v_local", "userName", { defaultValue: "local" })],
      }),
      guest,
    );
    expect(graph.nodesMap.get("greeting")?.stateDeps?.[0]).toMatchObject({
      id: "v_local",
      defaultValue: "local",
    });
  });

  it("리터럴 \\{{ 는 소비가 아니다 · projectVariables 미주입이면 미해결로 (signature 는 여전히 참조를 본다)", () => {
    const { graph } = signatureOf(
      makeDoc({ greeting: "code: \\{{ userName }}" }),
      guest,
    );
    expect(graph.nodesMap.get("greeting")).not.toHaveProperty("stateDeps");
    const none = buildCanvasSceneGraph(makeDoc({}));
    expect(none.nodesMap.get("greeting")?.stateDeps).toEqual([
      { name: "userName", id: null, type: null, defaultValue: undefined },
    ]);
  });
});
