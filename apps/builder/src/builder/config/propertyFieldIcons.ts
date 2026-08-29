import {
  Asterisk,
  Ban,
  Blend,
  Braces,
  Calendar,
  CalendarDays,
  CalendarRange,
  Check,
  CircleAlert,
  CircleMinus,
  Clock,
  Columns3,
  Droplet,
  Equal,
  ExternalLink,
  Eye,
  EyeOff,
  FlipVertical2,
  Focus,
  Globe,
  Grid3x3,
  Hash,
  Heading,
  Info,
  Keyboard,
  Layers,
  Link,
  List,
  ListOrdered,
  Lock,
  Minus,
  MousePointerClick,
  Move,
  PaintBucket,
  Palette,
  Regex,
  Rows3,
  Sparkles,
  SpellCheck,
  SquareCheck,
  Tag,
  TextAlignStart,
  TextCursorInput,
  TextQuote,
  ToggleLeft,
  Type,
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
 * `actionIcons.ts` 와 같다 — **2개 이상 컴포넌트에 나오는 key** 만 등재한다. 단일
 * 컴포넌트 전용 key 55개(contract 55개)는 kind 기본에 맡긴다. 새 컴포넌트가 catalog
 * 에 추가돼도 kind 기본이 받아 주므로 커버리지는 항상 100% 다.
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
  columns: Columns3,

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
 * 필드 하나의 아이콘을 고른다 — key 재정의 우선, 없으면 kind 기본.
 *
 * 둘 다 없으면 `undefined` 를 돌려주고 위젯은 아이콘 슬롯을 렌더하지 않는다
 * (기존 동작 그대로). kind 는 항상 `KIND_ICONS` 에 있으므로 실제로는 계약에
 * 새 kind 가 추가된 순간에만 일어난다.
 */
export function resolvePropertyFieldIcon(
  key: string,
  kind: string,
): PropertyFieldIcon | undefined {
  if (ICONLESS_FIELD_KINDS.has(kind)) return undefined;
  return PROP_KEY_ICONS[key] ?? KIND_ICONS[kind];
}
