/**
 * TreeItem catalog cutover — depth indent 시각 로직 oracle 테스트 (ADR-912 R1 후속).
 *
 * TreeItem.spec(삭제 예정)의 depth 무시 하드코딩(paddingX=8) 대신, catalog rule
 * (indentPerLevel) + buildCatalogShapes/leading_icon 의 `resolveTreeIndent` 로 depth 들여쓰기를
 * 그린다. 본 테스트는 (1) resolveTreeIndent 의 level→offset 공식, (2) buildCatalogShapes 가
 * text x 에 indent 를 반영하는지, (3) leaf/parent chevron 조건을 oracle 로 잠근다.
 *
 * Skia 스크린샷 도구 제약(WebGL canvas CDP 타임아웃)으로 시각 픽셀 직접 검증이 막혀 있어,
 * 본 oracle 테스트가 시각 로직의 회귀 가드 역할을 한다(live: 콘솔 에러 0 + nested 영속/hydrate
 * 정상 + raw tag 0 으로 보완).
 */

import { describe, it, expect } from "vitest";
import { buildCatalogShapes, resolveTreeIndent } from "./catalogPaintFixture";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { SizeSpec } from "../../types";

// COMPONENT_RULES_TABLE.TreeItem.sizes.md 미러 (indentPerLevel 16, paddingX 8, iconSize 15).
const TREE_SIZE_MD: SizeSpec = {
  height: 28,
  paddingX: 8,
  paddingY: 6,
  fontSize: 14,
  borderRadius: 0,
  iconSize: 15,
  indentPerLevel: 16,
} as unknown as SizeSpec;

// COMPONENT_RULES_TABLE.TreeItem.variants.default 미러 (leadingIcon chevron + text 색).
const TREE_VISUAL: ComponentVisualRule = {
  text: "{color.neutral}",
  leadingIcon: {
    name: "chevron-right",
    gap: 6,
    color: "{color.neutral-subdued}",
  },
} as unknown as ComponentVisualRule;

describe("resolveTreeIndent — depth → offset 공식", () => {
  it("level 1 → 0 (최상위, 들여쓰기 없음)", () => {
    expect(resolveTreeIndent({ _treeLevel: 1 }, TREE_SIZE_MD)).toBe(0);
  });

  it("level 2 → indentPerLevel*1 = 16", () => {
    expect(resolveTreeIndent({ _treeLevel: 2 }, TREE_SIZE_MD)).toBe(16);
  });

  it("level 3 → indentPerLevel*2 = 32", () => {
    expect(resolveTreeIndent({ _treeLevel: 3 }, TREE_SIZE_MD)).toBe(32);
  });

  it("_treeLevel 미주입 → 0 (TreeItem 외 type 무영향)", () => {
    expect(resolveTreeIndent({}, TREE_SIZE_MD)).toBe(0);
  });

  it("indentPerLevel 미정의 size → 0 (DisclosureHeader 등 leading icon 만)", () => {
    const noIndent = { ...TREE_SIZE_MD, indentPerLevel: undefined } as SizeSpec;
    expect(resolveTreeIndent({ _treeLevel: 3 }, noIndent)).toBe(0);
  });
});

describe("buildCatalogShapes — TreeItem text x 에 depth indent 반영", () => {
  function textX(level: number): number {
    const shapes = buildCatalogShapes(
      TREE_VISUAL,
      { children: "Node", _treeLevel: level },
      TREE_SIZE_MD,
    );
    const text = shapes.find((s) => s.type === "text");
    return (text as { x: number }).x;
  }

  it("level 1 vs level 2 text x 차이 = indentPerLevel 16", () => {
    expect(textX(2) - textX(1)).toBe(16);
  });

  it("level 1 text x = paddingX(8) + leadingIconWidth(iconSize 15 + gap 6 = 21) = 29", () => {
    // leadingIcon 존재 → text 가 icon 폭만큼 우측 shift (indent 0)
    expect(textX(1)).toBe(8 + 21);
  });

  it("level 3 text x = level 1 + indentPerLevel*2 = 29 + 32 = 61", () => {
    expect(textX(3)).toBe(29 + 32);
  });
});

describe("TreeItem chevron 조건 (_hasTreeChildren)", () => {
  // leading_icon skiaPrimitive 의 `props._hasTreeChildren === false` skip 로직은
  // skiaPrimitives.test 영역. 여기서는 buildCatalogShapes 가 _hasChildren 미주입(TreeItem 은
  // 일반 _hasChildren 제외) 시 항상 text 를 그리는지(자식 있어도 label 소실 0) 확인.
  it("자식 있는 TreeItem 도 label 텍스트를 그린다 (_hasChildren 미주입 → shell-only 회피)", () => {
    const shapes = buildCatalogShapes(
      TREE_VISUAL,
      { children: "Parent Node", _treeLevel: 1, _hasTreeChildren: true },
      TREE_SIZE_MD,
    );
    const text = shapes.find((s) => s.type === "text");
    expect(text).toBeDefined();
    expect((text as { text: string }).text).toBe("Parent Node");
  });
});
