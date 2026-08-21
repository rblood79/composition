import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INHERITED_LAYOUT_PROPS_UPDATE,
  LAYOUT_AFFECTING_PROP_KEYS,
  LAYOUT_PROP_KEYS,
  LAYOUT_STYLE_KEYS,
  NON_LAYOUT_PROPS_UPDATE,
} from "../presentation/invalidation/editorMutationEffectRegistry";

interface FrozenSource {
  file: string;
  kind: string;
  values: string[];
}

interface FrozenInvalidationBaseline {
  schemaVersion: number;
  sources: Record<string, FrozenSource>;
}

const repositoryRoot = resolve(__dirname, "../../../../..");
const fixture = JSON.parse(
  readFileSync(
    resolve(
      repositoryRoot,
      "docs/adr/design/187-phase-0-invalidation-baseline.json",
    ),
    "utf8",
  ),
) as FrozenInvalidationBaseline;

const registryDerivedViews: Record<string, readonly string[]> = {
  INHERITED_LAYOUT_PROPS_UPDATE: [...INHERITED_LAYOUT_PROPS_UPDATE],
  LAYOUT_AFFECTING_PROP_KEYS: [...LAYOUT_AFFECTING_PROP_KEYS],
  LAYOUT_PROP_KEYS,
  LAYOUT_STYLE_KEYS,
  NON_LAYOUT_PROPS_UPDATE: [...NON_LAYOUT_PROPS_UPDATE],
};

describe("ADR-187 Phase 0 invalidation baseline", () => {
  it("freezes all five current classifier views as exact ordered values", () => {
    expect(Object.keys(fixture.sources)).toEqual([
      "LAYOUT_AFFECTING_PROP_KEYS",
      "NON_LAYOUT_PROPS_UPDATE",
      "INHERITED_LAYOUT_PROPS_UPDATE",
      "LAYOUT_STYLE_KEYS",
      "LAYOUT_PROP_KEYS",
    ]);

    for (const [symbol, frozen] of Object.entries(fixture.sources)) {
      const current = registryDerivedViews[symbol] ?? [];
      expect(current, `${symbol} drift`).toEqual(frozen.values);
      expect(new Set(current).size, `${symbol} duplicate`).toBe(current.length);
    }
  });

  it("preserves the axis meaning needed by the Phase 1 neutral registry", () => {
    expect(fixture.sources.LAYOUT_AFFECTING_PROP_KEYS.kind).toBe(
      "top-level-props-axis",
    );
    expect(fixture.sources.NON_LAYOUT_PROPS_UPDATE.kind).toBe(
      "non-layout-style-axis",
    );
    expect(fixture.sources.INHERITED_LAYOUT_PROPS_UPDATE.kind).toBe(
      "inherited-style-axis",
    );
    expect(fixture.sources.LAYOUT_STYLE_KEYS.kind).toBe("style-axis");
    expect(fixture.sources.LAYOUT_PROP_KEYS.kind).toBe("props-axis");
  });
});
