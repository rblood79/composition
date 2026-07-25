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
 * leaf primitive 의 D1 source. 두 종류:
 * - `rac`: react-aria-components 의 RAC primitive (대부분).
 * - `internal`: RAC 아닌 composition 내부 leaf 렌더러 (예: Icon = Lucide SVG).
 *
 * D1 권위(RAC)는 rac source 에 한정되고, internal source 는 RAC 으로 환원 불가능한
 * leaf(SVG 아이콘 등)를 위한 탈출구다. discriminant `kind` 로 렌더러가 분기한다.
 */
export type PrimitiveSource =
  | {
      kind: "rac";
      /** D1 runtime primitive 패키지 (npm). */
      package: "react-aria-components";
      importPath: string;
      /** RAC export 이름 (렌더러가 `RAC[component]` 로 조회). */
      component: string;
    }
  | {
      kind: "internal";
      /**
       * composition 내부 leaf 렌더러 식별자 (RAC primitive 아님).
       * DOM/Skia 렌더러가 이 키로 전용 렌더를 dispatch. 예: Icon = "icon"(Lucide SVG, getIconData).
       */
      renderer: string;
    };

/**
 * leaf primitive 1개당 1개. 약 35개(Phase 0 inventory 실측 49 RAC-backed 중
 * 환원 불가 leaf). 시각/변형/구조 필드 없음 — 시각은 theme/tokens, 변형은 `data-*`.
 */
export interface PrimitiveBinding {
  source: PrimitiveSource;
  /**
   * RAC primitive 의 part/slot/state 메타데이터. **rac source 전용** —
   * internal source(Icon 등)는 RAC part/slot 개념이 없어 생략한다.
   */
  rac?: {
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
    /**
     * visual-enum kind(variant/size/fillStyle)라도 `data-*` 속성이 아니라 React **prop** 으로
     * 통과시킬 키 목록. `toRacProps` 의 generic data-attr 라우팅을 이 키에 한해 우회한다.
     *
     * **Why (ADR-912 StatusLight slice, 2026-06-06)**: 기본 라우팅은 visual-enum 을 `data-variant`
     * 등으로 보내고 generated CSS(`[data-variant]{background}`)가 색을 적용한다(RAC source 40 의
     * 정상 동작). 그러나 internal source leaf 중 variant 가 CSS selector 부가속성이 아니라 색 계산의
     * **semantic input** 인 outlier(StatusLight = dot indicator, generated CSS 컨테이너 칠 불가)는
     * 컴포넌트가 variant 를 prop 으로 받아 runtime rule 색을 계산해야 한다. data-attr 만 오면 prop 이
     * undefined → default 고정(Skia 는 rule 직접 → 비대칭). 이 필드로 그 키만 prop 통과시켜 격리한다.
     *
     * 미설정(대부분) → 기존 data-attr 라우팅 유지(회귀 0). RAC source 에는 사용하지 않는다.
     */
    propPassthrough?: readonly string[];
  };
  /**
   * 비-DOM-trivial primitive(arc/track/indicator/wheel 등)의 Skia draw module 키.
   * 대부분 미사용 — 순수 DOM box 로 표현 가능한 primitive 는 생략한다.
   *
   * **배열 (ADR-142 Inc3 overlays)**: 한 type 이 여러 패턴을 합성할 때 키 배열. 예: Dialog =
   * `["overlay_backdrop"]`. dispatch 가 각 키의 mode(replace/prepend/append)로
   * buildCatalogShapes(box+text) 출력에 합성한다(`getSkiaPrimitiveMode`).
   *
   * **그림자는 여기 오지 않는다 (ADR-166 Phase 4)**: box-shadow 로 표현 가능한 elevation 은
   * catalog `containerStyles.boxShadow` = `{shadow.*}` TokenRef 채널이 담당한다. primitive 는
   * box-shadow 로 못 그리는 형상(backdrop 전체화면 rect / arrow 꼬리)에 한정.
   */
  skiaPrimitive?: string | string[];
  /**
   * D1 정적 DOM 속성 (role / aria-live 등). generic fallback 렌더 경로가 그대로 부여한다 —
   * 컴포넌트별 if 분기가 아니라 binding 데이터(no-classification 정합).
   *
   * **Why (ADR-912 InlineAlert slice, 2026-06-04)**: catalog 등록 시 spec.react() 가 부여하던
   * D1 metadata(role="alert"/aria-live="polite")가 generic fallback 경로에서 누락된다. RAC source
   * 는 RAC primitive 가 role 을 자체 부여하지만, internal/native source(단순 styled div)는 부여처가
   * 없다. 이 필드가 그 공백을 데이터로 메운다 — Nav(navigation)/Section(region) 등 role 누락 leaf 도
   * 동일 메커니즘으로 소급 복원 가능.
   */
  staticAttrs?: Readonly<Record<string, string>>;
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
  | "fillStyle"
  | "binding"
  | "items-manager";

/**
 * `kind:"items-manager"` 의 개별 항목 인라인 편집 스키마.
 *
 * specs `ItemsManagerFieldItemSchema` 와 동일 구조 — catalog types 는 self-contained
 * 원칙(본 파일 상단 주석)상 specs 를 import 하지 않으므로 구조만 미러한다. builder
 * 의 generic renderer 가 이 schema 를 specs `ItemsManagerField` 로 투영해 `ItemsManager`
 * 에 전달한다(collection 정적 items 추가/제거 UI — RSP Dynamic collections).
 */
export interface ItemsManagerItemSchema {
  key: string;
  type: "string" | "boolean" | "icon" | "event-id";
  label: string;
}

/** `kind:"items-manager"` PropContract 가 담는 정적 items 배열 편집 schema. */
export interface ItemsManagerSchema {
  /** props 내 items 배열 키 (e.g. "items"). */
  itemsKey: string;
  /** 항목 타입 이름 — UI 라벨/디버깅용 (e.g. "MenuItem"). */
  itemTypeName: string;
  /** 새 항목 추가 시 기본 값. */
  defaultItem: Record<string, unknown>;
  /** 항목 인라인 편집 스키마. */
  itemSchema: ItemsManagerItemSchema[];
  /** 목록에서 라벨로 표시할 키 (e.g. "label"). */
  labelKey?: string;
  /** Section 그룹 추가 허용 (ListBox/Menu). */
  allowSections?: boolean;
  /** Separator 추가 허용 (Menu 전용). */
  allowSeparators?: boolean;
}

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
  /** `kind:"items-manager"` 전용 — 정적 items 배열 편집 schema. */
  itemsManager?: ItemsManagerSchema;
  visibleWhen?: VisibilityCondition;
}

