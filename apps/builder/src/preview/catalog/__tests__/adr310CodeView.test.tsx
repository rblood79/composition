import { afterEach, expect, it, vi } from "vitest";
import { addCollection } from "../../../../../../packages/shared/src/catalog/commands/data";
import type {
  CollectionEntry,
  DataBindingRef,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { definitionTypeName } from "../../../../../../packages/shared/src/catalog/commands/context";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr296, type Adr296Harness } from "./support/adr296Harness";

/**
 * ADR-310 G6 — the Code view writes a repeated item (`repeat`) as its rows' render function: the
 * body is the template tree (`{field}` → `item.field`, the key prop reads the row), a list part with
 * only the template takes `items` (`<ListBox items={users}>{item => …}`), a mixed list a
 * `<Collection items={…}>` in its place, a RAC group `{users.map(item => …)}`, a Tree a named
 * `renderItem` over the child rows. Applied as written it changes nothing; the render body is read
 * only (edited → refused); the `<Collection>` is the repeated item — moved, it moves.
 */
afterEach(() => vi.restoreAllMocks());

const USERS = {
  collectionId: "data:collection:users",
  fieldMap: {},
} as DataBindingRef;

async function open() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr296();
  h.run(
    addCollection({
      entry: {
        kind: "collection",
        id: "data:collection:users",
        name: "users",
        schema: [
          { id: "u-id", key: "id", type: "string" },
          { id: "u-name", key: "name", type: "string" },
          { id: "data:field:kids", key: "kids", type: "array" },
        ],
        mockData: [{ id: "u1", name: "Ann" }],
        useMockData: true,
      } as CollectionEntry,
    }),
  );
  return h;
}
const bind = (
  h: Adr296Harness,
  id: NodeId,
  binding: DataBindingRef = USERS,
  mode?: "template" | "keep",
) =>
  h.run(
    catalogBindingCommand(
      [{ kind: "node", id }],
      binding,
      h.workspace.newId,
      mode,
    ) as never,
  );
/** A list's items in order (its root slot fill, else its children). */
const items = (h: Adr296Harness, id: NodeId) => {
  const node = h.node(id);
  return (
    (
      node.descendantOverrides.find(
        (override) =>
          override.kind === "fillSlot" &&
          override.address.templatePath.length === 1,
      ) as { childIds: readonly NodeId[] } | undefined
    )?.childIds ?? node.children
  ).filter(
    (child) =>
      definitionTypeName(h.graph(), h.node(child).definitionId) ===
      "ListBoxItem",
  );
};
const history = (h: Adr296Harness) => h.workspace.runtime.historyDepth.undo;

