import type {
  CompositionDocument,
  PencilDocument,
  PencilNode,
} from "@composition/shared";
import {
  pencilDocumentToCompositionDocument,
  pencilNodeToCompositionDocument,
} from "@composition/shared";

import { applyCanonicalDocumentMigrations } from "../../adapters/canonical/canonicalDocumentMigrations";

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
  // ADR-923 r17m2 (2026-09-01): external import master 도 main document 와 같은 형태 migration 체인을
  //   통과한다 — 종전엔 어느 migration 도 안 거쳐 legacy ColorField (parent label 부재) 가 Preview
  //   무라벨 / Skia "Color" 로 남았다. 멱등 — 고칠 게 없으면 같은 참조.
  if (isCompositionDocumentPayload(payload)) {
    return applyCanonicalDocumentMigrations(payload);
  }

  if (isPencilPayloadDocument(payload)) {
    return applyCanonicalDocumentMigrations(
      pencilDocumentToCompositionDocument(payload, {
        source,
        forceTopLevelReusable: true,
      }),
    );
  }

  if (isRecord(payload) && typeof payload.id === "string") {
    return applyCanonicalDocumentMigrations(
      pencilNodeToCompositionDocument(payload as PencilNode, {
        source,
        forceTopLevelReusable: true,
      }),
    );
  }

  throw new Error(
    `[ADR-116] Invalid import payload from ${source}: expected CompositionDocument or Pencil-style node tree`,
  );
}
