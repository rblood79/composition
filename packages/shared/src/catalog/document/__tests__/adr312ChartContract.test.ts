/**
 * ADR-312 Phase 2 (G2 · contract 69) — Chart 데이터 포맷 표준의 저장 계약.
 *
 * - 68 이하 문서는 거부된다 (변환 없음 — HC1).
 * - candlestick 의 옛 `closeField` 는 accepts 에서 빠져 `PROP_NOT_ACCEPTED` (종가 = `metric`).
 * - `dataMode` 는 형태 id (`binned` · `ranked` · `pair`) 를 받는다.
 */
import { CHART_FORMS, standardizeChartSample } from "@composition/rendering";
import { describe, expect, it } from "vitest";
import { chartBinding } from "../../bindings/Chart.binding";
import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
} from "../codeCatalogLibrary";
import { createG1Fixture } from "../fixture";
import { CatalogGraph } from "../graph";
import {
  LIBRARY_CONTRACT_VERSION,
  type CatalogDocument,
  type CatalogEntry,
  type NodeEntry,
} from "../types";
import { CatalogValidationError } from "../validation";

const failureCode = (action: () => unknown, code: string) => {
  try {
    action();
    throw new Error("expected failure");
  } catch (error) {
    expect(error).toBeInstanceOf(CatalogValidationError);
    expect((error as CatalogValidationError).code).toBe(code);
  }
};

const documentWithChart = (props: NodeEntry["props"]) => {
  const { document } = createG1Fixture();
  const project = document.entries[document.projectId];
  const page = document.entries["project:page:main"] as Extract<
    CatalogEntry,
    { kind: "page" }
  >;
  const node: NodeEntry = {
    kind: "node",
    id: "project:node:chart",
    definitionId: catalogTypeDefinitionId("Chart"),
    children: [],
    props,
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  return {
    ...document,
    entries: {
      [project.id]: project,
      [page.id]: { ...page, children: [node.id] },
      [node.id]: node,
    },
  } as CatalogDocument;
};

describe("ADR-312 Phase 2 — Chart 저장 계약 (contract 69)", () => {
  it("contract 69 — 68 문서는 거부된다", async () => {
    expect(LIBRARY_CONTRACT_VERSION).toBeGreaterThanOrEqual(69); // ADR-313 Phase 1 이 70 으로
    const library = await buildCodeCatalogLibrary();
    const { document } = createG1Fixture();
    failureCode(
      () =>
        new CatalogGraph(
          {
            ...document,
            libraryContractVersion: 68,
          } as unknown as CatalogDocument,
          library,
        ),
      "UNSUPPORTED_LIBRARY_CONTRACT",
    );
  });

  it("옛 `closeField` 는 PROP_NOT_ACCEPTED · 형태 id 의 `dataMode` 는 선다", async () => {
    const library = await buildCodeCatalogLibrary();
    failureCode(
      () =>
        new CatalogGraph(
          documentWithChart({
            chartType: { kind: "set", value: "candlestick" },
            closeField: { kind: "set", value: "close" },
          }),
          library,
        ),
      "PROP_NOT_ACCEPTED",
    );
    for (const [chartType, dataMode] of [
      ["histogram", "binned"],
      ["bump", "ranked"],
      ["slope", "pair"],
    ])
      expect(
        () =>
          new CatalogGraph(
            documentWithChart({
              chartType: { kind: "set", value: chartType },
              dataMode: { kind: "set", value: dataMode },
            }),
            library,
          ),
        `${chartType}/${dataMode}`,
      ).not.toThrow();
  });

  it("binding 의 dataMode 선택지 = 형태 id 전부", () => {
    const ids = new Set(
      Object.values(CHART_FORMS).flatMap((forms) => forms.map((f) => f.id)),
    );
    expect(
      new Set(
        (chartBinding.props.accepts.dataMode.options ?? []).map((o) => o.value),
      ),
    ).toEqual(ids);
    expect(chartBinding.props.accepts).not.toHaveProperty("closeField");
  });

  it("표준 표본 — 기본 열 이름 밖의 역할 값을 싣지 않는다 (목록 역할만)", () => {
    const sample = standardizeChartSample(
      "candlestick",
      [{ date: "2025-01-01", open: 1, high: 2, low: 0, close: 1.5 }],
      { dimension: "date", metric: "close", openField: "open" },
    );
    expect(sample.props).toEqual({});
    expect(Object.keys(sample.rows[0]).sort()).toEqual(
      ["category", "high", "low", "open", "value"].sort(),
    );
  });
});
