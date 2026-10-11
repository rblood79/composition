import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { setAiReadHost } from "../../../services/ai/aiReadHost";
import { setAiWriteHost } from "../../../services/ai/aiWriteHost";
import { updateElementTool } from "../../../services/ai/tools/updateElement";
import { validateCompilerToolCall } from "../../../services/ai/compiler/toolValidation";
import type { ToolTranslate } from "../../../types/integrations/ai.types";
import { createCatalogAiReadHost, createCatalogAiWriteHost } from "../aiHost";
import { catalogPropertiesPatchCommand } from "../editContract";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-258 G1 (host integration) — the color value type and the one-write normalization through the
 * real write paths, not the functions alone:
 * - the document refuses a color RAC cannot parse and a channel outside the color space before the
 *   transaction (revision unchanged, no history),
 * - the Properties patch, the AI update (`update_element` → catalog host) and the AI create (host)
 *   each widen a channel pick to its color space in the same single step (one undo takes both back).
 */
const PROJECT = "project:project:color" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const t: ToolTranslate = (key, params) =>
  params ? `${key} ${JSON.stringify(params)}` : key;

let uninstall: (() => void)[] = [];
afterEach(() => {
  uninstall.forEach((off) => off());
  uninstall = [];
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Color" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr258-color-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  let n = 0;
  const node = (
    name: string,
    type: string,
    props: NodeEntry["props"] = {},
  ): NodeEntry => ({
    kind: "node",
    id: id(name),
    definitionId: `lib:definition:type-${type}` as NodeEntry["definitionId"],
    children: [],
    props,
    visual: {},
    sizing: {},
    descendantOverrides: [],
  });
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("slider", "ColorSlider", {
          defaultValue: { kind: "set", value: "hsl(0, 100%, 50%)" },
          channel: { kind: "set", value: "hue" },
        }),
        node("area", "ColorArea", {
          colorSpace: { kind: "set", value: "hsl" },
        }),
      ],
      rootIds: [id("slider"), id("area")],
      newId: (kind: EntryKind) => `project:${kind}:c${++n}` as never,
    }),
  );
  uninstall.push(
    setAiReadHost(createCatalogAiReadHost(workspace)),
    setAiWriteHost(createCatalogAiWriteHost(workspace)),
  );
  const graph = workspace.runtime.graph;
  const props = (name: string) => {
    const entry = graph.getEntry(id(name));
    return entry?.kind === "node"
      ? Object.fromEntries(
          Object.entries(entry.props).map(([key, write]) => [
            key,
            (write as { value?: unknown }).value,
          ]),
        )
      : {};
  };
  const record = (name: string) => workspace.root.recordsOfSource(id(name))[0]!;
  const steps = () => workspace.runtime.historyDepth.undo;
  return { workspace, graph, props, record, steps };
}

