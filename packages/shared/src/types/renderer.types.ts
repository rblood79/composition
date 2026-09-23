/**
 * Renderer Types
 *
 * 렌더러에서 사용하는 공유 타입 정의
 * Builder Preview와 Publish App에서 공통으로 사용
 *
 * @since 2025-01-02
 */

import type { ReactNode, CSSProperties } from "react";
import type { DataBinding } from "./element.types";
import type { SlotComposition } from "../catalog/slotRoles";

// ============================================
// Element Props Types
// ============================================

/**
 * 기본 Element Props (렌더러용)
 * 저장 문서(canonical)에 실리는 props 구조
 */
export interface ElementProps {
  type?: string;
  style?: CSSProperties;
  className?: string;
  text?: string;
  children?: ReactNode;
  "data-element-id"?: string;
  // 동적 props 허용
  [key: string]: unknown;
}

// ============================================
// Preview Element Types
// ============================================

/**
 * Preview/Publish에서 사용하는 Element 타입
 */
export interface PreviewElement {
  id: string;
  customId?: string;
  type: string;
  props: ElementProps;
  /**
   * canonical `fills` payload — DOM 소비자는 `adaptElementStyle`(`utils/fillAdapter`)
   * 로 `props.style` 배경에 반영한다.
   *
   * `Fill` 구체 타입 대신 `unknown[]` 인 것은 `Element.fills`(element.types.ts)와
   * 같은 이유다 — 타입 원본이 builder 의 `fill.types.ts`(값 모듈)라
   * 패키지 경계를 넘길 수 없다.
   */
  fills?: unknown[];
  text?: string;
  parent_id?: string | null;
  page_id?: string | null;
  dataBinding?: DataBinding;
  deleted?: boolean;
  /**
   * ADR-214 Phase 4 — 이 요소의 렌더 문맥: 조상 (자기 포함) origin id → instanceKey.
   * `createEventHandlerMap` 이 setState 규칙에 실어 요소 변수 스코프를 정한다. 미주입 = origin
   * 규약 (id 그대로). 렌더 전용 — 문서 · 저장 형식에 실리지 않는다.
   */
  stateInstanceScope?: ReadonlyMap<string, string>;
  /**
   * ADR-234 Phase 2 — 상태 변형 층 style (렌더 전용). RAC render props (`isSelected` · `isHovered` …)
   * 와 렌더러가 넘기던 기본 style 을 받아 켜진 층을 겹친 style 을 돌려준다. 위임 렌더러
   * (Checkbox · Switch · ToggleButton) 가 RAC `style` 함수로 넘긴다 — 미주입 = 층 없음.
   */
  stateStyle?: (
    renderProps: Record<string, unknown>,
    baseStyle: React.CSSProperties | undefined,
  ) => React.CSSProperties | undefined;
  /**
   * ADR-214 Phase 4 — 이 요소 (origin) 의 상태 정의. `source.prop` 이 있는 정의는 암묵 상태 미러
   * (관찰 이벤트 → 런타임 값). 렌더 전용.
   */
  stateDefs?: ReadonlyArray<{
    id: string;
    name: string;
    type: string;
    source?: { prop: string };
  }>;
}

// ============================================
// Render Context Types
// ============================================

/**
 * 런타임 서비스 인터페이스 (DI용)
 * apps에서 구현하여 context로 주입
 */
export interface RuntimeServices {
  /** IndexedDB 접근 */
  getDB?: () => Promise<unknown>;
  /** 저장 서비스 */
  saveService?: {
    saveToLocal: () => Promise<void>;
    getAutoSaveStatus: () => boolean;
    savePropertyChange?: (params: {
      table: string;
      id: string;
      data: Record<string, unknown>;
    }) => Promise<void>;
  };
  /** 이벤트 핸들러 생성 — 반환 형태는 아래 `EventHandlerMap` 정본을 가리킨다 */
  createEventHandlerMap?: (
    element: PreviewElement,
    context: RenderContext,
  ) => EventHandlerMap;
}