it("G6: every bound family — the render body is the template, applied as written it changes nothing", async () => {
  const h = await open();
  for (const type of [
    "ListBox",
    "Table",
    "Tabs",
    "Tree",
    "RadioGroup",
    "TagGroup",
  ])
    bind(h, h.add(type));
  const code = h.code();
  // ③ only the template: the list takes `items`.
  expect(code).toContain(
    "<ListBox items={users}>\n        {item => (\n          <ListBoxItem id={item.id} textValue={String(item.name)} />\n        )}\n      </ListBox>",
  );
  // A Tabs' list and its panels read the same rows; a Table's row its cells' `{field}`.
  expect(code).toContain("<TabList items={users}>");
  expect(code).toMatch(
    /<Collection items=\{users\}>\s+\{item => \(\s+<TabPanel itemId=\{item\.id\}>/,
  );
  // (after the row's selection cell — S2's selection column, 2026-11-18)
  expect(code).toMatch(
    /<Row id=\{item\.id\}[^>]*>\s+<Cell>\s+<Checkbox slot="selection" \/>\s+<\/Cell>\s+<Cell>\{`\$\{item\?\.name \?\? ''\}`\}<\/Cell>/,
  );
  // A RAC group is no collection: an array's `map`, keyed by the row.
  expect(code).toContain("{users.map(item => (");
  expect(code).toContain("<Radio key={item.id} value={item.id}");
  // The sample text is the row's (the resolver's row template — no "Option 1", "Inbox").
  expect(code).not.toMatch(/Option 1|Inbox|Tab 1|Chocolate/);
  const before = history(h);
  const result = h.apply(code);
  expect(result.rejected).toEqual([]);
  expect(result.count).toBe(0);
  expect(history(h)).toBe(before);
});

it("G6: a Tree over child rows renders them with its own function", async () => {
  const h = await open();
  const tree = h.add("Tree");
  bind(h, tree, {
    ...USERS,
    fieldMap: { children: "data:field:kids" },
  } as DataBindingRef);
  const code = h.code();
  expect(code).toMatch(
    /<Tree items=\{users\}>\s+\{function renderItem\(item\) \{\s+return \(\s+<TreeItem id=\{item\.id\}[^>]*>\s+<Collection items=\{item\.kids\}>\{renderItem\}<\/Collection>/,
  );
  expect(code).not.toContain('id="item-1-1"');
  const result = h.apply(code);
  expect(result.rejected).toEqual([]);
  expect(result.count).toBe(0);
});

it("G6: a mixed list — `<Collection>` in the repeated item's place; moved, it moves; its body is read only", async () => {
  const h = await open();
  const list = h.add("ListBox");
  // ① the middle item repeats over its own data; the others stay static.
  const [, middle] = items(h, list) as [NodeId, NodeId, NodeId];
  bind(h, middle);
  let code = h.code();
  let collection =
    /( *)<Collection items=\{users\}>\n[\s\S]*?<\/Collection>\n/.exec(code)!;
  expect(collection).toBeTruthy();
  expect(code.indexOf('id="inbox"')).toBeLessThan(collection.index);
  expect(collection.index).toBeLessThan(code.indexOf('id="archive"'));
  // As written: nothing; an edit beside it keeps the run's own data and place.
  expect(h.apply(code)).toMatchObject({ rejected: [], count: 0 });
  const beside = code.replace("<ListBox>", '<ListBox aria-label="Mail">');
  expect(h.apply(beside).rejected).toEqual([]);
  expect(items(h, list)[1]).toBe(middle);
  expect(h.node(middle).binding?.collectionId).toBe(USERS.collectionId);
  expect(h.node(list).binding).toBeUndefined();
  code = h.code();
  // The body is the template's — read only (G6: 「왕복되지 않는 형태는 읽기 전용」).
  const edited = code.replace(
    "textValue={String(item.name)}",
    "textValue={String(item.id)}",
  );
  expect(edited).not.toBe(code);
  const refused = h.apply(edited);
  expect(refused.rejected.map((item) => item.reason)).toContain("notInCode");
  // Moved before the first static item: the repeated item moves (one step), nothing else changes.
  const before = history(h);
  collection =
    /( *)<Collection items=\{users\}>\n[\s\S]*?<\/Collection>\n/.exec(code)!;
  const first = /( *)<ListBoxItem id="inbox"/.exec(code)!;
  const moved =
    code.slice(0, first.index) +
    collection[0] +
    code.slice(first.index, collection.index) +
    code.slice(collection.index + collection[0].length);
  const result = h.apply(moved);
  expect(result.rejected).toEqual([]);
  expect(history(h)).toBe(before + 1);
  expect(items(h, list)[0]).toBe(middle);
  expect(h.node(middle).repeat).toBe(true);
  expect(h.node(middle).binding?.collectionId).toBe(USERS.collectionId);
});

it("G6: an owner-bound list with static items keeps them beside `<Collection>` (③ — the binding stays the list's)", async () => {
  const h = await open();
  const list = h.add("ListBox");
  bind(h, list, USERS, "keep");
  const code = h.code();
  expect(code).toMatch(/<ListBox>\s+<ListBoxItem id="inbox"/);
  expect(code).toContain("<Collection items={users}>");
  expect(h.apply(code)).toMatchObject({ rejected: [], count: 0 });
  // An edit beside it: the `<Collection>`'s `items` is the list's binding, not the item's.
  const order = items(h, list);
  const result = h.apply(
    code.replace("<ListBox>", '<ListBox aria-label="People">'),
  );
  expect(result.rejected).toEqual([]);
  expect(items(h, list)).toEqual(order);
  const template = items(h, list).find((id) => h.node(id).repeat)!;
  expect(h.node(template).binding).toBeUndefined();
  expect(h.node(list).binding?.collectionId).toBe(USERS.collectionId);
});

it("G6: an edit beside a group's `map` · a Tree's `renderItem` keeps their repeated items", async () => {
  const h = await open();
  const group = h.add("RadioGroup");
  bind(h, group);
  const tree = h.add("Tree");
  bind(h, tree, {
    ...USERS,
    fieldMap: { children: "data:field:kids" },
  } as DataBindingRef);
  /** The repeated items under the two (fills · children, any depth). */
  const repeated = () => {
    const found: string[] = [];
    const visit = (id: string) => {
      const node = h.graph().getEntry(id) as NodeEntry | undefined;
      if (!node) return;
      if (node.repeat) found.push(id);
      for (const child of [
        ...node.children,
        ...node.descendantOverrides.flatMap((override) =>
          override.kind === "fillSlot" ? override.childIds : [],
        ),
      ])
        visit(child);
    };
    visit(group);
    visit(tree);
    return found.sort();
  };
  const before = repeated();
  expect(before).toHaveLength(2);
  const code = h.code();
  const edited = code
    .replace("<RadioGroup>", '<RadioGroup aria-label="Pick">')
    .replace("<Tree items={users}>", '<Tree items={users} aria-label="Files">');
  const result = h.apply(edited);
  expect(result.rejected).toEqual([]);
  expect(repeated()).toEqual(before);
  expect(h.node(group).metadata?.ariaLabel).toBe("Pick");
  expect(h.code()).toContain('<Tree aria-label="Files" items={users}>');
});

it("G6 useTreeData: a Tree a rule edits over its child rows — `useTreeData`, its nodes' `value` · `children`", async () => {
  const h = await open();
  const tree = h.add("Tree");
  bind(h, tree, {
    ...USERS,
    fieldMap: { children: "data:field:kids" },
  } as DataBindingRef);
  h.rules(tree, [
    {
      trigger: "onMove",
      actions: [
        {
          opcode: "moveBefore",
          collectionId: "data:collection:users",
          key: "!event.target.key",
          keys: "!event.keys",
          dropPosition: "!event.target.dropPosition",
        } as never,
      ],
    },
  ]);
  const code = h.code();
  expect(code).toContain("let users = useTreeData({");
  expect(code).toContain("getChildren: item => item.kids ?? []");
  expect(code).toMatch(
    /<TreeItem id=\{item\.key\} textValue=\{String\(item\.value\.name\)\}/,
  );
  expect(code).toContain(
    "<Collection items={item.children}>{renderItem}</Collection>",
  );
  expect(code).toContain("onMove(e)");
  const result = h.apply(code.replace("<Tree ", '<Tree aria-label="Files" '));
  expect(result.rejected).toEqual([]);
});

it("G6: a `<Collection>` the code adds is refused (no template to be — its body is read only)", async () => {
  const h = await open();
  const list = h.add("ListBox");
  bind(h, list, USERS, "keep");
  const code = h.code();
  const order = items(h, list);
  // A second run typed in by hand: refused, nothing changes (not a default template in its place).
  const edited = code.replace(
    "      </ListBox>",
    "        <Collection items={users}>\n          {item => (\n            <ListBoxItem id={item.id} textValue={String(item.id)} />\n          )}\n        </Collection>\n      </ListBox>",
  );
  expect(edited).not.toBe(code);
  const result = h.apply(edited);
  expect(result.rejected.map((item) => item.reason)).toContain("notInCode");
  expect(items(h, list)).toEqual(order);
});
