/**
 * ADR-142 — canonical 문서 기반 컴포넌트 시스템 / catalog 타입 SSOT.
 *
 * 새 시스템에는 "컴포넌트당 정의 객체"(legacy `ComponentSpec`)가 없다.
 * 코드 정의는 leaf RAC primitive 약 35개의 `PrimitiveBinding` 하나뿐이고,
 * 조합 컴포넌트는 canonical reusable 문서(데이터)다.
 *
 * 6개 레지스트리(spec / TAG_SPEC_MAP / specRegistry / factory / panel / renderer)는
 * 단일 `ComponentCatalogEntry` 등록으로 대체된다.
 *
 * 본 파일은 self-contained — legacy `packages/specs/src/types/spec.types.ts`(FieldDef 등)를
 * import 하지 않는다. canonical/resolver 타입은 같은 패키지(`shared`)에서 직접 소비한다.
 *
 * 설계 상세: docs/adr/design/142-starter-spec-component-system-cutover-breakdown.md §3
 */

// ── family / cutover 상태 ────────────────────────────────────────────

/** 8 컴포넌트 family — family 단위 atomic cutover 의 SSOT 축. */
export type ComponentFamily =
  | "primitives"
  | "fields"
  | "selection"
  | "collections"
  | "tree-table"
  | "overlays"
  | "date-color"
  | "composition-native";

/**
 * cutover 진행 상태. 한 family 의 모든 entry 가 함께
 * `legacy → cutting-over → catalog` 를 거친다. 같은 family 안에서
 * `legacy` 와 `catalog` 가 혼재할 수 없다.
 */
export type CutoverState = "legacy" | "cutting-over" | "catalog";

// ── PrimitiveBinding ─────────────────────────────────────────────────

/**
 * leaf RAC primitive 1개당 1개. 약 35개(Phase 0 inventory 실측 49 RAC-backed 중
 * 환원 불가 leaf). 시각/변형/구조 필드 없음 — 시각은 theme/tokens, 변형은 `data-*`.
 */
export interface PrimitiveBinding {
  source: {
    /** D1 runtime primitive 패키지 (npm). */
    package: "react-aria-components";
    importPath: string;
    component: string;
  };
  rac: {
    primitive: string;
    parts: string[];
    slots: string[];
    states: string[];
    renderProps: string[];
    dataAttributes: string[];
  };
  props: {
    /** 이 primitive 가 받는 canonical props 집합 = primitive D2 편집 SSOT. */
    accepts: Record<string, PropContract>;
    /** canonical props → RAC component props 투영기 식별자. 구현은 `outputs/toRacProps.ts`. */
    toRacProps: string;
  };
  /**
   * 비-DOM-trivial primitive(arc/track/indicator/wheel 등)의 Skia draw module 키.
   * 대부분 미사용 — 순수 DOM box 로 표현 가능한 primitive 는 생략한다.
   */
  skiaPrimitive?: string;
}

// ── Inspector 편집 계약 (PropContract) ───────────────────────────────

/**
 * canonical prop 1개 = Inspector 편집 필드 1개의 kind.
 * legacy `FieldDef` 11종 union(spec.types.ts)의 표현력을 9 kind 로 흡수한다.
 * (Phase 0 inventory §6: CustomField 0=dead, ChildrenManagerField 5→children 트리,
 *  derivedUpdateFn 19=generic Inspector 흡수 과제.)
 */
export type InspectorFieldKind =
  | "boolean"
  | "enum"
  | "string"
  | "string-array"
  | "number"
  | "icon"
  | "variant"
  | "size"
  | "binding";

/** 필드 가시성 조건 — 다른 prop 값에 따라 조건부 노출. */
export interface VisibilityCondition {
  key?: string;
  equals?: string | number | boolean;
  oneOf?: Array<string | number | boolean>;
  truthy?: boolean;
}

/**
 * 단일 canonical prop 의 편집 계약. primitive 의 `accepts` 와
 * reusable 의 `propsSchema` 가 같은 타입을 공유한다.
 */
export interface PropContract {
  kind: InspectorFieldKind;
  label?: string;
  default?: unknown;
  /** 필드 그룹 태그 — 컴포넌트당 `SectionDef[]` 대체. generic Inspector 가 이 태그로 묶는다. */
  section?: "content" | "appearance" | "state" | "locale" | (string & {});
  /**
   * enum 전용 고정 옵션. `kind:"variant"`/`"size"` 는 `options` 를 두지 않는다 —
   * 선택 가능 값을 theme 규칙의 `data-*` 값 집합에서 읽는다.
   */
  options?: Array<{ value: string; label: string }>;
  /** number 전용. */
  min?: number;
  max?: number;
  step?: number;
  visibleWhen?: VisibilityCondition;
}

/** reusable 조합 컴포넌트가 노출하는 편집 prop 스키마 (`x-composition` extension 메타). */
export type PropsSchema = Record<string, PropContract>;

/** 컴포넌트 팔레트 표시 메타. */
export interface PanelMeta {
  category: string;
  label: string;
  icon: string;
  placeable: boolean;
}

// ── ComponentCatalogEntry — 6 레지스트리 대체 단일 등록 SSOT ─────────

/**
 * 컴포넌트 카탈로그 entry.
 * - `primitive`: `react-aria-components` 에 leaf RAC primitive 가 있는 항목. `binding` 으로 정의.
 * - `reusable`: 조합 컴포넌트. `reusableId` 가 canonical reusable 문서를 가리킴 — 코드 정의 없음.
 * composition-native(Frame/Slot/reusable tooling)는 RAC primitive 없이
 * `family: "composition-native"` 로 등록한다.
 */
export type ComponentCatalogEntry =
  | {
      kind: "primitive";
      type: string;
      family: ComponentFamily;
      cutover: CutoverState;
      binding: PrimitiveBinding;
      panel: PanelMeta;
    }
  | {
      kind: "reusable";
      type: string;
      family: ComponentFamily;
      cutover: CutoverState;
      /** catalog/library 의 canonical reusable frame id. */
      reusableId: string;
      panel: PanelMeta;
    };
