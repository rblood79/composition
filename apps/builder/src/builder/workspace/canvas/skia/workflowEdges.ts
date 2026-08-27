/**
 * Workflow Edge Computation
 *
 * 캔버스 워크플로우 시각화를 위한 엣지 계산 로직.
 * 순수 함수로 구성되며 React/Zustand에 의존하지 않음.
 *
 * workflowStore.ts의 extractNavigationLinks / extractNavigationFromEvents 패턴을
 * 캔버스 렌더링용 독립 모듈로 추출한 것.
 */

import { getLegacyPageLayoutId } from "@/adapters/canonical";
import {
  isInteractionRule,
  type CompositionDocument,
  type FrameNode,
  type InteractionRule,
} from "@composition/shared";
import { TRIGGER_LABELS } from "../../../panels/interactions/labels";

// ============================================
// Types
// ============================================

export interface WorkflowEdge {
  id: string;
  type: "navigation" | "event-navigation";
  sourcePageId: string;
  targetPageId: string;
  sourceElementId?: string;
  label?: string;
}

/** 입력 페이지 최소 인터페이스 */
export interface WorkflowPageInput {
  id: string;
  title: string;
  slug: string;
}

/** 입력 요소 최소 인터페이스 */
export interface WorkflowElementInput {
  id: string;
  type: string;
  props: Record<string, unknown>;
  page_id?: string | null;
}

// ============================================
// Slug Normalization
// ============================================

/**
 * 슬러그를 정규화하여 비교 가능한 형태로 변환.
 *
 * - "/home?q=1#section" → "home"
 * - "/about/" → "about"
 * - null/undefined → ""
 * - 선행/후행 슬래시, 쿼리 파라미터, 해시 제거
 */
