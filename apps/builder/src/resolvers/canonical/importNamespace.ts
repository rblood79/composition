const IMPORT_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const RESERVED_IMPORT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function isValidCompositionImportKey(importKey: string): boolean {
  return (
    IMPORT_KEY_PATTERN.test(importKey) && !RESERVED_IMPORT_KEYS.has(importKey)
  );
}

export function assertCompositionImportKey(importKey: string): void {
  if (isValidCompositionImportKey(importKey)) return;

  throw new Error(
    `[ADR-116] Invalid import key "${importKey}": expected /^[A-Za-z][A-Za-z0-9_-]*$/ and no reserved object keys`,
  );
}

export function parseCompositionImportReference(
  refId: string,
): { importKey: string; nodeId: string } | null {
  const separatorIndex = refId.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === refId.length - 1) {
    return null;
  }

  const importKey = refId.slice(0, separatorIndex);
  const nodeId = refId.slice(separatorIndex + 1);
  if (!isValidCompositionImportKey(importKey) || nodeId.includes(":")) {
    return null;
  }

  return { importKey, nodeId };
}
