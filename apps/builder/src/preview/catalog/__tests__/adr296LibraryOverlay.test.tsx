import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import { codeViewFileTree } from "../../../../../../packages/shared/src/codeView/files/tree";
import {
  catalogCodeViewFileBaseline,
  catalogCodeViewProjectApply,
  catalogCodeViewProjectSession,
  type CatalogCodeViewProjectSession,
} from "../../../builder/catalogRuntime/codeViewApply";
import {
  editorChanges,
  openAdr296,
  type Adr296Harness,
} from "./support/adr296Harness";

/**
 * ADR-296 follow-up (2026-11-05) — a Library overlay origin's instance (Popover · Dialog · Tooltip ·
 * Menu · Sheet) is written by the palette type it is placed as (`<Popover>` — the same name
 * `catalogPaletteDefinitionId` reads back), not by its template root's RAC type (`<DialogTrigger>`
 * — read back as a bare DialogTrigger node). Its slot position is named by the declared slot
 * (`<Slot name="content">`), not by the position node's class (`frame`).
 */
afterEach(() => vi.restoreAllMocks());

const HOME = "src/pages/Home.tsx";

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
  edits: Record<string, (code: string) => string>,
) {
  return catalogCodeViewProjectApply(
    h.workspace,
    s,
    Object.entries(edits).map(([path, edit]) => {
      const before = code(s, path);
      const edited = edit(before);
      return { path, edited, changes: editorChanges(before, edited) };
    }),
  );
}
const node = (h: Adr296Harness, id: string) =>
  h.graph().getEntry(id) as NodeEntry;
const fills = (h: Adr296Harness, id: string) =>
  node(h, id).descendantOverrides.filter(
    (item): item is Extract<typeof item, { kind: "fillSlot" }> =>
      item.kind === "fillSlot",
  );

describe("ADR-296 follow-up — a Library overlay instance in the page's code", () => {
  it('a Popover is `<Popover>` (its palette type) with `<Slot name="content">` — not `<DialogTrigger>` · `frame`', async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add("Popover");
    const page = code(session(h), HOME);
    expect(page).toContain("<Popover");
    expect(page).not.toContain("<DialogTrigger");
    expect(page).toContain('<Slot name="content">');
    expect(page).not.toContain('<Slot name="frame"');
    expect(page).toMatch(
      /import \{[^}]*\bPopover\b[^}]*\} from 'react-aria-components'/,
    );
  });

  it.each([
    ["Dialog", "content"],
    ["Tooltip", "content"],
    ["Menu", undefined],
    ["Sheet", undefined],
  ])("%s — its tag is the palette type", async (type, slot) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add(type);
    const page = code(session(h), HOME);
    expect(page).toContain(`<${type}`);
    expect(page).not.toMatch(
      /<(DialogTrigger|TooltipTrigger|MenuTrigger|SheetTrigger)\b/,
    );
    if (slot) expect(page).toContain(`<Slot name="${slot}">`);
  });

  it("round trip — pasted over itself: nothing; a slot's text edit and an added child reach the fill", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const popover = h.add("Popover");
    const s = session(h);
    const page = code(s, HOME);
    const revision = h.graph().revision;
    expect(
      catalogCodeViewProjectApply(h.workspace, s, [
        { path: HOME, edited: page, changes: [] },
      ]).rejected,
    ).toEqual([]);
    expect(h.graph().revision).toBe(revision);
    const content = () =>
      fills(h, popover).find((fill) => fill.address.templatePath.length > 1)!
        .childIds;
    const before = content().length;
    expect(before).toBeGreaterThan(0);
    const result = apply(h, s, {
      [HOME]: (text) =>
        text
          .replace(">Popover Title</Heading>", ">Hello</Heading>")
          .replace(
            '<Slot name="content">\n',
            '<Slot name="content">\n          <Text>Added</Text>\n',
          ),
    });
    expect(result.rejected).toEqual([]);
    expect(content()).toHaveLength(before + 1);
    expect(node(h, content()[0]!).props.children).toEqual({
      kind: "set",
      value: "Added",
    });
    expect(code(session(h), HOME)).toContain(">Hello</Heading>");
  });

  it("a new `<Popover>` typed in the page is the Popover origin's instance (one step)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add("Text", { children: "Before" });
    const s = session(h);
    const result = apply(h, s, {
      [HOME]: (text) =>
        text.replace(
          "<Text>Before</Text>",
          "<Text>Before</Text>\n      <Popover />",
        ),
    });
    expect(result.rejected).toEqual([]);
    const body = node(h, "project:node:home-body");
    const added = body.children
      .map((id) => node(h, id))
      .find((item) => item.definitionId.endsWith("origin-component-popover"));
    expect(added).toBeTruthy();
    expect(code(session(h), HOME)).toContain('<Slot name="content">');
  });
});