export function normalizeSlug(slug?: string | null): string {
  if (!slug) return "";
  return slug.split(/[?#]/)[0].replace(/^\/+/, "").replace(/\/+$/, "");
}

// ============================================
// Internal Helpers
// ============================================

/** navigable 태그인지 확인 (Link, a, Button - 대소문자 무시) */
function isNavigableTag(type: string): boolean {
  const lower = type.toLowerCase();
  return lower === "link" || lower === "a" || lower === "button";
}

/** props에서 href/to/path/url 등 내부 이동 경로 추출 */
function extractHrefFromProps(
  props: Record<string, unknown>,
): string | undefined {
  return (
    (props.href as string | undefined) ||
    (props.to as string | undefined) ||
    (props.path as string | undefined) ||
    (props.url as string | undefined) ||
    (props.link as { href?: string } | undefined)?.href
  );
}

/** 외부 링크 또는 앵커인지 확인 */
function isExternalOrAnchor(href: string): boolean {
  return href.startsWith("http") || href.startsWith("#");
}

// ============================================
// Core Computation
// ============================================

/**
 * 페이지 및 요소 데이터를 기반으로 워크플로우 엣지 목록을 계산.
 *
 * 1. Link/a/Button 요소의 href 기반 navigation 엣지
 * 2. 인터랙션 규칙(`navigate`) 기반 event-navigation 엣지
 *
 * 중복 엣지는 제거됨 (동일 source-target-type 조합).
 *
 * **규칙 출처 (ADR-158 Phase 4 이후)**: canonical `events` root collection 의
 * `InteractionRule[]`. 종전에는 요소의 legacy `props.events` / `element.events`
 * 를 읽었는데, ADR-158 Phase 1 에서 그 mirror 파생이 끊겨 **신규 규칙이 캔버스에
 * 한 건도 나타나지 않았다**. 반대로 구 문서에 남은 entry 는 실행 경로가 없어
 * (패널 삭제 + `isInteractionRule` 필터) 그리면 **일어나지 않을 이동을 그리는
 * 셈**이라, legacy 갈래는 되살리지 않고 걷어냈다.
 */
export function computeWorkflowEdges(
  pages: WorkflowPageInput[],
  elements: WorkflowElementInput[],
  rules: readonly InteractionRule[] = [],
): WorkflowEdge[] {
  // slug → pageId 매핑 (정규화된 슬러그 사용)
  const slugMap = new Map<string, string>();
  for (const page of pages) {
    const normalized = normalizeSlug(page.slug);
    if (normalized) {
      slugMap.set(normalized, page.id);
    }
  }

  // 중복 방지용 Set
  const seenEdges = new Set<string>();
  const edges: WorkflowEdge[] = [];

  function addEdge(edge: WorkflowEdge): void {
    if (seenEdges.has(edge.id)) return;
    seenEdges.add(edge.id);
    edges.push(edge);
  }

  // 페이지 ID Set (유효성 검증용)
  const pageIdSet = new Set(pages.map((p) => p.id));

  for (const element of elements) {
    const sourcePageId = element.page_id;
    if (!sourcePageId || !pageIdSet.has(sourcePageId)) continue;

    // 1) Link/a/Button 요소의 href 기반 navigation 엣지
    if (isNavigableTag(element.type)) {
      const href = extractHrefFromProps(element.props);
      if (href && !isExternalOrAnchor(href)) {
        const cleanHref = normalizeSlug(href);
        const targetPageId = slugMap.get(cleanHref);
        if (targetPageId && targetPageId !== sourcePageId) {
          addEdge({
            id: `${element.id}-${targetPageId}-navigation`,
            type: "navigation",
            sourcePageId,
            targetPageId,
            sourceElementId: element.id,
            label: "Link",
          });
        }
      }
    }
  }

  // 2) 인터랙션 규칙 기반 navigation 엣지.
  //
  // 규칙은 요소가 아니라 root collection 에 있으므로 요소 순회와 분리한다 —
  // 규칙이 가리키는 요소가 삭제됐을 수도 있어 조회로 확인해야 한다.
  const elementById = new Map(elements.map((el) => [el.id, el]));

  for (const rule of rules) {
    // 타입은 `InteractionRule[]` 이지만 구 문서에는 `SerializedEvent` entry 가
    // 남아 있을 수 있다 — 그쪽은 `action` 필드 자체가 없어(`actionRef` 참조 방식)
    // 가드 없이 읽으면 캔버스가 통째로 죽는다. 실행 쪽(`bindings.ts`)과 같은
    // 판정으로 걸러낸다.
    if (!isInteractionRule(rule)) continue;
    if (rule.action.kind !== "navigate") continue;

    const path = rule.action.params?.path;
    if (!path || isExternalOrAnchor(path)) continue;

    const sourcePageId = elementById.get(rule.elementId)?.page_id;
    if (!sourcePageId || !pageIdSet.has(sourcePageId)) continue;

    const targetPageId = slugMap.get(normalizeSlug(path));
    if (!targetPageId || targetPageId === sourcePageId) continue;

    addEdge({
      id: `${rule.elementId}-${targetPageId}-event-navigation`,
      type: "event-navigation",
      sourcePageId,
      targetPageId,
      sourceElementId: rule.elementId,
      // 패널과 같은 어휘를 쓴다 — 캔버스에 "onPress", 패널에 "누를 때" 가
      // 뜨면 같은 것을 두 이름으로 부르는 셈이다.
      label: TRIGGER_LABELS[rule.trigger] ?? rule.trigger,
    });
  }

  return edges;
}

// ============================================
// Data Source Edge Types & Computation
// ============================================

export interface DataSourceEdge {
  id: string;
  sourceType: "dataTable" | "api" | "supabase" | "mock";
  name: string;
  boundElements: Array<{
    elementId: string;
    elementTag: string;
    pageId: string;
  }>;
}

export interface LayoutGroup {
  layoutId: string;
  layoutName: string;
  pageIds: string[];
}

/**
 * ADR-111 P3-β: reusable frame 캔버스 영역 그룹.
 *
 * `LayoutGroup` (page sharing metadata) 와 의미적으로 분리.
 * frame body 가 캔버스에 그려질 viewport 영역 정보 (P3-δ Skia render 통합 입력).
 */
export interface FrameAreaGroup {
  /** legacy layoutId (FrameNode.metadata.layoutId 우선, fallback FrameNode.id) — legacy CRUD 와 정합 */
  frameId: string;
  /** 사용자 가시 이름 (FrameNode.name ?? frameId) */
  frameName: string;
  /** 캔버스 viewport 좌표 (framePositions[frameId].x, miss 시 0) */
  x: number;
  y: number;
  /** 캔버스 viewport 크기 (framePositions[frameId].width/height, miss 시 0) */
  width: number;
  height: number;
}

/**
 * 요소의 데이터 바인딩을 분석하여 데이터 소스 엣지 목록을 계산.
 *
 * 두 가지 바인딩 형식을 지원:
 * A) PropertyDataBinding: { source, name } → dataTable | api
 * B) Full DataBinding: { type, config } → mock | supabase | api
 *
 * 동일 데이터 소스 ID의 바인딩은 하나로 합산됨 (boundElements 병합).
 */
export function computeDataSourceEdges(
  elements: WorkflowElementInput[],
): DataSourceEdge[] {
  const dataSourceMap = new Map<string, DataSourceEdge>();

  for (const el of elements) {
    // props.dataBinding 에서 바인딩 정보를 추출
    const binding = el.props.dataBinding as Record<string, unknown> | undefined;
    if (!binding || typeof binding !== "object") continue;

    let sourceType: DataSourceEdge["sourceType"] | null = null;
    let name = "";
    let id = "";

    // A) PropertyDataBinding 형식: { source, name }
    if ("source" in binding && "name" in binding && binding.name) {
      const src = binding.source as string;
      if (src === "dataTable") {
        sourceType = "dataTable";
        name = binding.name as string;
        id = `dataTable-${name}`;
      } else if (src === "api") {
        sourceType = "api";
        name = binding.name as string;
        id = `api-${name}`;
      }
    }

    // B) Full DataBinding 형식: { type, config }
    if (!sourceType && "type" in binding && binding.config) {
      const config = binding.config as Record<string, unknown>;

      if (config.baseUrl === "MOCK_DATA") {
        sourceType = "mock";
        name = (config.endpoint as string) || "Mock Data";
        id = `mock-${name}`;
      } else if (binding.source === "supabase" && config.tableName) {
        sourceType = "supabase";
        name = config.tableName as string;
        id = `supabase-${name}`;
      } else if (binding.source === "api" && config.endpoint) {
        sourceType = "api";
        name = config.endpoint as string;
        id = `api-${name}`;
      }
    }

    if (!sourceType || !name) continue;

    const boundEntry = {
      elementId: el.id,
      elementTag: el.type,
      pageId: el.page_id || "",
    };

    const existing = dataSourceMap.get(id);
    if (existing) {
      existing.boundElements.push(boundEntry);
    } else {
      dataSourceMap.set(id, {
        id,
        sourceType,
        name,
        boundElements: [boundEntry],
      });
    }
  }

  return Array.from(dataSourceMap.values());
}

// ============================================
// Layout Group Computation
// ============================================

/**
 * 페이지들을 canonical reusable frame binding 기준으로 그룹화.
 *
 * active CompositionDocument 에서 page -> reusable frame ref 를 읽고 layouts
 * mirror 배열은 이름 lookup 에만 사용한다. legacy page binding fallback 은 direct
 * cutover 이후 유지하지 않는다.
 */
export function computeLayoutGroups(
  pages: WorkflowPageInput[],
  layouts: Array<{ id: string; name: string }>,
  doc?: CompositionDocument | null,
): LayoutGroup[] {
  const layoutNameMap = new Map<string, string>();
  for (const layout of layouts) {
    layoutNameMap.set(layout.id, layout.name);
  }

  const groupMap = new Map<string, string[]>();

  for (const page of pages) {
    const layoutId = getLegacyPageLayoutId({ id: page.id }, doc);
    if (!layoutId) continue;

    const existing = groupMap.get(layoutId);
    if (existing) {
      existing.push(page.id);
    } else {
      groupMap.set(layoutId, [page.id]);
    }
  }

  const groups: LayoutGroup[] = [];
  for (const [layoutId, pageIds] of groupMap) {
    const layoutName = layoutNameMap.get(layoutId) || layoutId;
    groups.push({ layoutId, layoutName, pageIds });
  }

  return groups;
}

// ============================================
// Frame Area Computation (ADR-111 P3-β)
// ============================================

/**
 * Canonical document 의 reusable FrameNode 들을 캔버스 영역 그룹으로 변환.
 *
 * - input doc 이 null/undefined → 빈 배열
 * - `doc.children` 에서 `type === "frame" && reusable === true` 만 필터
 * - id 정규화: `metadata.layoutId` (legacyToCanonical adapter 가 보존) 우선,
 *   부재 시 FrameNode.id 사용. canonical frame selection id 와 정합.
 * - 좌표/크기: `framePositions[frameId]` lookup, miss 시 `{0,0,0,0}` (P3-α 의 기본 동작과 동일)
 * - Frames tab UX: page multi-canvas 처럼 reusable frame 전체를 반환한다.
 *   선택 frame 하나로 제한하면 등록 layout 을 한 화면에서 비교할 수 없다.
 *
 * 본 함수는 P3-β scope: compute layer 만. BuilderCanvas / Skia render 통합은 P3-δ.
 */
export function computeFrameAreas(
  doc: CompositionDocument | null | undefined,
  framePositions: Record<
    string,
    { x: number; y: number; width: number; height: number }
  >,
  _selectedReusableFrameId: string | null = null,
): FrameAreaGroup[] {
  if (!doc) return [];

  const result: FrameAreaGroup[] = [];
  for (const child of doc.children) {
    if (child.type !== "frame") continue;
    const frame = child as FrameNode;
    if (frame.reusable !== true) continue;

    const layoutId = (frame.metadata as { layoutId?: string } | undefined)
      ?.layoutId;
    const frameId = layoutId ?? frame.id;

    const pos = framePositions[frameId] ?? { x: 0, y: 0, width: 0, height: 0 };

    result.push({
      frameId,
      frameName: frame.name ?? frameId,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
    });
  }
  return result;
}
