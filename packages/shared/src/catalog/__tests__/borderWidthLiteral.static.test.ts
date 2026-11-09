import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * ADR-227 Phase 3 G3 ratchet (2026-09-22): catalog rule 의 border 폭은 테마 토큰 `{border.width.none|thin|thick}`
 * 으로만 참조한다 — 숫자 리터럴 (`borderWidth: 1`) · px 문자열 (`borderWidth: "1px"`) · shorthand 리터럴
 * (`border: "1px solid …"`) 0. Phase 0 inventory (breakdown §8 F7) 47 + 6 + 8 + 2 = 63 곳을 참조화했다.
 *
 * 확정 예외 (테마 축 밖 — 위치·사유):
 *   - `outline: "2px solid var(--accent)"` 17 — focus 축 (ADR-150 · `{focus.ring.*}` 소유).
 *   - `"border-bottom": "1px solid var(--border)"` 10 — Table/ListBox 행·섹션 구분선 (divider 축; Skia 도
 *     같은 리터럴 1 로 그린다 — 폭 토큰과 분리, 후속 판정).
 *   - 생성기 archetype 블록의 Slider thumb `border: 2px solid var(--bg)` — Skia thumb 도 리터럴 2 (대칭).
 *   - ColorThumb 의 고리 `border: 4px solid var(--bg-inset)` (ADR-258 — 사용자 결정 2 「지금 수동 CSS 값
 *     그대로」): 테마 테두리 축이 아니라 손잡이 고리다 (Slider thumb 와 같은 축). Canvas 도 같은 선언을 읽는다
 *     (`catalogColorThumbRing` → `color_thumb`).
 */
const HANDLE_RINGS: ReadonlySet<string> = new Set([
  "4px solid var(--bg-inset)",
]);
const TABLE_PATH = resolve(__dirname, "../generated/componentRulesTable.ts");

/**
 * 숫자 `borderWidth` 확정 예외 — `<type>.sizes.<size>` → 값 · 사유. 등재 밖 숫자는 그대로 걸리고, 사라진
 * 항목도 걸린다 (목록 = ratchet). `0` 은 S2 가 테두리를 쓰지 않는 자리 (테마 폭 축 밖 — 「없음」 은 테마가
 * 바꿀 값이 아니다), `1` · `2` 는 테마 축을 따라야 할 값이라 `{border.width.thin|thick}` 참조화 후보다
 * (production 후속 — 이 목록에서 빼면 된다).
 */
const LITERAL_BORDER_WIDTHS: Readonly<
  Record<string, { value: number; reason: string }>
> = {
  ...Object.fromEntries(
    ["ActionButton", "ToggleButton"].flatMap((type) =>
      ["XS", "S", "M", "L", "XL"].map((size) => [
        `${type}.sizes.${size}`,
        {
          value: 0,
          reason:
            "S2 1.8.2 ActionButton · ToggleButton 은 border:none — 종전 1px 은 paddingY 에 흡수 (`ACTION_BUTTON_SIZES`, 3ca03f661)",
        },
      ]),
    ),
  ),
  ...Object.fromEntries(
    ["S", "M", "L"].map((size) => [
      `Popover.sizes.${size}`,
      {
        value: 0,
        reason:
          "S2 Popover 는 테두리 대신 `outline: 1px solid var(--popover-outline)` (containerStyles, 71922bd0f)",
      },
    ]),
  ),
  "SegmentedControlItem.sizes.M": {
    value: 0,
    reason:
      "ActionButton M 크기를 펼친 뒤 테두리만 끔 — S2 SegmentedControl 항목은 테두리 없음 (5745593c4)",
  },
  "TokenInput.sizes.M": {
    value: 1,
    reason:
      "S2 TokenField 입력 상자 1px (bbca53c78) — `{border.width.thin}` 참조화 후보",
  },
  "SelectBox.sizes.M": {
    value: 2,
    reason:
      "S2 SelectBox 2px 테두리 (`rule/selectionComposites.ts`, 8ac17dc12) — `{border.width.thick}` 참조화 후보",
  },
};

/**
 * Every key · value of the table — a rule's state tree (`structure.stateStyles`, ADR-297 Phase 3c) is
 * visited as its property's leaves (`borderBottom` → each branch's value, under the CSS name), the way its
 * `rootSelectors` strings were before.
 */
function walk(value: unknown, visit: (key: string, v: unknown) => void): void {
  if (!value || typeof value !== "object") return;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === "stateStyles" && v && typeof v === "object") {
      for (const [property, tree] of Object.entries(v as object))
        for (const leaf of leaves(tree))
          visit(property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), leaf);
      continue;
    }
    visit(k, v);
    walk(v, visit);
  }
}
function leaves(tree: unknown): unknown[] {
  return tree && typeof tree === "object"
    ? Object.values(tree).flatMap(leaves)
    : [tree];
}

