import { describe, expect, it } from "vitest";

import { CheckboxSpec } from "../../components/Checkbox.spec";
import { RadioSpec } from "../../components/Radio.spec";
import { SliderSpec } from "../../components/Slider.spec";
import { SwitchSpec } from "../../components/Switch.spec";
import { getSkiaPrimitive } from "../skiaPrimitives";
import { resolveComponentVisual } from "../utils/resolveComponentVisual";
import { callCatalogShapes as buildCatalogShapes } from "./callCatalogShapes";

/**
 * ADR-142 family ③(selection) — Checkbox/Radio/Switch indicator skiaPrimitive parity.
 *
 * **정본 (사용자 family ① 정정 정합)**: indicator(box/circle/track+thumb)는 box+text 로 표현
 * 불가한 비-DOM-trivial primitive → `skiaPrimitive` draw module(skiaPrimitives.ts)이 그린다.
 * label 은 자식 Label Element(canonical children)가 담당하므로 draw module 은 indicator 만.
 *
 * 본 테스트는 `_hasChildren: true`(label 스킵 — cutover 후 자식 Label 이 담당) 케이스에서
 * draw module 출력이 legacy spec.render.shapes 의 indicator shape 와 **완전 parity** 임을 보장.
 * buildCatalogShapes 안에 isCheckbox/isRadio 컴포넌트 식별 분기를 두지 않는다(N++ 복제 방지).
 */

// ADR-142 B2: skiaPrimitive draw fn 은 ComponentVisualRule 을 받는다(spec-free). 테스트는
// specs 내부 어댑터 resolveComponentVisual(spec, name) 로 visual 을 만들어 전달.
const visualOf = (
  spec: typeof CheckboxSpec | typeof RadioSpec | typeof SwitchSpec,
  variant: string,
) => resolveComponentVisual(spec as never, variant);

describe("skiaPrimitive 'checkbox' — Checkbox indicator parity", () => {
  const draw = getSkiaPrimitive("checkbox")!;
  const sizes = ["sm", "md", "lg"] as const;
  const variants = ["default", "emphasized"] as const;

  for (const size of sizes) {
    for (const variant of variants) {
      for (const isSelected of [false, true]) {
        it(`${variant}/${size}/selected=${isSelected} — legacy indicator parity`, () => {
          const props = { variant, isSelected, _hasChildren: true } as Record<
            string,
            unknown
          >;
          const sizeSpec = CheckboxSpec.sizes[size];
          // legacy render.shapes 는 _hasChildren=true 면 indicator 만(label 스킵)
          const legacy = CheckboxSpec.render.shapes(
            props as Parameters<typeof CheckboxSpec.render.shapes>[0],
            sizeSpec,
            "default",
          );
          const primitive = draw({
            props,
            size: sizeSpec,
            visual: visualOf(CheckboxSpec, variant),
            style: undefined,
          });
          expect(primitive).toEqual(legacy);
        });
      }
    }
  }

  it("indeterminate — 단일 line", () => {
    const props = {
      variant: "default",
      isSelected: true,
      isIndeterminate: true,
      _hasChildren: true,
    } as Record<string, unknown>;
    const legacy = CheckboxSpec.render.shapes(
      props as Parameters<typeof CheckboxSpec.render.shapes>[0],
      CheckboxSpec.sizes.md,
      "default",
    );
    const primitive = draw({
      props,
      size: CheckboxSpec.sizes.md,
      visual: visualOf(CheckboxSpec, "default"),
      style: undefined,
    });
    expect(primitive).toEqual(legacy);
  });
});

describe("skiaPrimitive 'radio' — Radio indicator parity", () => {
  const draw = getSkiaPrimitive("radio")!;
  const sizes = ["sm", "md", "lg"] as const;
  // Radio variant 키: default/accent/neutral/negative (Checkbox/Switch 와 달리 emphasized 없음)
  const variants = ["default", "accent", "neutral", "negative"] as const;

  for (const size of sizes) {
    for (const variant of variants) {
      for (const isSelected of [false, true]) {
        it(`${variant}/${size}/selected=${isSelected} — legacy indicator parity`, () => {
          const props = { variant, isSelected, _hasChildren: true } as Record<
            string,
            unknown
          >;
          const sizeSpec = RadioSpec.sizes[size];
          const legacy = RadioSpec.render.shapes(
            props as Parameters<typeof RadioSpec.render.shapes>[0],
            sizeSpec,
            "default",
          );
          const primitive = draw({
            props,
            size: sizeSpec,
            visual: visualOf(RadioSpec, variant),
            style: undefined,
          });
          expect(primitive).toEqual(legacy);
        });
      }
    }
  }
});

describe("Slider — variant 없는 컨테이너 빈 shell parity", () => {
  // Slider 는 skiaPrimitive 없음 → buildCatalogShapes 로 간다. track/thumb 은 자식
  // SliderTrack/Thumb sub-part 가 그리므로 부모는 _hasChildren 빈 shell 이어야 한다
  // (legacy render.shapes 도 _hasChildren=true 면 빈 배열).
  it("_hasChildren=true 면 빈 배열 (variant 없음 → 배경 box 생략)", () => {
    const legacy = SliderSpec.render.shapes(
      { _hasChildren: true, style: {} } as Parameters<
        typeof SliderSpec.render.shapes
      >[0],
      SliderSpec.sizes.md,
      "default",
    );
    const catalog = buildCatalogShapes(
      SliderSpec,
      { _hasChildren: true, style: {} },
      SliderSpec.sizes.md,
      "default",
    );
    // legacy 빈 배열 → catalog 도 빈 배열 (variant 없으면 box 생략)
    expect(legacy).toEqual([]);
    expect(catalog).toEqual([]);
  });
});

describe("skiaPrimitive 'switch_toggle' — Switch indicator parity", () => {
  const draw = getSkiaPrimitive("switch_toggle")!;
  const sizes = ["sm", "md", "lg"] as const;
  const variants = ["default", "emphasized"] as const;

  for (const size of sizes) {
    for (const variant of variants) {
      for (const isSelected of [false, true]) {
        it(`${variant}/${size}/selected=${isSelected} — legacy indicator parity`, () => {
          const props = { variant, isSelected, _hasChildren: true } as Record<
            string,
            unknown
          >;
          const sizeSpec = SwitchSpec.sizes[size];
          const legacy = SwitchSpec.render.shapes(
            props as Parameters<typeof SwitchSpec.render.shapes>[0],
            sizeSpec,
            "default",
          );
          const primitive = draw({
            props,
            size: sizeSpec,
            visual: visualOf(SwitchSpec, variant),
            style: undefined,
          });
          expect(primitive).toEqual(legacy);
        });
      }
    }
  }
});
