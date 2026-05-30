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

  it("toRacProps: size/variant → data-*, iconName/strokeWidth → prop", () => {
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
      "data-size": "lg",
      "data-variant": "default",
    });
  });
});

describe("getPrimitiveBinding — Icon 등록", () => {
  it("returns the Icon binding for type 'Icon'", () => {
    expect(getPrimitiveBinding("Icon")).toBe(iconBinding);
  });
});
