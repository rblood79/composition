import { describe, expect, it } from "vitest";

import { getSkiaPrimitive } from "./catalogPaintFixture";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * ADR-148 후속 (2026-07-17) — slot host escape 의 `_hasChildren` shell gating.
 *
 * **갭**: Components 페이지의 reusable origin(ListBoxItem/GridListItem)은 slot 자식이
 * scene 에서 접혀 interaction node 가 없어 더블클릭으로 하위 요소 선택이 불가했다.
 * 수정으로 origin 의 slot 자식이 실 scene 노드로 서는데(canvasSceneNode unfold),
 * escape 가 flat props 내용(icon/label/description)을 계속 그리면 자식 렌더와 이중이 된다.
 *
 * **계약**: `props._hasChildren === true`(buildSpecNodeData 가 자식 실재 시만 주입) 면
 * escape 는 **shell 만** 그린다 — listbox_item: selection row-bg + check / gridlist_card:
 * card-bg + border. 내용(text/icon)은 실 자식 노드가 담당. 반환은 non-null(빈 배열 포함)
 * 이어야 buildCatalogShapes generic text fallthrough 를 차단한다. projection 행은 자식이
 * 없어 `_hasChildren` 미주입 → 기존 동작 완전 보존(BC).
 */

const listBoxSizeMd: SizeSpec = {
  height: 0,
  paddingX: 12,
  paddingY: 4,
  fontSize: 14 as never,
  gap: 2,
  iconSize: 16,
  borderRadius: 4,
  borderWidth: 0,
};

const gridListSizeMd: SizeSpec = {
  height: 0,
  paddingX: 16,
  paddingY: 12,
  fontSize: 14 as never,
  borderRadius: 8 as never,
  gap: 2,
  borderWidth: 1,
};

const gridListVisual = {
  fill: { default: { base: "{color.layer-1}" } },
  text: "{color.neutral}",
  border: "{color.border}",
  selectedBorder: "{color.accent}",
} as unknown as ComponentVisualRule;

type AnyShape = {
  type?: string;
  id?: string;
  iconName?: string;
  text?: string;
};

const shapesOf = (shapes: Shape[] | null): AnyShape[] =>
  (shapes ?? []) as AnyShape[];
const textShapes = (shapes: Shape[] | null): AnyShape[] =>
  shapesOf(shapes).filter((s) => s.type === "text");
const iconShapes = (shapes: Shape[] | null): AnyShape[] =>
  shapesOf(shapes).filter(
    (s) => s.type === "icon_font" && s.iconName !== "check",
  );

describe("listbox_item — _hasChildren shell gating", () => {
  const draw = getSkiaPrimitive("listbox_item")!;
  const flatProps = {
    children: "Aardvark",
    description: "A large burrowing mammal",
    icon: "star",
  };

  it("_hasChildren=true → 내용(text/icon) 미렌더 + non-null 반환 (자식이 내용 담당)", () => {
    const shapes = draw({
      props: { ...flatProps, _hasChildren: true },
      size: listBoxSizeMd,
      visual: undefined,
      style: {},
    } as Parameters<typeof draw>[0]);

    expect(shapes).not.toBeNull();
    expect(textShapes(shapes)).toHaveLength(0);
    expect(iconShapes(shapes)).toHaveLength(0);
  });

  it("_hasChildren=true + isSelected → selection row-bg + check 는 유지 (shell)", () => {
    const shapes = draw({
      props: { ...flatProps, _hasChildren: true, isSelected: true },
      size: listBoxSizeMd,
      visual: undefined,
      style: {},
    } as Parameters<typeof draw>[0]);

    const all = shapesOf(shapes);
    expect(all.some((s) => s.id === "row-bg")).toBe(true);
    expect(all.some((s) => s.iconName === "check")).toBe(true);
    expect(textShapes(shapes)).toHaveLength(0);
  });

  it("BC: _hasChildren 부재 → flat props 내용 렌더 (기존 동작)", () => {
    const shapes = draw({
      props: { ...flatProps },
      size: listBoxSizeMd,
      visual: undefined,
      style: {},
    } as Parameters<typeof draw>[0]);

    expect(textShapes(shapes).map((s) => s.text)).toEqual([
      "Aardvark",
      "A large burrowing mammal",
    ]);
    expect(iconShapes(shapes)).toHaveLength(1);
  });
});

describe("gridlist_card — _hasChildren shell gating", () => {
  const draw = getSkiaPrimitive("gridlist_card")!;
  const flatProps = { children: "Card", description: "Desc" };

  it("_hasChildren=true → 내용(text) 미렌더, card-bg + border 는 유지 (shell)", () => {
    const shapes = draw({
      props: { ...flatProps, _hasChildren: true },
      size: gridListSizeMd,
      visual: gridListVisual,
      style: {},
    } as Parameters<typeof draw>[0]);

    expect(shapes).not.toBeNull();
    expect(textShapes(shapes)).toHaveLength(0);
    const all = shapesOf(shapes);
    expect(all.some((s) => s.id === "card-bg")).toBe(true);
    expect(all.some((s) => s.type === "border")).toBe(true);
  });

  it("BC: _hasChildren 부재 → label + description 렌더 (기존 동작)", () => {
    const shapes = draw({
      props: { ...flatProps },
      size: gridListSizeMd,
      visual: gridListVisual,
      style: {},
    } as Parameters<typeof draw>[0]);

    expect(textShapes(shapes).map((s) => s.text)).toEqual(["Card", "Desc"]);
  });
});
