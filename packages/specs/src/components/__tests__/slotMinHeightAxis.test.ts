import { describe, expect, it } from "vitest";

import { SlotSpec } from "../Slot.spec";
import { generateCSS } from "../../renderers/CSSGenerator";

/**
 * ADR-923 Phase 5 후속 착수 8 (2026-09-04, 사용자 판단) — Slot 상자 높이 축은 **최소 높이**다.
 *
 * 착수 3 에서 Canvas 는 spec 값을 `minHeight` 로 번역해 주입했다 — layout 템플릿의 Slot 인라인
 * (`layoutTemplates.ts` `minHeight: 60` · content slot `flex: 1`) 과 같은 계약이라, 고정 높이로 누르면
 * flex 로 늘어나야 하는 slot 이 깨지기 때문이다. 그런데 spec 은 `height` 로 선언돼 있어 **선언과 소비
 * 의미가 어긋나** 있었고, 생성 CSS 는 DOM 에 고정 높이를 주고 있었다 (내용이 넘쳐도 60 에 고정).
 *
 * 이 게이트는 두 가지를 같이 고정한다 — spec 이 minHeight 축을 쓴다는 것, 그리고 생성 CSS 가 그것을
 * `min-height` 로 emit 한다는 것 (한쪽만 지키면 다음 사람이 spec 을 되돌려도 CSS 만 보고 통과한다).
 */
describe("Slot — 상자 높이 축은 minHeight (착수 8)", () => {
  it("spec sizes 는 height 가 아니라 minHeight 를 선언한다", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      const entry = SlotSpec.sizes?.[size];
      expect(entry, `Slot.sizes.${size}`).toBeDefined();
      expect(entry?.height, `Slot.sizes.${size}.height`).toBeUndefined();
      expect(typeof entry?.minHeight, `Slot.sizes.${size}.minHeight`).toBe(
        "number",
      );
    }
    expect([
      SlotSpec.sizes?.sm?.minHeight,
      SlotSpec.sizes?.md?.minHeight,
      SlotSpec.sizes?.lg?.minHeight,
    ]).toEqual([40, 60, 80]);
  });

  it("생성 CSS 는 min-height 를 emit 하고 고정 height 를 emit 하지 않는다", () => {
    const css = generateCSS(SlotSpec);
    expect(css).toContain("min-height: 60px;");
    expect(css).toContain("min-height: 40px;");
    expect(css).toContain("min-height: 80px;");
    // 고정 높이 emit 이 남아 있으면 내용이 넘쳐도 상자가 안 늘어난다 (전환 이전 상태).
    expect(css).not.toMatch(/^\s*height: \d+px;/m);
  });
});
