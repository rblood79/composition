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
import type { ComponentCatalogEntry, PanelMeta } from "./types";
/**
 * 컴포넌트 카탈로그 — 등록 SSOT. family cutover 진행 시 family 별 entry 가 누적된다.
 * 현재 family ①~⑧ 등록 — ⑦ date-color 에 color leaf 5종(ColorSwatch/Area/Wheel/Slider/TailSwatch)
 * box-only cutover 포함(2026-06-11). ColorPicker/ColorSwatchPicker(container)는 2026-06-17
 * shell-only container slice 로 cutover.
 * ⑧ native(frame/Slot)는 metadata-only(cutover 게이트 미포함, canonical-native 렌더 유지).
 *   (MaskedFrame 은 2026-06-16 dead orphan 폐기)
 */
export declare const componentCatalog: readonly ComponentCatalogEntry[];
export declare function getCatalogEntry(type: string): ComponentCatalogEntry | undefined;
/**
 * type → palette 표시 메타(`PanelMeta`) 조회. ComponentList 파생 SSOT 진입점
 * (ADR-912 6 registry collapse §2-5 #1). category/label/icon/layoutOnly 의 단일 source —
 * builder ComponentList 의 정적 배열을 본 메타 파생으로 대체한다.
 */
export declare function getPanelMeta(type: string): PanelMeta | undefined;
export declare function getCatalogCutoverTypes(): ReadonlySet<string>;
/**
 * type → catalog binding accepts 의 default 집합 (D2/D3 prop default 의 SSOT).
 *
 * **ADR-912 6 registry collapse §2-5 #3 (Factory/default props)**: `primitive` entry 의
 * `binding.props.accepts` 를 순회하며 `contract.default !== undefined` 인 키만 모은다.
 * variant/size/fillStyle/type/strokeWidth/staticColor 등 visual·enum·number default 가
 * 대상 — 이것이 컴포넌트 초기 props 의 catalog-파생 base 다.
 *
 * builder 의 `deriveDefaultPropsFromCatalog(type)` 가 이 base 위에 builder-local override
 * (children placeholder 텍스트 / name / style 등 catalog 에 표현 못 하는 잔여)를 합성하여
 * `createDefault{Type}Props()` 손-코딩을 대체한다. ComponentList(#1) 의 catalog.panel 파생과
 * 동형 — catalog SSOT + builder-local overlay 2층.
 *
 * `reusable`/`native` entry 는 binding 이 없어 빈 객체를 반환한다(파생 대상 0, factory-local).
 */
export declare function getCatalogDefaultProps(type: string): Readonly<Record<string, unknown>>;
//# sourceMappingURL=componentCatalog.d.ts.map