// `DataState` / `RenderContext.setDataState` 는 여기 없다 (2026-08-17 제거).
//
// ADR-132 가 컬렉션 데이터의 sink 를 `collections.runtimeData` 로 옮기기 전
// 세대의 배관이었다. 제거 시점 실측 — provider 0건이라 `context.setDataState`
// 는 **항상 undefined**, 소비처(`DataTableComponent`)의 호출 6곳은 전부
// `?.()` no-op, 종착지인 `runtimeStore.dataStates` Map 은 쓰이지도 읽히지도
// 않았다. 배선을 복구하려 해도 preview 쪽 동명 `DataState` 와 형태가 달라
// (`error: string | null` vs `Error | string | null`) 그대로는 대입되지 않는다.
//
// 현행 sink 는 `collections.runtimeData` 하나이며 진입점은
// `useCollectionData` 다 (ADR-132).

/**
 * 렌더링 컨텍스트 - 모든 렌더러에 전달되는 공통 데이터
 */
export interface RenderContext {
  /** 현재 페이지의 모든 elements */
  elements: PreviewElement[];
  /** id 기반 O(1) 조회용 read model (provider가 elements와 함께 빌드) */
  elementsById: ReadonlyMap<string, PreviewElement>;
  /** parent_id 기반 자식 조회 read model — canonical source order 보존 */
  childrenByParent: ReadonlyMap<string, readonly PreviewElement[]>;
  /** element props 업데이트 함수 */
  updateElementProps: (id: string, props: Record<string, unknown>) => void;
  /** 여러 element props를 한 번에 업데이트 (단일 commit, group 자식 sync 등) */
  batchUpdateElementProps: (
    updates: Array<{ id: string; props: Record<string, unknown> }>,
  ) => void;
  /** elements 전체 교체 함수 */
  setElements: (elements: PreviewElement[]) => void;
  /** 재귀 렌더링 함수 */
  renderElement: (el: PreviewElement, key?: string) => ReactNode;
  /** 프로젝트 ID (optional) */
  projectId?: string;
  /** 편집 모드 */
  editMode?: "page" | "layout";
  /** 런타임 서비스 (DI) */
  services?: RuntimeServices;
  /**
   * ADR-148 Phase 0 — ListBox 행 template 의 slot 구성 (origin 문서 자식에서 파생).
   * 표준 ListBox instance 는 anchor-less bare ref 라 renderer 가 childrenByParent 로
   * Components 페이지 origin 에 접근할 수 없다 — provider(Preview App)가 문서에서
   * 1회 계산해 주입한다 (builder projection resolveListBoxTemplateOriginId 와 대칭).
   * null/미주입 = legacy 문서 → 렌더러는 기존 flat-props 동작.
   */
  listBoxTemplateSlotComposition?: SlotComposition | null;
  /**
   * ADR-214 Phase 3 — collection 행 템플릿 소스 (`{label} — {{ userName }}`) 의 `{{ }}` 를
   * 런타임 값으로 해석한다 (소유자 = collection 요소 id, 가시성 사슬은 그 요소 기준). provider
   * (Preview App · publish) 가 주입; 미주입 = 원문 (Canvas 는 scene builder 가 기본값 env 로 같은
   * 일을 한다). `{field}` 보간보다 먼저 돈다 (순서 규약).
   */
  resolveStateText?: (text: string, ownerElementId: string) => string;
  /**
   * ListBox 행 template origin 의 root style (2026-07-20, Selected variant 배선).
   *
   * provider(Preview App)가 문서에서 master `slot` 등록을 해석해 주입:
   * - `base`: default origin(`slot[0]`) 의 `props.style` — 모든 행에 적용.
   * - `selected`: Selected variant origin(`metadata.variant==="selected"`, fallback `slot[1]`)
   *   의 `props.style` — `data-selected` 행에만 overlay.
   *
   * builder Skia projection(appendListBoxRowProjection 의 templateAnchorStyle +
   * selectedOriginStyle overlay)과 대칭. null/미주입 = legacy → catalog CSS base 만.
   */
  listBoxRowTemplateStyles?: {
    base: Record<string, unknown> | null;
    selected: Record<string, unknown> | null;
  } | null;
  /**
   * ADR-148 Phase 4 — GridListItem 카드 template 의 slot 구성 (ListBox 동형,
   * origin `component-gridlist-item-default` 자식에서 파생).
   */
  gridListTemplateSlotComposition?: SlotComposition | null;
  /**
   * ADR-148 Phase 4 — MenuItem 의 slot 구성 (ListBox 동형, origin
   * `component-menu-item-default` 자식에서 파생 — icon/label/shortcut/description).
   */
  menuItemTemplateSlotComposition?: SlotComposition | null;
  /**
   * ADR-229 Phase 1 — TagGroup chip item template (origin `component-tag-item-default` / `-selected`,
   * master `component-taggroup` 의 TagList 자식 `slot` 에서 해석). provider (Preview App) 가 문서에서
   * 계산해 주입하고 `renderTagGroup` → `TagGroup` 이 chip 마다 적용한다:
   * - `composition` / `selectedComposition`: slot 구성 (icon · avatar · label 존재 gating + slot style).
   * - `rootStyles.base` / `.selected`: chip inline style (root style 에서 저작 layout 키 제외 + label
   *   typography fold — `resolveItemTemplateChipStyle`). selected 는 `data-selected` chip 에만 overlay.
   * builder Skia projection (`appendTagRowProjection`) 과 D3 대칭. null/미주입 = legacy → 기존 동작.
   */
  tagTemplate?: TagItemTemplate | null;
  /**
   * ADR-233 Phase 1 — Tabs 의 Tab 항목 template (origin `component-tab-item-default` / `-selected`,
   * master `component-tabs` root `slot` 에서 해석). `renderTabs` 가 Tab 마다 `rootStyles.base` 를,
   * RAC `isSelected` Tab 에 `rootStyles.selected` 를 overlay 한다 (Tag chip 과 같은 형태 · 같은 shared
   * `resolveItemTemplateChipStyle`). builder Skia `appendTabRowProjection` 과 D3 대칭. null = 기존 Tab.
   */
  tabTemplate?: TagItemTemplate | null;
  /**
   * ADR-233 round 3 m2 — Tabs 마다 자기 slot 의 template 을 고른다 (builder `resolveTabTemplateOriginIds`
   * 와 같은 규칙: ref instance 는 master (`_resolvedFrom`) 의 slot, 문서 Tabs 는 자기 slot, 없으면 표준
   * origin 상수). 렌더러 (`CanonicalNodeRenderer`) 가 Tabs 노드마다 불러 `tabTemplate` 을 바꿔 넘긴다.
   */
  resolveTabTemplate?: (owner: {
    slot?: unknown;
    _resolvedFrom?: string;
  }) => TagItemTemplate | null;
}

