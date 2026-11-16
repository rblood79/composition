import { describe, expect, it } from "vitest";
import { reconcileChartRoles } from "@composition/rendering";
import type { DataBindingRef } from "../../../../../../packages/shared/src/catalog/document/types";
import { chartBindingColumns } from "../chartRoleReconcile";

/**
 * ADR-312 F14 · G6 — Chart 가 읽는 행의 열 = 보기 사슬의 결과 schema. 묶고 합친 보기를 연결하면 결과 행에 원본 열
 * (`points`) 이 없고 집계 이름 (`total`) 이 있다 — 원본 schema 로 맞추면 빈 차트였다 (리뷰 round 1 h2). 결과에만
 * 있는 집계 열은 필드 색인에 등록되지 않아 key 로 저장한다 (Phase 0).
 */
const COLLECTION = "data:collection:tasks";
const entries: Record<string, unknown> = {
  [COLLECTION]: {
    kind: "collection",
    id: COLLECTION,
    name: "Tasks",
    schema: [
      { id: "f-status", key: "status", type: "string" },
      { id: "f-date", key: "date", type: "date" },
      { id: "f-points", key: "points", type: "number" },
    ],
    mockData: [],
    useMockData: true,
  },
  "project:view:by-status": {
    kind: "view",
    id: "project:view:by-status",
    name: "By status",
    source: { collectionId: COLLECTION },
    groupBy: [["f-status"]],
    aggregates: [{ fn: "sum", field: ["f-points"], as: "total" }],
  },
};
const reader = { getEntry: (id: string) => entries[id] } as never;
const binding = (extra: Partial<DataBindingRef> = {}): DataBindingRef =>
  ({ collectionId: COLLECTION, fieldMap: {}, ...extra }) as DataBindingRef;

describe("ADR-312 — Chart 연결의 원천 열 (`chartBindingColumns`)", () => {
  it("보기 없음 — 컬렉션 schema (id 있는 열)", () => {
    expect(chartBindingColumns(reader, binding())).toEqual([
      { key: "status", id: "f-status", type: "string" },
      { key: "date", id: "f-date", type: "date" },
      { key: "points", id: "f-points", type: "number" },
    ]);
  });

  it("묶고 합친 공유 보기 — 묶음 열 + 집계 이름 (key 로) → 값 역할이 `total`", () => {
    const columns = chartBindingColumns(
      reader,
      binding({ viewId: "project:view:by-status" as never }),
    )!;
    expect(columns).toEqual([
      { key: "status", id: "f-status", type: "string" },
      { key: "total", type: "number" },
    ]);
    expect(
      reconcileChartRoles({
        props: {
          chartType: "bar",
          dimension: "#f-status",
          metric: "#f-points",
        },
        columns,
      }),
    ).toEqual({ metric: "total" });
  });

  it("없는 컬렉션 — undefined (맞추지 않는다)", () => {
    expect(
      chartBindingColumns(reader, {
        collectionId: "data:collection:none",
        fieldMap: {},
      } as never),
    ).toBeUndefined();
  });
});
