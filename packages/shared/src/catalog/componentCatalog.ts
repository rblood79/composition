/**
 * ADR-142 — `componentCatalog`: 6개 레지스트리(Component Panel / Factory / rendererMap /
 * getDefaultProps / BASE_TAG_SPEC_MAP / builder TAG_SPEC_MAP)를 대체하는 **단일 등록 SSOT**.
 *
 * - `kind: "primitive"` — leaf RAC/internal primitive. `binding` 으로 정의.
 * - `kind: "reusable"` — 조합 컴포넌트. `reusableId` → canonical reusable 문서. (family ① 없음)
 *
 * `family` + `cutover` 가 family 단위 atomic cutover 의 SSOT 축. 한 family 의 모든 entry 는
 * `cutover` 를 함께 거치며(legacy → cutting-over → catalog), 같은 family 안 혼재 금지(불변식 D).
 *
 * cutover 게이트(`cutover.ts::isCatalogCutover`)는 본 catalog 의 `cutover === "catalog"` entry
 * 에서 파생된다 — 단일 SSOT. family flip 은 여기 `cutover` 값을 바꾸는 것으로 발효.
 *
 * 설계: docs/adr/design/142-starter-spec-component-system-cutover-breakdown.md §3
 */

import { getPrimitiveBinding } from "./bindings";
import type {
  ComponentCatalogEntry,
  CutoverState,
  PrimitiveBinding,
} from "./types";

/**
 * family ①(primitives/actions) 8 primitive entry.
 *
 * 전부 leaf primitive — reusable 문서 없음. Badge 는 inventory §3 "reusable" 분류를 실측으로
 * 정정한 internal source leaf(단일 styled box+text). Icon/Badge 는 internal source(RAC 아님).
 *
 * `cutover: "legacy"` — family ① flip(Phase 6) 시점에 일괄 `"catalog"` 로 전환(불변식 D atomic).
 */
function primitiveEntry(
  type: string,
  family: ComponentCatalogEntry["family"],
  cutover: CutoverState,
  panel: { category: string; label: string; icon: string },
  opts?: { skiaLegacy?: boolean },
): Extract<ComponentCatalogEntry, { kind: "primitive" }> {
  const binding = getPrimitiveBinding(type) as PrimitiveBinding;
  return {
    kind: "primitive",
    type,
    family,
    cutover,
    binding,
    panel: { ...panel, placeable: true },
    ...(opts?.skiaLegacy ? { skiaLegacy: true } : {}),
  };
}

/**
 * ADR-142 family ① cutover 상태. **flip 발효 지점** — "catalog" 로 전환하면 8 type 이
 * CATALOG_CUTOVER_TYPES 에 들어가 DOM/Skia/Inspector 가 catalog generic 경로로 동시 발효
 * (불변식 D atomic). cross-check 통과 후 flip.
 */
const FAMILY_1_CUTOVER: CutoverState = "catalog";

const FAMILY_1_ENTRIES: ComponentCatalogEntry[] = [
  primitiveEntry("Button", "primitives", FAMILY_1_CUTOVER, {
    category: "buttons",
    label: "button",
    icon: "MousePointer",
  }),
  primitiveEntry("ToggleButton", "primitives", FAMILY_1_CUTOVER, {
    category: "buttons",
    label: "toggle button",
    icon: "ToggleLeft",
  }),
  primitiveEntry("ToggleButtonGroup", "primitives", FAMILY_1_CUTOVER, {
    category: "buttons",
    label: "toggle button group",
    icon: "GroupIcon",
  }),
  primitiveEntry("Toolbar", "primitives", FAMILY_1_CUTOVER, {
    category: "buttons",
    label: "toolbar",
    icon: "Settings",
  }),
  primitiveEntry("Link", "primitives", FAMILY_1_CUTOVER, {
    category: "layout",
    label: "link",
    icon: "Link",
  }),
  primitiveEntry("Separator", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "separator",
    icon: "SeparatorHorizontal",
  }),
  primitiveEntry("Icon", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "icon",
    icon: "Smile",
  }),
  primitiveEntry("Badge", "primitives", FAMILY_1_CUTOVER, {
    category: "content",
    label: "badge",
    icon: "Star",
  }),
];