/** ADR-229 Phase 1 — Tag chip item template 의 DOM 소비 형태 (renderContext → TagGroup prop). */
export interface TagItemTemplate {
  composition: SlotComposition | null;
  selectedComposition: SlotComposition | null;
  rootStyles: {
    base: Record<string, unknown> | null;
    selected: Record<string, unknown> | null;
  };
}

// ============================================
// Renderer Types
// ============================================

/**
 * 렌더 함수 타입
 */
export type RenderFunction = (
  element: PreviewElement,
  context: RenderContext,
) => ReactNode;

/**
 * 컴포넌트 렌더러 인터페이스
 */
export interface ComponentRenderer {
  canRender(type: string): boolean;
  render(element: PreviewElement, context: RenderContext): ReactNode;
}

/**
 * 렌더러 맵 타입
 */
export type RendererMap = Record<string, RenderFunction>;

/**
 * 이벤트 핸들러 맵 타입 — 요소 하나가 렌더 시 받을 트리거 callback 묶음.
 *
 * **이 형태의 유일 정의처다**. 종전에는 같은 형태가 세 곳에 각자 적혀 있었고
 * (`RuntimeServices.createEventHandlerMap` 반환형 인라인 / preview `types/index.ts` /
 * builder legacy `events.types.ts`), legacy 쪽 하나가 이미 혼자 다른 형태
 * (`(context: EventContext) => Promise<EventExecutionResult>`)로 갈려 있었다.
 * 형태를 다시 적지 말고 이 별칭을 가리킬 것 — preview 쪽 소비자는
 * `import("@composition/shared/types").EventHandlerMap` (같은 파일의
 * `RuntimeServices` 참조와 동일 어법).
 */
export type EventHandlerMap = Record<string, (e: Event) => void>;
