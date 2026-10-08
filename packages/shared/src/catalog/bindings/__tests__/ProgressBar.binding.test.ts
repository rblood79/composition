import { describe, expect, it } from "vitest";

import { progressBarBinding } from "../ProgressBar.binding";
import { getPrimitiveBinding } from "../index";
import {
  getCatalogEntry,
  getCatalogCutoverTypes,
} from "../../componentCatalog";
import { toRacProps } from "../../outputs/toRacProps";

/**
 * ADR-912 진로 1번 ProgressBar proof slice (value-fill compound catalog 발효, 2026-06-07).
 *
 * ProgressBar 는 노드 트리 (ADR-256 Phase 7a — RAC ProgressBar 가 자식 노드를 그리고, Canvas 는
 * track · fill 노드가 각자 칠한다). 본 test 는 binding
 * 등록 정합 + cutover 게이트 진입 + toRacProps prop 투영을 고정한다.
 */
describe("ProgressBar binding — value-fill compound (internal wrapper 위임)", () => {
  it("PRIMITIVE_BINDINGS 에 등록 + internal source renderer='progressbar'", () => {
    expect(getPrimitiveBinding("ProgressBar")).toBe(progressBarBinding);
    expect(progressBarBinding.source.kind).toBe("internal");
    expect(
      progressBarBinding.source.kind === "internal"
        ? progressBarBinding.source.renderer
        : null,
    ).toBe("progressbar");
  });

  it("부모 자체 skiaPrimitive 없음 (track · fill 노드가 칠한다)", () => {
    expect(progressBarBinding.skiaPrimitive).toBeUndefined();
  });

  it("catalog entry 등록 + cutover='catalog' 게이트 진입", () => {
    const entry = getCatalogEntry("ProgressBar");
    expect(entry?.type).toBe("ProgressBar");
    expect(entry?.kind).toBe("primitive");
    expect([...getCatalogCutoverTypes()]).toContain("ProgressBar");
  });

  it("accepts: value/minValue/maxValue/label/variant/size/isIndeterminate/showValueLabel", () => {
    const a = progressBarBinding.props.accepts;
    expect(a.value?.kind).toBe("number");
    expect(a.minValue?.kind).toBe("number");
    expect(a.maxValue?.kind).toBe("number");
    expect(a.label?.kind).toBe("string");
    expect(a.variant?.kind).toBe("variant");
    expect(a.size?.kind).toBe("size");
    expect(a.isIndeterminate?.kind).toBe("boolean");
    expect(a.showValueLabel?.kind).toBe("boolean");
  });

  it("toRacProps: value(number) React prop 통과, variant/size 는 data-attr 라우팅", () => {
    const node = {
      id: "x",
      type: "ProgressBar",
      props: { value: 60, size: "lg", variant: "accent", label: "P" },
    };
    const rac = toRacProps(node as never, progressBarBinding);
    // value/label 은 React prop (renderProgressBar 가 소비)
    expect(rac.value).toBe(60);
    expect(rac.label).toBe("P");
    // variant/size 는 data-attr (RAC unstyled + generated CSS)
    expect(rac["data-size"]).toBe("lg");
    expect(rac["data-variant"]).toBe("accent");
  });
});
