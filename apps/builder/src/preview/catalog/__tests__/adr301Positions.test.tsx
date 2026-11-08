import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setFields,
  setWholeField,
  unlockOrigin,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  codeViewAddressKey,
  codeViewAddressOf,
} from "../../../../../../packages/shared/src/codeView/files/overrides";
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
 * ADR-301 Phase 2 (G2) — an edit at an expanded instance's template position is written where the
 * value lives (Decision 4): a position's own value → its descendant patch; a value its template
 * binds to the instance's prop (`size: "{size}"`) that only it reads → that prop; `{false && …}` and
 * deleting the element whole → `enabled: false` (사용자 결정 3 · 4); a handler → the position's own
 * rule; structure edits refused (`readOnlyPosition`). The same commands as the Design panel's.
 */
afterEach(() => vi.restoreAllMocks());

const HOME = "src/pages/Home.tsx";

function session(h: Adr296Harness) {
  const s = catalogCodeViewProjectSession(h.graph());
  for (const file of codeViewFileTree(h.graph()))
    catalogCodeViewFileBaseline(s, h.graph(), file.path);
  return s;
}
const code = (s: CatalogCodeViewProjectSession) =>
  s.baselines.get(HOME)?.result.code ?? "";
/** The panel's Apply of one edit of the page (the editor's line changes — identity kept). */
function apply(h: Adr296Harness, edit: (text: string) => string) {
  const s = session(h);
  const before = code(s);
  const edited = edit(before);
  expect(edited).not.toBe(before);
  return catalogCodeViewProjectApply(h.workspace, s, [
    { path: HOME, edited, changes: editorChanges(before, edited) },
  ]);
}
const history = (h: Adr296Harness) => h.workspace.runtime.historyDepth.undo;
const node = (h: Adr296Harness, id: string) =>
  h.graph().getEntry(id) as NodeEntry;
const at = (h: Adr296Harness, owner: string, key: string) =>
  codeViewAddressOf(h.graph() as never, owner, key, undefined, true)!;
/** The instance's patch at a position (its key). */
const patchAt = (h: Adr296Harness, owner: string, key: string) =>
  node(h, owner).descendantOverrides.find(
    (item) =>
      item.kind !== "replace" &&
      codeViewAddressKey(h.graph() as never, item.address) === key,
  ) as
    | (NodeEntry["descendantOverrides"][number] & {
        props?: Record<string, unknown>;
        enabled?: boolean;
      })
    | undefined;
const pageNow = (h: Adr296Harness) => code(session(h));

async function open() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return openAdr296();
}

