import { describe, expect, it } from "vitest";

import {
  canNest,
  catalogChildKind,
  UNCONVERTED_FAMILY_LIMITS,
} from "../nestingRules";

// ADR-256 Decision 4 — 부품의 children 종류 하나를 중첩 판정 · 넣기 목록 · slot 표시가 같이 읽는다.
describe("catalogChildKind — 부품이 받는 자식의 종류", () => {
  it("RAC collection 은 항목 목록이다 (설치 RAC 가 자유 내용을 버린다 — G0 ②)", () => {
    expect(catalogChildKind("ListBox")).toEqual({
      kind: "items",
      items: ["ListBoxItem", "ListBoxSection", "Section", "Header"],
    });
    expect(catalogChildKind("TabList")).toEqual({
      kind: "items",
      items: ["Tab"],
    });
  });

  it("그 밖의 RAC 부품은 자유 내용이다", () => {
    for (const type of ["Toolbar", "Dialog", "Popover", "Form", "frame"])
      expect(catalogChildKind(type), type).toEqual({ kind: "free" });
  });

  it("Pen leaf · DOM void 는 자식이 없다", () => {
    for (const type of ["Text", "Icon", "Image", "Input", "Separator"])
      expect(catalogChildKind(type), type).toEqual({ kind: "leaf" });
  });

  it("미전환 family 는 지금 renderer 가 그리는 목록이 이긴다", () => {
    expect(catalogChildKind("TextField")).toEqual({
      kind: "items",
      items: ["Label", "Input", "Description", "FieldError"],
    });
    // RAC TreeItem 의 항목은 TreeItem · TreeItemContent 지만 노드 구조가 아직 다르다.
    expect(catalogChildKind("TreeItem")).toEqual({
      kind: "items",
      items: ["TreeItemChevron", "TreeItem", "Text"],
    });
  });
});

describe("중첩 판정 — children 종류를 읽는다", () => {
  it("RAC collection 의 section 도 항목만 받는다 (래퍼는 RAC 가 버린다)", () => {
    expect(
      canNest("ListBoxSection", "ListBoxItem", ["ListBoxSection", "ListBox"]),
    ).toBe(true);
    expect(
      canNest("ListBoxSection", "frame", ["ListBoxSection", "ListBox"]),
    ).toBe(false);
    expect(canNest("MenuSection", "frame", ["MenuSection", "Menu"])).toBe(
      false,
    );
  });

  it("자유 내용 부품은 기본 원본도 받는다 (Toolbar ⊃ Button · Dialog ⊃ Heading)", () => {
    expect(canNest("Toolbar", "Button")).toBe(true);
    expect(canNest("Dialog", "Heading")).toBe(true);
    expect(canNest("Popover", "Checkbox")).toBe(true);
  });

  it("미전환 family: wrappers 행은 레이아웃 래퍼를 받고, 아닌 행은 받지 않는다", () => {
    expect(canNest("Tabs", "frame")).toBe(true);
    expect(canNest("TabPanels", "frame", ["TabPanels", "Tabs"])).toBe(false);
    expect(canNest("TextField", "frame")).toBe(false);
    expect(canNest("TextField", "Icon")).toBe(false);
  });

  it("제한 표의 모든 행은 그 부품의 지금 자식을 허용한다 (표 자체가 막지 않는다)", () => {
    for (const [type, limit] of Object.entries(UNCONVERTED_FAMILY_LIMITS)) {
      expect(limit.children.length, type).toBeGreaterThan(0);
      expect(catalogChildKind(type).kind, type).toBe("items");
    }
  });
});