/**
 * reusable 조합 컴포넌트가 노출하는 편집 prop 스키마.
 * 저장 위치 = origin root `metadata.propsSchema` (ADR-148 Decision 4 확정 2026-07-17 —
 * x-composition 은 ADR-131 축소 방향 namespace 라 기각). 판독은 `readPropsSchema()` 단일 진입.
 */
export type PropsSchema = Record<string, PropContract>;

/** 컴포넌트 팔레트 표시 메타. */
export interface PanelMeta {
  category: string;
  label: string;
  icon: string;
  placeable: boolean;
  /**
   * ADR-912 6 registry collapse — Layout 모드에서만 palette 에 노출되는 항목(예: Slot).
   * 미설정 = 모든 모드 노출. ComponentList 의 `layoutOnly` 분기 SSOT.
   */
  layoutOnly?: boolean;
}

// ── ComponentCatalogEntry — 6 레지스트리 대체 단일 등록 SSOT ─────────

/**
 * 컴포넌트 카탈로그 entry.
 * - `primitive`: `react-aria-components` 에 leaf RAC primitive 가 있는 항목. `binding` 으로 정의.
 * - `reusable`: 조합 컴포넌트. `reusableId` 가 canonical reusable 문서를 가리킴 — 코드 정의 없음.
 * - `native`: composition-native(frame/Slot). RAC primitive 도 reusable 문서도
 *   아닌 canonical 일급 노드(FrameNode 등, ADR-130). binding/reusableId 둘 다 없고, **cutover
 *   개념이 없다** — 이미 canonical-native 로 렌더(frame→div / Slot renderer). catalog 등록은
 *   팔레트/factory metadata SSOT 통합 목적(렌더 전환 아님, 사용자 결정 2026-05-31 metadata-only).
 *   따라서 cutover 게이트(isCatalogCutover) 파생에서 제외된다.
 *
 * **ADR-912 단계 5 step 1 (2026-06-04) — `skiaLegacy` 필드 제거 (dead gate)**: 단계 5 (1b)
 * 에서 skiaLegacy 0건 도달 → Skia generic 렌더가 전 catalog entry 발효(collection 7종 +
 * date 4 + Tooltip 은 skiaPrimitive escape). DOM/Skia 채널이 더 이상 갈리지 않으므로 entry
 * union 의 `skiaLegacy?: boolean` 필드와 `isCatalogSkiaCutover` 게이트는 의미 소멸 →
 * `isCatalogCutover` 단일 게이트로 collapse.
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
    }
  | {
      kind: "native";
      type: string;
      family: ComponentFamily;
      /** composition-native 는 RAC binding / reusable 문서 없음. cutover 개념 없음(metadata-only). */
      panel: PanelMeta;
    };
