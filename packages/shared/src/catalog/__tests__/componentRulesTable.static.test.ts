/**
 * ADR-295 G3 — rule 치수 리터럴 분류 (breakdown Phase 3 · 3b · 3c-3b ③).
 *
 * D3 값의 정본은 S2 설치본이고 rule 은 토큰 이름 (`{radius.*}` · `{typography.*}` · `{size.height.*}` ·
 * `{size.icon.*}`) 이나 값의 형 (`ofHeight` · `em` · `centerPadding` · `scaled` — `{length.…}`) 으로 참조한다. 아래 키의
 * px 숫자는 셋 중 하나다:
 * - 스스로 분류되는 값 — height 0 (내용 높이), padding · gap 이 S2 spacing 단 위 (`S2_SPACING_SCALE` — S2 가
 *   `padding: 12` 로 쓰는 고정 값), paddingY 가 control 의 centerPadding (`s2ControlPaddingY` — 생성기가 식과 대조);
 * - `INTENTIONAL_LITERAL` — 사유와 함께 둔 값 (S2 대응 없음 · S2 값 그대로인 상자);
 * - `S2_PENDING_LITERAL` — S2 와 다르거나 아직 대조하지 않은 값 (S2 쪽 값 · 출처와 함께 — 값 대조 대기).
 * 등재 없는 리터럴 · 값이 바뀐 리터럴 · 쓰이지 않는 등재 모두 FAIL — 두 목록은 줄기만 한다.
 */
import { describe, expect, it } from "vitest";
import {
  ruleSizeLengthRef,
  s2ControlPaddingY,
  S2_SPACING_SCALE,
} from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

const STRICT_KEYS = [
  "fontSize",
  "borderRadius",
  "lineHeight",
  "minHeight",
  "iconSize",
  "minWidth",
  "height",
  "paddingX",
  "paddingY",
  "gap",
  "iconGap",
] as const;

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

