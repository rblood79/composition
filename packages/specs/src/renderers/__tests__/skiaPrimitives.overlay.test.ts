import { describe, expect, it } from "vitest";

import { PopoverSpec } from "../../components/Popover.spec";
import { TooltipSpec } from "../../components/Tooltip.spec";
import { DialogSpec } from "../../components/Dialog.spec";
import { getSkiaPrimitive, getSkiaPrimitiveMode } from "../skiaPrimitives";
import { resolveComponentVisual } from "../utils/resolveComponentVisual";
import type { Shape } from "../../types";

// arrow stroke = bg fill base. dispatch 에서 resolveSkiaVisualRule 이 주입하는 visual 과
// 동등하게 spec→visual 로 생성(separator/selection 테스트 패턴).
const popoverVisual = resolveComponentVisual(
  PopoverSpec as never,
  PopoverSpec.defaultVariant!,
);
const tooltipVisual = resolveComponentVisual(
  TooltipSpec as never,
  TooltipSpec.defaultVariant!,
);

/**
 * ADR-142 Inc3 family ⑥(overlays) — overlay 시각 패턴 draw module parity.
 *
 * **정본 (ADR-142 R4 / HC#11, 사용자 confirm 2026-06-01)**: portal/overlay 의 비-box+text
 * 시각(shadow / V-arrow / backdrop / dashed)은 `skiaPrimitive` draw module 이 그린다. 값은
 * module 내부 상수(현 render.shapes 하드코딩 1:1 이식) — spec runtime 참조 0(#8 충족),
 * ComponentRule 스키마 확장 불필요(theme 메타 이전은 ADR-142 미요구 over-engineering).
 *
 * draw module 의 합성 모드는 registry 메타(`getSkiaPrimitiveMode`)다. overlay 패턴 =
 * `"append"`(buildCatalogShapes box+text 출력에 합성), 기존 6 primitive(checkbox/radio/dot/
 * divider/icon_font/switch) = `"replace"`(box+text 대체, 불변). draw fn 시그니처는 기존과
 * 동일(`Shape[] | null`) — 기존 6 parity 테스트 무수정.
 *
 * 각 draw module 이 legacy render.shapes 의 해당 shape 와 완전 parity 임을 보장한다(회귀 0).
 */

/** legacy render.shapes 출력에서 특정 type 의 shape 만 추출. */
function only(shapes: Shape[], ...types: string[]): Shape[] {
  return shapes.filter((s) => types.includes(s.type));
}

describe("skiaPrimitive 'tooltip_arrow' — Tooltip V-arrow parity", () => {
  const draw = getSkiaPrimitive("tooltip_arrow");
  const placements = ["top", "bottom", "left", "right"] as const;
  const sizes = ["sm", "md", "lg"] as const;

  it("registry 에 append 모드로 등록되어 있다", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("tooltip_arrow")).toBe("append");
  });

  for (const placement of placements) {
    for (const size of sizes) {
      it(`showArrow=true/${placement}/${size} — legacy line arrow 와 parity`, () => {
        const props = {
          showArrow: true,
          placement,
          size,
          children: "Tip",
        } as Record<string, unknown>;
        const sizeSpec = TooltipSpec.sizes[size];
        const legacyLines = only(
          TooltipSpec.render.shapes(
            props as Parameters<typeof TooltipSpec.render.shapes>[0],
            sizeSpec,
            "default",
          ),
          "line",
        );
        const shapes = draw!({
          props,
          size: sizeSpec,
          visual: tooltipVisual,
          style: undefined,
        });
        expect(shapes).toEqual(legacyLines);
      });
    }
  }

  it("showArrow !== true 면 미적용(null) — legacy 도 arrow 미렌더", () => {
    const props = { placement: "top", size: "md", children: "Tip" } as Record<
      string,
      unknown
    >;
    const shapes = draw!({
      props,
      size: TooltipSpec.sizes.md,
      visual: undefined,
      style: undefined,
    });
    expect(shapes).toBeNull();
  });
});

