import { describe, expect, it } from "vitest";

import { SeparatorSpec } from "../../components/Separator.spec";
import { buildCatalogShapes } from "../buildCatalogShapes";

/**
 * ADR-142 family ① de-risk — Separator(box leaf divider)가 generic buildCatalogShapes
 * 로 정확히 그려지는지 실측.
 *
 * **발견**: legacy SeparatorSpec.render.shapes 는 단일 `rect{fill=선색, height=size.height}`
 * (선 자체가 채워진 얇은 box)인 반면, buildCatalogShapes 의 일반 box+text 모델은
 * "bg roundRect(alpha 0) + border(테두리)" → 1px 박스의 *테두리* 를 그려 시각이 **다르다**.
 *
 * **해결**: buildCatalogShapes 에 generic divider 분기 추가 — 배경 투명(fill.alpha===0) +
 * 텍스트/자식 없음 + 선색 있음 = divider 패턴 → legacy 와 동일한 단일 rect. 이 테스트는
 * Separator 의 모든 variant/orientation 에서 legacy 와 **완전 parity** 임을 보장한다.
 */
describe("buildCatalogShapes — Separator divider parity (ADR-142 family ①)", () => {
  const variants = [
    "default",
    "solid",
    "dashed",
    "dotted",
    "accent",
    "neutral",
    "surface",
  ] as const;
  const sizes = ["sm", "md", "lg"] as const;
  const orientations = ["horizontal", "vertical"] as const;

  for (const variant of variants) {
    for (const size of sizes) {
      for (const orientation of orientations) {
        it(`${variant}/${size}/${orientation} — legacy render.shapes 와 완전 parity`, () => {
          const props = { variant, orientation } as Record<string, unknown>;
          const sizeSpec = SeparatorSpec.sizes[size];
          const legacy = SeparatorSpec.render.shapes(
            props as Parameters<typeof SeparatorSpec.render.shapes>[0],
            sizeSpec,
            "default",
          );
          const catalog = buildCatalogShapes(
            SeparatorSpec,
            props,
            sizeSpec,
            "default",
          );
          expect(catalog).toEqual(legacy);
        });
      }
    }
  }

  it("선은 단일 rect(fill=선색) — bg/border 모델 아님", () => {
    const catalog = buildCatalogShapes(
      SeparatorSpec,
      { variant: "default", orientation: "horizontal" },
      SeparatorSpec.sizes.md,
      "default",
    );
    expect(catalog).toHaveLength(1);
    expect(catalog[0].type).toBe("rect");
    expect(catalog[0].fill).toBe("{color.border}");
    // generic bg roundRect / border 모델 미사용 — divider 분기 확증
    expect(catalog.some((s) => s.type === "roundRect")).toBe(false);
    expect(catalog.some((s) => s.type === "border")).toBe(false);
  });
});