/**
 * ADR-142 family ②(fields) cutover 상태. 7 RAC-backed primitive(inventory §2-1).
 * field 는 RAC 가 Label/Input slot 을 합성하는 leaf primitive — 자식 Element(Label/Input)는
 * canonical children 트리, Skia 는 `buildCatalogShapes` 의 `_hasChildren` 빈 box shell 로 흡수.
 */
const FAMILY_2_CUTOVER: CutoverState = "catalog";

const FAMILY_2_ENTRIES: ComponentCatalogEntry[] = [
  primitiveEntry("TextField", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "text field",
    icon: "RectangleEllipsis",
  }),
  primitiveEntry("NumberField", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "number field",
    icon: "Hash",
  }),
  primitiveEntry("SearchField", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "search field",
    icon: "Search",
  }),
  primitiveEntry("DateField", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "date field",
    icon: "CalendarCheck",
  }),
  primitiveEntry("TimeField", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "time field",
    icon: "ChevronDown",
  }),
  primitiveEntry("ColorField", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "color field",
    icon: "Palette",
  }),
  primitiveEntry("Form", "fields", FAMILY_2_CUTOVER, {
    category: "forms",
    label: "form",
    icon: "GroupIcon",
  }),
];

/**
 * ADR-142 family ③(selection) cutover 상태. Checkbox/Radio/Switch/Slider + Group 6개.
 * Checkbox/Radio/Switch 는 indicator(box/circle/track+thumb)를 `skiaPrimitive` draw module 로
 * 그린다(box+text 표현 불가). Slider 는 track/thumb 을 자식 SliderTrack/Thumb sub-part 가
 * 그리므로 skiaPrimitive 불필요. Group 은 자식 옵션 컨테이너(_hasChildren 빈 box shell).
 */
const FAMILY_3_CUTOVER: CutoverState = "catalog";

const FAMILY_3_ENTRIES: ComponentCatalogEntry[] = [
  primitiveEntry("Checkbox", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "checkbox",
    icon: "SquareCheck",
  }),
  primitiveEntry("CheckboxGroup", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "checkbox group",
    icon: "GroupIcon",
  }),
  primitiveEntry("Radio", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "radio",
    icon: "Circle",
  }),
  primitiveEntry("RadioGroup", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "radio group",
    icon: "GroupIcon",
  }),
  primitiveEntry("Switch", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "switch",
    icon: "ToggleRight",
  }),
  primitiveEntry("Slider", "selection", FAMILY_3_CUTOVER, {
    category: "forms",
    label: "slider",
    icon: "SlidersHorizontal",
  }),
];

/**
 * ADR-142 family ④(collections) cutover 상태. 7 collection(ListBox/Menu/Select/ComboBox/
 * Tabs/TagGroup/GridList).
 *
 * **ListBox — Skia generic 발효 (skiaLegacy 제거, ADR-912 선행 작업 2026-06-03)**: ListBox
 *   render.shapes 는 이미 container shell(bg roundRect + border)만 반환하고(ADR-146,
 *   ListBox.spec.ts:340-342), data row paint 는 ADR-146/147 row projection renderer
 *   (canvasSceneNode.ts:appendListBoxRowProjection)가 각 행을 독립 Skia 노드로 그린다 — 즉
 *   items 배열 순회가 render.shapes 안에 없다. buildCatalogShapes 가 동일 정본 table
 *   (componentRulesTable ListBox rule)의 variant fill + border 로 같은 shell 을 그려 시각 동등
 *   (text 없음 → text 미렌더). row projection 경로는 컨테이너 cutover 와 직교(불변).
 *
 * **나머지 6 collection(Menu/Select/ComboBox/Tabs/TagGroup/GridList) — skiaLegacy: true 유지**:
 *   DOM(Preview)/Inspector 는 catalog generic(composition wrapper + useCollectionData), Skia 만
 *   legacy render.shapes 유지(items 배열 순회 multi-item 렌더 generic backend 미발효, ListBox
 *   projection proof 검증 후 동형 확장). 사용자 결정 "DOM-only cutover".
 */
