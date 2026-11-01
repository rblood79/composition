import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  borderWidth,
  darkColors,
  darkShadows,
  lightColors,
  lightShadows,
  radius,
  spacing,
  typography,
} from "@composition/rendering";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/library";
import {
  libraryTokenId,
  libraryTokenScaleRefs,
} from "../../../../../../packages/shared/src/catalog/document/libraryTokenScale";
import { catalogTokenValue } from "../../../../../../packages/shared/src/catalog/document/themedToken";
import type {
  CatalogLibrary,
  EntryId,
  LibraryTokenId,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { newCatalogProjectDocument } from "../project";

/**
 * ADR-298 Phase 1 G1 — the theme-agnostic token scale (D2). Oracle: the primitive maps themselves (not
 * the reader the library uses), light and dark. The rule tokens (`_light`) stay — same ids, same values,
 * every definition's token use still resolves; only `tokens` · `revision` grow.
 */
const ORACLE: Record<string, (key: string, mode: "light" | "dark") => unknown> = {
  spacing: (key) => spacing[key as keyof typeof spacing],
  radius: (key) => radius[key as keyof typeof radius],
  border: (key) => borderWidth[key.slice(6) as keyof typeof borderWidth],
  shadow: (key, mode) =>
    (mode === "dark" ? darkShadows : lightShadows)[key as keyof typeof lightShadows],
  typography: (key) => typography[key as keyof typeof typography],
  color: (key, mode) =>
    (mode === "dark" ? darkColors : lightColors)[key as keyof typeof lightColors],
};

describe("ADR-298 G1 — theme-agnostic library token scale", () => {
  it("every step of every axis is a `lib:token:<ref>` entry whose value follows the mode", async () => {
    const library = await buildCodeCatalogLibrary();
    const refs = libraryTokenScaleRefs();
    // D2's axes: spacing · radius · border width · shadow · typography (body + heading + lines) · color.
    const categories = new Set(refs.map(({ ref }) => ref.slice(1).split(".")[0]));
    expect([...categories].sort()).toEqual(
      ["border", "color", "radius", "shadow", "spacing", "typography"].sort(),
    );
    for (const key of ["text-xs", "text-xl", "text-heading-xs", "text-heading-xl", "text-heading-md--line-height"])
      expect(refs.some(({ ref }) => ref === `{typography.${key}}`)).toBe(true);
    for (const { ref } of refs) {
      const token = library.tokens.get(libraryTokenId(ref));
      expect(token, ref).toBeDefined();
      const [, category, key] = /^\{(\w+)\.(.+)\}$/.exec(ref)!;
      for (const mode of ["light", "dark"] as const)
        expect(catalogTokenValue(token!, mode), `${ref} ${mode}`).toBe(
          ORACLE[category!]!(key!, mode),
        );
    }
    expect(library.tokens.get("lib:token:spacing_md" as LibraryTokenId)?.value).toBe(12);
    expect(library.tokens.get("lib:token:radius_md" as LibraryTokenId)?.value).toBe(8);
    expect(library.tokens.get("lib:token:border_width_thin" as LibraryTokenId)?.value).toBe(1);
  });

  it("the rule tokens stay as they were (ids, values, refs) and every definition token use resolves", async () => {
    const library = await buildCodeCatalogLibrary();
    const ruleTokens = [...library.tokens.values()].filter((token) =>
      token.id.endsWith("_light"),
    );
    // (Phase 1 실측 149 — 그 수는 rule 표 편집에 따라 바뀐다: 계약은 개수가 아니라 아래 대응.)
    expect(ruleTokens.length).toBeGreaterThan(0);
    // A rule token on a scale axis has its scale twin with the same ref (one ref, one value source).
    const scaleCategories = new Set(
      libraryTokenScaleRefs().map(({ ref }) => ref.slice(1).split(".")[0]),
    );
    for (const token of ruleTokens)
      if (scaleCategories.has(token.ref!.slice(1).split(".")[0]))
        expect(library.tokens.get(libraryTokenId(token.ref!))?.value).toBe(token.value);
    // No definition reads a scale id — the rule projection is untouched.
    const json = JSON.stringify([...library.definitions.values()]);
    const used = new Set([...json.matchAll(/"tokenId":"(lib:token:[^"]+)"/g)].map((m) => m[1]));
    expect([...used].every((id) => id!.endsWith("_light"))).toBe(true);
    expect([...used].every((id) => library.tokens.has(id as LibraryTokenId))).toBe(true);
  });

  it("revert RED: a document's `_light` token use dangles once the rule entry is gone", async () => {
    const library = await buildCodeCatalogLibrary();
    const document = newCatalogProjectDocument({
      projectId: "project:project:g1" as EntryId<"project">,
      name: "G1",
    });
    const bodyId = "project:node:home-body";
    const body = document.entries[bodyId] as NodeEntry;
    const node: NodeEntry = {
      kind: "node",
      id: "project:node:t" as NodeEntry["id"],
      definitionId: "lib:definition:type-frame",
      children: [],
      props: {},
      visual: {
        radius: {
          kind: "set",
          value: { kind: "token", tokenId: "lib:token:radius_md_light" },
        },
      } as never,
      sizing: {},
      descendantOverrides: [],
    };
    const doc = {
      ...document,
      entries: {
        ...document.entries,
        [bodyId]: { ...body, children: [...body.children, node.id] },
        [node.id]: node,
      },
    };
    expect(() => new CatalogGraph(doc as never, library)).not.toThrow();
    // The same parts rebuild to a verified library — the harness is not what fails below.
    expect(() => new CatalogGraph(doc as never, rebuild(library, () => true))).not.toThrow();
    // Without the rule entry the references (rule definitions and this document) dangle.
    let error: unknown;
    try {
      rebuild(library, (id) => id !== "lib:token:radius_md_light");
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: "DANGLING_TOKEN" });
    expect(String((error as Error).message)).toContain("lib:token:radius_md_light");
  });
});

/** The library rebuilt from its own parts with some tokens left out (a verified library — `buildCatalogLibrary`). */
function rebuild(
  library: CatalogLibrary,
  keep: (id: string) => boolean,
): CatalogLibrary {
  return buildCatalogLibrary({
    contractVersion: library.contractVersion,
    revision: `${library.revision}-without`,
    definitions: [...library.definitions.values()],
    templates: [...library.templates.values()],
    tokens: [...library.tokens.values()].filter((token) => keep(token.id)),
    bindingIds: [...library.execution.bindingIds],
    triggerIds: [...library.execution.triggerIds],
    capabilityIds: [...library.execution.capabilityIds],
    actionOpCodes: [...library.execution.actionOpCodes],
    rules: Object.fromEntries(library.rules),
  });
}
