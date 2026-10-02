import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INHERITED_LAYOUT_PROPS_UPDATE,
  LAYOUT_AFFECTING_PROP_KEYS,
  LAYOUT_PROP_KEYS,
  LAYOUT_STYLE_KEYS,
  NON_LAYOUT_PROPS_UPDATE,
  getEditorMutationEffectRule,
} from "./editorMutationEffectRegistry";

interface FrozenSource {
  values: string[];
}

interface FrozenInvalidationBaseline {
  sources: Record<string, FrozenSource>;
}

const repositoryRoot = resolve(__dirname, "../../../../../..");
const fixture = JSON.parse(
  readFileSync(
    resolve(
      repositoryRoot,
      "docs/adr/design/187-phase-0-invalidation-baseline.json",
    ),
    "utf8",
  ),
) as FrozenInvalidationBaseline;

const derivedViews: Record<string, readonly string[]> = {
  INHERITED_LAYOUT_PROPS_UPDATE: [...INHERITED_LAYOUT_PROPS_UPDATE],
  LAYOUT_AFFECTING_PROP_KEYS: [...LAYOUT_AFFECTING_PROP_KEYS],
  LAYOUT_PROP_KEYS,
  LAYOUT_STYLE_KEYS,
  NON_LAYOUT_PROPS_UPDATE: [...NON_LAYOUT_PROPS_UPDATE],
};

describe("EDITOR_MUTATION_EFFECT_REGISTRY", () => {
  it("derives all five legacy consumers with exact Phase 0 parity", () => {
    for (const [symbol, source] of Object.entries(fixture.sources)) {
      expect(derivedViews[symbol], `${symbol} parity`).toEqual(source.values);
    }
  });

  it("keeps axis, inheritance, cache, and continuous semantics in one rule", () => {
    expect(getEditorMutationEffectRule("style", "fontSize")).toMatchObject({
      cacheSignature: "style",
      continuous: true,
      invalidation: "layout",
      propagation: "inherited-subtree",
      usedSizeEffect: "content-box",
    });
    expect(getEditorMutationEffectRule("style", "objectFit")).toMatchObject({
      cacheSignature: "style",
      invalidation: "paint",
    });
    expect(getEditorMutationEffectRule("prop", "size")).toMatchObject({
      cacheSignature: "prop",
      invalidation: "layout",
      usedSizeEffect: "self-box",
    });
    expect(getEditorMutationEffectRule("style", "left")).toMatchObject({
      continuous: true,
      invalidation: "layout",
      usedSizeEffect: "none",
    });
    expect(getEditorMutationEffectRule("style", "borderRadius")).toMatchObject({
      continuous: true,
      invalidation: "paint",
    });
  });

  it("opens only fixed Text fontSize while other metrics and resources stay commit-only", () => {
    for (const key of ["fontFamily", "lineHeight", "letterSpacing"]) {
      expect(getEditorMutationEffectRule("style", key)).toMatchObject({
        continuous: false,
        invalidation: "layout",
        propagation: "inherited-subtree",
      });
    }
    expect(getEditorMutationEffectRule("style", "fontSize")).toMatchObject({
      continuous: true,
      invalidation: "layout",
      propagation: "inherited-subtree",
    });
    expect(getEditorMutationEffectRule("style", "fontWeight")).toMatchObject({
      continuous: true,
      invalidation: "layout",
      propagation: "inherited-subtree",
    });

    expect(getEditorMutationEffectRule("prop", "src")).toMatchObject({
      continuous: false,
      invalidation: "layout",
      cacheSignature: "prop",
    });
    expect(
      getEditorMutationEffectRule("descriptor", "structure.patch"),
    ).toMatchObject({
      continuous: false,
      invalidation: "structure",
    });
  });
});
