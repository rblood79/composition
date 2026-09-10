// @vitest-environment node
/**
 * ADR-194 Phase 5 — Chart 의 데이터 행 주입 (R8 / R4).
 *
 * `chart_scene` primitive 의 ctx 에는 데이터 채널이 없다 (`SkiaPrimitiveDrawFn` 은
 * props/size/visual/paint/style). 그래서 행 해석은 다른 컬렉션과 같은 자리 —
 * scene-node 층 — 에서 하고 결과만 `_chartRows` 로 넣는다. 이 테스트가 그 배선을
 * 고정한다: 바인딩이 실제로 행을 실어 보내는지, 없으면 **주입하지 않아서** primitive 가
 * 샘플로 떨어지는지, 그리고 **Canvas 전용 slice 가 없는지** (ADR-211 — 구 200행 샘플 상수는
 * 삭제됐고 행 상한 `R` 은 spec `resolveChartModel` 이 두 leg 에 같이 건다).
 */
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { buildCanvasSceneGraph } from "./canvasSceneNode";

const SAMPLE = [
  { category: "Mon", value: 12 },
  { category: "Tue", value: 30 },
];

function makeDocument(
  chartProps: Record<string, unknown>,
): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "body-1",
        type: "Body",
        props: {},
        children: [{ id: "chart-1", type: "Chart", props: chartProps }],
      },
    ],
  } as unknown as CompositionDocument;
}

function chartProps(
  doc: CompositionDocument,
  collections?: Parameters<typeof buildCanvasSceneGraph>[1] extends infer O
    ? O extends { collections?: infer C }
      ? C
      : never
    : never,
): Record<string, unknown> {
  const graph = buildCanvasSceneGraph(doc, collections ? { collections } : {});
  const node = graph.nodesMap.get("chart-1");
  expect(node, "Chart scene node 가 만들어졌다").toBeDefined();
  return node!.props as Record<string, unknown>;
}

function rowsOf(count: number): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) => ({
    category: `c${i}`,
    value: i,
  }));
}

describe("Chart 행 주입 (ADR-194/209/211)", () => {
  for (const count of [201, 5000])
    it(`정적 ${count}행은 주입 없이 props.data 전체가 primitive 로 간다 (Canvas slice 0)`, () => {
      const rows = rowsOf(count);
      const props = chartProps(makeDocument({ data: rows }));
      expect(props._chartRows).toBeUndefined();
      expect(props.data).toHaveLength(count);
    });
  it("dataBinding 이 없으면 _chartRows 를 넣지 않는다 (primitive 가 props.data 샘플로 떨어진다)", () => {
    const props = chartProps(makeDocument({ data: SAMPLE }));
    expect(props._chartRows).toBeUndefined();
    expect(props.data).toEqual(SAMPLE);
  });

  it("dataTable 바인딩의 행을 _chartRows 로 싣는다", () => {
    const doc = makeDocument({
      data: SAMPLE,
      dataBinding: { type: "collection", source: "dataTable", name: "sales" },
    });
    const props = chartProps(doc, [
      { name: "sales", useMockData: true, mockData: rowsOf(3) },
    ] as never);
    expect(props._chartRows).toHaveLength(3);
    expect((props._chartRows as Array<Record<string, unknown>>)[0]).toEqual({
      category: "c0",
      value: 0,
    });
  });

  it("바인딩이 성공한 0행이면 빈 배열을 주입해 샘플 재대체를 막는다", () => {
    const doc = makeDocument({
      data: SAMPLE,
      dataBinding: { type: "collection", source: "dataTable", name: "sales" },
    });
    const props = chartProps(doc, [
      { name: "sales", useMockData: true, mockData: [] },
    ] as never);
    expect(props._chartRows).toEqual([]);
  });

  it("바인딩 행은 몇 행이든 전부 싣는다 — 구 200행 slice 가 없다 (ADR-211 G1 — 구 샘플 상수 참조 0)", () => {
    const doc = makeDocument({
      dataBinding: { type: "collection", source: "dataTable", name: "sales" },
    });
    const props = chartProps(doc, [
      { name: "sales", useMockData: true, mockData: rowsOf(250) },
    ] as never);
    expect(props._chartRows).toHaveLength(250);
    expect(
      (props._chartRows as Array<Record<string, unknown>>)[249].category,
    ).toBe("c249");
  });

  it("Chart 가 아닌 노드에는 _chartRows 가 붙지 않는다", () => {
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "body-1",
          type: "Body",
          props: {},
          children: [
            {
              id: "text-1",
              type: "Text",
              props: {
                children: "hi",
                dataBinding: {
                  type: "collection",
                  source: "dataTable",
                  name: "sales",
                },
              },
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;
    const graph = buildCanvasSceneGraph(doc, {
      collections: [
        { name: "sales", useMockData: true, mockData: rowsOf(3) },
      ] as never,
    });
    expect(
      (graph.nodesMap.get("text-1")!.props as Record<string, unknown>)
        ._chartRows,
    ).toBeUndefined();
  });
});
