import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import { toRacProps } from "../outputs/toRacProps";
import type { ComponentTag } from "../../types/composition-vocabulary";

/**
 * `propPassthrough: ["size"]` 계약 — wrapper 가 size 를 **React prop 으로 소비**하는 컴포넌트 전수.
 *
 * **배경 (2026-07-14, DatePicker 사용자 적발 → 전수 확장)**:
 * `toRacProps` 는 `size`(kind:"size")를 기본적으로 `data-size` **속성으로만** 라우팅한다.
 * RAC primitive 는 unstyled 라 CSS 가 `[data-size]` 로 처리하면 되므로 이게 정상 설계다.
 *
 * 그러나 **composition wrapper 가 self-compose 하는 컴포넌트**(DELEGATING 렌더 경로)는 다르다:
 *  1. wrapper 가 `size` 를 **React prop 으로 직접 소비**한다 (하위 Label/Input/Button 크기 결정).
 *  2. wrapper 가 `{...props}` **뒤에** 자기 `data-size={size}` 를 **다시 쓴다**.
 *
 * → passthrough 가 없으면 **이중 실패**: wrapper 의 size 가 undefined → `default "md"` 고정,
 *   게다가 그 `"md"` 가 toRacProps 가 넣어준 `data-size="xl"` 를 **덮어써** CSS selector 가
 *   영원히 md 로 매칭된다. 즉 size 를 바꿔도 Preview 가 전혀 반응하지 않는다.
 *
 * DatePicker 에서 실제로 재현된 버그이며, 아래 5종이 **구조적으로 동일**하다
 * (`size = "md"` default + 자기 `data-size` emit + DELEGATING 렌더).
 * ProgressCircle / Avatar / StatusLight 는 같은 이유로 이미 passthrough 를 갖고 있다.
 */

/** wrapper 가 size 를 React prop 으로 소비 + 자기 data-size 를 재작성하는 컴포넌트. */
const SIZE_PASSTHROUGH_TYPES = [
  "DatePicker",
  "DateRangePicker",
  "DateField",
  "TimeField",
  "Select",
  "ComboBox",
  "SearchField",
  "NumberField",
] as const satisfies readonly ComponentTag[];

describe("size propPassthrough 계약 — wrapper self-compose 컴포넌트", () => {
  it.each(SIZE_PASSTHROUGH_TYPES)(
    "%s binding 이 propPassthrough 에 size 를 포함한다",
    (type) => {
      const binding = getPrimitiveBinding(type);
      expect(binding, `${type} binding`).toBeDefined();
      expect(binding!.props.propPassthrough).toContain("size");
    },
  );

  it.each(SIZE_PASSTHROUGH_TYPES)(
    "%s toRacProps: size 가 React prop + data-size 를 **둘 다** emit",
    (type) => {
      const result = toRacProps(
        { id: "n1", type, props: { size: "xl" } },
        getPrimitiveBinding(type)!,
      ) as Record<string, unknown>;

      // React prop — 이게 없으면 wrapper 가 default("md") 로 고정되고,
      //   wrapper 가 그 "md" 로 data-size 를 덮어써 CSS 가 영원히 md 매칭.
      expect(result.size, `${type} React size prop`).toBe("xl");
      // data-* — CSS selector 매칭용
      expect(result["data-size"], `${type} data-size`).toBe("xl");
    },
  );
});
