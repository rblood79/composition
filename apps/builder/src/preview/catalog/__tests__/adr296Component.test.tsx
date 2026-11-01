import { codeViewTreeClasses } from "../../../../../../packages/shared/src/codeView/files/overrides";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addComponentOutputProperty,
  createComponent,
  insertNodes,
  setEndpoint,
  setSlotDeclaration,
  unlockOrigin,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  NodeEntry,
  NodeId,
  ProjectEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { codeViewFileTree } from "../../../../../../packages/shared/src/codeView/files/tree";
import { codeViewAddressKey } from "../../../../../../packages/shared/src/codeView/files/overrides";
import { catalogInheritedRuleEnabledCommand } from "../../../builder/catalogRuntime/interactions";
import {
  catalogCodeViewFileBaseline,
  catalogCodeViewProjectApply,
  catalogCodeViewProjectSession,
  type CatalogCodeViewProjectSession,
} from "../../../builder/catalogRuntime/codeViewApply";
import {
  BODY,
  editorChanges,
  openAdr296,
  type Adr296Harness,
} from "./support/adr296Harness";

/**
 * ADR-296 Phase 5 (G1 · G2 · G4 — R10) — a user component is its own file
 * (`src/components/<Name>.tsx` — its origin: edits there are origin commands, every instance
 * follows) and a page writes its instance by the component's name (`<Picker …/>`). An instance's
 * own share — a position's props, an inherited rule off or replaced, its own rule there — is its
 * `overrides` (instance commands only: the other instances never change).
 */
afterEach(() => vi.restoreAllMocks());

const HOME = "src/pages/Home.tsx";
const PICKER = "src/components/Picker.tsx";

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
const history = (h: Adr296Harness) => h.workspace.runtime.historyDepth.undo;
/** Text typed right after the first `after` of a file (one editor change — identity kept). */
function insertIn(
  h: Adr296Harness,
  s: CatalogCodeViewProjectSession,
  path: string,
  after: string,
  text: string,
) {
  const before = code(s, path);
  const at = before.indexOf(after) + after.length;
  return catalogCodeViewProjectApply(h.workspace, s, [
    {
      path,
      edited: before.slice(0, at) + text + before.slice(at),
      changes: [{ fromA: at, toA: at, insert: text }],
    },
  ]);
}
const node = (h: Adr296Harness, id: string) =>
  h.graph().getEntry(id) as NodeEntry;

/** `Picker` = a frame holding a Button, placed twice (A · B). */
async function picker() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr296();
  const frame = h.add("frame", {}, BODY, "picker");
  const button = h.add("Button", { label: "Save" }, frame, "save-button");
  h.run(
    createComponent({ id: frame, name: "Picker", newId: h.workspace.newId }),
  );
  const project = h.graph().getEntry(h.graph().projectId) as ProjectEntry;
  const definitionId = project.definitionIds.at(-1)! as EntryId<"definition">;
  const A = h.node(BODY).children[0]! as NodeId;
  const B = "project:node:picker-b" as NodeId;
  h.run(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: B,
          definitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [B],
      newId: h.workspace.newId,
    }),
  );
  return { h, frame, button, A, B, definitionId };
}

