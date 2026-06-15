/**
 * ADR-048: Propagation Registry
 *
 * Spec의 propagation 규칙을 정방향/역방향 인덱스로 관리한다.
 * lazy 초기화 — 첫 호출 시 1회만 빌드.
 * 모든 키는 소문자로 정규화.
 */
import type { ComponentSpec, PropagationRule, Shape } from "@composition/specs";
import {
  // Phase 1: DatePicker
  DatePickerSpec,
  DateRangePickerSpec,
  // Phase 2: 기존 delegation 컴포넌트
  SelectSpec,
  ComboBoxSpec,
  SearchFieldSpec,
  CheckboxGroupSpec,
  RadioGroupSpec,
  TagGroupSpec,
  CheckboxSpec,
  RadioSpec,
  SwitchSpec,
  TextFieldSpec,
  TextAreaSpec,
  NumberFieldSpec,
  DateFieldSpec,
  TimeFieldSpec,
  ColorFieldSpec,
  SliderSpec,
  ProgressBarSpec,
  MeterSpec,
  CalendarSpec,
  RangeCalendarSpec,
  GridListSpec,
  ListBoxSpec,
  ToggleButtonGroupSpec,
  TabsSpec,
} from "@composition/specs";

// ─── Collection Item propagation-only specs ─────────────────────────────────
// 독립 Spec 파일이 없는 컴포넌트의 label/description → 자식 전파 전용

const noopShapes = (): Shape[] => [];

function createCollectionItemPropagationSpec(
  name: string,
): ComponentSpec<Record<string, unknown>> {
  return {
    name,
    element: "div",
    propagation: {
      rules: [
        {
          parentProp: "label",
          childPath: "Text",
          childProp: "children",
          override: true,
        },
        {
          parentProp: "description",
          childPath: "Description",
          childProp: "children",
          override: true,
        },
      ],
    },
    defaultVariant: "default",
    defaultSize: "md",
    variants: {},
    sizes: {},
    states: {},
    render: { shapes: noopShapes },
  };
}

/**
 * ADR-912 childSpec→catalog cutover (2026-06-15): CardHeader/CardContent spec 삭제 대비.
 *   CardHeader.spec / CardContent.spec 의 propagation 규칙(자식 style 주입, ADR-095)을 spec 파일에서
 *   분리하여 propagation-only spec 으로 인라인 보존 — `createCollectionItemPropagationSpec` 동형
 *   (독립 spec 파일 없는 컴포넌트의 propagation 전용). CardHeader → Heading flex:1,
 *   CardContent → Description width:100%. Card.spec.childSpecs 제거 후 catalog cutover 로 시각은
 *   rule + factory props.style 이 담당하고, 이 propagation 만 builder runtime 에서 유지.
 */
function createPropagationOnlySpec(
  name: string,
  rules: PropagationRule[],
): ComponentSpec<Record<string, unknown>> {
  return {
    name,
    element: "div",
    propagation: { rules },
    defaultVariant: "default",
    defaultSize: "md",
    variants: {},
    sizes: {},
    states: {},
    render: { shapes: noopShapes },
  };
}

// ADR-912 R6 (2026-06-15): Card 본체 catalog cutover → Card.spec 삭제. 구 Card.spec.propagation
//   .rules 5건(ADR-092 HC#7 title/description + HC#4 size×3)을 propagation-only 인라인 spec 으로
//   보존 — catalog 는 propagation 표현 수단 없음(ComponentRule/PrimitiveBinding 에 parentProp 필드
//   부재). title → CardHeader.Heading.children / description → CardContent.Description.children
//   (중첩 childPath) / size → CardHeader·CardContent·CardFooter. CardHeader/CardContent
//   propagation-only spec(자식 style 주입)과 동형 — 본체는 content/size 전파 담당.
const cardPropagationSpec = createPropagationOnlySpec("Card", [
  {
    parentProp: "title",
    childPath: ["CardHeader", "Heading"],
    childProp: "children",
    override: true,
  },
  {
    parentProp: "description",
    childPath: ["CardContent", "Description"],
    childProp: "children",
    override: true,
  },
  { parentProp: "size", childPath: "CardHeader", override: true },
  { parentProp: "size", childPath: "CardContent", override: true },
  { parentProp: "size", childPath: "CardFooter", override: true },
]);

const cardHeaderPropagationSpec = createPropagationOnlySpec("CardHeader", [
  {
    childPath: "Heading",
    childProp: "flex",
    asStyle: true,
    styleValue: 1,
    skipIfSet: ["flex", "flexGrow", "width"],
  },
]);

const cardContentPropagationSpec = createPropagationOnlySpec("CardContent", [
  {
    childPath: "Description",
    childProp: "width",
    asStyle: true,
    styleValue: "100%",
    skipIfSet: ["width", "flex"],
  },
]);

// ─── Lazy Index ─────────────────────────────────────────────────────────────

/** 정방향: parentTag(소문자) → PropagationRule[] */
let forwardIndex: Map<string, PropagationRule[]> | null = null;

/** 역방향: childTag(소문자) → Set<parentTag(소문자)> — 직접 자식 규칙만 */
let reverseIndex: Map<string, Set<string>> | null = null;

