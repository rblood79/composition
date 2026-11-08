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
 * ADR-296 follow-up (2026-11-05) — a collapsed Library instance's slot position is named by the
 * declared slot (`<Slot name="Tags">`), not by the position node's class (`tag-list`).
 *
 * ADR-301 (2026-11-08) supersedes the overlay half: a Popover · Dialog · Tooltip · Menu · Sheet
 * instance is written as its template tree (`<DialogTrigger><Button/><Popover>…`) — its tag is its
 * template root's RAC type, its slot fill is in place (`<div className="frame">`), and a new
 * `<Popover />` typed in the page is still the Popover origin's instance.
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
  it('a Popover is its template tree — `<DialogTrigger>` · `<Popover>` · the frame in place, no `<Slot>`', async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add("Popover");
    const page = code(session(h), HOME);
    expect(page).toContain("<DialogTrigger>");
    expect(page).toContain('<Popover className="popover">');
    expect(page).toContain('<div className="frame">');
    expect(page).not.toContain("<Slot");
    expect(page).toMatch(
      /import \{[^}]*\bDialogTrigger\b[^}]*\} from 'react-aria-components'/,
    );
  });

  it.each([
    ["Dialog", "DialogTrigger"],
    ["Tooltip", "TooltipTrigger"],
    ["Menu", "MenuTrigger"],
    ["Sheet", "SheetTrigger"],
  ])("%s — its root is the template root's type (%s)", async (type, root) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add(type);
    const page = code(session(h), HOME);
    expect(page).toContain(`<${root}>`);
    expect(page).not.toContain("<Slot");
  });

  it('a collapsed instance names its slot by the declared name (TagGroup `<Slot name="Tags">`)', async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add("TagGroup");
    const page = code(session(h), HOME);
    expect(page).toContain('<Slot name="Tags">');
    expect(page).not.toContain('<Slot name="tag-list"');
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
            '<div className="frame">\n',
            '<div className="frame">\n            <Text>Added</Text>\n',
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
    // (ADR-301 — the new instance is written as its template tree.)
    expect(code(session(h), HOME)).toContain('<div className="frame">');
  });
});