const sizes = (
  component: string,
  key: IntentionalLiteral["key"],
  values: Readonly<Record<string, number>>,
  reason: string,
): IntentionalLiteral => ({ component, key, values, reason });

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
    "Badge",
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
  sizes(
    "Keyboard",
    "height",
    { M: 18 },
    "S2 Menu keyboard 글자 `ui` 의 행간 18 (`Menu.tsx` — 높이 지정 없이 한 줄)",
  ),
  ...(["MeterValue", "ProgressBarValue", "SliderOutput"] as const).map(
    (component) =>
      sizes(
        component,
        "height",
        { S: 16, M: 18, L: 20, XL: 22 },
        "S2 값 글자 한 줄 = controlFont 행간 16 · 18 · 20 · 22 (`fieldLabel()` · Slider output — 높이 지정 없음)",
      ),
  ),
  sizes(
    "Icon",
    "height",
    { XS: 14, S: 16, M: 18, L: 20, XL: 22 },
    "S2 iconStyle XS 14 · S 16 · M 18 · L 20 · XL 22 (`style/index.ts`) = `{size.icon.<S>}` — catalog Icon 은 글리프 크기 (iconSize) 로 그려 이 높이는 catalog 밖 Icon 의 생성 CSS 만",
  ),
  sizes(
    "SelectValue",
    "height",
    { XS: 14, S: 16, M: 18, L: 20, XL: 22 },
    "S2 Picker 값 글자 한 줄 = controlFont 행간 (`Picker.tsx` — 높이는 버튼 100%) · 읽는 곳 없음 (manual omit)",
  ),
  sizes(
    "Table",
    "height",
    { S: 32, M: 40, L: 48 },
    "S2 TableView 행 compact 32 · regular 40 · spacious 48 (`TableView.tsx` rowHeight) · 읽는 곳 없음 (top-level containerStyles — 칸 여백은 Column · Cell densities)",
  ),
  sizes(
    "TagGroup",
    "height",
    { S: 24, M: 32, L: 40 },
    "S2 Tag 높이 = control 높이 S 24 · M 32 · L 40 (`TagGroup.tsx`) 그대로 · 읽는 곳 없음 (top-level containerStyles)",
  ),
  ...(["Tree", "TreeItem"] as const).map((component) =>
    sizes(
      component,
      "height",
      { S: 40, M: 40, L: 40 },
      "S2 TreeView 행 40 (`TreeView.tsx` — size 축 없음, 모든 크기에) · 이 칸은 읽는 곳 없음 (행 높이 출처는 manualBoxRules TreeItem · Tree.css)",
    ),
  ),
  sizes(
    "TreeItem",
    "gap",
    { "variants.default.leadingIcon": 6 },
    "S2 TreeView 아이콘 `marginEnd: text-to-visual` = 6 (ui 14) — 옛 항목 (TreeItemContent 없음) 의 Skia 글자 밀기만",
  ),
  sizes(
    "CalendarHeader",
    "height",
    { M: 32 },
    "S2 Calendar 머리 = 이전 · 다음 quiet ActionButton M 32 (`Calendar.tsx`) · 읽는 곳 없음 (manual replace)",
  ),
  sizes(
    "Toolbar",
    "gap",
    { L: 10 },
    "S2 Toolbar 는 RAC 를 감싸기만 하고 스타일이 없다 (`Toolbar.tsx`) — composition 묶음 간격",
  ),
  sizes(
    "Breadcrumb",
    "height",
    { S: 24, M: 32, L: 40 },
    "S2 Breadcrumbs 항목 `height: controlSize()` (`Breadcrumbs.tsx` — S 는 control S) · 옛 Skia `breadcrumb_crumb` 조각만 읽는다 (상자는 Breadcrumbs 의 최소 높이 토큰)",
  ),
  sizes(
    "Header",
    "paddingX",
    { S: 9, L: 15 },
    "S2 Menu sectionHeader 좌우 `edgeToText` 9 · 12 · 15 (rem — 터치에서 그대로, M 12 는 spacing 단)",
  ),
  sizes(
    "StatusLight",
    "height",
    { S: 16, M: 18, L: 20, XL: 22 },
    "S2 StatusLight 행 = controlFont 한 줄 행간 (`StatusLight.tsx` — 높이 지정 없음) · 터치 × 1.25 는 다루지 않음",
  ),
  ...(["Column", "Cell"] as const).map((component) =>
    sizes(
      component,
      "paddingY",
      {
        M: 11,
        "densities.compact": 7,
        "densities.regular": 11,
        "densities.spacious": 15,
      },
      "S2 TableView 행 compact 32 · regular 40 · spacious 48 (`TableView.tsx` — 칸은 minHeight + 가운데) = 칸 행간 18 (S2 cell controlFont 14) + 2 × 여백",
    ),
  ),
  sizes(
    "Avatar",
    "height",
    { XS: 24, S: 28, M: 32, L: 40, XL: 48 },
    "S2 Avatar 는 `size` 가 숫자 px (기본 24) — composition XS~XL 은 그 숫자를 고른다",
  ),
  sizes(
    "Code",
    "height",
    { XS: 18, S: 22, M: 26, L: 32 },
    "S2 대응 없음 — composition 코드 글자 상자",
  ),
  sizes(
    "Code",
    "paddingX",
    { S: 6, L: 10 },
    "S2 대응 없음 — composition 코드 글자 상자",
  ),
  sizes("Field", "height", { M: 32 }, "S2 대응 없음 — composition 묶음 상자"),
  sizes(
    "FileTrigger",
    "gap",
    { S: 6, L: 10 },
    "S2 에 FileTrigger 스타일 없음 (RAC 전용) — composition 버튼 묶음",
  ),
  sizes(
    "FileTrigger",
    "iconGap",
    { S: 6, L: 10 },
    "S2 에 FileTrigger 스타일 없음 (RAC 전용) — composition 버튼 묶음",
  ),
  sizes(
    "Image",
    "height",
    { S: 120, M: 200, L: 320 },
    "S2 Image 는 size 축이 없다 — composition size 의 자리 높이",
  ),
  sizes(
    "Kbd",
    "height",
    { XS: 18, S: 22, M: 26, L: 32 },
    "S2 대응 없음 — composition 키 글자 상자",
  ),
  sizes(
    "Kbd",
    "paddingX",
    { S: 6, L: 10 },
    "S2 대응 없음 — composition 키 글자 상자",
  ),
  sizes(
    "Nav",
    "height",
    { S: 48, M: 56, L: 64 },
    "S2 대응 없음 — composition 탐색 막대",
  ),
  sizes(
    "Separator",
    "height",
    { S: 1, M: 2, L: 4 },
    "S2 Divider 두께 S 1 · M 2 · L 4 (`Divider.tsx`) 그대로",
  ),
  sizes(
    "Skeleton",
    "height",
    { S: 16, M: 20, L: 24 },
    "S2 Skeleton 은 감싸는 모양이라 size 가 없다 — composition 단독 자리 높이",
  ),
  sizes(
    "Chart",
    "height",
    { S: 160, M: 240, L: 320 },
    "S2 대응 없음 — composition 차트 (장면 계산 입력 px)",
  ),
];

