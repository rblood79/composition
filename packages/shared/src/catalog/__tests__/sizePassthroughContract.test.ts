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
 * DatePicker 에서 실제로 재현된 버그이며, 아래 field/collection 8종이 **구조적으로 동일**하다
 * (`size = "md"` default + 자기 `data-size` emit + DELEGATING 렌더).
 *
 * **확장 (2026-07-14 2차, Icon 사용자 적발)**: 같은 root-cause 가 **INTERNAL_RENDERERS leaf**
 * (`source.kind: "internal"` React 컴포넌트)에도 있었다. 이쪽은 DELEGATING 이 아니라
 * `toRacProps` 결과를 **그대로 props 로 받는** 경로인데, 컴포넌트가 `size` 를 React prop 으로
 * 선언(`size = "md"`)하고 **크기 계산의 입력**으로 쓴다:
 *
 *   Icon:   `ICON_SIZE_MAP[size]` → `<svg width={pxSize}>` (SVG **속성** — CSS 로 도달 불가)
 *   Badge / Skeleton / StatusLight / Avatar / ProgressCircle: `data-size={size}` 재작성
 *
 * → passthrough 없으면 size 가 `undefined` → default 고정. Icon 은 **md(24) 에서만 우연히
 *   정답**이라 "md 만 맞고 나머지는 다 틀리다" 로 보고됐다 (Skia 는 store 의 props.size 를 직접
 *   읽어 정상 → DOM 만 24 고정 → md 제외 전 size 비대칭).
 *
 * 즉 판정 기준은 **DELEGATING 여부가 아니라 "컴포넌트가 size 를 React prop 으로 읽는가"** 다.
 */

/**
 * size 를 React prop 으로 소비하는 컴포넌트 전수 (DELEGATING wrapper + INTERNAL leaf).
 *
 * 신규 추가 판정: 해당 컴포넌트 구현이 `size = "md"` 처럼 **default 를 가진 React prop** 으로
 * size 를 선언하고 (a) 크기 계산에 쓰거나 (b) 자기 `data-size` 를 재작성하면 → 여기 추가 필수.
 */
const SIZE_PASSTHROUGH_TYPES = [
  // DELEGATING wrapper (field / collection) — self-compose, data-size 재작성
  "DatePicker",
  "DateRangePicker",
  "DateField",
  "TimeField",
  "Select",
  "ComboBox",
  "SearchField",
  "NumberField",
  // INTERNAL_RENDERERS leaf — toRacProps 결과를 직접 props 로 받는 React 컴포넌트
  "Icon", // ICON_SIZE_MAP[size] → svg width/height (SVG 속성, CSS 도달 불가)
  "Badge", // {...props} 뒤 data-size={size} 재작성 (default "sm")
  "StatusLight",
  "Avatar",
  "ProgressCircle",
] as const satisfies readonly ComponentTag[];

/**
 * **제외 — Skeleton**: `size` 를 accepts 에 갖지만 **어디서도 소비하지 않는다**.
 * 빌더 배치 노드가 타는 base 분기(`Skeleton.tsx` "Base skeleton")는 `data-variant` /
 * `data-animation` 만 emit 하고 `data-size` 를 쓰지 않으며, `Skeleton.css` 에도 `[data-size]`
 * 규칙이 없다 (`data-size` 를 쓰는 건 빌더 미노출 `componentVariant` 분기뿐). catalog rule 의
 * `sizes[*].height` 는 Skia/layout 전용 경로다. → passthrough 를 넣어도 시각 효과 0이므로
 * **근거 없는 확대**. size 를 실제 소비하게 되면 그때 위 목록에 추가할 것.
 */

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

/**
 * size 외 축의 동일 결함 — **컴포넌트가 `{...props}` 뒤에 자기 `data-X` 를 재작성**하면
 * 그 축 전부가 passthrough 대상이다 (size 만의 문제가 아니다).
 *
 * `Badge.tsx:78-93` 이 `data-variant` / `data-size` / `data-fill-style` 세 축을 모두 재작성하고,
 * `Badge.css` 는 그 셋을 전부 셀렉터로 소비한다 → passthrough 없으면 variant 를 바꿔도 항상
 * default `"accent"` 로 보이고, fillStyle 은 컴포넌트 default 가 없어 **속성 자체가 소실**된다.
 * StatusLight 가 같은 이유로 `["variant", "size"]` 를 갖는 선례.
 */
const MULTI_AXIS_PASSTHROUGH: ReadonlyArray<{
  type: ComponentTag;
  axes: ReadonlyArray<{ prop: string; value: string; dataAttr: string }>;
}> = [
  {
    type: "Badge",
    axes: [
      { prop: "variant", value: "negative", dataAttr: "data-variant" },
      { prop: "size", value: "xl", dataAttr: "data-size" },
      { prop: "fillStyle", value: "outline", dataAttr: "data-fill-style" },
    ],
  },
  {
    type: "StatusLight",
    axes: [
      { prop: "variant", value: "negative", dataAttr: "data-variant" },
      { prop: "size", value: "xl", dataAttr: "data-size" },
    ],
  },
];

describe("multi-axis propPassthrough — {...props} 뒤 data-* 재작성 컴포넌트", () => {
  it.each(MULTI_AXIS_PASSTHROUGH)(
    "$type: 재작성하는 축 전부가 React prop + data-* 둘 다 emit",
    ({ type, axes }) => {
      const binding = getPrimitiveBinding(type)!;
      const props = Object.fromEntries(axes.map((a) => [a.prop, a.value]));
      const result = toRacProps({ id: "n1", type, props }, binding) as Record<
        string,
        unknown
      >;

      for (const { prop, value, dataAttr } of axes) {
        expect(binding.props.propPassthrough, `${type}.${prop}`).toContain(
          prop,
        );
        // React prop 이 없으면 컴포넌트 default 가 data-* 를 덮어쓴다.
        expect(result[prop], `${type} React ${prop}`).toBe(value);
        expect(result[dataAttr], `${type} ${dataAttr}`).toBe(value);
      }
    },
  );
});
