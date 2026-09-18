import { describe, expect, it } from "vitest";
import type { Element } from "../../../types/core/store.types";
import { buildSizingEdit } from "./sizingEdit";
import { resolveEffectiveFill } from "@composition/shared";

const row = { display: "flex", flexDirection: "row" };
const node = (patch: Partial<Element> = {}): Element =>
  ({
    id: "n",
    type: "Button",
    props: { style: { width: "240px", minWidth: "80px" } },
    ...patch,
  }) as Element;
describe("ADR-224 크기 명령", () => {
  it("Fill 선택만으로 1, 같은 상자 가중치 편집은 CSS 픽셀이 아니다", () => {
    const before = node();
    const after = {
      ...before,
      ...buildSizingEdit(
        before,
        before,
        { axis: "width", mode: "fill" },
        row,
        "desktop",
      ),
    };
    expect(after.sizing).toEqual({ width: { factor: 1 } });
    expect(after.props.style).toEqual({ minWidth: "80px" });
    const edited = buildSizingEdit(
      after,
      after,
      { axis: "width", mode: "fill", factor: 2 },
      row,
      "desktop",
    );
    expect(edited?.sizing?.width?.factor).toBe(2);
    expect(edited?.props?.style).not.toHaveProperty("width");
  });
  it("재선택은 각 기존 가중치를 보존하고 CSS grow 0.5도 migration하지 않는다", () => {
    for (const factor of [1, 2, 3]) {
      const before = node({ sizing: { width: { factor } } });
      expect(
        buildSizingEdit(
          before,
          before,
          { axis: "width", mode: "fill" },
          row,
          "desktop",
        ),
      ).toEqual({});
    }
    const legacy = node({ props: { style: { flexGrow: 0.5 } } });
    expect(
      buildSizingEdit(
        legacy,
        legacy,
        { axis: "width", mode: "fill" },
        row,
        "desktop",
      ),
    ).toEqual({});
  });
  it("tier Fixed는 inherited Fill을 null로 해제하고 반대 축·제약을 보존한다", () => {
    const before = node({
      sizing: { width: { factor: 2 }, height: { factor: 3 } },
      responsive: { styles: { width: { tablet: "auto" } } },
    });
    const after = {
      ...before,
      ...buildSizingEdit(
        before,
        before,
        { axis: "width", mode: "css", value: "320px" },
        row,
        "tablet",
      ),
    };
    expect(resolveEffectiveFill(after, "tablet")).toEqual({
      width: null,
      height: { factor: 3 },
    });
    expect(after.responsive?.styles?.width?.tablet).toBe("320px");
    expect(after.props.style).toEqual(before.props.style);
  });
  it("flex 주축의 Fixed와 Parent %는 shrink 0으로 used size를 보존한다", () => {
    const before = node();
    expect(
      buildSizingEdit(
        before,
        before,
        { axis: "width", mode: "css", value: "200px" },
        row,
        "desktop",
      )?.props?.style,
    ).toMatchObject({ width: "200px", flexShrink: "0" });
    expect(
      buildSizingEdit(
        before,
        before,
        { axis: "width", mode: "css", value: "100%" },
        row,
        "desktop",
      )?.props?.style,
    ).toMatchObject({ width: "100%", flexShrink: "0" });
  });
  it("무효 가중치와 absolute Fill은 무변경 거부한다", () => {
    const before = node();
    for (const factor of [0, 0.5, 1001, Infinity, NaN])
      expect(
        buildSizingEdit(
          before,
          before,
          { axis: "width", mode: "fill", factor },
          row,
          "desktop",
        ),
      ).toBeNull();
    const absolute = node({ props: { style: { position: "absolute" } } });
    expect(
      buildSizingEdit(
        absolute,
        absolute,
        { axis: "width", mode: "fill" },
        row,
        "desktop",
      ),
    ).toBeNull();
  });
});
