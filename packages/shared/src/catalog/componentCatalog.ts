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
import type { ComponentCatalogEntry, PrimitiveBinding } from "./types";

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
  cutover: ComponentCatalogEntry["cutover"],
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
const FAMILY_1_CUTOVER: ComponentCatalogEntry["cutover"] = "catalog";

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
const FAMILY_2_CUTOVER: ComponentCatalogEntry["cutover"] = "catalog";

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
const FAMILY_3_CUTOVER: ComponentCatalogEntry["cutover"] = "catalog";

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
 * Tabs/TagGroup/GridList). **skiaLegacy: true** — DOM(Preview)/Inspector 는 catalog generic
 * (composition wrapper + useCollectionData), Skia 만 legacy render.shapes 유지(items 배열 순회
 * multi-item 렌더는 Skia generic 미지원, 전 family 후 일괄). 사용자 결정 "DOM-only cutover".
 */
const FAMILY_4_CUTOVER: ComponentCatalogEntry["cutover"] = "catalog";

const FAMILY_4_ENTRIES: ComponentCatalogEntry[] = [
  primitiveEntry(
    "ListBox",
    "collections",
    FAMILY_4_CUTOVER,
    { category: "collections", label: "list box", icon: "ListIcon" },
    { skiaLegacy: true },
  ),
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
 * 컴포넌트 카탈로그 — 등록 SSOT. family cutover 진행 시 family 별 entry 가 누적된다.
 * 현재 family ①~④ 등록 — 나머지(⑤ Tree·Table / ⑥ overlays / ⑦ date·color / ⑧ native) 후속.
 */
export const componentCatalog: readonly ComponentCatalogEntry[] = [
  ...FAMILY_1_ENTRIES,
  ...FAMILY_2_ENTRIES,
  ...FAMILY_3_ENTRIES,
  ...FAMILY_4_ENTRIES,
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
    componentCatalog.filter((e) => e.cutover === "catalog").map((e) => e.type),
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
      .filter((e) => e.cutover === "catalog" && e.skiaLegacy !== true)
      .map((e) => e.type),
  );
}
