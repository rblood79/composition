import { describe, expect, it } from "vitest";

import type { CanonicalNode } from "../../types/composition-document.types";
import type { ElementResponsiveConfig } from "../../types/responsive.types";
import {
  buildResponsiveElementCss,
  collectResponsiveCss,
  collectResponsiveCssFromElements,
} from "../responsiveCss";

/**
 * ADR-154 Phase 3 — @media CSS 출력 SSOT.
 *
 * R2(3경로 resolve 발산 차단): breakpoint 값이 `getResponsiveValueWithCascade` 로
 * pre-resolve 되어 layout resolve(`resolveResponsiveLayoutNode`)와 동일 결과를 내는지,
 * R6(inline specificity): `!important` @media 만 emit(base inline 무변경)하는지 검증.
 */
const MQ_TABLET = "@media (min-width: 768px) and (max-width: 1279px)";
const MQ_MOBILE = "@media (max-width: 767px)";

describe("buildResponsiveElementCss", () => {
  it("responsive 부재 → null", () => {
    expect(buildResponsiveElementCss("x", { display: "flex" }, undefined)).toBe(
      null,
    );
  });

  it("빈 config(styles/visibility 없음) → null", () => {
    expect(buildResponsiveElementCss("x", {}, {})).toBe(null);
  });

  it("tablet flexDirection override → tablet @media 만 !important 로 emit (desktop 무변경)", () => {
    const responsive: ElementResponsiveConfig = {
      styles: { flexDirection: { tablet: "column" } },
    };
    const css = buildResponsiveElementCss(
      "el1",
      { flexDirection: "row" },
      responsive,
    );
    // tablet 명시 + mobile 은 cascade 상속(desktop-first) → 두 블록. desktop(base) 미emit
    expect(css).toBe(
      `${MQ_TABLET}{[data-element-id="el1"]{flex-direction:column !important}}\n` +
        `${MQ_MOBILE}{[data-element-id="el1"]{flex-direction:column !important}}`,
    );
    // desktop(base) 규칙 미emit — inline 이 담당 (R6)
    expect(css).not.toContain("min-width: 1280px");
  });

  it("mobile 은 tablet override 를 cascade 상속 (mutually-exclusive range 보정)", () => {
    // mobile 자체 override 없음 → getResponsiveValueWithCascade(mobile) = tablet 값
    const responsive: ElementResponsiveConfig = {
      styles: { flexDirection: { tablet: "column" } },
    };
    const css = buildResponsiveElementCss(
      "el1",
      { flexDirection: "row" },
      responsive,
    );
    expect(css).toContain(
      `${MQ_TABLET}{[data-element-id="el1"]{flex-direction:column !important}}`,
    );
    expect(css).toContain(
      `${MQ_MOBILE}{[data-element-id="el1"]{flex-direction:column !important}}`,
    );
  });

  it("숫자 length 프로퍼티 → px 부착 (rowGap)", () => {
    const responsive: ElementResponsiveConfig = {
      styles: { rowGap: { tablet: 8 } },
    };
    const css = buildResponsiveElementCss("g", { rowGap: 16 }, responsive);
    expect(css).toBe(
      `${MQ_TABLET}{[data-element-id="g"]{row-gap:8px !important}}\n` +
        `${MQ_MOBILE}{[data-element-id="g"]{row-gap:8px !important}}`,
    );
  });

  it("unitless 프로퍼티 → px 미부착 (order)", () => {
    const responsive: ElementResponsiveConfig = {
      styles: { order: { tablet: 2 } },
    };
    const css = buildResponsiveElementCss("o", { order: 0 }, responsive);
    expect(css).toBe(
      `${MQ_TABLET}{[data-element-id="o"]{order:2 !important}}\n` +
        `${MQ_MOBILE}{[data-element-id="o"]{order:2 !important}}`,
    );
  });

  it("resolved === base → 중복 emit 억제", () => {
    // tablet override 가 base 와 동일 → @media 불필요
    const responsive: ElementResponsiveConfig = {
      styles: { flexDirection: { tablet: "row" } },
    };
    const css = buildResponsiveElementCss(
      "el",
      { flexDirection: "row" },
      responsive,
    );
    expect(css).toBe(null);
  });

  it("visibility false → display:none !important", () => {
    const responsive: ElementResponsiveConfig = {
      visibility: { mobile: false },
    };
    const css = buildResponsiveElementCss("v", { display: "flex" }, responsive);
    expect(css).toBe(
      `${MQ_MOBILE}{[data-element-id="v"]{display:none !important}}`,
    );
  });

  it("visibility display:none 는 style display override 뒤에 위치(최종 override)", () => {
    const responsive: ElementResponsiveConfig = {
      styles: { display: { tablet: "grid" } },
      visibility: { tablet: false },
    };
    const css = buildResponsiveElementCss("d", { display: "flex" }, responsive);
    // display:grid 먼저, display:none 뒤 → source order 로 none 최종. mobile 은 cascade 상속
    expect(css).toBe(
      `${MQ_TABLET}{[data-element-id="d"]{display:grid !important;display:none !important}}\n` +
        `${MQ_MOBILE}{[data-element-id="d"]{display:grid !important;display:none !important}}`,
    );
  });

  it("grid line longhand 숫자는 unitless emit — px 부착 금지 (ADR-168 R7)", () => {
    // formatCssValue 는 숫자에 px 를 붙인다. grid line 은 length 가 아니라 line 번호라
    // `grid-column-start:1px` 이 되면 **선언 자체가 무효** → DOM 은 auto-placement 로
    // 흐르고 Skia 는 numeric line 으로 정상 배치 → 배포 산출물에서 DOM↔Skia 발산.
    // 프리셋이 문자열로 authoring 해 현행은 우연히 안전하지만, CSSProperties 는
    // string|number 를 허용하고 base inline(React auto-unit)은 숫자를 정상 처리하므로
    // base↔override 비대칭을 남기면 안 된다.
    const responsive: ElementResponsiveConfig = {
      styles: {
        gridColumnStart: { tablet: 1 },
        gridColumnEnd: { tablet: 3 },
        gridRowStart: { tablet: 2 },
        gridRowEnd: { tablet: 4 },
      },
    };
    const css = buildResponsiveElementCss("g", {}, responsive);
    expect(css).toContain("grid-column-start:1 !important");
    expect(css).toContain("grid-column-end:3 !important");
    expect(css).toContain("grid-row-start:2 !important");
    expect(css).toContain("grid-row-end:4 !important");
    // 선언 블록에 px 가 없어야 한다 (미디어 쿼리 조건절의 px 는 대상 아님)
    const decls = [
      ...css!.matchAll(/\{\[data-element-id="g"\]\{([^}]*)\}/g),
    ].map((m) => m[1]);
    expect(decls.length).toBeGreaterThan(0);
    for (const d of decls) expect(d).not.toContain("px");
  });

  it("grid 트랙 템플릿 override 가 @media 로 emit (ADR-168 프리셋 authoring 축)", () => {
    const responsive: ElementResponsiveConfig = {
      styles: { gridTemplateColumns: { tablet: "160px 1fr 160px" } },
    };
    const css = buildResponsiveElementCss(
      "t",
      { gridTemplateColumns: "200px 1fr 200px" },
      responsive,
    );
    expect(css).toContain("grid-template-columns:160px 1fr 160px !important");
  });

  it("base 에 없던 프로퍼티도 override emit (undefined base cascade)", () => {
    const responsive: ElementResponsiveConfig = {
      styles: { flexDirection: { tablet: "column" } },
    };
    // base 에 flexDirection 없음 → resolved(column) !== undefined → emit
    const css = buildResponsiveElementCss("nb", {}, responsive);
    expect(css).toBe(
      `${MQ_TABLET}{[data-element-id="nb"]{flex-direction:column !important}}\n${MQ_MOBILE}{[data-element-id="nb"]{flex-direction:column !important}}`,
    );
  });
});

