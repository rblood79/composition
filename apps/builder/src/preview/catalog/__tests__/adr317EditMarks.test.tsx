import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import type {
  DataEndpointId,
  NodeId,
  NodeParent,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogColumnEditableCommand } from "../../../builder/catalogRuntime/tableEditableCell";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-317 Phase 4 (G4) — a Table 「Edit marks」 (breakdown §5.4): the rows its viewer changed and
 * did not save show a mark — the Row's `data-edit-status` (`new` · `dirty`), the changed Cells'
 * `data-edited`, the status said in the row's first data Cell — read from the session's edit
 * record by the row's key now. The Table's When 「Cells change」 (사용자 결정 1) runs once a
 * paste · fill · clear; a save it sends that succeeds clears the marks of what it sent, but a cell
 * written again after it (사용자 결정 6); a failure clears nothing. An Editable cell's save whose
 * Form rule saves clears that cell's mark.
 *
 * Fixture (Name · Type · Status): p1 Bora B 2 · p2 Chan A 1 · p3 Ara B 3. The wanted marks are
 * written by hand.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const ENDPOINT = "data:endpoint:save" as DataEndpointId;

const USERS = {
  id: "users",
  name: "Users",
  schema: [
    { id: "f-id", key: "id", type: "string" },
    { id: "f-name", key: "name", type: "string" },
    { id: "f-type", key: "type", type: "string" },
    { id: "f-status", key: "status", type: "number" },
  ],
  mockData: [
    { id: "p1", name: "Bora", type: "B", status: 2 },
    { id: "p2", name: "Chan", type: "A", status: 1 },
    { id: "p3", name: "Ara", type: "B", status: 3 },
  ],
  useMockData: true,
};

/** A collection without a key field: its items are keyed by place (`row-N`). */
const NOTES = {
  id: "users",
  name: "Users",
  schema: [
    { id: "f-name", key: "name", type: "string" },
    { id: "f-type", key: "type", type: "string" },
    { id: "f-status", key: "status", type: "number" },
  ],
  mockData: [
    { name: "Bora", type: "B", status: 2 },
    { name: "Chan", type: "A", status: 1 },
    { name: "Ara", type: "B", status: 3 },
  ],
  useMockData: true,
};

async function openTable(
  options: { marks?: boolean; collection?: typeof USERS | typeof NOTES } = {},
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  // (The save endpoint's answers, in order: each call waits for its test to settle it.)
  const answers: ((ok: boolean) => void)[] = [];
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        answers.push((ok) =>
          resolve(
            new Response("{}", {
              status: ok ? 200 : 500,
              headers: { "content-type": "application/json" },
            }),
          ),
        );
      }),
  );
  const h = await openAdr280Preview(["Table"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [options.collection ?? USERS],
      variables: [],
      apiEndpoints: [
        {
          id: "save",
          name: "save",
          baseUrl: "https://api.example.test",
          path: "/rows",
          method: "POST",
          headers: [],
          responseMapping: { dataPath: "" },
        },
      ],
    } as never);
  });
  const id = h.ids[0] as NodeId;
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  for (const [key, value] of Object.entries({
    allowsCellSelection: true,
    allowsPasting: true,
    ...(options.marks === false ? {} : { showEditMarks: true }),
  }))
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: { [key]: { kind: "set", value } } as never,
      }),
    );
  h.flush();
  await settle();
  const root = () => h.workspace.root;
  const column = (key: string): NodeParent => {
    const header = [...root().canvasInputs.values()].find(
      (record) => root().typeOf(record as never) === "TableHeader",
    )!;
    const record = header.children
      .map((child) => root().canvasInputs.get(child)!)
      .find((each) => each.props.key === key)!;
    return h.workspace.positionOfRecord(record.id)!.target as NodeParent;
  };
  for (const key of ["name", "status"]) {
    h.workspace.execute(
      catalogColumnEditableCommand(
        h.workspace.runtime.graph,
        column(key),
        true,
        h.workspace.newId,
        { edit: (label) => `Edit ${label}` },
      ),
    );
    h.flush();
    await settle();
  }
  const container = h.view.container;
  const row = (key: string) =>
    container.querySelector<HTMLElement>(`[role="row"][data-key="${key}"]`)!;
  const cell = (key: string, columnKey: string) =>
    row(key).querySelector<HTMLElement>(`[data-column-key="${columnKey}"]`)!;
  /** Each body row's mark: `key status [edited Column keys] said`. */
  const marks = () =>
    [...container.querySelectorAll<HTMLElement>('tbody [role="row"]')].flatMap(
      (each) => {
        const status = each.getAttribute("data-edit-status");
        const edited = [
          ...each.querySelectorAll<HTMLElement>("[data-edited]"),
        ].map((element) => element.getAttribute("data-column-key"));
        const said = each.querySelector("[data-row-edit] [data-edit-said]");
        return status || edited.length || said
          ? [
              `${each.getAttribute("data-key")} ${status ?? "-"} [${edited.join(",")}] ${
                said?.textContent?.trim() ?? "-"
              }`,
            ]
          : [];
      },
    );
  /** A cell's value as drawn (without the status said in it). */
  const value = (key: string, columnKey: string) => {
    const copy = cell(key, columnKey).cloneNode(true) as HTMLElement;
    copy.querySelector("[data-edit-said]")?.remove();
    return copy.textContent?.trim();
  };
  const press = (target: HTMLElement) =>
    act(() => {
      fireEvent.pointerDown(target, { button: 0 });
      fireEvent.pointerUp(target, { button: 0 });
    });
  const paste = (key: string, columnKey: string, text: string) => {
    press(cell(key, columnKey));
    act(() => {
      fireEvent.paste(cell(key, columnKey), {
        clipboardData: {
          getData: (type: string) => (type === "text/plain" ? text : ""),
        },
      });
    });
  };
  const answer = async (index: number, ok: boolean) => {
    await waitFor(() => expect(answers.length).toBeGreaterThan(index));
    answers[index]!(ok);
    await settle();
  };
  return {
    h,
    id,
    root,
    row,
    cell,
    value,
    marks,
    paste,
    fetch,
    answer,
    errors,
  };
}

