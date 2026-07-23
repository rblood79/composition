/**
 * ADR-159 P4a — 필드 피커 컬럼 소스 판정 (순수 resolver).
 */
import { describe, expect, it } from "vitest";

import type { DataTable } from "../../../../types/builder/data.types";
import type { PanelNode } from "../../panelNode";
import { resolveOwnerCollectionColumns } from "./useOwnerCollectionColumns";

const node = (partial: Partial<PanelNode> & { id: string }): PanelNode => ({
  type: "div",
  props: {},
  ...partial,
});

const mapOf = (...nodes: PanelNode[]) => new Map(nodes.map((n) => [n.id, n]));

const usersTable = {
  id: "t1",
  name: "users",
  project_id: "p1",
  schema: [
    { key: "num", type: "number" },
    { key: "name", type: "string" },
    { key: "email", type: "string" },
  ],
  mockData: [],
  useMockData: true,
} as unknown as DataTable;

describe("resolveOwnerCollectionColumns", () => {
  it("dataTable binding 조상 → collection schema 키", () => {
    const elements = mapOf(
      node({ id: "text", parent_id: "anchor" }),
      node({ id: "anchor", parent_id: "listbox" }),
      node({
        id: "listbox",
        type: "ListBox",
        props: { dataBinding: { source: "dataTable", name: "users" } },
      }),
    );
    expect(
      resolveOwnerCollectionColumns(
        elements,
        "text",
        new Map([["users", usersTable]]),
      ),
    ).toEqual(["num", "name", "email"]);
  });

  it("정적 items 조상 → 첫 행 키 (ASD live 사례)", () => {
    const elements = mapOf(
      node({ id: "text", parent_id: "gl" }),
      node({
        id: "gl",
        type: "ref",
        props: {
          items: [{ id: "1", label: "A", description: "d" }],
        },
      }),
    );
    expect(resolveOwnerCollectionColumns(elements, "text", new Map())).toEqual([
      "id",
      "label",
      "description",
    ]);
  });

  it("legacy static collection binding → config.data[0] 키", () => {
    const elements = mapOf(
      node({ id: "text", parent_id: "lb" }),
      node({
        id: "lb",
        props: {
          dataBinding: {
            type: "collection",
            source: "static",
            config: { data: [{ num: 1, email: "a@x.io" }] },
          },
        },
      }),
    );
    expect(resolveOwnerCollectionColumns(elements, "text", new Map())).toEqual([
      "num",
      "email",
    ]);
  });

  it("소유자 없음 → null (피커 미노출)", () => {
    const elements = mapOf(
      node({ id: "text", parent_id: "frame" }),
      node({ id: "frame" }),
    );
    expect(
      resolveOwnerCollectionColumns(elements, "text", new Map()),
    ).toBeNull();
  });

  it("master slot Text (direct 소비자) — anchor ref 역추적으로 owner 컬럼", () => {
    const elements = mapOf(
      node({ id: "master__label", parent_id: "master" }),
      node({ id: "master", type: "ListBoxItem", reusable: true }),
      node({ id: "anchor", type: "ref", ref: "master", parent_id: "listbox" }),
      node({
        id: "listbox",
        type: "ListBox",
        props: { dataBinding: { source: "dataTable", name: "users" } },
      }),
    );
    expect(
      resolveOwnerCollectionColumns(
        elements,
        "master__label",
        new Map([["users", usersTable]]),
      ),
    ).toEqual(["num", "name", "email"]);
  });

  it("페이지 body 에 중첩된 master 도 소비자 역추적 (live ASD 회귀)", () => {
    // 라이브 문서: master 는 Components 페이지 body 의 자식 — 체인 최상단은 body(비-reusable).
    // 최상단 단독 판정이던 구버전은 여기서 null → 피커 미노출 회귀.
    const elements = mapOf(
      node({ id: "gl-item__label", parent_id: "gl-item" }),
      node({
        id: "gl-item",
        type: "GridListItem",
        reusable: true,
        parent_id: "page-components-body",
      }),
      node({ id: "page-components-body", type: "body" }),
      node({
        id: "component-gridlist",
        type: "GridList",
        reusable: true,
        slot: ["gl-item"],
      }),
      node({
        id: "instance",
        type: "ref",
        ref: "component-gridlist",
        props: { dataBinding: { source: "dataTable", name: "users" } },
      }),
    );
    expect(
      resolveOwnerCollectionColumns(
        elements,
        "gl-item__label",
        new Map([["users", usersTable]]),
      ),
    ).toEqual(["num", "name", "email"]);
  });

  it("master slot Text (container-slot 2-hop) — ASD GridList 사례", () => {
    const elements = mapOf(
      node({ id: "gl-item__label", parent_id: "gl-item" }),
      node({ id: "gl-item", type: "GridListItem", reusable: true }),
      node({
        id: "component-gridlist",
        type: "GridList",
        reusable: true,
        slot: ["gl-item"],
      }),
      node({
        id: "instance",
        type: "ref",
        ref: "component-gridlist",
        props: { items: [{ id: "1", label: "A", description: "d" }] },
      }),
    );
    expect(
      resolveOwnerCollectionColumns(elements, "gl-item__label", new Map()),
    ).toEqual(["id", "label", "description"]);
  });

  it("자기 자신의 items 는 소유자 판정에서 제외 (조상만)", () => {
    const elements = mapOf(node({ id: "self", props: { items: [{ a: 1 }] } }));
    expect(
      resolveOwnerCollectionColumns(elements, "self", new Map()),
    ).toBeNull();
  });
});
