import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * 트리거 아이콘 크기 = **아이콘 스케일** 단일 SSOT 회귀 방지 (2026-07-14, 사용자 적발).
 *
 * **배경**: DatePicker/DateRangePicker 의 트리거 버튼(`.react-aria-Button`)만 크기를
 * **typography 토큰**(`--text-xl` 등)으로 지정하고 있었다. 폰트 크기 스케일은 아이콘 박스
 * 스케일이 아니다 — `--text-xl`=20 / `--text-2xl`=24 / `--text-3xl`=30 이라 Skia 가 쓰는
 * `SelectIcon.sizes[*].iconSize`(18/22/28) 와 **md/lg/xl 전부 어긋났다**.
 * 실측(md): DOM 버튼 **20** vs Skia SelectIcon **18** → 2px 비대칭 + 그만큼 DateInput 폭도
 * 밀림(310 vs 308).
 *
 * Select 는 처음부터 `.select-chevron` 을 **px 아이콘 스케일**(14/16/18/22/28)로 지정해
 * 정합이었다 — DatePicker/DateRangePicker 만 예외였다. 세 곳을 같은 스케일로 통일.
 *
 * **불변식**:
 *  1. dp-btn / drp-btn / select-chevron 의 size 별 값이 **동일**하다.
 *  2. 그 값이 `SelectIcon.sizes[*].iconSize`(Skia 소비) 와 md/lg/xl 에서 일치한다.
 *  3. 어느 것도 `var(--text-*)` (typography 토큰) 을 크기로 쓰지 않는다.
 */

/**
 * delegation 블록에서 prefix 로 찾아 `size → CSS 변수 값` 맵 추출.
 *
 * `cssVar` 를 명시로 받는다 — 트리거 아이콘 크기를 담는 변수명이 컴포넌트마다 다르다
 * (DatePicker: `--dp-btn-width`/`-height` 2축 / Select: `--select-chevron-size` 1개).
 */
function delegationSizes(
  type: string,
  prefix: string,
  cssVar: string,
): Record<string, string> {
  const rule = COMPONENT_RULES_TABLE[type] as
    | {
        structure?: {
          composition?: { delegation?: Array<Record<string, unknown>> };
        };
      }
    | undefined;
  const entry = rule?.structure?.composition?.delegation?.find(
    (d) => d.prefix === prefix,
  );
  const variables = (entry?.variables ?? {}) as Record<
    string,
    Record<string, string>
  >;
  const out: Record<string, string> = {};
  for (const [size, vars] of Object.entries(variables)) {
    const v = vars[cssVar];
    if (v !== undefined) out[size] = v;
  }
  return out;
}

/** 트리거 아이콘 스케일 정본 (Select `.select-chevron` = SelectIcon.iconSize 계열) */
const ICON_SCALE: Record<string, string> = {
  xs: "14px",
  sm: "16px",
  md: "18px",
  lg: "22px",
  xl: "28px",
};

describe("트리거 아이콘 크기 — 아이콘 스케일 단일 SSOT", () => {
  // 아이콘 크기를 담는 CSS 변수명은 컴포넌트마다 다르다 (2축 vs 단일 size 변수).
  const targets = [
    {
      type: "DatePicker",
      prefix: "dp-btn",
      vars: ["--dp-btn-width", "--dp-btn-height"],
    },
    {
      type: "DateRangePicker",
      prefix: "drp-btn",
      vars: ["--drp-btn-width", "--drp-btn-height"],
    },
    {
      type: "Select",
      prefix: "select-chevron",
      vars: ["--select-chevron-size"],
    },
  ] as const;

  it.each(targets)(
    "$type($prefix) 의 아이콘 크기가 아이콘 스케일(14/16/18/22/28)과 일치",
    ({ type, prefix, vars }) => {
      for (const cssVar of vars) {
        expect(delegationSizes(type, prefix, cssVar)).toEqual(ICON_SCALE);
      }
    },
  );

  it("typography 토큰(var(--text-*))을 아이콘 박스 크기로 쓰지 않는다", () => {
    const violations: string[] = [];
    for (const { type, prefix, vars } of targets) {
      for (const cssVar of vars) {
        for (const [size, value] of Object.entries(
          delegationSizes(type, prefix, cssVar),
        )) {
          if (value.includes("--text-")) {
            violations.push(`${type}.${cssVar}.${size} = ${value}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  /**
   * 2026-07-14 후속: 최초 수정은 md/lg/xl 만 맞췄고 xs/sm 은 어긋난 채 남겼다
   * (DOM 14/16 vs catalog iconSize 10/14). catalog `iconSize` 는 **Skia 전용**이다 —
   * `--icon-size` CSS 변수는 Disclosure 만 소비하므로 Select/Date 계열의 `iconSize`
   * 변경은 DOM 에 영향이 없다(폭발 반경 확인 완료). 따라서 catalog 를 DOM 아이콘
   * 스케일(14/16)로 수렴시켜 **5개 size 전부** 한 숫자를 공유하게 한다.
   *
   * 대상 4종은 모두 같은 SelectIcon 자식을 그린다:
   *  - `SelectIcon.iconSize`   → Skia glyph 크기 (icon_font primitive)
   *  - `SelectTrigger.iconSize` → Skia SelectIcon **레이아웃 박스** (implicitStyles)
   *  - `Select` / `ComboBox`   → 같은 트리거 계열 (동일 스케일 유지)
   */
  const ICON_SCALE_NUM: Record<string, number> = {
    xs: 14,
    sm: 16,
    md: 18,
    lg: 22,
    xl: 28,
  };

  it.each(["SelectIcon", "SelectTrigger", "Select", "ComboBox"])(
    "%s.sizes[*].iconSize 가 아이콘 스케일과 5개 size 전부 일치 (DOM↔Skia 대칭)",
    (type) => {
      const sizes = (COMPONENT_RULES_TABLE[type]?.sizes ?? {}) as Record<
        string,
        { iconSize?: number }
      >;
      const actual: Record<string, number | undefined> = {};
      for (const size of Object.keys(ICON_SCALE_NUM)) {
        actual[size] = sizes[size]?.iconSize;
      }
      expect(actual).toEqual(ICON_SCALE_NUM);
    },
  );

  it("SelectIcon 은 height === iconSize (glyph 자체가 박스 — 넘침 차단)", () => {
    const sizes = (COMPONENT_RULES_TABLE.SelectIcon?.sizes ?? {}) as Record<
      string,
      { iconSize?: number; height?: number }
    >;
    for (const size of Object.keys(ICON_SCALE_NUM)) {
      expect(sizes[size]?.height, `SelectIcon.${size}.height`).toBe(
        sizes[size]?.iconSize,
      );
    }
  });
});