/**
 * S2 와 다르거나 아직 대조하지 않은 리터럴 — `s2` 는 S2 쪽 값과 출처 (「대조 전」 = 설치본을 아직 읽지 않음).
 * 값 대조 (Phase 4 전 후속) 가 rule 을 S2 형 · 토큰으로 바꾸며 이 목록을 지운다. 새 항목 추가 금지.
 */
interface PendingLiteral extends IntentionalLiteral {
  readonly s2: string;
}

// (3c-3c ③ 에서 비었다 — 45 자리 모두 S2 값 · 형으로 옮겼다.)
export const S2_PENDING_LITERAL: readonly PendingLiteral[] = [];

interface Literal {
  component: string;
  key: string;
  place: string;
  value: number;
}

/**
 * rule 의 치수 숫자 — 값의 형 (`ofHeight` · `em` · `centerPadding` — size 블록의 getter, `ruleSizeLengthRef`) 은
 * 숫자로 읽혀도 리터럴이 아니다.
 */
function literals(): Literal[] {
  const out: Literal[] = [];
  const walk = (node: unknown, component: string, path: string[]) => {
    if (!node || typeof node !== "object") return;
    const inSizes = path[0] === "sizes" && path.length === 2;
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "number") {
        if (inSizes && ruleSizeLengthRef(node, key)) continue;
        // (`sizes.<S>.key` → place `<S>`; anything else keeps its path.)
        const place = inSizes ? path[1]! : path.join(".");
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

const SPACING_KEYS = new Set(["paddingX", "paddingY", "gap", "iconGap"]);

/** 스스로 분류되는 리터럴 — 내용 높이 · S2 spacing 단 · control centerPadding. */
function selfClassified(literal: Literal): boolean {
  if (literal.key === "height" && literal.value === 0) return true;
  if (SPACING_KEYS.has(literal.key) && S2_SPACING_SCALE.includes(literal.value))
    return true;
  if (literal.key !== "paddingY") return false;
  const block = (
    COMPONENT_RULES_TABLE as unknown as Record<
      string,
      { sizes?: Record<string, Record<string, unknown>> }
    >
  )[literal.component]?.sizes?.[literal.place];
  return block !== undefined && s2ControlPaddingY(block) === literal.value;
}

const LISTED = [...INTENTIONAL_LITERAL, ...S2_PENDING_LITERAL];

describe("ADR-295 G3 — rule 치수 리터럴", () => {
  const all = literals();

  it.each(STRICT_KEYS)(
    "%s: px 리터럴은 스스로 분류되거나 두 목록의 값 그대로다 (등재 없음 · 값 drift 0)",
    (key) => {
      const unlisted = all
        .filter((literal) => literal.key === key && !selfClassified(literal))
        .filter(
          (literal) =>
            LISTED.find(
              (entry) =>
                entry.component === literal.component && entry.key === key,
            )?.values[literal.place] !== literal.value,
        )
        .map((l) => `${l.component}.${l.place}.${key} = ${l.value}`);
      expect(unlisted).toEqual([]);
    },
  );

  it("두 목록의 모든 값이 rule 에 그대로 있다 (낡은 등재 0) · 한 자리는 한 목록에만", () => {
    const stale: string[] = [];
    const seen = new Set<string>();
    for (const entry of LISTED) {
      expect(entry.reason.length).toBeGreaterThan(10);
      const id = `${entry.component}.${entry.key}`;
      expect([id, seen.has(id)]).toEqual([id, false]);
      seen.add(id);
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

  it("S2 값 대조 대기는 줄기만 한다 (3c-3b ③ 45 → 3c-3c ① 32 → ②a 16 → ②b-1 11 → ②b-2 6 → ②c Tab 5 → Slider 3 → ③ MenuItem 0)", () => {
    expect(S2_PENDING_LITERAL.length).toBeLessThanOrEqual(0);
  });
});
