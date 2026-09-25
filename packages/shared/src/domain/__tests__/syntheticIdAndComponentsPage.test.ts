import { describe, expect, it } from "vitest";
import {
  getSyntheticAncestorIds,
  hasSyntheticIdPath,
  splitSyntheticId,
} from "../syntheticId";
import {
  COMPONENTS_SYSTEM_PAGE_ID,
  componentsPageFieldsOfNode,
  isComponentsPage,
  isOnComponentsPage,
} from "../componentsPage";

describe("syntheticId", () => {
  it("첫 구분자에서 root 와 path 로 나눈다", () => {
    expect(splitSyntheticId("inst/a/b")).toEqual({
      rootId: "inst",
      pathKey: "a/b",
    });
    expect(splitSyntheticId("plain")).toBeNull();
    expect(splitSyntheticId("/lead")).toBeNull();
  });

  it("조상 id 는 가까운 것부터", () => {
    expect(getSyntheticAncestorIds("a/b/c")).toEqual(["a/b", "a"]);
    expect(getSyntheticAncestorIds("a")).toEqual([]);
  });

  it("경로 구분자 유무만 본다 (projection 판정은 하지 않는다)", () => {
    expect(hasSyntheticIdPath("inst/a")).toBe(true);
    expect(hasSyntheticIdPath("p::page-frame::inst/a")).toBe(true);
    expect(hasSyntheticIdPath("inst")).toBe(false);
  });
});

describe("Components 페이지", () => {
  it("pageRole · 시스템 id · slug 중 하나면 Components 페이지", () => {
    expect(isComponentsPage({ pageRole: "components" })).toBe(true);
    expect(isComponentsPage({ id: COMPONENTS_SYSTEM_PAGE_ID })).toBe(true);
    expect(isComponentsPage({ slug: "/__components" })).toBe(true);
    expect(isComponentsPage({ slug: "__components" })).toBe(true);
    expect(isComponentsPage({ id: "page-1", slug: "/home" })).toBe(false);
    expect(isComponentsPage(null)).toBe(false);
  });

  it("canonical page node 는 metadata 에서 pageRole · slug 를 읽는다", () => {
    expect(
      isComponentsPage(
        componentsPageFieldsOfNode({
          id: "x",
          metadata: { pageRole: "components" },
        }),
      ),
    ).toBe(true);
    expect(
      isComponentsPage(componentsPageFieldsOfNode({ id: "x", metadata: {} })),
    ).toBe(false);
  });

  it("요소 소속 판정은 page_id 로 본다", () => {
    expect(isOnComponentsPage({ page_id: COMPONENTS_SYSTEM_PAGE_ID })).toBe(
      true,
    );
    expect(isOnComponentsPage({ page_id: "page-1" })).toBe(false);
  });
});