describe("ADR-317 Phase 4 — a Table 「Edit marks」", () => {
  it("marks the written rows · cells and says the status; a Table without it draws none", async () => {
    const t = await openTable();
    expect(t.marks()).toEqual([]);
    t.paste("p2", "name", "Ana\tX\t9\nBo\tY\tabc");
    await settle();
    // (Type is not 「Editable」; 「abc」 is no number — neither written, neither marked.)
    expect(t.marks()).toEqual([
      "p2 dirty [name,status] Edited",
      "p3 dirty [name] Edited",
    ]);
    expect(t.cell("p2", "type").hasAttribute("data-edited")).toBe(false);
    expect(t.errors).not.toHaveBeenCalled();
    t.h.view.unmount();

    const off = await openTable({ marks: false });
    off.paste("p2", "name", "Ana");
    await settle();
    expect(off.value("p2", "name")).toBe("Ana");
    expect(off.marks()).toEqual([]);
    off.h.view.unmount();
  }, 120_000);

  it("follows the item, not the key an edit named: keys by place move on an insert · a remove", async () => {
    const t = await openTable({ collection: NOTES });
    // (Keys by place count from 1: row-1 Bora · row-2 Chan · row-3 Ara.)
    act(() => {
      t.h.session.update("users", "row-2", { name: "Chen" });
    });
    await settle();
    expect(t.marks()).toEqual(["row-2 dirty [name] Edited"]);
    // A new item first: Chen is row-3 now, the new item is new.
    act(() => {
      t.h.session.insert("users", "start", { name: "Dami", type: "A" });
    });
    await settle();
    expect(t.marks()).toEqual([
      "row-1 new [] New row",
      "row-3 dirty [name] Edited",
    ]);
    // Bora (row-2) goes: Chen is row-2 again.
    act(() => {
      t.h.session.remove("users", ["row-2"]);
    });
    await settle();
    expect(t.marks()).toEqual([
      "row-1 new [] New row",
      "row-2 dirty [name] Edited",
    ]);
    expect(t.value("row-2", "name")).toBe("Chen");
    t.h.view.unmount();
  }, 120_000);

  it("「Cells change」 runs once a write; its save clears what it sent but a cell written after it; a failure clears nothing", async () => {
    const t = await openTable();
    t.h.rule(t.id, "onCellsChange", {
      opcode: "callEndpoint",
      endpointId: ENDPOINT,
      body: "!event.items",
    } as never);
    await settle();
    // Save 1 sends p2's name · status.
    t.paste("p2", "name", "Ana\t\t9");
    await settle();
    expect(t.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(t.fetch.mock.calls[0]![1]!.body))).toEqual([
      { id: "p2", name: "Ana", type: "A", status: 9 },
    ]);
    // Save 2 sends p2's name again, before save 1 is answered.
    t.paste("p2", "name", "Zed");
    await settle();
    expect(t.fetch).toHaveBeenCalledTimes(2);
    expect(t.marks()).toEqual(["p2 dirty [name,status] Edited"]);
    // Save 1 taken: status saved; name was written again after it — it stays.
    await t.answer(0, true);
    expect(t.marks()).toEqual(["p2 dirty [name] Edited"]);
    // Save 2 refused: nothing cleared.
    await t.answer(1, false);
    expect(t.marks()).toEqual(["p2 dirty [name] Edited"]);
    // Save 3 (p3's status) taken: only its cell.
    t.paste("p3", "status", "4");
    await settle();
    await t.answer(2, true);
    expect(t.marks()).toEqual(["p2 dirty [name] Edited"]);
    // The values stay the edits'.
    expect(t.value("p2", "name")).toBe("Zed");
    expect(t.value("p3", "status")).toBe("4");
    t.h.view.unmount();
  }, 120_000);

  it("an Editable cell's save whose Form rule saves clears that cell's mark when it succeeds", async () => {
    const t = await openTable();
    const form = [...t.root().canvasInputs.values()].find(
      (record) => t.root().typeOf(record as never) === "Form",
    )!;
    t.h.rule((form.sourceId ?? form.id) as NodeId, "onSubmit", {
      opcode: "callEndpoint",
      endpointId: ENDPOINT,
      body: "!event.formData",
    } as never);
    await settle();
    act(() => {
      fireEvent.click(
        t
          .row("p1")
          .querySelector<HTMLButtonElement>('button[aria-label="Edit Name"]')!,
      );
    });
    await waitFor(() => expect(document.querySelector("form")).not.toBeNull());
    act(() => {
      fireEvent.change(document.querySelector('form input[name="name"]')!, {
        target: { value: "Bori" },
      });
    });
    act(() => {
      fireEvent.click(
        document.querySelector<HTMLButtonElement>('button[aria-label="Save"]')!,
      );
    });
    await settle();
    expect(t.marks()).toEqual(["p1 dirty [name] Edited"]);
    expect(t.fetch).toHaveBeenCalledTimes(1);
    await t.answer(0, true);
    expect(t.marks()).toEqual([]);
    expect(t.value("p1", "name")).toBe("Bori");
    t.h.view.unmount();
  }, 120_000);
});
