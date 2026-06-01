import { describe, expect, it } from "vitest";

import { DialogSpec } from "../../components/Dialog.spec";
import { DropZoneSpec } from "../../components/DropZone.spec";
import { ModalSpec } from "../../components/Modal.spec";
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
 * 시각 동등성 정규화 — 같은 렌더 결과인 표현 차이를 제거(대칭 정의 ssot-hierarchy:
 * "구현 방법 자유, 시각 결과 동일").
 *  - container 제외 (자식 Element 담당).
 *  - `fillAlpha:1` 제거 (specShapesToSkia 가 `fillAlpha ?? 1` 처리 → 미지정과 동일).
 *  - transparent fill roundRect 제외 (안 보이는 box — Modal 류 빈 shell. legacy `[]` 와 시각 동일).
 */
function normalize(shapes: Shape[]): Shape[] {
  return shapes
    .filter((s) => s.type !== "container")
    .filter(
      (s) =>
        !(
          s.type === "roundRect" &&
          (s as { fill?: unknown }).fill === "{color.transparent}"
        ),
    )
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
  // Dialog.spec variant.default(fill={color.layer-1}) 보강 후 발효 (Inc3 2026-06-01).
  it("[backdrop, shadow, bg] 순서로 legacy 와 동일", () => {
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

describe("composeCatalogShapes — DropZone (dashed border, box+text) parity", () => {
  // DropZone.spec variant.default(fill={color.base}, border={color.border}, borderStyle=dashed,
  // text={color.neutral-subdued}) 보강 후 발효 (Inc3 2026-06-01). skiaPrimitive 없음(box+text 만).
  // legacy 의 isActive=false(default state, isDropTarget 미주입) 경로와 비교.
  it("[bg, dashed border, text] 순서로 legacy(default state) 와 동일", () => {
    const sizeSpec = DropZoneSpec.sizes.md;
    // label 명시: legacy 는 props.label || "Drop files here" fallback 을 갖지만, buildCatalogShapes
    // 는 component-agnostic 이라 default label 을 모른다. 빌더 factory 가 label 기본값을 주입하는
    // 것이 정본(generic 렌더러는 props.label 만 그림) → 테스트도 동일 전제로 label 명시.
    const props = { label: "Drop files here" } as Record<string, unknown>;
    const visual = resolveComponentVisual(
      DropZoneSpec as never,
      DropZoneSpec.defaultVariant ?? "default",
    );
    const base = buildCatalogShapes(visual, props, sizeSpec, "default");
    // DropZone 은 skiaPrimitive 없음 → prepend/append 빈 배열.
    const composed = composeCatalogShapes(base, [], []);

    const legacy = withoutContainer(
      DropZoneSpec.render.shapes(
        props as Parameters<typeof DropZoneSpec.render.shapes>[0],
        sizeSpec,
        "default",
      ),
    );
    expect(normalize(composed)).toEqual(legacy);
  });
});

describe("composeCatalogShapes — Modal (transparent shell, no primitive) parity", () => {
  // Modal render.shapes=[] (portal 시각 없음, 자식 Element 컨테이너). buildCatalogShapes 는
  // variant fill transparent → transparent box 생성하나 시각 무해(normalize 제외) → legacy [] 와
  // 시각 동일. skiaPrimitive 없음(backdrop 은 ModalOverlay 별도 담당).
  it("_hasChildren shell — transparent box(무해) 외 legacy [] 와 시각 동일", () => {
    const sizeSpec = ModalSpec.sizes.md;
    const props = { _hasChildren: true } as Record<string, unknown>;
    const visual = resolveComponentVisual(
      ModalSpec as never,
      ModalSpec.defaultVariant ?? "default",
    );
    const base = buildCatalogShapes(visual, props, sizeSpec, "default");
    // Modal 은 skiaPrimitive 없음 → prepend/append 빈 배열.
    const composed = composeCatalogShapes(base, [], []);

    const legacy = withoutContainer(
      ModalSpec.render.shapes(
        props as Parameters<typeof ModalSpec.render.shapes>[0],
        sizeSpec,
        "default",
      ),
    );
    expect(normalize(composed)).toEqual(legacy);
  });
});
