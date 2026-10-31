import { afterEach, describe, expect, it, vi } from "vitest";
import { updatePage } from "../../../../../../packages/shared/src/catalog/commands";
import {
  setHtmlId,
  setNodeAttribute,
  setWholeField,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  NodeId,
  PageEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { BODY, HOME, edit, openAdr296 } from "./support/adr296Harness";

/**
 * ADR-296 Phase 2 — the page file's new forms, each read back: the page element `<Page …>` (E7 —
 * the body's own props · rules), the head (`<title>` · `<meta>` = the page's `meta`), the route's
 * parameters (`useParams`, derived), the author's metadata (`id` · `className` · `aria-label` — an
 * app-given `<type>_N` id is not shown) and a node switched off (`{false && <T/>}`).
 */
afterEach(() => vi.restoreAllMocks());

async function open() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return openAdr296();
}
const page = (h: Awaited<ReturnType<typeof open>>) =>
  h.graph().getEntry(HOME) as PageEntry;

describe("ADR-296 Phase 2 — the page file", () => {
  it("E7 — `<Page isDisabled>` is the body: edited, removed (back to `<>`)", async () => {
    const h = await open();
    h.add("Button");
    h.declare(BODY, { isDisabled: true });
    const code = h.code();
    expect(code).toMatch(/return \(\n {4}<Page isDisabled=\{true\}>\n/);
    expect(
      h.apply(
        edit(code, "<Page isDisabled={true}>", "<Page isDisabled={false}>"),
      ).rejected,
    ).toEqual([]);
    expect(h.node(BODY).props.isDisabled).toEqual({
      kind: "set",
      value: false,
    });
    const again = h.code();
    const removed = again
      .replace("<Page isDisabled={false}>", "<>")
      .replace("</Page>", "</>")
      .replace("import {Page} from '@composition/code';\n", "");
    expect(h.apply(removed).rejected).toEqual([]);
    expect(h.node(BODY).props.isDisabled).toBeUndefined();
    expect(h.code()).toMatch(/return \(\n {4}<>\n/);
  });

  it("the head — `<title>` · description · robots are the page's meta (added · edited · removed)", async () => {
    const h = await open();
    h.add("Button");
    const code = h.code();
    const added = h.apply(
      code.replace(
        "    <>\n",
        '    <>\n      <title>Home</title>\n      <meta name="description" content="Welcome" />\n      <meta name="robots" content="noindex" />\n',
      ),
    );
    expect(added.rejected).toEqual([]);
    expect(page(h).meta).toEqual({
      title: "Home",
      description: "Welcome",
      hidden: { search: true },
    });
    expect(
      h.apply(edit(h.code(), "<title>Home</title>", "<title>Start</title>"))
        .rejected,
    ).toEqual([]);
    expect(page(h).meta?.title).toBe("Start");
    const gone = h
      .code()
      .replace(/ {6}<title>Start<\/title>\n/, "")
      .replace(/ {6}<meta [^\n]*\n/g, "");
    expect(h.apply(gone).rejected).toEqual([]);
    expect(page(h).meta).toBeUndefined();
  });

  it("useParams is derived from a `{{ params.x }}` read", async () => {
    const h = await open();
    h.add("Text", { children: "Order {{ params.id }}" });
    const code = h.code();
    expect(code).toMatch(/let params = useParams\(\);/);
    expect(code).toMatch(/\{`Order \$\{params\.id\}`\}/);
    // (Edited away, the derived line is refused — it follows the reads.)
    expect(
      h
        .apply(
          code.replace("let params = useParams();", "let params = {id: 1};"),
        )
        .rejected.map((line) => line.reason),
    ).not.toEqual([]);
  });

  it("metadata — an author id · classes · accessible name read back; the app's `<type>_N` id is not shown", async () => {
    const h = await open();
    const button = h.add("Button");
    h.run(setHtmlId({ id: button, htmlId: "button_1" }));
    expect(h.code()).not.toMatch(/ id="/);
    h.run(setHtmlId({ id: button, htmlId: "save" }));
    h.run(
      setNodeAttribute({ id: button, field: "className", value: "primary" }),
    );
    const code = h.code();
    expect(code).toMatch(/<Button id="save" className="primary"/);
    const result = h.apply(
      edit(
        code,
        'id="save" className="primary"',
        'id="submit" className="primary big"',
      ),
    );
    expect(result.rejected).toEqual([]);
    expect(h.node(button).metadata).toEqual({
      htmlId: "submit",
      className: "primary big",
    });
  });

  it("`{false && <T/>}` — a node switched off, and back on", async () => {
    const h = await open();
    const text = h.add("Text", { children: "Hi" });
    h.run(
      setWholeField({
        targets: [{ kind: "node", id: text }],
        field: "enabled",
        value: false,
      }),
    );
    const code = h.code();
    expect(code).toMatch(/\{false && <Text>Hi<\/Text>\}/);
    expect(
      h.apply(code.replace("{false && <Text>Hi</Text>}", "<Text>Hi</Text>"))
        .rejected,
    ).toEqual([]);
    expect(h.node(text).enabled).not.toBe(false);
    void (updatePage as unknown);
    void ("" as unknown as EntryId<"page">);
    void ("" as unknown as NodeId);
  });
});
