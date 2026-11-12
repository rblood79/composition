import { afterEach, describe, expect, it, vi } from "vitest";
import { REUSABLE_ORIGIN_DEFINITIONS } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import type { DefinitionId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogSemanticContracts } from "../editContract";

/**
 * ADR-246 ratchet 조사 (2026-11-12) — `catalogSemanticContracts` is read per selection and per
 * edited key; the origin a definition shows is looked up by id, not by walking the library's
 * origins (165 — a frame or a Text, which is no origin, walked them all: +14,850 calls per 30
 * selections in the select class).
 */
afterEach(() => vi.restoreAllMocks());

describe("catalogSemanticContracts — the origin by id", () => {
  it("does not walk the library's origins", () => {
    const find = vi.spyOn(REUSABLE_ORIGIN_DEFINITIONS, "find");
    catalogSemanticContracts("lib:definition:text" as DefinitionId, "Text");
    catalogSemanticContracts("lib:definition:frame" as DefinitionId, "frame");
    expect(find).not.toHaveBeenCalled();
  });

  it("a trigger-root origin still offers its controller's slot", () => {
    const origin = REUSABLE_ORIGIN_DEFINITIONS.find(
      (definition) =>
        "slot" in
        catalogSemanticContracts(definition.id as DefinitionId, "__no-type__"),
    );
    expect(origin).toBeDefined();
  });
});
