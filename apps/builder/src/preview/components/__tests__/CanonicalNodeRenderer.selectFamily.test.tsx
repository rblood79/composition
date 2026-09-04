import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "@composition/shared";

import {
  DELEGATING_INTERNAL_RENDERERS,
  DELEGATING_RAC_RENDERERS,
} from "../canonicalRendererRegistry";

/**
 * ADR-912 R1 Select family rebuild (2026-06-12) — DELEGATING 위임 멤버십 회귀 가드.
 *
 * **회귀 근본**: Select/ComboBox/NumberField/SearchField 는 FAMILY_4 catalog cutover 라
 * generic `cutoverPrimitives` 경로로 들어간다. 이들은 자식(SelectTrigger/SelectValue/SelectIcon)
 * 을 RAC `<Select>`/`<ComboBox>`/`<NumberField>`/`<SearchField>` controller 로 self-compose 하는
 * renderer(rendererMap)를 가진 wrapper 다. DELEGATING Set 에 등록되지 않으면 generic 자식 재귀가
 * 켜져, spec 삭제된 자식이 `<selecttrigger>`/`<selectvalue>`/`<selecticon>` **소문자 raw tag** 로
 * 떨어져 React unknown-tag 경고 + RAC controller 깨짐이 발생한다(2026-06-12 live 적발 → 수정).
 *
 * 본 가드는 4종이 올바른 DELEGATING Set 에 binding.source.kind 에 맞게 등록돼 있는지 검증한다.
 * Slider/SliderTrack 선례와 동형 — sub-part 자식의 DOM 미도달이 설계 의도.
 */
describe("CanonicalNodeRenderer — ADR-912 R1 Select family DELEGATING 위임", () => {
  it("internal source(select/combobox)는 DELEGATING_INTERNAL_RENDERERS 에 등록", () => {
    for (const type of ["Select", "ComboBox"]) {
      const binding = getPrimitiveBinding(type);
      expect(binding?.source.kind, `${type} binding source.kind`).toBe(
        "internal",
      );
      if (binding?.source.kind === "internal") {
        expect(
          DELEGATING_INTERNAL_RENDERERS.has(binding.source.renderer),
          `${type} (renderer="${binding.source.renderer}") 가 DELEGATING_INTERNAL_RENDERERS 에 누락 → generic 자식 재귀로 SelectTrigger raw tag 회귀`,
        ).toBe(true);
      }
    }
  });

  it("rac source(NumberField/SearchField)는 DELEGATING_RAC_RENDERERS 에 등록", () => {
    for (const type of ["NumberField", "SearchField"]) {
      const binding = getPrimitiveBinding(type);
      expect(binding?.source.kind, `${type} binding source.kind`).toBe("rac");
      expect(
        DELEGATING_RAC_RENDERERS.has(type),
        `${type} 이 DELEGATING_RAC_RENDERERS 에 누락 → generic 자식 재귀로 SelectTrigger raw tag 회귀`,
      ).toBe(true);
    }
  });

  // ADR-913 후속 fix (2026-06-19): TextField labelPosition="side" 미동작 가드.
  //   TextField 는 RAC export 존재 + DELEGATING 미등록이라 generic 경로(RAC `<TextField>` 직접)로
  //   떨어져 `data-label-position` 을 DOM 에 emit 하지 않았다(labelPosition kind:"enum" 은
  //   DATA_ATTR_KINDS 밖 → toRacProps 가 React prop 으로만 통과 → RAC unstyled 가 data-* 미생성 →
  //   generated CSS `[data-label-position="side"]` selector 영원히 미매칭 → Label 항상 top).
  //   renderTextField wrapper(composition TextField.tsx:92)가 data-label-position 을 명시 emit
  //   하므로 DELEGATING 등록으로 위임하면 NumberField/SearchField 와 동형 복구. 미등록 시 회귀.
  it("rac source(TextField)는 DELEGATING_RAC_RENDERERS 에 등록 (labelPosition side emit)", () => {
    const binding = getPrimitiveBinding("TextField");
    expect(binding?.source.kind, "TextField binding source.kind").toBe("rac");
    expect(
      DELEGATING_RAC_RENDERERS.has("TextField"),
      "TextField 가 DELEGATING_RAC_RENDERERS 에 누락 → generic 경로 → data-label-position 미emit → side 미동작 회귀",
    ).toBe(true);
  });

  it("Select family sub-part 3종은 catalog binding 보유 (Skia generic box/text/icon source)", () => {
    // 자식은 DOM 에서 부모 self-compose 로 흡수되지만, Skia 는 자기 노드를 generic 으로 그린다.
    // binding 누락 시 resolveEditContract(Inspector) 가 크래시(MeterValue 회귀 선례).
    for (const type of ["SelectTrigger", "SelectValue", "SelectIcon"]) {
      const binding = getPrimitiveBinding(type);
      expect(binding, `${type} binding`).toBeTruthy();
      expect(binding?.props.accepts, `${type} accepts`).toBeTruthy();
    }
    // SelectIcon 은 icon_font escape (box+text 아님 — Icon 동형)
    expect(getPrimitiveBinding("SelectIcon")?.skiaPrimitive).toBe("icon_font");
  });
});
