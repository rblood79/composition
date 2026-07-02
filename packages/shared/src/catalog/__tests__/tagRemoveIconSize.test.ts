import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * TagGroup remove X(trailing_icon) 크기 CSS↔Skia 대칭 회귀 방지 (2026-07-02).
 *
 * **배경**: TagGroup `allowsRemoving` 시 chip 우측 remove X 는
 *   - CSS(DOM): `TagGroup.tsx` 가 `<Button slot="remove"><X size={14} /></Button>` — **모든 size 에서
 *     14px 고정** Lucide glyph (프로젝트 다른 아이콘 Calendar/Table 16px 등과 동일한 고정-크기 컨벤션).
 *   - Skia: `buildCatalogShapes` trailingIcon 이 `size.iconSize`(= 본 rule) 를 glyph fontSize 로 사용.
 *
 *   ADR-912 Tag cutover 시 rule sizes.iconSize 를 `round(fontSize×0.75)`(xs8/sm9/md11/lg12/xl14)로
 *   두어 Skia X 가 CSS(14 고정)보다 작았다(md 11 vs 14 → 3px 작음). CSS↔Skia 시각 비대칭(D3 위반).
 *
 * **결정 (사용자 2026-07-02)**: CSS(14px 고정)를 정본으로, Skia 를 맞춘다. rule sizes.iconSize 를
 *   전 size 14 로 통일. Tag 는 leading icon 이 없어 iconSize 는 remove X(trailingIcon) 전용 —
 *   14 통일이 다른 아이콘에 부작용 없음. layout chip width 계산(resolveTagChipMetric)은 iconSize 가
 *   아니라 fontSize 로 remove 예약 폭을 잡으므로 layout 무영향. Tag 는 generated CSS 없음(DOM 은 부모
 *   TagGroup self-compose) → iconSize 변경이 CSS remove X(하드코딩 14) 에 영향 없음.
 *
 * **불변식**: Tag rule 의 모든 size iconSize = 14 (CSS `<X size={14}>` 와 대칭).
 */

const EXPECTED_ICON_SIZE = 14;

describe("Tag remove X iconSize — CSS(14px 고정) ↔ Skia 대칭", () => {
  it("Tag rule 의 모든 size iconSize = 14 (CSS <X size={14}> 정본 대칭)", () => {
    const tag = COMPONENT_RULES_TABLE.Tag;
    expect(tag, "Tag rule 미등록").toBeDefined();
    const sizes = Object.entries(tag?.sizes ?? {});
    expect(sizes.length, "Tag sizes 없음").toBeGreaterThan(0);

    const violations: string[] = [];
    for (const [size, spec] of sizes) {
      const iconSize = (spec as { iconSize?: unknown }).iconSize;
      if (iconSize !== EXPECTED_ICON_SIZE) {
        violations.push(
          `Tag.sizes.${size}.iconSize = ${JSON.stringify(iconSize)} (기대 ${EXPECTED_ICON_SIZE})`,
        );
      }
    }
    expect(
      violations,
      `remove X 크기 CSS(14)↔Skia 비대칭:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
