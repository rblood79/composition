/**
 * 중첩 제약 — 캔버스는 RAC 를 그리는 도구라 아래 세 층을 **상속**한다. 빌더가 규칙을
 * 정하는 게 아니라 아래에 이미 있는 제약을 읽는다 (2026-09-08 사용자 전제, 메모리
 * `feedback-canvas-draws-rac-inherits-html-content-model`).
 *
 * | 층                | 소유자              | 근거                                                                  |
 * | ----------------- | ------------------- | --------------------------------------------------------------------- |
 * | `pen-structure`   | Pen 스키마          | `CanHaveChildren` = frame·group 뿐. composition 의 `toPencilType` 이   |
 * |                   |                     | 나머지를 전부 frame 으로 내므로 실제 leaf 는 `Text`·`Icon` 뿐          |
 * | `rac-composition` | RAC 컴포넌트 계약   | Select ⊃ ListBox ⊃ ListBoxItem · Tabs ⊃ TabList + TabPanel — 합성 부품 |
 * |                   |                     | 은 소유자 밖에서 뜻이 없고, 컬렉션 컨테이너는 자기 item 만 읽는다        |
 * | `html-content`    | HTML 표준·브라우저  | interactive ⊄ button/a · form ⊄ form · 블록 ⊄ p · h1-h6 · label              |
 * |                   |                     | (React DEV `validateDOMNesting` 이 Preview 에서 같은 목록을 경고한다)   |
 *
 * 규칙은 canonical 스키마가 아니라 catalog 층에 둔다 — canonical 은 Pen 형태를 유지하고
 * (Pen 에는 의미 제약이 없다), 여기 표는 손으로 쓰는 컴포넌트별 허용 목록이 아니라 RAC
 * 계약·렌더 결과의 관찰이다 (ADR-142 no-classification 과 충돌하지 않는다).
 *
 * 소비처: canonical 변이 경계 (`canonicalMutations.ts` — fail-closed 백스톱) · 캔버스
 * drop · 붙여넣기 · AI tool (preflight + 가까운 유효 부모로 이동) · pencil export.
 *
 * 한계 (Phase 1): `ref` 노드는 원본 타입을 해석하지 않고 통과시킨다. 원본 해석은
 * 소비처가 `resolveRefType` 로 넘길 수 있다.
 */

import {
  componentContractMap,
  containerTypeSet,
} from "../../domain/componentTraits";

export type NestingLayer = "pen-structure" | "rac-composition" | "html-content";

export interface NestingViolation {
  layer: NestingLayer;
  /** 검사한 부모 타입. 조상 규칙에 걸린 경우 실제로 걸린 조상 타입. */
  parentType: string;
  childType: string;
  /** 사람이 읽는 이유 — 기술 용어는 영어 그대로. 소비처는 아래 구조 필드로 문구를 만든다. */
  reason: string;
  /** 합성 부품이 필요로 하는 소유자 (층 2-b). */
  owners?: readonly string[];
  /** 컬렉션 컨테이너가 읽는 자식 (층 2-a) 또는 self-compose 컨테이너가 인식하는 sub-part. */
  allowedChildren?: readonly string[];
  /** 부모가 자식을 전혀 가질 수 없는 leaf 다 (Pen leaf 또는 DOM void/self-contained). */
  leafParent?: true;
}

