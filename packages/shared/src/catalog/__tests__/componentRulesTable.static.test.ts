/**
 * ADR-295 G3 — rule 치수 리터럴 ratchet (breakdown Phase 3 · 3b).
 *
 * D3 값의 정본은 S2 설치본이고 rule 은 토큰 이름 (`{radius.*}` · `{typography.*}` · `{size.height.*}` ·
 * `{size.icon.*}`) 으로 참조한다. 아래 다섯 키의 px 숫자는 `INTENTIONAL_LITERAL` 에 사유와 함께 있어야
 * 한다 — 등재 없는 리터럴 · 값이 바뀐 리터럴 · 쓰이지 않는 등재 모두 FAIL. 나머지 치수 키 (height ·
 * padding · gap …) 는 3c · 3d 가 값의 형을 선언할 때까지 상한만 둔다 (내리기만 — 올리면 FAIL).
 */
import { describe, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

const STRICT_KEYS = [
  "fontSize",
  "borderRadius",
  "lineHeight",
  "minHeight",
  "iconSize",
] as const;

/** 3c · 3d 가 형을 선언할 때까지의 상한 (2026-10-30 Phase 3b 측정값). */
const CEILING: Readonly<Record<string, number>> = {
  height: 389,
  minWidth: 13,
  paddingX: 167,
  paddingY: 111,
  gap: 178,
  iconGap: 8,
};

const CONTROL_RADIUS = { S: 7, M: 8, L: 9, XL: 10 } as const;
const CONTROL_RADIUS_REASON =
  "S2 control 모서리 (`controlBorderRadius` — round(8 × 1.125^size 단계)) — 기기 배율 없음 · d3S2Alignment 가 설치본과 대조";
const UI_ICON_REASON =
  "lucide 글리프로 그리는 S2 ui-icon 자리 (chevron · 지우기 · 구분자) — S2 ui-icon 표 (Chevron S 10 · M 10 · L 12 · XL 14 …) 는 여백 없는 전용 글리프의 상자라 lucide 24 격자 글리프에 옮기지 않는다";

interface IntentionalLiteral {
  readonly component: string;
  readonly key: (typeof STRICT_KEYS)[number];
  /** rule 안 경로 (`sizes` 의 size 이름, 또는 `chart.metrics`) → 값 */
  readonly values: Readonly<Record<string, number>>;
  readonly reason: string;
}

const controlRadius = (component: string): IntentionalLiteral => ({
  component,
  key: "borderRadius",
  values: CONTROL_RADIUS,
  reason: CONTROL_RADIUS_REASON,
});

export const INTENTIONAL_LITERAL: readonly IntentionalLiteral[] = [
  ...[
    "ColorField",
    "ComboBox",
    "DateInput",
    "DatePicker",
    "DateRangePicker",
    "Input",
    "NumberField",
    "Select",
    "TextArea",
    "TextField",
    "ToggleButton",
  ].map(controlRadius),
  {
    component: "Dialog",
    key: "borderRadius",
    values: { XS: 16, S: 16, M: 16, L: 16, XL: 16 },
    reason:
      "S2 xl 16 — 빌더 chrome 이 Dialog 생성 시트를 같이 읽어 `{radius.xl}` 이면 빌더 고정값 12 로 풀린다 (Decision 8 · 9)",
  },
  {
    component: "Breadcrumb",
    key: "iconSize",
    values: { S: 14, M: 16, L: 18 },
    reason: UI_ICON_REASON,
  },
  {
    component: "Disclosure",
    key: "iconSize",
    values: { S: 14, M: 18, L: 20 },
    reason: `${UI_ICON_REASON} · M 18 은 사용자 결정 (2026-09-29)`,
  },
  {
    component: "Tree",
    key: "iconSize",
    values: { S: 14, M: 16, L: 20 },
    reason: UI_ICON_REASON,
  },
  {
    component: "TreeItem",
    key: "iconSize",
    values: { S: 13, M: 16, L: 18 },
    reason: UI_ICON_REASON,
  },
  {
    component: "Tag",
    key: "iconSize",
    values: { XS: 14, S: 14, M: 14, L: 14, XL: 14 },
    reason: UI_ICON_REASON,
  },
  ...["Calendar", "CalendarGrid", "CalendarHeader", "RangeCalendar"].map(
    (component): IntentionalLiteral => ({
      component,
      key: "iconSize",
      values: { M: 26 },
      reason: "달력 칸 폭 (`iconSize + 4`) — 아이콘 상자가 아니다",
    }),
  ),
  {
    component: "ColorField",
    key: "iconSize",
    values: { XS: 18, S: 20, M: 26, L: 32, XL: 36 },
    reason:
      "field 안 swatch 상자 — 아이콘이 아니다 (S2 ColorField 에 swatch 없음 · composition 확장)",
  },
  ...[
    ["ColorSwatchPicker", { S: 20, M: 28, L: 36 }],
    ["ColorArea", { S: 14, M: 18, L: 22 }],
    ["ColorWheel", { S: 14, M: 18, L: 22 }],
  ].map(([component, values]): IntentionalLiteral => ({
    component: component as string,
    key: "iconSize",
    values: values as Record<string, number>,
    reason:
      "Color 조작기의 swatch · thumb 치수 — 아이콘이 아니다 (3c 에서 S2 ColorSwatch · ColorThumb 와 대조)",
  })),
  {
    component: "Illustration",
    key: "iconSize",
    values: { S: 48, M: 96, L: 160 },
    reason:
      "일러스트 상자 — S2 아이콘 단이 아니다 (S2 IllustratedMessage 96 · 96 · 160, 3c 대조)",
  },
  {
    component: "DropZone",
    key: "iconSize",
    values: { S: 24, M: 32, L: 40 },
    reason: "DropZone 일러스트 글리프 — S2 아이콘 단이 아니다 (3c 대조)",
  },
  {
    component: "Toast",
    key: "iconSize",
    values: { S: 16, M: 20, L: 24 },
    reason:
      "S2 Toast 에 size 축이 없다 — composition size 의 아이콘 (3c 에서 S2 대조)",
  },
  {
    component: "ListBoxItem",
    key: "iconSize",
    values: { M: 16 },
    reason:
      "목록 항목 icon slot (`--lb-icon-size` 16) — 수동 ListBox.css 와 같은 값",
  },
  {
    component: "ListBoxItem",
    key: "minHeight",
    values: { M: 32 },
    reason:
      "S2 control 높이 M 과 같은 값 — paddingY 4 가 S2 가운데 식 (6) 과 달라 `{size.height.M}` 은 3c 의 padding 정렬과 함께",
  },
  {
    component: "Slot",
    key: "minHeight",
    values: { S: 40, M: 60, L: 80 },
    reason: "빌더 placeholder (빈 slot 틀) — S2 대응 없음",
  },
  {
    component: "Chart",
    key: "fontSize",
    values: {
      "chart.metrics.S": 10,
      "chart.metrics.M": 11,
      "chart.metrics.L": 12,
    },
    reason:
      "차트 축 글자 — S2 컴포넌트 없음 · 장면 계산 (`computeChartScene`) 입력은 px 숫자",
  },
];

interface Literal {
  component: string;
  key: string;
  place: string;
  value: number;
}

function literals(): Literal[] {
  const out: Literal[] = [];
  const walk = (node: unknown, component: string, path: string[]) => {
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "number") {
        // (`sizes.<S>.key` → place `<S>`; anything else keeps its path.)
        const place =
          path[0] === "sizes" && path.length === 2 ? path[1]! : path.join(".");
        out.push({ component, key, place, value });
      } else walk(value, component, [...path, key]);
    }
  };
  for (const [component, rule] of Object.entries(
    COMPONENT_RULES_TABLE as Record<string, unknown>,
  ))
    walk(rule, component, []);
  return out;
}

