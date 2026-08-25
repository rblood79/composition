/**
 * IllustratedMessage metric SSOT + escape 기하 lock — ADR-151 후속 (2026-07-17)
 *
 * 배경: marker passthrough 수정으로 CSS 측정이 가능해지며 Skia 48 vs CSS 240 발산이
 * 드러났다 — layout 높이 분기 부재 + escape top-left 고정 기하. 본 테스트는
 * (A) metric 산식 (DOM/escape/layout 3경로 공유 — contentHeight 는 content-box,
 * caller 가 style padding 가산), (B) escape 가 element style(padding/gap/alignItems,
 * longhand 우선) 을 소비해 DOM 과 동일 기하로 그리는지 lock 한다.
 *
 * DOM 정본 (md, 폭 350, factory style padding 24/gap 12): 24 + 120 + 12 +
 * 27(heading 18×1.5) + 12 + 21(desc 14×1.5) + 24 = 240.
 */

import { describe, expect, it } from "vitest";
import {
  ILLUSTRATED_MESSAGE_BOX,
  resolveIllustratedMessageMetric,
} from "../renderers/utils/illustratedMessageMetrics";
import { getSkiaPrimitive } from "../renderers/__tests__/catalogPaintFixture";
import type { SizeSpec } from "../types/component.types";

// catalog COMPONENT_RULES_TABLE.IllustratedMessage.sizes 미러 (read-through 입력 형태).
const CATALOG_SIZES: Record<
  string,
  {
    paddingX: number;
    paddingY: number;
    gap: number;
    headingFontSize: string;
    fontSize: string;
  }
> = {
  sm: {
    paddingX: 16,
    paddingY: 16,
    gap: 8,
    headingFontSize: "{typography.text-base}",
    fontSize: "{typography.text-sm}",
  },
  md: {
    paddingX: 24,
    paddingY: 24,
    gap: 12,
    headingFontSize: "{typography.text-lg}",
    fontSize: "{typography.text-sm}",
  },
  lg: {
    paddingX: 32,
    paddingY: 32,
    gap: 16,
    headingFontSize: "{typography.text-xl}",
    fontSize: "{typography.text-base}",
  },
};

describe("resolveIllustratedMessageMetric — 3경로 공유 산식", () => {
  it("md: content-box 192 (120+12+27+12+21), total 240 (+24·2)", () => {
    const m = resolveIllustratedMessageMetric("md", CATALOG_SIZES.md);
    expect(m.box).toBe(120);
    expect(m.headingFs).toBe(18);
    expect(m.descFs).toBe(14);
    expect(m.headingLine).toBe(27);
    expect(m.descLine).toBe(21);
    expect(m.contentHeight).toBe(192);
    expect(m.totalHeight).toBe(240);
  });

  it("sm: content 141 (80+8+24+8+21), total 173", () => {
    const m = resolveIllustratedMessageMetric("sm", CATALOG_SIZES.sm);
    expect(m.box).toBe(80);
    expect(m.contentHeight).toBe(141);
    expect(m.totalHeight).toBe(173);
  });

  it("lg: content 246 (160+16+30+16+24), total 310", () => {
    const m = resolveIllustratedMessageMetric("lg", CATALOG_SIZES.lg);
    expect(m.box).toBe(160);
    expect(m.contentHeight).toBe(246);
    expect(m.totalHeight).toBe(310);
  });

  it("sizeLike 미전달 시 fallback 이 catalog 값과 동일 (md total 240)", () => {
    expect(resolveIllustratedMessageMetric("md").totalHeight).toBe(240);
  });

  it("미지 size 는 md 로 강등", () => {
    expect(resolveIllustratedMessageMetric("xl").box).toBe(
      ILLUSTRATED_MESSAGE_BOX.md,
    );
  });
});

describe("illustrated_message escape 기하 (md, containerWidth 350)", () => {
  const draw = getSkiaPrimitive("illustrated_message");

  const drawWith = (style: Record<string, unknown> | undefined) =>
    draw!({
      props: {
        size: "md",
        _containerWidth: 350,
        heading: "h",
        description: "d",
      },
      size: CATALOG_SIZES.md as unknown as SizeSpec,
      visual: undefined,
      style,
    })!;

  const byId = (shapes: unknown[], id: string) =>
    shapes.find((s) => (s as { id?: string }).id === id) as unknown as Record<
      string,
      unknown
    >;

  it("style 부재 (컴포넌트 기본 center): placeholder 가로 중앙 24+(302-120)/2=115", () => {
    const shapes = drawWith(undefined);
    const p = byId(shapes, "illustration");
    expect(p.x).toBe(115);
    expect(p.y).toBe(24);
    expect(p.width).toBe(120);
    expect(p.fillAlpha).toBeUndefined();
    const h = byId(shapes, "heading");
    expect(h.x).toBe(24);
    expect(h.maxWidth).toBe(302); // content 폭 = 350 - 24·2
    expect(h.align).toBe("center");
    expect(h.y).toBe(169.5); // 24+120+12+27/2
    const d = byId(shapes, "description");
    expect(d.y).toBe(205.5); // 24+120+12+27+12+21/2
    expect(d.fontSize).toBe(14);
    const g = byId(shapes, "illustration-glyph");
    expect(g.y).toBe(84); // 24 + 120/2
  });

  it("factory 기본 style (padding 24 shorthand + alignItems flex-start): 좌측 정렬", () => {
    const shapes = drawWith({
      padding: 24,
      gap: 12,
      alignItems: "flex-start",
      display: "flex",
      flexDirection: "column",
      width: "100%",
    });
    const p = byId(shapes, "illustration");
    expect(p.x).toBe(24); // contentX (좌측)
    const h = byId(shapes, "heading");
    expect(h.align).toBe("left");
    expect(h.x).toBe(24);
    expect(h.maxWidth).toBe(302);
  });

  it("longhand 가 shorthand 를 이긴다 (paddingTop 40 > padding 24) + rowGap 우선", () => {
    const shapes = drawWith({ padding: 24, paddingTop: 40, rowGap: 20 });
    const p = byId(shapes, "illustration");
    expect(p.y).toBe(40);
    const h = byId(shapes, "heading");
    expect(h.y).toBe(40 + 120 + 20 + 13.5);
  });

  it("_containerWidth 미주입 시 content-min 폭 (120+24·2=168) 기준", () => {
    const shapes = draw!({
      props: { size: "md" },
      size: CATALOG_SIZES.md as unknown as SizeSpec,
      visual: undefined,
      style: undefined,
    })!;
    const p = byId(shapes, "illustration");
    expect(p.x).toBe(24); // (168-48-120)/2 + 24 = 24
  });
});
