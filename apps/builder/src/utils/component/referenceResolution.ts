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
    (isNonEmptyString(metadata.customId) &&
      metadata.customId === reference) ||
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
