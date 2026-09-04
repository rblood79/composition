import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

/**
 * 회귀 방지 — ADR-151 Phase 6 (2026-07-16).
 *
 * §1 Table fixed height border 보정 (B8 dh-2):
 *   DOM 은 외곽 `.react-aria-Table`(Table.css `border: 1px solid`, height 미지정) 안의
 *   `.react-aria-TableVirtualizer` 에 heightMode="fixed" 의 height(px) 를 준다 — 외곽
 *   border-box = height + 2. Skia 는 Table element 단일 box 라 border 2px 합산 필요
 *   (실측: factory 400 → CSS 402 vs Skia 400 상시 dh-2).
 *
 * §2 Heading/Paragraph/Description width:100% 선주입 (B22 잔여):
 *   flex 부모 battery 실측 (2026-07-16) 에서 Text 동형 발산 (Heading Skia 80 vs CSS 350).
 *   catalog top-level containerStyles.width="100%" + B22_CSS_FULL_WIDTH_TAGS 선주입.
 */

function apply(type: string, props: Record<string, unknown>) {
  const el = {
    id: "el-1",
    type,
    props,
    childrenIds: [],
  } as unknown as Element;
  const byId = new Map<string, Element>([[el.id, el]]);
  return applyImplicitStyles(el, [], () => [], byId);
}

function styleOf(result: ReturnType<typeof applyImplicitStyles>) {
  return (result.effectiveParent.props?.style ?? {}) as Record<string, unknown>;
}

describe("Table fixed height border 보정 (ADR-151 B8)", () => {
  it("factory height 400 → 402 주입 (border 1px×2 합산 — DOM 402 golden)", () => {
    const s = styleOf(apply("Table", { height: 400, style: {} }));
    expect(s.height).toBe(402);
    // ADR-204 G1 (2026-09-04): minHeight 는 catalog `containerStyles.minHeight: 40px` 채널 그대로 —
    //   DOM 외곽 `.react-aria-Table` 도 min-height 40 (Table.css) 이라 제약 flex column 에서 같이 줄어든다.
    //   종전 `minHeight: 402` 주입은 Canvas 에서만 축소를 막았다 (layout 402 vs DOM 80).
    expect(s.minHeight).toBe("40px");
  });

  // ADR-923 r22m1 (2026-09-02): prop 부재 기본값은 catalog binding accepts default 가 정본이다.
  //   `toRacProps` 가 prop 없는 Table 에 height 400 을 채워 Preview 는 402 인데, layout 만 자기
  //   리터럴 300 을 써 302 였다 (같은 canonical 입력의 두 표면 발산 — factory 가 항상 height:400
  //   을 기록해 생성 경로에서는 가려졌고 canonical/import 입력만 prop 부재를 표현한다).
  it("height 미지정 → binding default 400 + 2 = 402 (종전 layout 리터럴 300 → 302)", () => {
    const s = styleOf(apply("Table", { style: {} }));
    expect(s.height).toBe(402);
    expect(s.minHeight).toBe("40px");
  });

  it("사용자 style.height 명시 → 미주입 (사용자 우선)", () => {
    const s = styleOf(apply("Table", { height: 400, style: { height: 500 } }));
    expect(s.height).toBe(500);
  });

  it("heightMode auto → 미주입 (content 유지)", () => {
    const s = styleOf(apply("Table", { heightMode: "auto", style: {} }));
    expect(s.height).toBeUndefined();
  });
});

describe("Heading/Paragraph/Description width:100% 선주입 (ADR-151 B22 잔여)", () => {
  it.each([["Heading"], ["Paragraph"], ["Description"]])(
    "%s width 미지정 → width:100% 선주입 (catalog 채널)",
    (t) => {
      expect(styleOf(apply(t, { style: {} })).width).toBe("100%");
    },
  );

  it.each([["Heading"], ["Paragraph"], ["Description"]])(
    "%s 사용자 명시 width 우선 — 미주입",
    (t) => {
      expect(styleOf(apply(t, { style: { width: "120px" } })).width).toBe(
        "120px",
      );
    },
  );
});