/** 등록된 모든 spec (registerPropagationSpec으로 추가) */
const specEntries: Array<[string, ComponentSpec<Record<string, unknown>>]> = [];

// ─── Registration ───────────────────────────────────────────────────────────

/**
 * Propagation 규칙이 있는 Spec을 등록한다.
 * 앱 초기화 시 또는 Spec 정의 시점에 호출.
 * 등록 후 인덱스가 이미 빌드된 상태면 재빌드를 예약한다.
 */
export function registerPropagationSpec<P = Record<string, unknown>>(
  type: string,
  spec: ComponentSpec<P>,
): void {
  if (!spec.propagation) return;
  specEntries.push([type, spec as ComponentSpec<Record<string, unknown>>]);
  // 이미 빌드된 인덱스가 있으면 무효화하여 다음 조회 시 재빌드
  if (forwardIndex) {
    forwardIndex = null;
    reverseIndex = null;
  }
}

// ─── Index Build ────────────────────────────────────────────────────────────

function ensureBuilt(): void {
  if (forwardIndex) return;

  forwardIndex = new Map();
  reverseIndex = new Map();

  for (const [type, spec] of specEntries) {
    if (!spec.propagation) continue;
    const key = type.toLowerCase();
    forwardIndex.set(key, spec.propagation.rules);

    for (const rule of spec.propagation.rules) {
      // 역방향 인덱스: childPath가 단일 문자열인 규칙만 포함
      // 중첩 경로(배열)는 Inspector의 buildPropagationUpdates에서만 해석
      if (typeof rule.childPath === "string") {
        const childKey = rule.childPath.toLowerCase();
        let parents = reverseIndex.get(childKey);
        if (!parents) {
          parents = new Set();
          reverseIndex.set(childKey, parents);
        }
        parents.add(key);
      }
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** 정방향: parentTag → PropagationRule[] */
export function getPropagationRules(
  parentTag: string,
): PropagationRule[] | undefined {
  ensureBuilt();
  return forwardIndex!.get(parentTag.toLowerCase());
}

/** 역방향: childTag → Set<parentTag> (ElementSprite 역탐색용) */
export function getParentTagsForChild(
  childTag: string,
): Set<string> | undefined {
  ensureBuilt();
  return reverseIndex!.get(childTag.toLowerCase());
}

/** 테스트용: 인덱스 초기화 */
export function _resetPropagationRegistry(): void {
  forwardIndex = null;
  reverseIndex = null;
  specEntries.length = 0;
}

// ─── Auto-register specs with propagation rules ────────────────────────────
registerPropagationSpec("DatePicker", DatePickerSpec);
registerPropagationSpec("DateRangePicker", DateRangePickerSpec);
registerPropagationSpec("Select", SelectSpec);
registerPropagationSpec("ComboBox", ComboBoxSpec);
registerPropagationSpec("SearchField", SearchFieldSpec);
registerPropagationSpec("CheckboxGroup", CheckboxGroupSpec);
registerPropagationSpec("RadioGroup", RadioGroupSpec);
registerPropagationSpec("TagGroup", TagGroupSpec);
registerPropagationSpec("Checkbox", CheckboxSpec);
registerPropagationSpec("Radio", RadioSpec);
registerPropagationSpec("Switch", SwitchSpec);
registerPropagationSpec("TextField", TextFieldSpec);
registerPropagationSpec("TextArea", TextAreaSpec);
registerPropagationSpec("NumberField", NumberFieldSpec);
registerPropagationSpec("DateField", DateFieldSpec);
registerPropagationSpec("TimeField", TimeFieldSpec);
registerPropagationSpec("ColorField", ColorFieldSpec);
registerPropagationSpec("Slider", SliderSpec);
registerPropagationSpec("ProgressBar", ProgressBarSpec);
registerPropagationSpec("Meter", MeterSpec);
registerPropagationSpec("Calendar", CalendarSpec);
registerPropagationSpec("RangeCalendar", RangeCalendarSpec);
// ADR-912 R6 (2026-06-15): Card 본체 spec 삭제 → propagation-only 인라인 spec(cardPropagationSpec).
registerPropagationSpec("Card", cardPropagationSpec);
// ADR-095: CardHeader → Heading flex:1 / CardContent → Description width:100% 주입 rule.
//   ADR-912 (2026-06-15): CardHeader/CardContent spec 삭제 → propagation-only 인라인 spec 으로 보존.
registerPropagationSpec("CardHeader", cardHeaderPropagationSpec);
registerPropagationSpec("CardContent", cardContentPropagationSpec);
registerPropagationSpec("GridList", GridListSpec);
registerPropagationSpec("ListBox", ListBoxSpec);
registerPropagationSpec("ToggleButtonGroup", ToggleButtonGroupSpec);
// ADR-912 영역 B (A): Tabs → TabList items/selectedKey/variant/size/showIndicator 전파.
//   chip projection(appendTabRowProjection)이 TabList.props.items 를 읽는 invariant 충족.
registerPropagationSpec("Tabs", TabsSpec);
// Collection Item → 자식 Text/Description 전파
registerPropagationSpec(
  "GridListItem",
  createCollectionItemPropagationSpec("GridListItem"),
);
registerPropagationSpec(
  "ListBoxItem",
  createCollectionItemPropagationSpec("ListBoxItem"),
);
