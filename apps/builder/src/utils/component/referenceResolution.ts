export type ReferenceResolvable = {
  componentName?: string | null;
  customId?: string | null;
  id?: string;
  metadata?: {
    componentName?: unknown;
    customId?: unknown;
    [key: string]: unknown;
  };
  name?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function matchesReference(
  target: ReferenceResolvable,
  reference: string,
): boolean {
  if (target.id === reference) return true;
  if (target.name === reference) return true;
  if (target.customId === reference) return true;
  if (target.componentName === reference) return true;

  const metadata = target.metadata;
  if (!metadata) return false;

  return (
    (isNonEmptyString(metadata.customId) && metadata.customId === reference) ||
    (isNonEmptyString(metadata.componentName) &&
      metadata.componentName === reference)
  );
}

export function resolveReference<T extends ReferenceResolvable>(
  reference: string,
  targets: Iterable<T>,
): T | undefined {
  for (const target of targets) {
    if (matchesReference(target, reference)) return target;
  }
  return undefined;
}

/**
 * `resolveReference` 를 여러 번 부를 때의 색인 — 값마다 그 값을 가진 첫 대상 (순회 순서) 을 싣는다. 한 대상이
 * 여러 필드에서 같은 값을 가져도 첫 대상이 이기므로 `resolveReference(reference, targets)` 와 같은 결과다
 * (빈 문자열 참조 제외 — 색인하지 않는다).
 * (ADR-234 G4 — ref 해석이 없는 상태 변형 id 를 조회할 때마다 문서 전체를 훑었다.)
 */
export function buildReferenceIndex<T extends ReferenceResolvable>(
  targets: Iterable<T>,
): Map<string, T> {
  const index = new Map<string, T>();
  const add = (value: unknown, target: T) => {
    if (isNonEmptyString(value) && !index.has(value)) index.set(value, target);
  };
  for (const target of targets) {
    add(target.id, target);
    add(target.name, target);
    add(target.customId, target);
    add(target.componentName, target);
    add(target.metadata?.customId, target);
    add(target.metadata?.componentName, target);
  }
  return index;
}