describe("ADR-301 G2 — a position's value is written at the layer that makes it", () => {
  it("a template node's own text (the Dialog's Heading) → the position's patch; one step · one Undo", async () => {
    const h = await open();
    const dialog = h.add("Dialog");
    const steps = history(h);
    const result = apply(h, (text) =>
      text.replace(
        '<Heading className="heading" />',
        '<Heading className="heading">Sign up</Heading>',
      ),
    );
    expect(result.rejected).toEqual([]);
    expect(history(h)).toBe(steps + 1);
    expect(patchAt(h, dialog, "heading")?.props?.children).toEqual({
      kind: "set",
      value: "Sign up",
    });
    expect(pageNow(h)).toContain(
      '<Heading className="heading">Sign up</Heading>',
    );
    h.workspace.undo();
    expect(patchAt(h, dialog, "heading")?.props?.children).toBeUndefined();
  });

  it("a nested origin's prop (the trigger Button's label) → the position's patch", async () => {
    const h = await open();
    const popover = h.add("Popover");
    const result = apply(h, (text) =>
      text.replace(
        '<Button className="button" />',
        '<Button label="Settings" className="button" />',
      ),
    );
    expect(result.rejected).toEqual([]);
    expect(patchAt(h, popover, "button")?.props?.label).toEqual({
      kind: "set",
      value: "Settings",
    });
    expect(node(h, popover).props.label).toBeUndefined();
  });

  it("a bound prop only this position reads (`size` → the overlay) with no patch → the instance's prop", async () => {
    const h = await open();
    const popover = h.add("Popover");
    h.declare(popover as NodeId, { size: "L" });
    const result = apply(h, (text) =>
      text.replace(
        '<Popover size="L" className="popover">',
        '<Popover size="M" className="popover">',
      ),
    );
    expect(result.rejected).toEqual([]);
    expect(node(h, popover).props.size).toEqual({ kind: "set", value: "M" });
    expect(patchAt(h, popover, "popover")?.props?.size).toBeUndefined();
    // Taken off → the instance's prop is released.
    expect(apply(h, (text) => text.replace(' size="M"', "")).rejected).toEqual(
      [],
    );
    expect(node(h, popover).props.size).toBeUndefined();
  });

  it("root L + patch S, edited to M → the patch M, the root L kept (shown M); taken off → both released", async () => {
    const h = await open();
    const popover = h.add("Popover");
    h.declare(popover as NodeId, { size: "L" });
    h.run(
      setFields({
        targets: [
          {
            kind: "descendant",
            ownerId: popover as NodeId,
            address: at(h, popover, "popover"),
          },
        ],
        props: { size: { kind: "set", value: "S" } },
        label: "Patch",
      }),
    );
    expect(pageNow(h)).toContain('<Popover size="S" className="popover">');
    const result = apply(h, (text) =>
      text.replace('<Popover size="S"', '<Popover size="M"'),
    );
    expect(result.rejected).toEqual([]);
    expect(patchAt(h, popover, "popover")?.props?.size).toEqual({
      kind: "set",
      value: "M",
    });
    expect(node(h, popover).props.size).toEqual({ kind: "set", value: "L" });
    expect(pageNow(h)).toContain('<Popover size="M" className="popover">');
    expect(
      apply(h, (text) => text.replace('<Popover size="M"', "<Popover"))
        .rejected,
    ).toEqual([]);
    expect(pageNow(h)).toContain('<Popover className="popover">');
    expect(node(h, popover).props.size).toBeUndefined();
  });

  it("a key several positions read (Menu `size`) → that position's patch, the others untouched", async () => {
    const h = await open();
    const menu = h.add("Menu");
    const result = apply(h, (text) =>
      text.replace(
        '<Menu className="menu">',
        '<Menu size="L" className="menu">',
      ),
    );
    expect(result.rejected).toEqual([]);
    expect(node(h, menu).props.size).toBeUndefined();
    expect(patchAt(h, menu, "menu")?.props?.size).toEqual({
      kind: "set",
      value: "L",
    });
    expect(pageNow(h)).toContain('<ActionButton className="action-button" />');
  });

  it("the same position edited in the Design panel (a descendant patch) gives the same document", async () => {
    const viaCode = await open();
    const a = viaCode.add("Dialog");
    apply(viaCode, (text) =>
      text.replace(
        '<Heading className="heading" />',
        '<Heading className="heading">Sign up</Heading>',
      ),
    );
    const viaPanel = await open();
    const b = viaPanel.add("Dialog");
    viaPanel.run(
      setFields({
        targets: [
          {
            kind: "descendant",
            ownerId: b as NodeId,
            address: at(viaPanel, b, "heading"),
          },
        ],
        props: { children: { kind: "set", value: "Sign up" } },
        label: "Panel",
      }),
    );
    const shape = (h: Adr296Harness, id: string) =>
      JSON.stringify(
        node(h, id).descendantOverrides.map((item) => ({
          ...item,
          address: codeViewAddressKey(h.graph() as never, item.address),
          childIds: "childIds" in item ? item.childIds.length : undefined,
        })),
      );
    expect(shape(viaCode, a)).toBe(shape(viaPanel, b));
  });
});

