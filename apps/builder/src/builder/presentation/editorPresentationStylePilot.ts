import {
  editorPresentationCanonicalRuntimeOptions,
  getEditorPresentationTargetNode,
  resolveEditorPresentationTarget,
} from "./editorPresentationCommitAdapter";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import type {
  EditorMutationPropagation,
  EditorPresentationTargetRef,
} from "./editorPresentationTypes";
import { isTextColorPresentationType } from "./editorPresentationTextColor";
import { parsePresentationOpacity } from "./editorPresentationOpacity";
import { parseBoxShadowEffects } from "../workspace/canvas/styleConversion/styleConverter";
import { getSkiaNode } from "../workspace/canvas/skia/useSkiaNode";

const STYLE_PILOT_QUERY_PARAM = "adr187FillPilot";

export interface BorderColorPresentationPilotTarget {
  readonly projectId: string;
  readonly style: Readonly<Record<string, unknown>>;
  readonly target: EditorPresentationTargetRef;
}

export interface BoxShadowPresentationPilotTarget {
  readonly projectId: string;
  readonly style: Readonly<Record<string, unknown>>;
  readonly target: EditorPresentationTargetRef;
}

export interface TextColorPresentationPilotTarget {
  readonly projectId: string;
  readonly propagation: EditorMutationPropagation;
  readonly style: Readonly<Record<string, unknown>>;
  readonly target: EditorPresentationTargetRef;
}

export interface OpacityPresentationPilotTarget {
  readonly projectId: string;
  readonly style: Readonly<Record<string, unknown>>;
  readonly target: EditorPresentationTargetRef;
}

export function isStylePresentationPilotEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    new URLSearchParams(window.location.search).get(STYLE_PILOT_QUERY_PARAM) !==
    "0"
  );
}

export function resolveBorderColorPresentationPilotTarget(
  selectedElementId: string | null,
): BorderColorPresentationPilotTarget | null {
  if (!isStylePresentationPilotEnabled() || !selectedElementId) return null;

  const state = useCanonicalDocumentStore.getState();
  const projectId = state.currentProjectId;
  if (!projectId || !state.documents.has(projectId)) return null;

  const target = resolveEditorPresentationTarget(projectId, selectedElementId);
  if (
    !target ||
    !editorPresentationCanonicalRuntimeOptions.hasTarget(projectId, target)
  ) {
    return null;
  }
  const element = getEditorPresentationTargetNode(projectId, target);
  if (!element) return null;
  const style = editorPresentationCanonicalRuntimeOptions.readTargetValue(
    projectId,
    target,
    "style-border-color",
  );
  if (!style || typeof style !== "object" || Array.isArray(style)) return null;
  const styleRecord = style as Record<string, unknown>;
  if (styleRecord.borderStyle === "none") return null;
  if (!("borderColor" in styleRecord) && !("borderWidth" in styleRecord)) {
    return null;
  }
  return { projectId, style: styleRecord, target };
}

export function resolveBoxShadowPresentationPilotTarget(
  selectedElementId: string | null,
): BoxShadowPresentationPilotTarget | null {
  if (!isStylePresentationPilotEnabled() || !selectedElementId) return null;

  const state = useCanonicalDocumentStore.getState();
  const projectId = state.currentProjectId;
  if (!projectId || !state.documents.has(projectId)) return null;

  const target = resolveEditorPresentationTarget(projectId, selectedElementId);
  if (
    !target ||
    !editorPresentationCanonicalRuntimeOptions.hasTarget(projectId, target)
  ) {
    return null;
  }
  const element = getEditorPresentationTargetNode(projectId, target);
  if (!element) return null;
  const style = editorPresentationCanonicalRuntimeOptions.readTargetValue(
    projectId,
    target,
    "style-box-shadow",
  );
  if (!style || typeof style !== "object" || Array.isArray(style)) return null;
  const styleRecord = style as Record<string, unknown>;
  const boxShadow = styleRecord.boxShadow;
  if (
    typeof boxShadow !== "string" ||
    boxShadow === "" ||
    boxShadow === "none" ||
    parseBoxShadowEffects(boxShadow).length === 0
  ) {
    return null;
  }
  return { projectId, style: styleRecord, target };
}

