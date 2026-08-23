import type { CompositionDocument } from "@composition/shared";

import type {
  EditorMutationDescriptor,
  EditorPresentationTargetRef,
} from "./editorPresentationTypes";

export interface UpdateCanonicalDocumentMessage {
  readonly type: "UPDATE_CANONICAL_DOCUMENT";
  readonly projectId: string | null;
  readonly documentRevision: number;
  readonly document: CompositionDocument | null;
}

export interface EditorPresentationPatchMessage {
  readonly type: "EDITOR_PRESENTATION_PATCH";
  readonly projectId: string;
  readonly sessionId: string;
  readonly revision: number;
  readonly baseDocumentRevision: number;
  readonly mutations: readonly EditorMutationDescriptor[];
}

export interface EditorPresentationFinishMessage {
  readonly type: "EDITOR_PRESENTATION_FINISH";
  readonly projectId: string;
  readonly sessionId: string;
  readonly revision: number;
  readonly committedDocumentRevision: number;
  readonly finalMutations: readonly EditorMutationDescriptor[];
}

export interface EditorPresentationCancelMessage {
  readonly type: "EDITOR_PRESENTATION_CANCEL";
  readonly projectId: string;
  readonly sessionId: string;
  readonly revision: number;
}

export type EditorPresentationProtocolMessage =
  | EditorPresentationPatchMessage
  | EditorPresentationFinishMessage
  | EditorPresentationCancelMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPlainCloneData(
  value: unknown,
  seen = new WeakSet<object>(),
): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "undefined") return true;
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  let valid = true;
  if (Array.isArray(value)) {
    valid = value.every((entry) => isPlainCloneData(entry, seen));
  } else if (!isRecord(value)) {
    valid = false;
  } else {
    valid = Object.values(value).every((entry) =>
      isPlainCloneData(entry, seen),
    );
  }
  // `seen` is an ancestor set, not a global visited set. Structured-clone data
  // may legally share an object reference in two sibling fields; only a cycle
  // must be rejected at this protocol boundary.
  seen.delete(value);
  return valid;
}

function isSemanticTarget(
  value: unknown,
): value is EditorPresentationTargetRef {
  if (!isRecord(value)) return false;
  if (value.kind === "canonical-node") {
    return (
      isNonEmptyString(value.nodeId) &&
      !value.nodeId.includes("/") &&
      !value.nodeId.startsWith("projection:")
    );
  }
  if (value.kind !== "ref-descendant") return false;
  return (
    isNonEmptyString(value.refId) &&
    !value.refId.includes("/") &&
    !value.refId.startsWith("projection:") &&
    isNonEmptyString(value.pathKey) &&
    !value.pathKey.startsWith("projection:")
  );
}

function isMutationDescriptor(
  value: unknown,
): value is EditorMutationDescriptor {
  if (!isRecord(value) || !isSemanticTarget(value.target)) return false;
  switch (value.type) {
    case "fills.replace":
      return Array.isArray(value.fills) && isPlainCloneData(value.fills);
    case "style.patch":
      return (
        (value.propagation === undefined ||
          value.propagation === "self" ||
          value.propagation === "inherited-subtree") &&
        isRecord(value.patch) &&
        isPlainCloneData(value.patch)
      );
    case "geometry.patch":
      return isRecord(value.patch) && isPlainCloneData(value.patch);
    case "structure.patch":
      return isRecord(value.operation) && isPlainCloneData(value.operation);
    default:
      return false;
  }
}

function isMutationList(
  value: unknown,
): value is readonly EditorMutationDescriptor[] {
  return Array.isArray(value) && value.every(isMutationDescriptor);
}

export function isUpdateCanonicalDocumentMessage(
  value: unknown,
): value is UpdateCanonicalDocumentMessage {
  return (
    isRecord(value) &&
    value.type === "UPDATE_CANONICAL_DOCUMENT" &&
    (value.projectId === null || isNonEmptyString(value.projectId)) &&
    isRevision(value.documentRevision) &&
    (value.document === null ||
      (isRecord(value.document) && isPlainCloneData(value.document)))
  );
}

export function isEditorPresentationProtocolMessage(
  value: unknown,
): value is EditorPresentationProtocolMessage {
  if (!isRecord(value) || !isNonEmptyString(value.projectId)) return false;
  if (!isNonEmptyString(value.sessionId) || !isRevision(value.revision)) {
    return false;
  }
  switch (value.type) {
    case "EDITOR_PRESENTATION_PATCH":
      return (
        isRevision(value.baseDocumentRevision) &&
        isMutationList(value.mutations)
      );
    case "EDITOR_PRESENTATION_FINISH":
      return (
        isRevision(value.committedDocumentRevision) &&
        isMutationList(value.finalMutations)
      );
    case "EDITOR_PRESENTATION_CANCEL":
      return true;
    default:
      return false;
  }
}
