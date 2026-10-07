import "fake-indexeddb/auto";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogTextEditor } from "../../workspace/canvas/catalog/CatalogTextEditor";
import { catalogTextKey, committedWhiteSpace } from "../canvasText";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-3b inline text editing: the field shows the record's own text; Escape (or
 * leaving the field) commits one command when the text changed and ends the edit; an unchanged
 * text commits nothing. A container has no own text to edit.
 */
const PROJECT = "project:project:text" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const HEADING = "project:node:title" as NodeId;
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:t${++next}` as EntryId<K>;
};

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Text" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-text-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: HEADING,
          definitionId: "lib:definition:heading",
          children: [],
          props: { children: { kind: "set", value: "Hello" } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [HEADING],
      newId: allocator(),
    }),
  );
  const record = workspace.root.recordsOfSource(HEADING)[0];
  const box = { x: 10, y: 20, width: 200, height: 40 };
  const view = render(
    <CatalogTextEditor workspace={workspace} boundsOf={() => box} />,
  );
  const field = () =>
    view.queryByTestId("catalog-text-editor") as HTMLTextAreaElement | null;
  const text = () => {
    const entry = workspace.runtime.graph.getEntry(HEADING);
    return entry?.kind === "node" ? entry.props.children : undefined;
  };
  return { workspace, record, field, text };
}

describe("ADR-248 Phase 4e-3b inline text editing", () => {
  it("resolves the element's own text prop; a container has none", async () => {
    const { workspace, record } = await open();
    expect(catalogTextKey(workspace.root.domInputs.get(record))).toBe(
      "children",
    );
    const body = workspace.root.recordsOfSource(BODY)[0];
    expect(catalogTextKey(workspace.root.domInputs.get(body))).toBeUndefined();
  });

  it("Escape commits a changed text as one step and ends the edit; an unchanged text commits nothing", async () => {
    const { workspace, record, field, text } = await open();
    expect(field()).toBeNull();
    act(() => workspace.session.startTextEdit(workspace.itemOfRecord(record)!));
    expect(field()?.value).toBe("Hello");

    const revision = workspace.runtime.graph.revision;
    fireEvent.keyDown(field()!, { key: "Escape" });
    expect(workspace.runtime.graph.revision).toBe(revision);
    expect(workspace.session.getSnapshot().textEditing).toBeUndefined();
    expect(field()).toBeNull();

    act(() => workspace.session.startTextEdit(workspace.itemOfRecord(record)!));
    fireEvent.change(field()!, { target: { value: "Hello\nworld" } });
    act(() => {
      fireEvent.blur(field()!);
    });
    expect(text()).toEqual({ kind: "set", value: "Hello\nworld" });
    expect(workspace.runtime.graph.revision).toBe(revision + 1);
    expect(field()).toBeNull();
    // The line break would collapse under `normal`: the same step lifts white-space (the old
    // editor's rule), so it shows; undo takes both back.
    const visual = () => {
      const entry = workspace.runtime.graph.getEntry(HEADING);
      return entry?.kind === "node" ? entry.visual : {};
    };
    expect(visual()).toMatchObject({
      whiteSpace: { kind: "set", value: "pre-wrap" },
    });
    workspace.undo();
    expect(text()).toEqual({ kind: "set", value: "Hello" });
    expect(visual()).not.toHaveProperty("whiteSpace");
  });

  /**
   * The field is the text's box: one line tall when the text is one line (a textarea's own default
   * is two rows — its height then overshot the box), growing with the typed lines.
   */
  it("the field is as tall as the text's box, not a textarea's default two rows", async () => {
    const { workspace, record, field } = await open();
    act(() => workspace.session.startTextEdit(workspace.itemOfRecord(record)!));
    expect(field()!.rows).toBe(1);
    expect(field()!.style.height).toBe("40px");
    Object.defineProperty(field()!, "scrollHeight", {
      configurable: true,
      get: () => 120,
    });
    fireEvent.change(field()!, { target: { value: "a\nb\nc" } });
    expect(field()!.style.height).toBe("120px");
  });

  it("a committed text without a line break, or one already pre-formatted, leaves white-space alone", async () => {
    const { workspace, record, field } = await open();
    const visual = () => {
      const entry = workspace.runtime.graph.getEntry(HEADING);
      return entry?.kind === "node" ? entry.visual : {};
    };
    act(() => workspace.session.startTextEdit(workspace.itemOfRecord(record)!));
    fireEvent.change(field()!, { target: { value: "Hello there" } });
    act(() => void fireEvent.blur(field()!));
    expect(visual()).not.toHaveProperty("whiteSpace");
    expect(committedWhiteSpace("pre-line", "a\nb")).toBeNull();
    expect(committedWhiteSpace("nowrap", "a\nb")).toBe("pre");
    expect(committedWhiteSpace(undefined, "a\nb")).toBe("pre-wrap");
  });
});