/**
 * Text color pilot is intentionally restricted to nodes whose own Skia
 * materialization owns text targets. Button is the first component-root slice;
 * Button may opt into the inherited-subtree projection lane. The projection
 * index only includes descendants without an own color declaration.
 */
export function resolveTextColorPresentationPilotTarget(
  selectedElementId: string | null,
): TextColorPresentationPilotTarget | null {
  if (!isStylePresentationPilotEnabled() || !selectedElementId) return null;

  const state = useCanonicalDocumentStore.getState();
  const projectId = state.currentProjectId;
  if (!projectId || !state.documents.has(projectId)) return null;

  const target = resolveEditorPresentationTarget(projectId, selectedElementId);
  if (
    !target ||
    !editorPresentationCanonicalRuntimeOptions.hasTarget(projectId, target)
  ) {
    return null;
  }
  const element = getEditorPresentationTargetNode(projectId, target);
  if (!element || !isTextColorPresentationType(element.type)) return null;
  const style = editorPresentationCanonicalRuntimeOptions.readTargetValue(
    projectId,
    target,
    "style-text-color",
  );
  if (!style || typeof style !== "object" || Array.isArray(style)) return null;
  return {
    projectId,
    propagation: element.type === "Button" ? "inherited-subtree" : "self",
    style: style as Record<string, unknown>,
    target,
  };
}

/**
 * 명시적 unitless opacity만 연속 paint lane을 연다. 기존 Skia opacity effect가
 * 없는 명시적 1은 StoreRenderBridge가 presentation 소유 중에만 transient effect를
 * materialize하고, 상속/상태 opacity는 이 target resolver에 도달하지 않는다.
 */
export function resolveOpacityPresentationPilotTarget(
  selectedElementId: string | null,
): OpacityPresentationPilotTarget | null {
  if (!isStylePresentationPilotEnabled() || !selectedElementId) return null;

  const state = useCanonicalDocumentStore.getState();
  const projectId = state.currentProjectId;
  if (!projectId || !state.documents.has(projectId)) return null;

  const target = resolveEditorPresentationTarget(projectId, selectedElementId);
  if (
    !target ||
    !editorPresentationCanonicalRuntimeOptions.hasTarget(projectId, target)
  ) {
    return null;
  }
  const element = getEditorPresentationTargetNode(projectId, target);
  if (!element) return null;
  // ref-descendant style overrides do not have an atomic opacity effect
  // provenance contract yet. Keep them on the canonical commit path until
  // the projection index can prove the corresponding descendant effect slot.
  if (target.kind !== "canonical-node") return null;
  const elementProps = element.props;
  if (elementProps && typeof elementProps === "object") {
    const props = elementProps as Record<string, unknown>;
    // buildSpecNodeData derives disabled state with Boolean(), so truthy
    // legacy values such as the string "false" must also fail closed here.
    if (Boolean(props.isDisabled) || Boolean(props.disabled)) return null;
  }
  const style = editorPresentationCanonicalRuntimeOptions.readTargetValue(
    projectId,
    target,
    "style-opacity",
  );
  if (!style || typeof style !== "object" || Array.isArray(style)) return null;
  const styleRecord = style as Record<string, unknown>;
  const opacity = parsePresentationOpacity(styleRecord.opacity);
  if (opacity === null) return null;
  if (opacity === 1) {
    // A state/disabled opacity is materialized as a separate effect even when
    // the explicit style value is 1. Only a typed state-only stack may enter
    // transient materialization; legacy/animation/style effects fail closed.
    const skiaNode = getSkiaNode(target.nodeId);
    if (
      !skiaNode ||
      skiaNode.effects?.some(
        (effect) => effect.type === "opacity" && effect.source !== "state",
      )
    ) {
      return null;
    }
  } else {
    // For an explicit style opacity < 1, a generated style slot is required
    // when another provenance is already present. This prevents a stale
    // state/animation/legacy effect from being mistaken for the style slot.
    const opacityEffects = getSkiaNode(target.nodeId)?.effects?.filter(
      (effect) => effect.type === "opacity",
    );
    if (
      opacityEffects?.some(
        (effect) => effect.source !== "style" && effect.source !== "state",
      ) ||
      (opacityEffects?.some((effect) => effect.source === "state") &&
        !opacityEffects.some((effect) => effect.source === "style"))
    ) {
      return null;
    }
  }
  return { projectId, style: styleRecord, target };
}
