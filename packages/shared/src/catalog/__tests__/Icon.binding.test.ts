import { describe, expect, it } from "vitest";

import { getPrimitiveBinding, iconBinding } from "../bindings";
import { toRacProps } from "../outputs/toRacProps";

// ADR-142 foundation #1 — non-RAC leaf primitive(Icon = Lucide SVG)를
// PrimitiveBinding 으로 표현하기 위한 source 타입 일반화 검증.
describe("Icon binding (non-RAC leaf primitive)", () => {
  it("internal source — RAC 아님 (Lucide SVG 렌더러), rac 메타데이터 없음", () => {
    expect(iconBinding.source.kind).toBe("internal");
    if (iconBinding.source.kind === "internal") {
      expect(iconBinding.source.renderer).toBe("icon");
    }
    expect(iconBinding.rac).toBeUndefined();
  });

  it("accepts: iconName(icon)/size(size)/variant(variant)/strokeWidth(number)", () => {
    const accepts = iconBinding.props.accepts;
    expect(accepts.iconName.kind).toBe("icon");
    expect(accepts.size.kind).toBe("size");
    expect(accepts.variant.kind).toBe("variant");
    expect(accepts.strokeWidth.kind).toBe("number");
  });

  /**
   * **계약 정정 (2026-07-14, 사용자 적발: "md 를 제외하고 정합성이 일치하지 않는다")**.
   *
   * 이전 계약은 `size` 가 **`data-size` 로만** 나가는 것이었는데, 그게 곧 결함이었다.
   * `Icon.tsx` 는 size 를 **React prop 으로 소비**해 `ICON_SIZE_MAP[size]` → `<svg width>` 를
   * 계산한다. SVG width 는 **속성**이라 `[data-size]` CSS 로 도달할 수 없다 → React prop 이
   * 안 오면 default `"md"` 고정 → **DOM 이 항상 24px**. Skia 는 store 의 props.size 를 직접
   * 읽어 정상(16/18/24/36/48)이므로 **md 에서만 우연히 24 로 일치**하고 나머지는 전부 어긋났다.
   *
   * → `propPassthrough: ["size"]` 로 **React prop + data-\* 둘 다** emit 한다.
   *   (data-* 는 CSS/디버그 마커용으로 계속 유지 — 둘 중 하나를 고르는 게 아니다.)
   */
  it("toRacProps: size 는 React prop + data-size 둘 다 emit (variant 는 data-* 만)", () => {
    const result = toRacProps(
      {
        id: "icon1",
        type: "Icon",
        props: {
          iconName: "star",
          size: "lg",
          variant: "default",
          strokeWidth: 1.5,
        },
      },
      iconBinding,
    );
    expect(result).toEqual({
      iconName: "star",
      strokeWidth: 1.5,
      // Icon.tsx 가 React prop 으로 소비 → svg width/height 계산의 입력
      size: "lg",
      "data-size": "lg",
      // variant 는 색상만 바꾸고 CSS `[data-variant]` 가 처리 → data-* 만으로 충분
      "data-variant": "default",
    });
  });
});

describe("getPrimitiveBinding — Icon 등록", () => {
  it("returns the Icon binding for type 'Icon'", () => {
    expect(getPrimitiveBinding("Icon")).toBe(iconBinding);
  });
});
