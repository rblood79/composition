/**
 * ADR-152 Phase 4 — Tabs · Tree DOM wrapper 가 raw `useCollectionData` 대신 shared 정규화
 * (`useResolvedCollectionItems` → `toItemProjectionRow`) 를 지나 fieldMap value 역할이
 * 항목 key 에 반영되는지 (다른 7종과 같은 계약 — Skia projection 과 동형).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const schema = [
  { id: "f-uid", key: "uid", type: "string" },
  { id: "f-title", key: "title", type: "string" },
];
const rows = [
  { id: "auto-1", uid: "U-1", title: "First", content: "C1", children: [{ id: "auto-1a", uid: "U-1a", title: "Child" }] },
  { id: "auto-2", uid: "U-2", title: "Second", content: "C2" },
];
vi.mock("../../hooks/useCollectionData", () => ({
  useCollectionData: () => ({ data: rows, loading: false, error: null, reload: () => {}, schema }),
}));

import { Tabs } from "../Tabs";
import { Tree } from "../Tree";

const binding = (fieldMap?: Record<string, string>) => ({
  source: "dataTable" as const,
  collectionId: "c1",
  name: "Users",
  ...(fieldMap ? { fieldMap } : {}),
});

describe("Tabs — dataBinding 동적 탭", () => {
  it("fieldMap 없음: key 는 휴리스틱 (id) · 라벨은 shared getItemLabel (title)", () => {
    const html = renderToStaticMarkup(<Tabs dataBinding={binding()} />);
    expect(html).toContain('data-key="auto-1"');
    expect(html).toContain("First");
    expect(html).toContain("C1");
  });

  it("fieldMap.value = uid → 탭 · 패널 key 가 uid 컬럼", () => {
    const html = renderToStaticMarkup(<Tabs dataBinding={binding({ value: "f-uid" })} />);
    expect(html).toContain('data-key="U-1"');
    expect(html).toContain('data-key="U-2"');
    expect(html).not.toContain('data-key="auto-1"');
  });
});

describe("Tree — dataBinding 재귀", () => {
  it("fieldMap.value = uid → 최상위 · 자식 item key 가 uid 컬럼, 라벨은 title", () => {
    const html = renderToStaticMarkup(
      <Tree aria-label="t" dataBinding={binding({ value: "f-uid" })} defaultExpandedKeys={["U-1"]} />,
    );
    expect(html).toContain('data-key="U-1"');
    expect(html).toContain('data-key="U-1a"');
    expect(html).toContain("Child");
    expect(html).not.toContain('data-key="auto-1"');
  });
});

describe("TagGroup — 정규화 id 가 raw id 를 이긴다 (Phase 4 sweep 실측 수리)", () => {
  it("fieldMap.value = uid → Tag key 가 uid 컬럼 (raw `id` 로 덮이지 않는다)", async () => {
    const { TagGroup } = await import("../TagGroup");
    const html = renderToStaticMarkup(
      <TagGroup aria-label="tags" dataBinding={binding({ value: "f-uid" }) as never} />,
    );
    expect(html).toContain('data-key="U-1"');
    expect(html).not.toContain('data-key="auto-1"');
  });
});
