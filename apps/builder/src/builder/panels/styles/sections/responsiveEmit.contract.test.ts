/**
 * ADR-168 R7 — 프리셋 authoring 키의 publish `@media` emit 계약 (builder 측 라이브 가드).
 *
 * ## 왜 builder 에 있는가
 *
 * 대상 함수는 `packages/shared/src/utils/responsiveCss.ts` 이고 그 옆에 같은 취지의 테스트가
 * 있다. 다만 `@composition/shared` 패키지에는 vitest 가 설치돼 있지 않아 `turbo run test` 에서
 * `@composition/shared#test` 가 MODULE_NOT_FOUND 로 실패한다 — 즉 shared 의 테스트는 **실행되지
 * 않는다.** 회귀 가드가 실행되지 않으면 없는 것과 같으므로, 실제로 도는 builder 스위트에 계약을
 * 둔다 (builder vitest 는 `@composition/shared` 를 소스 alias 로 해석한다).
 *
 * shared 러너가 복구되면 이 파일은 중복이 되지만, 그때 정리하는 편이 지금 가드가 비는 것보다 낫다.
 *
 * ## 무엇을 지키는가
 *
 * grid line 은 length 가 아니라 **line 번호**다. `formatCssValue` 가 숫자에 px 를 붙이면
 * `grid-column-start:1px` 이 되어 선언이 통째로 무효화되고, DOM 은 auto-placement 로 흐르는데
 * Skia 는 numeric line 으로 정상 배치한다 → **배포 산출물에서 DOM↔Skia 발산.**
 * `overflow` shorthand 만 등재돼 longhand 편집이 흡수되던 ADR-156 R6 과 동형이다.
 */
import { describe, expect, it } from "vitest";
import {
  buildResponsiveElementCss,
  isResponsiveEligibleStyleProp,
  type ElementResponsiveConfig,
} from "@composition/shared";

/** 규칙 문자열에서 선택자 뒤 선언 블록만 뽑는다 (미디어 쿼리 조건절의 px 를 배제) */
function declarationBlocks(css: string | null, elementId: string): string[] {
  if (!css) return [];
  const re = new RegExp(
    `\\{\\[data-element-id="${elementId}"\\]\\{([^}]*)\\}`,
    "g",
  );
  return [...css.matchAll(re)].map((m) => m[1]);
}

describe("ADR-168 R7 — grid authoring 키의 @media emit", () => {
  it("grid line longhand 4키가 eligible (프리셋 override 가 publish 까지 도달)", () => {
    for (const key of [
      "gridColumnStart",
      "gridColumnEnd",
      "gridRowStart",
      "gridRowEnd",
      "gridTemplateColumns",
      "gridTemplateRows",
      "gridTemplateAreas",
    ]) {
      expect(isResponsiveEligibleStyleProp(key), `${key} eligible`).toBe(true);
    }
  });

  it("grid line 숫자 값에 px 가 붙지 않는다", () => {
    const responsive: ElementResponsiveConfig = {
      styles: {
        gridColumnStart: { tablet: 1 },
        gridColumnEnd: { tablet: 3 },
        gridRowStart: { tablet: 2 },
        gridRowEnd: { tablet: 4 },
      },
    };

    const css = buildResponsiveElementCss("g", {}, responsive);
    const blocks = declarationBlocks(css, "g");

    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0]).toContain("grid-column-start:1 !important");
    expect(blocks[0]).toContain("grid-column-end:3 !important");
    expect(blocks[0]).toContain("grid-row-start:2 !important");
    expect(blocks[0]).toContain("grid-row-end:4 !important");
    for (const b of blocks) expect(b).not.toContain("px");
  });

  it("문자열 authoring 도 동일 결과 — base↔override 비대칭 없음", () => {
    // 현행 프리셋은 String(...) 으로 문자열화해 authoring 한다. 숫자/문자열 어느 쪽으로
    // 써도 같은 CSS 가 나와야 base inline(React auto-unit)과 어긋나지 않는다.
    const asString: ElementResponsiveConfig = {
      styles: { gridColumnStart: { tablet: "1" } },
    };
    const asNumber: ElementResponsiveConfig = {
      styles: { gridColumnStart: { tablet: 1 } },
    };

    expect(
      declarationBlocks(buildResponsiveElementCss("s", {}, asString), "s"),
    ).toEqual(
      declarationBlocks(buildResponsiveElementCss("s", {}, asNumber), "s"),
    );
  });

  it("grid 트랙 템플릿 override 가 @media 로 emit", () => {
    const responsive: ElementResponsiveConfig = {
      styles: { gridTemplateColumns: { tablet: "160px 1fr 160px" } },
    };

    const css = buildResponsiveElementCss(
      "t",
      { gridTemplateColumns: "200px 1fr 200px" },
      responsive,
    );
    expect(declarationBlocks(css, "t")[0]).toContain(
      "grid-template-columns:160px 1fr 160px !important",
    );
  });

  it("gridArea shorthand 는 emit 되지 않는다 (M3 — source order 승자 문제 회피)", () => {
    // 타입상으로도 `ResponsiveStyles` 에 gridArea 가 없다(의도) — 런타임 필터까지
    // 이중으로 막히는지 보려고 캐스트로 억지 구성한다. 저장 경로가 타입을 우회해도
    // emit 단계에서 걸러져야 한다.
    const responsive = {
      styles: { gridArea: { tablet: "sidebar" } },
    } as unknown as ElementResponsiveConfig;
    expect(buildResponsiveElementCss("a", {}, responsive)).toBe(null);
  });
});