describe("ADR-295 G3 — rule 치수 리터럴", () => {
  const all = literals();

  it.each(STRICT_KEYS)(
    "%s: px 리터럴은 INTENTIONAL_LITERAL 의 값 그대로다 (등재 없음 · 값 drift 0)",
    (key) => {
      const unlisted = all
        .filter((literal) => literal.key === key)
        .filter(
          (literal) =>
            INTENTIONAL_LITERAL.find(
              (entry) =>
                entry.component === literal.component && entry.key === key,
            )?.values[literal.place] !== literal.value,
        )
        .map((l) => `${l.component}.${l.place}.${key} = ${l.value}`);
      expect(unlisted).toEqual([]);
    },
  );

  it("INTENTIONAL_LITERAL 의 모든 값이 rule 에 그대로 있다 (낡은 등재 0)", () => {
    const stale: string[] = [];
    for (const entry of INTENTIONAL_LITERAL) {
      expect(entry.reason.length).toBeGreaterThan(10);
      for (const [place, value] of Object.entries(entry.values))
        if (
          !all.some(
            (literal) =>
              literal.component === entry.component &&
              literal.key === entry.key &&
              literal.place === place &&
              literal.value === value,
          )
        )
          stale.push(`${entry.component}.${place}.${entry.key} = ${value}`);
    }
    expect(stale).toEqual([]);
  });

  it.each(Object.entries(CEILING))(
    "%s: 리터럴 수가 상한 (%i) 을 넘지 않는다 — 3c · 3d 가 내린다",
    (key, ceiling) => {
      expect(
        all.filter((literal) => literal.key === key).length,
      ).toBeLessThanOrEqual(ceiling);
    },
  );
});