export interface NestingCheckInput {
  /** 직계 부모 타입. `null` = document 루트. */
  parentType: string | null;
  childType: string;
  /** 부모부터 루트까지, 가까운 순. `parentType` 을 포함해도 되고 안 해도 된다. */
  ancestorTypes?: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 층 1 — Pen 구조
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pen 스키마에서 `CanHaveChildren` 이 아닌 타입으로 export 되는 canonical 타입.
 * `toPencilType` (`packages/shared/src/types/pencil-adapter.types.ts`) 이 `Text → text`,
 * `Icon → icon_font` 로 내고 나머지는 전부 `frame` 이다.
 */
export const PEN_LEAF_TYPES: ReadonlySet<string> = new Set(["Text", "Icon"]);

// ─────────────────────────────────────────────────────────────────────────────
// 층 2 — RAC 합성
// ─────────────────────────────────────────────────────────────────────────────

// 층 2 의 세 표 (strict 컬렉션 · 직계 자식 · 소유자) 는 타입 특성 표 (`domain/componentTraits.ts`) 의
// `container: "collection"` · `children` · `owners` 열에서 파생한다 (ADR-236 Phase 2). 항목은 RAC 문서의
// 합성 계약 + composition 팩토리가 실제로 만드는 트리로 검증한다
// (`apps/builder/src/builder/factories/__tests__/factoryNestingOracle.test.ts`).

/**
 * 항목 목록 부품 (ADR-256 Decision 4 — RAC collection): 직계 자식으로 항목만 받는다. 레이아웃 래퍼도
 * 못 들어간다 — 설치 RAC 는 항목이 아닌 자식을 버린다 (G0 ② 실행 결과). 표의 `children` 열이 있는 행.
 */
export const STRICT_COLLECTION_PARENT_TYPES: ReadonlySet<string> =
  containerTypeSet("collection");

/** 미전환 family 의 `wrappers` 제한에서 레이아웃 용도로 허용되는 래퍼. */
export const NESTING_PASSTHROUGH_TYPES: ReadonlySet<string> = new Set([
  "frame",
  "group",
  "Group",
  "Slot",
]);

/** 항목 목록 부품 → 받는 항목 type (표의 `children` 열). */
export const RAC_COLLECTION_CHILD_TYPES: Readonly<
  Record<string, readonly string[]>
> = componentContractMap("children");

/**
 * 합성 부품이 뜻을 갖기 위해 조상 어딘가에 있어야 하는 소유자. 직계가 아니어도 된다
 * (Tab 은 TabList 안, TabList 는 Tabs 안 — 두 단계 모두 검사된다).
 */
export const RAC_SUBPART_OWNER_TYPES: Readonly<
  Record<string, readonly string[]>
> = componentContractMap("owners");

export interface UnconvertedFamilyLimit {
  /** 지금 Preview renderer 가 그리는 자식 type. */
  readonly children: readonly string[];
  /** 레이아웃 래퍼 (`NESTING_PASSTHROUGH_TYPES`) 도 받는다 — context 로 조립하는 renderer. */
  readonly wrappers?: true;
}

/**
 * **미전환 family 의 제한** (ADR-256 Decision 4). RAC 는 이 부품들의 자식을 더 넓게 받지만, 지금
 * Preview renderer 가 자식을 노드 순서대로 그리지 않고 정해진 부품만 props 로 넘기거나 고른다
 * (ADR-256 F5 — `catalog/runtime/delegatedDom.tsx`). 여기 없는 자식은 Preview 에서 사라지고 Canvas 만
 * 그리므로 (비대칭) 막는다. 이 행이 있으면 RAC children 종류보다 이 행이 이긴다 — 노드 구조가
 * 아직 RAC 구조와 달라 (TreeItem 의 Text 는 RAC 에선 TreeItemContent 안) 교집합이 성립하지 않는다.
 * family Phase 가 renderer 를 노드 트리 그리기로 바꾸면 그 family 의 행을 지운다 — 끝에 0 행이 되면
 * 표를 삭제한다 (breakdown §2-3).
 */
export const UNCONVERTED_FAMILY_LIMITS: Readonly<
  Record<string, UnconvertedFamilyLimit>
> = {
  // field 가족 7종은 노드 트리로 그린다 (ADR-256 Phase 2 — 행 삭제). control wrapper 는 RAC
  // `Group` 이다 (ADR-256 Phase 6b — 자유 내용, 옛 `SelectTrigger` 행 삭제).
  Select: {
    children: ["Label", "Button", "Description", "FieldError", "ListBox"],
  },
  ComboBox: {
    children: [
      "Label",
      "Group",
      "Description",
      "FieldError",
      "ListBox",
    ],
  },
  DatePicker: {
    children: [
      "Label",
      "Group",
      "Calendar",
      "Description",
      "FieldError",
    ],
  },
  DateRangePicker: {
    children: [
      "Label",
      "Group",
      "Calendar",
      "RangeCalendar",
      "Description",
      "FieldError",
    ],
  },
  // (toggle — Phase 3 (2026-10-08): 노드 트리로 전환 — Checkbox · Switch · Radio · 그룹 · ToggleButtonGroup 행 없음.)
  // collection — Phase 5 (Tabs · TabPanels 는 노드 트리로 그린다 — ADR-256 Phase 5e-2, 행 삭제)
  TagGroup: {
    children: ["Label", "TagList", "Description", "FieldError"],
    wrappers: true,
  },
  // ADR-256 Phase 5b: the reference's items (each holds its ColorSwatch).
  ColorSwatchPicker: { children: ["ColorSwatchPickerItem"] },
  TableView: { children: ["TableHeader", "TableBody"] },
  // (Tree — ADR-256 Phase 5h: 노드 트리로 그린다 — TreeItem > TreeItemContent (자유 내용) + TreeItem, 행 삭제.)
  // range · progress — Phase 7
  Slider: {
    children: ["Label", "SliderOutput", "SliderTrack"],
    wrappers: true,
  },
  SliderTrack: { children: ["SliderThumb"], wrappers: true },
  Meter: { children: ["Label", "MeterValue", "MeterTrack"], wrappers: true },
  ProgressBar: {
    children: ["Label", "ProgressBarValue", "ProgressBarTrack"],
    wrappers: true,
  },
  // overlay · disclosure — Phase 8. Disclosure trigger 버튼의 내용 — chevron 노드와 제목 Text.
  DisclosureGroup: { children: ["Disclosure"], wrappers: true },
  DisclosureHeader: { children: ["DisclosureChevron", "Text"] },
  // calendar — Phase 9
  Calendar: { children: ["CalendarHeader", "CalendarGrid"], wrappers: true },
  RangeCalendar: {
    children: ["CalendarHeader", "CalendarGrid"],
    wrappers: true,
  },
  // S2 · 범위 밖 — Phase 10 (RSP 계약: ButtonGroup `children: ReactElement<ButtonProps>[]` …)
  ButtonGroup: { children: ["Button"] },
  AvatarGroup: { children: ["Avatar"] },
  CardView: { children: ["Card"] },
  Pagination: { children: ["Button"] },
  Toast: { children: ["Heading", "Description"] },
  ColorPicker: {
    children: [
      "ColorArea",
      "ColorSlider",
      "ColorWheel",
      "ColorField",
      "ColorSwatchPicker",
      "ColorSwatch",
    ],
  },
};

/** 부품이 받는 자식의 종류 (ADR-256 Decision 4) — 중첩 판정 · 넣기 목록 · slot 표시가 같이 읽는다. */
export type CatalogChildKind =
  | { readonly kind: "leaf" }
  | { readonly kind: "items"; readonly items: readonly string[] }
  | { readonly kind: "free" };

export function catalogChildKind(type: string): CatalogChildKind {
  if (PEN_LEAF_TYPES.has(type) || DOM_LEAF_TYPES.has(type))
    return { kind: "leaf" };
  const limit = UNCONVERTED_FAMILY_LIMITS[type];
  // 미전환 family 는 지금 renderer 가 그리는 자식이 목록이다 (래퍼 허용 행도 목록은 같다).
  if (limit) return { kind: "items", items: limit.children };
  const items = RAC_COLLECTION_CHILD_TYPES[type];
  return items ? { kind: "items", items } : { kind: "free" };
}

/**
 * DOM 이 자식을 그릴 자리가 없는 타입 — `<img>`·`<input>`·`<hr>` 같은 void 요소, SVG/데이터
 * 로만 그리는 컴포넌트, 값을 props 로만 받는 합성 부품. canonical 자식을 넣어도 Preview 에
 * 도달하지 않는다.
 */
export const DOM_LEAF_TYPES: ReadonlySet<string> = new Set([
  "Image",
  "Avatar",
  "Chart",
  "ProgressCircle",
  "DataTable",
  "Separator",
  "Skeleton",
  "Input",
  "DateInput",
  "SelectIcon",
  "SelectValue",
  "ColorSwatch",
  "ColorArea",
  "ColorSlider",
  "ColorWheel",
  "TailSwatch",
  "SliderThumb",
  "SliderOutput",
  "MeterValue",
  "MeterTrack",
  "ProgressBarValue",
  "ProgressBarTrack",
  "CalendarGrid",
  "CalendarHeader",
]);

// ─────────────────────────────────────────────────────────────────────────────
// 층 3 — HTML 의미
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 루트가 `<button>` 또는 `<a>` 로 렌더되는 타입. HTML 은 interactive content 를 이
 * 둘의 자손으로 두지 못하게 한다 (조상 전체에 적용).
 */
export const HTML_INTERACTIVE_HOST_TYPES: ReadonlySet<string> = new Set([
  "Button",
  "ToggleButton",
  "Link",
  // ADR-256 Phase 3: Checkbox 의 누르는 자리는 RAC `CheckboxButton` — `<label>` 안의 숨은 checkbox 가 그
  //   label 의 control 이다. 다른 interactive · labelable 요소를 그 안에 두지 않는다 (루트 CheckboxField 는
  //   `div` 라 host 가 아니다 — Description · FieldError · 자유 내용을 받는다).
  "CheckboxButton",
  "SwitchButton",
  "RadioButton",
  // DisclosureHeader 는 부모 Disclosure 가 `<Heading><Button slot="trigger">` 로
  // self-compose 한다 (binding 주석) — 루트가 button 이 아니라 host 가 아니다.
]);

/** HTML interactive content 또는 labelable control 로 렌더되는 타입. */
export const HTML_INTERACTIVE_TYPES: ReadonlySet<string> = new Set([
  "Button",
  "ToggleButton",
  "ToggleButtonGroup",
  "Link",
  "Checkbox",
  "CheckboxButton",
  "CheckboxGroup",
  "Radio",
  "RadioButton",
  "RadioGroup",
  "Switch",
  "SwitchButton",
  "Slider",
  "SliderThumb",
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ComboBox",
  "Select",
  "SelectTrigger",
  "DatePicker",
  "DateRangePicker",
  "DateField",
  "TimeField",
  "DateInput",
  "ColorField",
  "ColorPicker",
  "ColorArea",
  "ColorSlider",
  "ColorWheel",
  "ColorSwatchPicker",
  "FileTrigger",
  "DropZone",
  "Input",
  "Menu",
  "MenuItem",
  "ListBox",
  "ListBoxItem",
  "GridList",
  "GridListItem",
  "Tabs",
  "TabList",
  "Tab",
  "Disclosure",
  "DisclosureHeader",
  "Tree",
  "Table",
  "TableView",
  "Calendar",
  "RangeCalendar",
  "TagGroup",
  "Tag",
  "Toolbar",
  "Pagination",
  "Breadcrumbs",
]);

/** 루트가 `<form>` 인 타입. form 은 form 의 자손이 될 수 없다. */
export const HTML_FORM_TYPES: ReadonlySet<string> = new Set(["Form"]);

/**
 * 루트가 phrasing content 만 담는 요소 (`<p>` · `<h1..6>` · `<label>` · `<code>` ·
 * `<kbd>`) 로 렌더되는 타입. 블록을 넣으면 브라우저가 요소를 쪼개거나 React 가 경고한다.
 */
export const HTML_PHRASING_ONLY_PARENT_TYPES: ReadonlySet<string> = new Set([
  "Paragraph",
  "Heading",
  "Label",
  "Code",
  "Kbd",
  "Keyboard",
  "Description",
]);

/** phrasing content 로 렌더되어 위 부모 안에 들어갈 수 있는 타입. */
export const HTML_PHRASING_CHILD_TYPES: ReadonlySet<string> = new Set([
  "Text",
  "Icon",
  "Link",
  "Kbd",
  "Keyboard",
  "Code",
  "Image",
  "Badge",
  "Avatar",
  "Skeleton",
  "Button",
  "ToggleButton",
  "Checkbox",
  "Radio",
  "Switch",
  "Tag",
  "StatusLight",
  "TailSwatch",
  "ColorSwatch",
  "Input",
]);

// ─────────────────────────────────────────────────────────────────────────────
// 판정
// ─────────────────────────────────────────────────────────────────────────────

/** 원본 타입을 해석하지 않은 인스턴스 — 통과 (Phase 1 한계). */
const OPAQUE_TYPES: ReadonlySet<string> = new Set(["ref"]);

function isOpaque(type: string | null): boolean {
  return type === null || OPAQUE_TYPES.has(type);
}

/**
 * 부모·조상 사슬 아래에 `childType` 을 둘 수 있는가. 위반이면 첫 위반을 돌려준다.
 * 검사 순서 = 표의 층 순서 (Pen 구조 → RAC 합성 → HTML 의미). 한 쌍이 여러 층에
 * 걸리면 가장 구조적인 층이 이유가 된다.
 */
export function resolveNestingViolation(
  input: NestingCheckInput,
): NestingViolation | null {
  const { parentType, childType } = input;
  const ancestors = normalizeAncestors(parentType, input.ancestorTypes);

  if (isOpaque(childType)) return null;

  // 층 1 — Pen 구조: leaf 는 자식을 가질 수 없다.
  if (parentType !== null && PEN_LEAF_TYPES.has(parentType)) {
    return {
      layer: "pen-structure",
      parentType,
      childType,
      reason: `${parentType} is a leaf in the Pen schema (exports as text/icon_font, no children)`,
      leafParent: true,
    };
  }

  // 층 3 (선행) — DOM void/self-contained: 자식을 그릴 자리가 없다.
  if (parentType !== null && DOM_LEAF_TYPES.has(parentType)) {
    return {
      layer: "html-content",
      parentType,
      childType,
      reason: `${parentType} renders a void or self-contained element and cannot hold children`,
      leafParent: true,
    };
  }

  // 층 2 — RAC 합성 (0): 미전환 family 는 지금 renderer 가 그리는 자식만 (ADR-256 Decision 4).
  const limit =
    parentType !== null && !isOpaque(parentType)
      ? UNCONVERTED_FAMILY_LIMITS[parentType]
      : undefined;
  if (parentType !== null && limit) {
    const passthrough =
      limit.wrappers === true && NESTING_PASSTHROUGH_TYPES.has(childType);
    if (!limit.children.includes(childType) && !passthrough) {
      return {
        layer: "rac-composition",
        parentType,
        childType,
        reason: `${parentType} draws only ${limit.children.join(" · ")} until its family is converted (ADR-256 — other children never reach the DOM)`,
        allowedChildren: limit.children,
      };
    }
  }

  // 층 2 — RAC 합성 (a): 항목 목록 부품 (RAC collection) 은 항목만 받는다 — 래퍼도 RAC 가 버린다.
  if (parentType !== null && !isOpaque(parentType) && !limit) {
    const allowed = RAC_COLLECTION_CHILD_TYPES[parentType];
    if (allowed && !allowed.includes(childType)) {
      return {
        layer: "rac-composition",
        parentType,
        childType,
        reason: `${parentType} reads only ${allowed.join(" · ")} as direct children (RAC collection contract)`,
        allowedChildren: allowed,
      };
    }
  }

  // 층 2 — RAC 합성 (b): 합성 부품은 소유자 안에서만 뜻이 있다.
  const owners = RAC_SUBPART_OWNER_TYPES[childType];
  if (owners) {
    const hasOwner = ancestors.some((t) => owners.includes(t));
    const hasOpaqueAncestor = ancestors.some((t) => isOpaque(t));
    if (!hasOwner && !hasOpaqueAncestor) {
      return {
        layer: "rac-composition",
        parentType: parentType ?? "document",
        childType,
        reason: `${childType} needs ${owners.join(" or ")} as an ancestor (RAC compound contract)`,
        owners,
      };
    }
  }

  // 층 3 — HTML 의미: interactive ⊄ button/a (조상 전체).
  if (HTML_INTERACTIVE_TYPES.has(childType)) {
    const host = ancestors.find((t) => HTML_INTERACTIVE_HOST_TYPES.has(t));
    if (host) {
      return {
        layer: "html-content",
        parentType: host,
        childType,
        reason: `${childType} is interactive content and cannot be a descendant of ${host} (<button>/<a>)`,
      };
    }
  }

  // 층 3 — HTML 의미: form ⊄ form (조상 전체).
  if (HTML_FORM_TYPES.has(childType)) {
    const host = ancestors.find((t) => HTML_FORM_TYPES.has(t));
    if (host) {
      return {
        layer: "html-content",
        parentType: host,
        childType,
        reason: `<form> cannot be a descendant of <form>`,
      };
    }
  }

  // 층 3 — HTML 의미: 블록 ⊄ phrasing 컨테이너 (직계).
  if (
    parentType !== null &&
    HTML_PHRASING_ONLY_PARENT_TYPES.has(parentType) &&
    !HTML_PHRASING_CHILD_TYPES.has(childType)
  ) {
    return {
      layer: "html-content",
      parentType,
      childType,
      reason: `${parentType} renders a phrasing-only element and cannot contain ${childType}`,
    };
  }

  return null;
}

export function canNest(
  parentType: string | null,
  childType: string,
  ancestorTypes?: readonly string[],
): boolean {
  return (
    resolveNestingViolation({ parentType, childType, ancestorTypes }) === null
  );
}

/**
 * 직계 부모가 위반이면 조상 사슬을 위로 올라가며 `childType` 을 둘 수 있는 첫 조상의
 * index 를 돌려준다 (0 = 직계 부모). 없으면 `-1`. 소비처는 이 index 로 drop 대상을
 * 옮기고 사용자에게 알린다 (거부 대신 이동 + 되돌리기).
 */
export function findClosestNestableAncestorIndex(
  childType: string,
  ancestorTypes: readonly string[],
): number {
  for (let i = 0; i < ancestorTypes.length; i += 1) {
    if (canNest(ancestorTypes[i], childType, ancestorTypes.slice(i))) return i;
  }
  return -1;
}

/**
 * 서브트리 전체를 검사한다 — 붙여넣기·팩토리 트리·문서 전체 검증용. 트리 안 모든
 * 부모-자식 쌍 + 루트를 `attachTo` 조상 사슬에 붙였을 때의 위반을 모은다.
 */
export function collectSubtreeNestingViolations(
  root: NestingTreeNode,
  attachTo: readonly string[],
): NestingViolation[] {
  const out: NestingViolation[] = [];
  const visit = (node: NestingTreeNode, ancestors: readonly string[]): void => {
    const violation = resolveNestingViolation({
      parentType: ancestors[0] ?? null,
      childType: node.type,
      ancestorTypes: ancestors,
    });
    if (violation) out.push(violation);
    const next = [node.type, ...ancestors];
    for (const child of node.children ?? []) visit(child, next);
  };
  visit(root, attachTo);
  return out;
}

export interface NestingTreeNode {
  type: string;
  children?: readonly NestingTreeNode[];
}

function normalizeAncestors(
  parentType: string | null,
  ancestorTypes: readonly string[] | undefined,
): readonly string[] {
  if (!ancestorTypes || ancestorTypes.length === 0) {
    return parentType === null ? [] : [parentType];
  }
  if (parentType !== null && ancestorTypes[0] !== parentType) {
    return [parentType, ...ancestorTypes];
  }
  return ancestorTypes;
}
