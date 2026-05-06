import type {
  CompositionDocument,
  PencilDocument,
  PencilNode,
} from "@composition/shared";
import {
  pencilDocumentToCompositionDocument,
  pencilNodeToCompositionDocument,
} from "@composition/shared";

const COMPOSITION_DOCUMENT_VERSION_PREFIX = "composition-";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCompositionDocumentPayload(
  value: unknown,
): value is CompositionDocument {
  return (
    isRecord(value) &&
    typeof value.version === "string" &&
    value.version.startsWith(COMPOSITION_DOCUMENT_VERSION_PREFIX) &&
    Array.isArray(value.children)
  );
}

function isPencilPayloadDocument(value: unknown): value is PencilDocument {
  return isRecord(value) && Array.isArray(value.children);
}

export function normalizeCompositionImportPayload(
  payload: unknown,
  source: string,
): CompositionDocument {
  if (isCompositionDocumentPayload(payload)) {
    return payload;
  }

  if (isPencilPayloadDocument(payload)) {
    return pencilDocumentToCompositionDocument(payload, {
      source,
      forceTopLevelReusable: true,
    });
  }

  if (isRecord(payload) && typeof payload.id === "string") {
    return pencilNodeToCompositionDocument(payload as PencilNode, {
      source,
      forceTopLevelReusable: true,
    });
  }

  throw new Error(
    `[ADR-116] Invalid import payload from ${source}: expected CompositionDocument or Pencil-style node tree`,
  );
}