describe("ADR-301 G2 — hiding · deleting a position (사용자 결정 3 · 4)", () => {
  it("`{false && …}` around the OverlayArrow → `enabled: false`; unwrapped → shown again", async () => {
    const h = await open();
    const popover = h.add("Popover");
    expect(
      apply(h, (text) =>
        text.replace(
          '<OverlayArrow className="overlay-arrow" />',
          '{false && <OverlayArrow className="overlay-arrow" />}',
        ),
      ).rejected,
    ).toEqual([]);
    expect(patchAt(h, popover, "overlay-arrow")?.enabled).toBe(false);
    expect(
      apply(h, (text) =>
        text.replace(
          '{false && <OverlayArrow className="overlay-arrow" />}',
          '<OverlayArrow className="overlay-arrow" />',
        ),
      ).rejected,
    ).toEqual([]);
    expect(patchAt(h, popover, "overlay-arrow")?.enabled).toBeUndefined();
  });

  it("the element deleted whole → the same `enabled: false` (the code shows `{false && …}` after)", async () => {
    const wrapped = await open();
    const a = wrapped.add("Popover");
    apply(wrapped, (text) =>
      text.replace(
        '<OverlayArrow className="overlay-arrow" />',
        '{false && <OverlayArrow className="overlay-arrow" />}',
      ),
    );
    const deleted = await open();
    const b = deleted.add("Popover");
    const result = apply(deleted, (text) =>
      text.replace(
        '          <OverlayArrow className="overlay-arrow" />\n',
        "",
      ),
    );
    expect(result.rejected).toEqual([]);
    expect(patchAt(deleted, b, "overlay-arrow")?.enabled).toBe(false);
    expect(patchAt(wrapped, a, "overlay-arrow")?.enabled).toBe(false);
    expect(pageNow(deleted)).toContain(
      '{false && <OverlayArrow className="overlay-arrow" />}',
    );
  });

  it("a deletion with another edit in the same Apply · another position already hidden stays hidden", async () => {
    const h = await open();
    const dialog = h.add("Dialog");
    h.run(
      setWholeField({
        targets: [
          {
            kind: "descendant",
            ownerId: dialog as NodeId,
            address: at(h, dialog, "button-2"),
          },
        ],
        field: "enabled",
        value: false,
      }),
    );
    const result = apply(h, (text) =>
      text
        .replace('            <Heading className="heading" />\n', "")
        .replace(
          '<Button className="button" />',
          '<Button label="Open" className="button" />',
        ),
    );
    expect(result.rejected).toEqual([]);
    expect(patchAt(h, dialog, "heading")?.enabled).toBe(false);
    expect(patchAt(h, dialog, "button-2")?.enabled).toBe(false);
    expect(patchAt(h, dialog, "button")?.props?.label).toEqual({
      kind: "set",
      value: "Open",
    });
  });

  it("a deletion does not hide a difference elsewhere (a fill child's text typed over — still read)", async () => {
    const h = await open();
    h.add("Popover");
    const result = apply(h, (text) =>
      text
        .replace('          <OverlayArrow className="overlay-arrow" />\n', "")
        .replace(">Popover Title</Heading>", ">Hi</Heading>"),
    );
    expect(result.rejected).toEqual([]);
    expect(pageNow(h)).toContain(">Hi</Heading>");
  });
});

