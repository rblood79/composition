// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DefinitionId,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogItemInsertChoices } from "../itemInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogRadioGroupValueOptions } from "../singleSelection";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-14 (사용자 「radioGroup, CheckboxGroup 기본 값들이 option 1, option 2 .. slot에서 추가시
 * Radio, Checkbox로 나타난다. Option x 로 통일」): a RadioGroup's · CheckboxGroup's "+" adds the next
 * option like the template's own ("Option 3" — a Radio with its own value `option3`), not the bare
 * origin ("Radio" · value `radio` on every added Radio, which RAC's group took as one value).
 */
const BODY = "project:node:home-body" as NodeId;
const OWNER = "project:node:group" as NodeId;

async function open(definition: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:group-option" as EntryId<"project">,
        name: "Group option",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `group-option-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId:
            `lib:definition:origin-component-${definition}` as DefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const add = (groupType: string, itemType: string) => {
    const group = of(groupType)[0]!;
    const choice = catalogItemInsertChoices(
      {
        graph: workspace.runtime.graph,
        readModel: workspace.readModel,
        newId: workspace.newId,
      },
      workspace.positionOfRecord(group.id)!,
    ).find((option) => option.type === itemType)!;
    workspace.execute(choice.build());
  };
  return { root, of, add };
}

describe("a group's + adds the next option", () => {
  it("RadioGroup: Option 3 · Option 4 with their own values", async () => {
    const { root, of, add } = await open("radiogroup");
    add("RadioGroup", "Radio");
    add("RadioGroup", "Radio");
    const radios = of("Radio");
    expect(radios.map((r) => r.props.children)).toEqual([
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4",
    ]);
    expect(radios.map((r) => r.props.value)).toEqual([
      "option1",
      "option2",
      "option3",
      "option4",
    ]);
    // (The group's Value lists each — the Design panel's choices.)
    expect(
      catalogRadioGroupValueOptions(root, of("RadioGroup")[0]!.id).map(
        (option) => option.label,
      ),
    ).toEqual(["Option 1", "Option 2", "Option 3", "Option 4"]);
  });

  it("CheckboxGroup: Option 3", async () => {
    const { of, add } = await open("checkboxgroup");
    add("CheckboxGroup", "Checkbox");
    expect(of("Checkbox").map((r) => r.props.children)).toEqual([
      "Option 1",
      "Option 2",
      "Option 3",
    ]);
  });
});
