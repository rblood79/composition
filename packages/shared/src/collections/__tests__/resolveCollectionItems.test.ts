/**
 * resolveCollectionItems 단일 계약 테스트 (ADR-912 영역 B 연장).
 *
 * 순수 계약의 source 판정(sourceKind) + row 정규화(label/key/icon 휴리스틱)를 검증.
 * DOM wrapper / Skia projector 가 같은 계약을 소비하므로, 본 계약의 정확성이 양쪽 대칭의 SSOT.
 */

import { describe, it, expect } from "vitest";
import {
  resolveCollectionItems,
  resolveCollectionWindow,
  getFlatProjectionRows,
  readDataBindingRows,
  COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
  DEFAULT_COLLECTION_OVERSCAN,
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

// ── ADR-150 A2: CollectionWindow 가상화 (ListBox 선행 proof) ──────────────────

describe("resolveCollectionWindow — scrollOffset 기반 window 산출", () => {
  it("스크롤 top(0) → [0, viewport+overscan)", () => {
    // rowHeight 40, viewport 400 → visibleCount ceil(400/40)=10, overscan 6.
    const win = resolveCollectionWindow({
      totalRows: 1000,
      scrollTop: 0,
      viewportHeight: 400,
      rowHeight: 40,
      overscan: 6,
    });
    expect(win).toEqual({ startIndex: 0, endIndex: 16 });
  });

  it("중간 스크롤 → firstVisible ± overscan window", () => {
    // scrollTop 4000 / rowHeight 40 → firstVisible 100.
    const win = resolveCollectionWindow({
      totalRows: 1000,
      scrollTop: 4000,
      viewportHeight: 400,
      rowHeight: 40,
      overscan: 6,
    });
    // start = max(0, 100-6)=94, end = min(1000, 100+10+6)=116.
    expect(win).toEqual({ startIndex: 94, endIndex: 116 });
  });

  it("하단 경계 → endIndex 는 totalRows 로 클램프", () => {
    // total 1000*40=40000, viewport 400 → maxScroll 39600, firstVisible 990.
    const win = resolveCollectionWindow({
      totalRows: 1000,
      scrollTop: 39600,
      viewportHeight: 400,
      rowHeight: 40,
      overscan: 6,
    });
    expect(win.startIndex).toBe(984); // 990-6
    expect(win.endIndex).toBe(1000); // min(1000, 990+10+6)
  });

  it("totalRows 0 → 빈 window", () => {
    const win = resolveCollectionWindow({
      totalRows: 0,
      scrollTop: 0,
      viewportHeight: 400,
      rowHeight: 40,
    });
    expect(win).toEqual({ startIndex: 0, endIndex: 0 });
  });

  it("rowHeight<=0 (측정 실패) → legacy cap fallback [0, min(total, cap))", () => {
    const win = resolveCollectionWindow({
      totalRows: 1000,
      scrollTop: 4000,
      viewportHeight: 400,
      rowHeight: 0,
    });
    expect(win).toEqual({
      startIndex: 0,
      endIndex: COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
    });
  });

  it("overscan 생략 시 DEFAULT_COLLECTION_OVERSCAN 적용", () => {
    const win = resolveCollectionWindow({
      totalRows: 1000,
      scrollTop: 0,
      viewportHeight: 400,
      rowHeight: 40,
    });
    // start 0, end = min(1000, 0 + 10 + DEFAULT_COLLECTION_OVERSCAN).
    expect(win.endIndex).toBe(10 + DEFAULT_COLLECTION_OVERSCAN);
  });
});

describe("getFlatProjectionRows — CollectionWindow 슬라이스 + 절대 rowIndex 보존", () => {
  const items = Array.from({ length: 1000 }, (_, i) => ({
    id: String(i),
    label: `Item ${i}`,
  }));

  it("window {94,116} → 22행, 절대 rowIndex 보존", () => {
    const rows = getFlatProjectionRows(
      { props: { items } },
      { startIndex: 94, endIndex: 116 },
    );
    expect(rows).toHaveLength(22);
    // 슬라이스 첫 행은 절대 index 94 (post-slice 0 이 아님).
    expect(rows[0].rowIndex).toBe(94);
    expect(rows[0].label).toBe("Item 94");
    expect(rows[0].itemKey).toBe("94");
    expect(rows[21].rowIndex).toBe(115);
    expect(rows[21].label).toBe("Item 115");
  });

  it("window 가 totalRows 초과 시 클램프", () => {
    const rows = getFlatProjectionRows(
      { props: { items } },
      { startIndex: 990, endIndex: 1200 },
    );
    expect(rows).toHaveLength(10); // 990..999
    expect(rows[0].rowIndex).toBe(990);
    expect(rows[9].rowIndex).toBe(999);
  });

  it("number 인자(legacy cap) BC 유지 — [0, limit)", () => {
    const rows = getFlatProjectionRows({ props: { items } }, 100);
    expect(rows).toHaveLength(100);
    expect(rows[0].rowIndex).toBe(0);
    expect(rows[99].rowIndex).toBe(99);
  });
});

describe("resolveCollectionItems — totalRows(window 전 원본 수) 노출", () => {
  it("window 슬라이스 시 rows 는 window, totalRows 는 원본 전체", () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: String(i),
      label: `Item ${i}`,
    }));
    const result = resolveCollectionItems(
      { props: { items } },
      { startIndex: 94, endIndex: 116 },
    );
    expect(result.rows).toHaveLength(22);
    expect(result.totalRows).toBe(1000);
    expect(result.sourceKind).toBe("static-items");
  });

  it("legacy cap 시에도 totalRows 는 원본 전체(150), rows 는 100", () => {
    const items = Array.from({ length: 150 }, (_, i) => ({
      id: String(i),
      label: `Item ${i}`,
    }));
    const result = resolveCollectionItems({ props: { items } });
    expect(result.rows).toHaveLength(100);
    expect(result.totalRows).toBe(150);
  });
});
