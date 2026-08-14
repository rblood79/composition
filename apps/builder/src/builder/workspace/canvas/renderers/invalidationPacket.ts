import type { Layout } from "../../../../types/builder/layout.types";
import type { FlashAnimationState, GeneratingEffectState } from "../skia/types";
import type {
  DataSourceEdge,
  LayoutGroup,
  WorkflowEdge,
} from "../skia/workflowEdges";

export interface RendererSelectionInvalidationInput {
  currentPageId: string | null;
  editingContextId: string | null;
  selectedElementId: string | null;
  selectedElementIds: string[];
}

export interface RendererSelectionInvalidation extends RendererSelectionInvalidationInput {
  editingSignature: string;
  selectionSignature: string;
}

export interface RendererWorkflowInvalidationInput {
  dataSourceEdges: DataSourceEdge[];
  focusedPageId: string | null;
  layoutGroups: LayoutGroup[];
  layouts: Layout[];
  showDataSources: boolean;
  showEvents: boolean;
  showLayoutGroups: boolean;
  showNavigation: boolean;
  showOverlay: boolean;
  straightEdges: boolean;
  workflowEdges: WorkflowEdge[];
}

export interface RendererWorkflowInvalidation extends RendererWorkflowInvalidationInput {
  graphSignature: string;
  overlaySignature: string;
  subToggleSignature: string;
}

export interface RendererAIInvalidation {
  cleanupExpiredFlashes: (currentTime: number) => void;
  flashAnimations: Map<string, FlashAnimationState>;
  generatingNodes: Map<string, GeneratingEffectState>;
}

/**
 * ADR-074 Phase 3: scene/overlay 분리.
 * - Scene: workflow (scene structure 의존, selection-invariant)
 * - Overlay: ai + dragActive + selection (selection/transient 의존)
 *
 * 2026-08-14: grid sub-packet 제거 (캔버스 월드 격자 삭제와 동반).
 */
export interface RendererSceneInvalidationInput {
  workflow: RendererWorkflowInvalidationInput;
}

export interface RendererSceneInvalidation {
  /**
   * 캔버스 월드 격자 제거(2026-08-14)의 tombstone — 시그니처가 상수라 무효화를
   * 유발하지 않는다. 유일 소비처(`SkiaCanvas` 의 grid 시그니처 비교)와 함께
   * 지우는 것이 맞지만, 그 파일이 다른 작업으로 편집 중이라 분리했다.
   */
  grid: { signature: string };
  workflow: RendererWorkflowInvalidation;
}

/** 격자가 없으므로 영구 불변 — 위 tombstone 과 함께 제거 대상 */
const REMOVED_GRID_INVALIDATION: RendererSceneInvalidation["grid"] = {
  signature: "",
};

export interface RendererOverlayInvalidationInput {
  ai: RendererAIInvalidation;
  dragActive: boolean;
  selection: RendererSelectionInvalidationInput;
}

export interface RendererOverlayInvalidation {
  ai: RendererAIInvalidation;
  dragActive: boolean;
  selection: RendererSelectionInvalidation;
}

export interface RendererInvalidationPacketInput
  extends RendererSceneInvalidationInput, RendererOverlayInvalidationInput {}

export interface RendererInvalidationPacket
  extends RendererSceneInvalidation, RendererOverlayInvalidation {}

function hashSignature(input: string): string {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function buildSelectionSignature(
  selection: RendererSelectionInvalidationInput,
): string {
  return hashSignature(
    [
      selection.currentPageId ?? "",
      selection.selectedElementId ?? "",
      selection.selectedElementIds.join(","),
    ].join("|"),
  );
}

function buildWorkflowEdgeSignature(edges: WorkflowEdge[]): string {
  return edges
    .map((edge) =>
      [
        edge.id,
        edge.type,
        edge.sourcePageId,
        edge.targetPageId,
        edge.sourceElementId ?? "",
        edge.label ?? "",
      ].join(":"),
    )
    .join("|");
}

function buildDataSourceEdgeSignature(edges: DataSourceEdge[]): string {
  return edges
    .map((edge) =>
      [
        edge.id,
        edge.sourceType,
        edge.name,
        edge.boundElements
          .map((binding) =>
            [binding.pageId, binding.elementId, binding.elementTag].join(":"),
          )
          .join(","),
      ].join(":"),
    )
    .join("|");
}

function buildLayoutGroupSignature(groups: LayoutGroup[]): string {
  return groups
    .map((group) =>
      [group.layoutId, group.layoutName, group.pageIds.join(",")].join(":"),
    )
    .join("|");
}

function buildLayoutSignature(layouts: Layout[]): string {
  return layouts
    .map((layout) =>
      [
        layout.id,
        layout.name,
        layout.slug ?? "",
        layout.notFoundPageId ?? "",
        layout.inheritNotFound === false ? 0 : 1,
      ].join(":"),
    )
    .join("|");
}

function buildWorkflowGraphSignature(
  workflow: RendererWorkflowInvalidationInput,
): string {
  return hashSignature(
    [
      buildWorkflowEdgeSignature(workflow.workflowEdges),
      buildDataSourceEdgeSignature(workflow.dataSourceEdges),
      buildLayoutGroupSignature(workflow.layoutGroups),
      buildLayoutSignature(workflow.layouts),
    ].join("||"),
  );
}

/**
 * ADR-074 Phase 3: scene sub-packet (workflow).
 * selection-invariant — selection 변화 시 identity 유지 목표.
 */
export function createSceneInvalidationPacket(
  input: RendererSceneInvalidationInput,
): RendererSceneInvalidation {
  return {
    grid: REMOVED_GRID_INVALIDATION,
    workflow: {
      ...input.workflow,
      graphSignature: buildWorkflowGraphSignature(input.workflow),
      overlaySignature: input.workflow.showOverlay ? "1" : "0",
      subToggleSignature: [
        input.workflow.showNavigation ? 1 : 0,
        input.workflow.showEvents ? 1 : 0,
        input.workflow.showDataSources ? 1 : 0,
        input.workflow.showLayoutGroups ? 1 : 0,
        input.workflow.straightEdges ? 1 : 0,
      ].join(":"),
    },
  };
}

/**
 * ADR-074 Phase 3: overlay sub-packet (ai + dragActive + selection).
 * selection-dependent — selection 변화 시 재생성.
 */
export function createOverlayInvalidationPacket(
  input: RendererOverlayInvalidationInput,
): RendererOverlayInvalidation {
  return {
    ai: input.ai,
    dragActive: input.dragActive,
    selection: {
      ...input.selection,
      editingSignature: input.selection.editingContextId ?? "",
      selectionSignature: buildSelectionSignature(input.selection),
    },
  };
}

/**
 * 기존 호출처 호환용 합성 entry point.
 * scene + overlay 각각 계산한 뒤 병합하여 기존 packet 형태로 반환.
 */
export function createRendererInvalidationPacket(
  packet: RendererInvalidationPacketInput,
): RendererInvalidationPacket {
  const scene = createSceneInvalidationPacket({
    workflow: packet.workflow,
  });
  const overlay = createOverlayInvalidationPacket({
    ai: packet.ai,
    dragActive: packet.dragActive,
    selection: packet.selection,
  });
  return {
    ...scene,
    ...overlay,
  };
}
