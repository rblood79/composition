import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setFields,
  setWholeField,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import { codeViewFileTree } from "../../../../../../packages/shared/src/codeView/files/tree";
import {
  catalogCodeViewFileBaseline,
  catalogCodeViewProjectApply,
  catalogCodeViewProjectSession,
  type CatalogCodeViewProjectSession,
} from "../../../builder/catalogRuntime/codeViewApply";
import {
  catalogStyleView,
  catalogStyleWritesOf,
} from "../../../builder/catalogRuntime/styleFields";
import { getPresetCommitValue } from "../../../builder/components/property/PropertyUnitInput.runtime";
import {
  BORDER_RADIUS_PRESET_OPTIONS,
  SPACING_PRESET_OPTIONS,
} from "../../../builder/components/property/propertyUnitPresets";
import {
  editorChanges,
  openAdr296,
  type Adr296Harness,
} from "./support/adr296Harness";

/**
 * ADR-298 G3 — the panel's token write and the code view meet in the node's `TokenUse`: a preset
 * the panel commits (`getPresetCommitValue` → `catalogStyleWritesOf`) is a `var(--…)` line in
 * `Page.css`, Apply keeps the same `tokenId`, and an edit swaps token ↔ literal ↔ token. Oracle =
 * the document field, not the CSS text.
 */
afterEach(() => vi.restoreAllMocks());

const CSS = "src/pages/Home.css";

async function open() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return openAdr296();
}
function session(h: Adr296Harness) {
  const s = catalogCodeViewProjectSession(h.graph());
  for (const file of codeViewFileTree(h.graph()))
    catalogCodeViewFileBaseline(s, h.graph(), file.path);
  return s;
}
const code = (s: CatalogCodeViewProjectSession, path: string) =>
  s.baselines.get(path)?.result.code ?? "";
function apply(
  h: Adr296Harness,
  s: CatalogCodeViewProjectSession,
  edit: (code: string) => string,
) {
  const before = code(s, CSS);
  const edited = edit(before);
  return catalogCodeViewProjectApply(h.workspace, s, [
    { path: CSS, edited, changes: editorChanges(before, edited) },
  ]);
}
const node = (h: Adr296Harness, id: string) => h.graph().getEntry(id) as NodeEntry;
const preset = (
  presets: typeof SPACING_PRESET_OPTIONS,
  id: string,
): string => getPresetCommitValue(presets.find((p) => p.id === id)!);
/** The panel's commit of CSS keys (the Styles host's write — `catalogStyleWritesOf` + `setFields`). */
function panel(h: Adr296Harness, id: string, styles: Record<string, string>) {
  const writes = catalogStyleWritesOf(styles);
  h.run(
    setFields({
      targets: [{ kind: "node", id: id as NodeEntry["id"] }],
      visual: writes.visual,
    }),
  );
}
const token = (tokenId: string) => ({
  kind: "set",
  value: { kind: "token", tokenId },
});

describe("ADR-298 G3 — panel token ↔ code view round trip", () => {
  it("panel Gap M · Radius M are `var(--…)` lines and Apply keeps the same tokenId", async () => {
    const h = await open();
    const frame = h.add("frame");
    panel(h, frame, {
      gap: preset(SPACING_PRESET_OPTIONS, "md"),
      borderRadius: preset(BORDER_RADIUS_PRESET_OPTIONS, "md"),
    });
    expect(node(h, frame).visual.gap).toEqual(token("lib:token:spacing_md"));
    expect(node(h, frame).visual.radius).toEqual(token("lib:token:radius_md"));
    // The panel reads the token back as its variable (D4 — chip + value).
    const gap = node(h, frame).visual.gap as { value: unknown };
    expect(
      catalogStyleView({ visual: { gap: gap.value }, layout: {}, sizing: {} })
        .gap,
    ).toBe("var(--spacing-md)");
    const s = session(h);
    expect(code(s, CSS)).toContain("gap: var(--spacing-md);");
    expect(code(s, CSS)).toContain(
      "border-radius: var(--catalog-token-radius-md);",
    );
    // An unrelated edit — the token lines stay the same token ids (not the rule's `_light` twin).
    const result = apply(h, s, (css) =>
      css.replace("gap: var(--spacing-md);", "gap: var(--spacing-md);\n  opacity: 0.5;"),
    );
    expect(result.rejected).toEqual([]);
    expect(node(h, frame).visual.gap).toEqual(token("lib:token:spacing_md"));
    expect(node(h, frame).visual.radius).toEqual(token("lib:token:radius_md"));
  });

  it("token → another token → literal → token", async () => {
    const h = await open();
    const frame = h.add("frame");
    panel(h, frame, { gap: preset(SPACING_PRESET_OPTIONS, "md") });
    let s = session(h);
    expect(
      apply(h, s, (css) => css.replace("var(--spacing-md)", "var(--spacing-lg)"))
        .rejected,
    ).toEqual([]);
    expect(node(h, frame).visual.gap).toEqual(token("lib:token:spacing_lg"));
    s = session(h);
    expect(
      apply(h, s, (css) => css.replace("var(--spacing-lg)", "20px")).rejected,
    ).toEqual([]);
    expect(node(h, frame).visual.gap).toEqual({ kind: "set", value: 20 });
    // Back to a token from the panel (a literal stays a literal until a step is picked — D9).
    panel(h, frame, { gap: preset(SPACING_PRESET_OPTIONS, "sm") });
    expect(node(h, frame).visual.gap).toEqual(token("lib:token:spacing_sm"));
    s = session(h);
    expect(code(s, CSS)).toContain("gap: var(--spacing-sm);");
  });
});

