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
): Extract<ComponentCatalogEntry, { kind: "primitive" }> {
  const binding = getPrimitiveBinding(type) as PrimitiveBinding;
  return {
    kind: "primitive",
    type,
    family,
    cutover,
    binding,
    panel: { ...panel, placeable: true },
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
 * 컴포넌트 카탈로그 — 등록 SSOT. family cutover 진행 시 family 별 entry 가 누적된다.
 * 현재 family ①(primitives/actions)만 등록 — 나머지 family 는 후속 cutover 에서 추가.
 */
export const componentCatalog: readonly ComponentCatalogEntry[] = [
  ...FAMILY_1_ENTRIES,
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

/** `cutover === "catalog"` 인 type 집합 — cutover 게이트의 파생 source. */
export function getCatalogCutoverTypes(): ReadonlySet<string> {
  return new Set(
    componentCatalog.filter((e) => e.cutover === "catalog").map((e) => e.type),
  );
}
