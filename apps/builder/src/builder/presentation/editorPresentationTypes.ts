import type { FillItem } from "../../types/builder/fill.types";

export type EditorInvalidationKind = "paint" | "layout" | "structure";

export type EditorPresentationTargetRef =
  | {
      readonly kind: "canonical-node";
      readonly nodeId: string;
    }
  | {
      readonly kind: "ref-descendant";
      readonly pathKey: string;
      readonly refId: string;
    };

export type EditorPresentationTargetKey = string;
export type EditorPresentationScopedTargetKey = string;

export type EditorStructureOperationType =
  "add" | "remove" | "reparent" | "order" | "ref" | "slot";

export interface EditorStructureOperation {
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly type: EditorStructureOperationType;
}

export type EditorMutationDescriptor =
  | {
      readonly fills: readonly FillItem[];
      readonly target: EditorPresentationTargetRef;
      readonly type: "fills.replace";
    }
  | {
      readonly patch: Readonly<Record<string, unknown>>;
      readonly target: EditorPresentationTargetRef;
      readonly type: "style.patch";
    }
  | {
      readonly patch: Readonly<Record<string, unknown>>;
      readonly target: EditorPresentationTargetRef;
      readonly type: "geometry.patch";
    }
  | {
      readonly operation: EditorStructureOperation;
      readonly target: EditorPresentationTargetRef;
      readonly type: "structure.patch";
    };

export interface ClassifiedEditorMutation {
  readonly affectedLayoutRoots: readonly string[];
  readonly affectedTargets: readonly EditorPresentationTargetRef[];
  readonly descriptor: EditorMutationDescriptor;
  readonly invalidation: EditorInvalidationKind;
}

/**
 * Presentation frame에서 canonical/store version과 분리해 소비하는 lane 신호.
 *
 * layout/structure mutation도 먼저 paint target을 갱신할 수 있어
 * `paintTargets`에는 모든 active presentation target이 포함된다. layout과
 * structure는 각각의 root 집합과 revision으로만 승격된다.
 */
export interface EditorPresentationInvalidation {
  readonly paintTargets: ReadonlySet<EditorPresentationTargetKey>;
  readonly layoutRoots: ReadonlySet<string>;
  readonly structureRoots: ReadonlySet<string>;
  readonly paintRevision: number;
  readonly layoutRevision: number;
  readonly structureRevision: number;
}

export type EditorPresentationSessionStatus = "active" | "closing" | "failed";

export interface EditorPresentationSession {
  readonly applied: ClassifiedEditorMutation | null;
  readonly baseDocumentVersion: number;
  readonly baseValues: ReadonlyMap<EditorPresentationTargetKey, unknown>;
  readonly commitIntent: string;
  readonly ownerId: string;
  readonly pending: EditorMutationDescriptor | null;
  readonly projectId: string;
  readonly revision: number;
  readonly sessionId: string;
  readonly status: EditorPresentationSessionStatus;
  readonly targets: readonly EditorPresentationTargetRef[];
}

export interface EditorPresentationSnapshot {
  readonly overlaysByTarget: ReadonlyMap<
    EditorPresentationScopedTargetKey,
    readonly ClassifiedEditorMutation[]
  >;
  readonly invalidation: EditorPresentationInvalidation;
  readonly sessions: ReadonlyMap<string, EditorPresentationSession>;
  readonly version: number;
}

export type EditorPresentationCancelReason =
  | "pointer-cancel"
  | "escape"
  | "blur"
  | "unmount"
  | "selection-change"
  | "document-replace"
  | "conflict"
  | "superseded"
  | "iframe-reload";

export type EditorPresentationFinishResult =
  | {
      readonly committedDocumentRevision: number;
      readonly status: "committed";
    }
  | {
      readonly status: "no-op";
    }
  | {
      readonly reason: EditorPresentationCancelReason;
      readonly status: "cancelled";
    }
  | {
      readonly error: unknown;
      readonly status: "failed";
    };

export interface EditorPresentationHandle {
  readonly sessionId: string;
  cancel(reason: EditorPresentationCancelReason): boolean;
  finish(
    finalDescriptor?: EditorMutationDescriptor,
  ): EditorPresentationFinishResult;
  publish(descriptor: EditorMutationDescriptor): boolean;
}

export interface BeginEditorPresentationInput {
  readonly commitIntent: string;
  readonly initialDescriptor?: EditorMutationDescriptor;
  readonly ownerId: string;
  readonly projectId: string;
  readonly targets: readonly EditorPresentationTargetRef[];
}

export function toEditorPresentationTargetKey(
  target: EditorPresentationTargetRef,
): EditorPresentationTargetKey {
  if (target.kind === "canonical-node") {
    return `canonical-node:${encodeURIComponent(target.nodeId)}`;
  }
  return `ref-descendant:${encodeURIComponent(target.refId)}:${encodeURIComponent(
    target.pathKey,
  )}`;
}

export function toEditorPresentationScopedTargetKey(
  projectId: string,
  target: EditorPresentationTargetRef,
): EditorPresentationScopedTargetKey {
  return `${encodeURIComponent(projectId)}|${toEditorPresentationTargetKey(
    target,
  )}`;
}

export function getEditorPresentationLayoutRoot(
  target: EditorPresentationTargetRef,
): string {
  return target.kind === "canonical-node" ? target.nodeId : target.refId;
}
