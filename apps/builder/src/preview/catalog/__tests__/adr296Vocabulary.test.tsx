import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addComponentOutputProperty,
  addRecord,
  createComponent,
  createPage,
  setToastShape,
  setWholeField,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  addCollection,
  setEndpoint,
  setProjectVariable,
} from "../../../../../../packages/shared/src/catalog/commands/data";
import {
  catalogCodeViewFileBaseline,
  catalogCodeViewProjectApply,
  catalogCodeViewProjectSession,
} from "../../../builder/catalogRuntime/codeViewApply";
import type {
  CollectionEntry,
  DataCollectionId,
  EntryId,
  InteractionAction,
  NodeEntry,
  NodeId,
  ViewCondition,
  ViewConditionGroup,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CODE_VIEW_VOCABULARY } from "../../../../../../packages/shared/src/codeView/vocabulary";
import { resolveCapabilities } from "../../../../../../packages/shared/src/interactions/capabilityRegistry";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogCodeViewPlan,
  catalogCodeViewSession,
} from "../../../builder/catalogRuntime/codeViewEdit";
import {
  catalogFilterCommand,
  catalogGroupListCommand,
  catalogResultCountCommand,
  catalogSortFollowCommand,
} from "../../../builder/catalogRuntime/viewAuthoring";
import {
  BODY,
  HOME,
  openAdr296,
  type Adr296Harness,
} from "./support/adr296Harness";

/**
 * ADR-296 G1 (R2) — every form of the closed vocabulary is read, not named: one document per row
 * whose page code shows the form; the unchanged code reads back with nothing refused (strict — each
 * unit read again); an edit of that form becomes the document change the row's unit is. A row with
 * no case here fails (the table and the gate are one — a new form comes with its case). A row whose
 * form lives in a later phase's file (`file`) waits for that phase.
 */
afterEach(() => vi.restoreAllMocks());

type Case = {
  /** Builds the document; returns what `edit` · `check` read. */
  build: (h: Adr296Harness) => Record<string, unknown> | void;
  /** The form in the page's code. */
  shows: RegExp;
  /** The edit of the form. */
  edit: (code: string) => string;
  /** The document after the edit (or the refusal a derived line gives). */
  check: (
    h: Adr296Harness,
    made: Record<string, unknown>,
    reasons: readonly string[],
  ) => void;
};

const users = (
  id = "users",
  rows: Record<string, unknown>[] = [{ id: "u1", name: "Ann", age: 30 }],
): CollectionEntry => ({
  kind: "collection",
  id: `data:collection:${id}` as DataCollectionId,
  name: id,
  schema: [
    { id: `${id}-id`, key: "id", type: "string" },
    { id: `${id}-name`, key: "name", type: "string" },
    { id: `${id}-age`, key: "age", type: "number" },
  ],
  mockData: rows,
  useMockData: true,
});
const USERS = "data:collection:users" as DataCollectionId;

function collection(h: Adr296Harness, id = "users") {
  h.run(addCollection({ entry: users(id) }));
}
function bound(h: Adr296Harness, type: string, id = "users") {
  const node = h.add(type);
  h.run(
    catalogBindingCommand(
      [{ kind: "node", id: node }],
      catalogBindingRef({ source: "dataTable", collectionId: id, name: id })!,
    ),
  );
  return node;
}
/** 「검색 추가」 on a bound list (the Data panel's command). */
function search(h: Adr296Harness, list: NodeId) {
  h.run(
    catalogFilterCommand(
      h.graph(),
      {
        listId: list,
        field: { id: "users-name", key: "name", type: "string" },
        kind: "SearchField" as never,
        control: { insert: true },
        values: [],
        allLabel: "All",
      },
      h.workspace.newId,
    ).command,
  );
}
const conditionsOf = (group: ViewConditionGroup | undefined): ViewCondition[] =>
  (group?.items ?? []).flatMap((item) =>
    "items" in item ? conditionsOf(item) : [item],
  );
const viewOf = (h: Adr296Harness, id: string) => {
  const binding = h.node(id).binding!;
  if (binding.view) return binding.view;
  const view = binding.viewId ? h.graph().getEntry(binding.viewId) : undefined;
  return view?.kind === "view" ? view : undefined;
};
const actions = (h: Adr296Harness, owner: unknown) =>
  h.rulesOf(owner as string).flatMap((rule) => rule.actions);
const propOf = (h: Adr296Harness, id: unknown, prop: string) => {
  const write = h.node(id as string).props[prop];
  return write?.kind === "set" ? write.value : undefined;
};
const rule = (
  h: Adr296Harness,
  owner: NodeId,
  trigger: string,
  list: InteractionAction[],
) => h.rules(owner, [{ trigger, actions: list }]);
const capabilityOf = (type: string, prop: string) =>
  Object.entries(resolveCapabilities(type)).find(
    ([, def]) => def.prop === prop && def.value === "!param" && !def.op,
  )?.[0];