describe("skiaPrimitive 'popover_arrow' — Popover V-arrow parity", () => {
  const draw = getSkiaPrimitive("popover_arrow");
  const placements = ["top", "bottom", "left", "right"] as const;
  const sizes = ["sm", "md", "lg"] as const;

  it("registry 에 append 모드로 등록되어 있다", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("popover_arrow")).toBe("append");
  });

  for (const placement of placements) {
    for (const size of sizes) {
      it(`!showArrow/${placement}/${size} — legacy line arrow 와 parity`, () => {
        // Popover arrow 는 !showArrow 일 때(기본 표시). 색 = bg fill.
        const props = { placement, size } as Record<string, unknown>;
        const sizeSpec = PopoverSpec.sizes[size];
        const legacyLines = only(
          PopoverSpec.render.shapes(
            props as Parameters<typeof PopoverSpec.render.shapes>[0],
            sizeSpec,
            "default",
          ),
          "line",
        );
        const shapes = draw!({
          props,
          size: sizeSpec,
          visual: popoverVisual,
          style: undefined,
        });
        expect(shapes).toEqual(legacyLines);
      });
    }
  }

  it("showArrow=true 면 미적용(null) — legacy 도 arrow 미렌더", () => {
    const props = { showArrow: true, placement: "bottom" } as Record<
      string,
      unknown
    >;
    const shapes = draw!({
      props,
      size: PopoverSpec.sizes.md,
      visual: undefined,
      style: undefined,
    });
    expect(shapes).toBeNull();
  });
});

describe("skiaPrimitive 'dialog_shadow' — Dialog shadow parity", () => {
  const draw = getSkiaPrimitive("dialog_shadow");

  it("registry 에 prepend 모드로 등록되어 있다(shadow=base 앞)", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("dialog_shadow")).toBe("prepend");
  });

  it("Dialog shadow(offsetY:8 blur:24 alpha:0.2) parity", () => {
    const sizeSpec = DialogSpec.sizes.md;
    const legacyShadow = only(
      DialogSpec.render.shapes(
        {} as Parameters<typeof DialogSpec.render.shapes>[0],
        sizeSpec,
        "default",
      ),
      "shadow",
    );
    const shapes = draw!({
      props: {},
      size: sizeSpec,
      visual: undefined,
      style: undefined,
    });
    expect(shapes).toEqual(legacyShadow);
  });
});

describe("skiaPrimitive 'popover_shadow' — Popover shadow parity", () => {
  const draw = getSkiaPrimitive("popover_shadow");

  it("registry 에 prepend 모드로 등록되어 있다(shadow=base 앞)", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("popover_shadow")).toBe("prepend");
  });

  it("Popover shadow(offsetY:4 blur:12 alpha:0.15) parity", () => {
    const sizeSpec = PopoverSpec.sizes.md;
    const legacyShadow = only(
      PopoverSpec.render.shapes(
        {} as Parameters<typeof PopoverSpec.render.shapes>[0],
        sizeSpec,
        "default",
      ),
      "shadow",
    );
    const shapes = draw!({
      props: {},
      size: sizeSpec,
      visual: undefined,
      style: undefined,
    });
    expect(shapes).toEqual(legacyShadow);
  });
});

describe("skiaPrimitive 'overlay_backdrop' — Dialog backdrop parity", () => {
  const draw = getSkiaPrimitive("overlay_backdrop");

  it("registry 에 prepend 모드로 등록되어 있다(backdrop=base 앞)", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("overlay_backdrop")).toBe("prepend");
  });

  it("Dialog backdrop(rect -9999..99999, rgba(0,0,0,0.5)) parity", () => {
    const props = {} as Record<string, unknown>;
    const sizeSpec = DialogSpec.sizes.md;
    const legacyBackdrop = only(
      DialogSpec.render.shapes(
        props as Parameters<typeof DialogSpec.render.shapes>[0],
        sizeSpec,
        "default",
      ),
      "rect",
    );
    const shapes = draw!({
      props,
      size: sizeSpec,
      visual: undefined,
      style: undefined,
    });
    expect(shapes).toEqual(legacyBackdrop);
  });
});

describe("기존 6 primitive 는 replace 모드 (불변)", () => {
  for (const key of [
    "checkbox",
    "radio",
    "dot",
    "divider",
    "icon_font",
    "switch_toggle",
  ]) {
    it(`${key} — replace 모드`, () => {
      expect(getSkiaPrimitiveMode(key)).toBe("replace");
    });
  }
});
