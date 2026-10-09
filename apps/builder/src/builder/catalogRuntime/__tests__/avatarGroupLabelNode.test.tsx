// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { getPrimitiveBinding } from "../../../../../../packages/shared/src/catalog/bindings";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-09 (사용자 「AvatarGroup label 노드 전환 진행해」): the S2 AvatarGroup
 * (`@react-spectrum/s2/src/AvatarGroup.tsx`) draws its `label` as a visible `span` after the
 * avatars (`marginStart: 8`, font `ui` · `ui-lg` · `ui-xl` … by the group size) and names the
 * `role="group"` with it (`useLabel` — here `aria-label` with the label's text, the same name). The origin's `label` is a Text node (`{label}`) after the
 * Avatars; the AvatarGroup type has no `label` prop.
 */
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(props: Record<string, string> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:avatar-group" as EntryId<"project">,
        name: "AvatarGroup",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `avatar-group-${Math.random()}`),
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
          id: ROOT,
          definitionId: catalogPaletteDefinitionId(library, "AvatarGroup"),
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const records = () => [...root.canvasInputs.values()];
  const group = () => records().find((r) => root.typeOf(r) === "AvatarGroup")!;
  const kids = () => records().filter((r) => r.parentId === group().id);
  const rect = (id: string) => root.getGeometry([id]).get(id)!;
  return { workspace, root, group, kids, rect };
}

describe("AvatarGroup — the S2 label is a Text node", () => {
  it("the type has no `label` prop (the origin's `{label}` is the Text node's)", () => {
    expect(
      getPrimitiveBinding("AvatarGroup")?.props.accepts,
    ).not.toHaveProperty("label");
  });

  it("is AvatarGroup > Avatar × 3 + Text {label}, the text after the avatars with gap 8", async () => {
    const { root, kids, rect } = await open();
    const children = kids();
    expect(children.map((r) => root.typeOf(r))).toEqual([
      "Avatar",
      "Avatar",
      "Avatar",
      "Text",
    ]);
    const label = children[3]!;
    expect(label.props.children).toBe("Team");
    const last = rect(children[2]!.id);
    expect(rect(label.id).x - (last.x + last.width)).toBe(8);
  });

  it("the origin's `label` edits the Text (instance prop)", async () => {
    const { workspace, root, kids } = await open({ label: "Design" });
    expect(kids()[3]!.props.children).toBe("Design");
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(kids()[0]!.parentId!)!.target],
        props: { label: set("Engineering") },
      }),
    );
    expect(kids()[3]!.props.children).toBe("Engineering");
    expect(root).toBeDefined();
  });

  it.each([
    ["xs", 14],
    ["sm", 16],
    ["md", 18],
    ["lg", 20],
    ["xl", 24],
  ])(
    "size %s: the label is %ipx (S2 `ui` · `ui-lg` · `ui-xl` … by the avatar size)",
    async (size, fontSize) => {
      const { workspace, kids } = await open();
      const group = kids()[0]!.parentId!;
      workspace.execute(
        setFields({
          targets: [workspace.positionOfRecord(group)!.target],
          props: { size: set(size) },
        }),
      );
      expect(kids()[3]!.visual.fontSize).toBe(fontSize);
    },
  );

  it("Canvas paints the label text", async () => {
    const { root, kids } = await open();
    const binding = bindCatalogCanvas(root, root.pageRootRecords());
    const text = getSkiaNode(kids()[3]!.id)?.text;
    binding.dispose();
    expect(text?.content ?? text).toBeTruthy();
  });

  it("Preview: role=group named by the label, the span after the avatars", async () => {
    const { root, group } = await open();
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    const id = [...root.domInputs.values()].find(
      (r) => r.sourceId === group().sourceId,
    )!.id;
    await act(async () => reactRoot.render(renderCatalogDom(root, id)));
    const el = host.querySelector<HTMLElement>(`[data-catalog-id="${id}"]`)!;
    expect(el.getAttribute("role")).toBe("group");
    const label = el.lastElementChild as HTMLElement;
    expect(label.tagName).toBe("SPAN");
    expect(label.textContent).toBe("Team");
    // (S2 names the group with its label — `useLabel` `aria-labelledby`; the same name.)
    expect(el.getAttribute("aria-label")).toBe("Team");
    await act(async () => reactRoot.unmount());
    host.remove();
  });
});
