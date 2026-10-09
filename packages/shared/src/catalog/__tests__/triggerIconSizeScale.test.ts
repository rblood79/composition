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
 *  2. 그 값이 Select · ComboBox 의 `sizes[*].iconSize` 와 일치한다 (옛 `SelectIcon` type 은
 *     2026-10-09 삭제 — 어떤 원본도 쓰지 않았다).
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
  XS: "14px",
  S: "16px",
  M: "18px",
  L: "22px",
  XL: "28px",
};

describe("트리거 아이콘 크기 — 아이콘 스케일 단일 SSOT", () => {
  // ADR-253: field 안 버튼은 FieldButton 원본의 instance 다 (ComboBox · DatePicker · DateRangePicker). glyph
  //   는 그 안의 Icon 노드이고 크기는 Button rule 의 glyph 단계다 — 부모 rule 에는 버튼 **상자** 크기만
  //   남는다. 세 부모가 같은 상자 단계를 쓴다 (control 안쪽 정사각형).
  const FIELD_BUTTON_BOX: Record<string, string> = {
    XS: "16px",
    S: "18px",
    M: "22px",
    L: "34px",
    XL: "46px",
  };
  const targets = [
    { type: "ComboBox", prefix: "combo-btn", vars: ["--combo-btn-size"] },
    { type: "DatePicker", prefix: "dp-btn", vars: ["--dp-btn-size"] },
    { type: "DateRangePicker", prefix: "drp-btn", vars: ["--drp-btn-size"] },
  ] as const;

  it.each(targets)(
    "$type($prefix) 의 FieldButton 상자 크기가 세 부모에서 같다 (16/18/22/34/46)",
    ({ type, prefix, vars }) => {
      for (const cssVar of vars) {
        expect(delegationSizes(type, prefix, cssVar)).toEqual(FIELD_BUTTON_BOX);
      }
    },
  );

  it("typography 토큰(var(--text-*))을 버튼 상자 크기로 쓰지 않는다", () => {
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
   * 대상: `Select` / `ComboBox` — 같은 트리거 계열 (동일 스케일 유지).
   */
  const ICON_SCALE_NUM: Record<string, number> = {
    XS: 14,
    S: 16,
    M: 18,
    L: 22,
    XL: 28,
  };

  it.each(["Select", "ComboBox"])(
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

});
