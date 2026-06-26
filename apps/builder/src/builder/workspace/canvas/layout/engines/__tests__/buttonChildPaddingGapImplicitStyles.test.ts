/**
 * Button / ToggleButton (자식 보유 leaf) padding·gap implicitStyles 주입 회귀 테스트 (2026-06-27).
 *
 * icon Button = `<Button><Icon/><Text/></Button>` 처럼 자식(Icon/Text element)을 가지면 Button 이
 * 컨테이너로 layout 된다. catalog `sizes[size]` 의 paddingX/paddingY/gap 은 standalone leaf 렌더
 * (buildCatalogShapes / calculateContentWidth·Height)에서만 소비되고 자식 보유 Taffy 노드로는
 * 흘러가지 않아 자식이 여백 0 + Icon↔Text 간격 0 으로 경계에 붙었다. `applyImplicitStyles` 의
 * button/togglebutton 분기가 size 기반 padding(→longhand)/gap(→rowGap/columnGap)을 effectiveParent
 * 에 주입한다.
 *
 * 회귀 시나리오:
 *   (a) Button size=md  → paddingLeft/Right=12, paddingTop/Bottom=4, rowGap/columnGap=8
 *   (b) Button size=sm  → 8/2/6, size=lg → 16/8/10 (catalog sizes read-through)
 *   (c) user inline padding/gap → 주입값 덮지 않음 (SSOT user 최우선)
 *   (d) ToggleButton size=md → Button 과 동일 주입
 */

import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

function makeChild(
  id: string,
  type: string,
  props?: Record<string, unknown>,
): Element {
  return {
    id,
    type,
    props: props ?? {},
    childrenIds: [],
  } as Element;
}

function applyButtonLike(
  type: "Button" | "ToggleButton",
  props: Record<string, unknown>,
  children: Element[],
): ReturnType<typeof applyImplicitStyles> {
  const container: Element = {
    id: "btn-1",
    type,
    props,
    childrenIds: children.map((c) => c.id),
  } as Element;
  const byId = new Map<string, Element>([
    [container.id, container],
    ...children.map((c) => [c.id, c] as const),
  ]);
  return applyImplicitStyles(
    container,
    children,
    (id) =>
      (
        byId.get(id) as { childrenIds?: string[] } | undefined
      )?.childrenIds?.map((cid: string) => byId.get(cid)!) ?? [],
    byId,
  );
}

describe("Button/ToggleButton 자식 padding·gap implicitStyles 주입", () => {
  const icon = makeChild("ic", "Icon", { iconName: "star" });
  const text = makeChild("tx", "Text", { children: "Button" });

  it("Button size=md → padding 12/4 longhand + gap 8 (rowGap/columnGap) + borderWidth 1", () => {
    const { effectiveParent } = applyButtonLike("Button", { size: "md" }, [
      icon,
      text,
    ]);
    const ps = (effectiveParent.props?.style ?? {}) as Record<string, unknown>;
    expect(ps.paddingLeft).toBe(12);
    expect(ps.paddingRight).toBe(12);
    expect(ps.paddingTop).toBe(4);
    expect(ps.paddingBottom).toBe(4);
    expect(ps.rowGap).toBe(8);
    expect(ps.columnGap).toBe(8);
    // borderWidth 주입 — Taffy 가 height 에 border 2px 포함(leaf Button 30px 정합).
    //   누락 시 자식 보유 Button 이 leaf 보다 2px 작아짐(Skia↔CSS 발산).
    expect(ps.borderWidth).toBe(1);
  });

  it("borderWidth 주입 — Taffy border-box height 정합 (Button/ToggleButton)", () => {
    for (const t of ["Button", "ToggleButton"] as const) {
      for (const size of ["xs", "sm", "md", "lg", "xl"]) {
        const { effectiveParent } = applyButtonLike(t, { size }, [icon, text]);
        const ps = (effectiveParent.props?.style ?? {}) as Record<
          string,
          unknown
        >;
        expect(ps.borderWidth).toBe(1);
      }
    }
  });

  it("user inline borderWidth → 주입값 덮지 않음", () => {
    const { effectiveParent } = applyButtonLike(
      "Button",
      { size: "md", style: { borderWidth: 3 } },
      [icon, text],
    );
    const ps = (effectiveParent.props?.style ?? {}) as Record<string, unknown>;
    expect(ps.borderWidth).toBe(3);
  });

  it("Button size=sm → 8/2/6, size=lg → 16/8/10 (catalog sizes read-through)", () => {
    const sm = applyButtonLike("Button", { size: "sm" }, [icon, text]);
    const smPs = (sm.effectiveParent.props?.style ?? {}) as Record<
      string,
      unknown
    >;
    expect(smPs.paddingLeft).toBe(8);
    expect(smPs.paddingTop).toBe(2);
    expect(smPs.rowGap).toBe(6);

    const lg = applyButtonLike("Button", { size: "lg" }, [icon, text]);
    const lgPs = (lg.effectiveParent.props?.style ?? {}) as Record<
      string,
      unknown
    >;
    expect(lgPs.paddingLeft).toBe(16);
    expect(lgPs.paddingTop).toBe(8);
    expect(lgPs.rowGap).toBe(10);
  });

  it("size 미지정 → md 기본값 적용", () => {
    const { effectiveParent } = applyButtonLike("Button", {}, [icon, text]);
    const ps = (effectiveParent.props?.style ?? {}) as Record<string, unknown>;
    expect(ps.paddingLeft).toBe(12);
    expect(ps.rowGap).toBe(8);
  });

  it("user inline padding/gap → 주입값 덮지 않음 (user 최우선)", () => {
    const { effectiveParent } = applyButtonLike(
      "Button",
      { size: "md", style: { paddingLeft: 30, rowGap: 24 } },
      [icon, text],
    );
    const ps = (effectiveParent.props?.style ?? {}) as Record<string, unknown>;
    expect(ps.paddingLeft).toBe(30); // user 값 보존
    expect(ps.rowGap).toBe(24); // user 값 보존
    // 미지정 축은 catalog 기본값
    expect(ps.paddingTop).toBe(4);
    expect(ps.columnGap).toBe(8);
  });

  it("ToggleButton size=md → Button 과 동일 주입", () => {
    const { effectiveParent } = applyButtonLike(
      "ToggleButton",
      { size: "md" },
      [icon, text],
    );
    const ps = (effectiveParent.props?.style ?? {}) as Record<string, unknown>;
    expect(ps.paddingLeft).toBe(12);
    expect(ps.paddingTop).toBe(4);
    expect(ps.rowGap).toBe(8);
    expect(ps.columnGap).toBe(8);
  });
});
