import { describe, expect, it } from "vitest";

import { SeparatorSpec } from "../../components/Separator.spec";
import { getSkiaPrimitive } from "../skiaPrimitives";

/**
 * ADR-142 family ① — Separator(divider) 시각 parity 실측.
 *
 * **정본 (2026-05-31 정정)**: Separator 는 box+text 가 아닌 비-DOM-trivial primitive →
 * `skiaPrimitive: "divider"` draw module 이 그린다(buildCatalogShapes 가 아님). buildCatalogShapes
 * 안에 divider 컴포넌트 식별 분기를 두지 않는다(N++ 복제 방지). 본 테스트는 `divider` draw fn 이
 * legacy SeparatorSpec.render.shapes(단일 `rect{fill=선색, height=size.height}`)와 모든
 * variant/orientation 에서 **완전 parity** 임을 보장한다.
 */
describe("skiaPrimitive 'divider' — Separator parity (ADR-142 family ①)", () => {
  const draw = getSkiaPrimitive("divider")!;
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

  const variantSpec = (variant: string) =>
    SeparatorSpec.variants?.[variant as keyof typeof SeparatorSpec.variants];

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
          const primitive = draw({
            props,
            size: sizeSpec,
            variant: variantSpec(variant),
            style: undefined,
          });
          expect(primitive).toEqual(legacy);
        });
      }
    }
  }

  it("선은 단일 rect(fill=선색) — bg/border 모델 아님", () => {
    const shapes = draw({
      props: { variant: "default", orientation: "horizontal" },
      size: SeparatorSpec.sizes.md,
      variant: variantSpec("default"),
      style: undefined,
    })!;
    expect(shapes).toHaveLength(1);
    expect(shapes[0].type).toBe("rect");
    expect(shapes[0].fill).toBe("{color.border}");
    // generic bg roundRect / border 모델 미사용 — divider primitive 확증
    expect(shapes.some((s) => s.type === "roundRect")).toBe(false);
    expect(shapes.some((s) => s.type === "border")).toBe(false);
  });
});
