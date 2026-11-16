/**
 * ADR-306 Phase 3 (Phase 2 열린 항목) — 새 프로젝트의 Library 를 chart family 가 받아지기 전에 열면,
 * 저장을 family 로드 뒤로 미룬다: 그 사이는 view 로만 그리고, 받아진 뒤 처음 저장하는 Types 카드에
 * family 종류의 표본 행 · 역할 이름이 들어 있다 (전에는 행 없는 카드가 저장돼 남았다).
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { __setChartFamilyLoaderForTest } from "../../../../../../packages/rendering/src/chart/families/registry";
import type { ChartFamily } from "@composition/rendering";
import { catalogComponentPageId } from "../componentsPage";
import { COMPONENTS_VIEW, ORIGIN_VIEW_NODE } from "../originView";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const restores: (() => void)[] = [];
afterEach(() => {
  for (const restore of restores.splice(0)) restore();
});

/** 로더를 손으로 풀 때까지 기다리게 바꾼다 (진짜 family 모듈을 돌려준다). */
function deferLoader(
  id: "kpi" | "category",
  real: () => Promise<ChartFamily>,
): () => void {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  restores.push(__setChartFamilyLoaderForTest(id, () => gate.then(real)));
  return release;
}

describe("ADR-306 — Library 의 Chart Types 카드는 family 로드 뒤에 저장한다", () => {
  it("로드 전엔 저장하지 않고, 로드 뒤 저장한 카드에 family 표본 행이 있다", async () => {
    const releaseKpi = deferLoader("kpi", () =>
      import("../../../../../../packages/rendering/src/chart/families/kpi").then(
        (m) => m.kpiFamily,
      ),
    );
    const releaseCategory = deferLoader("category", () =>
      import("../../../../../../packages/rendering/src/chart/families/category").then(
        (m) => m.categoryFamily,
      ),
    );
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:library-charts" as const,
          name: "Library charts",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `library-charts-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1000, height: 800 },
        autosaveSchedule: () => {},
      },
    );
    const graph = workspace.runtime.graph;
    const page = catalogComponentPageId(COMPONENTS_VIEW);
    workspace.showDefinition(COMPONENTS_VIEW);
    // 아직 family 가 없다 — 저장하지 않고 view 로만.
    expect(graph.storedEntry(page)).toBeUndefined();
    releaseKpi();
    releaseCategory();
    await vi.waitFor(() => expect(graph.storedEntry(page)).toBeDefined(), {
      timeout: 5000,
    });
    // The Types cards' instances carry prop writes (`{ kind: "set", value }`).
    const charts = new Map<string, Record<string, unknown>>();
    const valueOf = (write: unknown) =>
      write && typeof write === "object" && "value" in write
        ? (write as { value: unknown }).value
        : write;
    const walk = (id: string) => {
      const entry = graph.storedEntry(id);
      if (entry?.kind !== "node") return;
      const props = Object.fromEntries(
        Object.entries(entry.props ?? {}).map(([k, v]) => [k, valueOf(v)]),
      );
      if (typeof props.chartType === "string")
        charts.set(props.chartType, props);
      entry.children.forEach(walk);
    };
    walk(ORIGIN_VIEW_NODE);
    for (const type of ["gauge", "dumbbell", "funnel", "skyline"]) {
      const props = charts.get(type);
      expect(props, type).toBeDefined();
      expect((props!.data as unknown[]).length, type).toBeGreaterThan(0);
    }
    // ADR-312 결정 3 — 표본 열은 역할의 기본 열 이름 (`start` · `end`), 역할 값은 쓰지 않는다.
    expect(charts.get("dumbbell")!.startField).toBeUndefined();
    expect(
      Object.keys((charts.get("dumbbell")!.data as object[])[0]).sort(),
    ).toEqual(["category", "end", "start"]);
    expect(charts.get("skyline")!.frontFields).toEqual(["Failed", "Retried"]);
    workspace.dispose();
  });
});
