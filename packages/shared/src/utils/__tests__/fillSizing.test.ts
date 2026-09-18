import { describe, expect, it } from "vitest";
import {
  hasDefiniteAxisSize,
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

  it("hug 부모 (그 축 크기 없음) 의 fraction Fill 은 basis auto — 항목이 pad/border 만 남기고 무너지지 않는다", () => {
    const fill = { height: { factor: 1 } };
    const column = { display: "flex", flexDirection: "column" };
    expect(
      resolveFillProjection(
        fill,
        {},
        { ...column, definite: { height: false } },
      ),
    ).toMatchObject({ height: "auto", flexGrow: 1, flexBasis: "auto" });
    expect(
      resolveFillProjection(
        fill,
        {},
        { ...column, definite: { height: true } },
      ),
    ).toMatchObject({ flexBasis: "0px" });
    // definite 생략 = 정해진 것으로 (기존 호출자 호환)
    expect(resolveFillProjection(fill, {}, column)).toMatchObject({
      flexBasis: "0px",
    });
    // 교차축 stretch 는 hug 여부와 무관
    expect(
      resolveFillProjection(
        { width: { factor: 1 } },
        {},
        { ...column, definite: { width: false } },
      ),
    ).toMatchObject({ alignSelf: "stretch" });
  });

  it("hasDefiniteAxisSize — 명시 길이 · % · 자기 Fill · body · legacy grow/stretch 는 정해진 축", () => {
    const row = { display: "flex", flexDirection: "row" };
    expect(hasDefiniteAxisSize({}, { height: "240px" }, "height")).toBe(true);
    expect(hasDefiniteAxisSize({}, { height: "50%" }, "height")).toBe(true);
    expect(hasDefiniteAxisSize({}, { height: 240 }, "height")).toBe(true);
    expect(hasDefiniteAxisSize({}, {}, "height")).toBe(false);
    expect(hasDefiniteAxisSize({}, { height: "auto" }, "height")).toBe(false);
    expect(hasDefiniteAxisSize({}, { height: "fit-content" }, "height")).toBe(
      false,
    );
    expect(
      hasDefiniteAxisSize({ sizing: { height: { factor: 1 } } }, {}, "height"),
    ).toBe(true);
    expect(hasDefiniteAxisSize({ type: "body" }, {}, "height")).toBe(true);
    expect(
      hasDefiniteAxisSize({}, { flexGrow: 1 }, "width", "desktop", row),
    ).toBe(true);
    expect(
      hasDefiniteAxisSize(
        {},
        { alignSelf: "stretch" },
        "height",
        "desktop",
        row,
      ),
    ).toBe(true);
    expect(hasDefiniteAxisSize({}, { flexGrow: 1 }, "width")).toBe(false);
  });

  it("emitter: hug column 안의 Height Fill 은 flex-basis auto, 정해진 column 은 0px", () => {
    const child = (parent: string) => ({
      id: `c-${parent}`,
      type: "Button",
      parent_id: parent,
      props: { style: {} },
      sizing: { height: { factor: 1 } },
    });
    const css = collectResponsiveCssFromElements([
      {
        id: "hug",
        type: "frame",
        parent_id: null,
        props: { style: { display: "flex", flexDirection: "column" } },
      },
      {
        id: "fixed",
        type: "frame",
        parent_id: null,
        props: {
          style: { display: "flex", flexDirection: "column", height: "240px" },
        },
      },
      child("hug"),
      child("fixed"),
    ] as never);
    const hugRule = css
      .split("\n")
      .find((l) => l.startsWith('[data-element-id="c-hug"]'));
    const fixedRule = css
      .split("\n")
      .find((l) => l.startsWith('[data-element-id="c-fixed"]'));
    expect(hugRule).toContain("flex-basis:auto !important");
    expect(fixedRule).toContain("flex-basis:0px !important");
  });
});