describe("ADR-296 Phase 5 — component files and instances", () => {
  it("a component is its file; a page writes its instances by its name", async () => {
    const { h } = await picker();
    const s = session(h);
    expect(codeViewFileTree(h.graph()).map((file) => file.path)).toContain(
      PICKER,
    );
    const component = code(s, PICKER);
    expect(component).toContain("type PickerProps = {};");
    expect(component).toContain("export function Picker(props: PickerProps) {");
    expect(component).toMatch(/<div>\n\s+<Button label="Save" \/>\n\s+<\/div>/);
    const page = code(s, HOME);
    expect(page).toContain("import {Picker} from './components/Picker';");
    expect(page).toMatch(/<Picker \/>\n\s+<Picker \/>/);
  });

  it("strict: the component and page files pasted over themselves plan nothing", async () => {
    const { h } = await picker();
    const s = session(h);
    const revision = h.graph().revision;
    const result = catalogCodeViewProjectApply(
      h.workspace,
      s,
      [PICKER, HOME].map((path) => ({
        path,
        edited: code(s, path),
        changes: [],
      })),
    );
    expect(result.rejected).toEqual([]);
    expect(h.graph().revision).toBe(revision);
  });

  it("an edit of the component file is the origin's (every instance follows) — one step", async () => {
    const { h, button } = await picker();
    const s = session(h);
    const before = history(h);
    const result = apply(h, s, {
      [PICKER]: (text) =>
        text.replace(
          '<Button label="Save" />',
          "<Button label=\"Store\" onPress={() => {\n        queue.add({title: 'saved'});\n      }} />",
        ),
    });
    expect(result.rejected).toEqual([]);
    expect(history(h)).toBe(before + 1);
    // The origin's own node changed — not an instance patch.
    expect(node(h, button).props.label).toEqual({
      kind: "set",
      value: "Store",
    });
    expect(h.rulesOf(button).map((rule) => rule.actions)).toEqual([
      [{ opcode: "toast", message: "saved" }],
    ]);
    // Both instances draw it (their own overrides stay empty).
    for (const instance of h.node(BODY).children)
      expect(node(h, instance).descendantOverrides).toEqual([]);
  });

  it("a page writes a new instance by the component's name", async () => {
    const { h, definitionId } = await picker();
    const s = session(h);
    const result = apply(h, s, {
      [HOME]: (text) =>
        text.replace("<Picker />\n", "<Picker />\n      <Picker />\n"),
    });
    expect(result.rejected).toEqual([]);
    const children = h.node(BODY).children;
    expect(children).toHaveLength(3);
    expect(node(h, children[1]!).definitionId).toBe(definitionId);
  });

  it("overrides — an origin rule off · replaced and an own rule at A's button; B has none", async () => {
    const { h, frame, button, A, B } = await picker();
    const [first, second] = h.rules(button, [
      { trigger: "onPress", actions: [{ opcode: "toast", message: "one" }] },
      { trigger: "onPress", actions: [{ opcode: "toast", message: "two" }] },
    ]);
    const address = { instances: [A], templatePath: [frame, button] };
    h.run(
      catalogInheritedRuleEnabledCommand(
        { ownerId: A, address } as never,
        first as EntryId<"interaction">,
        false,
      ),
    );
    h.rules(
      A,
      [
        {
          trigger: "onPress",
          actions: [{ opcode: "toast", message: "A only" }],
        },
      ],
      address as never,
    );
    const s = session(h);
    const page = code(s, HOME);
    expect(page).toContain(
      "'save-button': {onPress: rules({inherited: {onSaveButtonPress: 'off'}, own: [() => {",
    );
    // Strict: pasted over itself — nothing.
    const revision = h.graph().revision;
    expect(
      catalogCodeViewProjectApply(h.workspace, s, [
        { path: HOME, edited: page, changes: [] },
      ]).rejected,
    ).toEqual([]);
    expect(h.graph().revision).toBe(revision);
    void second;
    void B;
  });

  it("G4 — overrides are A's only: props · hidden · an origin rule off · replaced · own (B and the origin unchanged)", async () => {
    const { h, frame, button, A, B } = await picker();
    const [first, second] = h.rules(button, [
      { trigger: "onPress", actions: [{ opcode: "toast", message: "one" }] },
      { trigger: "onPress", actions: [{ opcode: "toast", message: "two" }] },
    ]);
    const origin = () => h.rulesOf(button).map((rule) => rule.actions);
    const originBefore = origin();
    const s = session(h);
    const before = history(h);
    // (Typed inside A's tag — the element keeps its identity.)
    const result = insertIn(
      h,
      s,
      HOME,
      "<Picker",
      [
        " overrides={{",
        "        'save-button': {label: 'Go', hidden: true, onPress: rules({inherited: {onSaveButtonPress: 'off', onSaveButtonPress2: () => {",
        "          queue.add({title: 'replaced'});",
        "        }}, own: [() => {",
        "          queue.add({title: 'A only'});",
        "        }]})},",
        "      }}",
      ].join("\n"),
    );
    expect(result.rejected).toEqual([]);
    expect(history(h)).toBe(before + 1);
    const patch = node(h, A).descendantOverrides[0] as {
      address: unknown;
      props?: unknown;
      enabled?: boolean;
      interactions?: Record<string, string>;
    };
    expect(patch.address).toEqual({
      instances: [A],
      templatePath: [frame, button],
    });
    expect(patch.props).toEqual({ label: { kind: "set", value: "Go" } });
    expect(patch.enabled).toBe(false);
    expect(patch.interactions?.[first!]).toBe("off");
    const replacement = patch.interactions?.[second!];
    expect(replacement).toMatch(/^project:interaction:/);
    const own = h
      .rulesOf(A)
      .filter((rule) => rule.address)
      .map((rule) => [rule.id === replacement, rule.actions]);
    expect(own).toEqual([
      [true, [{ opcode: "toast", message: "replaced" }]],
      [false, [{ opcode: "toast", message: "A only" }]],
    ]);
    // B and the origin: unchanged (instance commands only — R10).
    expect(node(h, B).descendantOverrides).toEqual([]);
    expect(h.rulesOf(B)).toEqual([]);
    expect(origin()).toEqual(originBefore);
    // The code reads back as written (strict) and an edit of the own body reads too.
    const s2 = session(h);
    const back = apply(h, s2, {
      [HOME]: (text) => text.replace("'A only'", "'A changed'"),
    });
    expect(back.rejected).toEqual([]);
    expect(
      h.rulesOf(A).find((rule) => rule.address && rule.id !== replacement)
        ?.actions,
    ).toEqual([{ opcode: "toast", message: "A changed" }]);
    // Removing the entry: the rules come back, the patch goes.
    const s3 = session(h);
    const cleared = apply(h, s3, {
      [HOME]: (text) =>
        text.replace(/<Picker overrides=\{\{[\s\S]*?\}\} \/>/, "<Picker />"),
    });
    expect(cleared.rejected).toEqual([]);
    expect(h.rulesOf(A).filter((rule) => rule.address)).toEqual([]);
    expect(
      (
        node(h, A).descendantOverrides[0] as
          { interactions?: unknown } | undefined
      )?.interactions,
    ).toBeUndefined();
  });

  it("G4 nested — 'left-picker/save-button' and 'right-picker/save-button' are two positions (review round 2 h1)", async () => {
    const { h, frame, button, definitionId } = await picker();
    // Outer = a frame holding two Picker instances (left · right), placed once (O).
    const outerFrame = h.add("frame", {}, BODY, "outer");
    const place = (name: string) => {
      const id = `project:node:${name}` as NodeId;
      h.run(
        insertNodes({
          parent: { kind: "node", id: outerFrame },
          entries: [
            {
              kind: "node",
              id,
              name,
              definitionId,
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: [id],
          newId: h.workspace.newId,
        }),
      );
      return id;
    };
    const left = place("left-picker");
    const right = place("right-picker");
    h.run(
      createComponent({
        id: outerFrame,
        name: "Outer",
        newId: h.workspace.newId,
      }),
    );
    const O = h.node(BODY).children.at(-1)! as NodeId;
    const s = session(h);
    expect(code(s, HOME)).toContain("<Outer />");
    const result = insertIn(
      h,
      s,
      HOME,
      "<Outer",
      " overrides={{\n        'left-picker/save-button': {label: 'L', onPress: rules({own: [() => {\n          queue.add({title: 'left'});\n        }]})},\n      }}",
    );
    expect(result.rejected).toEqual([]);
    const leftAddress = { instances: [O, left], templatePath: [frame, button] };
    expect(node(h, O).descendantOverrides).toEqual([
      expect.objectContaining({
        address: leftAddress,
        props: { label: { kind: "set", value: "L" } },
      }),
    ]);
    expect(h.rulesOf(O).map((rule) => [rule.address, rule.actions])).toEqual([
      [leftAddress, [{ opcode: "toast", message: "left" }]],
    ]);
    // The right one: nothing.
    expect(
      node(h, O).descendantOverrides.some((item) =>
        (item.address.instances as readonly string[]).includes(right),
      ),
    ).toBe(false);
    // And it reads back (strict).
    const s2 = session(h);
    expect(code(s2, HOME)).toContain(
      "'left-picker/save-button': {label: 'L', onPress: rules({own: [() => {",
    );
    const revision = h.graph().revision;
    expect(
      catalogCodeViewProjectApply(h.workspace, s2, [
        { path: HOME, edited: code(s2, HOME), changes: [] },
      ]).rejected,
    ).toEqual([]);
    expect(h.graph().revision).toBe(revision);
  });

  it("styles: the component's template in components/<Name>.css (origin) · A's position in the page CSS (instance)", async () => {
    const { h, frame, button, A, B } = await picker();
    const s = session(h);
    expect(codeViewFileTree(h.graph()).map((file) => file.path)).toContain(
      "src/components/Picker.css",
    );
    const result = apply(h, s, {
      "src/components/Picker.css": () =>
        ".save-button {\n  color: #0000ff;\n}\n",
      "src/pages/Home.css": () =>
        ".picker .save-button {\n  color: #ff0000;\n}\n\n@media (max-width: 767px) {\n  .picker .save-button {\n    font-size: 12px;\n  }\n}\n",
    });
    expect(result.rejected).toEqual([]);
    // The origin's own node (every instance) …
    expect(node(h, button).visual.color).toEqual({
      kind: "set",
      value: "#0000ff",
    });
    // … and A's position only.
    const patch = node(h, A).descendantOverrides[0] as {
      address: unknown;
      visual?: unknown;
      responsive?: { mobile?: { visual?: unknown } };
    };
    expect(patch.address).toEqual({
      instances: [A],
      templatePath: [frame, button],
    });
    expect(patch.visual).toEqual({ color: { kind: "set", value: "#ff0000" } });
    expect(patch.responsive?.mobile?.visual).toEqual({
      fontSize: { kind: "set", value: 12 },
    });
    expect(node(h, B).descendantOverrides).toEqual([]);
    // Regenerated: the component imports its CSS, the template button its class, A its class.
    const s2 = session(h);
    expect(code(s2, PICKER)).toContain("import './Picker.css';");
    expect(code(s2, PICKER)).toContain('className="save-button"');
    expect(code(s2, HOME)).toMatch(/<Picker className="picker"/);
    const revision = h.graph().revision;
    expect(
      catalogCodeViewProjectApply(
        h.workspace,
        s2,
        [PICKER, HOME, "src/components/Picker.css", "src/pages/Home.css"].map(
          (path) => ({ path, edited: code(s2, path), changes: [] }),
        ),
      ).rejected,
    ).toEqual([]);
    expect(h.graph().revision).toBe(revision);
  });

  it("결정 3 — a Library origin: read only (an edit is refused); unlocked, it is a component file (origin commands on its copy)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add("Card");
    const libraryFile = codeViewFileTree(h.graph()).find(
      (file) => file.kind === "library" && file.path.endsWith("/Card.tsx"),
    )!;
    expect(libraryFile).toMatchObject({
      path: "node_modules/@composition/library/Card.tsx",
      readOnly: true,
    });
    const s = session(h);
    const text = code(s, libraryFile.path);
    expect(text).toContain("export function Card(props: CardProps) {");
    const refused = catalogCodeViewProjectApply(h.workspace, s, [
      { path: libraryFile.path, edited: `${text}\n// x`, changes: [] },
    ]);
    expect(refused.rejected.map((line) => line.reason)).toEqual([
      "readOnlyFile",
    ]);
    // 「Unlock」 = ADR-282 `unlockOrigin` (one command) — the origin becomes the project's file.
    h.run(
      unlockOrigin({
        definitionId: libraryFile.id as never,
        newId: h.workspace.newId,
      }),
    );
    const tree = codeViewFileTree(h.graph());
    expect(tree.some((file) => file.path === libraryFile.path)).toBe(false);
    const local = tree.find((file) => file.path === "src/components/Card.tsx")!;
    expect(local).toMatchObject({ kind: "component", id: libraryFile.id });
    const s2 = session(h);
    const before = code(s2, local.path);
    // Strict: pasted over itself — nothing.
    const revision = h.graph().revision;
    expect(
      catalogCodeViewProjectApply(h.workspace, s2, [
        { path: local.path, edited: before, changes: [] },
      ]).rejected,
    ).toEqual([]);
    expect(h.graph().revision).toBe(revision);
  });

  it("G2 — a new components/Tile.tsx and a page that places <Tile /> — one Apply, one step (a React Aria · Library name like Card would be Card2 — R6)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const s = session(h);
    const before = history(h);
    const card = [
      "import {Button} from 'react-aria-components';",
      "",
      "type TileProps = {};",
      "",
      "export function Tile(props: TileProps) {",
      "  return (",
      "    <>",
      "      <div>",
      '        <Button label="Go" />',
      "      </div>",
      "    </>",
      "  );",
      "}",
      "",
    ].join("\n");
    const page = code(s, HOME)
      .replace("    <>\n    </>", "    <>\n      <Tile />\n    </>")
      .replace(
        "export default function Home() {",
        "import {Tile} from './components/Tile';\n\nexport default function Home() {",
      );
    const result = catalogCodeViewProjectApply(h.workspace, s, [
      { path: "src/components/Tile.tsx", edited: card, changes: [] },
      { path: HOME, edited: page, changes: [] },
    ]);
    expect(result.rejected).toEqual([]);
    expect(history(h)).toBe(before + 1);
    const project = h.graph().getEntry(h.graph().projectId) as ProjectEntry;
    const definition = project.definitionIds
      .map(
        (id) =>
          h.graph().getEntry(id) as { name?: string; templateRootId?: string },
      )
      .find((entry) => entry.name === "Tile");
    expect(definition?.templateRootId).toBeDefined();
    const children = h.node(BODY).children;
    expect(children).toHaveLength(1);
    expect(node(h, children[0]!).definitionId).toBe(
      project.definitionIds.find(
        (id) => (h.graph().getEntry(id) as { name?: string }).name === "Tile",
      ),
    );
    expect(code(session(h), "src/components/Tile.tsx")).toContain(
      '<Button label="Go" />',
    );
  });

  it("slot contents — a Card's positions are `<Slot name>` (its children the position's fill: edit · add)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const card = h.add("Card");
    const s = session(h);
    const page = code(s, HOME);
    expect(page).toContain('<Slot name="content">');
    // Strict: pasted over itself — nothing.
    const revision = h.graph().revision;
    expect(
      catalogCodeViewProjectApply(h.workspace, s, [
        { path: HOME, edited: page, changes: [] },
      ]).rejected,
    ).toEqual([]);
    expect(h.graph().revision).toBe(revision);
    const content = () =>
      (
        node(h, card).descendantOverrides.find(
          (item) =>
            item.kind === "fillSlot" &&
            codeViewAddressKey(h.graph() as never, item.address) === "content",
        ) as unknown as { childIds: string[] }
      ).childIds;
    const before = content().length;
    const result = apply(h, s, {
      [HOME]: (text) =>
        text
          .replace(">Card Title</Text>", ">Hello</Text>")
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
    expect(code(session(h), HOME)).toContain(">Hello</Text>");
  });

  it("a template node's declarations (`composition={{slot · showWhen}}`) and the component's name", async () => {
    const { h, button, definitionId } = await picker();
    h.run(
      setSlotDeclaration({
        id: button,
        slot: { name: "action", required: false },
      }),
    );
    const s = session(h);
    const text = code(s, PICKER);
    expect(text).toContain(
      "composition={{slot: {name: 'action', required: false}}}",
    );
    const result = apply(h, s, {
      [PICKER]: (file) =>
        file
          .replace("required: false", "required: true")
          .replace(
            /function Picker\(props: PickerProps\)/,
            "function Chooser(props: ChooserProps)",
          )
          .replace("type PickerProps", "type ChooserProps"),
    });
    expect(result.rejected).toEqual([]);
    expect(node(h, button).slot).toEqual({ name: "action", required: true });
    expect((h.graph().getEntry(definitionId) as { name: string }).name).toBe(
      "Chooser",
    );
    expect(codeViewFileTree(h.graph()).map((file) => file.path)).toContain(
      "src/components/Chooser.tsx",
    );
  });

  // ── 판독 Phase 5 (MEDIUM 3) ──
  it("판독 MEDIUM-1 — an own rule reading its event value round-trips (`(value) => {…}`)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const frame = h.add("frame", {}, BODY, "settings");
    const toggle = h.add("Switch", {}, frame, "dark-switch");
    h.run(
      createComponent({ id: frame, name: "Settings", newId: h.workspace.newId }),
    );
    const A = h.node(BODY).children[0]! as NodeId;
    h.variable("picked", "boolean", false);
    h.rules(
      A,
      [
        {
          trigger: "onChange",
          actions: [
            {
              opcode: "setState",
              variableId: "project:stateVariable:picked" as never,
              op: "set",
              value: "!event.value",
            } as never,
          ],
        },
      ],
      { instances: [A], templatePath: [frame, toggle] } as never,
    );
    const s = session(h);
    const page = code(s, HOME);
    expect(page).toMatch(/onChange: rules\(\{own: \[\(value\) => \{/);
    const revision = h.graph().revision;
    expect(
      catalogCodeViewProjectApply(h.workspace, s, [
        { path: HOME, edited: page, changes: [] },
      ]).rejected,
    ).toEqual([]);
    expect(h.graph().revision).toBe(revision);
    // An edit of another key of the same overrides applies.
    const result = apply(h, s, {
      [HOME]: (text) =>
        text.replace("'dark-switch': {", "'dark-switch': {isDisabled: true, "),
    });
    expect(result.rejected).toEqual([]);
  });

  it("판독 MEDIUM-2 — a template's names are one table (a slot fill's node takes its number too)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const frame = h.add("frame", {}, BODY, "box");
    h.add("Card", {}, frame);
    const text = h.add("Text", { children: "Plain" }, frame);
    h.run(createComponent({ id: frame, name: "Box", newId: h.workspace.newId }));
    const s = session(h);
    const file = code(s, "src/components/Box.tsx");
    // The template Text's class in the component file …
    const shown = /<Text className="([\w-]+)">Plain<\/Text>|<Text>Plain<\/Text>/.exec(file);
    expect(shown).not.toBeNull();
    // (The Card's slot contents take `text` · `text-2` — the template Text is `text-3` in both
    // the component file's table and the page's overrides keys.)
    const key = shown![1] ?? codeViewTreeClasses(h.graph() as never, [frame]).get(text);
    expect(key).toBe("text-3");
    // … is the key the page's overrides use for it.
    const result = apply(h, s, {
      [HOME]: (page) =>
        page.replace(
          "<Box />",
          `<Box overrides={{\n        '${key}': {children: 'Changed'},\n      }} />`,
        ),
    });
    expect(result.rejected).toEqual([]);
    const J = h.node(BODY).children[0]!;
    expect(
      (node(h, J).descendantOverrides[0] as unknown as { address: { templatePath: string[] } })
        .address.templatePath.at(-1),
    ).toBe(text);
  });

  it("판독 수리 검증 — a rule-only position on a slot fill's node reads back (the address path walks the fills too)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const frame = h.add("frame", {}, BODY, "box");
    h.add("Card", {}, frame);
    h.add("Text", { children: "Plain" }, frame);
    h.run(createComponent({ id: frame, name: "Box", newId: h.workspace.newId }));
    const A = h.node(BODY).children[0]! as NodeId;
    // (The Card's first slot-fill Text — class `text` — by its owned path.)
    const target = [...codeViewTreeClasses(h.graph() as never, [frame])].find(
      ([, name]) => name === "text",
    )![0];
    const owned = (id: string) => {
      const entry = h.node(id);
      return [
        ...entry.children,
        ...entry.descendantOverrides.flatMap((item) =>
          item.kind === "fillSlot" ? item.childIds : [],
        ),
      ];
    };
    const find = (id: string, trail: string[]): string[] | undefined => {
      const next = [...trail, id];
      if (id === target) return next;
      for (const child of owned(id)) {
        const found = find(child, next);
        if (found) return found;
      }
      return undefined;
    };
    const templatePath = find(frame, [])!;
    h.variable("picked", "boolean", false);
    h.rules(
      A,
      [
        {
          trigger: "onPress",
          actions: [
            {
              opcode: "setState",
              variableId: "project:stateVariable:picked" as never,
              op: "toggle",
            } as never,
          ],
        },
      ],
      { instances: [A], templatePath } as never,
    );
    const s = session(h);
    const page = code(s, HOME);
    expect(page).toContain("'text': {onPress: rules(");
    // Another key of the same overrides edited — the rule-only key still reads back.
    const result = apply(h, s, {
      [HOME]: (text) =>
        text.replace(
          "<Box overrides={{\n",
          "<Box overrides={{\n        'text-3': {children: 'Changed'},\n",
        ),
    });
    expect(result.rejected).toEqual([]);
  });

  it("판독 수리 검증 LOW — an instance rule that calls an endpoint is an `async` function (round-trips)", async () => {
    const { h, frame, button, A } = await picker();
    h.run(
      setEndpoint({
        entry: {
          kind: "endpoint",
          id: "data:endpoint:saveOrder",
          name: "saveOrder",
          method: "POST",
          baseUrl: "https://api.example.com",
          path: "/orders",
          headers: [],
          queryParams: [],
          bodyType: "json",
          responseMapping: { dataPath: "" },
          executionMode: "client",
        } as never,
      }),
    );
    h.rules(
      A,
      [
        {
          trigger: "onPress",
          actions: [
            { opcode: "callEndpoint", endpointId: "data:endpoint:saveOrder" } as never,
          ],
        },
      ],
      { instances: [A], templatePath: [frame, button] } as never,
    );
    const s = session(h);
    const page = code(s, HOME);
    expect(page).toMatch(/own: \[async \(\) => \{\n\s+await saveOrder\(\);/);
    const revision = h.graph().revision;
    expect(
      catalogCodeViewProjectApply(h.workspace, s, [
        { path: HOME, edited: page, changes: [] },
      ]).rejected,
    ).toEqual([]);
    expect(h.graph().revision).toBe(revision);
  });

  it("판독 수리 검증 LOW — a nested instance's component event (`'property:<key>'`) on an instance position round-trips", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const outer = h.add("frame", {}, BODY, "outer");
    const inner = h.add("frame", {}, outer, "inner");
    h.add("Button", { label: "Pick" }, inner);
    h.run(createComponent({ id: inner, name: "Inner", newId: h.workspace.newId }));
    const definitions = () =>
      (h.graph().getEntry(h.graph().projectId) as ProjectEntry).definitionIds;
    const innerDefinition = definitions().at(-1)! as EntryId<"definition">;
    h.run(
      addComponentOutputProperty({
        definitionId: innerDefinition,
        key: "propselect",
        name: "select",
        kind: "event",
      }),
    );
    const innerInstance = h.node(outer).children[0]! as NodeId;
    h.run(createComponent({ id: outer, name: "Outer", newId: h.workspace.newId }));
    const O = h.node(BODY).children[0]! as NodeId;
    h.variable("picked", "string", "");
    h.rules(
      O,
      [
        {
          trigger: "property:propselect",
          actions: [
            {
              opcode: "setState",
              variableId: "project:stateVariable:picked" as never,
              op: "set",
              value: "!event.value",
            } as never,
          ],
        },
      ],
      { instances: [O], templatePath: [outer, innerInstance] } as never,
    );
    const s = session(h);
    const page = code(s, HOME);
    expect(page).toMatch(/'property:propselect': rules\(\{own: \[\(value\) => \{/);
    const revision = h.graph().revision;
    expect(
      catalogCodeViewProjectApply(h.workspace, s, [
        { path: HOME, edited: page, changes: [] },
      ]).rejected,
    ).toEqual([]);
    expect(h.graph().revision).toBe(revision);
  });

  it("판독 MEDIUM-3 — a new component file with slot contents (a ListBox's items) applies", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const s = session(h);
    const tile = [
      "import {ListBox, ListBoxItem} from 'react-aria-components';",
      "",
      "type TileProps = {};",
      "",
      "export function Tile(props: TileProps) {",
      "  return (",
      "    <>",
      "      <div>",
      "        <ListBox>",
      '          <ListBoxItem id="a" />',
      "        </ListBox>",
      "      </div>",
      "    </>",
      "  );",
      "}",
      "",
    ].join("\n");
    const result = catalogCodeViewProjectApply(h.workspace, s, [
      { path: "src/components/Tile.tsx", edited: tile, changes: [] },
    ]);
    expect(result.rejected).toEqual([]);
  });

  it("판독 가설 (반증) — children written in an instance without a root slot are its own children (the resolver draws them after the template)", async () => {
    const { h } = await picker();
    const s = session(h);
    const revision = h.graph().revision;
    const result = apply(h, s, {
      [HOME]: (text) =>
        text.replace("<Picker />", "<Picker><Text>X</Text></Picker>"),
    });
    expect(result.rejected).toEqual([]);
    expect(h.graph().revision).toBe(revision + 1);
    const instance = h.node(BODY).children[0]!;
    expect(h.node(instance).children).toHaveLength(1);
    // (Not a hidden node: `resolver.ts` resolves an instance's own children after its template root.)
    expect(code(session(h), HOME)).toContain("<Picker>\n");
  });
});