describe("ADR-227 G3 — catalog border 폭 리터럴 0 ratchet", () => {
  it("`borderWidth` 값은 전부 `{border.width.<k>}` 토큰이다 (숫자 · 'Npx' 0 — 확정 예외 목록 밖)", () => {
    const offenders: string[] = [];
    const tokens = new Set<string>();
    const literals: Record<string, unknown> = {};
    for (const [type, rule] of Object.entries(COMPONENT_RULES_TABLE))
      for (const [size, block] of Object.entries(
        (rule as { sizes?: Record<string, { borderWidth?: unknown }> })
          .sizes ?? {},
      ))
        if (typeof block?.borderWidth === "number")
          literals[`${type}.sizes.${size}`] = block.borderWidth;
    walk(COMPONENT_RULES_TABLE, (key, v) => {
      if (key !== "borderWidth") return;
      if (
        typeof v === "string" &&
        /^\{border\.width\.(none|thin|thick|hairline)\}$/.test(v)
      ) {
        tokens.add(v);
        return;
      }
      offenders.push(`${key}: ${JSON.stringify(v)}`);
    });
    // 숫자는 `sizes` 블록의 확정 예외뿐이다 — 그 밖의 숫자 · px 문자열은 offender 로 남는다.
    expect(offenders).toHaveLength(Object.keys(literals).length);
    expect(literals).toEqual(
      Object.fromEntries(
        Object.entries(LITERAL_BORDER_WIDTHS).map(([k, { value }]) => [
          k,
          value,
        ]),
      ),
    );
    expect([...tokens].sort()).toEqual([
      "{border.width.hairline}",
      "{border.width.none}",
      "{border.width.thick}",
      "{border.width.thin}",
    ]);
  });

  it("`border` shorthand 문자열의 폭은 `var(--border-width-*)` — `Npx solid` 0", () => {
    const offenders: string[] = [];
    walk(COMPONENT_RULES_TABLE, (key, v) => {
      if (key !== "border" || typeof v !== "string") return;
      if (HANDLE_RINGS.has(v)) return;
      if (/^\d+(\.\d+)?px\s+solid/.test(v)) offenders.push(v);
    });
    expect(offenders).toEqual([]);
  });

  it('소스 텍스트에도 `borderWidth: <숫자>` · `borderWidth: "Npx"` · `border: "Npx solid` 가 없다 (주석 제외)', () => {
    const src = readFileSync(TABLE_PATH, "utf8")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"));
    const hits = src.filter(
      (line) =>
        /borderWidth:\s*\d/.test(line) ||
        /borderWidth:\s*"\d+px"/.test(line) ||
        (/\bborder:\s*"\d+px\s+solid/.test(line) &&
          ![...HANDLE_RINGS].some((ring) => line.includes(`"${ring}"`))),
    );
    // (확정 예외 중 이 파일에 문자로 적힌 것 — `ACTION_BUTTON_SIZES` 1 · Popover 3 · SegmentedControlItem 1 ·
    //   TokenInput 1. SelectBox 는 `rule/selectionComposites.ts` 라 여기 없다.)
    expect(hits.map((line) => line.trim()).sort()).toEqual([
      "borderWidth: 0,",
      "borderWidth: 0,",
      "borderWidth: 0,",
      "borderWidth: 0,",
      "borderWidth: 0,",
      "borderWidth: 1,",
    ]);
  });

  // ADR-253 (2026-10-06): NumberField · ComboBox (4건씩) · SearchField (2건) 의 wrapper / 버튼 focus 표시
  //   제거 (입력칸 · 버튼이 각자 그린다) → outline 7. Select trigger 의 pressed · focus 표시 (2건) 는 Button
  //   원본의 것 → outline 5. DatePicker 의 Group focus 표시 · picker 2종의 버튼 focus 표시는 DateInput ·
  //   FieldButton 의 것 → outline 3 (남은 것: DateInput rule · DateRangePicker 의 Group …).
  //   quiet 밑줄 (2026-10-07): 8 부모가 반복하던 선언을 Input · DateInput rule 의 `&[data-quiet]` 로 모아
  //   border-bottom 10 → 4 (Input · DateInput · Select 의 trigger · DateRangePicker 의 Group).
  //   DateRangePicker 의 isQuiet 제거 (2026-10-07 — S2 에 없음) → border-bottom 3.
  //   S2 Disclosure (2026-10-10 사용자 결정): 위아래 1px 테두리 (`border-top` · `border-bottom` — Canvas 는
  //   `catalogDisclosureBorders` 가 같은 선언을 읽는다) → border-bottom 4.
  //   S2 1.8.2 정렬 (3ca03f661): Input 의 focus 리터럴 outline 이 focus-ring 변수 (`CONTROL_FOCUS`, isFocusVisible) +
  //   테두리 색 (S2 `field`) 으로 → outline 2,
  //   Input 의 quiet 밑줄 색이 `var(--neutral-outline)` (자기 테두리 토큰) → border-bottom 3.
  //   Select quiet trigger 의 nested 밑줄 삭제 (71922bd0f — S2 Picker quiet 는 `borderWidth.isQuiet: 0`,
  //   Button rule 의 `isPicker.isQuiet` 분기) → border-bottom 2 (남은 것: DateInput · Disclosure).
  //   DateInput · DateRangePicker Group 이 S2 `FieldGroup` (Input 과 같은 테두리 트리 · focus 는 테두리 색) 으로
  //   (2026-11-09) → outline 0 · border-bottom 1 (남은 것: Disclosure).
  it("확정 예외 목록은 고정 — outline 0 · border-bottom 1 (늘면 판정 필요)", () => {
    let outline = 0;
    let borderBottom = 0;
    walk(COMPONENT_RULES_TABLE, (key, v) => {
      if (typeof v !== "string") return;
      if (key === "outline" && /^2px solid var\(--accent-content\)$/.test(v))
        outline += 1;
      if (key === "border-bottom" && /^1px solid var\(--border\)$/.test(v))
        borderBottom += 1;
    });
    expect({ outline, borderBottom }).toEqual({
      outline: 0,
      borderBottom: 1,
    });
  });
});
