import type { VisibilityCondition } from "@composition/rendering";

export function evaluateVisibility(
  condition: VisibilityCondition | undefined,
  currentProps: Record<string, unknown>,
): boolean {
  if (!condition) return true;
  if (
    condition.all &&
    !condition.all.every((part) => evaluateVisibility(part, currentProps))
  )
    return false;
  if (
    condition.any &&
    !condition.any.some((part) => evaluateVisibility(part, currentProps))
  )
    return false;

  const value = condition.key
    ? condition.key.includes(".")
      ? condition.key
          .split(".")
          .reduce<unknown>(
            (obj, k) =>
              obj && typeof obj === "object"
                ? (obj as Record<string, unknown>)[k]
                : undefined,
            currentProps,
          )
      : currentProps[condition.key]
    : undefined;

  if (condition.equals !== undefined && value !== condition.equals) {
    return false;
  }

  if (condition.notEquals !== undefined && value === condition.notEquals) {
    return false;
  }

  if (condition.oneOf && !condition.oneOf.includes(value as never)) {
    return false;
  }

  if (condition.truthy === true && !value) {
    return false;
  }

  if (condition.truthy === false && Boolean(value)) {
    return false;
  }

  return true;
}

/**
 * 필드의 기준값 — 값이 없을 때 패널이 보여 주는 값. `defaultWhen` 의 첫 맞는 항목, 없으면 `default`
 * (ADR-306 Phase 5 — 여러 종류가 나눠 쓰는 키의 「값 없음」 뜻이 종류마다 다를 때. Chart `includeZero`).
 */
export function contractDefault(
  contract: {
    default?: unknown;
    defaultWhen?: ReadonlyArray<{ when: VisibilityCondition; value: unknown }>;
  },
  currentProps: Record<string, unknown>,
): unknown {
  for (const entry of contract.defaultWhen ?? [])
    if (evaluateVisibility(entry.when, currentProps)) return entry.value;
  return contract.default;
}
