import {
  getEditorMutationEffectRule,
  type EditorMutationEffectAxis,
  type EditorPropertyEffectRule,
} from "./invalidation/editorMutationEffectRegistry";
import {
  getEditorPresentationLayoutRoot,
  type ClassifiedEditorMutation,
  type EditorInvalidationKind,
  type EditorMutationDescriptor,
} from "./editorPresentationTypes";

const INVALIDATION_RANK: Readonly<Record<EditorInvalidationKind, number>> = {
  layout: 1,
  paint: 0,
  structure: 2,
};

export function mergeEditorInvalidationKinds(
  invalidations: readonly EditorInvalidationKind[],
): EditorInvalidationKind {
  if (invalidations.length === 0) {
    throw new Error("Cannot merge an empty editor invalidation set");
  }
  return invalidations.reduce((highest, current) =>
    INVALIDATION_RANK[current] > INVALIDATION_RANK[highest] ? current : highest,
  );
}

function requireRule(
  axis: EditorMutationEffectAxis,
  key: string,
): EditorPropertyEffectRule {
  const rule = getEditorMutationEffectRule(axis, key);
  if (!rule) {
    throw new Error(`Unknown editor mutation effect: ${axis}:${key}`);
  }
  return rule;
}

function getDescriptorRules(
  descriptor: EditorMutationDescriptor,
): readonly EditorPropertyEffectRule[] {
  switch (descriptor.type) {
    case "fills.replace":
    case "structure.patch":
      return [requireRule("descriptor", descriptor.type)];
    case "geometry.patch": {
      const keys = Object.keys(descriptor.patch);
      if (keys.length === 0) {
        throw new Error("Editor geometry patch must contain at least one key");
      }
      return keys.map((key) => requireRule("geometry", key));
    }
    case "style.patch": {
      const keys = Object.keys(descriptor.patch);
      if (keys.length === 0) {
        throw new Error("Editor style patch must contain at least one key");
      }
      return keys.map((key) => requireRule("style", key));
    }
  }
}

export function classifyEditorMutation(
  descriptor: EditorMutationDescriptor,
): ClassifiedEditorMutation {
  const rules = getDescriptorRules(descriptor);
  const invalidation = mergeEditorInvalidationKinds(
    rules.map((rule) => rule.invalidation),
  );
  const affectedTargets = Object.freeze([descriptor.target]);
  const affectedLayoutRoots = Object.freeze(
    invalidation === "paint"
      ? []
      : [getEditorPresentationLayoutRoot(descriptor.target)],
  );
  return Object.freeze({
    affectedLayoutRoots,
    affectedTargets,
    descriptor,
    invalidation,
  });
}

export function assertContinuousEditorMutation(
  descriptor: EditorMutationDescriptor,
): void {
  const rules = getDescriptorRules(descriptor);
  const disallowed = rules.find((rule) => !rule.continuous);
  if (disallowed) {
    throw new Error(
      `Editor mutation effect is not registered for continuous presentation: ${disallowed.axis}:${disallowed.key}`,
    );
  }
}
