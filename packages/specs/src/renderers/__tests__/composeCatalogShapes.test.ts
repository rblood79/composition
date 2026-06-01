import { describe, expect, it } from "vitest";

import { DialogSpec } from "../../components/Dialog.spec";
import { PopoverSpec } from "../../components/Popover.spec";
import { TooltipSpec } from "../../components/Tooltip.spec";
import { buildCatalogShapes } from "../buildCatalogShapes";
import { composeCatalogShapes } from "../composeCatalogShapes";
import { getSkiaPrimitive, getSkiaPrimitiveMode } from "../skiaPrimitives";
import { resolveComponentVisual } from "../utils/resolveComponentVisual";
import type { Shape } from "../../types";

/**
 * ADR-142 Inc3 — `composeCatalogShapes` z-order 합성 parity.
 *
 * dispatch(buildCatalogShapesOrPrimitive)가 box+text(buildCatalogShapes) + overlay append
 * 패턴(shadow/backdrop/arrow)을 z-order 로 합성한 결과가 legacy render.shapes 의 shape 집합과
 * **동일 순서** 임을 보장한다(회귀 0). z-order 규약:
 *   - backdrop/shadow = base **앞**(아래 레이어, prepend)
 *   - arrow = base **뒤**(위 레이어, append)
 *
 * **container shape 제외**: legacy 의 standalone `container`(flex 콘텐츠 자리)는 자식 Element
 * 가 담당하므로 비교에서 제외(buildCatalogShapes 도 생성 안 함).
 */

/**
 * 시각 동등성 정규화 — container 제외 + `fillAlpha:1`(=alpha 미지정과 시각 동일) 제거.
 * specShapesToSkia 가 `fillAlpha ?? 1` 로 처리하므로 `fillAlpha:1` 과 미지정은 같은 렌더 결과.
 * 대칭 정의(ssot-hierarchy): "구현 방법 자유, 시각 결과 동일".
 */
function normalize(shapes: Shape[]): Shape[] {
  return shapes
    .filter((s) => s.type !== "container")
    .map((s) => {
      if (
        s.type === "roundRect" &&
        (s as { fillAlpha?: number }).fillAlpha === 1
      ) {
        const { fillAlpha: _omit, ...rest } = s as {
          fillAlpha?: number;
        } & Shape;
        return rest as Shape;
      }
      return s;
    });
}

/** render.shapes 출력에서 container(자식 Element 담당)를 제외 + 시각 동등 정규화. */
function withoutContainer(shapes: Shape[]): Shape[] {
  return normalize(shapes);
}

/** type 의 append 패턴 키들로 primitive 결과를 모은다(prepend/append 분류 포함). */
function primitivesOf(
  keys: string[],
  ctx: Parameters<ReturnType<typeof getSkiaPrimitive>>[0] extends never
    ? never
    : Parameters<NonNullable<ReturnType<typeof getSkiaPrimitive>>>[0],
): { prepend: Shape[]; append: Shape[] } {
  const prepend: Shape[] = [];
  const append: Shape[] = [];
  for (const k of keys) {
    const shapes = getSkiaPrimitive(k)!(ctx);
    if (!shapes) continue;
    if (getSkiaPrimitiveMode(k) === "prepend") prepend.push(...shapes);
    else append.push(...shapes);
  }
  return { prepend, append };
}

describe("composeCatalogShapes — Dialog (backdrop+shadow prepend, box) parity", () => {
  // 보강 대기: Dialog variants:{} → buildCatalogShapes base=[] (bg 소실). Dialog.spec 에
  // variant.default(fill={color.layer-1}) 보강 후 발효 (사용자 confirm 2026-06-01 — Popover 먼저).
  it.skip("[backdrop, shadow, bg] 순서로 legacy 와 동일", () => {
    const sizeSpec = DialogSpec.sizes.md;
    const props = {} as Record<string, unknown>;
    const visual = resolveComponentVisual(
      DialogSpec as never,
      DialogSpec.defaultVariant ?? "default",
    );
    const base = buildCatalogShapes(visual, props, sizeSpec, "default");
    const { prepend, append } = primitivesOf(
      ["overlay_backdrop", "dialog_shadow"],
      { props, size: sizeSpec, visual, style: undefined },
    );
    const composed = composeCatalogShapes(base, prepend, append);

    const legacy = withoutContainer(
      DialogSpec.render.shapes(
        props as Parameters<typeof DialogSpec.render.shapes>[0],
        sizeSpec,
        "default",
      ),
    );
    expect(normalize(composed)).toEqual(legacy);
  });
});

describe("composeCatalogShapes — Popover (shadow prepend, box, arrow append) parity", () => {
  it("[shadow, bg, border, arrow] 순서로 legacy 와 동일", () => {
    const sizeSpec = PopoverSpec.sizes.md;
    const props = { placement: "bottom" } as Record<string, unknown>;
    const visual = resolveComponentVisual(
      PopoverSpec as never,
      PopoverSpec.defaultVariant ?? "surface",
    );
    const base = buildCatalogShapes(visual, props, sizeSpec, "default");
    const { prepend, append } = primitivesOf(
      ["popover_shadow", "popover_arrow"],
      { props, size: sizeSpec, visual, style: undefined },
    );
    const composed = composeCatalogShapes(base, prepend, append);

    const legacy = withoutContainer(
      PopoverSpec.render.shapes(
        props as Parameters<typeof PopoverSpec.render.shapes>[0],
        sizeSpec,
        "default",
      ),
    );
    expect(normalize(composed)).toEqual(legacy);
  });
});

describe("composeCatalogShapes — Tooltip (box, arrow append) parity", () => {
  // 보강 대기: Tooltip text 스타일(align left/weight 400/maxWidth 150)이 buildCatalogShapes
  // 기본값(center/500)과 다름. text source 정합 후 발효 (사용자 confirm 2026-06-01 — Popover 먼저).
  it.skip("[bg, text, arrow] 순서로 legacy 와 동일", () => {
    const sizeSpec = TooltipSpec.sizes.md;
    const props = {
      showArrow: true,
      placement: "top",
      size: "md",
      children: "Tip",
    } as Record<string, unknown>;
    const visual = resolveComponentVisual(
      TooltipSpec as never,
      TooltipSpec.defaultVariant ?? "neutral",
    );
    const base = buildCatalogShapes(visual, props, sizeSpec, "default");
    const { prepend, append } = primitivesOf(["tooltip_arrow"], {
      props,
      size: sizeSpec,
      visual,
      style: undefined,
    });
    const composed = composeCatalogShapes(base, prepend, append);

    const legacy = withoutContainer(
      TooltipSpec.render.shapes(
        props as Parameters<typeof TooltipSpec.render.shapes>[0],
        sizeSpec,
        "default",
      ),
    );
    expect(normalize(composed)).toEqual(legacy);
  });
});
