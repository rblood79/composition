import { describe, expect, it } from "vitest";
import type { ResolvedField } from "@composition/shared";
import {
  isComponentsPageNode,
  omitDataBindingOnComponentsPage,
} from "./componentsPageFields";

const field = (key: string, kind: ResolvedField["kind"]): ResolvedField => ({
  key,
  kind,
  label: key,
  section: "content",
  origin: "semantic",
  isOverridden: false,
  baseValue: undefined,
  currentValue: undefined,
});

/**
 * 사용자 판정 2026-09-21: Components 페이지는 origin 을 테마처럼 손보는 자리라 collection 의 외부 데이터
 * 연결은 뜻이 없다 — origin Properties 에서 `dataBinding` (kind binding) 을 뺀다. 정적 items 편집은 유지.
 */
describe("Components 페이지 origin — dataBinding 필드 제외", () => {
  const fields = [
    field("items", "items-manager"),
    field("dataBinding", "binding"),
    field("selectionMode", "enum"),
  ];

  it("Components 페이지 노드면 binding 필드만 빠진다", () => {
    expect(isComponentsPageNode({ page_id: "page-components" })).toBe(true);
    expect(
      omitDataBindingOnComponentsPage(fields, {
        page_id: "page-components",
      }).map((f) => f.key),
    ).toEqual(["items", "selectionMode"]);
  });

  it("사용자 페이지 · 노드 없음 은 그대로", () => {
    expect(isComponentsPageNode({ page_id: "page-1" })).toBe(false);
    expect(
      omitDataBindingOnComponentsPage(fields, { page_id: "page-1" }),
    ).toEqual(fields);
    expect(omitDataBindingOnComponentsPage(fields, undefined)).toEqual(fields);
  });
});