describe("ADR-301 G2 — handlers · isolation · refusals", () => {
  it("a handler at a position is the position's own rule (address); edited · removed", async () => {
    const h = await open();
    const popover = h.add("Popover");
    const address = at(h, popover, "button");
    h.rules(
      popover as NodeId,
      [{ trigger: "onPress", actions: [{ opcode: "toast", message: "one" }] }],
      address as never,
    );
    const text = pageNow(h);
    expect(text).toMatch(/<Button onPress=\{\(\) => \{/);
    expect(apply(h, (page) => page.replace("'one'", "'two'")).rejected).toEqual(
      [],
    );
    const rules = h.rulesOf(popover);
    expect(rules).toHaveLength(1);
    expect(rules[0]!.address).toEqual(address);
    expect(JSON.stringify(rules[0]!.actions)).toContain("two");
    // Removed: the attribute taken off → the position has no rule.
    expect(
      apply(h, (page) =>
        page.replace(/<Button onPress=\{[\s\S]*?\}\} className="button"/, '<Button className="button"'),
      ).rejected,
    ).toEqual([]);
    expect(h.rulesOf(popover)).toEqual([]);
  });

  it("two instances of the same origin — an edit of A's position leaves B as it was", async () => {
    const h = await open();
    const a = h.add("Dialog");
    const b = h.add("Dialog");
    const result = apply(h, (text) =>
      text.replace(
        '<Heading className="heading" />',
        '<Heading className="heading">Only A</Heading>',
      ),
    );
    expect(result.rejected).toEqual([]);
    expect(patchAt(h, a, "heading")?.props?.children).toEqual({
      kind: "set",
      value: "Only A",
    });
    expect(patchAt(h, b, "heading")).toBeUndefined();
  });

  it.each([
    [
      "a type change",
      (text: string) =>
        text
          .replace(
            '<Popover className="popover">',
            '<Modal className="popover">',
          )
          .replace("</Popover>", "</Modal>"),
    ],
    [
      "an element outside the slot",
      (text: string) =>
        text.replace(
          '<OverlayArrow className="overlay-arrow" />',
          '<OverlayArrow className="overlay-arrow" />\n          <Text>Extra</Text>',
        ),
    ],
    [
      "the trigger moved after the overlay",
      (text: string) =>
        text
          .replace('        <Button className="button" />\n', "")
          .replace(
            "        </Popover>\n",
            '        </Popover>\n        <Button className="button" />\n',
          ),
    ],
    [
      "an `overrides` on the expanded root",
      (text: string) =>
        text.replace(
          "<DialogTrigger>",
          "<DialogTrigger overrides={{'heading': {hidden: true}}}>",
        ),
    ],
  ])("%s is refused — the document unchanged", async (_label, edit) => {
    const h = await open();
    h.add("Popover");
    const revision = h.graph().revision;
    const result = apply(h, edit);
    expect(result.rejected.length).toBeGreaterThan(0);
    expect(h.graph().revision).toBe(revision);
  });

  it("the refusal names the origin; its unlock (one command) makes the same edit go through in the Local file", async () => {
    const h = await open();
    const popover = h.add("Popover");
    const extra = (text: string) =>
      text.replace(
        /<OverlayArrow( className="[^"]*")? \/>/,
        (match) => `${match}\n<Text>Extra</Text>`,
      );
    const refused = apply(h, extra).rejected;
    const line = refused.find((item) => item.reason === "readOnlyPosition");
    expect(line?.detail).toBe(node(h, popover).definitionId);
    h.run(
      unlockOrigin({
        definitionId: line!.detail as never,
        newId: h.workspace.newId,
      }),
    );
    // (Unlocked: the instance is the Local copy's — one element in the page, its tree in its file.)
    const s = session(h);
    expect(code(s)).not.toContain("<OverlayArrow");
    const file = [...s.baselines.keys()].find(
      (path) =>
        path !== HOME &&
        (s.baselines.get(path)?.result.code ?? "").includes("<OverlayArrow"),
    )!;
    expect(file).toBeTruthy();
    const before = s.baselines.get(file)!.result.code;
    const edited = extra(before);
    const result = catalogCodeViewProjectApply(h.workspace, s, [
      { path: file, edited, changes: editorChanges(before, edited) },
    ]);
    expect(result.rejected).toEqual([]);
    expect(
      session(h).baselines.get(file)!.result.code,
    ).toContain("<Text>Extra</Text>");
  });

  it("an element in the slot frame is added to the fill (`fillSlot`)", async () => {
    const h = await open();
    const popover = h.add("Popover");
    const fill = () =>
      node(h, popover).descendantOverrides.find(
        (item) => item.kind === "fillSlot",
      ) as unknown as { childIds: string[] };
    const before = fill().childIds.length;
    const result = apply(h, (text) =>
      text.replace(
        '<div className="frame">\n',
        '<div className="frame">\n            <Switch>Mute</Switch>\n',
      ),
    );
    expect(result.rejected).toEqual([]);
    expect(fill().childIds).toHaveLength(before + 1);
  });
});