describe("collectResponsiveCss", () => {
  it("트리 순회 — responsive 보유 노드만 수집", () => {
    const tree: CanonicalNode[] = [
      {
        id: "root",
        type: "frame",
        props: { style: { flexDirection: "row" } },
        responsive: { styles: { flexDirection: { tablet: "column" } } },
        children: [
          {
            id: "child-plain",
            type: "Text",
            props: { style: {} },
          },
          {
            id: "child-resp",
            type: "frame",
            props: { style: { rowGap: 16 } },
            responsive: { styles: { rowGap: { mobile: 4 } } },
          },
        ],
      },
    ];
    const css = collectResponsiveCss(tree);
    expect(css).toContain(`[data-element-id="root"]{flex-direction:column`);
    expect(css).toContain(`[data-element-id="child-resp"]{row-gap:4px`);
    // plain 노드는 규칙 없음
    expect(css).not.toContain("child-plain");
  });

  it("responsive 노드 0 → 빈 문자열", () => {
    const tree: CanonicalNode[] = [
      { id: "a", type: "Text", props: { style: {} } },
    ];
    expect(collectResponsiveCss(tree)).toBe("");
  });
});

describe("collectResponsiveCssFromElements (flat runtime model — apps/publish)", () => {
  it("flat Element[] — responsive 보유 요소만 수집 (deleted 제외)", () => {
    const elements = [
      {
        id: "root",
        props: { style: { flexDirection: "row" } },
        responsive: {
          styles: { flexDirection: { tablet: "column" } },
        } as ElementResponsiveConfig,
      },
      { id: "plain", props: { style: { color: "red" } } },
      {
        id: "resp",
        props: { style: { width: "100%" } },
        responsive: {
          styles: { width: { mobile: 80 } },
        } as ElementResponsiveConfig,
      },
      {
        id: "gone",
        props: { style: {} },
        responsive: {
          visibility: { mobile: false },
        } as ElementResponsiveConfig,
        deleted: true,
      },
    ];
    const css = collectResponsiveCssFromElements(elements);
    expect(css).toContain(`[data-element-id="root"]{flex-direction:column`);
    expect(css).toContain(`[data-element-id="resp"]{width:80px`);
    // base-only / deleted 요소는 규칙 없음
    expect(css).not.toContain("plain");
    expect(css).not.toContain("gone");
  });

  it("visibility false → display:none @media", () => {
    const elements = [
      {
        id: "v",
        props: { style: {} },
        responsive: {
          visibility: { mobile: false },
        } as ElementResponsiveConfig,
      },
    ];
    expect(collectResponsiveCssFromElements(elements)).toContain(
      `[data-element-id="v"]{display:none !important}`,
    );
  });

  it("responsive 요소 0 → 빈 문자열", () => {
    expect(
      collectResponsiveCssFromElements([
        { id: "a", props: { style: { color: "blue" } } },
      ]),
    ).toBe("");
  });
});
