import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { typography } from "@composition/rendering";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogDomStyle } from "../../../../../../packages/shared/src/catalog/runtime/domBinding.runtime";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-298 Phase 1 — the token layer under the panel: node token uses on every length key the panel
 * writes (D4 검증 표) and the line contract (D4 ① ②). Oracle for the line: the S2 typography map
 * (`typography` — font and its paired line in px), not the resolver.
 */
const token = (id: string) => ({ kind: "set", value: { kind: "token", tokenId: id } });
const num = (value: number) => ({ kind: "set", value });

async function workspaceWith(type: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr298" as EntryId<"project">,
        name: "ADR-298",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr298-phase1-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const node: NodeEntry = {
    kind: "node",
    id: "project:node:n" as NodeId,
    definitionId: (type === "Text" ? "lib:definition:text" : `lib:definition:type-${type}`) as NodeEntry["definitionId"],
    children: [],
    props: type === "Text" ? { children: { kind: "set", value: "Hello" } } : {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  } as unknown as NodeEntry;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [node],
      rootIds: [node.id],
      newId: workspace.newId,
    }),
  );
  const write = (visual: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: node.id }],
        visual,
      } as Parameters<typeof setFields>[0]),
    );
  const record = () =>
    workspace.root.domInputs.get(workspace.root.recordsOfSource(node.id)[0]!)!;
  return { workspace, write, record };
}

describe("ADR-298 Phase 1 — validation table (D4)", () => {
  it("a Frame takes spacing · radius · border tokens on every side · corner the panel writes", async () => {
    const { write, record } = await workspaceWith("frame");
    write({
      paddingTop: token("lib:token:spacing_md"),
      paddingLeft: token("lib:token:spacing_lg"),
      radiusTopLeft: token("lib:token:radius_lg"),
      borderTopWidth: token("lib:token:border_width_thick"),
      gap: token("lib:token:spacing_sm"),
      boxShadow: token("lib:token:shadow_md"),
    });
    expect(record().visual).toMatchObject({
      paddingTop: 12,
      paddingLeft: 16,
      radiusTopLeft: 10,
      borderTopWidth: 2,
      gap: 8,
    });
    expect(typeof record().visual.boxShadow).toBe("string");
  });
  it("a color token on a length key is refused", async () => {
    const { write } = await workspaceWith("frame");
    let error: unknown;
    try {
      write({ paddingTop: token("lib:token:color_accent") });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: "TOKEN_TYPE_MISMATCH" });
  });
});

describe("ADR-298 Phase 1 — line contract (D4 ① ②)", () => {
  it("① a font size token with no authored line brings its pair: heading M 22 → 26 / 22", async () => {
    const { write, record } = await workspaceWith("Text");
    write({ fontSize: token("lib:token:typography_text-heading-md") });
    const font = typography["text-heading-md" as keyof typeof typography] as number;
    const line = typography["text-heading-md--line-height" as keyof typeof typography] as number;
    expect(record().visual.fontSize).toBe(font);
    expect(record().visual.lineHeight).toBeCloseTo(line / font, 6);
  });
  it("① an authored line ratio wins over the pair", async () => {
    const { write, record } = await workspaceWith("Text");
    write({ fontSize: token("lib:token:typography_text-heading-md"), lineHeight: num(1.5) });
    expect(record().visual.lineHeight).toBe(1.5);
  });
  it("② a line-height token is px — held as px ÷ the final font size (not px in the ratio field)", async () => {
    const { write, record } = await workspaceWith("Text");
    write({
      fontSize: num(20),
      lineHeight: token("lib:token:typography_text-heading-md--line-height"),
    });
    const line = typography["text-heading-md--line-height" as keyof typeof typography] as number;
    expect(record().visual.lineHeight).toBeCloseTo(line / 20, 6);
  });
  it("a literal font size keeps the rule's ratio (no recompute — the contract is for tokens)", async () => {
    const { write, record } = await workspaceWith("Text");
    const before = record().visual.lineHeight;
    write({ fontSize: num(22) });
    expect(record().visual.lineHeight).toBe(before);
  });
});

describe("ADR-298 Phase 1 — DOM token variables (D5) · source compare (F12)", () => {
  it("a Frame's token values go inline as the token's variable; literals stay px", async () => {
    const { write, record } = await workspaceWith("frame");
    write({
      paddingTop: token("lib:token:spacing_md"),
      paddingBottom: num(12),
      radius: token("lib:token:radius_lg"),
      gap: token("lib:token:spacing_sm"),
      borderWidth: token("lib:token:border_width_thick"),
      borderColor: token("lib:token:color_border"),
      fill: token("lib:token:color_accent"),
    });
    const style = catalogDomStyle(record()) as Record<string, unknown>;
    expect(style.paddingTop).toBe("var(--spacing-md)");
    expect(style.paddingBottom).not.toMatch(/var\(/);
    expect(style.borderRadius).toBe("var(--catalog-token-radius-lg)");
    expect(style.rowGap).toBe("var(--spacing-sm)");
    expect(style.columnGap).toBe("var(--spacing-sm)");
    expect(style.borderWidth).toBe("var(--border-width-thick)");
    expect(String(style.borderColor)).toMatch(/^var\(--[\w-]+\)$/);
    expect(String(style.backgroundColor)).toMatch(/^var\(--[\w-]+\)$/);
  });
  it("a side literal beside an axis token keeps its px (the box model's side wins)", async () => {
    const { write, record } = await workspaceWith("frame");
    write({ padding: token("lib:token:spacing_md"), paddingLeft: num(12) });
    const style = catalogDomStyle(record()) as Record<string, unknown>;
    expect(style.paddingTop).toBe("var(--spacing-md)");
    expect(style.paddingLeft).not.toMatch(/var\(/);
  });
  it("F12: the same value from a literal, then from a token, reaches the DOM listener", async () => {
    const { write, workspace } = await workspaceWith("frame");
    const id = workspace.root.recordsOfSource("project:node:n")[0]!;
    write({ paddingTop: num(12) });
    const heard: unknown[] = [];
    const stop = workspace.root.subscribeDom(id, (node) => heard.push(node));
    write({ paddingTop: token("lib:token:spacing_md") });
    stop();
    expect(heard.length).toBe(1);
    const node = heard[0] as Parameters<typeof catalogDomStyle>[0];
    expect((catalogDomStyle(node) as Record<string, unknown>).paddingTop).toBe(
      "var(--spacing-md)",
    );
  });
});
