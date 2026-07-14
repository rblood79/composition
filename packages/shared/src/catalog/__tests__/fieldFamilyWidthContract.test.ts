import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { resolveCatalogContainerBase } from "../resolvers/resolveCatalogContainer";

/**
 * **field 패밀리 root width = catalog `containerStyles.width: "100%"` 단일 정본** (2026-07-15,
 * 사용자 적발: "DatePicker 의 width 가 catalog 에 기본값이 auto 다 — 유사한 컴포넌트들은 모두 100%").
 *
 * ## 왜 catalog 인가 (factory inline 아님)
 *
 * Style 패널 Transform 의 width 는 `toStr(inline, specDefault, "auto")`
 * (`TransformSection.tsx`) — **specDefault = catalog `containerStyles.width`**. catalog 가 비면
 * 패널이 `"auto"` fallback 을 표시한다. factory inline 으로 채우면 값은 보이지만:
 *
 *  - Style 패널 **false dirty** (inline ≠ baseline → reset 버튼이 상시 활성)
 *  - layout 기본값을 factory 가 소유 → catalog 가 시각 SSOT 라는 D3 계약 위반
 *
 * → 정본은 catalog. (`feedback-layout-default-belongs-in-catalog-not-factory-overlay`,
 *   `useResetStyles.ts` 의 factory-inline baseline mirror 들이 그 우회 비용이다.)
 *
 * ## 적발 당시 상태 — DatePicker/DateRangePicker 만 **양쪽 다 부재**
 *
 * | 컴포넌트                                   | factory root | catalog width | 패널 표시   |
 * | ------------------------------------------ | ------------ | ------------- | ----------- |
 * | TextField / TextArea / SearchField          | 100%         | 100%          | 100%        |
 * | NumberField / DateField / TimeField /       | 100%         | (없음)        | 100%(inline)|
 * | Select / ComboBox                           |              |               |             |
 * | **DatePicker / DateRangePicker**            | **없음**     | **없음**      | **auto** ←  |
 *
 * 2026-06-24 정정이 TextField/TextArea/SearchField/ColorField 만 catalog 로 올리고 나머지는
 * "factory 100% 가 baseline 이라 정합" 으로 남겨둔 결과, **factory 조차 없던 두 picker 만**
 * 어느 쪽에서도 width 를 못 받아 `auto` 로 떨어졌다. → catalog 를 패밀리 전체의 단일 정본으로
 * 채워 이 split 자체를 없앤다.
 */

/** flex-column field 패밀리 — root 가 폼 안에서 전체 폭을 차지하는 컨테이너. */
const FIELD_FAMILY = [
  "TextField",
  "TextArea",
  "SearchField",
  "NumberField",
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
  "Select",
  "ComboBox",
] as const;

describe("field 패밀리 root width — catalog 단일 정본 (100%)", () => {
  it.each(FIELD_FAMILY)(
    "%s — catalog composition.containerStyles.width = 100%%",
    (type) => {
      const rule = COMPONENT_RULES_TABLE[
        type as keyof typeof COMPONENT_RULES_TABLE
      ] as unknown as {
        structure?: {
          composition?: { containerStyles?: Record<string, unknown> };
        };
      };
      const width = rule?.structure?.composition?.containerStyles?.width;
      // 부재(undefined) 면 Style 패널이 "auto" 로 떨어진다 — DatePicker 적발 지점.
      expect(width, `${type} containerStyles.width`).toBe("100%");
    },
  );

  it.each(FIELD_FAMILY)(
    "%s — resolver 출력(Preview CSS/Skia 공통 base)에도 width 100%% 도달",
    (type) => {
      // catalog 에 써도 resolver merge 에서 탈락하면 소용없다 (layout base 위 merge 확인).
      expect(
        resolveCatalogContainerBase(type).width,
        `${type} base.width`,
      ).toBe("100%");
    },
  );

  /**
   * ColorField 는 `layout: "flex-row"` (hex 입력 + swatch 가로 배치) 라 위 목록과 archetype 이
   * 다르지만, root width 정본은 동일하게 100% (2026-06-23 선행 정정). 같이 못박아 둔다.
   */
  it("ColorField — flex-row archetype 이지만 root width 는 동일하게 100%", () => {
    expect(resolveCatalogContainerBase("ColorField").width).toBe("100%");
  });
});
