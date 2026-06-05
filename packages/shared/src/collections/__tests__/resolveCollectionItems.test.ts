/**
 * resolveCollectionItems 단일 계약 테스트 (ADR-912 영역 B 연장).
 *
 * 순수 계약의 source 판정(sourceKind) + row 정규화(label/key/icon 휴리스틱)를 검증.
 * DOM wrapper / Skia projector 가 같은 계약을 소비하므로, 본 계약의 정확성이 양쪽 대칭의 SSOT.
 */

import { describe, it, expect } from "vitest";
import {
  resolveCollectionItems,
  getFlatProjectionRows,
  readDataBindingRows,
  type CollectionDataSource,
} from "../resolveCollectionItems";

describe("resolveCollectionItems — sourceKind 판정", () => {
  it("정적 props.items → sourceKind:'static-items' + rows 정규화", () => {
    const result = resolveCollectionItems({
      props: {
        items: [
          { id: "1", label: "A" },
          { id: "2", label: "B" },
        ],
      },
    });
    expect(result.sourceKind).toBe("static-items");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      kind: "item",
      itemKey: "1",
      label: "A",
      rowIndex: 0,
    });
    expect(result.rows[1]).toMatchObject({ itemKey: "2", label: "B" });
  });

  it("source 없음 → sourceKind:'empty' + 빈 rows", () => {
    const result = resolveCollectionItems({ props: {} });
    expect(result.sourceKind).toBe("empty");
    expect(result.rows).toHaveLength(0);
  });

  it("dataTable dataBinding → sourceKind:'collection' (collections store 경유)", () => {
    const collections: CollectionDataSource[] = [
      {
        name: "users",
        runtimeData: [
          { id: "u1", name: "John" },
          { id: "u2", name: "Jane" },
        ],
      },
    ];
    const result = resolveCollectionItems({
      dataBinding: { source: "dataTable", name: "users" },
      collections,
    });
    expect(result.sourceKind).toBe("collection");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].label).toBe("John"); // name 필드 → label 휴리스틱
  });

  it("collection static dataBinding → sourceKind:'dataBinding'", () => {
    const result = resolveCollectionItems({
      dataBinding: {
        type: "collection",
        source: "static",
        config: { data: [{ id: "x", title: "X" }] },
      },
    });
    expect(result.sourceKind).toBe("dataBinding");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].label).toBe("X"); // title 필드 → label 휴리스틱
  });

  it("dataBinding 우선 (props.items 동시 존재 시 dataBinding 승)", () => {
    const result = resolveCollectionItems({
      props: { items: [{ id: "static", label: "STATIC" }] },
      dataBinding: {
        type: "collection",
        source: "static",
        config: { data: [{ id: "bound", label: "BOUND" }] },
      },
    });
    expect(result.sourceKind).toBe("dataBinding");
    expect(result.rows[0].label).toBe("BOUND");
  });
});

describe("resolveCollectionItems — label/icon/description 휴리스틱", () => {
  it("label > textValue > children > name > title 우선순위", () => {
    const result = resolveCollectionItems({
      props: { items: [{ id: "1", name: "n", label: "L" }] },
    });
    expect(result.rows[0].label).toBe("L"); // label 우선
  });

  it("icon/description/value 추출", () => {
    const result = resolveCollectionItems({
      props: {
        items: [
          {
            id: "1",
            label: "A",
            icon: "star",
            description: "desc",
            value: "v1",
          },
        ],
      },
    });
    expect(result.rows[0]).toMatchObject({
      icon: "star",
      description: "desc",
      value: "v1",
    });
  });

  it("isDisabled 추출 (isDisabled 또는 disabled)", () => {
    const r1 = resolveCollectionItems({
      props: { items: [{ id: "1", label: "A", isDisabled: true }] },
    });
    expect(r1.rows[0].isDisabled).toBe(true);
    const r2 = resolveCollectionItems({
      props: { items: [{ id: "2", label: "B", disabled: true }] },
    });
    expect(r2.rows[0].isDisabled).toBe(true);
  });
});

describe("BC — getFlatProjectionRows / readDataBindingRows 보존", () => {
  it("getFlatProjectionRows 는 resolveCollectionItems.rows 와 동일", () => {
    const input = {
      props: { items: [{ id: "1", label: "A" }] },
    };
    const flat = getFlatProjectionRows(input);
    const resolved = resolveCollectionItems(input);
    expect(resolved.rows).toEqual(flat);
  });

  it("readDataBindingRows dataTable 경로 보존", () => {
    const collections: CollectionDataSource[] = [
      { name: "t", runtimeData: [{ id: "1" }] },
    ];
    const rows = readDataBindingRows(
      { source: "dataTable", name: "t" },
      collections,
    );
    expect(rows).toHaveLength(1);
  });

  it("windowLimit 적용 (100 초과 truncate)", () => {
    const items = Array.from({ length: 150 }, (_, i) => ({
      id: String(i),
      label: `Item ${i}`,
    }));
    const result = resolveCollectionItems({ props: { items } });
    expect(result.rows).toHaveLength(100);
  });
});
