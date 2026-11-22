/**
 * ADR-306 G1 — Chart 의 공개 `size` 삭제 (Phase 1).
 *
 * - typed 원본 · binding `accepts` · 공개 타입에서 `size` 가 빠져 code 라이브러리가 그대로 선다.
 * - contract 가 68 로 올라 그 전 번호의 문서는 거부되고 (변환 없음 — 저장소 정책), 새 번호 문서라도
 *   Chart 에 `size` 를 실으면 `PROP_NOT_ACCEPTED` 로 거부된다.
 * - rule 의 기하 metric 은 한 벌 — 변경 전 M (padding 12 · 글자 11) 과 같은 값이라 기존 7 종의 scene 이
 *   같은 상자에서 그대로다.
 */
import { readFileSync } from "node:fs";
import {
  CHART_DESCRIPTORS,
  computeChartScene,
  createChartInitialProps,
  resolveChartMetrics,
  type ChartMetrics,
} from "@composition/rendering";
import { describe, expect, it } from "vitest";
import { chartBinding } from "../../bindings/Chart.binding";
import { COMPONENT_RULES_TABLE } from "../../generated/componentRulesTable";
import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
} from "../codeCatalogLibrary";
import { createG1Fixture } from "../fixture";
import { REUSABLE_ORIGIN_TEMPLATES } from "../generated/reusableOriginLibrary";
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

describe("ADR-306 G1 — Chart 공개 size 삭제", () => {
  it("contract 는 68 이고 typed Chart 원본에 size 가 없다", async () => {
    expect(LIBRARY_CONTRACT_VERSION).toBeGreaterThanOrEqual(69); // ADR-312 Phase 2 가 69 · ADR-313 Phase 1 이 70 (68 = ADR-306)
    const template = REUSABLE_ORIGIN_TEMPLATES.find(
      (t) => t.id === "lib:template:component-chart",
    )!;
    expect(template).toBeTruthy();
    expect(template.props).not.toHaveProperty("size");
    const library = await buildCodeCatalogLibrary();
    expect(library.contractVersion).toBe(LIBRARY_CONTRACT_VERSION);
  });

  it("그 전 번호의 문서는 Chart 유무와 무관하게 거부된다", async () => {
    const library = await buildCodeCatalogLibrary();
    const { document } = createG1Fixture();
    failureCode(
      () =>
        new CatalogGraph(
          {
            ...document,
            libraryContractVersion: 67,
          } as unknown as CatalogDocument,
          library,
        ),
      "UNSUPPORTED_LIBRARY_CONTRACT",
    );
  });

  it("새 번호 문서라도 Chart 의 size 는 PROP_NOT_ACCEPTED", async () => {
    const library = await buildCodeCatalogLibrary();
    // size 없는 Chart 는 선다.
    expect(
      () => new CatalogGraph(documentWithChart({}), library),
    ).not.toThrow();
    failureCode(
      () =>
        new CatalogGraph(
          documentWithChart({ size: { kind: "set", value: "M" } }),
          library,
        ),
      "PROP_NOT_ACCEPTED",
    );
  });

  it("binding · rule · 생성 CSS 에 size 축이 없다", () => {
    const accepts = chartBinding.props.accepts;
    expect(accepts).not.toHaveProperty("size");
    expect(chartBinding.props.propPassthrough ?? []).not.toContain("size");
    const rule = COMPONENT_RULES_TABLE.Chart;
    expect(Object.keys(rule.sizes ?? {})).toEqual(["M"]);
    expect(rule.chart?.metrics).toEqual({
      padding: 12,
      fontSize: "{typography.text-2xs}",
    });
    const css = readFileSync(
      new URL(
        "../../../components/styles/generated/Chart.css",
        import.meta.url,
      ),
      "utf8",
    );
    expect(css).not.toMatch(/data-size/);
    const dom = readFileSync(
      new URL("../../../components/Chart.components.tsx", import.meta.url),
      "utf8",
    );
    expect(dom).not.toMatch(/data-size|sizeKey/);
  });

  it.each(CHART_DESCRIPTORS.map((d) => d.chartType))(
    "%s — scene 이 변경 전 M 과 같은 상자에서 같다",
    (chartType) => {
      const props = createChartInitialProps(chartType);
      const size = { width: 480, height: 270 };
      const now = resolveChartMetrics(COMPONENT_RULES_TABLE.Chart.chart);
      // 변경 전 rule `metrics.M` (padding 12 · fontSize 11) 을 손으로 적은 값.
      const beforeM: ChartMetrics = { ...now, padding: 12, fontSize: 11 };
      expect(computeChartScene(props, props.data, size, now)).toEqual(
        computeChartScene(props, props.data, size, beforeM),
      );
    },
  );
});
