import { describe, expect, it } from "vitest";

// ADR-912 단계5 step4 Phase 1 batch 2 (2026-06-16): DropZoneSpec import 제거 — spec 삭제로
//   parity 비교 대상(legacy render.shapes) 소멸. cutover parity 는 이미 입증(아래 describe 제거).
// ADR-912 단계5 step4 small-B (2026-06-16): ModalSpec import 제거 — spec 삭제로 parity 대상 소멸.
// ADR-912 단계5 step4 Tooltip 단건 (2026-06-16): TooltipSpec import 제거 — spec 삭제로 parity
//   비교 대상(legacy render.shapes) 소멸. 아래 Tooltip describe(it.skip 보강 대기)도 제거.
// ADR-912 단계5 step4 Dialog 단건 (2026-06-16): DialogSpec import 제거 — spec 삭제로 parity 대상 소멸.
//   아래 Dialog describe(backdrop+shadow prepend parity)도 제거. backdrop/shadow primitive 절대값
//   parity 는 skiaPrimitives.overlay.test.ts 로 이전(spec oracle 불요).
import { PopoverSpec } from "../../components/Popover.spec";
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

// ADR-912 단계5 step4 Dialog 단건 (2026-06-16): Dialog parity describe 제거 — Dialog.spec 삭제로
//   legacy render.shapes 비교 대상 소멸. backdrop/shadow primitive 절대값 parity 는
//   skiaPrimitives.overlay.test.ts(dialog_shadow / overlay_backdrop) 로 이전. z-order 합성 규약
//   (prepend) 검증은 Popover describe 가 동일 메커니즘으로 cover. Popover 는 spec 보존(유지).

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

// ADR-912 단계5 step4 Tooltip 단건 (2026-06-16): Tooltip parity describe 제거 — Tooltip.spec 삭제로
//   legacy render.shapes 비교 대상 소멸. 본 describe 는 이미 it.skip(보강 대기 — text align/weight
//   불일치)이었어 실행 0 → 검증 가치 0. arrow append parity 는 skiaPrimitives.overlay.test.ts 의
//   tooltip_arrow 절대값 단언으로 대체. Dialog/Popover 는 각 spec 보존(유지).
// ADR-912 단계5 step4 Phase 1 batch 2 (2026-06-16): DropZone parity describe 제거 — DropZone.spec
//   삭제로 legacy render.shapes 비교 대상 소멸. cutover parity(buildCatalogShapes generic box+dashed
//   border ↔ 구 render.shapes)는 이미 입증됐고, 이제 catalog rule(COMPONENT_RULES_TABLE.DropZone)이
//   단일 source → parity 테스트 존재 의의 소멸. Dialog/Popover/Tooltip 은 각 spec 보존(유지).
// ADR-912 단계5 step4 small-B (2026-06-16): Modal parity describe 제거 — Modal.spec 삭제로 legacy
//   render.shapes(=[]) 비교 대상 소멸. transparent shell parity 는 이미 입증됐고 catalog rule
//   (COMPONENT_RULES_TABLE.Modal)이 단일 source → parity 테스트 존재 의의 소멸 (DropZone 동형).