const FAMILY_4_CUTOVER: CutoverState = "catalog";

const FAMILY_4_ENTRIES: ComponentCatalogEntry[] = [
  // ListBox — Skia generic 발효(skiaLegacy 미설정): shell 은 buildCatalogShapes, data row 는
  //   row projection(canvasSceneNode) 별도 경로. ADR-912 선행 collection proof.
  primitiveEntry("ListBox", "collections", FAMILY_4_CUTOVER, {
    category: "collections",
    label: "list box",
    icon: "ListIcon",
  }),
  primitiveEntry(
    "Menu",
    "collections",
    FAMILY_4_CUTOVER,
    { category: "collections", label: "menu", icon: "Menu" },
    { skiaLegacy: true },
  ),
  primitiveEntry(
    "Select",
    "collections",
    FAMILY_4_CUTOVER,
    { category: "forms", label: "select", icon: "ChevronDown" },
    { skiaLegacy: true },
  ),
  primitiveEntry(
    "ComboBox",
    "collections",
    FAMILY_4_CUTOVER,
    { category: "forms", label: "combo box", icon: "ChevronDown" },
    { skiaLegacy: true },
  ),
  primitiveEntry(
    "Tabs",
    "collections",
    FAMILY_4_CUTOVER,
    { category: "layout", label: "tabs", icon: "AppWindow" },
    { skiaLegacy: true },
  ),
  primitiveEntry(
    "TagGroup",
    "collections",
    FAMILY_4_CUTOVER,
    { category: "collections", label: "tag group", icon: "Tag" },
    { skiaLegacy: true },
  ),
  primitiveEntry(
    "GridList",
    "collections",
    FAMILY_4_CUTOVER,
    { category: "collections", label: "grid list", icon: "Grid" },
    { skiaLegacy: true },
  ),
];

/**
 * ADR-142 family ⑤(Tree·Table) cutover 상태. Tree/Table 2개.
 *
 * **Tree — Skia generic 발효 (skiaLegacy 제거, 2026-06-01 G2(a))**: Tree render.shapes 는 이미
 * shell(bg `{color.base}` + border) 만 그리고(ADR 2026-05-18 더미 트리 제거), TreeItem 은 factory
 * 가 canonical 자식 element 로 생성(`createTreeDefinition`) → 각 TreeItem 이 독립 Skia 노드로
 * 행을 렌더한다. 즉 재귀 collection 이 아니라 child element 자동 순회 구조. buildCatalogShapes 가
 * variant fill base(= `resolveStateColors(...).background`) + border 로 동일 shell 을 그리고,
 * Tree factory props 에 label/text 없음 → text 미렌더로 legacy parity. items 소실 위험 0.
 *
 * **Table — skiaLegacy: true 유지**: render.shapes 가 props.rows/columns 2D grid 를 직접 cell
 * shape 로 계산·렌더(데이터-시각 결합형). buildCatalogShapes(보편 box) 로 대체 불가 → R4 HIGH
 * Skia generic backend(items→element 또는 2D grid 생성기) 선행 필요. 별도.
 * TableView 는 inventory §2-1 primitive 49 에 없음(LayoutRenderer 전용 layout helper) → 제외.
 */
const FAMILY_5_CUTOVER: CutoverState = "catalog";

const FAMILY_5_ENTRIES: ComponentCatalogEntry[] = [
  primitiveEntry("Tree", "tree-table", FAMILY_5_CUTOVER, {
    category: "collections",
    label: "tree",
    icon: "ListTree",
  }),
  primitiveEntry(
    "Table",
    "tree-table",
    FAMILY_5_CUTOVER,
    { category: "collections", label: "table", icon: "TableProperties" },
    { skiaLegacy: true },
  ),
];

