import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  createComponent,
  createPage,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  addCollection,
  setEndpoint,
  setProjectVariable,
} from "../../../../../../packages/shared/src/catalog/commands/data";
import type {
  DataCollectionId,
  EntryId,
  InteractionEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogInheritedRuleEnabledCommand } from "../../../builder/catalogRuntime/interactions";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import {
  BODY,
  edit,
  openAdr296,
  type Adr296Harness,
} from "./support/adr296Harness";

/**
 * ADR-296 Phase 0 (G0) — the code view's defects today, as RED (`it.fails`): each case states the
 * behavior the phase that closes it must give (E1 ~ E13 — breakdown §2c, the silent omissions — §2a),
 * so the phase turns its `it.fails` into `it`. A case's document setup must not be what fails: setup
 * runs before the assertions and its errors are collected — the last test asserts there were none
 * (an `it.fails` would pass on a broken setup).
 */
afterEach(() => vi.restoreAllMocks());

const setupErrors: string[] = [];
async function setup<T>(name: string, build: (h: Adr296Harness) => T) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr296();
  try {
    return { h, ...build(h) };
  } catch (error) {
    setupErrors.push(
      `${name}: ${error instanceof Error ? error.message : error}`,
    );
    throw error;
  }
}

/** `Picker` = a frame holding a Button ("save-button"), placed once (J). */
function picker(h: Adr296Harness) {
  const frame = h.add("frame", {}, BODY, "picker");
  const button = h.add("Button", {}, frame, "save-button");
  h.run(
    createComponent({ id: frame, name: "Picker", newId: h.workspace.newId }),
  );
  const J = h.node(BODY).children[0]! as NodeId;
  const address = { instances: [J], templatePath: [frame, button] };
  return { frame, button, J, address };
}

const actionsOf = (h: Adr296Harness, owner: string) =>
  h.rulesOf(owner).map((rule) => rule.actions);

