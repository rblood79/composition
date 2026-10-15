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
import { catalogOwnerDecidedProps } from "../../../../../../packages/shared/src/catalog/runtime/ownerDecidedProps";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-14 (사용자 「모든컴퍼넌트와 컴퍼넌트 자식들 전수조사후 불필요하게 등록된 프러퍼티 제거」): the
 * props a node's owner decides where it sits are not offered on the node — a grouped Checkbox's size,
 * emphasis and error message (its name · value stay its own — RAC · S2), a field's button's size, a picker's list selection.
 */
const BODY = "project:node:home-body" as NodeId;

async function open(origins: string[]) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:owner-decided" as EntryId<"project">,
        name: "Owner decided",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `owner-decided-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  origins.forEach((origin, index) => {
    const id = `project:node:owner-${index}` as NodeId;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id,
            definitionId:
              `lib:definition:origin-component-${origin}` as DefinitionId,
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [id],
        newId: workspace.newId,
      }),
    );
  });
  const root = workspace.root;
  /** Each record of `type` under the `index`th origin: its owner and decided keys. */
  const decided = (index: number, type: string) => {
    const top = [...root.domInputs.values()].find(
      (record) => record.sourceId === `project:node:owner-${index}`,
    )!;
    const under = (record: typeof top): (typeof top)[] => [
      record,
      ...record.children.flatMap((id) => {
        const child = root.domInputs.get(id);
        return child ? under(child) : [];
      }),
    ];
    return under(top)
      .filter((record) => root.typeOf(record) === type)
      .map((record) => {
        const result = catalogOwnerDecidedProps(root, record);
        return result
          ? `${result.owner}: ${[...result.keys].sort().join(",")}`
          : "";
      });
  };
  return { decided };
}

describe("props an owner decides are not the node's to edit", () => {
  it("a Checkbox in a CheckboxGroup — its group's; alone, its own", async () => {
    const { decided } = await open(["checkboxgroup", "checkbox"]);
    expect(new Set(decided(0, "Checkbox"))).toEqual(
      new Set(["CheckboxGroup: errorMessage,isEmphasized,size"]),
    );
    expect(decided(1, "Checkbox")).toEqual([""]);
  });

  it("a Radio's size is its RadioGroup's", async () => {
    const { decided } = await open(["radiogroup"]);
    expect(new Set(decided(0, "Radio"))).toEqual(
      new Set(["RadioGroup: isEmphasized,size"]),
    );
  });

  it("a Select's trigger Button takes its size; its list's selection is the picker's", async () => {
    const { decided } = await open(["select", "button"]);
    expect(decided(0, "Button")).toEqual(["Select: size"]);
    expect(decided(0, "ListBox")).toEqual([
      "Select: disallowEmptySelection,selectionMode",
    ]);
    expect(new Set(decided(0, "ListBoxItem"))).toEqual(
      new Set(["Select: isSelected"]),
    );
    // (A Button on its own keeps its size.)
    expect(decided(1, "Button")).toEqual([""]);
  });

  it("a Tag's size is its TagGroup's — named past the TagList between", async () => {
    const { decided } = await open(["taggroup"]);
    expect(new Set(decided(0, "Tag"))).toEqual(new Set(["TagGroup: size"]));
  });

  it("a DateRangePicker's RangeCalendar: the picker's state and its non-contiguous ranges", async () => {
    const { decided } = await open(["daterangepicker"]);
    const [calendar] = decided(0, "RangeCalendar");
    expect(calendar).toMatch(/^DateRangePicker: /);
    expect(calendar).toContain("allowsNonContiguousRanges");
    expect(calendar).toContain("isDisabled");
  });
});