/**
 * ADR-142 family ⑥(overlays) cutover 상태. Dialog/Modal/Popover/Tooltip/DropZone 5개.
 * **skiaLegacy: true** — portal/overlay 렌더(OverlayArrow svg / dashed drop 영역 등 비-box
 * 시각)는 Skia generic 미확정 → DOM(wrapper)/Inspector 는 catalog generic, Skia 만 legacy
 * render.shapes 유지(전 family 후 일괄). Toast 는 imperative API(useToast/ToastProvider —
 * placeable 노드 아님, ComponentList/factory 미등록) → catalog 제외.
 */
const FAMILY_6_CUTOVER: CutoverState = "catalog";

const FAMILY_6_ENTRIES: ComponentCatalogEntry[] = [
  // Dialog — Skia generic 발효 (skiaLegacy 제거, ADR-142 Inc3 2026-06-01): bg 는
  //   buildCatalogShapes(variant fill {color.layer-1}), backdrop + shadow 는 skiaPrimitive
  //   (overlay_backdrop / dialog_shadow, prepend) 합성. render.shapes 와 parity.
  primitiveEntry("Dialog", "overlays", FAMILY_6_CUTOVER, {
    category: "overlays",
    label: "dialog",
    icon: "AppWindowMac",
  }),
  // Modal — Skia generic 발효 (skiaLegacy 제거, ADR-142 Inc3 2026-06-01): render.shapes=[],
  //   buildCatalogShapes 가 variant fill transparent shell(무해) → legacy [] 와 시각 동일.
  //   backdrop 은 ModalOverlay 별도 담당 → skiaPrimitive 불필요.
  primitiveEntry("Modal", "overlays", FAMILY_6_CUTOVER, {
    category: "overlays",
    label: "modal",
    icon: "InspectionPanel",
  }),
  // Popover — Skia generic 발효 (skiaLegacy 제거, ADR-142 Inc3 2026-06-01): bg/border 는
  //   buildCatalogShapes(variant fill {color.layer-2}), drop shadow + V-arrow 는 skiaPrimitive
  //   (popover_shadow prepend / popover_arrow append) 합성. render.shapes 와 완전 parity.
  primitiveEntry("Popover", "overlays", FAMILY_6_CUTOVER, {
    category: "overlays",
    label: "popover",
    icon: "AppWindowMac",
  }),
  primitiveEntry(
    "Tooltip",
    "overlays",
    FAMILY_6_CUTOVER,
    { category: "overlays", label: "tooltip", icon: "MessageSquare" },
    { skiaLegacy: true },
  ),
  primitiveEntry("DropZone", "overlays", FAMILY_6_CUTOVER, {
    category: "forms",
    label: "drop zone",
    icon: "Upload",
  }),
];

/**
 * ADR-142 family ⑦(date) cutover 상태. date 4개(Calendar/RangeCalendar/DatePicker/
 * DateRangePicker). **skiaLegacy: true** — 날짜 grid(6주×7일 cell) / Popover portal 은 Skia
 * generic 미확정 → DOM(wrapper)/Inspector 는 catalog generic, Skia 만 legacy render.shapes 유지.
 *
 * **color 제외 (사용자 지시 2026-05-31 "TailSwatch 는 패스해")**: TailSwatch(=ColorPicker alias)
 * + ColorArea/ColorWheel/ColorSlider/ColorSwatch(ColorPicker 내부 part)는 family ⑦ cutover
 * 대상 제외 — 별도 처리. arc/wheel/gradient 시각이라 skiaPrimitive 설계가 필요한 영역.
 */
const FAMILY_7_CUTOVER: CutoverState = "catalog";

const FAMILY_7_ENTRIES: ComponentCatalogEntry[] = [
  primitiveEntry(
    "Calendar",
    "date-color",
    FAMILY_7_CUTOVER,
    { category: "date", label: "calendar", icon: "Calendar" },
    { skiaLegacy: true },
  ),
  primitiveEntry(
    "RangeCalendar",
    "date-color",
    FAMILY_7_CUTOVER,
    { category: "date", label: "range calendar", icon: "CalendarDays" },
    { skiaLegacy: true },
  ),
  primitiveEntry(
    "DatePicker",
    "date-color",
    FAMILY_7_CUTOVER,
    { category: "date", label: "date picker", icon: "CalendarCheck" },
    { skiaLegacy: true },
  ),
  primitiveEntry(
    "DateRangePicker",
    "date-color",
    FAMILY_7_CUTOVER,
    { category: "date", label: "date range picker", icon: "CalendarDays" },
    { skiaLegacy: true },
  ),
];