describe("ADR-296 Phase 0 — RED (E1 ~ E13 · the silent omissions)", () => {
  it("E1 (1) — a rule on a When the panel hides (onHoverStart) reads back", async () => {
    const { h, button } = await setup("E1", (h) => {
      const button = h.add("Button");
      h.rules(button, [
        {
          trigger: "onHoverStart",
          actions: [{ opcode: "toast", message: "hover" }],
        },
      ]);
      return { button };
    });
    const result = h.apply(edit(h.code(), "'hover'", "'hi'"));
    expect(result.rejected).toEqual([]);
    expect(actionsOf(h, button)).toEqual([
      [{ opcode: "toast", message: "hi" }],
    ]);
  });

  it("E2 (1) — show · hide · toggle read back (`setTextIsVisible(true)` = show)", async () => {
    const { h, button, text } = await setup("E2", (h) => {
      const text = h.add("Text", { children: "Hi" });
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
      ]);
      return { button, text };
    });
    const result = h.apply(
      edit(h.code(), "setTextIsVisible(false)", "setTextIsVisible(true)"),
    );
    expect(result.rejected).toEqual([]);
    expect(actionsOf(h, button)).toEqual([
      [
        {
          opcode: "capability",
          target: { nodeId: text },
          capabilityId: "show",
        },
      ],
    ]);
  });

  it("E3 (1) — a Form's submit declares its ref and reads back (reset)", async () => {
    const { h, button, form } = await setup("E3", (h) => {
      const form = h.add("Form");
      const button = h.add("Button");
      h.rules(button, [
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
      ]);
      return { button, form };
    });
    const code = h.code();
    expect(code).toMatch(/let formRef = useRef<HTMLFormElement>\(null\);/);
    expect(code).toMatch(/<Form ref=\{formRef\}/);
    const result = h.apply(
      edit(code, "formRef.current?.submit()", "formRef.current?.reset()"),
    );
    expect(result.rejected).toEqual([]);
    expect(actionsOf(h, button)).toEqual([
      [
        {
          opcode: "capability",
          target: { nodeId: form },
          capabilityId: "reset",
        },
      ],
    ]);
  });

  it("E4 (1) — a Do whose target is unset stays when its handler is edited", async () => {
    const { h, button } = await setup("E4", (h) => {
      const button = h.add("Button");
      h.rules(button, [
        {
          trigger: "onPress",
          actions: [
            {
              opcode: "capability",
              target: { unset: true },
              capabilityId: "hide",
            },
            { opcode: "toast", message: "after" },
          ],
        },
      ]);
      return { button };
    });
    const code = h.code();
    expect(code).not.toMatch(/\/\/ \(a capability with no target\)/);
    const result = h.apply(edit(code, "'after'", "'then'"));
    expect(result.rejected).toEqual([]);
    expect(actionsOf(h, button)).toEqual([
      [
        {
          opcode: "capability",
          target: { unset: true },
          capabilityId: "hide",
        },
        { opcode: "toast", message: "then" },
      ],
    ]);
  });

  it("E5 (1 → 5) — an instance's rule at a position is not the instance element's handler", async () => {
    const { h, J } = await setup("E5", (h) => {
      const parts = picker(h);
      h.rules(
        parts.J,
        [
          {
            trigger: "onPress",
            actions: [{ opcode: "toast", message: "A only" }],
          },
        ],
        parts.address,
      );
      return parts;
    });
    const code = h.code();
    // (Today: `<Picker onPress={…}>` — the instance root's own When, a meaning the rule does not have.)
    expect(code).not.toMatch(
      /onPress=\{\(\) => \{\s*toasts\.add\(\{title: 'A only'\}\)/,
    );
    // An edit elsewhere keeps the rule at its position.
    const result = h.apply(code.replace("</>", "  <Text>New</Text>\n    </>"));
    expect(result.rejected).toEqual([]);
    expect(
      h
        .rulesOf(J)
        .map((rule) => [rule.address?.templatePath.length, rule.trigger]),
    ).toEqual([[2, "onPress"]]);
  });

  it.fails(
    "E6 (5) — an inherited rule turned off at an instance shows in the page code",
    async () => {
      const { h } = await setup("E6", (h) => {
        const parts = picker(h);
        const [ruleId] = h.rules(parts.button, [
          {
            trigger: "onPress",
            actions: [{ opcode: "toast", message: "origin" }],
          },
        ]);
        h.run(
          catalogInheritedRuleEnabledCommand(
            { ownerId: parts.J, address: parts.address },
            ruleId as EntryId<"interaction">,
            false,
          ),
        );
        return parts;
      });
      expect(h.code()).toMatch(/'off'/);
    },
  );

  it("E7 (2) — the page body's own props are the page element's (not flattened away)", async () => {
    const { h } = await setup("E7", (h) => {
      h.add("Button");
      h.declare(BODY, { isDisabled: true });
      return {};
    });
    expect(h.code()).toMatch(/isDisabled/);
  });

  it("E8 (3) — a project variable's Set state is its setter (not a comment)", async () => {
    const { h } = await setup("E8", (h) => {
      h.run(
        setProjectVariable({
          entry: {
            kind: "projectVariable",
            id: "data:variable:cart" as never,
            name: "cart",
            valueType: "number",
            defaultValue: 0,
            persist: false,
          },
        }),
      );
      const button = h.add("Button");
      h.rules(button, [
        {
          trigger: "onPress",
          actions: [
            {
              opcode: "setState",
              variableId: "data:variable:cart" as never,
              op: "set",
              value: 1,
            },
          ],
        },
      ]);
      return {};
    });
    const code = h.code();
    expect(code).not.toMatch(/a variable not on this page/);
    expect(code).toMatch(/let \{cart, setCart\} = useProjectState\(\);/);
    expect(code).toMatch(/setCart\(1\);/);
  });

  it("E9 (1) — two rules on one When stay two rules (named handlers)", async () => {
    const { h, button, ids } = await setup("E9", (h) => {
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
    });
    const code = h.code();
    expect(code).toMatch(/function onButtonPress\(\) \{/);
    expect(code).toMatch(/function onButtonPress2\(\) \{/);
    expect(code).toMatch(
      /onPress=\{\(\) => \{ onButtonPress\(\); onButtonPress2\(\); \}\}/,
    );
    const result = h.apply(edit(code, "'two'", "'deux'"));
    expect(result.rejected).toEqual([]);
    expect(h.rulesOf(button).map((rule) => [rule.id, rule.actions])).toEqual([
      [ids[0], [{ opcode: "toast", message: "one" }]],
      [ids[1], [{ opcode: "toast", message: "deux" }]],
    ]);
  });

  it("E10 (1) — a tree append's parent key is in the code", async () => {
    const { h } = await setup("E10", (h) => {
      h.run(
        addCollection({
          entry: {
            kind: "collection",
            id: "data:collection:items" as DataCollectionId,
            name: "items",
            schema: [{ id: "i-id", key: "id", type: "string" }],
            mockData: [{ id: "p1" }],
            useMockData: true,
          },
        }),
      );
      const button = h.add("Button");
      h.rules(button, [
        {
          trigger: "onPress",
          actions: [
            {
              opcode: "append",
              collectionId: "data:collection:items" as DataCollectionId,
              value: "new",
              parentKey: "p1",
            },
          ],
        },
      ]);
      return {};
    });
    expect(h.code()).toMatch(/\.append\('p1', 'new'\);/);
  });

  it("E11 (1 → 3) — two endpoints with one URL: an edit does not switch the call to the first", async () => {
    const endpoint = (id: string, name: string) =>
      ({
        kind: "endpoint",
        id: `data:endpoint:${id}`,
        name,
        method: "POST",
        baseUrl: "https://api.example.com",
        path: "/orders",
        headers: [],
        queryParams: [],
        bodyType: "json",
        responseMapping: { dataPath: "" },
        executionMode: "client",
      }) as never;
    const { h, button } = await setup("E11", (h) => {
      h.run(setEndpoint({ entry: endpoint("a", "saveOrder") }));
      h.run(setEndpoint({ entry: endpoint("b", "saveDraft") }));
      const button = h.add("Button");
      h.rules(button, [
        {
          trigger: "onPress",
          actions: [
            {
              opcode: "callEndpoint",
              endpointId: "data:endpoint:b" as never,
            },
            { opcode: "toast", message: "sent" },
          ],
        },
      ]);
      return { button };
    });
    const result = h.apply(edit(h.code(), "'sent'", "'ok'"));
    if (result.rejected.length)
      expect(result.rejected.map((item) => item.reason)).toContain(
        "ambiguousEndpoint",
      );
    else
      expect(actionsOf(h, button)[0]![0]).toMatchObject({
        endpointId: "data:endpoint:b",
      });
  });

  it("E12 (1) — `remove` of one key is not a spread of the key", async () => {
    const { h } = await setup("E12", (h) => {
      h.run(
        addCollection({
          entry: {
            kind: "collection",
            id: "data:collection:items" as DataCollectionId,
            name: "items",
            schema: [{ id: "i-id", key: "id", type: "string" }],
            mockData: [{ id: "a" }],
            useMockData: true,
          },
        }),
      );
      const list = h.add("GridList");
      h.rules(list, [
        {
          trigger: "onAction",
          actions: [
            {
              opcode: "remove",
              collectionId: "data:collection:items" as DataCollectionId,
              keys: "!event.key",
            },
          ],
        },
      ]);
      return {};
    });
    const code = h.code();
    expect(code).toMatch(/\.remove\(key\);/);
    expect(code).not.toMatch(/\.remove\(\.\.\.key\)/);
  });

  it("E13 (1) — a Do whose target is not on this page shows (and stays)", async () => {
    const { h, button } = await setup("E13", (h) => {
      const other = "project:node:other-text" as NodeId;
      h.run(
        createPage({
          page: {
            kind: "page",
            id: "project:page:other" as EntryId<"page">,
            route: "/other",
            name: "Other",
            children: [other],
          },
          entries: [
            {
              kind: "node",
              id: other,
              definitionId: catalogPaletteDefinitionId(h.library, "Text"),
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
        }),
      );
      const button = h.add("Button");
      h.rules(button, [
        {
          trigger: "onPress",
          actions: [
            {
              opcode: "capability",
              target: { nodeId: other },
              capabilityId: "hide",
            },
            { opcode: "toast", message: "after" },
          ],
        },
      ]);
      return { button, other };
    });
    const code = h.code();
    // (A node of another page by its reference — `<route>#<node>`; read back unchanged.)
    expect(code).toMatch(/capability\('hide', \{target: '\/other#text'\}\);/);
    const result = h.apply(edit(code, "'after'", "'then'"));
    expect(result.rejected).toEqual([]);
    expect(actionsOf(h, button)[0]).toHaveLength(2);
  });

  it("omission (1) — a token prop is a read-only marker, not left out", async () => {
    const { h } = await setup("token", (h) => {
      const bar = h.add("ProgressBar");
      const [tokenId] = [...h.library.tokens].find(
        ([, token]) => token.tokenType === "number",
      )!;
      h.run(
        setFields({
          targets: [{ kind: "node", id: bar }],
          props: {
            value: { kind: "set", value: { kind: "token", tokenId } },
          } as never,
          label: "Token prop",
        }),
      );
      return {};
    });
    expect(h.code()).toMatch(/value=\{token\('[^']+'\)\}/);
  });

  it("omission (1) — a calendar duration · number format read back", async () => {
    const { h, calendar } = await setup("objects", (h) => {
      const calendar = h.add("Calendar");
      h.declare(calendar, { visibleDuration: { months: 2 } as never });
      return { calendar };
    });
    const result = h.apply(edit(h.code(), "{months: 2}", "{months: 3}"));
    expect(result.rejected).toEqual([]);
    expect(h.node(calendar).props.visibleDuration).toEqual({
      kind: "set",
      value: { months: 3 },
    });
  });

  it.fails(
    "omission (5) — an instance is its component's name, not its root's type",
    async () => {
      const { h } = await setup("instance", (h) => picker(h));
      expect(h.code()).toMatch(/<Picker\b/);
    },
  );

  it("G3 oracle entry point — the root's resolved record per breakpoint (no new export)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const text = h.add("Text", { children: "Hi" });
    h.run(
      setFields({
        targets: [{ kind: "node", id: text }],
        visual: { color: { kind: "set", value: "#ff0000" } },
        label: "Color",
      }),
    );
    h.run(
      setFields({
        targets: [{ kind: "node", id: text }],
        breakpoint: "tablet",
        visual: { color: { kind: "set", value: "#00ff00" } },
        label: "Tablet color",
      } as never),
    );
    /** The oracle (G3): what the Canvas reads of a node at a breakpoint. */
    const resolved = (breakpoint: "desktop" | "tablet" | "mobile") => {
      h.workspace.setBreakpoint(breakpoint);
      const root = h.workspace.root;
      const [record] = root.recordsOfSource(text);
      const input = root.canvasInputs.get(record!)!;
      return {
        color: input.visual.color,
        layout: root.getLayoutInput(record!),
      };
    };
    expect(resolved("desktop").color).toBe("#ff0000");
    expect(resolved("tablet").color).toBe("#00ff00");
    expect(resolved("mobile").color).toBe("#00ff00");
    expect(resolved("desktop").layout).toBeTypeOf("object");
  });

  it("every case's document setup ran (an it.fails must fail on its assertion)", () => {
    expect(setupErrors).toEqual([]);
  });
});

afterAll(() => {
  if (setupErrors.length) console.error(setupErrors);
});

export type { InteractionEntry };
