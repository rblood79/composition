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

  it("Skia 소비값 SelectIcon.iconSize 와 md/lg/xl 일치 (DOM↔Skia 대칭)", () => {
    const sizes = (COMPONENT_RULES_TABLE.SelectIcon?.sizes ?? {}) as Record<
      string,
      { iconSize?: number }
    >;
    for (const size of ["md", "lg", "xl"] as const) {
      expect(`${sizes[size]?.iconSize}px`).toBe(ICON_SCALE[size]);
    }
  });
});