describe("ADR-258 — color values and channels through the write paths", () => {
  it("the document refuses a non-RAC color and a channel outside the space: no step, revision unchanged", async () => {
    const { workspace, graph, props, steps } = await open();
    const revision = graph.revision;
    const before = steps();
    for (const value of ["red", "rgb(255 0 0)", "hsl(12", "oklch(0.6 0.1 30)"])
      expect(() =>
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: id("slider") }],
            props: { defaultValue: { kind: "set", value } },
            label: "bad color",
          }),
        ),
      ).toThrow();
    expect(() =>
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: id("slider") }],
          props: { channel: { kind: "set", value: "red" } },
          label: "channel outside the space",
        }),
      ),
    ).toThrow(/PROP_COMBINATION_MISMATCH|not in color space/);
    expect(graph.revision).toBe(revision);
    expect(steps()).toBe(before);
    expect(props("slider")).toEqual({
      defaultValue: "hsl(0, 100%, 50%)",
      channel: "hue",
    });
  });

  it("Properties: hsl · hue → channel red writes colorSpace rgb in the same step; one undo takes both back", async () => {
    const { workspace, graph, props, steps } = await open();
    const target = { kind: "node" as const, id: id("slider") };
    const before = steps();
    const command = catalogPropertiesPatchCommand(
      graph,
      [target],
      { channel: "red" },
      (key) => workspace.readModel.propSource(target, key).value,
      new Set(),
      workspace.newId,
      (t, key) => workspace.readModel.propSource(t, key).value,
    );
    workspace.execute(command!);
    expect(props("slider")).toMatchObject({
      channel: "red",
      colorSpace: "rgb",
    });
    expect(steps()).toBe(before + 1);
    await workspace.undo();
    expect(props("slider")).toEqual({
      defaultValue: "hsl(0, 100%, 50%)",
      channel: "hue",
    });
  });

  it("Properties: a ColorArea axis outside the space moves the space and clears the clashing axis", async () => {
    const { workspace, graph, props } = await open();
    const target = { kind: "node" as const, id: id("area") };
    workspace.execute(
      catalogPropertiesPatchCommand(
        graph,
        [target],
        { xChannel: "blue" },
        (key) => workspace.readModel.propSource(target, key).value,
        new Set(),
        workspace.newId,
        (t, key) => workspace.readModel.propSource(t, key).value,
      )!,
    );
    expect(props("area")).toMatchObject({
      colorSpace: "rgb",
      xChannel: "blue",
    });
  });

  it("AI update_element: channel red widens to rgb in one step; a non-RAC color is refused before any step", async () => {
    const { workspace, graph, props, record, steps } = await open();
    const before = steps();
    const updated = await updateElementTool.execute(
      { elementId: record("slider"), props: { channel: "red" } },
      t,
    );
    expect(updated.success, updated.error).toBe(true);
    expect(props("slider")).toMatchObject({
      channel: "red",
      colorSpace: "rgb",
    });
    expect(steps()).toBe(before + 1);
    await workspace.undo();
    expect(props("slider")).toEqual({
      defaultValue: "hsl(0, 100%, 50%)",
      channel: "hue",
    });
    // A valid RAC color passes the compiler's field check and writes.
    expect(
      validateCompilerToolCall(
        "update_element",
        { elementId: record("slider"), props: { defaultValue: "#00ff00" } },
        t,
      ),
    ).toBeNull();
    // A CSS name is refused by the compiler and, written past it, by the document: no step.
    expect(
      validateCompilerToolCall(
        "update_element",
        { elementId: record("slider"), props: { defaultValue: "red" } },
        t,
      ),
    ).not.toBeNull();
    const revision = graph.revision;
    const depth = steps();
    const refused = await updateElementTool.execute(
      { elementId: record("slider"), props: { defaultValue: "red" } },
      t,
    );
    expect(refused.success).toBe(false);
    expect(graph.revision).toBe(revision);
    expect(steps()).toBe(depth);
  });

  it("AI create (host): initial channel red comes with colorSpace rgb in the one insert step", async () => {
    const { workspace, graph, steps } = await open();
    const before = steps();
    const host = createCatalogAiWriteHost(workspace);
    const created = await host.create({
      type: "ColorSlider",
      parentId: null,
      props: { channel: "red" },
    });
    expect(created.ok, (created as { error?: string }).error).toBe(true);
    const elementId = (created as { elementId: string }).elementId;
    const target = workspace.positionOfRecord(elementId)!.target;
    const entry =
      target.kind === "node" ? graph.getEntry(target.id) : undefined;
    const written =
      entry?.kind === "node"
        ? Object.fromEntries(
            Object.entries(entry.props).map(([key, write]) => [
              key,
              (write as { value?: unknown }).value,
            ]),
          )
        : {};
    expect(written).toMatchObject({ channel: "red", colorSpace: "rgb" });
    // ADR-258 Phase 2: the AI places the ColorSlider origin — the reference tree with its parts.
    expect(entry?.kind === "node" && entry.definitionId).toBe(
      "lib:definition:origin-component-colorslider",
    );
    const parts: string[] = [];
    const visit = (id: string) => {
      const record = workspace.root.canvasInputs.get(id);
      if (!record) return;
      parts.push(workspace.root.typeOf(record));
      record.children.forEach(visit);
    };
    visit(elementId);
    expect(parts).toEqual(
      expect.arrayContaining([
        "Label",
        "SliderOutput",
        "SliderTrack",
        "ColorThumb",
      ]),
    );
    expect(steps()).toBe(before + 1);
    await workspace.undo();
    expect(steps()).toBe(before);
    // A non-RAC color: refused, no step.
    const refused = await host.create({
      type: "ColorSlider",
      parentId: null,
      props: { defaultValue: "red" },
    });
    expect(refused.ok).toBe(false);
    expect(steps()).toBe(before);
  });
});