/**
 * ADR-142 family ⑧(composition-native) native entry 헬퍼. frame/Slot/MaskedFrame 은 RAC
 * primitive 도 reusable 문서도 아닌 canonical 일급 노드 → binding/reusableId/cutover 없음.
 */
function nativeEntry(
  type: string,
  panel: { category: string; label: string; icon: string },
): Extract<ComponentCatalogEntry, { kind: "native" }> {
  return {
    kind: "native",
    type,
    family: "composition-native",
    panel: { ...panel, placeable: true },
  };
}

/**
 * ADR-142 family ⑧(composition-native). frame/MaskedFrame/Slot. **metadata-only 등록**
 * (사용자 결정 2026-05-31) — cutover 게이트 미포함, 렌더는 기존 canonical-native 유지
 * (frame→div generic / Slot renderer). catalog 등록은 팔레트/factory metadata SSOT 통합 목적.
 */
const FAMILY_8_ENTRIES: ComponentCatalogEntry[] = [
  nativeEntry("frame", {
    category: "layout",
    label: "frame",
    icon: "GroupIcon",
  }),
  nativeEntry("MaskedFrame", {
    category: "layout",
    label: "masked frame",
    icon: "Frame",
  }),
  nativeEntry("Slot", { category: "layout", label: "slot", icon: "Layers" }),
];

/**
 * 컴포넌트 카탈로그 — 등록 SSOT. family cutover 진행 시 family 별 entry 가 누적된다.
 * 현재 family ①~⑧ 등록 — ⑦ color(TailSwatch) 는 사용자 지시로 제외(별도 처리).
 * ⑧ native(frame/Slot)는 metadata-only(cutover 게이트 미포함, canonical-native 렌더 유지).
 */
export const componentCatalog: readonly ComponentCatalogEntry[] = [
  ...FAMILY_1_ENTRIES,
  ...FAMILY_2_ENTRIES,
  ...FAMILY_3_ENTRIES,
  ...FAMILY_4_ENTRIES,
  ...FAMILY_5_ENTRIES,
  ...FAMILY_6_ENTRIES,
  ...FAMILY_7_ENTRIES,
  ...FAMILY_8_ENTRIES,
];

/** type → catalog entry 조회 (O(1)). */
const CATALOG_BY_TYPE: ReadonlyMap<string, ComponentCatalogEntry> = new Map(
  componentCatalog.map((e) => [e.type, e]),
);

export function getCatalogEntry(
  type: string,
): ComponentCatalogEntry | undefined {
  return CATALOG_BY_TYPE.get(type);
}

/**
 * `cutover === "catalog"` 인 type 집합 — DOM(Preview)/Inspector cutover 게이트의 파생 source.
 * collection(skiaLegacy) 도 포함 — DOM 은 RAC 가 items 자동 합성하므로 generic 경로 발효.
 */
export function getCatalogCutoverTypes(): ReadonlySet<string> {
  return new Set(
    componentCatalog
      // native(frame/Slot)는 cutover 개념 없음 — metadata-only, canonical-native 렌더 유지.
      .filter((e) => e.kind !== "native" && e.cutover === "catalog")
      .map((e) => e.type),
  );
}

/**
 * Skia generic 렌더(buildCatalogShapes) 발효 type 집합 — `cutover === "catalog" && !skiaLegacy`.
 * collection 컴포넌트(skiaLegacy:true)는 제외 → Skia 만 legacy render.shapes 유지(items 순회 렌더).
 * ADR-142 family ④/⑤ DOM-only cutover 의 Skia 측 게이트(부분 cutover).
 */
export function getCatalogSkiaCutoverTypes(): ReadonlySet<string> {
  return new Set(
    componentCatalog
      .filter(
        (e) =>
          e.kind !== "native" &&
          e.cutover === "catalog" &&
          e.skiaLegacy !== true,
      )
      .map((e) => e.type),
  );
}
