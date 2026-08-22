import {
  toEditorPresentationTargetKey,
  type ClassifiedEditorMutation,
  type EditorPresentationInvalidation,
  type EditorPresentationSession,
} from "./editorPresentationTypes";

const EMPTY_KEYS: ReadonlySet<string> = new Set();

export const EMPTY_EDITOR_PRESENTATION_INVALIDATION: EditorPresentationInvalidation =
  Object.freeze({
    paintTargets: EMPTY_KEYS,
    layoutRoots: EMPTY_KEYS,
    structureRoots: EMPTY_KEYS,
    paintRevision: 0,
    layoutRevision: 0,
    structureRevision: 0,
  });

function activeMutations(
  sessions: Iterable<EditorPresentationSession>,
): ClassifiedEditorMutation[] {
  const result: ClassifiedEditorMutation[] = [];
  for (const session of sessions) {
    if (session.applied) result.push(session.applied);
  }
  return result;
}

function collectLaneValues(
  mutations: readonly ClassifiedEditorMutation[],
): Pick<
  EditorPresentationInvalidation,
  "paintTargets" | "layoutRoots" | "structureRoots"
> {
  const paintTargets = new Set<string>();
  const layoutRoots = new Set<string>();
  const structureRoots = new Set<string>();

  for (const mutation of mutations) {
    for (const target of mutation.affectedTargets) {
      paintTargets.add(toEditorPresentationTargetKey(target));
    }
    if (
      mutation.invalidation === "layout" ||
      mutation.invalidation === "structure"
    ) {
      for (const root of mutation.affectedLayoutRoots) layoutRoots.add(root);
    }
    if (mutation.invalidation === "structure") {
      for (const root of mutation.affectedLayoutRoots) structureRoots.add(root);
    }
  }

  return {
    paintTargets,
    layoutRoots,
    structureRoots,
  };
}

/**
 * active session snapshot으로 lane 집합을 다시 만들고, 실제 변경이 있었던
 * lane만 revision을 증가시킨다. canonical document/store version은 읽지 않는다.
 */
export function updateEditorPresentationInvalidation(
  previous: EditorPresentationInvalidation,
  sessions: Iterable<EditorPresentationSession>,
  changedMutations: readonly ClassifiedEditorMutation[],
): EditorPresentationInvalidation {
  const active = activeMutations(sessions);
  const lanes = collectLaneValues(active);
  let paintChanged = false;
  let layoutChanged = false;
  let structureChanged = false;

  for (const mutation of changedMutations) {
    paintChanged = true;
    layoutChanged ||=
      mutation.invalidation === "layout" ||
      mutation.invalidation === "structure";
    structureChanged ||= mutation.invalidation === "structure";
  }

  return Object.freeze({
    ...lanes,
    paintRevision: previous.paintRevision + (paintChanged ? 1 : 0),
    layoutRevision: previous.layoutRevision + (layoutChanged ? 1 : 0),
    structureRevision: previous.structureRevision + (structureChanged ? 1 : 0),
  });
}
