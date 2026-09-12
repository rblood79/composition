import {
  Asterisk,
  Axis3d,
  Ban,
  Blend,
  Braces,
  Calculator,
  Calendar,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  Check,
  CircleAlert,
  CircleDashed,
  CircleDot,
  CircleMinus,
  Clock,
  Columns3,
  DollarSign,
  Droplet,
  Equal,
  ExternalLink,
  Eye,
  EyeOff,
  FlipVertical2,
  Focus,
  Globe,
  Grid2x2,
  Grid3x3,
  Hash,
  Heading,
  Hexagon,
  Info,
  Keyboard,
  Layers,
  LayoutList,
  Link,
  List,
  ListOrdered,
  Lock,
  MessageSquare,
  Minus,
  MousePointerClick,
  Move,
  PaintBucket,
  Paintbrush,
  Palette,
  Rainbow,
  PanelBottom,
  Percent,
  Play,
  Radius,
  Regex,
  RotateCw,
  Rows3,
  Scissors,
  Sigma,
  Sparkles,
  SpellCheck,
  Spline,
  SquareCheck,
  SwatchBook,
  Tag,
  Tags,
  Target,
  TextAlignStart,
  TextCursorInput,
  TextQuote,
  Timer,
  ToggleLeft,
  Type,
  Waves,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * Properties 패널 필드 아이콘 정본 — **key → kind 2단 파생**.
 *
 * ## 왜 레지스트리인가 (2026-08-30 실측)
 *
 * Properties 패널의 필드는 컴포넌트별로 **동적 생성**된다: catalog `PropContract`
 * → `InspectorField` → `GenericFieldRenderer` → 위젯. 그래서 아이콘도 호출부에
 * 손으로 다는 값이 아니라 **필드의 정체(key·kind)에서 파생**되어야 한다.
 *
 * 실측 근거:
 * - inspector `PropContract` **722개 / 고유 key 128개**. 세 계층 어디에도 `icon`
 *   축이 없어 `GenericFieldRenderer` 의 위젯 호출 9곳 중 icon 을 넘기는 곳은 0개였다
 *   (같은 화면 대조: Properties 12필드 중 2개만 아이콘 / Styles 9필드 중 7개).
 * - key 는 컴포넌트를 가로질러 공유된다 — **2개+ 컴포넌트가 쓰는 key 73개가
 *   contract 667개(92%)를 덮는다**. `size` ×108, `variant` ×48, `isDisabled` ×48,
 *   `children` ×33 … 상위 40 key 로 82%.
 *
 * 그래서 catalog 계약에 `icon` 을 신설하지 않는다 — binding 119파일에 `isDisabled`
 * 아이콘을 48번 복제하게 되고, SSOT 확장 비용을 치르고 얻는 것이 중복이다. 아이콘은
 * 빌더 chrome 의 표현 축이므로 D2/D3 경계 밖에서 빌더가 소유한다 (섹션 헤더 아이콘
 * 판정과 같은 기준: `.claude/rules/panel-structure.md`).
 *
 * ## 등재 기준
 *
 * `actionIcons.ts` 와 같다 — **2개 이상 컴포넌트에 나오는 key** 만 `PROP_KEY_ICONS` 에
 * 등재한다. 단일 컴포넌트 전용 key 는 kind 기본에 맡긴다. 새 컴포넌트가 catalog 에
 * 추가돼도 kind 기본이 받아 주므로 커버리지는 항상 100% 다.
 *
 * **예외 — 컴포넌트 스코프 표 (`COMPONENT_KEY_ICONS`, 2026-09-11)**: 단일 컴포넌트 전용
 * key 라도 **그 컴포넌트 한 화면의 같은 섹션에 같은 kind 필드가 2개 이상** 서면 kind
 * 기본이 같은 그림을 반복해 열의 정보가 0 이 된다 (panel-structure.md §아이콘 — Chart
 * Appearance 의 boolean 7개가 전부 `ToggleLeft`, enum 10개가 전부 `List`). 이때만
 * 컴포넌트 이름 아래에 key → 아이콘을 둔다. 판정 우선순위: 컴포넌트 표 → 공유 key 표 →
 * kind 기본. 같은 섹션 안에서 두 key 가 같은 그림이면 등재하지 않은 것과 같다
 * (`propertyFieldIcons.static.test.ts` 가 섹션별 중복을 잡는다).
 *
 * `ACTION_ICONS` 가 소유한 심볼(`Trash2`/`Plus`/`Copy`/`RulerDimensionLine` 등)은
 * 여기서 직접 import 하지 않는다 — `actionIcons.static.test.ts` 조항 ①.
 */
export type PropertyFieldIcon = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

/**
 * 아이콘을 **두지 않는** kind — 컨트롤 자체가 이미 그 자리를 쓰는 경우다.
 *
 * - `size`: `PropertySizeToggle` 은 XS~XL 세그먼트가 컨트롤 폭을 다 쓰는 토글 그룹이라
 *   legend 옆에 아이콘 칸을 하나 더 내면 세그먼트가 밀린다.
 * - `icon`: `PropertyIconPicker` 는 **선택된 아이콘 자체**를 트리거 안에 미리보기로
 *   띄운다. 앞에 필드 아이콘을 또 두면 같은 줄에 아이콘이 두 개가 된다.
 *
 * 같은 이유로 색 필드도 아이콘을 두지 않는다 — `PropertyColor` 는 **현재 색 스와치**가
 * 곧 값의 표시라 앞에 도형 아이콘을 또 두면 같은 뜻이 두 번 나온다. 그쪽은 catalog kind
 * 가 아니라 수기 위젯이라 여기 set 이 아니라 `PropertyColor` 가 `icon` prop 자체를 갖지
 * 않는 것으로 집행한다 (Styles 패널 text color / border color, 2026-08-30 사용자 지정).
 *
 * 사용자 지정 (2026-08-30). 이 kind 의 필드는 `resolvePropertyFieldIcon` 이
 * `undefined` 를 돌려주고 위젯은 아이콘 슬롯 자체를 렌더하지 않는다.
 */
export const ICONLESS_FIELD_KINDS: ReadonlySet<string> = new Set([
  "size",
  "icon",
]);

/**
 * kind 기본 — 모든 필드가 최소 한 번은 여기에 걸린다.
 *
 * `InspectorFieldKind` 중 `ICONLESS_FIELD_KINDS` 를 뺀 전체를 덮는다. 계약에 kind 가 추가되면 여기 항목이 없어
 * `undefined` 가 되므로 `propertyFieldIcons.static.test.ts` 가 잡는다.
 */
export const KIND_ICONS: Record<string, PropertyFieldIcon> = {
  boolean: ToggleLeft,
  enum: List,
  string: Type,
  "string-array": ListOrdered,
  number: Hash,
  variant: Palette,
  fillStyle: PaintBucket,
  binding: Link,
  "items-manager": ListOrdered,
};

/**
 * key 재정의 — 2개 이상 컴포넌트가 공유하는 key 73개.
 *
 * kind 가 여러 개인 key(`value` enum/number/string, `minValue`·`maxValue`
 * number/string, `items` binding/items-manager)도 등재한다 — kind 는 갈려도
 * **뜻은 하나**(그 필드의 값 / 하한 / 상한 / 항목 목록)라 아이콘이 흔들리지 않는다.
 */
export const PROP_KEY_ICONS: Record<string, PropertyFieldIcon> = {
  // 텍스트·라벨
  children: Type,
  label: Tag,
  valueLabel: Tag,
  heading: Heading,
  title: Info,
  description: TextQuote,
  errorMessage: CircleAlert,
  placeholder: TextCursorInput,
  name: Braces,
  pattern: Regex,
  autoComplete: Sparkles,
  locale: Globe,
  defaultValue: Equal,
  value: Equal,

  // 상태(boolean)
  isDisabled: Ban,
  isReadOnly: Lock,
  isRequired: Asterisk,
  isInvalid: CircleAlert,
  isSelected: Check,
  isIndeterminate: Minus,
  isQuiet: EyeOff,
  isEmphasized: Sparkles,
  autoFocus: Focus,
  showValueLabel: Eye,
  showCalendarIcon: Calendar,
  shouldCloseOnSelect: MousePointerClick,
  shouldFlip: FlipVertical2,
  hideTimeZone: Globe,
  shouldForceLeadingZeros: Hash,
  isWheelDisabled: Ban,
  allowsNonContiguousRanges: CalendarRange,
  allowsRemoving: CircleMinus,

  // 배치·정렬
  labelPosition: TextAlignStart,
  labelAlign: TextAlignStart,
  necessityIndicator: Asterisk,
  orientation: Rows3,
  placement: Move,
  layout: Grid3x3,
  density: Rows3,

  // 수치
  minValue: Minus,
  maxValue: Hash,
  minLength: Minus,
  maxLength: Hash,
  step: Hash,
  offset: Move,
  crossOffset: Move,
  containerPadding: Move,
  maxVisibleMonths: CalendarDays,

  // 선택
  selectionMode: MousePointerClick,
  selectionStyle: SquareCheck,
  disallowEmptySelection: SquareCheck,

  // 데이터
  dataBinding: Link,
  items: ListOrdered,

  // 날짜·시간
  granularity: Clock,
  hourCycle: Clock,
  pageBehavior: CalendarDays,
  calendarSystem: Calendar,
  placeholderValue: Calendar,

  // 링크
  href: Link,
  target: ExternalLink,

  // 색·모양
  color: Droplet,
  staticColor: Droplet,
  colorSpace: Blend,
  variant: Palette,
  type: Layers,

  // 입력 힌트
  inputMode: Keyboard,
  enterKeyHint: Keyboard,
  autoCorrect: SpellCheck,
  spellCheck: SpellCheck,
  validationBehavior: CircleAlert,
};

/**
 * 컴포넌트 스코프 재정의 — 단일 컴포넌트 전용 key 가 한 섹션에 같은 kind 로 몰리는 곳.
 *
 * Chart (ADR-194/209/210/211): 한 화면에 전용 key 40개. 그림은 레퍼런스 층을 따른다 —
 * 데이터 매핑은 필드 뜻 (범주 `Tag` · 값 `Hash` · 시리즈 `Layers`), Appearance 는 차트
 * 구성 요소 (축 `Axis3d` · 격자 `Grid2x2` · 범례 `LayoutList` · 점 `CircleDot` · 곡선
 * `Spline` · 라벨 `Tags` · 도넛 `CircleDashed` · 합계 `Sigma`), Interaction 은 동작
 * (툴팁 `MessageSquare` · 애니메이션 `Play`/`Timer`/`Clock`/`Waves`). 숨은 key
 * (`editorHidden`) 는 전용 컨트롤이 같은 표를 읽어 `PropertySelect.icon` 으로 단다 —
 * 표의 key 는 전부 catalog 에 실재해야 한다 (정적 가드). 계약 밖 컨트롤 (프리셋 · 시리즈
 * 행) 의 아이콘은 그 컨트롤 파일이 직접 고른다.
 */
export const COMPONENT_KEY_ICONS: Record<
  string,
  Record<string, PropertyFieldIcon>
> = {
  Chart: {
    // content — 정체 · 데이터 매핑
    chartType: ChartColumn,
    dataMode: Columns3,
    dimension: Tag,
    metric: Hash,
    // `color` 는 공유 key (색) 지만 Chart 에서는 시리즈를 가르는 **필드** 다 — 표가 덮는다.
    color: Layers,
    // appearance — 차트 구성 요소
    stackType: Layers,
    curve: Spline,
    showDots: CircleDot,
    showValueLabels: Tags,
    labelKey: Tag,
    colorBy: SwatchBook,
    // ADR-215 — 시리즈 팔레트 (`variant` 의 Palette 와 같은 섹션이라 다른 그림)
    palette: Rainbow,
    innerRadius: CircleDashed,
    gridType: Hexagon,
    startAngle: RotateCw,
    endAngle: Radius,
    showTotal: Sigma,
    showSpokes: Asterisk,
    gridRings: Target,
    fillGrid: PaintBucket,
    fillArea: Paintbrush,
    showAxis: Axis3d,
    showGrid: Grid2x2,
    showLegend: LayoutList,
    legendPosition: PanelBottom,
    valueFormat: Calculator,
    valueLocale: Globe,
    valueFractionDigits: Hash,
    valueCurrency: DollarSign,
    valuePercentUnit: Percent,
    // interaction — 동작 · 표시 예산
    showTooltip: MessageSquare,
    isAnimationActive: Play,
    animationBegin: Timer,
    animationDuration: Clock,
    animationEasing: Waves,
    budgetOverflow: Scissors,
    budgetAggregate: Sigma,
    budgetAxis: Axis3d,
    budgetOthersLabel: Tag,
    // content — ADR-216 시간축
    dimensionScale: CalendarRange,
    dimensionFormat: CalendarDays,
    dimensionLabelFormat: Tag,
    // content — ADR-217 기준선
    referenceLines: Minus,
    referenceValue: Minus,
    referenceLabel: Tag,
    referenceLineType: Minus,
    referenceLayer: Layers,
  },
};

/**
 * 필드 하나의 아이콘을 고른다 — 컴포넌트 표 → 공유 key 재정의 → kind 기본.
 *
 * 전부 없으면 `undefined` 를 돌려주고 위젯은 아이콘 슬롯을 렌더하지 않는다
 * (기존 동작 그대로). kind 는 항상 `KIND_ICONS` 에 있으므로 실제로는 계약에
 * 새 kind 가 추가된 순간에만 일어난다.
 */
export function resolvePropertyFieldIcon(
  key: string,
  kind: string,
  component?: string,
): PropertyFieldIcon | undefined {
  if (ICONLESS_FIELD_KINDS.has(kind)) return undefined;
  return (
    (component ? COMPONENT_KEY_ICONS[component]?.[key] : undefined) ??
    PROP_KEY_ICONS[key] ??
    KIND_ICONS[kind]
  );
}