/**
 * ADR-298 G4 (Phase 3) — a fill color token and an inset token in `Page.css`: `background: var(--accent)`
 * and `left: var(--spacing-lg)`, Apply back to the same `TokenUse`, and token ↔ literal swaps.
 */
describe("ADR-298 G4 — fill · inset tokens ↔ code view", () => {
  const use = (tokenId: string) => ({ kind: "token", tokenId });
  it("a fill color token is a `background: var(--…)` line; edits swap token ↔ literal", async () => {
    const h = await open();
    const frame = h.add("frame");
    h.run(
      setWholeField({
        targets: [{ kind: "node", id: frame as NodeEntry["id"] }],
        field: "fills",
        value: [
          {
            id: "fill-1",
            kind: "color",
            enabled: true,
            opacity: 1,
            blendMode: "normal",
            color: use("lib:token:color_accent") as never,
          },
        ],
      }),
    );
    let s = session(h);
    expect(code(s, CSS)).toContain("background: var(--accent);");
    expect(
      apply(h, s, (css) => css.replace("background: var(--accent);", "background: var(--positive);"))
        .rejected,
    ).toEqual([]);
    expect((node(h, frame).fills![0] as { color: unknown }).color).toEqual(
      use("lib:token:color_positive"),
    );
    s = session(h);
    expect(
      apply(h, s, (css) => css.replace("background: var(--positive);", "background: #ff0000;"))
        .rejected,
    ).toEqual([]);
    expect((node(h, frame).fills![0] as { color: unknown }).color).toBe("#ff0000ff");
    s = session(h);
    expect(
      apply(h, s, (css) =>
        css.replace(
          "background: #ff0000ff;",
          "background: linear-gradient(90deg, var(--accent) 0%, #000000ff 100%);",
        ),
      ).rejected,
    ).toEqual([]);
    const layer = node(h, frame).fills![0] as unknown as {
      stops: { color: unknown }[];
    };
    expect(layer.stops[0]!.color).toEqual(use("lib:token:color_accent"));
    expect(layer.stops[1]!.color).toBe("#000000ff");
  });

  it("an inset token is a `left: var(--spacing-*)` line and Apply keeps it", async () => {
    const h = await open();
    const frame = h.add("frame");
    h.run(
      setFields({
        targets: [{ kind: "node", id: frame as NodeEntry["id"] }],
        layout: {
          position: { kind: "set", value: "absolute" },
          insetLeft: { kind: "set", value: use("lib:token:spacing_lg") as never },
        },
      }),
    );
    let s = session(h);
    expect(code(s, CSS)).toContain("left: var(--spacing-lg);");
    expect(
      apply(h, s, (css) => css.replace("left: var(--spacing-lg);", "left: var(--spacing-sm);"))
        .rejected,
    ).toEqual([]);
    expect(node(h, frame).layout?.insetLeft).toEqual({
      kind: "set",
      value: use("lib:token:spacing_sm"),
    });
    s = session(h);
    expect(
      apply(h, s, (css) => css.replace("left: var(--spacing-sm);", "left: 30px;")).rejected,
    ).toEqual([]);
    expect(node(h, frame).layout?.insetLeft).toEqual({ kind: "set", value: "30px" });
  });
});
