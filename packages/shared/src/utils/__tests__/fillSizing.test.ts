import { describe, expect, it } from "vitest";
import {
  mergeFillSizing,
  resolveEffectiveFill,
  resolveFillProjection,
} from "../fillSizing";
import { collectResponsiveCssFromElements } from "../responsiveCss";
import { CanonicalNodeSchema } from "../../schemas/project.schema";

describe("ADR-224 Fill 의도와 문맥", () => {
  it("방향 왕복에서 두 축 가중치를 보존한다", () => {
    const sizing = { width: { factor: 2 }, height: { factor: 3 } };
    expect(
      resolveFillProjection(
        sizing,
        {},
        { display: "flex", flexDirection: "row" },
      ),
    ).toMatchObject({
      flexGrow: 2,
      width: "auto",
      height: "auto",
      alignSelf: "stretch",
      minWidth: "0px",
    });
    expect(
      resolveFillProjection(
        sizing,
        {},
        { display: "flex", flexDirection: "column-reverse" },
      ),
    ).toMatchObject({ flexGrow: 3, minHeight: "0px" });
    expect(sizing).toEqual({ width: { factor: 2 }, height: { factor: 3 } });
  });
  it("ref 축 병합과 tier null을 보존한다", () => {
    const node = mergeFillSizing(
      {
        sizing: { width: { factor: 2 }, height: { factor: 3 } },
        responsive: { sizing: { tablet: { height: { factor: 4 } } } },
      },
      {
        sizing: { width: null },
        responsive: {
          sizing: {
            tablet: { height: null },
            mobile: { width: { factor: 5 } },
          },
        },
      },
    );
    expect(resolveEffectiveFill(node, "tablet")).toEqual({
      width: null,
      height: null,
    });
    expect(resolveEffectiveFill(node, "mobile")).toEqual({
      width: { factor: 5 },
      height: null,
    });
  });
  it("CSS-only, absolute, Grid에는 새 main min0/grow를 강제하지 않는다", () => {
    expect(
      resolveFillProjection(undefined, { flexGrow: 0.5 }, { display: "flex" }),
    ).toEqual({});
    expect(
      resolveFillProjection(
        { width: { factor: 1 } },
        { position: "absolute" },
        { display: "flex" },
      ),
    ).toEqual({});
    expect(
      resolveFillProjection({ width: { factor: 1 } }, {}, { display: "grid" }),
    ).toEqual({ width: "auto", justifySelf: "stretch" });
  });
  it("effective Min 보존과 명시 auto의 min0 정책", () => {
    const fill = { width: { factor: 1.5 } };
    expect(
      resolveFillProjection(fill, { minWidth: "240px" }, { display: "flex" }),
    ).not.toHaveProperty("minWidth");
    expect(
      resolveFillProjection(fill, { minWidth: "auto" }, { display: "flex" }),
    ).toHaveProperty("minWidth", "0px");
  });
  it("부모만 mobile column이어도 child CSS와 초기 grow 해제가 출력된다", () => {
    const css = collectResponsiveCssFromElements([
      {
        id: "p",
        props: { style: { display: "flex", flexDirection: "row" } },
        responsive: { styles: { flexDirection: { mobile: "column" } } },
      },
      { id: "c", parent_id: "p", sizing: { width: { factor: 2 } } },
    ]);
    expect(css).toContain("flex-grow:2 !important");
    expect(css).toContain("flex-grow:0 !important");
    expect(css).toContain("align-self:stretch !important");
  });
  it("영역 밖 factor와 알 수 없는 mode 저장을 거부한다", () => {
    for (const factor of [0, 0.5, 1001, NaN, Infinity])
      expect(
        CanonicalNodeSchema.safeParse({
          id: "a",
          type: "frame",
          sizing: { width: { factor } },
        }).success,
      ).toBe(false);
    expect(
      CanonicalNodeSchema.safeParse({
        id: "a",
        type: "frame",
        sizing: { width: { factor: 2 } },
        responsive: { sizing: { tablet: { width: null } } },
      }).success,
    ).toBe(true);
  });
});