const CASES: Record<string, Case> = {
  "import {…} from '…'": {
    build: (h) => void h.add("Button"),
    shows: /import \{Button\} from 'react-aria-components';/,
    edit: (code) =>
      code
        .replace("import {Button}", "import {Button, Text}")
        .replace("<Button />", "<Button />\n      <Text>Added</Text>"),
    check: (h) => expect(h.node(BODY).children).toHaveLength(2),
  },
  "let [x, setX] = useState<T>(v)": {
    build: (h) => void h.variable("count", "number", 0),
    shows: /let \[count, setCount\] = useState\(0\);/,
    edit: (code) => code.replace("useState(0)", "useState(5)"),
    check: (h) =>
      expect(
        (
          h.graph().getEntry("project:stateVariable:count") as {
            defaultValue: unknown;
          }
        ).defaultValue,
      ).toBe(5),
  },
  "let [nodeProp, setNodeProp] = useState(v) · <Tag prop={nodeProp}> · setNodeProp(…)":
    {
      build: (h) => {
        const bar = h.add("ProgressBar");
        const button = h.add("Button");
        const id = capabilityOf("ProgressBar", "value")!;
        rule(h, button, "onPress", [
          {
            opcode: "capability",
            target: { nodeId: bar },
            capabilityId: id,
            value: 40,
          },
        ]);
        return { button };
      },
      shows: /setProgressBarValue\(40\);/,
      edit: (code) =>
        code.replace("setProgressBarValue(40)", "setProgressBarValue(80)"),
      check: (h, made) =>
        expect(actions(h, made.button)[0]).toMatchObject({ value: 80 }),
    },
  "let {selectedKeys: x, setSelectedKeys: setX} = list": {
    build: (h) => {
      collection(h);
      const list = bound(h, "ListBox");
      const button = h.add("Button");
      rule(h, button, "onPress", [
        { opcode: "append", collectionId: USERS, value: "new" },
      ]);
      h.run(
        addRecord({
          entry: {
            kind: "stateVariable",
            id: "project:stateVariable:picked",
            ownerId: HOME,
            name: "picked",
            valueType: "string[]",
            defaultValue: [],
            source: { nodeId: list, prop: "selectedKeys" },
          } as never,
        }),
      );
      return { list };
    },
    shows: /let \{selectedKeys: picked, setSelectedKeys: setPicked\} = users;/,
    edit: (code) =>
      code.replaceAll("setPicked", "setChosen").replaceAll("picked", "chosen"),
    check: (h) =>
      expect(
        (h.graph().getEntry("project:stateVariable:picked") as { name: string })
          .name,
      ).toBe("chosen"),
  },
  "useListData · useAsyncList · useEffect(reload)": {
    build: (h) => {
      collection(h);
      bound(h, "ListBox");
      const button = h.add("Button");
      rule(h, button, "onPress", [
        { opcode: "append", collectionId: USERS, value: "new" },
      ]);
    },
    shows: /let users = useListData\(\{/,
    edit: (code) =>
      code.replace("getKey: item => item.id", "getKey: item => item.name"),
    check: (_h, _made, reasons) => expect(reasons).toContain("derivedChanged"),
  },
  "url.searchParams.append(…)": {
    build: (h) => {
      h.run(addCollection({ entry: { ...users(), useMockData: false } }));
      h.run(
        setEndpoint({
          entry: {
            kind: "endpoint",
            id: "data:endpoint:users",
            name: "users",
            method: "GET",
            baseUrl: "https://api.example.com",
            path: "/users",
            headers: [],
            queryParams: [],
            bodyType: "none",
            responseMapping: { dataPath: "" },
            querySerialization: { kind: "suffix" },
            targetCollectionId: USERS,
            executionMode: "client",
          } as never,
        }),
      );
      const list = bound(h, "ListBox");
      search(h, list);
      return { list };
    },
    shows: /url\.searchParams\.append\('name_like', String\(nameFilter\)\);/,
    edit: (code) =>
      code.replace(
        "'name_like', String(nameFilter)",
        "'name', String(nameFilter)",
      ),
    check: (h, made) =>
      expect(
        conditionsOf(viewOf(h, made.list as string)?.where)[0],
      ).toMatchObject({ op: "equals" }),
  },
  "url.searchParams.set(_sort …)": {
    build: (h) => {
      h.run(addCollection({ entry: { ...users(), useMockData: false } }));
      h.run(
        setEndpoint({
          entry: {
            kind: "endpoint",
            id: "data:endpoint:users",
            name: "users",
            method: "GET",
            baseUrl: "https://api.example.com",
            path: "/users",
            headers: [],
            queryParams: [],
            bodyType: "none",
            responseMapping: { dataPath: "" },
            querySerialization: { kind: "suffix" },
            targetCollectionId: USERS,
            executionMode: "client",
          } as never,
        }),
      );
      const list = bound(h, "ListBox");
      sortBy(h, list, "users-name");
      return { list };
    },
    shows: /url\.searchParams\.set\('_sort', 'name'\);/,
    edit: (code) => code.replace("set('_sort', 'name')", "set('_sort', 'age')"),
    check: (h, made) =>
      expect(viewOf(h, made.list as string)?.sort).toMatchObject({
        field: ["data:field:users-age"],
      }),
  },
  "useFilter · useCollator · useNavigate": {
    build: (h) => {
      collection(h);
      search(h, bound(h, "ListBox"));
    },
    shows: /let \{contains\} = useFilter\(\{sensitivity: 'base'\}\);/,
    edit: (code) =>
      code.replace(
        "useFilter({sensitivity: 'base'})",
        "useFilter({sensitivity: 'case'})",
      ),
    check: (_h, _made, reasons) => expect(reasons).toContain("derivedChanged"),
  },
  "let v = rows.filter(item => …)": {
    build: (h) => {
      collection(h);
      const list = bound(h, "ListBox");
      search(h, list);
      return { list };
    },
    shows: /let usersView = users\n\s+\.filter\(item =>/,
    // (The view loses its condition: the list shows every row.)
    edit: (code) =>
      code
        .replace(
          /let usersView = users\n\s+\.filter\(item =>\n\s+contains\(String\(item\.name\), nameFilter\)\);/,
          "let usersView = users;",
        )
        .replace("let {contains} = useFilter({sensitivity: 'base'});\n", "")
        .replace("import {useFilter} from 'react-aria';\n", ""),
    check: (h, made) =>
      expect(conditionsOf(viewOf(h, made.list as string)?.where)).toEqual([]),
  },
  "a `filter` term (18 comparisons · skip · 적용)": {
    build: (h) => {
      collection(h);
      const list = bound(h, "ListBox");
      search(h, list);
      return { list };
    },
    shows: /contains\(String\(item\.name\), nameFilter\)/,
    edit: (code) =>
      code
        .replace(
          "contains(String(item.name), nameFilter)",
          "startsWith(String(item.name), nameFilter)",
        )
        .replace("let {contains} = useFilter", "let {startsWith} = useFilter"),
    check: (h, made) =>
      expect(
        conditionsOf(viewOf(h, made.list as string)?.where)[0],
      ).toMatchObject({ op: "startsWith" }),
  },
  "an or of terms": {
    build: (h) => {
      collection(h);
      const list = bound(h, "ListBox");
      search(h, list);
      return { list };
    },
    shows: /contains\(String\(item\.name\), nameFilter\)/,
    edit: (code) =>
      code.replace(
        "contains(String(item.name), nameFilter)",
        "(contains(String(item.name), nameFilter) || item.age >= 30)",
      ),
    check: (h, made) => {
      const where = viewOf(h, made.list as string)?.where;
      expect(where?.items[0]).toMatchObject({ op: "or" });
      expect(conditionsOf(where)).toHaveLength(2);
    },
  },
  ".toSorted((a, b) => collator.compare(…))": {
    build: (h) => {
      collection(h);
      const list = bound(h, "ListBox");
      sortBy(h, list, "users-name");
      return { list };
    },
    shows:
      /\.toSorted\(\(a, b\) => collator\.compare\(String\(a\.name\), String\(b\.name\)\)\)/,
    edit: (code) =>
      code.replace(
        "String(a.name), String(b.name)",
        "String(a.age), String(b.age)",
      ),
    check: (h, made) =>
      expect(viewOf(h, made.list as string)?.sort).toMatchObject({
        field: ["data:field:users-age"],
      }),
  },
  "Map.groupBy(…) · counts": {
    build: (h) => {
      collection(h);
      const list = bound(h, "ListBox");
      h.run(
        catalogGroupListCommand(
          h.graph(),
          {
            listId: list,
            viewName: "people",
            field: { id: "users-age", key: "age", type: "number" },
          },
          h.workspace.newId,
        ).command,
      );
      return {};
    },
    shows: /Map\.groupBy\(peopleAgeRows, item => item\.age\)/,
    edit: (code) => code.replace("count: rows.length", "total: rows.length"),
    check: (h) => {
      const views =
        (h.graph().getEntry(h.graph().projectId) as { viewIds?: string[] })
          .viewIds ?? [];
      const grouped = views
        .map(
          (id) =>
            h.graph().getEntry(id) as {
              groupBy?: unknown;
              aggregates?: { as: string }[];
            },
        )
        .find((view) => view.groupBy);
      expect(grouped?.aggregates?.map((item) => item.as)).toEqual(["total"]);
    },
  },
  "[{id: 'row-1', count: …}]": {
    build: (h) => {
      collection(h);
      const list = bound(h, "ListBox");
      h.run(
        catalogResultCountCommand(
          h.graph(),
          { listId: list, viewName: "people", text: "{count} people" },
          h.workspace.newId,
        ).command,
      );
    },
    shows: /let peopleCount = \[\{id: 'row-1', count: people\.length\}\];/,
    edit: (code) =>
      code
        .replace("count: people.length", "total: people.length")
        .replace("?.count ?? ''", "?.total ?? ''"),
    check: (h) => {
      const views =
        (h.graph().getEntry(h.graph().projectId) as { viewIds?: string[] })
          .viewIds ?? [];
      const counts = views
        .map(
          (id) => h.graph().getEntry(id) as { aggregates?: { as: string }[] },
        )
        .flatMap((view) => view.aggregates ?? []);
      expect(counts.map((item) => item.as)).toEqual(["total"]);
    },
  },
  "useDragAndDrop({…})": {
    build: (h) => {
      collection(h);
      const list = bound(h, "GridList");
      rule(h, list, "onReorder", [
        {
          opcode: "moveBefore",
          collectionId: USERS,
          key: "!event.target.key",
          keys: "!event.keys",
          dropPosition: "!event.target.dropPosition",
        },
      ]);
      return { list };
    },
    shows: /let \{dragAndDropHooks: gridListDragAndDrop\} = useDragAndDrop\(\{/,
    edit: (code) =>
      code.replace(
        / {6}if \(e\.target\.dropPosition === 'before'\) users\.moveBefore\(e\.target\.key, e\.keys\);\n {6}else if \(e\.target\.dropPosition === 'after'\) users\.moveAfter\(e\.target\.key, e\.keys\);\n/,
        "      users.moveAfter(e.target.key, e.keys);\n",
      ),
    check: (h, made) =>
      expect(actions(h, made.list)[0]).toMatchObject({ opcode: "moveAfter" }),
  },
  "<Tag …>…</Tag>": {
    build: (h) => void h.add("Text", { children: "Hi" }),
    shows: /<Text>Hi<\/Text>/,
    edit: (code) =>
      code.replace(
        "<Text>Hi</Text>",
        "<Text>Hi</Text>\n      <Text>Two</Text>",
      ),
    check: (h) => expect(h.node(BODY).children).toHaveLength(2),
  },
  "<Instance onName={(value) => …}> · <Instance name={x}>": {
    build: (h) => {
      const frame = h.add("frame", {}, BODY, "picker");
      h.add("Button", {}, frame, "save-button");
      h.run(
        createComponent({
          id: frame,
          name: "Picker",
          newId: h.workspace.newId,
        }),
      );
      const project = h.graph().getEntry(h.graph().projectId) as unknown as {
        definitionIds: string[];
      };
      const definitionId = project.definitionIds.at(
        -1,
      ) as EntryId<"definition">;
      h.run(
        addComponentOutputProperty({
          definitionId,
          key: "pick",
          name: "pick",
          kind: "event",
        }),
      );
      const J = h.node(BODY).children[0]! as NodeId;
      rule(h, J, "property:pick", [{ opcode: "toast", message: "picked" }]);
      return { J };
    },
    shows: /onPick=\{\(value\) => \{\n\s+queue\.add\(\{title: 'picked'\}\);/,
    edit: (code) => code.replace("'picked'", "'chosen'"),
    check: (h, made) =>
      expect(actions(h, made.J)).toEqual([
        { opcode: "toast", message: "chosen" },
      ]),
  },
  'prop="…" · prop={literal} · prop={x}': {
    build: (h) => {
      const button = h.add("Button");
      h.declare(button, { isDisabled: true });
      return { button };
    },
    shows: /<Button isDisabled=\{true\}/,
    edit: (code) => code.replace("isDisabled={true}", "isDisabled={false}"),
    check: (h, made) =>
      expect(propOf(h, made.button, "isDisabled")).toBe(false),
  },
  "prop={x === … && …}": {
    build: (h) => {
      const count = h.variable("count", "number", 0);
      const button = h.add("Button");
      h.declare(button, {
        isDisabled: {
          kind: "when",
          subject: `!var.${count}`,
          op: "equals",
          value: 0,
        } as never,
      });
      return { button };
    },
    shows: /isDisabled=\{count === 0\}/,
    edit: (code) => code.replace("count === 0", "count === 3"),
    check: (h, made) =>
      expect(propOf(h, made.button, "isDisabled")).toMatchObject({ value: 3 }),
  },
  "text · {`…${x}…`}": {
    build: (h) => ({ text: h.add("Text", { children: "Hi" }) }),
    shows: /<Text>Hi<\/Text>/,
    edit: (code) => code.replace("<Text>Hi</Text>", "<Text>Hello</Text>"),
    check: (h, made) => expect(propOf(h, made.text, "children")).toBe("Hello"),
  },
  "{`…${row?.f ?? ''}…`}": {
    build: (h) => {
      collection(h);
      const frame = h.add("frame");
      h.run(
        setWholeField({
          targets: [{ kind: "node", id: frame }],
          field: "binding",
          value: { collectionId: USERS, fieldMap: {}, key: "u1" },
          label: "Bind",
        }),
      );
      const text = h.add("Text", { children: "Hi {name}" }, frame);
      return { text };
    },
    shows:
      /\{`Hi \$\{users\.find\(row => row\.id === 'u1'\)\?\.name \?\? ''\}`\}/,
    edit: (code) => code.replace("{`Hi ${", "{`Hello ${"),
    check: (h, made) =>
      expect(propOf(h, made.text, "children")).toBe("Hello {name}"),
  },
  "onX={setX}": {
    build: (h) => {
      h.variable("q", "string", "");
      h.variable("r", "string", "");
      const field = h.add("TextField");
      rule(h, field, "onChange", [
        {
          opcode: "setState",
          variableId: "project:stateVariable:q" as never,
          op: "set",
          value: "!event.value",
        },
      ]);
      return { field };
    },
    shows: /onChange=\{setQ\}/,
    edit: (code) =>
      code.replace("value={q} onChange={setQ}", "value={r} onChange={setR}"),
    check: (h, made) =>
      expect(actions(h, made.field)[0]).toMatchObject({
        variableId: "project:stateVariable:r",
      }),
  },
  "onX={() => { setX(…); queue.add(…); navigate(…); }}": {
    build: (h) => {
      const button = h.add("Button");
      rule(h, button, "onPress", [{ opcode: "toast", message: "one" }]);
      return { button };
    },
    shows: /onPress=\{\(\) => \{\n\s+queue\.add\(\{title: 'one'\}\);/,
    edit: (code) => code.replace("'one'", "'two'"),
    check: (h, made) =>
      expect(actions(h, made.button)).toEqual([
        { opcode: "toast", message: "two" },
      ]),
  },
  "list.update · move · remove · insert … · reload · capability · fetch": {
    build: (h) => {
      collection(h);
      bound(h, "ListBox");
      const button = h.add("Button");
      rule(h, button, "onPress", [
        { opcode: "append", collectionId: USERS, value: "a" },
      ]);
      return { button };
    },
    shows: /users\.append\('a'\);/,
    edit: (code) => code.replace("users.append('a')", "users.prepend('a')"),
    check: (h, made) =>
      expect(actions(h, made.button)[0]).toMatchObject({ opcode: "prepend" }),
  },
  "items={rows} · {item => <Item …>}": {
    build: (h) => {
      collection(h);
      collection(h, "teams");
      return { list: bound(h, "ListBox") };
    },
    shows: /<ListBox items=\{users\}>/,
    edit: (code) =>
      code
        .replace("items={users}", "items={teams}")
        .replace(
          "import users from './data/users';",
          "import teams from './data/teams';",
        ),
    check: (h, made) =>
      expect(h.node(made.list as string).binding?.collectionId).toBe(
        "data:collection:teams",
      ),
  },
  "function onNodeWhen() {…} · onWhen={() => { onNodeWhen(); onNodeWhen2(); }}":
    {
      build: (h) => {
        const button = h.add("Button");
        const ids = h.rules(button, [
          {
            trigger: "onPress",
            actions: [{ opcode: "toast", message: "one" }],
          },
          {
            trigger: "onPress",
            actions: [{ opcode: "toast", message: "two" }],
          },
        ]);
        return { button, ids };
      },
      shows: /function onButtonPress2\(\) \{/,
      // (The second rule goes; one rule left is the inline handler again — 사용자 결정 7.)
      edit: (code) =>
        code
          .replace(
            / {2}function onButtonPress2?\(\) \{\n[\s\S]*?\n {2}\}\n/g,
            "",
          )
          .replace(
            "onPress={() => { onButtonPress(); onButtonPress2(); }}",
            "onPress={() => {\n        queue.add({title: 'one'});\n      }}",
          ),
      check: (h, made) =>
        expect(h.rulesOf(made.button as string).map((item) => item.id)).toEqual(
          [(made.ids as string[])[0]],
        ),
    },
  "onHoverStart={() => {…}} (a hidden When)": {
    build: (h) => {
      const button = h.add("Button");
      rule(h, button, "onHoverStart", [{ opcode: "toast", message: "hover" }]);
      return { button };
    },
    shows: /onHoverStart=\{\(\) => \{/,
    edit: (code) => code.replace("onHoverStart=", "onHoverEnd="),
    check: (h, made) =>
      expect(
        h.rulesOf(made.button as string).map((item) => item.trigger),
      ).toEqual(["onHoverEnd"]),
  },
  "setNodeIsVisible(true | false | v => !v)": {
    build: (h) => {
      const text = h.add("Text", { children: "Hi" });
      const button = h.add("Button");
      rule(h, button, "onPress", [
        {
          opcode: "capability",
          target: { nodeId: text },
          capabilityId: "hide",
        },
      ]);
      return { button };
    },
    shows: /setTextIsVisible\(false\);/,
    edit: (code) =>
      code.replace("setTextIsVisible(false)", "setTextIsVisible(v => !v)"),
    check: (h, made) =>
      expect(actions(h, made.button)[0]).toMatchObject({
        capabilityId: "toggle",
      }),
  },
  "let formRef = useRef<HTMLFormElement>(null) · <Form ref={formRef}> · formRef.current?.submit()":
    {
      build: (h) => {
        const form = h.add("Form");
        const button = h.add("Button");
        rule(h, button, "onPress", [
          {
            opcode: "capability",
            target: { nodeId: form },
            capabilityId: "submit",
          },
        ]);
        return { button };
      },
      shows: /formRef\.current\?\.submit\(\);/,
      edit: (code) => code.replace(".submit()", ".reset()"),
      check: (h, made) =>
        expect(actions(h, made.button)[0]).toMatchObject({
          capabilityId: "reset",
        }),
    },
  "capability('hide', {target: '<ref>' | null})": {
    build: (h) => {
      const button = h.add("Button");
      rule(h, button, "onPress", [
        { opcode: "capability", target: { unset: true }, capabilityId: "hide" },
      ]);
      return { button };
    },
    shows: /capability\('hide', \{target: null\}\);/,
    edit: (code) => code.replace("capability('hide'", "capability('show'"),
    check: (h, made) =>
      expect(actions(h, made.button)[0]).toMatchObject({
        capabilityId: "show",
        target: { unset: true },
      }),
  },
  "keep('do-1')": {
    build: (h) => {
      h.run(
        createPage({
          page: {
            kind: "page",
            id: "project:page:other" as EntryId<"page">,
            route: "/other",
            name: "Other",
            children: [],
          },
        }),
      );
      const other = h.variable(
        "elsewhere",
        "number",
        0,
        "project:page:other" as never,
      );
      const button = h.add("Button");
      rule(h, button, "onPress", [
        { opcode: "toast", message: "one" },
        { opcode: "setState", variableId: other, op: "set", value: 1 },
      ]);
      return { button };
    },
    shows: /keep\('do-1'\);/,
    // (The kept Do stays as the document holds it; the other Do changes.)
    edit: (code) => code.replace("'one'", "'two'"),
    check: (h, made) =>
      expect(actions(h, made.button)).toEqual([
        { opcode: "toast", message: "two" },
        {
          opcode: "setState",
          variableId: "project:stateVariable:elsewhere",
          op: "set",
          value: 1,
        },
      ]),
  },
  "list.append(parentKey, v) · insert(parentKey, i, v) · move(key, parentKey, i) · remove(key)":
    {
      build: (h) => {
        collection(h);
        const button = h.add("Button");
        rule(h, button, "onPress", [
          {
            opcode: "append",
            collectionId: USERS,
            value: "child",
            parentKey: "u1",
          },
        ]);
        return { button };
      },
      shows: /users\.append\('u1', 'child'\);/,
      edit: (code) =>
        code.replace(
          "users.append('u1', 'child')",
          "users.insert('u1', 0, 'child')",
        ),
      check: (h, made) =>
        expect(actions(h, made.button)[0]).toMatchObject({
          opcode: "insert",
          parentKey: "u1",
          index: 0,
        }),
    },
  "prop={token('<name>')}": {
    build: (h) => {
      const bar = h.add("ProgressBar");
      const numbers = [...h.library.tokens].filter(
        ([, token]) => token.tokenType === "number",
      );
      h.declare(bar, {
        value: { kind: "token", tokenId: numbers[0]![0] } as never,
      });
      return { bar, second: numbers[1]![0] };
    },
    shows: /value=\{token\('[^']+'\)\}/,
    edit: (code) =>
      code.replace(/value=\{token\('[^']+'\)\}/, "value={token('__second__')}"),
    check: () => undefined,
  },
  "prop={{months: 2}}": {
    build: (h) => {
      const calendar = h.add("Calendar");
      h.declare(calendar, { visibleDuration: { months: 2 } as never });
      return { calendar };
    },
    shows: /visibleDuration=\{\{months: 2\}\}/,
    edit: (code) => code.replace("{months: 2}", "{weeks: 3}"),
    check: (h, made) =>
      expect(propOf(h, made.calendar, "visibleDuration")).toEqual({ weeks: 3 }),
  },
};

Object.assign(CASES, {
  "let {cart, setCart} = useProjectState() · setCart(…)": {
    build: (h: Adr296Harness) => {
      h.run(
        setProjectVariable({
          entry: {
            kind: "projectVariable",
            id: "data:variable:cart",
            name: "cart",
            valueType: "number",
            defaultValue: 0,
            persist: false,
          } as never,
        }),
      );
      const button = h.add("Button");
      rule(h, button, "onPress", [
        {
          opcode: "setState",
          variableId: "data:variable:cart" as never,
          op: "set",
          value: 1,
        },
      ]);
      return { button };
    },
    shows: /let \{cart, setCart\} = useProjectState\(\);/,
    edit: (code: string) => code.replace("setCart(1)", "setCart(2)"),
    check: (h: Adr296Harness, made: Record<string, unknown>) =>
      expect(actions(h, made.button)[0]).toMatchObject({ value: 2 }),
  },
  "await saveOrder({body})": {
    build: (h: Adr296Harness) => {
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
      const button = h.add("Button");
      rule(h, button, "onPress", [
        {
          opcode: "callEndpoint",
          endpointId: "data:endpoint:saveOrder" as never,
          body: "a",
        },
      ]);
      return { button };
    },
    shows: /await saveOrder\(\{body: 'a'\}\);/,
    edit: (code: string) => code.replace("{body: 'a'}", "{body: 'b'}"),
    check: (h: Adr296Harness, made: Record<string, unknown>) =>
      expect(actions(h, made.button)[0]).toMatchObject({ body: "b" }),
  },
  "<Page …> · <title> · <meta> · id · className · aria-label · {false && <T/>} · useParams()":
    {
      build: (h: Adr296Harness) => {
        h.add("Button");
        h.declare(BODY, { isDisabled: true });
        return {};
      },
      shows: /<Page isDisabled=\{true\}>/,
      edit: (code: string) =>
        code.replace(
          "<Page isDisabled={true}>\n",
          "<Page isDisabled={true}>\n      <title>Home</title>\n",
        ),
      check: (h: Adr296Harness) =>
        expect((h.graph().getEntry(HOME) as { meta?: unknown }).meta).toEqual({
          title: "Home",
        }),
    },
} satisfies Record<string, Case>);

/** The file rows: the file's own case through the project Apply (one Apply, one step). */
const FILE_CASES: Record<
  string,
  {
    path: string;
    build: (h: Adr296Harness) => void;
    edit: (code: string) => string;
    check: (h: Adr296Harness) => void;
  }
> = {
  "createBrowserRouter([{path, element, children}]) · <MyToastRegion placement> · <Theme name>":
    {
      path: "src/App.tsx",
      build: () => undefined,
      edit: (code) =>
        code.replace(
          "<MyToastRegion />",
          '<MyToastRegion placement="top" />',
        ),
      check: (h) =>
        expect(
          (
            h.graph().getEntry(h.graph().projectId) as {
              toastPlacement?: string;
            }
          ).toastPlacement,
        ).toBe("top"),
    },
  // User 2026-11-01 — the app's toast shape: `<ShapeA toast={toast} />` → `<ShapeB …>` picks the
  // other Toast-rooted component (the default body `<Toast …>` would pick the Library's Toast).
  "export const queue = new ToastQueue<…>() · <ToastRegion queue={queue}>{({toast}) => <Shape toast={toast} /> | <Toast …>}":
    {
      path: "src/Toast.tsx",
      build: (h) => {
        const a = h.add("Toast");
        const b = h.add("Toast");
        h.run(createComponent({ id: a, name: "ShapeA", newId: h.workspace.newId }));
        h.run(createComponent({ id: b, name: "ShapeB", newId: h.workspace.newId }));
        const project = h.graph().getEntry(h.graph().projectId) as {
          definitionIds: readonly EntryId<"definition">[];
        };
        h.run(setToastShape({ id: project.definitionIds[0] }));
      },
      edit: (code) =>
        code
          .replace("import ShapeA from './components/ShapeA';", "import ShapeB from './components/ShapeB';")
          .replace("<ShapeA toast={toast} />", "<ShapeB toast={toast} />"),
      check: (h) => {
        const project = h.graph().getEntry(h.graph().projectId) as {
          definitionIds: readonly EntryId<"definition">[];
          toastShapeId?: string;
        };
        expect(project.toastShapeId).toBe(project.definitionIds[1]);
      },
    },
  "export const fields = […] · settings · export default [rows]": {
    path: "src/data/users.ts",
    build: (h) => collection(h),
    edit: (code) => code.replace("useMockData: true", "useMockData: false"),
    check: (h) =>
      expect((h.graph().getEntry(USERS) as CollectionEntry).useMockData).toBe(
        false,
      ),
  },
  "export default endpoint({…})": {
    path: "src/api/saveOrder.ts",
    build: (h) =>
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
      ),
    edit: (code) => code.replace("method: 'POST'", "method: 'PUT'"),
    check: (h) =>
      expect(
        (h.graph().getEntry("data:endpoint:saveOrder") as { method: string })
          .method,
      ).toBe("PUT"),
  },
  "export const projectState = {name: start, // persist}": {
    path: "src/state/project.ts",
    build: (h) =>
      h.run(
        setProjectVariable({
          entry: {
            kind: "projectVariable",
            id: "data:variable:cart",
            name: "cart",
            valueType: "number",
            defaultValue: 0,
            persist: false,
          } as never,
        }),
      ),
    edit: (code) => code.replace("cart: 0,", "cart: 0, // persist"),
    check: (h) =>
      expect(
        (h.graph().getEntry("data:variable:cart") as { persist: boolean })
          .persist,
      ).toBe(true),
  },
};

describe("ADR-296 G1 — the file rows are read (project Apply)", () => {
  it("every file row has its case (a later phase's file waits)", () => {
    const rows = CODE_VIEW_VOCABULARY.filter(
      (item) => item.file && item.file !== "src/components/<Name>.tsx",
    ).map((item) => item.form);
    expect(Object.keys(FILE_CASES).sort()).toEqual([...rows].sort());
  });
  it.each(Object.entries(FILE_CASES))("%s", async (_, item) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    item.build(h);
    const session = catalogCodeViewProjectSession(h.graph());
    const base = catalogCodeViewFileBaseline(session, h.graph(), item.path)!;
    expect(base, item.path).toBeDefined();
    const unchanged = catalogCodeViewProjectApply(h.workspace, session, [
      { path: item.path, edited: base.code, changes: [] },
    ]);
    expect(unchanged.rejected).toEqual([]);
    const edited = item.edit(base.code);
    expect(edited).not.toBe(base.code);
    const result = catalogCodeViewProjectApply(h.workspace, session, [
      { path: item.path, edited, changes: [] },
    ]);
    expect(result.rejected).toEqual([]);
    item.check(h);
  });
});

/** A built-in view's literal sort (the Data panel's sort). */
function sortBy(h: Adr296Harness, list: NodeId, fieldId: string) {
  const binding = h.node(list).binding!;
  h.run(
    setWholeField({
      targets: [{ kind: "node", id: list }],
      field: "binding",
      value: {
        ...binding,
        view: {
          where: { id: "root", op: "and", items: [] },
          sort: { field: [`data:field:${fieldId}`], direction: "ascending" },
        } as never,
      },
      label: "Sort",
    }),
  );
}

/** Rows the document derives (an edit of the line is refused — that refusal is the read). */
const DERIVED = new Set([
  "useListData · useAsyncList · useEffect(reload)",
  "useFilter · useCollator · useNavigate",
]);

describe("ADR-296 G1 — every vocabulary form is read (R2)", () => {
  it("every row has its case (and every case its row)", () => {
    const rows = CODE_VIEW_VOCABULARY.filter((item) => !item.file).map(
      (item) => item.form,
    );
    expect(Object.keys(CASES).sort()).toEqual([...rows].sort());
  });

  it.each(Object.entries(CASES))("%s", async (form, item) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const made = item.build(h) ?? {};
    const code = h.code();
    expect(code, form).toMatch(item.shows);
    // The unchanged code reads back (strict: every unit read again) with nothing refused.
    const data = h.dataOf();
    const session = catalogCodeViewSession(h.graph(), HOME, data)!;
    const strict = catalogCodeViewPlan({
      reader: h.workspace.runtime.graph.commandReader,
      session,
      edited: session.baseline.code,
      changes: [],
      data,
      newId: h.workspace.newId,
      strict: true,
    });
    expect(strict.rejected, "strict read of the unchanged code").toEqual([]);
    let edited = item.edit(code);
    if (form === "prop={token('<name>')}") {
      const second = made.second as string;
      const token = h.library.tokens.get(second as never)!;
      edited = edited.replace(
        "__second__",
        token.ref ? token.ref.slice(1, -1) : second.slice(10),
      );
    }
    expect(edited, "the edit changes the code").not.toBe(code);
    const result = h.apply(edited);
    const reasons = result.rejected.map((line) => line.reason);
    if (!DERIVED.has(form))
      expect(result.rejected, "the edit applies").toEqual([]);
    item.check(h, made, reasons);
    if (form === "prop={token('<name>')}")
      expect(propOf(h, made.bar, "value")).toEqual({
        kind: "token",
        tokenId: made.second,
      });
    if (!reasons.includes("derivedChanged"))
      expect(result.rejected, "the edit applies").toEqual([]);
  });
});

export type { NodeEntry };

describe("ADR-296 G1 — the page file's Phase 1 forms in one golden (round trip)", () => {
  it("named handlers · ref · target references · keep · tree · token · object — pasted whole, nothing changes", async () => {
    const { existsSync, mkdirSync, readFileSync, writeFileSync } =
      await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    collection(h);
    const text = h.add("Text", { children: "Hi" });
    const form = h.add("Form");
    const bar = h.add("ProgressBar");
    const [tokenId] = [...h.library.tokens].find(
      ([, token]) => token.tokenType === "number",
    )!;
    h.declare(bar, { value: { kind: "token", tokenId } as never });
    const calendar = h.add("Calendar");
    h.declare(calendar, { visibleDuration: { months: 2 } as never });
    const button = h.add("Button");
    h.rules(button, [
      {
        trigger: "onPress",
        actions: [
          {
            opcode: "capability",
            target: { nodeId: text },
            capabilityId: "hide",
          },
        ],
      },
      {
        trigger: "onPress",
        actions: [
          {
            opcode: "capability",
            target: { nodeId: form },
            capabilityId: "submit",
          },
        ],
      },
      {
        trigger: "onPress",
        actions: [
          {
            opcode: "capability",
            target: { unset: true },
            capabilityId: "hide",
          },
          {
            opcode: "append",
            collectionId: USERS,
            value: "child",
            parentKey: "u1",
          },
          { opcode: "remove", collectionId: USERS, keys: "u1" },
        ],
      },
      {
        trigger: "onHoverStart",
        actions: [{ opcode: "toast", message: "hover" }],
      },
    ]);
    const code = h.code();
    const file = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../../../packages/shared/src/codeView/__fixtures__/generated/adr296-page.tsx.txt",
    );
    const golden = `// ADR-296 Phase 1 — the page file's repaired forms (E1 · E2 · E3 · E4 · E9 · E10 · E12 · token · object), generated by packages/shared/src/codeView/generate.ts.\n// Golden output of apps/builder/src/preview/catalog/__tests__/adr296Vocabulary.test.tsx (UPDATE_CODE_VIEW=1 rewrites).\n\n${code}`;
    if (process.env.UPDATE_CODE_VIEW === "1" || !existsSync(file)) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, golden);
    }
    expect(golden).toBe(readFileSync(file, "utf8"));
    // The whole file pasted back over itself: nothing refused, no command (285 strict round trip).
    const data = h.dataOf();
    const session = catalogCodeViewSession(h.graph(), HOME, data)!;
    const plan = catalogCodeViewPlan({
      reader: h.workspace.runtime.graph.commandReader,
      session,
      edited: code,
      changes: [{ fromA: 0, toA: code.length, insert: code }],
      data,
      newId: h.workspace.newId,
      strict: true,
    });
    expect(plan.rejected).toEqual([]);
    const before = h.graph().revision;
    const applied = h.apply(code);
    expect(applied.rejected).toEqual([]);
    expect(h.graph().revision).toBe(before);
  });
});
